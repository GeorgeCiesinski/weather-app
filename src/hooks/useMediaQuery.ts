/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 */
import { useEffect, useState } from 'react';

/**
 * @param query - Media query string (e.g. `(min-width: 1024px)`).
 * @returns Whether the query matches the current viewport.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    function onChange(): void {
      setMatches(media.matches);
    }
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
