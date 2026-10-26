const mongoose = require('mongoose');

const holdSubSchema = new mongoose.Schema(
  {
    holdId: { type: String, required: true },
    pages: { type: Number, required: true },
    jobs: { type: Number, required: true, default: 1 },
    expiresAt: { type: Date, required: true }
  },
  { _id: false }
);

const slotSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true
    },
    slotStart: {
      type: Date,
      required: true
    },
    slotEnd: {
      type: Date,
      required: true
    },
    bookedPages: {
      type: Number,
      default: 0,
      min: 0
    },
    bookedJobs: {
      type: Number,
      default: 0,
      min: 0
    },
    heldPages: {
      type: Number,
      default: 0,
      min: 0
    },
    heldJobs: {
      type: Number,
      default: 0,
      min: 0
    },
    holds: [holdSubSchema]
  },
  {
    timestamps: true
  }
);

// Unique index: shopId + slotStart
slotSchema.index({ shopId: 1, slotStart: 1 }, { unique: true });

const Slot = mongoose.model('Slot', slotSchema);

module.exports = Slot;
