/**
 * Receipt scanning service.
 *
 * Pipeline: validate file -> run an OCR provider -> parse fields -> reuse the
 * existing categoriser -> return a draft for the user to review. The service
 * never writes an expense; saving is the review screen's job.
 *
 * Every value in the returned result is either read from the receipt or null.
 * A field that could not be supported by the text is reported as not detected
 * so the UI can ask for it instead of inventing it.
 */

import { CATEGORIES, PAYMENT_METHODS } from '../data/constants';
import { suggestCategory } from '../utils/expenseCategorizer';
import { todayISO } from '../utils/format';
import {
  SUPPORTED_FORMAT_LABEL,
  detectReceiptKind,
  formatFileSize,
  formatMaxSize,
  validateReceiptFile,
} from './receiptFileValidation';
import {
  CONFIDENCE,
  CONFIDENCE_LABELS,
  MAX_RAW_TEXT_LENGTH,
  extractMerchant,
  extractPaymentMethod,
  extractReceiptDate,
  extractTotalAmount,
  isMeaningfulReceiptText,
  normaliseReceiptText,
  summariseDataQuality,
} from './receiptFieldParser';
import {
  OCR_ERROR_CODES,
  OCR_ERROR_MESSAGES,
  OCR_STAGES,
  getReceiptOcrProviders,
  runReceiptOcr,
} from './receiptOcrProvider';

export { OCR_STAGES, OCR_ERROR_CODES };
export {
  SUPPORTED_FORMAT_LABEL,
  formatFileSize,
  formatMaxSize,
  validateReceiptFile,
  detectReceiptKind,
  getReceiptOcrProviders,
};

// Ordered how the review form presents them.
export const RECEIPT_FIELDS = ['merchant', 'amount', 'date', 'category', 'paymentMethod'];

export const SCAN_STATUS = {
  OK: 'ok',
  NO_TEXT: 'no-text',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
  INVALID: 'invalid',
};

const LEVEL_TO_SCORE = {
  [CONFIDENCE.HIGH]: 0.9,
  [CONFIDENCE.MEDIUM]: 0.6,
  [CONFIDENCE.LOW]: 0.3,
  [CONFIDENCE.NONE]: 0,
};

function describeField(field) {
  return {
    level: field.level,
    levelLabel: CONFIDENCE_LABELS[field.level] || CONFIDENCE_LABELS.none,
    evidence: field.evidence || null,
    note: field.note || null,
    detected: field.level !== CONFIDENCE.NONE,
    needsReview: field.level === CONFIDENCE.LOW || field.level === CONFIDENCE.NONE || field.ambiguous === true,
    ambiguous: field.ambiguous === true,
  };
}

/**
 * The merchant leads the categorisation input because the rest of a receipt is
 * full of incidental words ("total", "bill", "gst") that would otherwise vote
 * for the wrong category. Only the top of the receipt is used, because that is
 * where the shop identity and the summary lines are.
 */
function buildCategorisationInput(merchant, text) {
  const top = normaliseReceiptText(text)
    .split('\n')
    .filter((line) => line.length > 0)
    .slice(0, 6)
    .join(' ');
  const combined = merchant ? `${merchant} ${top}` : top;
  return combined.trim().slice(0, 300);
}

export function suggestCategoryFromReceipt(merchant, text) {
  const input = buildCategorisationInput(merchant, text);
  if (!input) return null;

  const suggestion = suggestCategory(input);
  if (!suggestion) return null;

  // The categoriser reports "Other" with a near-zero confidence when nothing
  // matched. That is not a detection, so it is passed through as undetected.
  if (suggestion.category === 'Other' && suggestion.confidence <= 0.25) {
    return {
      category: null,
      level: CONFIDENCE.NONE,
      evidence: null,
      note: 'No category keywords matched this receipt. Please choose a category.',
      engineReason: suggestion.reason,
    };
  }

  return {
    category: suggestion.category,
    level: suggestion.confidence >= 0.6 ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
    evidence: 'Matched receipt and merchant information',
    note: null,
    engineReason: suggestion.reason,
    matchedKeywords: suggestion.matchedKeywords,
  };
}

