import { useSyncExternalStore } from 'react';

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
};
/** Said "before" the word, so a short word is pronounced in the right language. */
const PREVIOUS_TEXTS: Record<string, string> = {
  'de-DE': 'Das nächste Wort ist auf Deutsch.',
  'en-GB': 'The next word is in British English.',
  'en-US': 'The next word is in American English.',
};

/**
 * Which voice reads words aloud: the browser's ("off"), ElevenLabs' ("on"), or the browser's again
 * because ElevenLabs rejected the key or ran out of credits ("paused").
 */
export type VoiceStatus = 'off' | 'on' | 'paused';

const listeners = new Set<() => void>();
/** The key ElevenLabs rejected; a new key turns it back on. Not saved, so a reload retries. */
let rejectedKey: string | null = null;
/** Object URLs of ElevenLabs audio per language and word, so replays don't use credits again. */
const audioCache = new Map<string, Promise<string | null>>();
/** The word last asked for while ElevenLabs is on; a newer one stops it. */
let current: { id: string; audio: HTMLAudioElement | null; busy: boolean } | null = null;
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
  if (key && key !== rejectedKey) void speakWithElevenLabs(text, lang, hint, key);
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

async function speakWithElevenLabs(
  text: string,
  lang: string,
  hint: string | undefined,
  key: string,
) {
  const id = `${lang}::${text}`;
  if (current?.id === id && current.busy) return;

  current?.audio?.pause();
  const request = { id, audio: null as HTMLAudioElement | null, busy: true };
  current = request;
  const ended = startWord(request, lang, hint);
  const done = () => {
    request.busy = false;
    ended();
  };

  let url = audioCache.get(id);
  if (!url) {
    url = fetchAudio(text, lang, key);
    audioCache.set(id, url);
  }
  const objectUrl = await url;
  if (!objectUrl) audioCache.delete(id);
  // A newer word was asked for meanwhile.
  if (current !== request) return;

  if (!objectUrl) {
    request.busy = false;
    speakWithBrowser(text, lang, hintPending === request ? hint : undefined);
    return;
  }

  const audio = new Audio(objectUrl);
  request.audio = audio;
  audio.onended = done;
  audio.onerror = done;
  // Rejects when the browser blocks autoplay or can't play the file.
  audio.play().catch(() => {
    request.busy = false;
    if (current === request)
      speakWithBrowser(text, lang, hintPending === request ? hint : undefined);
  });
}

/** Fetches the word's audio as an object URL, or null when ElevenLabs couldn't make it. */
async function fetchAudio(text: string, lang: string, key: string) {
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
    return URL.createObjectURL(await response.blob());
  } catch {
    // Offline or blocked; the browser's voice reads this word instead.
    return null;
  }
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

/**
 * Reads `text` with the browser's voice. Does nothing where the browser has no speech synthesis,
 * or while the same word is still being read or waiting to be.
 *
 * Deliberately minimal, like memo-bot's fallback that works in Brave: no `cancel()` and no voice
 * picked from `getVoices()`, which Brave alters for fingerprinting protection.
 */
function speakWithBrowser(text: string, lang: string, hint?: string) {
  if (!('speechSynthesis' in globalThis)) return;

  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy && latest?.text === text && latest.lang === lang) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.onerror = (event) => {
    // "not-allowed" means the page hasn't been interacted with yet.
    console.warn(`Could not read "${text}" aloud: ${event.error}`);
  };
  utterance.onend = startWord(utterance, lang, hint);
  latest = utterance;
  speechSynthesis.speak(utterance);
}
