const crypto = require('crypto');
const Slot = require('../models/Slot');
const Shop = require('../models/Shop');

/**
 * Generates all time intervals for a shop on a given date (e.g., 08:00 to 20:00 every 15 min).
 */
const generateDaySlotIntervals = (dateStr, openTimeStr = '08:00', closeTimeStr = '20:00', slotMinutes = 15) => {
  const [openHour, openMin] = openTimeStr.split(':').map(Number);
  const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);

  const baseDate = new Date(dateStr);
  const startOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), openHour, openMin, 0);
  const endOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), closeHour, closeMin, 0);

  const intervals = [];
  let currentStart = new Date(startOfDay);

  while (currentStart < endOfDay) {
    const currentEnd = new Date(currentStart.getTime() + slotMinutes * 60000);
    if (currentEnd <= endOfDay) {
      intervals.push({
        slotStart: new Date(currentStart),
        slotEnd: new Date(currentEnd)
      });
    }
    currentStart = currentEnd;
  }

  return intervals;
};

/**
 * Retrieves all slots for a shop on a date, checking capacity against required pages.
 * Filters out expired holds on read and hides or marks full slots.
 */
const getAvailableSlots = async (shopId, dateStr, requiredPages = 1) => {
  const shop = await Shop.findById(shopId);
  if (!shop) {
    throw new Error('Shop not found');
  }

  // Release any expired holds first
  await releaseExpiredHolds(shopId);

  const slotMinutes = shop.settings.slotMinutes || 15;
  const slotCapacityPages = shop.settings.slotCapacityPages || 200;
  const slotCapacityJobs = shop.settings.slotCapacityJobs || 10;
  const openTime = shop.settings.openTime || '08:00';
  const closeTime = shop.settings.closeTime || '20:00';

  const intervals = generateDaySlotIntervals(dateStr, openTime, closeTime, slotMinutes);
  if (intervals.length === 0) return [];

  const dayStart = intervals[0].slotStart;
  const dayEnd = intervals[intervals.length - 1].slotEnd;

  const existingSlots = await Slot.find({
    shopId,
    slotStart: { $gte: dayStart, $lte: dayEnd }
  });

  const slotMap = new Map();
  for (const s of existingSlots) {
    slotMap.set(s.slotStart.getTime(), s);
  }

  const now = new Date();

  return intervals
    .map((interval) => {
      const timeKey = interval.slotStart.getTime();
      const slotDoc = slotMap.get(timeKey);

      const bookedPages = slotDoc ? slotDoc.bookedPages : 0;
      const bookedJobs = slotDoc ? slotDoc.bookedJobs : 0;
      const heldPages = slotDoc ? slotDoc.heldPages : 0;
      const heldJobs = slotDoc ? slotDoc.heldJobs : 0;

      const remainingPages = Math.max(0, slotCapacityPages - (bookedPages + heldPages));
      const remainingJobs = Math.max(0, slotCapacityJobs - (bookedJobs + heldJobs));

      // A slot is available if:
      // 1. Slot is in the future
      // 2. Capacity for pages and jobs is not exceeded
      const isFuture = interval.slotStart > now;
      const hasPageCapacity = remainingPages >= requiredPages;
      const hasJobCapacity = remainingJobs >= 1;
      const isAvailable = isFuture && hasPageCapacity && hasJobCapacity && !shop.settings.isPaused;

      return {
        slotStart: interval.slotStart,
        slotEnd: interval.slotEnd,
        isAvailable,
        remainingPages,
        remainingJobs,
        totalCapacityPages: slotCapacityPages,
        totalCapacityJobs: slotCapacityJobs
      };
    })
    .filter((s) => s.isAvailable); // Hide full/past slots
};

/**
 * Atomically holds capacity in a slot for 5 minutes during payment.
 * Prevents overbooking under high concurrent requests.
 */
