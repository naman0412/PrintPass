import React from 'react';
import { Palette, Copy, Layers, Scissors, FileText, Plus, Minus, BookOpen } from 'lucide-react';

export const PrintOptionsForm = ({ options, onChange, totalDocPages = 1 }) => {
  const updateOption = (field, value) => {
    onChange({ ...options, [field]: value });
  };

  const incrementCopies = () => {
    updateOption('copies', Math.min(100, (options.copies || 1) + 1));
  };

  const decrementCopies = () => {
    updateOption('copies', Math.max(1, (options.copies || 1) - 1));
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
        3. Print Specifications
      </label>

      {/* Color Mode Toggle */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700">Color Mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateOption('color', false)}
            className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all ${
              !options.color
                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-slate-900" />
            <span>Black & White</span>
          </button>

          <button
            type="button"
            onClick={() => updateOption('color', true)}
            className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all ${
              options.color
                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <Palette className="w-4 h-4 text-amber-500" />
            <span>Full Color</span>
          </button>
        </div>

        {/* Color page range input if color is active */}
        {options.color && (
          <div className="pt-1">
            <input
              type="text"
              placeholder='Specify color page numbers (e.g. "1, 3-5" or leave blank for all color)'
              value={options.colorPageRanges || ''}
              onChange={(e) => updateOption('colorPageRanges', e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        )}
      </div>

      {/* Double-Sided / Duplex Toggle */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700">Sides</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateOption('duplex', false)}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all ${
              !options.duplex
                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Single-Sided</span>
          </button>

          <button
            type="button"
            onClick={() => updateOption('duplex', true)}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all ${
              options.duplex
                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Double-Sided (Save ₹)</span>
          </button>
        </div>
      </div>

      {/* Copies Stepper & Paper Size */}
      <div className="grid grid-cols-2 gap-3">
        {/* Copies */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700">Copies</span>
          <div className="flex items-center justify-between border-2 border-slate-200 rounded-xl bg-white px-2 py-1">
            <button
              type="button"
              onClick={decrementCopies}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-extrabold text-slate-900 text-sm">
              {options.copies || 1}
            </span>
            <button
              type="button"
              onClick={incrementCopies}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Size */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700">Paper Size</span>
          <div className="grid grid-cols-2 gap-1.5">
            {['A4', 'A3'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => updateOption('paperSize', size)}
                className={`py-2 rounded-xl font-bold text-xs border-2 transition-all ${
                  (options.paperSize || 'A4') === size
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Binding Options */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700">Finishing & Binding</span>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'none', label: 'None' },
            { id: 'spiral', label: 'Spiral' },
            { id: 'staple', label: 'Staple' },
            { id: 'punch', label: '2-Hole' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => updateOption('binding', item.id)}
              className={`py-2 px-1 rounded-xl font-bold text-xs text-center border-2 transition-all ${
                (options.binding || 'none') === item.id
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page Range Selection */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700">Pages to Print</span>
        <input
          type="text"
          placeholder={`e.g. 1-${totalDocPages} or leave "all"`}
          value={options.pageRange || 'all'}
          onChange={(e) => updateOption('pageRange', e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
        />
      </div>

      {/* Special Notes */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700">Notes for Counter (Optional)</span>
        <textarea
          rows={2}
          placeholder="e.g. Print cover page on heavy paper if available"
          value={options.notes || ''}
          onChange={(e) => updateOption('notes', e.target.value)}
          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
        />
      </div>
    </div>
  );
};
