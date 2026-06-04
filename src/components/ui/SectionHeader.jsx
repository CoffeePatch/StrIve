import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * SectionHeader
 * Standardized pattern for section headers (e.g., "Cast", "Episodes", "Recommendations")
 * 
 * @param {string} title - The title of the section
 * @param {React.ReactNode} icon - Optional icon to display before the title (e.g., Lucide icon)
 * @param {string} actionText - Optional text for an action link (e.g., "See All")
 * @param {function} onAction - Optional click handler for the action link
 * @param {string} className - Additional CSS classes
 */
const SectionHeader = ({
  title,
  icon,
  actionText,
  onAction,
  className = ""
}) => {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="text-[var(--color-accent-primary)] flex items-center justify-center">
            {icon}
          </div>
        )}
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] font-display tracking-tight">
          {title}
        </h2>
      </div>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="group flex items-center gap-1 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] rounded-md px-2 py-1 -mr-2"
        >
          {actionText}
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    </div>
  );
};

export default SectionHeader;
