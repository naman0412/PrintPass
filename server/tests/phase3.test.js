const request = require('supertest');
const app = require('../src/app');
const Shop = require('../src/models/Shop');
const User = require('../src/models/User');
const { Job } = require('../src/models/Job');
const Payment = require('../src/models/Payment');
const { transitionJobState } = require('../src/services/jobStateMachine');
const { createPaymentOrder, verifyPaymentAndCapture } = require('../src/services/paymentService');
const { setupDB } = require('./setup');

setupDB();

describe('Phase 3: Jobs, Payment & State Machine', () => {
  let shop;
  let student;
  let operatorToken;

  beforeEach(async () => {
    shop = await Shop.create({
      name: 'Phase 3 Test Shop',
      code: 'phase3-shop',
      address: 'Test Wing',
      pricing: { bwPerPage: 2, spiral: 20 },
      settings: { slotCapacityPages: 100, slotCapacityJobs: 10 }
    });

    student = await User.create({
      name: 'Student Tester',
      email: 'student_p3@test.com',
      password: 'password123',
      role: 'student'
    });

    await User.create({
      name: 'Operator Tester',
      email: 'operator_p3@test.com',
      password: 'password123',
      role: 'operator',
      shopId: shop._id
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'operator_p3@test.com',
      password: 'password123'
    });
    operatorToken = loginRes.body.token;
  });

  describe('State Machine Transitions', () => {
    it('should transition DRAFT -> PENDING_PAYMENT -> QUEUED and generate 6-char pickup code', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'notes.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        pricing: { total: 10 },
        status: 'DRAFT'
      });

      // DRAFT -> PENDING_PAYMENT
      const step1 = await transitionJobState(job._id, 'PENDING_PAYMENT');
      expect(step1.status).toBe('PENDING_PAYMENT');

      // PENDING_PAYMENT -> QUEUED
      const step2 = await transitionJobState(job._id, 'QUEUED');
      expect(step2.status).toBe('QUEUED');
      expect(step2.pickupCode).toBeDefined();
      expect(step2.pickupCode.length).toBe(6);
      expect(step2.qrToken).toBeDefined();
      expect(step2.qrToken.startsWith('qr_')).toBe(true);
    });

    it('should skip FINISHING when job has NO binding (PRINTED -> READY directly)', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'doc.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        options: { binding: 'none' },
        pricing: { total: 10 },
        status: 'PRINTING'
      });

      // Target PRINTED should skip FINISHING and transition directly to READY
      const updated = await transitionJobState(job._id, 'PRINTED');
      expect(updated.status).toBe('READY');
    });

    it('should NOT skip FINISHING when job has spiral binding', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'book.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        pageCount: 10,
        options: { binding: 'spiral' },
        pricing: { total: 40 },
        status: 'PRINTING'
      });

      const step1 = await transitionJobState(job._id, 'PRINTED');
      expect(step1.status).toBe('PRINTED');

      const step2 = await transitionJobState(job._id, 'FINISHING');
      expect(step2.status).toBe('FINISHING');

      const step3 = await transitionJobState(job._id, 'READY');
      expect(step3.status).toBe('READY');
    });

    it('should reject FINISHING transition when job has NO binding with 409', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'nobind.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 2,
        options: { binding: 'none' },
        pricing: { total: 4 },
        status: 'PRINTED'
      });

      await expect(transitionJobState(job._id, 'FINISHING')).rejects.toMatchObject({
        statusCode: 409
      });
    });

    it('should REJECT invalid state transitions with 409 Conflict', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'doc.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 2,
        pricing: { total: 4 },
        status: 'DRAFT'
      });

      // Cannot jump from DRAFT to READY
      await expect(transitionJobState(job._id, 'READY')).rejects.toMatchObject({
        statusCode: 409
      });
    });

    it('should REJECT cancellation once job is in PRINTING state', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'printing.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 2,
        pricing: { total: 4 },
        status: 'PRINTING'
      });

      const res = await request(app).post(`/api/jobs/${job._id}/cancel`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Cannot cancel job in PRINTING state/i);
    });
  });

  describe('Payment Verification & Idempotency', () => {
    it('should create payment order and be idempotent with idempotencyKey', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'project.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        pageCount: 10,
        pricing: { total: 20 },
        status: 'DRAFT'
      });

      const idempotencyKey = 'unique_payment_req_12345';

      const order1 = await createPaymentOrder({
        jobId: job._id,
        userId: student._id,
        shopId: shop._id,
        amount: 20,
        idempotencyKey
      });

      const order2 = await createPaymentOrder({
        jobId: job._id,
        userId: student._id,
        shopId: shop._id,
        amount: 20,
        idempotencyKey
      });

      expect(order1.orderId).toBe(order2.orderId);
      expect(order1.payment._id.toString()).toBe(order2.payment._id.toString());

      const count = await Payment.countDocuments({ idempotencyKey });
      expect(count).toBe(1);
    });

    it('should verify payment, mark captured, and transition job to QUEUED', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'essay.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        pricing: { total: 10 },
        status: 'PENDING_PAYMENT'
      });

      const orderData = await createPaymentOrder({
        jobId: job._id,
        userId: student._id,
        shopId: shop._id,
        amount: 10
      });

      const res = await request(app).post('/api/payments/verify').send({
        orderId: orderData.orderId,
        paymentId: 'mock_pay_test_123',
        signature: 'mock_signature'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.status).toBe('QUEUED');
      expect(res.body.job.pickupCode).toBeDefined();

      const paymentDoc = await Payment.findOne({ orderId: orderData.orderId });
      expect(paymentDoc.status).toBe('captured');
    });

    it('should be idempotent if verify is called repeatedly', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'essay.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        pricing: { total: 10 },
        status: 'PENDING_PAYMENT'
      });

      const orderData = await createPaymentOrder({
        jobId: job._id,
        userId: student._id,
        shopId: shop._id,
        amount: 10
      });

      await verifyPaymentAndCapture({
        orderId: orderData.orderId,
        paymentId: 'mock_pay_1',
        signature: 'mock_sig'
      });

      const secondVerify = await verifyPaymentAndCapture({
        orderId: orderData.orderId,
        paymentId: 'mock_pay_1',
        signature: 'mock_sig'
      });

      expect(secondVerify.success).toBe(true);
      expect(secondVerify.alreadyCaptured).toBe(true);
    });
  });

  describe('Cancel & Auto-Refund', () => {
    it('should cancel QUEUED job and trigger refund for captured payment', async () => {
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'cancel_me.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        pricing: { total: 10 },
        status: 'PENDING_PAYMENT'
      });

      const orderData = await createPaymentOrder({
        jobId: job._id,
        userId: student._id,
        shopId: shop._id,
        amount: 10
      });

      await verifyPaymentAndCapture({
        orderId: orderData.orderId,
        paymentId: 'mock_pay_refund_1',
        signature: 'mock_sig'
      });

      // Job is now QUEUED and payment is captured
      const res = await request(app).post(`/api/jobs/${job._id}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.job.status).toBe('CANCELLED');
      expect(res.body.refund.refunded).toBe(true);
      expect(res.body.refund.amount).toBe(10);

      const payment = await Payment.findOne({ jobId: job._id });
      expect(payment.status).toBe('refunded');
      expect(payment.refundId).toBeDefined();
    });
  });

  describe('Pickup Code and QR Verification', () => {
    it('Operator should verify pickupCode and mark job as COLLECTED', async () => {
      await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'ready.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        pickupCode: 'ABC999',
        qrToken: 'qr_secret_token_12345',
        pricing: { total: 10 },
        status: 'READY'
      });

      const res = await request(app)
        .post('/api/jobs/verify-pickup')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ code: 'abc999' }); // case-insensitive check

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.status).toBe('COLLECTED');
      expect(res.body.job.collectedAt).toBeDefined();
    });

    it('should reject verification if pickup code is not found', async () => {
      const res = await request(app)
        .post('/api/jobs/verify-pickup')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ code: 'WRONG1' });

      expect(res.status).toBe(404);
    });

    it('should reject verification if job is not yet READY', async () => {
      await Job.create({
        shopId: shop._id,
        userId: student._id,
        originalFilename: 'queued.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        pageCount: 5,
        pickupCode: 'NOTRDY',
        pricing: { total: 10 },
        status: 'QUEUED'
      });

      const res = await request(app)
        .post('/api/jobs/verify-pickup')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ code: 'NOTRDY' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Only READY jobs can be marked as COLLECTED/i);
    });
  });
});
