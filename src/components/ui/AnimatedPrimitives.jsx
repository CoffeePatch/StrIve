import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';

export const AnimatedButton = ({ children, className = '', ...props }) => {
  const { shouldReduceMotion } = useMotionPreferences();
  return (
    <motion.button
      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      transition={{ duration: shouldReduceMotion ? 0 : undefined }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const AnimatedChip = ({ children, isActive, className = '', ...props }) => {
  const { shouldReduceMotion } = useMotionPreferences();
  return (
    <motion.button
      whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
      initial={false}
      animate={{ 
        backgroundColor: isActive ? 'rgba(220, 38, 38, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderColor: isActive ? 'rgba(220, 38, 38, 0.5)' : 'rgba(255, 255, 255, 0.1)',
        color: isActive ? 'rgb(239, 68, 68)' : 'rgba(255, 255, 255, 0.8)'
      }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.4, 0.0, 0.2, 1] }}
      className={`px-4 py-1.5 rounded-full text-[13px] font-secondary border ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const AnimatedIconButton = ({ children, className = '', ...props }) => {
  const { shouldReduceMotion } = useMotionPreferences();
  return (
    <motion.button
      whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
      transition={{ duration: shouldReduceMotion ? 0 : undefined }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const AnimatedDropdown = ({ isOpen, children, className = '', transformOrigin = 'top left' }) => {
  const { shouldReduceMotion } = useMotionPreferences();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -8 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.4, 0.0, 0.2, 1] }}
          style={{ transformOrigin }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const AnimatedCheckbox = ({ checked, onChange, label, disabled, className = '' }) => {
  const { shouldReduceMotion } = useMotionPreferences();
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <div className="relative flex items-center justify-center w-[18px] h-[18px] rounded-[4px] border border-white/20 transition-colors" style={{ backgroundColor: checked ? '#dc2626' : 'transparent', borderColor: checked ? '#dc2626' : 'rgba(255,255,255,0.2)' }}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="absolute opacity-0 w-0 h-0" />
        <svg viewBox="0 0 14 14" className="w-[12px] h-[12px] text-white overflow-visible">
          <motion.path
            d="M3 7 L6 10 L11 4"
            fill="transparent"
            strokeWidth="2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" }}
          />
        </svg>
      </div>
      {label && <span className="text-[13px] text-white/80">{label}</span>}
    </label>
  );
};
