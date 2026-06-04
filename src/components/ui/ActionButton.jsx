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
      return 'bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white shadow-lg hover:shadow-[var(--color-accent-primary)]/20';
    }
    
    if (variant === 'icon') {
      return active 
        ? 'bg-[var(--color-accent-primary)] text-white shadow-lg border-transparent hover:bg-[var(--color-accent-hover)]' 
        : 'bg-black/40 backdrop-blur-md border border-[var(--color-border)] text-white hover:bg-white/10 hover:border-white/30';
    }

    // Default Secondary (Glass)
    return active
      ? 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50 hover:bg-[var(--color-accent-primary)]/20'
      : 'bg-white/5 backdrop-blur-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 hover:border-white/30';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${getVariantClasses()}
        ${className}
      `}
      title={label}
    >
      {icon && (
        <span className={`flex-shrink-0 ${variant === 'icon' ? '' : (active && variant === 'secondary' ? 'text-[var(--color-accent-primary)]' : '')}`}>
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
