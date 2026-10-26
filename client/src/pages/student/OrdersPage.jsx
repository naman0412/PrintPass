import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { FileText, Clock, ChevronRight, Store, RefreshCw, Ban } from 'lucide-react';

export const OrdersPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const data = await api.getMyJobs();
      if (data.success) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="min-h-screen pb-16 pt-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Print Orders
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">Track and manage your campus print passes</p>
        </div>

        <Link
          to="/"
          className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
        >
          + New Print
        </Link>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="font-semibold text-xs">Loading Your Orders...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No print orders yet</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Upload your first document from home to skip the queue at campus photocopy shops.
          </p>
          <Link
            to="/"
            className="inline-block py-2.5 px-5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
          >
            Start Printing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isReady = job.status === 'READY';
            const isCollected = job.status === 'COLLECTED';
            const isCancelled = job.status === 'CANCELLED';

            return (
              <Link
                key={job._id}
                to={`/orders/${job._id}`}
                className="block p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-3 rounded-2xl ${
                      isReady
                        ? 'bg-emerald-100 text-emerald-700'
                        : isCollected
                        ? 'bg-slate-100 text-slate-600'
                        : isCancelled
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm sm:text-base truncate max-w-[200px] sm:max-w-md">
                          {job.originalFilename}
                        </h3>
                        {job.pickupCode && (
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                            {job.pickupCode}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Store className="w-3.5 h-3.5" />
                          {job.shopId?.name || 'Photocopy Shop'}
                        </span>
                        <span>•</span>
                        <span>{job.pageCount} pages × {job.options?.copies || 1} copies</span>
                        <span>•</span>
                        <span className="font-bold text-slate-900">₹{job.pricing?.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isReady
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : isCollected
                          ? 'bg-slate-100 text-slate-600'
                          : isCancelled
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {job.status}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
