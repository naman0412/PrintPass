import React from 'react';
import { Check, Clock, Printer, PackageCheck, AlertTriangle, XCircle, Sparkles } from 'lucide-react';

const STEPS = [
  { key: 'QUEUED', label: 'In Queue', icon: Clock, desc: 'Assigned to shop printer' },
  { key: 'PRINTING', label: 'Printing', icon: Printer, desc: 'Pages rolling off printer' },
  { key: 'FINISHING', label: 'Finishing', icon: Sparkles, desc: 'Binding & stapling' },
  { key: 'READY', label: 'Ready for Pickup', icon: PackageCheck, desc: 'Waiting on counter' },
  { key: 'COLLECTED', label: 'Collected', icon: Check, desc: 'Completed & file deleted' }
];

export const StatusTimeline = ({ status, hasBinding = false }) => {
  // If no binding, filter out FINISHING step
  const activeSteps = STEPS.filter((step) => {
    if (step.key === 'FINISHING' && !hasBinding) return false;
    return true;
  });

  const getStepIndex = (st) => {
    if (st === 'PRINTED') return activeSteps.findIndex((s) => s.key === 'READY') - 1;
    return activeSteps.findIndex((s) => s.key === st);
  };

  const currentIndex = getStepIndex(status);

  // If in a terminal exit state
  if (['CANCELLED', 'FAILED', 'NO_SHOW'].includes(status)) {
    const isCancel = status === 'CANCELLED';
    return (
      <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${
        isCancel ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-rose-50 border-rose-200 text-rose-700'
      }`}>
        {isCancel ? <XCircle className="w-6 h-6 text-slate-500" /> : <AlertTriangle className="w-6 h-6 text-rose-600" />}
        <div>
          <span className="font-extrabold text-sm">{status}</span>
          <p className="text-xs opacity-80">
            {isCancel
              ? 'Job was cancelled before printing. Any payment made has been refunded.'
              : 'Job could not be completed or student was a no-show. Temporary files have been purged.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Live Status Timeline
        </span>
        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
          {status}
        </span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {activeSteps.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          const IconComponent = step.icon;

          return (
            <div key={step.key} className="relative flex items-start gap-3">
              {/* Timeline marker icon */}
              <div
                className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 animate-pulse'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <IconComponent className="w-3 h-3" />}
              </div>

              <div className="pt-0.5">
                <span
                  className={`text-sm font-extrabold leading-tight block ${
                    isCurrent
                      ? 'text-indigo-600'
                      : isDone
                      ? 'text-slate-900'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-xs text-slate-500">{step.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
