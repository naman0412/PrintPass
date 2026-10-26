const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config/env');
const Payment = require('../models/Payment');
const { transitionJobState } = require('./jobStateMachine');

// Initialize Razorpay client or Mock Provider
let razorpayClient = null;
const isMockPayment = !config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET;

if (!isMockPayment) {
  razorpayClient = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET
  });
}

/**
 * Creates a payment order for a job.
 * Idempotent: returns existing payment if idempotencyKey matches.
 */
const createPaymentOrder = async ({ jobId, userId, shopId, amount, currency = 'INR', idempotencyKey = null }) => {
  // Idempotency check
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) {
      return {
        isMock: existing.provider === 'mock',
        payment: existing,
        orderId: existing.orderId,
        amount: existing.amount,
        currency: existing.currency
      };
    }
  }

  let orderId;
  const provider = isMockPayment ? 'mock' : 'razorpay';

  if (isMockPayment) {
    // Clearly labelled MOCK provider order ID
    orderId = `mock_order_${crypto.randomBytes(12).toString('hex')}`;
  } else {
    // Razorpay amounts are in smallest currency sub-unit (paise for INR)
    const amountInPaise = Math.round(amount * 100);
    const rzpOrder = await razorpayClient.orders.create({
      amount: amountInPaise,
      currency,
      receipt: `job_${jobId.toString().slice(-10)}`,
      notes: { jobId: jobId.toString(), shopId: shopId.toString() }
    });
    orderId = rzpOrder.id;
  }

  const payment = await Payment.create({
    jobId,
    userId,
    shopId,
    amount,
    currency,
    provider,
    orderId,
    status: 'created',
    idempotencyKey
  });

  return {
    isMock: isMockPayment,
    payment,
    orderId,
    amount,
    currency,
    keyId: isMockPayment ? 'MOCK_KEY_TEST_MODE' : config.RAZORPAY_KEY_ID
  };
};

/**
 * Verifies Razorpay or Mock signature, marks payment captured, and moves job to QUEUED.
 */
const verifyPaymentAndCapture = async ({ orderId, paymentId, signature, actor = {} }) => {
  const payment = await Payment.findOne({ orderId });
  if (!payment) {
    const err = new Error('Payment record not found for this order.');
    err.statusCode = 404;
    throw err;
  }

  // Idempotent: If already captured, return success immediately
  if (payment.status === 'captured') {
    return { success: true, payment, alreadyCaptured: true };
  }

  if (payment.provider === 'razorpay') {
    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      payment.status = 'failed';
      await payment.save();
      const err = new Error('Invalid payment signature verification failed.');
      err.statusCode = 400;
      throw err;
    }
  } else {
    // Mock verification
    if (!paymentId) {
      paymentId = `mock_pay_${crypto.randomBytes(12).toString('hex')}`;
    }
  }

  payment.paymentId = paymentId;
  payment.signature = signature || 'mock_verified_signature';
  payment.status = 'captured';
  await payment.save();

  // Transition job to QUEUED using state machine
  const updatedJob = await transitionJobState(payment.jobId, 'QUEUED', actor, 'Payment verified and captured');

  updatedJob.paymentId = payment._id;
  await updatedJob.save();

  return {
    success: true,
    payment,
    job: updatedJob
  };
};

/**
 * Automatically refunds payment (used on cancellation before printing or unrecoverable failed jobs).
 */
const refundJobPayment = async (jobId, reason = 'Job cancelled before printing') => {
  const payment = await Payment.findOne({ jobId, status: 'captured' });
  if (!payment) {
    return { refunded: false, reason: 'No captured payment found to refund' };
  }

  if (payment.status === 'refunded') {
    return { refunded: true, alreadyRefunded: true };
  }

  let refundId;
  if (payment.provider === 'razorpay') {
    const amountInPaise = Math.round(payment.amount * 100);
    const rzpRefund = await razorpayClient.payments.refund(payment.paymentId, {
      amount: amountInPaise,
      notes: { reason, jobId: jobId.toString() }
    });
    refundId = rzpRefund.id;
  } else {
    refundId = `mock_rfd_${crypto.randomBytes(12).toString('hex')}`;
  }

  payment.status = 'refunded';
  payment.refundId = refundId;
  payment.refundAmount = payment.amount;
  payment.refundReason = reason;
  await payment.save();

  return {
    refunded: true,
    refundId,
    amount: payment.amount
  };
};

/**
 * Verifies Razorpay webhook signature
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!config.RAZORPAY_WEBHOOK_SECRET) return true;
  const expected = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = {
  isMockPayment,
  createPaymentOrder,
  verifyPaymentAndCapture,
  refundJobPayment,
  verifyWebhookSignature
};
