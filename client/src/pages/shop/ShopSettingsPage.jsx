import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Save,
  Key,
  PauseCircle,
  PlayCircle,
  Clock,
  Layers,
  CheckCircle,
  Copy,
  ShieldCheck
} from 'lucide-react';

export const ShopSettingsPage = () => {
  const { user } = useAuth();
  const shopId = user?.shopId;

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [pricing, setPricing] = useState({
    bwPerPage: 2,
    colorPerPage: 10,
    duplexDiscount: 0.5,
    spiral: 30,
    staple: 5,
    punch: 2,
    a3Multiplier: 2.0
  });

  const [settings, setSettings] = useState({
    slotMinutes: 15,
    slotCapacityPages: 200,
    slotCapacityJobs: 10,
    pagesPerMinute: 25,
    bufferMinutes: 5,
    openTime: '08:00',
    closeTime: '20:00',
    isPaused: false
  });

  const [agentKey, setAgentKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const fetchShopSettings = async () => {
      if (!shopId) return;
      try {
        const data = await api.getShop(shopId);
        if (data.success && data.shop) {
          setShop(data.shop);
          if (data.shop.pricing) setPricing(data.shop.pricing);
          if (data.shop.settings) setSettings(data.shop.settings);
        }

        // If owner, fetch agent key
        if (user?.role === 'owner') {
          const keyData = await api.getAgentKey(shopId);
          if (keyData.success) {
            setAgentKey(keyData.agentKey);
          }
        }
      } catch (err) {
        console.error('Settings load error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShopSettings();
  }, [shopId, user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await api.updateShopSettings(shopId, { pricing, settings });
      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      alert(err.message || 'Failed to update shop settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAgentKey = () => {
    if (agentKey) {
      navigator.clipboard.writeText(agentKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Queue</span>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shop Management & Pricing</h1>
        <p className="text-xs text-slate-500">Configure your shop rates, pickup slot capacities, and print agent</p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Shop settings updated successfully! New prices and slots are live immediately.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Pause Counter Toggle */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="font-extrabold text-sm text-slate-900 block">Pause Counter Orders</span>
            <span className="text-xs text-slate-500">
              Temporarily hide shop from students (e.g. during paper refill, machine maintenance or lunch break)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSettings({ ...settings, isPaused: !settings.isPaused })}
            className={`py-2 px-4 rounded-xl text-xs font-black flex items-center gap-2 border-2 transition-all ${
              settings.isPaused
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            }`}
          >
            {settings.isPaused ? (
              <>
                <PauseCircle className="w-4 h-4" />
                <span>Shop is Paused</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>Shop is Active</span>
              </>
            )}
          </button>
        </div>

        {/* Pricing Settings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Per-Page & Binding Pricing (₹)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 block mb-1">B&W Per Page</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={pricing.bwPerPage}
                onChange={(e) => setPricing({ ...pricing, bwPerPage: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Color Per Page</label>
              <input
                type="number"
                step="1"
                min="0"
                value={pricing.colorPerPage}
                onChange={(e) => setPricing({ ...pricing, colorPerPage: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Duplex Discount</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={pricing.duplexDiscount}
                onChange={(e) => setPricing({ ...pricing, duplexDiscount: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">A3 Multiplier</label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={pricing.a3Multiplier}
                onChange={(e) => setPricing({ ...pricing, a3Multiplier: parseFloat(e.target.value) || 1 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Spiral Binding</label>
              <input
                type="number"
                min="0"
                value={pricing.spiral}
                onChange={(e) => setPricing({ ...pricing, spiral: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Staple</label>
              <input
                type="number"
                min="0"
                value={pricing.staple}
                onChange={(e) => setPricing({ ...pricing, staple: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">2-Hole Punch</label>
              <input
                type="number"
                min="0"
                value={pricing.punch}
                onChange={(e) => setPricing({ ...pricing, punch: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours and Slot Capacity */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Counter Hours & Slot Limits</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 block mb-1">Open Time (HH:mm)</label>
              <input
                type="text"
                value={settings.openTime}
                onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Close Time (HH:mm)</label>
              <input
                type="text"
                value={settings.closeTime}
                onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Slot Minutes</label>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.slotMinutes}
                onChange={(e) => setSettings({ ...settings, slotMinutes: parseInt(e.target.value, 10) || 15 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 block mb-1">Max Pages / Slot</label>
              <input
                type="number"
                min="10"
                value={settings.slotCapacityPages}
                onChange={(e) => setSettings({ ...settings, slotCapacityPages: parseInt(e.target.value, 10) || 200 })}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Print Agent Key (Owner Only) */}
        {user?.role === 'owner' && (
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-base">Desktop Print Agent Key</h3>
            </div>
            <p className="text-xs text-slate-400">
              Paste this secret key into the <code className="text-amber-300">.env</code> file of your shop computer's Print Agent. Keep this private.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="password"
                readOnly
                value={agentKey || 'Loading key...'}
                className="flex-1 p-3 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-mono text-xs focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopyAgentKey}
                className="py-3 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
              >
                {copiedKey ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Save Changes button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-xl shadow-indigo-200 text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
        </button>
      </form>
    </div>
  );
};
