/** The word last queued; kept referenced so Chrome doesn't garbage-collect it mid-speech. */
let latest: SpeechSynthesisUtterance | null = null;

/**
 * Reads `text` aloud in the language given as a BCP 47 tag, e.g. "de-DE". Does nothing where the
 * browser has no speech synthesis, or while the same word is still being read or waiting to be.
 *
 * Deliberately minimal, like memo-bot's fallback that works in Brave: no `cancel()` and no voice
 * picked from `getVoices()`, which Brave alters for fingerprinting protection.
 */
export function speak(text: string, lang: string) {
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
  latest = utterance;
  speechSynthesis.speak(utterance);
}
