import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { AnimatedButton } from '../ui/AnimatedPrimitives';

export default function EditListModal({ list, isOpen, onClose, onSave }) {
  const [name, setName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !list) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('List name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(list.id, {
        name: name.trim(),
        description: description.trim()
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <h2 className="text-lg font-bold font-secondary text-primary">Edit Custom List</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-secondary">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 font-secondary">
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
              List Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekend Movie Marathon"
              className="w-full bg-backdrop border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-accent/60"
              maxLength={80}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this custom list..."
              rows={3}
              className="w-full bg-backdrop border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-accent/60 resize-none"
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <AnimatedButton
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-accent text-white font-medium text-xs flex items-center gap-2 hover:bg-accent-hover transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </AnimatedButton>
          </div>
        </form>
      </div>
    </div>
  );
}
