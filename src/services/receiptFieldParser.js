/**
 * Receipt field extraction.
 *
 * Every function here is pure and free of browser APIs so the parsing rules
 * can be unit tested directly against known receipt text. Nothing here
 * invents a value: when a field cannot be supported by the text it is
 * reported as not detected, and the caller is expected to let the user fill
 * it in.
 */

import { CATEGORY_KEYWORDS } from '../utils/expenseCategorizer';

export const MAX_RAW_TEXT_LENGTH = 20000;

export const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none',
};

export const CONFIDENCE_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'Not detected',
};

export const DATA_QUALITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  limited: 'Limited',
};

const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/* ------------------------------------------------------------------ *
 * Amounts
 * ------------------------------------------------------------------ */

// Ordered by how strongly the label implies "this is the amount to record".
// The score of the winning label plus any evidence decides the confidence,
// so a lone ambiguous "AMOUNT" can never outrank a "GRAND TOTAL".
const TOTAL_LABELS = [
  { name: 'GRAND TOTAL', score: 100, pattern: /\bgrand\s*total\b/i },
  { name: 'NET TOTAL', score: 95, pattern: /\bnet\s*total\b/i },
  { name: 'TOTAL AMOUNT', score: 92, pattern: /\btotal\s*amount\b/i },
  { name: 'AMOUNT DUE', score: 90, pattern: /\bamount\s*(?:due|paid)\b/i },
  { name: 'TOTAL', score: 70, pattern: /\btotal\b(?!\s*(?:gst|vat|tax|discount|savings?|items?|qty|quantity|points?|no\b|line|count))/i },
  { name: 'AMOUNT', score: 70, pattern: /\bamount\b(?!\s*(?:saved|due\s*date))/i },
  { name: 'BALANCE', score: 68, pattern: /\bbalance\b/i },
  { name: 'SUBTOTAL', score: 40, pattern: /\bsub\s*total\b/i },
];

const CURRENCY_HINT = /(?:₹|\$|€|£|¥|rs\.?|inr|usd|eur|gbp)/i;
const NUMBER_TOKEN = /-?\d[\d,]*(?:\.\d{1,2})?/g;

function normaliseReceiptText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[|]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function linesOf(text) {
  return text.split('\n').map((line) => line.trim());
}

/**
 * Accepts 1,250.50 / 1250.50 / 1.250,50 and plain integers. The rightmost of
 * `,` and `.` is treated as the decimal separator, which matches both
 * Indian/US and European receipt printings.
 */
export function parseAmountToken(raw) {
  let s = String(raw ?? '').trim().replace(/[^\d.,\-]/g, '');
  if (s === '' || s === '-') return null;

  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    const tail = s.length - lastComma - 1;
    s = tail === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }

  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function looksLikeMoney(value, token) {
  if (!Number.isFinite(value) || value <= 0) return false;
  // An expense total is never a 9 digit run with no grouping and no decimals;
  // that shape is an invoice number or a phone number.
  if (!/[,.]/.test(token) && Number.isInteger(value) && String(value).length > 7) return false;
  return true;
}

