import { useEffect, useState } from 'react';
import { DURATIONS, SPRINGS } from '../util/motion';

const getReducedMotionPreference = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export function useMotionPreferences() {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(getReducedMotionPreference);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => setShouldReduceMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    shouldReduceMotion,
    duration: shouldReduceMotion ? 0 : DURATIONS.medium,
    spring: shouldReduceMotion ? { duration: 0 } : SPRINGS.gentle,
  };
}
