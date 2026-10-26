const mongoose = require('mongoose');
const crypto = require('crypto');

const pricingSchema = new mongoose.Schema(
  {
    bwPerPage: { type: Number, required: true, default: 2, min: 0 },
    colorPerPage: { type: Number, required: true, default: 10, min: 0 },
    duplexDiscount: { type: Number, required: true, default: 0.5, min: 0 }, // Discount applied per double-sided page
    spiral: { type: Number, required: true, default: 30, min: 0 },
    staple: { type: Number, required: true, default: 5, min: 0 },
    punch: { type: Number, required: true, default: 2, min: 0 },
    a3Multiplier: { type: Number, required: true, default: 2.0, min: 1 }
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    slotMinutes: { type: Number, required: true, default: 15, min: 5, max: 120 },
    slotCapacityPages: { type: Number, required: true, default: 200, min: 1 },
    slotCapacityJobs: { type: Number, required: true, default: 10, min: 1 },
    pagesPerMinute: { type: Number, required: true, default: 25, min: 1 },
    bufferMinutes: { type: Number, required: true, default: 5, min: 0 },
    finishingMinutesSpiral: { type: Number, default: 3 },
    finishingMinutesStaple: { type: Number, default: 1 },
    finishingMinutesPunch: { type: Number, default: 1 },
    openTime: { type: String, default: '08:00' }, // HH:mm format
    closeTime: { type: String, default: '20:00' }, // HH:mm format
    isPaused: { type: Boolean, default: false }
  },
  { _id: false }
);

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: 120
    },
    code: {
      type: String,
      required: [true, 'Shop slug/code is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Shop code must be alphanumeric with hyphens']
    },
    address: {
      type: String,
      required: [true, 'Shop address is required'],
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    pricing: {
      type: pricingSchema,
      default: () => ({})
    },
    settings: {
      type: settingsSchema,
      default: () => ({})
    },
    agentKey: {
      type: String,
      unique: true,
      sparse: true,
      default: () => `ag_${crypto.randomBytes(24).toString('hex')}`
    },
    agentLastSeen: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

shopSchema.methods.isAgentOnline = function () {
  if (!this.agentLastSeen) return false;
  // Consider agent online if heartbeat was within the last 45 seconds
  return Date.now() - new Date(this.agentLastSeen).getTime() < 45000;
};

const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;
