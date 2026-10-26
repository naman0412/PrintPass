import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopSelector } from '../../components/student/ShopSelector';
import { FileUpload } from '../../components/student/FileUpload';
import { PrintOptionsForm } from '../../components/student/PrintOptionsForm';
import { LiveQuoteCard } from '../../components/student/LiveQuoteCard';
import { SlotPicker } from '../../components/student/SlotPicker';
import { PaymentModal } from '../../components/student/PaymentModal';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [options, setOptions] = useState({
    color: false,
    colorPageRanges: '',
    orientation: 'auto',
    duplex: false,
    copies: 1,
    pageRange: 'all',
    paperSize: 'A4',
    binding: 'none',
    notes: ''
  });

  const [quote, setQuote] = useState(null);
  const [estimatedWait, setEstimatedWait] = useState(5);
  const [calculatingQuote, setCalculatingQuote] = useState(false);

  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [paymentData, setPaymentData] = useState(null); // { job, orderData }
  const [checkoutError, setCheckoutError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load shops on mount
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const data = await api.getShops();
        if (data.success && data.shops.length > 0) {
          setShops(data.shops);
          // Auto-select first active shop
          const firstOpen = data.shops.find((s) => !s.settings?.isPaused) || data.shops[0];
          setSelectedShop(firstOpen);
        }
      } catch (err) {
        console.error('Failed to load shops:', err);
      }
    };
    fetchShops();
  }, []);

  // Recalculate quote whenever shop, file, or options change
  useEffect(() => {
    if (!selectedShop || !uploadedFile) {
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      setCalculatingQuote(true);
      try {
        const data = await api.getQuote(selectedShop._id, uploadedFile.pageCount, options);
        if (data.success) {
          setQuote(data.quote);
          setEstimatedWait(data.estimatedWaitMinutes);
        }
      } catch (err) {
        console.error('Quote calculation error:', err);
      } finally {
        setCalculatingQuote(false);
      }
    };

    const timer = setTimeout(fetchQuote, 200);
    return () => clearTimeout(timer);
  }, [selectedShop, uploadedFile, options]);

  // Fetch slots whenever selectedShop changes
  useEffect(() => {
    if (!selectedShop) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const pages = quote ? quote.totalPages : (uploadedFile?.pageCount || 1);
        const data = await api.getSlots(selectedShop._id, today, pages);
        if (data.success) {
          setSlots(data.slots);
          if (data.slots.length > 0) {
            setSelectedSlot(data.slots[0]); // Default to earliest available slot
          } else {
            setSelectedSlot(null);
          }
        }
      } catch (err) {
        console.error('Failed to load slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedShop, quote?.totalPages, uploadedFile]);

  // 3-Tap Checkout Flow: Hold Slot -> Create Job -> Create Order -> Open Modal
  const handleProceedToPayment = async () => {
    if (!selectedShop) {
      setCheckoutError('Please select a print shop first.');
      return;
    }
    if (!uploadedFile) {
      setCheckoutError('Please upload a document to print.');
      return;
    }
    if (!selectedSlot) {
      setCheckoutError('Please select a pickup time slot.');
      return;
    }

    setCheckoutError(null);
    setIsSubmitting(true);

    try {
      // 1. Atomically hold the slot for 5 minutes
      const pagesToHold = quote?.totalPages || uploadedFile.pageCount;
      const holdRes = await api.holdSlot(
        selectedShop._id,
        selectedSlot.slotStart,
        selectedSlot.slotEnd,
        pagesToHold
      );

      if (!holdRes.success) {
        throw new Error(holdRes.error || 'Selected slot is full. Please pick another time slot.');
      }

      // 2. Create the Job
      const jobRes = await api.createJob({
        shopId: selectedShop._id,
        fileId: uploadedFile.fileId,
        originalFilename: uploadedFile.originalFilename,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
        pageCount: uploadedFile.pageCount,
        options,
        slotStart: selectedSlot.slotStart,
        slotEnd: selectedSlot.slotEnd,
        holdId: holdRes.hold.holdId
      });

      if (!jobRes.success) {
        throw new Error('Failed to create job order.');
      }

      const createdJob = jobRes.job;

      // 3. Create payment order (idempotent key with jobId)
      const idempotencyKey = `pay_${createdJob._id}_${Date.now()}`;
      const orderRes = await api.createPaymentOrder(createdJob._id, idempotencyKey);

      if (!orderRes.success) {
        throw new Error('Failed to initialize payment gateway.');
      }

      // 4. Open Payment modal
      setPaymentData({
        job: createdJob,
        orderData: orderRes
      });
    } catch (err) {
      setCheckoutError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = (updatedJob) => {
    setPaymentData(null);
    navigate(`/orders/${updatedJob._id}`);
  };

  return (
    <div className="min-h-screen pb-16 pt-4 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>FAST CAMPUS PRINTING</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
          Skip the queue. <span className="text-indigo-600">Print on time.</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto">
          Upload from your hostel or phone. Choose options, see exact price, pay online, and pick up without waiting.
        </p>
      </div>

      {checkoutError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      {/* Main Flow: 2 Columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Steps */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Shop */}
          <ShopSelector
            shops={shops}
            selectedShopId={selectedShop?._id}
            onSelectShop={(s) => setSelectedShop(s)}
          />

          {/* Step 2: Upload */}
          <FileUpload
            currentFile={uploadedFile}
            onFileUploaded={(f) => setUploadedFile(f)}
          />

          {/* Step 3: Print Options (Only once file uploaded) */}
          {uploadedFile && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <PrintOptionsForm
                options={options}
                onChange={setOptions}
                totalDocPages={uploadedFile.pageCount}
              />
            </div>
          )}

          {/* Step 4: Slot Picker */}
          {uploadedFile && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <SlotPicker
                slots={slots}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                loading={loadingSlots}
              />
            </div>
          )}
        </div>

        {/* Right Column: Sticky Quote Card & Pay Button */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <LiveQuoteCard
            quote={quote}
            estimatedWait={estimatedWait}
            loading={calculatingQuote}
          />

          {/* Primary Action Button */}
          {uploadedFile ? (
            <button
              type="button"
              disabled={isSubmitting || !selectedSlot || (selectedShop?.settings?.isPaused)}
              onClick={handleProceedToPayment}
              className="w-full py-4 px-6 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-xl shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-base"
            >
              <span>{isSubmitting ? 'Reserving Slot...' : `Pay ₹${quote?.total || '...'} & Lock Slot`}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-100 text-center text-xs text-slate-500 font-medium">
              Upload a document above to unlock price quote and pickup reservation.
            </div>
          )}
        </div>
      </div>

      {/* Payment Gateway Modal */}
      {paymentData && (
        <PaymentModal
          job={paymentData.job}
          orderData={paymentData.orderData}
          onClose={() => setPaymentData(null)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};
