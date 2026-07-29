import React from 'react';

/**
 * ActionButton
 * Standardized button for media actions (Watchlist, Rate, Review, etc.)
 * 
 * @param {React.ReactNode} icon - The icon to display
 * @param {string} label - The text label
 * @param {function} onClick - Click handler
 * @param {boolean} active - Whether the action is in an active state (e.g., already watchlisted)
 * @param {string} variant - 'primary' (red), 'secondary' (glass), 'icon' (just circle)
 * @param {string} size - 'sm', 'md', 'lg'
 */
const ActionButton = ({
  icon,
  label,
  onClick,
  active = false,
  variant = 'secondary',
  size = 'md',
  className = "",
  disabled = false
}) => {
  // Size classes
  const sizeClasses = {
    sm: variant === 'icon' ? 'w-8 h-8' : 'px-3 py-1.5 text-xs gap-1.5',
    md: variant === 'icon' ? 'w-10 h-10' : 'px-4 py-2 text-sm gap-2',
    lg: variant === 'icon' ? 'w-12 h-12' : 'px-6 py-3 text-base gap-2'
  };

  // Variant classes
  const getVariantClasses = () => {
    if (variant === 'primary') {
      return 'bg-accent hover:bg-accent-hover text-inverse shadow-lg shadow-accent/20';
    }
    
    if (variant === 'icon') {
      return active 
        ? 'bg-accent text-inverse shadow-lg border-transparent hover:bg-accent-hover' 
        : 'bg-backdrop backdrop-blur-md border border-border-subtle text-primary hover:bg-surface-hover hover:border-border';
    }

    // Default Secondary (Glass)
    return active
      ? 'bg-accent/10 text-accent border border-accent/50 hover:bg-accent/20'
      : 'bg-overlay backdrop-blur-md border border-border-subtle text-secondary hover:text-primary hover:bg-surface-hover hover:border-border';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${getVariantClasses()}
        ${className}
      `}
      title={label}
    >
      {icon && (
        <span className={`flex-shrink-0 ${variant === 'icon' ? '' : (active && variant === 'secondary' ? 'text-accent' : '')}`}>
          {icon}
        </span>
      )}
      {variant !== 'icon' && label && (
        <span>{label}</span>
      )}
    </button>
  );
};

export default ActionButton;