function collectAmountCandidates(text) {
  const lines = linesOf(text);
  const candidates = [];

  lines.forEach((line, lineIndex) => {
    const matches = [];
    TOTAL_LABELS.forEach((label) => {
      const found = label.pattern.exec(line);
      if (found) matches.push({ label, index: found.index, length: found[0].length });
    });
    if (matches.length === 0) return;

    // When two labels land on one line ("GRAND TOTAL") the stronger label owns
    // the line so the weaker one cannot claim a lower-scoring duplicate.
    matches.sort((a, b) => b.label.score - a.label.score || a.index - b.index);
    const taken = [];
    const usable = matches.filter((m) => {
      const overlaps = taken.some((t) => m.index < t.end && m.index + m.length > t.start);
      if (overlaps) return false;
      taken.push({ start: m.index, end: m.index + m.length });
      return true;
    });

    const numbers = [];
    let match;
    NUMBER_TOKEN.lastIndex = 0;
    while ((match = NUMBER_TOKEN.exec(line)) !== null) {
      numbers.push({ token: match[0], index: match.index, end: match.index + match[0].length });
    }

    usable.forEach(({ label, index, length }) => {
      const labelEnd = index + length;
      let chosen = null;
      let direction = 'after';

      const after = numbers.find((n) => n.index >= labelEnd);
      if (after) {
        chosen = after;
      } else {
        const before = [...numbers].reverse().find((n) => n.end <= index);
        if (before) {
          chosen = before;
          direction = 'before';
        }
      }

      // No money on the label line: a short numeric-only line directly beneath
      // is the usual layout, but an arbitrary line is never borrowed.
      if (!chosen) {
        const next = lines[lineIndex + 1];
        if (next !== undefined && /^-?[\d.,\s]+(?:rs\.?|inr|₹)?$/i.test(next) && /\d/.test(next)) {
          const token = next.replace(/[^\d.,\-]/gi, '').trim();
          chosen = { token, index: 0, end: token.length };
          direction = 'next-line';
        }
      }

      if (!chosen) return;

      const value = parseAmountToken(chosen.token);
      if (!looksLikeMoney(value, chosen.token)) return;

      let score = label.score;
      const between = line.slice(Math.min(labelEnd, chosen.index), Math.max(labelEnd, chosen.index));
      if (CURRENCY_HINT.test(between) || CURRENCY_HINT.test(chosen.token)) score += 10;
      if (/\.\d{2}$/.test(chosen.token)) score += 4;

      candidates.push({
        value,
        label: label.name,
        line: lineIndex,
        direction,
        score,
        raw: chosen.token,
      });
    });
  });

  return candidates;
}

export function extractTotalAmount(text) {
  const normalised = normaliseReceiptText(text);
  if (!normalised) return notDetected('No receipt text was recognised.');

  const candidates = collectAmountCandidates(normalised);
  if (candidates.length === 0) {
    return notDetected('No TOTAL or GRAND TOTAL line was found on the receipt.');
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Equal evidence: the figure printed closest to the end of the receipt is
    // the summary total rather than an item line.
    return b.line - a.line;
  });

  const best = candidates[0];
  const runnerUp = candidates.find((c) => c !== best);
  const margin = runnerUp ? best.score - runnerUp.score : Number.POSITIVE_INFINITY;

  const level =
    best.score >= 80 && margin >= 25
      ? CONFIDENCE.HIGH
      : best.score >= 60
        ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;

  return {
    value: best.value,
    level,
    evidence: `${best.label} ${best.raw}`,
    note:
      best.label === 'SUBTOTAL'
        ? 'Matched SUBTOTAL, which may exclude tax or delivery charges.'
        : null,
    candidates: candidates.slice(0, 5).map((c) => ({
      value: c.value,
      label: c.label,
      score: c.score,
    })),
    ambiguous: false,
  };
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const DATE_LABEL = /\b(date|billed|issued|printed|generated|txn|transaction|payment|paid|purchase|order|checkout)\b/i;
const DATE_EXCLUDE = /\b(expiry|expir|valid\s*(?:upto|until|till|through)|use\s*by|batch|lot|gstin|tin\b|pan\b|card\s*no|order\s*(?:id|no)|invoice\s*(?:no|id)|ref(?:erence)?\s*(?:no|id)|transaction\s*id|auth\s*code)\b/i;

function expandYear(raw) {
  let year = Number(raw);
  if (!Number.isFinite(year)) return null;
  if (raw.length <= 2) {
    year = Number(raw) <= 68 ? 2000 + Number(raw) : 1900 + Number(raw);
  }
  return year;
}

function toIsoDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Reject impossible calendar days such as 31 February.
  const [y, m, d] = iso.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return iso;
}

