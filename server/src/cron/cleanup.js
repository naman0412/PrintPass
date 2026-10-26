const cron = require('node-cron');
const { Job } = require('../models/Job');
const AuditLog = require('../models/AuditLog');
const { getGridFSBucket } = require('../config/db');
const { deleteFileFromGridFS } = require('../services/fileService');

/**
 * Runs privacy cleanup:
 * 1. Delete files for CANCELLED, FAILED, NO_SHOW jobs.
 * 2. Delete files for jobs 24 hours past their slot.
 * 3. Delete unattached orphan uploads after 1 hour.
 */
const runPrivacyCleanup = async () => {
  const now = new Date();
  let deletedCount = 0;

  try {
    // 1. Files for CANCELLED, FAILED, NO_SHOW jobs
    const terminalJobs = await Job.find({
      status: { $in: ['CANCELLED', 'FAILED', 'NO_SHOW'] },
      fileId: { $ne: null },
      fileDeletedAt: null
    });

    for (const job of terminalJobs) {
      if (job.fileId) {
        await deleteFileFromGridFS(job.fileId);
        job.fileDeletedAt = new Date();
        await job.save();
        deletedCount++;

        await AuditLog.logAction({
          action: 'FILE_DELETED_CRON_CLEANUP',
          jobId: job._id,
          shopId: job.shopId,
          userId: job.userId,
          actorRole: 'cron_privacy',
          metadata: { reason: `Terminal state cleanup: ${job.status}` }
        });
      }
    }

    // 2. Jobs 24 hours past slotStart
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const pastSlotJobs = await Job.find({
      slotStart: { $lte: twentyFourHoursAgo },
      fileId: { $ne: null },
      fileDeletedAt: null
    });

    for (const job of pastSlotJobs) {
      if (job.fileId) {
        await deleteFileFromGridFS(job.fileId);
        job.fileDeletedAt = new Date();
        await job.save();
        deletedCount++;

        await AuditLog.logAction({
          action: 'FILE_DELETED_CRON_CLEANUP',
          jobId: job._id,
          shopId: job.shopId,
          userId: job.userId,
          actorRole: 'cron_privacy',
          metadata: { reason: 'Job 24 hours past slot pickup window' }
        });
      }
    }

    // 3. Orphan GridFS uploads older than 1 hour never attached to a job
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const bucket = getGridFSBucket();
    const filesCursor = bucket.find({ uploadDate: { $lte: oneHourAgo } });
    const oldFiles = await filesCursor.toArray();

    for (const file of oldFiles) {
      const referencedJob = await Job.findOne({ fileId: file._id });
      if (!referencedJob) {
        // Orphan file! Delete it
        await deleteFileFromGridFS(file._id);
        deletedCount++;

        await AuditLog.logAction({
          action: 'ORPHAN_FILE_DELETED',
          jobId: null,
          shopId: null,
          userId: null,
          actorRole: 'cron_privacy',
          metadata: { fileId: file._id.toString(), filename: file.filename, uploadDate: file.uploadDate }
        });
      }
    }
  } catch (err) {
    console.error('[Privacy Cron Error]', err.message);
  }

  return { success: true, deletedCount };
};

/**
 * Initializes cron schedule to run every 10 minutes
 */
const initCronJobs = () => {
  // Cron schedule: every 10 minutes (*/10 * * * *)
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Running privacy file cleanup...');
    const result = await runPrivacyCleanup();
    console.log(`[Cron] Privacy cleanup completed: ${result.deletedCount} files deleted.`);
  });
};

module.exports = {
  runPrivacyCleanup,
  initCronJobs
};
