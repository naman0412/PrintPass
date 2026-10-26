/**
 * Parses a page range string (e.g., "1-3, 5, 8-10") into a set of 1-based page indices.
 * Clips indices to [1, maxPages].
 */
const parsePageRange = (rangeStr, maxPages) => {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

  const pages = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(maxPages, Math.max(start, end));
        for (let p = from; p <= to; p++) {
          pages.add(p);
        }
      }
    } else {
      const single = parseInt(trimmed, 10);
      if (!isNaN(single) && single >= 1 && single <= maxPages) {
        pages.add(single);
      }
    }
  }

  const result = Array.from(pages).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: maxPages }, (_, i) => i + 1);
};

/**
 * Calculates print job price and breakdown based on shop pricing rules.
 * Never trusts client price calculation.
 */
const calculateQuote = (shopPricing, totalDocPages, options = {}) => {
  const pricing = {
    bwPerPage: shopPricing.bwPerPage ?? 2,
    colorPerPage: shopPricing.colorPerPage ?? 10,
    duplexDiscount: shopPricing.duplexDiscount ?? 0.5,
    spiral: shopPricing.spiral ?? 30,
    staple: shopPricing.staple ?? 5,
    punch: shopPricing.punch ?? 2,
    a3Multiplier: shopPricing.a3Multiplier ?? 2.0
  };

  const copies = Math.max(1, parseInt(options.copies, 10) || 1);
  const isA3 = (options.paperSize || '').toUpperCase() === 'A3';
  const paperMultiplier = isA3 ? pricing.a3Multiplier : 1.0;
  const isDuplex = Boolean(options.duplex);

  // Selected pages to print
  const selectedPages = parsePageRange(options.pageRange || 'all', totalDocPages);
  const totalPagesPerCopy = selectedPages.length;

  let colorPagesPerCopy = 0;
  let bwPagesPerCopy = 0;

  if (!options.color) {
    bwPagesPerCopy = totalPagesPerCopy;
    colorPagesPerCopy = 0;
  } else {
    if (options.colorPageRanges && options.colorPageRanges.trim().toLowerCase() !== 'all') {
      const colorIndices = new Set(parsePageRange(options.colorPageRanges, totalDocPages));
      for (const pageNum of selectedPages) {
        if (colorIndices.has(pageNum)) {
          colorPagesPerCopy++;
        } else {
          bwPagesPerCopy++;
        }
      }
    } else {
      // Entire job is color
      colorPagesPerCopy = totalPagesPerCopy;
      bwPagesPerCopy = 0;
    }
  }

  // Base costs per copy
  const bwCostPerCopy = bwPagesPerCopy * pricing.bwPerPage * paperMultiplier;
  const colorCostPerCopy = colorPagesPerCopy * pricing.colorPerPage * paperMultiplier;
  const baseCost = (bwCostPerCopy + colorCostPerCopy) * copies;

  // Duplex discount per copy: applied on back side of pages
  let duplexDiscount = 0;
  if (isDuplex && totalPagesPerCopy > 1) {
    const backSidesPerCopy = Math.floor(totalPagesPerCopy / 2);
    duplexDiscount = backSidesPerCopy * pricing.duplexDiscount * copies;
  }

  // Binding cost (applied per copy or per job; typically per bound document copy)
  let bindingCostPerCopy = 0;
  switch (options.binding) {
    case 'spiral':
      bindingCostPerCopy = pricing.spiral;
      break;
    case 'staple':
      bindingCostPerCopy = pricing.staple;
      break;
    case 'punch':
      bindingCostPerCopy = pricing.punch;
      break;
    default:
      bindingCostPerCopy = 0;
      break;
  }
  const totalBindingCost = bindingCostPerCopy * copies;

  // Subtotal and Total
  const subtotal = Math.max(0, baseCost - duplexDiscount);
  const total = Math.max(0, parseFloat((subtotal + totalBindingCost).toFixed(2)));

  return {
    bwPages: bwPagesPerCopy * copies,
    colorPages: colorPagesPerCopy * copies,
    totalPages: totalPagesPerCopy * copies,
    baseCost: parseFloat(baseCost.toFixed(2)),
    duplexDiscount: parseFloat(duplexDiscount.toFixed(2)),
    bindingCost: parseFloat(totalBindingCost.toFixed(2)),
    a3Multiplier: paperMultiplier,
    subtotal: parseFloat(subtotal.toFixed(2)),
    total
  };
};

/**
 * Calculates estimated wait time in minutes:
 * pages queued ahead / shop pages-per-minute + finishing time + 5 min buffer
 */
const calculateEstimatedWait = (queuedPagesAhead, shopSettings = {}, bindingOption = 'none') => {
  const pagesPerMin = shopSettings.pagesPerMinute || 25;
  const bufferMinutes = shopSettings.bufferMinutes ?? 5;

  let finishingMinutes = 0;
  if (bindingOption === 'spiral') {
    finishingMinutes = shopSettings.finishingMinutesSpiral ?? 3;
  } else if (bindingOption === 'staple') {
    finishingMinutes = shopSettings.finishingMinutesStaple ?? 1;
  } else if (bindingOption === 'punch') {
    finishingMinutes = shopSettings.finishingMinutesPunch ?? 1;
  }

  const printTimeMinutes = Math.ceil(queuedPagesAhead / pagesPerMin);
  return Math.max(5, printTimeMinutes + finishingMinutes + bufferMinutes);
};

module.exports = {
  parsePageRange,
  calculateQuote,
  calculateEstimatedWait
};