function detectDateMatches(text) {
  const results = [];
  const lines = linesOf(text);
  const nowYear = new Date().getFullYear();

  lines.forEach((line, lineIndex) => {
    if (DATE_EXCLUDE.test(line)) return;

    const push = (value, raw, labelled, kind) => {
      if (!value) return;
      const year = Number(value.slice(0, 4));
      // A year beyond next year is almost always an expiry or a printed
      // validity marker rather than the purchase date.
      if (year > nowYear + 1) return;
      results.push({ value, raw, line: lineIndex, labelled, kind });
    };

    // ISO first: it is unambiguous, so it never needs a day/month tie-break.
    const iso = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(line);
    if (iso) {
      push(toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3])), iso[0], DATE_LABEL.test(line), 'iso');
      return;
    }

    // 12 Sep 2026
    const dayMonthName = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/.exec(line);
    if (dayMonthName) {
      const month = MONTH_NAMES[dayMonthName[2].toLowerCase()];
      const year = expandYear(dayMonthName[3]);
      push(month ? toIsoDate(year, month, Number(dayMonthName[1])) : null, dayMonthName[0], DATE_LABEL.test(line), 'dayMonthName');
      return;
    }

    // Sep 12, 2026
    const monthDayName = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/.exec(line);
    if (monthDayName) {
      const month = MONTH_NAMES[monthDayName[1].toLowerCase()];
      const year = expandYear(monthDayName[3]);
      push(month ? toIsoDate(year, month, Number(monthDayName[2])) : null, monthDayName[0], DATE_LABEL.test(line), 'monthDayName');
      return;
    }

    // 12/09/2026 - order of day and month is not knowable from the text alone.
    const numeric = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/.exec(line);
    if (numeric) {
      const a = Number(numeric[1]);
      const b = Number(numeric[2]);
      const year = expandYear(numeric[3]);
      if (year === null) return;

      if (a > 12 && b <= 12) {
        push(toIsoDate(year, b, a), numeric[0], DATE_LABEL.test(line), 'dayFirst');
        return;
      }
      if (b > 12 && a <= 12) {
        push(toIsoDate(year, a, b), numeric[0], DATE_LABEL.test(line), 'monthFirst');
        return;
      }
      // Both parts fit either order. Indian receipts read DD/MM, so that is
      // offered, but the result is flagged so the UI asks the user to confirm.
      push(toIsoDate(year, b, a), numeric[0], DATE_LABEL.test(line), 'ambiguous');
    }
  });

  return results;
}

export function extractReceiptDate(text) {
  const normalised = normaliseReceiptText(text);
  if (!normalised) return notDetected('No receipt text was recognised.');

  const matches = detectDateMatches(normalised);
  if (matches.length === 0) {
    return notDetected('No date in a recognised format was found on the receipt.');
  }

  const score = (m) => {
    let s = 50;
    if (m.labelled) s += 30;
    if (m.kind === 'iso') s += 30;
    if (m.kind === 'dayMonthName' || m.kind === 'monthDayName') s += 20;
    if (m.kind === 'ambiguous') s -= 20;
    return s;
  };

  matches.sort((a, b) => {
    if (score(b) !== score(a)) return score(b) - score(a);
    return a.line - b.line;
  });

  const best = matches[0];
  const ambiguous = best.kind === 'ambiguous';
  const level = ambiguous
    ? CONFIDENCE.MEDIUM
    : score(best) >= 80
      ? CONFIDENCE.HIGH
      : CONFIDENCE.MEDIUM;

  return {
    value: best.value,
    level,
    evidence: best.raw,
    note: ambiguous
      ? `Read as DD/MM/YYYY. The receipt does not distinguish ${best.raw.split(/[\/\-.]/)[0]} days from months, so please confirm the date.`
      : null,
    candidates: matches.slice(0, 5).map((m) => m.value),
    ambiguous,
  };
}

/* ------------------------------------------------------------------ *
 * Merchant
 * ------------------------------------------------------------------ */

const DOCUMENT_NOISE = /^(receipt|invoice|tax\s*invoice|bill|customer\s*copy|merchant\s*copy|phone|tel\b|mobile|www\.|http|email)\b[\s:.-]*[0-9a-z]*$/i;
// Lines that merely start with an identifier keyword are identifier lines, not
// the store name, however the rest of the line is punctuated.
const DOCUMENT_PREFIX = /^(gst\s*(no|in)?|gstin|tin\b|pan\b|fssai|bill\s*(no|number)|invoice\s*(no|number|id)|order\s*(id|no|number)|ref(?:erence)?\s*(no|id|number)|transaction\s*id|auth\s*code|phone|tel\b|mobile|www\.|http|email|tax\s*invoice|receipt|bill|customer\s*copy|merchant\s*copy)\b/i;
// A store name does not begin with a field label. Without this, "TOTAL 850"
// would be read as the merchant whenever the real name was not legible.
const RECEIPT_LABEL_PREFIX = /^(grand\s*total|net\s*total|sub\s*total|total|total\s*amount|amount|amount\s*(due|paid)|balance|cash|change|tax|gst|vat|sgst|cgst|igst|discount|savings?|round\s*off|thank\s*you|thanks|welcome|visit\s*again|signature|printed|powered\s*by|terms|hst|hsn|qty|quantity|item|items|sl\s*no|transaction|auth\s*code|approval|approved|declined|points?|earned|redeemed|coupon|offer|offers?|you\s*saved|save|service\s*charge|delivery\s*(charge|charges)?|mrp|unit\s*price|price|net\s*banking|neft|rtgs|imps|upi|card|visa|master\s*card|mastercard|rupay|maestro|amex|loyalty\s*points?)\b/i;
const BUSINESS_SUFFIX = /\b(pvt|private|ltd|limited|llc|inc|llp|company|co\b|store|shop|mart|market|supermarket|hypermarket|restaurant|cafe|coffee|pizza|bakery|hospital|pharmacy|clinic|hotel|mall|outlet|salon|saloon|fuel|petrol|petroleum|airlines|airways|bank|station|express|centre|center|department|electronics|grocer|fresh|kitchen|grill|dhaba|biryani|sweets|medical|book\s*store)\b/i;
const MERCHANT_SCAN_LINES = 8;

