import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShopJobCard } from '../../components/shop/ShopJobCard';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Store,
  Clock,
  Printer,
  CheckCircle,
  PackageCheck,
  TrendingUp,
  Settings,
  PlusCircle,
  Scan,
  RefreshCw,
  Bell,
  Wifi,
  WifiOff
} from 'lucide-react';

export const ShopDashboardPage = () => {
  const { user } = useAuth();
  const socket = useSocket();

  const [shop, setShop] = useState(null);
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [newJobAlert, setNewJobAlert] = useState(null);

  // Verification modal state
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Walk-in modal state
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPages, setWalkInPages] = useState(1);
  const [walkInColor, setWalkInColor] = useState(false);
  const [walkInDuplex, setWalkInDuplex] = useState(false);

  const shopId = user?.shopId;

  const loadDashboardData = async () => {
    if (!shopId) return;
    try {
      const [dashData, queueData] = await Promise.all([
        api.getShopDashboard(shopId),
        api.getShopQueue()
      ]);

      if (dashData.success) {
        setShop(dashData.shop);
        setStats(dashData.stats);
      }
      if (queueData.success) {
        setQueue(queueData.jobs);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [shopId]);

  // Socket.IO real-time queue synchronization
  useEffect(() => {
    if (!socket || !shopId) return;

    socket.emit('join:shop', shopId);

    const handleQueueUpdate = (updatedJob) => {
      setNewJobAlert(`Queue updated: ${updatedJob.originalFilename} (${updatedJob.status})`);
      setTimeout(() => setNewJobAlert(null), 4000);
      loadDashboardData();
    };

    const handleAgentStatus = (statusData) => {
      setShop((prev) => (prev ? { ...prev, agentOnline: statusData.isOnline } : prev));
    };

    socket.on('queue:updated', handleQueueUpdate);
    socket.on('agent:status', handleAgentStatus);

    return () => {
      socket.off('queue:updated', handleQueueUpdate);
      socket.off('agent:status', handleAgentStatus);
    };
  }, [socket, shopId]);

  const handleUpdateStatus = async (jobId, targetStatus) => {
    try {
      const res = await api.updateJobStatus(jobId, targetStatus);
      if (res.success) {
        loadDashboardData();
      }
    } catch (err) {
      alert(err.message || 'Status transition error.');
    }
  };

  const handleVerifySubmit = async (e) => {
    if (e) e.preventDefault();
    if (!verifyCode.trim()) return;

    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await api.verifyPickup(verifyCode);
      if (res.success) {
        setVerifyResult({
          success: true,
          message: res.message,
          job: res.job
        });
        setVerifyCode('');
        loadDashboardData();
      }
    } catch (err) {
      setVerifyResult({
        success: false,
        message: err.message || 'Invalid pickup code or job not ready.'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateWalkIn = async (e) => {
    e.preventDefault();
    try {
      await api.createJob({
        shopId,
        isWalkIn: true,
        customerName: walkInName || 'Walk-in Customer',
        originalFilename: `Walk-in Print (${walkInPages} pages)`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: parseInt(walkInPages, 10),
        options: {
          color: walkInColor,
          duplex: walkInDuplex,
          copies: 1,
          binding: 'none'
        }
      });
      setShowWalkInModal(false);
      setWalkInName('');
      setWalkInPages(1);
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Failed to create walk-in job.');
    }
  };

  const filteredQueue = queue.filter((job) => {
    if (filter === 'QUEUED') return job.status === 'QUEUED';
    if (filter === 'IN_PROGRESS') return ['PRINTING', 'PRINTED', 'FINISHING'].includes(job.status);
    if (filter === 'READY') return job.status === 'READY';
    return true;
  });

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Alert on New Jobs / Live Queue Updates */}
      {newJobAlert && (
        <div className="fixed top-20 right-4 z-50 bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <Bell className="w-5 h-5 text-amber-300" />
          <span className="text-xs font-black">{newJobAlert}</span>
        </div>
      )}

      {/* Top Shop Banner with Navigation */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {shop?.name || 'Counter Dashboard'}
            </h1>
            {/* Agent Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                shop?.agentOnline
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  shop?.agentOnline ? 'bg-emerald-500 animate-pulse-dot' : 'bg-rose-500'
                }`}
              />
              {shop?.agentOnline ? 'Print Agent Online' : 'Print Agent Offline'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Live queue and counter fulfillment terminal</p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowVerifyModal(true)}
            className="py-3 px-5 rounded-2xl font-black text-xs sm:text-sm bg-slate-900 hover:bg-black text-white shadow-md flex items-center gap-2 active:scale-95 transition-all"
          >
            <Scan className="w-4 h-4 text-emerald-400" />
            <span>Verify & Hand Over</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWalkInModal(true)}
            className="py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Walk-In Job</span>
          </button>

          <Link
            to="/shop/earnings"
            className="py-3 px-3.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Earnings</span>
          </Link>

          <Link
            to="/shop/settings"
            className="py-3 px-3.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>

      {/* Counter Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase">In Queue</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-0.5">
            {stats?.queuedCount ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase">Printing / Finishing</span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-0.5">
            {stats?.printingCount ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase">Ready for Pickup</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-0.5">
            {stats?.readyCount ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase">Collected Today</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 mt-0.5">
            {stats?.collectedCountToday ?? 0}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {[
          { id: 'ALL', label: `All Active (${queue.length})` },
          { id: 'QUEUED', label: 'Queued' },
          { id: 'IN_PROGRESS', label: 'In Progress' },
          { id: 'READY', label: 'Ready for Pickup' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              filter === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live Queue Cards Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="font-bold text-xs">Loading Live Queue...</p>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-2">
          <Printer className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Queue is Clear</h3>
          <p className="text-xs text-slate-400">All jobs are processed or no jobs match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQueue.map((job) => (
            <ShopJobCard
              key={job._id}
              job={job}
              onUpdateStatus={handleUpdateStatus}
              onVerifyClick={() => {
                setVerifyCode(job.pickupCode || '');
                setShowVerifyModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Verify & Collect Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Verify Pickup Pass</h3>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerifyResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Enter 6-Character Pickup Code or Paste QR Token:
                </label>
                <input
                  type="text"
                  maxLength={40}
                  autoFocus
                  placeholder="e.g. 8K2M9P"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                  className="w-full text-center text-2xl font-black font-mono tracking-widest p-3 rounded-2xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {verifyResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    verifyResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {verifyResult.message}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || !verifyCode.trim()}
                className="w-full py-3.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm shadow-md"
              >
                {verifying ? 'Verifying Code...' : 'Confirm Handover & Delete File'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Walk-In Job Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Counter Walk-In Entry</h3>
              <button
                onClick={() => setShowWalkInModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Name (Optional)</label>
                <input
                  type="text"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Page Count</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={walkInPages}
                  onChange={(e) => setWalkInPages(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={walkInColor}
                    onChange={(e) => setWalkInColor(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold">Color Print</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={walkInDuplex}
                    onChange={(e) => setWalkInDuplex(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold">Double-Sided</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 text-xs shadow-md mt-2"
              >
                Add Walk-in to Live Queue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
