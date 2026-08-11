import React from 'react';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  onSkipChange,
  skipChecked,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-backdrop flex items-center justify-center z-50">
      <div className="bg-surface border border-border p-8 rounded-lg shadow-xl max-w-sm w-full text-primary">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-6 text-secondary">{message}</p>
        <div className="flex items-center mb-6">
          <input
            type="checkbox"
            id="skip-confirm-modal"
            checked={skipChecked}
            onChange={onSkipChange}
            className="mr-2"
          />
          <label htmlFor="skip-confirm-modal" className="text-secondary">Don't ask me again</label>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="bg-surface-hover hover:bg-border text-primary px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-error hover:bg-red-700 text-inverse px-4 py-2 rounded transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;