function parseFields(text) {
  const merchant = extractMerchant(text);
  const amount = extractTotalAmount(text);
  const date = extractReceiptDate(text);
  const paymentMethod = extractPaymentMethod(text);
  const category = suggestCategoryFromReceipt(merchant.value, text);

  const fields = {
    merchant: { ...describeField(merchant), value: merchant.value },
    amount: { ...describeField(amount), value: amount.value },
    date: { ...describeField(date), value: date.value },
    category: { ...describeField(category), category: category ? category.category : null },
    paymentMethod: {
      ...describeField(paymentMethod),
      method: paymentMethod.value,
      cardBrand: paymentMethod.cardBrand || null,
    },
  };

  // A value the existing engines produced that is not a real option would
  // silently break the review form, so it is discarded as undetected rather
  // than passed on.
  if (fields.category.detected && !CATEGORIES.includes(fields.category.category)) {
    fields.category = {
      ...fields.category,
      detected: false,
      level: CONFIDENCE.NONE,
      levelLabel: CONFIDENCE_LABELS.none,
      category: null,
      note: 'Suggested category was not a valid option. Please choose one.',
    };
  }
  if (fields.paymentMethod.detected && !PAYMENT_METHODS.includes(fields.paymentMethod.method)) {
    fields.paymentMethod = {
      ...fields.paymentMethod,
      detected: false,
      level: CONFIDENCE.NONE,
      levelLabel: CONFIDENCE_LABELS.none,
      method: null,
      note: 'Detected payment method was not a valid option. Please choose one.',
    };
  }

  return {
    merchant: fields.merchant.value,
    amount: fields.amount.value,
    date: fields.date.value,
    category: fields.category.category,
    paymentMethod: fields.paymentMethod.method,
    fields,
  };
}

function summariseConfidence(fields) {
  const scores = RECEIPT_FIELDS.map((key) => {
    const level = fields[key].level;
    return LEVEL_TO_SCORE[level] === undefined ? 0 : LEVEL_TO_SCORE[level];
  });
  const total = scores.reduce((sum, value) => sum + value, 0);
  return Math.round((total / RECEIPT_FIELDS.length) * 100) / 100;
}

function buildResult({ status, text, fields, warnings, engine, providerMethod, meanConfidence, errorCode }) {
  const quality = summariseDataQuality(fields);
  const truncated = typeof text === 'string' && text.length > MAX_RAW_TEXT_LENGTH;

  return {
    status,
    merchant: fields.merchant.value ?? null,
    amount: fields.amount.value ?? null,
    date: fields.date.value ?? null,
    category: fields.category.category ?? null,
    paymentMethod: fields.paymentMethod.method ?? null,
    rawText: typeof text === 'string' ? text.slice(0, MAX_RAW_TEXT_LENGTH) : '',
    rawTextTruncated: truncated,
    confidence: summariseConfidence(fields),
    quality,
    fields,
    warnings: warnings || [],
    engine: engine || null,
    providerMethod: providerMethod || null,
    meanConfidence: Number.isFinite(meanConfidence) ? meanConfidence : null,
    errorCode: errorCode || null,
  };
}

function emptyFields(reason) {
  const none = {
    level: CONFIDENCE.NONE,
    levelLabel: CONFIDENCE_LABELS.none,
    evidence: null,
    note: reason,
    detected: false,
    needsReview: true,
    ambiguous: false,
  };
  return {
    merchant: { ...none, value: null },
    amount: { ...none, value: null },
    date: { ...none, value: null },
    category: { ...none, category: null },
    paymentMethod: { ...none, method: null, cardBrand: null },
  };
}

function failureResult(status, errorCode, reason) {
  return buildResult({
    status,
    text: '',
    fields: emptyFields(reason),
    errorCode,
    warnings: reason ? [reason] : [],
  });
}

/**
 * Scans a receipt and returns a structured result. Never throws: failures come
 * back as a status the page can render.
 */
export async function scanReceipt(file, options = {}) {
  try {
    return await runScan(file, options);
  } catch (error) {
    // A caller should never have to wrap this call. Anything unforeseen - a
    // broken engine, a missing browser API - becomes a status it can render.
    return failureResult(
      SCAN_STATUS.FAILED,
      OCR_ERROR_CODES.FAILED,
      'This receipt could not be processed. You can try again or enter the expense manually.'
    );
  }
}

