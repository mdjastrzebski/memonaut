/** Pause between a word and its spoken hint, as in memo-bot. */
export const HINT_DELAY_MS = 700;

/** The word last queued; kept referenced so Chrome doesn't garbage-collect it mid-speech. */
let latest: SpeechSynthesisUtterance | null = null;
/** The word whose hint is still to be read once it ends. */
let hintPending: SpeechSynthesisUtterance | null = null;
let hintTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Reads `text` aloud in the language given as a BCP 47 tag, e.g. "de-DE", then `hint` after a short
 * pause, e.g. "zbiornik słonej wody" after "morze". Does nothing where the browser has no speech
 * synthesis, or while the same word is still being read or waiting to be.
 *
 * Deliberately minimal, like memo-bot's fallback that works in Brave: no `cancel()` and no voice
 * picked from `getVoices()`, which Brave alters for fingerprinting protection.
 */
export function speak(text: string, lang: string, hint?: string) {
  if (!('speechSynthesis' in globalThis)) return;

  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy && latest?.text === text && latest.lang === lang) return;

  stopHint();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.onerror = (event) => {
    // "not-allowed" means the page hasn't been interacted with yet.
    console.warn(`Could not read "${text}" aloud: ${event.error}`);
  };
  if (hint) {
    hintPending = utterance;
    utterance.onend = () => {
      // Skipped once another word was queued or the hint was stopped.
      if (hintPending !== utterance || latest !== utterance) return;
      hintTimer = setTimeout(() => speak(hint, lang), HINT_DELAY_MS);
    };
  }
  latest = utterance;
  speechSynthesis.speak(utterance);
}

/** Keeps a hint not read yet from being read, e.g. once its exercise is gone. */
export function stopHint() {
  hintPending = null;
  clearTimeout(hintTimer);
}
