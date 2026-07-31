import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useMotionPreferences } from '../../../hooks/useMotionPreferences';

const WatchDateModal = ({ isOpen, onClose, onSave, initialDate, titleReleaseDate }) => {
  const { spring } = useMotionPreferences();
  const [mounted, setMounted] = useState(false);
  
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        let d = initialDate;
        // Handle Firestore Timestamp
        if (initialDate.toDate) {
          d = initialDate.toDate();
        } else if (typeof initialDate === 'number') {
          d = new Date(initialDate);
        } else if (typeof initialDate === 'string') {
          d = new Date(initialDate);
        }
        
        if (d instanceof Date && !isNaN(d.getTime())) {
          // Format as YYYY-MM-DD local time
          const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          setDate(localDate);
          // Format as HH:mm
          setTime(d.toTimeString().split(' ')[0].substring(0, 5));
        }
      } else {
        const now = new Date();
        const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        setDate(localDate);
        setTime(now.toTimeString().split(' ')[0].substring(0, 5));
      }
      setError('');
    }
  }, [isOpen, initialDate]);

  const handleSave = () => {
    setError('');
    
    if (!date) {
      setError('Please select a date.');
      return;
    }

    const selectedDateTime = new Date(`${date}T${time || '00:00'}:00`);
    const now = new Date();

    if (selectedDateTime > now) {
      setError('Watch date cannot be in the future.');
      return;
    }

    if (titleReleaseDate) {
      const release = new Date(titleReleaseDate);
      if (!isNaN(release.getTime()) && selectedDateTime < release) {
        setError('Watch date cannot be before the title was released.');
        return;
      }
    }

    onSave(selectedDateTime);
    onClose();
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const localDate = new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    setDate(localDate);
    setTime(yesterday.toTimeString().split(' ')[0].substring(0, 5));
  };

  const setToday = () => {
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    setDate(localDate);
    setTime(today.toTimeString().split(' ')[0].substring(0, 5));
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center sm:p-4" style={{ pointerEvents: isOpen ? 'auto' : 'none' }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet / Modal */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={spring}
            className="w-full bg-[#1A1C20] rounded-t-3xl md:rounded-2xl md:max-w-md overflow-hidden z-10 border border-white/10 flex flex-col shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            {/* Handle bar for mobile */}
            <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Choose Watch Date</h2>
              <button 
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/10 text-white/60 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-6 flex flex-col gap-5 overflow-y-auto hide-scrollbar">
              
              <div className="flex gap-3">
                <button 
                  onClick={setToday}
                  className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[14px] text-white font-medium transition-colors"
                >
                  Today
                </button>
                <button 
                  onClick={setYesterday}
                  className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[14px] text-white font-medium transition-colors"
                >
                  Yesterday
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-white/70 font-medium ml-1">Date</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E50914]/50 focus:bg-black/60 transition-colors color-scheme-dark"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-white/70 font-medium ml-1">Time <span className="text-white/40 font-normal">(Optional)</span></label>
                  <input 
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E50914]/50 focus:bg-black/60 transition-colors color-scheme-dark"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {error && (
                <div className="text-[#E50914] text-sm font-medium bg-[#E50914]/10 border border-[#E50914]/20 p-3 rounded-lg flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={onClose}
                  className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 h-12 rounded-xl bg-[#E50914] text-white font-bold hover:bg-[#E50914]/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default WatchDateModal;
