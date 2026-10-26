const mongoose = require('mongoose');

const JOB_STATUSES = [
  'DRAFT',
  'PENDING_PAYMENT',
  'QUEUED',
  'PRINTING',
  'PRINTED',
  'FINISHING',
  'READY',
  'COLLECTED',
  'CANCELLED',
  'FAILED',
  'NO_SHOW'
];

const jobSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for walk-ins
      index: true
    },
    isWalkIn: {
      type: Boolean,
      default: false
    },
    customerName: {
      type: String,
      default: ''
    },
    customerPhone: {
      type: String,
      default: ''
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null // GridFS file _id
    },
    originalFilename: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    pageCount: {
      type: Number,
      required: true,
      min: 1
    },
    options: {
      color: { type: Boolean, default: false },
      colorPageRanges: { type: String, default: '' }, // e.g. "1, 3-5"
      orientation: {
        type: String,
        enum: ['auto', 'portrait', 'landscape'],
        default: 'auto'
      },
      duplex: { type: Boolean, default: false }, // true: double-sided, false: single-sided
      copies: { type: Number, default: 1, min: 1, max: 100 },
      pageRange: { type: String, default: 'all' }, // "all" or "1-5"
      paperSize: {
        type: String,
        enum: ['A4', 'A3'],
        default: 'A4'
      },
      binding: {
        type: String,
        enum: ['none', 'spiral', 'staple', 'punch'],
        default: 'none'
      },
      notes: { type: String, default: '', maxlength: 500 }
    },
    pricing: {
      bwPages: { type: Number, default: 0 },
      colorPages: { type: Number, default: 0 },
      baseCost: { type: Number, default: 0 },
      duplexDiscount: { type: Number, default: 0 },
      bindingCost: { type: Number, default: 0 },
      a3Multiplier: { type: Number, default: 1 },
      subtotal: { type: Number, default: 0 },
      total: { type: Number, required: true, default: 0 }
    },
    slotStart: {
      type: Date,
      default: null
    },
    slotEnd: {
      type: Date,
      default: null
    },
    holdId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'DRAFT',
      index: true
    },
    pickupCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    qrToken: {
      type: String,
      default: null
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 5
    },
    fileDeletedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    printedAt: {
      type: Date,
      default: null
    },
    collectedAt: {
      type: Date,
      default: null
    },
    agentErrors: [
      {
        message: String,
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Required compound indexes
jobSchema.index({ shopId: 1, status: 1, slotStart: 1 });
jobSchema.index({ pickupCode: 1 }, { sparse: true });
// TTL index: automatically remove document when expiresAt passes (if set)
jobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Job = mongoose.model('Job', jobSchema);

module.exports = {
  Job,
  JOB_STATUSES
};
