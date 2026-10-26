const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
      index: true
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actorRole: {
      type: String,
      default: 'system'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    ip: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Method to safely record an audit log, stripping out any accidental raw file content or binary buffers
auditLogSchema.statics.logAction = async function ({ action, jobId, shopId, userId, actorRole, metadata = {}, ip = '' }) {
  const safeMeta = { ...metadata };
  delete safeMeta.file;
  delete safeMeta.buffer;
  delete safeMeta.content;
  delete safeMeta.password;

  return this.create({
    action,
    jobId,
    shopId,
    userId,
    actorRole,
    metadata: safeMeta,
    ip
  });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
