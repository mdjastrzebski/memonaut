import { useEffect, useState, useSyncExternalStore } from 'react';

/** Pause between a word and its spoken hint, as in memo-bot. */
export const HINT_DELAY_MS = 700;

/** A parent's ElevenLabs API key, kept on this device only. */
const KEY_STORAGE_KEY = 'memonaut:elevenlabs-key';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
// Voices and context sentences picked in memo-bot by ear, per language.
const DEFAULT_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ';
const VOICE_IDS: Record<string, string> = {
  'de-DE': 'TX3LPaxmHKxFdv7VOQHJ',
  'en-GB': 'JBFqnCBsd6RMkjVDRZzb',
  'en-US': 'TX3LPaxmHKxFdv7VOQHJ',
  'es-ES': 'JBFqnCBsd6RMkjVDRZzb',
  'fr-FR': 'JBFqnCBsd6RMkjVDRZzb',
  'it-IT': 'SAz9YHcvj6GT2YYXdXww',
  'pl-PL': 'TX3LPaxmHKxFdv7VOQHJ',
  'pt-PT': 'SAz9YHcvj6GT2YYXdXww',
};
/** Said "before" the word, so a short word is pronounced in the right language. */
const PREVIOUS_TEXTS: Record<string, string> = {
  'de-DE': 'Das nächste Wort ist auf Deutsch.',
  'en-GB': 'The next word is in British English.',
  'en-US': 'The next word is in American English.',
  'es-ES': 'La siguiente palabra está en español.',
  'fr-FR': 'Le mot suivant est en français.',
  'it-IT': 'La prossima parola è in italiano.',
  'pl-PL': 'Następne słowo jest po polsku.',
  'pt-PT': 'A próxima palavra está em português.',
};

/**
 * ElevenLabs audio is mastered much quieter than browser voices, so each clip is brought to this
 * loudness (RMS of its spoken parts, about -14 dBFS), with a limiter catching the peaks.
 */
const TARGET_RMS = 0.2;
/** Parts quieter than this (about -40 dBFS) are pauses, left out when measuring loudness. */
const SILENCE_RMS = 0.01;
/** Keeps an almost silent clip from being blown up into noise. */
const MAX_GAIN = 8;

/**
 * Which voice reads words aloud: the browser's ("off"), ElevenLabs' ("on"), or the browser's again
 * because ElevenLabs rejected the key or ran out of credits ("paused").
 */
export type VoiceStatus = 'off' | 'on' | 'paused';

const listeners = new Set<() => void>();
/** The key ElevenLabs rejected; a new key turns it back on. Not saved, so a reload retries. */
let rejectedKey: string | null = null;
interface Clip {
  buffer: AudioBuffer;
  /** Brings the clip to the target loudness. */
  gain: number;
}

/** ElevenLabs audio per language and word, so replays don't use credits again. */
const audioCache = new Map<string, Promise<Clip | null>>();
/** The word last asked for while ElevenLabs is on; a newer one stops it. */
let current: { id: string; source: AudioBufferSourceNode | null; busy: boolean } | null = null;
/** Created on first use, with a limiter all clips play through. */
let audio: { context: AudioContext; output: AudioNode } | null = null;
/** The word last queued; kept referenced so Chrome doesn't garbage-collect it mid-speech. */
let latest: SpeechSynthesisUtterance | null = null;
/** The word, an utterance or an ElevenLabs request, whose hint is still to be read once it ends. */
let hintPending: object | null = null;
let hintTimer: ReturnType<typeof setTimeout> | undefined;

function loadKey() {
  try {
    return localStorage.getItem(KEY_STORAGE_KEY)?.trim() || null;
  } catch {
    // Storage can be blocked, e.g. in private mode; the browser's voice is then used.
    return null;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getVoiceStatus(): VoiceStatus {
  const key = loadKey();
  if (!key) return 'off';
  return key === rejectedKey ? 'paused' : 'on';
}

export function useVoiceStatus() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getVoiceStatus);
}

/** Saves the key and turns ElevenLabs on. Returns false when it can't be saved. */
export function saveElevenLabsKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE_KEY, key.trim());
  } catch {
    return false;
  }
  // Saving the same key again retries it, e.g. after buying more credits.
  rejectedKey = null;
  notify();
  return true;
}

/** Forgets the key and goes back to the browser's voice. */
export function removeElevenLabsKey() {
  try {
    localStorage.removeItem(KEY_STORAGE_KEY);
  } catch {
    return false;
  }
  notify();
  return true;
}

/**
 * Reads `text` aloud in the language given as a BCP 47 tag, e.g. "de-DE", then `hint` after a short
 * pause, e.g. "zbiornik słonej wody" after "morze". Uses ElevenLabs when a key is saved, else, or
 * when that fails, the browser's voice.
 */
