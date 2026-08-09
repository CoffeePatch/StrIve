import React, { useState, useEffect } from 'react';
import { SquarePen, Plus, Trash2, Check, X, NotebookPen } from 'lucide-react';
import { toast } from 'react-toastify';

const MAX_CHAR_LIMIT = 5000;

const UserNotesWidget = ({ notes, onSaveNotes }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setText(notes || '');
  }, [notes]);

  const handleStartEdit = () => {
    setText(notes || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setText(notes || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (text.length > MAX_CHAR_LIMIT) {
      toast.error(`Note exceeds maximum limit of ${MAX_CHAR_LIMIT} characters`);
      return;
    }

    setIsSaving(true);
    try {
      await onSaveNotes(text);
      toast.success(text.trim() ? 'Personal note saved' : 'Personal note cleared');
      setIsEditing(false);
    } catch {
      toast.error('Failed to save personal note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setText('');
    setIsSaving(true);
    try {
      await onSaveNotes('');
      toast.info('Personal note cleared');
      setIsEditing(false);
    } catch {
      toast.error('Failed to clear personal note');
    } finally {
      setIsSaving(false);
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHAR_LIMIT;

  return (
    <div className="glass-effect rounded-2xl p-5 border border-white/10 shadow-xl space-y-4 my-6">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <NotebookPen className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Personal Notes & Thoughts</h3>
        </div>

        {!isEditing && notes && (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/60 hover:bg-surface border border-white/10 text-sm font-medium text-muted hover:text-foreground transition-all"
            aria-label="Edit personal notes"
          >
            <SquarePen className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* View Mode */}
      {!isEditing && (
        <div>
          {notes ? (
            <div className="text-foreground/90 text-sm md:text-base leading-relaxed whitespace-pre-wrap bg-background/40 rounded-xl p-4 border border-white/5">
              {notes}
            </div>
          ) : (
            <div
              onClick={handleStartEdit}
              className="cursor-pointer group flex items-center justify-between p-4 rounded-xl border border-dashed border-white/15 bg-surface/30 hover:bg-surface/50 hover:border-primary/40 transition-all"
            >
              <span className="text-sm text-muted group-hover:text-foreground transition-colors">
                Add personal notes or review thoughts...
              </span>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 group-hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your thoughts, review, or reminder notes here..."
            rows={4}
            maxLength={MAX_CHAR_LIMIT + 100}
            autoFocus
            className={`w-full bg-background/70 text-foreground text-sm md:text-base p-4 rounded-xl border focus:outline-none transition-all resize-y min-h-[120px] ${
              isOverLimit
                ? 'border-error focus:border-error ring-1 ring-error/50'
                : 'border-white/15 focus:border-primary ring-1 ring-primary/30'
            }`}
          />

          {/* Controls Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span
              className={`text-xs font-mono font-medium ${
                isOverLimit
                  ? 'text-error'
                  : charCount > 4500
                  ? 'text-warning'
                  : 'text-muted'
              }`}
            >
              {charCount.toLocaleString()} / {MAX_CHAR_LIMIT.toLocaleString()}
            </span>

            <div className="flex items-center gap-2">
              {notes && (
                <button
                  onClick={handleClear}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 text-error border border-error/20 text-xs font-medium transition-all disabled:opacity-50"
                  aria-label="Clear personal note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}

              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface/60 hover:bg-surface text-muted hover:text-foreground text-xs font-medium border border-white/10 transition-all disabled:opacity-50"
                aria-label="Cancel editing"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || isOverLimit}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                aria-label="Save personal note"
              >
                <Check className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(UserNotesWidget);
