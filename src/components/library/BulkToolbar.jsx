import React, { useState, useRef, useEffect } from 'react';
import '../../styles/BulkToolbar.css';

const WATCH_STATUS_OPTIONS = [
  { id: 'watching', label: 'Watching', icon: 'visibility' },
  { id: 'completed', label: 'Completed', icon: 'check_circle' },
  { id: 'plan to watch', label: 'Plan to Watch', icon: 'schedule' },
  { id: 'on hold', label: 'On Hold', icon: 'pause_circle' },
  { id: 'dropped', label: 'Dropped', icon: 'cancel' },
  { id: 'none', label: 'Remove Status', icon: 'delete_outline' },
];

const BulkToolbar = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onUpdateStatus,
  onDelete,
  onClose,
  isProcessing = false
}) => {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setStatusDropdownOpen(false);
      }
    };
    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusDropdownOpen]);

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="bulk-toolbar-container">
      <div className="flex items-center gap-3">
        <button
          className="bulk-toolbar-btn"
          onClick={allSelected ? onClearSelection : onSelectAll}
          disabled={isProcessing}
        >
          <span className="material-symbols-outlined">
            {allSelected ? 'check_box' : selectedCount > 0 ? 'indeterminate_check_box' : 'check_box_outline_blank'}
          </span>
          <span className="label">{allSelected ? 'Deselect All' : 'Select All'}</span>
        </button>
        <div className="bulk-toolbar-count">
          {selectedCount} selected
        </div>
      </div>

      <div className="bulk-toolbar-divider" />

      <div className="bulk-toolbar-actions">
        <div className="relative" ref={dropdownRef}>
          <button
            className="bulk-toolbar-btn"
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            disabled={selectedCount === 0 || isProcessing}
            title="Update Status"
          >
            <span className="material-symbols-outlined">label</span>
            <span className="label">Status</span>
          </button>
          
          {statusDropdownOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-48 glass-effect rounded-lg border border-border-subtle bg-surface/98 p-1.5 shadow-2xl z-50 flex flex-col">
              {WATCH_STATUS_OPTIONS.map(option => (
                <button
                  key={option.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover text-left text-[14px] text-primary font-secondary transition-colors"
                  onClick={() => {
                    onUpdateStatus(option.id === 'none' ? null : option.label);
                    setStatusDropdownOpen(false);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="bulk-toolbar-btn btn-danger"
          onClick={onDelete}
          disabled={selectedCount === 0 || isProcessing}
          title="Delete Selected"
        >
          <span className="material-symbols-outlined">delete</span>
          <span className="label">Delete</span>
        </button>
      </div>

      <div className="bulk-toolbar-divider" />

      <button className="bulk-toolbar-btn btn-primary" onClick={onClose} disabled={isProcessing}>
        Done
      </button>
    </div>
  );
};

export default BulkToolbar;
