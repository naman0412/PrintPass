const crypto = require('crypto');
const { Job } = require('../models/Job');
const AuditLog = require('../models/AuditLog');
const { commitHoldToBooking, releaseHold } = require('./slotService');
const { deleteFileFromGridFS } = require('./fileService');

// State transition graph
const ALLOWED_TRANSITIONS = {
  DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['QUEUED', 'CANCELLED', 'FAILED'],
  QUEUED: ['PRINTING', 'CANCELLED', 'FAILED'],
  PRINTING: ['PRINTED', 'FAILED'],
  PRINTED: ['FINISHING', 'READY', 'FAILED'],
  FINISHING: ['READY', 'FAILED'],
  READY: ['COLLECTED', 'NO_SHOW'],
  FAILED: ['QUEUED', 'CANCELLED'],
  CANCELLED: [],
  COLLECTED: [],
  NO_SHOW: []
};

// Generates an unambiguous 6-character uppercase pickup code (excluding 0, O, 1, I for readability)
const generatePickupCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
};

// Generates a secure QR token
const generateQrToken = () => {
  return `qr_${crypto.randomBytes(20).toString('hex')}`;
};

class StateTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateTransitionError';
    this.statusCode = 409; // 409 Conflict as required
  }
}

/**
 * Enforces job state machine transitions in ONE central service module.
 * Rejects invalid transitions with 409 Conflict.
 */
const transitionJobState = async (jobId, targetState, actor = {}, reason = '') => {
  const job = await Job.findById(jobId);
  if (!job) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }

  const currentState = job.status;

  // If already in target state, return idempotently
  if (currentState === targetState) {
    return job;
  }

  const validNextStates = ALLOWED_TRANSITIONS[currentState] || [];
  if (!validNextStates.includes(targetState)) {
    throw new StateTransitionError(
      `Invalid state transition from ${currentState} to ${targetState}. Allowed transitions: [${validNextStates.join(', ')}]`
    );
  }

  const hasBinding = Boolean(job.options && job.options.binding && job.options.binding !== 'none');

  // Enforce: Skip FINISHING when no binding
  if (targetState === 'FINISHING' && !hasBinding) {
    throw new StateTransitionError(
      `Invalid state transition: Job has no binding (binding: none), so FINISHING state is skipped. Transition directly to READY.`
    );
  }

  let resolvedTargetState = targetState;
  // If moving from PRINTING and no binding, can transition directly to READY
  if (currentState === 'PRINTING' && targetState === 'PRINTED' && !hasBinding) {
    resolvedTargetState = 'READY';
  }

  // Side-effect actions based on transition
  if (resolvedTargetState === 'QUEUED') {
    // Generate pickupCode and qrToken if not already present
    if (!job.pickupCode) {
      job.pickupCode = generatePickupCode();
    }
    if (!job.qrToken) {
      job.qrToken = generateQrToken();
    }

    // Commit slot hold to booking if holdId is present
    if (job.slotStart && job.holdId) {
      try {
        await commitHoldToBooking(job.shopId, job.slotStart, job.holdId);
      } catch (e) {
        console.error('[Slot] Failed to commit hold to booking:', e.message);
      }
    }
  }

  if (resolvedTargetState === 'PRINTING') {
    job.printedAt = new Date();
  }

  if (resolvedTargetState === 'READY') {
    // Ready for student pickup
  }

  if (resolvedTargetState === 'COLLECTED') {
    job.collectedAt = new Date();

    // PHASE 4 PRIVACY: Delete GridFS file immediately upon collection
    if (job.fileId && !job.fileDeletedAt) {
      try {
        await deleteFileFromGridFS(job.fileId);
        job.fileDeletedAt = new Date();
        await AuditLog.logAction({
          action: 'FILE_DELETED_ON_COLLECT',
          jobId: job._id,
          shopId: job.shopId,
          userId: job.userId,
          actorRole: actor.role || 'system',
          metadata: { reason: 'Job collected by student' }
        });
      } catch (delErr) {
        console.error('[Privacy] Failed to delete file on collection:', delErr.message);
      }
    }
  }

  if (resolvedTargetState === 'CANCELLED') {
    // If slot was held, release it
    if (job.slotStart && job.holdId && currentState === 'PENDING_PAYMENT') {
      try {
        await releaseHold(job.shopId, job.slotStart, job.holdId);
      } catch (e) {
        // ignore
      }
    }
  }

  job.status = resolvedTargetState;
  await job.save();

  // Audit log event only (never logs file content)
  await AuditLog.logAction({
    action: `STATUS_TRANSITION_${resolvedTargetState}`,
    jobId: job._id,
    shopId: job.shopId,
    userId: job.userId,
    actorRole: actor.role || 'system',
    metadata: {
      fromState: currentState,
      toState: resolvedTargetState,
      reason,
      actorId: actor.id || null
    }
  });

  // Socket.IO live push
  try {
    const { emitJobUpdate } = require('../server');
    emitJobUpdate(job);
  } catch (socketErr) {
    // Socket emit optional in tests
  }

  return job;
};

module.exports = {
  ALLOWED_TRANSITIONS,
  StateTransitionError,
  generatePickupCode,
  generateQrToken,
  transitionJobState
};
