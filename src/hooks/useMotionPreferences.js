import { useReducedMotion } from 'framer-motion';
import { DURATIONS, SPRINGS } from '../util/motion';

export function useMotionPreferences() {
  const shouldReduceMotion = useReducedMotion();
  
  return {
    shouldReduceMotion,
    duration: shouldReduceMotion ? 0 : DURATIONS.medium,
    spring: shouldReduceMotion ? { duration: 0 } : SPRINGS.gentle,
  };
}
