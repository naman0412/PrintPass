import React from 'react';
import { Clock, ShieldCheck, Tag } from 'lucide-react';

export const LiveQuoteCard = ({ quote, estimatedWait, loading = false }) => {
  if (loading) {
    return (
      <div className="rounded-2xl p-4 bg-slate-900 text-white animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-slate-700 rounded w-1/2 mb-4"></div>
        <div className="h-3 bg-slate-800 rounded w-full"></div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="rounded-2xl p-5 bg-slate-900 text-white shadow-xl shadow-slate-900/10 border border-slate-800 space-y-4">
      {/* Header with Wait Time badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Guaranteed Price & Wait
        </span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-extrabold">
          <Clock className="w-3.5 h-3.5" />
          <span>Ready in ~{estimatedWait} mins</span>
        </div>
      </div>

      {/* Big Total Price */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            ₹{quote.total}
          </span>
          <span className="text-xs text-slate-400 ml-2">all taxes included</span>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Locked-in Price
        </span>
      </div>

      {/* Breakdown lines */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
        <div className="flex justify-between text-slate-300">
          <span>Pages to print ({quote.totalPages} total)</span>
          <span>₹{quote.baseCost}</span>
        </div>

        {quote.duplexDiscount > 0 && (
          <div className="flex justify-between text-emerald-400 font-semibold">
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Double-sided saving
            </span>
            <span>- ₹{quote.duplexDiscount}</span>
          </div>
        )}

        {quote.bindingCost > 0 && (
          <div className="flex justify-between text-slate-300">
            <span>Finishing & binding</span>
            <span>+ ₹{quote.bindingCost}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Fixed pickup slot • Auto-refund if shop is delayed</span>
      </div>
    </div>
  );
};
