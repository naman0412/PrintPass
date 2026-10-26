import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PickupPass } from '../../components/student/PickupPass';
import { StatusTimeline } from '../../components/student/StatusTimeline';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { ArrowLeft, Ban, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

export const OrderTrackPage = () => {
  const { id } = useParams();
  const socket = useSocket();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchJob = async () => {
    try {
      const data = await api.getJob(id);
      if (data.success && data.job) {
        setJob(data.job);
      }
    } catch (err) {
      setError(err.message || 'Failed to load print order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  // Real-time socket updates for this job
  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join:job', id);

    const handleJobUpdate = (updatedJob) => {
      if (updatedJob._id === id || updatedJob.id === id) {
        setJob((prev) => ({ ...prev, ...updatedJob }));
      }
    };

    socket.on('job:updated', handleJobUpdate);

    return () => {
      socket.off('job:updated', handleJobUpdate);
    };
  }, [socket, id]);

  const handleCancelJob = async () => {
    if (!window.confirm('Are you sure you want to cancel this print order? Your payment will be refunded immediately.')) {
      return;
    }

    setCancelling(true);
    try {
      const data = await api.cancelJob(id);
      if (data.success) {
        setJob(data.job);
        setCancelMessage('Order cancelled successfully. Your refund has been initiated.');
      }
    } catch (err) {
      alert(err.message || 'Could not cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-16 flex flex-col items-center justify-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="font-bold text-sm">Loading Your Print Order...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-black text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'This order does not exist or has expired.'}</p>
        <Link
          to="/"
          className="inline-block py-2.5 px-5 rounded-xl font-bold bg-indigo-600 text-white text-xs"
        >
          Create New Print
        </Link>
      </div>
    );
  }

  const canCancel = ['DRAFT', 'PENDING_PAYMENT', 'QUEUED'].includes(job.status);
  const hasBinding = job.options && job.options.binding && job.options.binding !== 'none';

  return (
    <div className="min-h-screen pb-16 pt-4 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        {canCancel && (
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancelJob}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>{cancelling ? 'Cancelling...' : 'Cancel & Refund'}</span>
          </button>
        )}
      </div>

      {cancelMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{cancelMessage}</span>
        </div>
      )}

      {/* Main Grid: Ticket / Pass on left, Timeline & Details on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Pickup Pass Ticket */}
        <div>
          <PickupPass job={job} />
        </div>

        {/* Live Timeline & Progress Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <StatusTimeline status={job.status} hasBinding={hasBinding} />

          {/* Job summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>File</span>
              <span className="font-bold text-slate-800 truncate max-w-[200px]">{job.originalFilename}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Pages & Copies</span>
              <span className="font-bold text-slate-800">
                {job.pageCount} pages × {job.options?.copies || 1} copies
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Amount Paid</span>
              <span className="font-bold text-indigo-600">₹{job.pricing?.total || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
