const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Shop = require('../models/Shop');
const { Job } = require('../models/Job');
const AuditLog = require('../models/AuditLog');
const config = require('../config/env');
const { getGridFSBucket, mongoose } = require('../config/db');
const { transitionJobState } = require('../services/jobStateMachine');

/**
 * Middleware to authenticate print agent requests via x-agent-key
 */
const authenticateAgent = async (req, res, next) => {
  const agentKey = req.headers['x-agent-key'] || req.query.agentKey;
  if (!agentKey) {
    return res.status(401).json({
      success: false,
      error: 'Agent key missing. Provide x-agent-key header.'
    });
  }

  const shop = await Shop.findOne({ agentKey });
  if (!shop) {
    return res.status(403).json({
      success: false,
      error: 'Invalid agent key. Access denied.'
    });
  }

  req.shop = shop;
  next();
};

/**
 * Helper to generate signed 2-minute download URL for the agent
 */
const generateSignedAgentFileUrl = (jobId) => {
  const expires = Date.now() + 2 * 60 * 1000; // 2 minutes from now
  const signature = crypto
    .createHmac('sha256', config.AGENT_SIGNING_SECRET)
    .update(`${jobId}|${expires}`)
    .digest('hex');

  return {
    url: `/api/agent/jobs/${jobId}/file?expires=${expires}&signature=${signature}`,
    expires
  };
};

/**
 * POST /api/agent/heartbeat - Print agent heartbeat
 */
router.post('/heartbeat', authenticateAgent, async (req, res, next) => {
  try {
    req.shop.agentLastSeen = new Date();
    await req.shop.save();

    // Push live agent status via Socket.IO
    try {
      const { emitAgentStatus } = require('../server');
      emitAgentStatus(req.shop._id, true);
    } catch (e) {
      // ignore
    }

    res.status(200).json({
      success: true,
      shopId: req.shop._id,
      shopName: req.shop.name,
      timestamp: req.shop.agentLastSeen
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agent/jobs/next - Agent polls for the next QUEUED job
 */
router.get('/jobs/next', authenticateAgent, async (req, res, next) => {
  try {
    const job = await Job.findOne({
      shopId: req.shop._id,
      status: 'QUEUED'
    }).sort({ slotStart: 1, createdAt: 1 });

    if (!job) {
      return res.status(200).json({ success: true, job: null });
    }

    const { url, expires } = generateSignedAgentFileUrl(job._id);

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        originalFilename: job.originalFilename,
        pageCount: job.pageCount,
        options: job.options,
        status: job.status,
        slotStart: job.slotStart
      },
      downloadUrl: url,
      expiresAt: new Date(expires)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agent/jobs/:id/file - Stream file to print agent via 2-min signed URL or agent key
 */
router.get('/jobs/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    const { expires, signature } = req.query;
    const agentKey = req.headers['x-agent-key'];

    let isAuthorized = false;

    // Check signed URL
    if (expires && signature) {
      const expTime = parseInt(expires, 10);
      if (Date.now() > expTime) {
        return res.status(403).json({
          success: false,
          error: 'Signed file download URL has expired (2 minute validity exceeded).'
        });
      }

      const expectedSig = crypto
        .createHmac('sha256', config.AGENT_SIGNING_SECRET)
        .update(`${id}|${expires}`)
        .digest('hex');

      if (expectedSig === signature) {
        isAuthorized = true;
      }
    }

    // Check agent key header
    if (!isAuthorized && agentKey) {
      const shop = await Shop.findOne({ agentKey });
      if (shop) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Invalid or expired signature. Only authorized print agent can download files.'
      });
    }

    const job = await Job.findById(id);
    if (!job || !job.fileId) {
      return res.status(404).json({ success: false, error: 'Document file not found' });
    }

    if (job.fileDeletedAt) {
      return res.status(410).json({ success: false, error: 'File has already been permanently deleted for privacy.' });
    }

    const bucket = getGridFSBucket();
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(job.fileId));

    res.setHeader('Content-Type', job.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.originalFilename}"`);

    // Audit log agent download event (never log file contents!)
    await AuditLog.logAction({
      action: 'AGENT_DOWNLOAD',
      jobId: job._id,
      shopId: job.shopId,
      actorRole: 'print_agent',
      metadata: { jobId: job._id.toString() }
    });

    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve file stream.' });
  }
});

/**
 * POST /api/agent/jobs/:id/result - Agent reports print result
 */
router.post('/jobs/:id/result', authenticateAgent, async (req, res, next) => {
  try {
    const { status, error } = req.body;
    const { id } = req.params;

    const job = await Job.findOne({ _id: id, shopId: req.shop._id });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found in this shop' });
    }

    const actor = { role: 'print_agent' };

    if (status === 'PRINTING') {
      const updated = await transitionJobState(job._id, 'PRINTING', actor);
      return res.status(200).json({ success: true, job: updated });
    }

    if (status === 'PRINTED' || status === 'SUCCESS') {
      // Transition through PRINTED (which skips to READY if no binding)
      const updated = await transitionJobState(job._id, 'PRINTED', actor, 'Printed by Print Agent');
      return res.status(200).json({ success: true, job: updated });
    }

    if (status === 'FAILED') {
      if (error) {
        job.agentErrors.push({ message: error, timestamp: new Date() });
        await job.save();
      }
      const updated = await transitionJobState(job._id, 'FAILED', actor, error || 'Agent print error');
      return res.status(200).json({ success: true, job: updated });
    }

    res.status(400).json({ success: false, error: `Unrecognized result status: ${status}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
