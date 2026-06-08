import React from 'react';
import { motion } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';

const PageTransition = ({ children, className = '' }) => {
  const { shouldReduceMotion } = useMotionPreferences();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" }}
      className={`w-full min-h-screen ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
