import React from 'react';
import { Calendar, Clock, Check, Sparkles } from 'lucide-react';

export const SlotPicker = ({ slots, selectedSlot, onSelectSlot, loading = false }) => {
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
          4. Select Pickup Slot
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
          4. Select Pickup Slot
        </label>
        <span className="text-xs text-slate-400">Guaranteed ready window</span>
      </div>

      {slots.length === 0 ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          No remaining open slots today for this shop. All slots are either booked or shop hours have ended. Please choose another shop or check tomorrow morning.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
          {slots.map((slot, index) => {
            const isSelected = selectedSlot && selectedSlot.slotStart === slot.slotStart;
            const isEarliest = index === 0;

            return (
              <button
                key={slot.slotStart}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-600/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {isEarliest && (
                  <span className="absolute -top-2 right-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-600 text-white flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    Earliest
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{formatTime(slot.slotStart)}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                </div>

                <div className="text-[10px] text-slate-500 mt-1">
                  Until {formatTime(slot.slotEnd)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
