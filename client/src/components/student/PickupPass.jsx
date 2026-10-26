import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, Store, Clock, MapPin, ShieldAlert } from 'lucide-react';

export const PickupPass = ({ job }) => {
  const [copied, setCopied] = useState(false);

  if (!job) return null;

  const handleCopy = () => {
    if (job.pickupCode) {
      navigator.clipboard.writeText(job.pickupCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatSlot = (start, end) => {
    if (!start) return 'Walk-in Immediate';
    const s = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const e = end ? new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `${s} - ${e}`;
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden max-w-md mx-auto">
      {/* Top Banner */}
      <div className="bg-indigo-600 px-6 py-4 text-white flex items-center justify-between">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">
            PrintPass Pickup Ticket
          </span>
          <h2 className="text-lg font-black leading-tight">Show at Counter</h2>
        </div>
        <div className="p-2 bg-indigo-500/50 rounded-xl">
          <QrCode className="w-5 h-5" />
        </div>
      </div>

      <div className="p-6 text-center space-y-5">
        {/* Big 6-Character Pickup Code */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pickup Code
          </span>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span
              data-testid="pickup-code"
              className="text-4xl sm:text-5xl font-black tracking-widest text-slate-900 font-mono bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-200"
            >
              {job.pickupCode || 'PENDING'}
            </span>
            {job.pickupCode && (
              <button
                type="button"
                onClick={handleCopy}
                title="Copy Code"
                className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {job.qrToken && (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm">
              <QRCodeSVG
                value={job.qrToken}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-2">
              Operator scans this QR to instantly hand over print
            </span>
          </div>
        )}

        {/* Slot Time & Shop Location */}
        <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5 border border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-bold">Slot Window:</span>
            <span>{formatSlot(job.slotStart, job.slotEnd)}</span>
          </div>

          <div className="flex items-start gap-2 text-slate-700">
            <Store className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{job.shopId?.name || 'Photocopy Shop'}</span>
              <p className="text-slate-500 text-[11px]">{job.shopId?.address}</p>
            </div>
          </div>
        </div>

        {/* Automatic Privacy deletion alert */}
        <div className="p-3 rounded-xl bg-slate-100 text-[11px] text-slate-600 flex items-center gap-2 text-left">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Document file will be permanently deleted from servers as soon as this pass is verified at the counter.
          </span>
        </div>
      </div>
    </div>
  );
};
