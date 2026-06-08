export const DURATIONS = {
  instant: 0.1,   // micro-feedback (button press)
  fast: 0.2,      // small UI changes (chip toggle, dropdown)
  medium: 0.3,    // layout shifts (grid reflow, view mode)
  slow: 0.5,      // big transitions (page changes, modals)
};

export const EASINGS = {
  // Material Design standard easing curves
  standard: [0.4, 0.0, 0.2, 1],     // most things
  decelerate: [0.0, 0.0, 0.2, 1],   // entering elements
  accelerate: [0.4, 0.0, 1, 1],     // exiting elements
  emphasized: [0.2, 0.0, 0, 1],     // important transitions
};

export const SPRINGS = {
  // Spring physics for natural motion
  gentle: { type: "spring", stiffness: 120, damping: 14 },
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  bouncy: { type: "spring", stiffness: 300, damping: 15 },
};
