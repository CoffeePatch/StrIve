import React from 'react';

const STATUS_CONFIG = {
  // TV Series Status
  'Ended': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  'Returning Series': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  'Canceled': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  'In Production': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Post Production': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Released': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  
  // Tracking Status
  'Completed': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  'In Progress': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Plan to Watch': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  
  // Default
  'default': { bg: 'bg-white/10', text: 'text-white/80', border: 'border-white/20' }
};

/**
 * Badge
 * Standardized status badge
 * 
 * @param {string} text - The text to display
 * @param {string} status - Optional key to look up predefined colors (falls back to text if not provided)
 * @param {string} variant - 'solid', 'outline', or 'subtle' (default)
 */
const Badge = ({
  text,
  status,
  variant = 'subtle',
  className = ""
}) => {
  const configKey = status || text;
  const config = STATUS_CONFIG[configKey] || STATUS_CONFIG['default'];

  let variantClasses = "";
  if (variant === 'subtle') {
    variantClasses = `${config.bg} ${config.text} ${config.border} border`;
  } else if (variant === 'outline') {
    variantClasses = `bg-transparent ${config.text} ${config.border} border`;
  } else if (variant === 'solid') {
    // Basic solid mapping (could be improved with actual solid colors)
    variantClasses = `${config.bg.replace('/20', '/80')} text-white border-transparent`;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm ${variantClasses} ${className}`}>
      {text}
    </span>
  );
};

export default Badge;