async function runScan(file, options = {}) {
  const { signal, onStage, onProgress } = options;

  const validation = validateReceiptFile(file, options);
  if (!validation.ok) {
    return {
      ...failureResult(SCAN_STATUS.INVALID, validation.code, validation.message),
      validationError: { code: validation.code, message: validation.message },
    };
  }

  const { kind } = validation;

  const ocr = await runReceiptOcr(file, { kind, signal, onStage, onProgress });

  if (!ocr.ok) {
    const status =
      ocr.code === OCR_ERROR_CODES.UNAVAILABLE
        ? SCAN_STATUS.UNAVAILABLE
        : ocr.code === OCR_ERROR_CODES.NO_TEXT
          ? SCAN_STATUS.NO_TEXT
          : ocr.code === OCR_ERROR_CODES.ABORTED
            ? SCAN_STATUS.FAILED
            : SCAN_STATUS.FAILED;

    return failureResult(
      status,
      ocr.code,
      ocr.code === OCR_ERROR_CODES.ABORTED ? OCR_ERROR_MESSAGES[ocr.code] : OCR_ERROR_MESSAGES[ocr.code]
    );
  }

  if (!isMeaningfulReceiptText(ocr.text)) {
    if (onStage) onStage(OCR_STAGES.FIELDS);
    return failureResult(
      SCAN_STATUS.NO_TEXT,
      OCR_ERROR_CODES.NO_TEXT,
      'No readable text was found in this file. A clearer or straighter photo usually works.'
    );
  }

  if (onStage) onStage(OCR_STAGES.FIELDS);
  const parsed = parseFields(ocr.text);
  const fields = parsed.fields;

  if (onStage) onStage(OCR_STAGES.PREPARE);

  const warnings = [];
  if (fields.date.detected && fields.date.note) warnings.push(fields.date.note);
  if (fields.amount.detected && fields.amount.note) warnings.push(fields.amount.note);
  if (fields.merchant.detected && fields.merchant.note) warnings.push(fields.merchant.note);
  if (fields.paymentMethod.detected && fields.paymentMethod.note) {
    warnings.push(fields.paymentMethod.note);
  } else if (!fields.paymentMethod.detected && fields.paymentMethod.cardBrand) {
    warnings.push(fields.paymentMethod.note);
  }

  return buildResult({
    status: SCAN_STATUS.OK,
    text: ocr.text,
    fields,
    warnings,
    engine: ocr.engine,
    providerMethod: ocr.method,
    meanConfidence: ocr.meanConfidence,
  });
}

/**
 * Turns a scan result into the editable values shown in the review form.
 *
 * A detected value is offered as-is. A value that was not detected is left
 * empty rather than guessed, except for the date, where today's date is
 * offered as an explicitly labelled suggestion.
 */
export function buildReceiptDraft(result, options = {}) {
  const today = options.today || todayISO();
  const fields = result && result.fields ? result.fields : emptyFields(null);
  const merchant = fields.merchant.detected ? result.merchant : '';
  const amount = fields.amount.detected && Number.isFinite(result.amount) ? String(result.amount) : '';
  const date = fields.date.detected ? result.date : today;
  const category = fields.category.detected && CATEGORIES.includes(result.category) ? result.category : '';
  const paymentMethod =
    fields.paymentMethod.detected && PAYMENT_METHODS.includes(result.paymentMethod) ? result.paymentMethod : '';

  const description = merchant ? `Receipt - ${merchant}` : 'Receipt expense';

  const notices = [];
  if (!fields.date.detected) {
    notices.push("Date not detected — using today's date as a suggestion. Please correct it if the receipt shows a different date.");
  }
  if (!fields.amount.detected) {
    notices.push('Amount not detected — enter the total from the receipt before saving.');
  }
  if (!fields.category.detected) {
    notices.push('Category not detected — please choose one before saving.');
  }
  if (!fields.paymentMethod.detected) {
    const brand = fields.paymentMethod.cardBrand;
    notices.push(
      brand
        ? `A ${brand} card appears on the receipt, but it does not say whether it is credit or debit. Please choose.`
        : 'Payment method not detected — please choose one before saving.'
    );
  }

  return {
    merchant,
    amount,
    category,
    date,
    paymentMethod,
    description,
    notices,
  };
}

export function describeScanStatus(result) {
  if (!result) return '';
  switch (result.status) {
    case SCAN_STATUS.OK:
      return 'Extracted from receipt';
    case SCAN_STATUS.NO_TEXT:
      return result.fields && result.fields.merchant.note
        ? result.fields.merchant.note
        : OCR_ERROR_MESSAGES[OCR_ERROR_CODES.NO_TEXT];
    case SCAN_STATUS.UNAVAILABLE:
      return OCR_ERROR_MESSAGES[OCR_ERROR_CODES.UNAVAILABLE];
    case SCAN_STATUS.INVALID:
      return (result.validationError && result.validationError.message) || OCR_ERROR_MESSAGES[OCR_ERROR_CODES.FAILED];
    default:
      return OCR_ERROR_MESSAGES[OCR_ERROR_CODES.FAILED];
  }
}