export function speak(text: string, lang: string, hint?: string) {
  const key = loadKey();
  const output = key && key !== rejectedKey ? getAudioOutput() : null;
  if (key && output) void speakWithElevenLabs(text, lang, hint, key, output);
  else speakWithBrowser(text, lang, hint);
}

/** Keeps a hint not read yet from being read, e.g. once its exercise is gone. */
export function stopHint() {
  hintPending = null;
  clearTimeout(hintTimer);
}

/** Starts reading a new word: drops any earlier hint, and returns what to call once it ends. */
function startWord(word: object, lang: string, hint: string | undefined) {
  stopHint();
  if (!hint) return () => {};
  hintPending = word;
  return () => {
    // Skipped once another word was started or the hint was stopped.
    if (hintPending !== word) return;
    hintPending = null;
    hintTimer = setTimeout(() => speak(hint, lang), HINT_DELAY_MS);
  };
}

/** The shared audio context, resumed here since browsers only allow that after a tap or key. */
function getAudioOutput() {
  if (!audio) {
    if (!('AudioContext' in globalThis)) return null;
    const context = new AudioContext();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(context.destination);
    audio = { context, output: limiter };
  }
  if (audio.context.state === 'suspended') audio.context.resume().catch(() => {});
  return audio;
}

async function speakWithElevenLabs(
  text: string,
  lang: string,
  hint: string | undefined,
  key: string,
  { context, output }: { context: AudioContext; output: AudioNode },
) {
  const id = `${lang}::${text}`;
  if (current?.id === id && current.busy) return;

  current?.source?.stop();
  const request = { id, source: null as AudioBufferSourceNode | null, busy: true };
  current = request;
  const ended = startWord(request, lang, hint);

  let pending = audioCache.get(id);
  if (!pending) {
    pending = fetchClip(text, lang, key, context);
    audioCache.set(id, pending);
  }
  const clip = await pending;
  if (!clip) audioCache.delete(id);
  // A newer word was asked for meanwhile.
  if (current !== request) return;

  if (!clip) {
    request.busy = false;
    speakWithBrowser(text, lang, hintPending === request ? hint : undefined);
    return;
  }

  const source = context.createBufferSource();
  source.buffer = clip.buffer;
  const gain = context.createGain();
  gain.gain.value = clip.gain;
  source.connect(gain).connect(output);
  source.onended = () => {
    request.busy = false;
    ended();
  };
  request.source = source;
  source.start();
}

