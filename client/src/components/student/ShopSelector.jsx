import React from 'react';
import { Store, MapPin, Phone, CheckCircle, Wifi, WifiOff } from 'lucide-react';

export const ShopSelector = ({ shops, selectedShopId, onSelectShop }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
          1. Choose Print Shop
        </label>
        <span className="text-xs text-slate-400">{shops.length} campus shops available</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shops.map((shop) => {
          const isSelected = selectedShopId === shop._id;
          const isPaused = shop.settings?.isPaused;
          const isAgentOnline = shop.agentOnline;

          return (
            <div
              key={shop._id}
              onClick={() => !isPaused && onSelectShop(shop)}
              className={`relative rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20'
                  : isPaused
                  ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 text-indigo-600">
                  <CheckCircle className="w-5 h-5 fill-indigo-600 text-white" />
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  <Store className="w-5 h-5" />
                </div>
                <div className="flex-1 pr-6">
                  <h3 className="font-bold text-slate-900 leading-tight">{shop.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{shop.address}</span>
                  </div>

                  {/* Pricing and status pill */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      ₹{shop.pricing?.bwPerPage ?? 2}/page B&W
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      ₹{shop.pricing?.colorPerPage ?? 10}/page Color
                    </span>

                    {/* Agent Status */}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isAgentOnline
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isAgentOnline ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                          Auto-Print Online
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Manual Counter
                        </>
                      )}
                    </span>
                  </div>

                  {isPaused && (
                    <div className="mt-2 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                      Shop currently paused by shopkeeper.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
