import completedUrl from '@/assets/sounds/completed.mp3';
import correctUrl from '@/assets/sounds/correct.wav';

const VOLUME = 0.5;

/** One element per sound, created on first play, so replays don't fetch the file again. */
const elements = new Map<string, HTMLAudioElement>();

function play(url: string) {
  let audio = elements.get(url);
  if (!audio) {
    audio = new Audio(url);
    audio.volume = VOLUME;
    elements.set(url, audio);
  }
  audio.currentTime = 0;
  // Rejects when the browser blocks autoplay or can't load the file; sounds are only a bonus.
  audio.play().catch(() => {});
}

/** A short chime for a right answer. */
export function playCorrect() {
  play(correctUrl);
}

/** A fanfare for finishing a session. */
export function playCompleted() {
  play(completedUrl);
}