/** Fetches and decodes the word's audio, or null when ElevenLabs couldn't make it. */
async function fetchClip(text: string, lang: string, key: string, context: AudioContext) {
  try {
    const response = await fetch(`${ELEVENLABS_TTS_URL}/${VOICE_IDS[lang] ?? DEFAULT_VOICE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg', 'xi-api-key': key },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
        language_code: lang.split('-')[0].toLowerCase(),
        previous_text: PREVIOUS_TEXTS[lang] ?? '',
        next_text: '.',
      }),
    });
    if (!response.ok) {
      if (await isKeyProblem(response)) pause(key);
      return null;
    }
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    return { buffer, gain: getNormalizingGain(buffer) };
  } catch {
    // Offline, blocked, or audio the browser can't decode; the browser's voice reads it instead.
    return null;
  }
}

/** The gain that brings the clip's spoken parts, measured in 20 ms windows, to TARGET_RMS. */
export function getNormalizingGain(buffer: AudioBuffer) {
  const windowSize = Math.max(1, Math.round(buffer.sampleRate * 0.02));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let loudSum = 0;
  let loudCount = 0;
  for (let start = 0; start < buffer.length; start += windowSize) {
    const end = Math.min(start + windowSize, buffer.length);
    let sum = 0;
    for (const samples of channels) {
      for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    }
    const count = (end - start) * channels.length;
    if (Math.sqrt(sum / count) >= SILENCE_RMS) {
      loudSum += sum;
      loudCount += count;
    }
  }
  if (loudCount === 0) return 1;
  return Math.min(MAX_GAIN, TARGET_RMS / Math.sqrt(loudSum / loudCount));
}

/** Whether the key was rejected or ran out of credits, as opposed to a passing failure. */
async function isKeyProblem(response: Response) {
  if (response.status === 401 || response.status === 402 || response.status === 403) return true;
  const body = await response.text().catch(() => '');
  // E.g. {"detail":{"status":"quota_exceeded"}}.
  return /quota|credits?|billing|payment required|insufficient/i.test(body);
}

function pause(key: string) {
  if (rejectedKey === key) return;
  rejectedKey = key;
  console.warn('ElevenLabs rejected the key or ran out of credits; using the browser voice.');
  notify();
}

/** Errors that reading with `lang` alone, leaving the voice to the browser, may get around. */
const VOICE_ERRORS = new Set([
  'language-unavailable',
  'synthesis-failed',
  'synthesis-unavailable',
  'voice-unavailable',
]);

// Chrome loads its voices only once asked, so ask early for them to be ready by the first word.
if ('speechSynthesis' in globalThis) speechSynthesis.getVoices?.();

/** The browser voice picked per language, e.g. {"de-DE": "<voiceURI>"}, kept on this device only. */
const BROWSER_VOICES_STORAGE_KEY = 'memonaut:browser-voices';

function loadPickedVoices(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BROWSER_VOICES_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The `voiceURI` of the browser voice picked for `lang`, or null to pick one automatically. */
export function getPickedVoice(lang: string) {
  return loadPickedVoices()[lang] ?? null;
}

export function usePickedVoice(lang: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getPickedVoice(lang),
  );
}

/**
 * Saves the browser voice to read `lang` with, by its `voiceURI`, or null to pick one
 * automatically. Returns false when it can't be saved.
 */
export function pickBrowserVoice(lang: string, voiceURI: string | null) {
  const picked = loadPickedVoices();
  if (voiceURI) picked[lang] = voiceURI;
  else delete picked[lang];
  try {
    localStorage.setItem(BROWSER_VOICES_STORAGE_KEY, JSON.stringify(picked));
  } catch {
    return false;
  }
  notify();
  return true;
}

const normalizeLang = (tag: string) => tag.replace('_', '-').toLowerCase();

/**
 * The browser's voices for the language of `lang`, e.g. "de-DE": those for that exact language
 * first, then those for the same language elsewhere, e.g. "de-AT". Empty while they load.
 */
export function getBrowserVoices(lang: string) {
  if (!('speechSynthesis' in globalThis)) return [];
  const voices = speechSynthesis.getVoices?.() ?? [];
  const wanted = normalizeLang(lang);
  const base = wanted.split('-')[0];
  const exact = voices.filter((voice) => normalizeLang(voice.lang) === wanted);
  const related = voices.filter(
    (voice) =>
      normalizeLang(voice.lang) !== wanted && normalizeLang(voice.lang).split('-')[0] === base,
  );
  return [...exact, ...related];
}

/** The browser's voices for `lang`, updated once the browser has loaded them. */
export function useBrowserVoices(lang: string) {
  const [voices, setVoices] = useState(() => getBrowserVoices(lang));
  useEffect(() => {
    if (!('speechSynthesis' in globalThis)) return;
    const synthesis = speechSynthesis;
    const update = () => setVoices(getBrowserVoices(lang));
    update();
    synthesis.addEventListener?.('voiceschanged', update);
    return () => synthesis.removeEventListener?.('voiceschanged', update);
  }, [lang]);
  return voices;
}

/**
 * The browser's voice for `lang`: the one picked in the menu, else one for that exact language,
 * preferably offline and the default, else one for the same language elsewhere. Null when there
 * is none or the voices haven't loaded yet, leaving the choice to the browser.
 */
export function findVoice(lang: string) {
  const voices = getBrowserVoices(lang);
  const picked = getPickedVoice(lang);
  const pickedVoice = picked && voices.find((voice) => voice.voiceURI === picked);
  if (pickedVoice) return pickedVoice;

  const wanted = normalizeLang(lang);
  const rank = (voice: SpeechSynthesisVoice) =>
    (normalizeLang(voice.lang) === wanted ? 4 : 0) +
    (voice.localService ? 2 : 0) +
    (voice.default ? 1 : 0);
  return voices.sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/** Reads a sample sentence in `lang` with the browser's voice, to try the voice picked for it. */
export function previewBrowserVoice(lang: string) {
  stopHint();
  speakWithBrowser(PREVIOUS_TEXTS[lang] ?? lang, lang);
}

/**
 * Reads `text` with the browser's voice. Does nothing where the browser has no speech synthesis,
 * or while the same word is still being read or waiting to be.
 *
 * Picks the voice for `lang` itself, as some browsers read with their default voice, e.g. an
 * English one, whatever `lang` says. If that voice fails, e.g. one Brave altered for
 * fingerprinting protection, the word is read again with `lang` alone, like memo-bot's fallback.
 * No `cancel()`, which also trips up Brave.
 */
function speakWithBrowser(text: string, lang: string, hint?: string, pickVoice = true) {
  if (!('speechSynthesis' in globalThis)) return;

  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy && latest?.text === text && latest.lang === lang) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const voice = pickVoice ? findVoice(lang) : null;
  if (voice) utterance.voice = voice;
  // Slow, as in memo-bot, so a child can follow each sound.
  utterance.rate = 0.6;
  utterance.onerror = (event) => {
    if (voice && VOICE_ERRORS.has(event.error)) {
      if (latest === utterance) latest = null;
      speakWithBrowser(text, lang, hintPending === utterance ? hint : undefined, false);
      return;
    }
    // "not-allowed" means the page hasn't been interacted with yet.
    console.warn(`Could not read "${text}" aloud: ${event.error}`);
  };
  utterance.onend = startWord(utterance, lang, hint);
  latest = utterance;
  speechSynthesis.speak(utterance);
}
