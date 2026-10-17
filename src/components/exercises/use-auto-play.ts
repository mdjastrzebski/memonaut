import { useEffect, useRef } from 'react';

/**
 * Plays once as soon as the component appears, e.g. the word of an exercise. The ref keeps
 * StrictMode's second effect run from playing it again.
 */
export function useAutoPlay(play: () => void) {
  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once
  }, []);
}
