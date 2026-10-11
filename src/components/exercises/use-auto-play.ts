import { useEffect, useRef } from 'react';

/**
 * Plays the word once as soon as the exercise appears. The ref keeps StrictMode's second effect run
 * from cancelling and queueing it again.
 */
export function useAutoPlay(play: () => void) {
  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once per exercise
  }, []);
}