const holdSlot = async (shopId, slotStart, slotEnd, pages, holdDurationMinutes = 5) => {
  const shop = await Shop.findById(shopId);
  if (!shop) {
    throw new Error('Shop not found');
  }

  if (shop.settings.isPaused) {
    throw new Error('Shop is currently paused. Please try again later.');
  }

  // Release any expired holds in this shop first
  await releaseExpiredHolds(shopId);

  const slotCapacityPages = shop.settings.slotCapacityPages || 200;
  const slotCapacityJobs = shop.settings.slotCapacityJobs || 10;

  const startDate = new Date(slotStart);
  const endDate = new Date(slotEnd);
  const now = new Date();

  if (startDate <= now) {
    throw new Error('Cannot book a slot in the past.');
  }

  // Ensure slot record exists (idempotent upsert)
  await Slot.updateOne(
    { shopId, slotStart: startDate },
    {
      $setOnInsert: {
        shopId,
        slotStart: startDate,
        slotEnd: endDate,
        bookedPages: 0,
        bookedJobs: 0,
        heldPages: 0,
        heldJobs: 0,
        holds: []
      }
    },
    { upsert: true }
  );

  const holdId = `hld_${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);

  // Atomic reservation query: checks capacity and reserves in one atomic operation
  const updatedSlot = await Slot.findOneAndUpdate(
    {
      shopId,
      slotStart: startDate,
      $expr: {
        $and: [
          { $lte: [{ $add: ['$bookedPages', '$heldPages', pages] }, slotCapacityPages] },
          { $lte: [{ $add: ['$bookedJobs', '$heldJobs', 1] }, slotCapacityJobs] }
        ]
      }
    },
    {
      $inc: { heldPages: pages, heldJobs: 1 },
      $push: {
        holds: {
          holdId,
          pages,
          jobs: 1,
          expiresAt
        }
      }
    },
    { new: true }
  );

  if (!updatedSlot) {
    return {
      success: false,
      error: 'Slot is full or does not have enough capacity. Please choose another slot.'
    };
  }

  return {
    success: true,
    holdId,
    slotStart: startDate,
    slotEnd: endDate,
    expiresAt
  };
};

/**
 * Commits a held slot into a confirmed booked slot upon successful payment.
 */
const commitHoldToBooking = async (shopId, slotStart, holdId) => {
  const startDate = new Date(slotStart);
  const slot = await Slot.findOne({ shopId, slotStart: startDate, 'holds.holdId': holdId });

  if (!slot) {
    return false;
  }

  const holdItem = slot.holds.find((h) => h.holdId === holdId);
  if (!holdItem) return false;

  const pages = holdItem.pages;
  const jobs = holdItem.jobs || 1;

  await Slot.updateOne(
    { shopId, slotStart: startDate },
    {
      $inc: {
        heldPages: -pages,
        heldJobs: -jobs,
        bookedPages: pages,
        bookedJobs: jobs
      },
      $pull: { holds: { holdId } }
    }
  );

  return true;
};

/**
 * Releases a hold manually (e.g. user cancelled or switched slot).
 */
const releaseHold = async (shopId, slotStart, holdId) => {
  const startDate = new Date(slotStart);
  const slot = await Slot.findOne({ shopId, slotStart: startDate, 'holds.holdId': holdId });
  if (!slot) return false;

  const holdItem = slot.holds.find((h) => h.holdId === holdId);
  if (!holdItem) return false;

  await Slot.updateOne(
    { shopId, slotStart: startDate },
    {
      $inc: {
        heldPages: -holdItem.pages,
        heldJobs: -holdItem.jobs
      },
      $pull: { holds: { holdId } }
    }
  );

  return true;
};

/**
 * Releases all expired holds across all slots or for a specific shop.
 */
const releaseExpiredHolds = async (shopId = null) => {
  const now = new Date();
  const query = {
    'holds.expiresAt': { $lte: now }
  };
  if (shopId) {
    query.shopId = shopId;
  }

  const slotsWithExpiredHolds = await Slot.find(query);

  for (const slot of slotsWithExpiredHolds) {
    const expired = slot.holds.filter((h) => h.expiresAt <= now);
    if (expired.length > 0) {
      const expiredPages = expired.reduce((sum, h) => sum + h.pages, 0);
      const expiredJobs = expired.reduce((sum, h) => sum + (h.jobs || 1), 0);
      const expiredIds = expired.map((h) => h.holdId);

      await Slot.updateOne(
        { _id: slot._id },
        {
          $inc: {
            heldPages: -expiredPages,
            heldJobs: -expiredJobs
          },
          $pull: { holds: { holdId: { $in: expiredIds } } }
        }
      );
    }
  }
};

module.exports = {
  generateDaySlotIntervals,
  getAvailableSlots,
  holdSlot,
  commitHoldToBooking,
  releaseHold,
  releaseExpiredHolds
};
