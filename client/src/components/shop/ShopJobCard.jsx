import React, { useState } from 'react';
import { Clock, Printer, CheckCircle, PackageCheck, AlertCircle, FileText, Check } from 'lucide-react';

export const ShopJobCard = ({ job, onUpdateStatus, onVerifyClick }) => {
  const [finishingDone, setFinishingDone] = useState(false);

  const formatSlot = (start) => {
    if (!start) return 'Walk-In';
    const d = new Date(start);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const options = job.options || {};
  const hasBinding = options.binding && options.binding !== 'none';

  return (
    <div
      data-testid="shop-job-card"
      className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
    >
      {/* Top Header: Slot time + Status Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Slot: {formatSlot(job.slotStart)}</span>
        </div>

        <span
          className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
            job.status === 'READY'
              ? 'bg-emerald-100 text-emerald-800'
              : job.status === 'PRINTING'
              ? 'bg-indigo-100 text-indigo-800 animate-pulse'
              : job.status === 'FINISHING'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {job.status}
        </span>
      </div>

      {/* Document info and plain-words options */}
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <h4 className="font-extrabold text-slate-900 text-base truncate">
            {job.originalFilename}
          </h4>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          {job.pageCount} pages • {options.copies || 1} {options.copies > 1 ? 'copies' : 'copy'} • Total {job.pageCount * (options.copies || 1)} printed sheets
        </p>
      </div>

      {/* Colored Badges */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {/* Color Badge */}
        {options.color ? (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
            COLOR {options.colorPageRanges ? `(${options.colorPageRanges})` : ''}
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
            B&W
          </span>
        )}

        {/* Duplex Badge */}
        {options.duplex ? (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
            DUPLEX
          </span>
        ) : (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
            SIMPLEX
          </span>
        )}

        {/* Binding Badges */}
        {options.binding === 'spiral' && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
            SPIRAL BINDING
          </span>
        )}
        {options.binding === 'staple' && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
            STAPLE
          </span>
        )}
        {options.binding === 'punch' && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 border border-orange-200">
            PUNCH 2-HOLES
          </span>
        )}

        {/* Paper Size */}
        {options.paperSize === 'A3' && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
            A3 PAPER
          </span>
        )}
      </div>

      {/* Notes from customer if any */}
      {options.notes && (
        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-xs">
          <span className="font-bold">Student Note: </span>
          {options.notes}
        </div>
      )}

      {/* Finishing Checklist if job requires binding */}
      {hasBinding && (job.status === 'PRINTED' || job.status === 'FINISHING') && (
        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
          <span className="text-xs font-bold text-purple-900 block">Finishing Checklist:</span>
          <label className="flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
            <input
              type="checkbox"
              checked={finishingDone}
              onChange={(e) => setFinishingDone(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold">
              Completed {options.binding.toUpperCase()} binding ({options.copies || 1} copies)
            </span>
          </label>
        </div>
      )}

      {/* Action Buttons for Counter Operator */}
      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
        {job.status === 'QUEUED' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(job._id, 'PRINTING')}
            className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Send to Print</span>
          </button>
        )}

        {job.status === 'PRINTING' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(job._id, 'PRINTED')}
            className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Printing Done</span>
          </button>
        )}

        {(job.status === 'PRINTED' || job.status === 'FINISHING') && (
          <button
            type="button"
            disabled={hasBinding && !finishingDone}
            onClick={() => onUpdateStatus(job._id, 'READY')}
            className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Mark Ready for Pickup</span>
          </button>
        )}

        {job.status === 'READY' && (
          <button
            type="button"
            onClick={() => onVerifyClick(job)}
            className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs bg-slate-900 hover:bg-black text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Verify & Hand Over</span>
          </button>
        )}
      </div>
    </div>
  );
};
