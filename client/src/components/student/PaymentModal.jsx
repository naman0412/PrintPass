import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { CreditCard, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';

export const PaymentModal = ({ job, orderData, onClose, onPaymentSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleMockPay = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Simulate payment verification
      const verifyRes = await api.verifyPayment(
        orderData.orderId,
        `mock_pay_${Date.now()}`,
        'mock_signature_test'
      );

      if (verifyRes.success) {
        // Trigger celebratory confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        onPaymentSuccess(verifyRes.job);
      }
    } catch (err) {
      setError(err.message || 'Payment verification failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRazorpay = () => {
    setProcessing(true);
    const options = {
      key: orderData.keyId,
      amount: Math.round(orderData.amount * 100),
      currency: 'INR',
      name: 'PrintPass',
      description: `Print Job #${job._id?.slice(-6) || ''}`,
      order_id: orderData.orderId,
      handler: async function (response) {
        try {
          const verifyRes = await api.verifyPayment(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );

          if (verifyRes.success) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            onPaymentSuccess(verifyRes.job);
          }
        } catch (err) {
          setError(err.message || 'Payment verification failed.');
        } finally {
          setProcessing(false);
        }
      },
      modal: {
        ondismiss: function () {
          setProcessing(false);
        }
      },
      prefill: {
        name: 'College Student'
      },
      theme: {
        color: '#4f46e5'
      }
    };

    if (window.Razorpay) {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      // Fallback to mock simulation if razorpay script isn't loaded in browser
      handleMockPay();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Complete Payment</h3>
          <p className="text-xs text-slate-500">Secure instant payment via Razorpay / Mock Gateway</p>
        </div>

        {/* Order Details Summary */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-2 border border-slate-100">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Document</span>
            <span className="font-bold text-slate-900 truncate max-w-[180px]">{job.originalFilename}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Total Pages</span>
            <span className="font-bold text-slate-900">{job.pricing?.totalPages || job.pageCount} pages</span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-sm">
            <span className="font-bold text-slate-700">Amount Due</span>
            <span className="text-2xl font-black text-indigo-600">₹{orderData.amount}</span>
          </div>
        </div>

        {/* Gateway notice */}
        {orderData.isMock ? (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <span className="font-bold px-1.5 py-0.5 rounded bg-amber-200 text-[10px]">MOCK GATEWAY</span>
            <span>Test mode active (No real payment keys detected). Click below to simulate instant payment.</span>
          </div>
        ) : (
          <div className="mb-4 text-center">
            <span className="text-xs text-slate-400">Powered by Razorpay (Test Mode)</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          disabled={processing}
          onClick={orderData.isMock ? handleMockPay : handleRazorpay}
          className="w-full py-3.5 px-4 rounded-xl font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying Payment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Pay ₹{orderData.amount} & Confirm Slot</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
