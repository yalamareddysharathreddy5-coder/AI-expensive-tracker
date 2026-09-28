/**
 * Bridges a reviewed receipt draft to the existing expense system.
 *
 * Validation and construction are delegated to the same `validateExpense` and
 * `createExpense` helpers the manual Add Expense form uses, so a scanned
 * expense is byte-for-byte the same shape as a typed one and needs no new
 * storage key or migration.
 */

import { createExpense, validateExpense } from '../utils/expense';

export const RECEIPT_DESCRIPTION_FALLBACK = 'Receipt expense';

export function buildReceiptDescription(merchant, current) {
  if (typeof current === 'string' && current.trim().length > 0) {
    return current;
  }
  return merchant && merchant.trim().length > 0
    ? `Receipt - ${merchant.trim()}`
    : RECEIPT_DESCRIPTION_FALLBACK;
}

/**
 * Returns `{ ok: true, expense }` or `{ ok: false, errors }`. Never throws and
 * never writes anything: the caller decides whether to save.
 */
export function buildReceiptExpense(draft, options = {}) {
  const payload = {
    amount: draft.amount,
    category: draft.category,
    description: draft.description,
    date: draft.date,
    paymentMethod: draft.paymentMethod,
  };

  const errors = validateExpense(payload);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const expense = createExpense({
    ...payload,
    // The Step 8 categoriser produced this category, but only while the user
    // has left the suggestion alone. A manual choice is recorded as manual.
    categorySource: options.categorySource === 'ai' ? 'ai' : null,
  });

  return { ok: true, expense };
}
