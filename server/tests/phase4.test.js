const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const Shop = require('../src/models/Shop');
const User = require('../src/models/User');
const { Job } = require('../src/models/Job');
const AuditLog = require('../src/models/AuditLog');
const config = require('../src/config/env');
const { storeBufferInGridFS, getBufferFromGridFS, checkFileExistsInGridFS } = require('../src/services/fileService');
const { transitionJobState } = require('../src/services/jobStateMachine');
const { runPrivacyCleanup } = require('../src/cron/cleanup');
const { setupDB } = require('./setup');

setupDB();

describe('Phase 4: Privacy & Automatic File Deletion', () => {
  let shop;
  let student;
  let operatorToken;

  beforeEach(async () => {
    await Shop.deleteMany({});
    await User.deleteMany({});
    await Job.deleteMany({});
    await AuditLog.deleteMany({});

    shop = await Shop.create({
      name: 'Privacy Test Shop',
      code: `privacy-shop-${Date.now()}`,
      address: 'Privacy Corridor',
      agentKey: 'agent_key_privacy_test_123'
    });

    student = await User.create({
      name: 'Privacy Student',
      email: 'student_priv@test.com',
      password: 'password123',
      role: 'student'
    });

    await User.create({
      name: 'Privacy Operator',
      email: 'op_priv@test.com',
      password: 'password123',
      role: 'operator',
      shopId: shop._id
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'op_priv@test.com',
      password: 'password123'
    });
    operatorToken = loginRes.body.token;
  });

  describe('Deletion on COLLECTED', () => {
    it('CRITICAL PRIVACY: should delete GridFS file immediately when job is marked COLLECTED', async () => {
      // 1. Upload dummy file to GridFS
      const dummyBuffer = Buffer.from('%PDF-1.4 test document content for deletion on collect');
      const fileId = await storeBufferInGridFS(dummyBuffer, 'confidential.pdf', 'application/pdf');

      // Verify file exists in GridFS
      const initialBuffer = await getBufferFromGridFS(fileId);
      expect(initialBuffer).toBeDefined();

      // 2. Create job in READY status
      const job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        fileId,
        originalFilename: 'confidential.pdf',
        fileSize: dummyBuffer.length,
        mimeType: 'application/pdf',
        pageCount: 1,
        status: 'READY'
      });

      // 3. Mark job COLLECTED
      const collectedJob = await transitionJobState(job._id, 'COLLECTED', { role: 'operator' });

      // 4. Verify fileDeletedAt is set on the job
      expect(collectedJob.fileDeletedAt).toBeDefined();
      expect(collectedJob.status).toBe('COLLECTED');

      // 5. Verify file is completely deleted from GridFS
      const exists = await checkFileExistsInGridFS(fileId);
      expect(exists).toBe(false);

      // 6. Verify audit log entry exists
      const audit = await AuditLog.findOne({ action: 'FILE_DELETED_ON_COLLECT', jobId: job._id });
      expect(audit).toBeDefined();
      expect(audit.actorRole).toBe('operator');
    });
  });

  describe('Privacy Cleanup Cron', () => {
    it('should delete files for CANCELLED, FAILED, and NO_SHOW jobs', async () => {
      const buffer = Buffer.from('%PDF-1.4 test for cron cleanup');

      const cancelledFileId = await storeBufferInGridFS(buffer, 'cancelled.pdf');
      const failedFileId = await storeBufferInGridFS(buffer, 'failed.pdf');
      const noShowFileId = await storeBufferInGridFS(buffer, 'noshow.pdf');

      await Job.create({
        shopId: shop._id,
        fileId: cancelledFileId,
        originalFilename: 'cancelled.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        pageCount: 1,
        status: 'CANCELLED'
      });

      await Job.create({
        shopId: shop._id,
        fileId: failedFileId,
        originalFilename: 'failed.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        pageCount: 1,
        status: 'FAILED'
      });

      await Job.create({
        shopId: shop._id,
        fileId: noShowFileId,
        originalFilename: 'noshow.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        pageCount: 1,
        status: 'NO_SHOW'
      });

      // Run cleanup
      const result = await runPrivacyCleanup();
      expect(result.deletedCount).toBeGreaterThanOrEqual(3);

      // Verify files in GridFS are gone
      expect(await checkFileExistsInGridFS(cancelledFileId)).toBe(false);
      expect(await checkFileExistsInGridFS(failedFileId)).toBe(false);
      expect(await checkFileExistsInGridFS(noShowFileId)).toBe(false);
    });

    it('should delete files for jobs 24 hours past slotStart', async () => {
      const buffer = Buffer.from('%PDF-1.4 past slot test');
      const pastFileId = await storeBufferInGridFS(buffer, 'past_slot.pdf');

      // 25 hours ago
      const pastSlot = new Date(Date.now() - 25 * 3600 * 1000);

      const job = await Job.create({
        shopId: shop._id,
        fileId: pastFileId,
        originalFilename: 'past_slot.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        pageCount: 1,
        status: 'READY',
        slotStart: pastSlot
      });

      await runPrivacyCleanup();

      // Verify file deleted
      expect(await checkFileExistsInGridFS(pastFileId)).toBe(false);

      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.fileDeletedAt).toBeDefined();
    });

    it('should delete orphan uploads older than 1 hour never attached to a job', async () => {
      const buffer = Buffer.from('%PDF-1.4 orphan upload');
      const orphanFileId = await storeBufferInGridFS(buffer, 'orphan.pdf');

      // Artificially age the GridFS file uploadDate to 2 hours ago
      const { mongoose } = require('../src/config/db');
      await mongoose.connection.db.collection('uploads.files').updateOne(
        { _id: orphanFileId },
        { $set: { uploadDate: new Date(Date.now() - 2 * 3600 * 1000) } }
      );

      await runPrivacyCleanup();

      expect(await checkFileExistsInGridFS(orphanFileId)).toBe(false);
    });
  });

  describe('Agent Signed URLs & Shop Privacy Restrictions', () => {
    let dummyFileId;
    let job;

    beforeEach(async () => {
      const buffer = Buffer.from('%PDF-1.4 confidential student homework');
      dummyFileId = await storeBufferInGridFS(buffer, 'homework.pdf');

      job = await Job.create({
        shopId: shop._id,
        userId: student._id,
        fileId: dummyFileId,
        originalFilename: 'homework.pdf',
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        pageCount: 1,
        status: 'QUEUED'
      });
    });

    it('should ALLOW download with a valid signed URL within 2 minutes', async () => {
      const expires = Date.now() + 90 * 1000; // valid for 90 more seconds
      const signature = crypto
        .createHmac('sha256', config.AGENT_SIGNING_SECRET)
        .update(`${job._id}|${expires}`)
        .digest('hex');

      const res = await request(app).get(
        `/api/agent/jobs/${job._id}/file?expires=${expires}&signature=${signature}`
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/pdf/i);
    });

    it('should REJECT download when 2-minute signed URL has expired', async () => {
      const expiredTime = Date.now() - 10 * 1000; // expired 10 seconds ago
      const signature = crypto
        .createHmac('sha256', config.AGENT_SIGNING_SECRET)
        .update(`${job._id}|${expiredTime}`)
        .digest('hex');

      const res = await request(app).get(
        `/api/agent/jobs/${job._id}/file?expires=${expiredTime}&signature=${signature}`
      );

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('should REJECT download when signature is tampered', async () => {
      const expires = Date.now() + 60 * 1000;
      const fakeSignature = 'bad_forged_signature_hex';

      const res = await request(app).get(
        `/api/agent/jobs/${job._id}/file?expires=${expires}&signature=${fakeSignature}`
      );

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Invalid or expired signature/i);
    });

    it('Shopkeeper dashboard query must NOT expose fileId or document preview to operator', async () => {
      const res = await request(app)
        .get(`/api/jobs/${job._id}`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.job.fileId).toBeUndefined(); // fileId stripped for privacy
    });

    it('Agent endpoints must REJECT missing agent key with 401', async () => {
      const heartbeatRes = await request(app).post('/api/agent/heartbeat');
      expect(heartbeatRes.status).toBe(401);
      expect(heartbeatRes.body.error).toMatch(/Agent key missing/i);

      const nextJobRes = await request(app).get('/api/agent/jobs/next');
      expect(nextJobRes.status).toBe(401);
    });

    it('Agent endpoints must REJECT bad/invalid agent key with 403', async () => {
      const heartbeatRes = await request(app)
        .post('/api/agent/heartbeat')
        .set('x-agent-key', 'completely_invalid_key_999');

      expect(heartbeatRes.status).toBe(403);
      expect(heartbeatRes.body.error).toMatch(/Invalid agent key/i);

      const nextJobRes = await request(app)
        .get('/api/agent/jobs/next')
        .set('x-agent-key', 'completely_invalid_key_999');

      expect(nextJobRes.status).toBe(403);
    });
  });
});
