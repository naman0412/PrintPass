const express = require('express');
const router = express.Router();
const { Job } = require('../models/Job');
const { createPaymentOrder, verifyPaymentAndCapture, verifyWebhookSignature } = require('../services/paymentService');
const { optionalAuth } = require('../middleware/auth');

// POST /api/payments/create-order
router.post('/create-order', optionalAuth, async (req, res, next) => {
  try {
    const { jobId, idempotencyKey } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (job.status !== 'DRAFT' && job.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({
        success: false,
        error: `Cannot pay for job in status ${job.status}`
      });
    }

    // Mark job as PENDING_PAYMENT
    job.status = 'PENDING_PAYMENT';
    await job.save();

    const orderData = await createPaymentOrder({
      jobId: job._id,
      userId: req.user ? req.user._id : job.userId,
      shopId: job.shopId,
      amount: job.pricing.total,
      currency: 'INR',
      idempotencyKey
    });

    res.status(200).json({
      success: true,
      ...orderData
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/verify
router.post('/verify', optionalAuth, async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' });
    }

    const actor = req.user ? { id: req.user._id, role: req.user.role } : { role: 'student' };
    const result = await verifyPaymentAndCapture({ orderId, paymentId, signature, actor });

    res.status(200).json({
      success: true,
      job: result.job,
      payment: result.payment
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body.toString();

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      await verifyPaymentAndCapture({
        orderId,
        paymentId,
        signature: 'webhook_verified',
        actor: { role: 'razorpay_webhook' }
      });
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[Payment Webhook Error]', err.message);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;