/**
 * Known merchant tokens are taken from the existing categoriser keyword table
 * rather than a second hardcoded list, so both features stay in step.
 */
function knownMerchantKeywords() {
  const entries = [];
  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(([keyword, weight]) => {
      entries.push({ keyword, weight, category });
    });
  });
  return entries.sort((a, b) => b.weight - a.weight);
}

const KNOWN_MERCHANTS = knownMerchantKeywords();

function isPlausibleMerchantLine(line) {
  if (!line || line.length < 3 || line.length > 48) return false;
  if (DOCUMENT_NOISE.test(line.trim())) return false;
  if (DOCUMENT_PREFIX.test(line.trim())) return false;
  if (RECEIPT_LABEL_PREFIX.test(line.trim())) return false;
  if (/^\d[\d\s\-/().]*$/.test(line)) return false;
  if (/\b\d{4,}\b/.test(line) && !BUSINESS_SUFFIX.test(line)) return false;
  // Needs at least a couple of letters to be a name rather than a code.
  return (line.match(/[A-Za-z]/g) || []).length >= 2;
}

function matchKnownMerchant(line) {
  const haystack = ` ${line.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const entry of KNOWN_MERCHANTS) {
    const needle = entry.keyword.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
    const index = haystack.indexOf(` ${needle} `);
    if (index !== -1) return { keyword: entry.keyword, weight: entry.weight };
  }
  return null;
}

function toDisplayCase(value) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMerchant(text) {
  const normalised = normaliseReceiptText(text);
  if (!normalised) return notDetected('No receipt text was recognised.');

  const lines = linesOf(normalised).filter((line) => line.length > 0);
  const window = lines.slice(0, MERCHANT_SCAN_LINES);

  let best = null;

  window.forEach((line, index) => {
    if (!isPlausibleMerchantLine(line)) return;

    const known = matchKnownMerchant(line);
    const suffix = BUSINESS_SUFFIX.test(line);
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    const alphaRatio = letters / line.length;

    let score = 0;
    if (known) score += 40 + known.weight * 5;
    if (suffix) score += 22;
    if (alphaRatio >= 0.6) score += 14;
    if (line.length >= 4 && line.length <= 32) score += 8;
    // The store name is printed at the top, so nearer the top is better.
    score += Math.max(0, MERCHANT_SCAN_LINES - index);

    if (!best || score > best.score) {
      best = { value: line, score, known, suffix, index };
    }
  });

  if (!best) {
    return notDetected('No store name could be read from the top of the receipt.');
  }

  let level = CONFIDENCE.LOW;
  if (best.known && best.suffix) level = CONFIDENCE.HIGH;
  else if (best.known) level = CONFIDENCE.HIGH;
  else if (best.suffix) level = CONFIDENCE.MEDIUM;

  return {
    value: best.value,
    level,
    evidence: best.known
      ? `Matched known merchant "${best.known.keyword}"`
      : best.suffix
        ? 'Line looks like a business name'
        : 'First readable line on the receipt',
    note: best.known ? null : 'Read from the top of the receipt. Please confirm it is the merchant.',
    matchedKeyword: best.known ? best.known.keyword : null,
    suggestedCase: toDisplayCase(best.value),
    ambiguous: false,
  };
}

/* ------------------------------------------------------------------ *
 * Payment method
 * ------------------------------------------------------------------ */

const CARD_BRAND = /\b(visa|master\s*card|mastercard|amex|american\s*express|maestro|rupay|diners\s*club)\b/i;
const PAYMENT_SIGNALS = [
  { method: 'Debit Card', level: CONFIDENCE.HIGH, pattern: /\b(debit\s*card|visa\s*debit|maestro|rupay\s*debit|debit)\b/i },
  { method: 'Credit Card', level: CONFIDENCE.HIGH, pattern: /\b(credit\s*card|visa\s*credit|mastercard\s*credit|credit)\b/i },
  { method: 'UPI', level: CONFIDENCE.HIGH, pattern: /\b(upi|gpay|google\s*pay|phonepe|phone\s*pe|paytm|bhim|freecharge|amazon\s*pay)\b/i },
  { method: 'Bank Transfer', level: CONFIDENCE.HIGH, pattern: /\b(neft|rtgs|imps|net\s*banking|bank\s*transfer|fund\s*transfer)\b/i },
  { method: 'Cash', level: CONFIDENCE.HIGH, pattern: /\b(cash|paid\s*in\s*cash|cash\s*tender)\b/i },
];

// A receipt that shows both "UPI" and "CASH" is almost always a UPI payment
// with cash change, so the digital methods are consulted first.
const PAYMENT_PRIORITY = ['Debit Card', 'Credit Card', 'UPI', 'Bank Transfer', 'Cash'];

export function extractPaymentMethod(text) {
  const normalised = normaliseReceiptText(text);
  if (!normalised) return notDetected('No receipt text was recognised.');

  const found = PAYMENT_SIGNALS.filter((signal) => signal.pattern.test(normalised)).map(
    (signal) => signal.method
  );

  const chosen = PAYMENT_PRIORITY.find((method) => found.includes(method));

  if (chosen) {
    return {
      value: chosen,
      level: CONFIDENCE.HIGH,
      evidence: `Found "${chosen}" on the receipt`,
      note: found.length > 1 ? `Other payment words also appear: ${found.filter((m) => m !== chosen).join(', ')}.` : null,
      cardBrand: null,
      ambiguous: false,
    };
  }

  const brand = CARD_BRAND.exec(normalised);
  if (brand) {
    return {
      value: null,
      level: CONFIDENCE.LOW,
      evidence: `Found card brand "${brand[0]}"`,
      note: 'A card was used, but the receipt does not say whether it is credit or debit. Please choose.',
      cardBrand: brand[0].replace(/\s+/g, ' ').toLowerCase(),
      ambiguous: true,
    };
  }

  return notDetected('No payment method was mentioned on the receipt.');
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

function notDetected(reason) {
  return {
    value: null,
    level: CONFIDENCE.NONE,
    evidence: null,
    note: reason,
    cardBrand: null,
    ambiguous: false,
  };
}

const KEY_FIELDS = ['merchant', 'amount', 'date', 'paymentMethod'];

export function summariseDataQuality(fields) {
  const detected = KEY_FIELDS.filter((key) => {
    const level = fields[key]?.level;
    return level === CONFIDENCE.HIGH || level === CONFIDENCE.MEDIUM;
  });
  const strong = KEY_FIELDS.filter((key) => fields[key]?.level === CONFIDENCE.HIGH);
  const amountDetected = fields.amount?.level === CONFIDENCE.HIGH || fields.amount?.level === CONFIDENCE.MEDIUM;

  let quality;
  if (amountDetected && detected.length >= 3) quality = 'high';
  else if (detected.length >= 2) quality = 'medium';
  else quality = 'limited';

  return {
    quality,
    label: DATA_QUALITY_LABELS[quality],
    detectedCount: detected.length,
    strongCount: strong.length,
    totalFields: KEY_FIELDS.length,
  };
}

export function isMeaningfulReceiptText(text) {
  const normalised = normaliseReceiptText(text);
  if (normalised.length < 8) return false;
  const letters = (normalised.match(/[A-Za-z]/g) || []).length;
  const digits = (normalised.match(/\d/g) || []).length;
  // A page of digits with no words is a barcode or a failed render, not text.
  return letters >= 4 && letters + digits >= 8;
}

export { normaliseReceiptText };
