import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT_PX } from './constants.js';

const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

function getMatches() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

// Tracks whether the viewport currently matches the single-pane mobile
// layout breakpoint. Updates live on resize, orientation change, and when a
// browser window is dragged across the threshold -- not just on mount.
export function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(QUERY);
    const handleChange = (e) => setIsMobile(e.matches);
    // addEventListener is the modern API; Safari <14 needs the legacy fallback.
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  return isMobile;
}
