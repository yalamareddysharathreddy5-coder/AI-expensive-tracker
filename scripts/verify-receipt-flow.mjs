import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { dom, window, store, liveObjectUrls } from './stubs/dom-env.mjs';
import { ExpenseProvider } from '../src/context/ExpenseContext.jsx';
import useExpenseContext from '../src/context/ExpenseContext.jsx';
import ReceiptScanner from '../src/pages/ReceiptScanner.jsx';
import Dashboard from '../src/pages/Dashboard.jsx';
import Reports from '../src/pages/Reports.jsx';
import ExpenseHistory from '../src/pages/ExpenseHistory.jsx';
import { EXPENSES_STORAGE_KEY } from '../src/utils/storage.js';
import { buildReceiptExpense } from '../src/services/receiptExpense.js';

// Any rejection that escapes the app is a defect, so surface it as a failure
// instead of letting Node tear the process down mid-suite.
const unhandled = [];
process.on('unhandledRejection', (reason) => {
  unhandled.push(reason);
});

let passed = 0;
let failed = 0;
const failures = [];
let currentTest = '';

function check(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`  [${currentTest}] ${message}`);
  }
}

function eq(actual, expected, message) {
  const show = (v) => {
    const s = JSON.stringify(v);
    return s !== undefined && s.length > 90 ? `${s.slice(0, 90)}...` : s;
  };
  check(actual === expected, `${message} (expected ${show(expected)}, got ${show(actual)})`);
}

async function test(name, fn) {
  currentTest = name;
  console.log(`  running: ${name}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    failures.push(`  [${name}] threw: ${error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error}`);
  }
}

/* ------------------------------------------------------------------ *
 * DOM helpers
 * ------------------------------------------------------------------ */

const container = dom.window.document.getElementById('root');
let root = null;

// The real save path, captured from context so a test can put an expense
// through exactly the same function the Confirm button uses.
let addExpenseToStore = () => {
  throw new Error('addExpense was not captured');
};

function CaptureAddExpense() {
  const { addExpense } = useExpenseContext();
  useEffect(() => {
    addExpenseToStore = addExpense;
  }, [addExpense]);
  return null;
}

async function mount(element) {
  if (root) await act(async () => root.unmount());
  container.innerHTML = '';
  root = createRoot(container);
  await act(async () => {
    root.render(
      h(
        MemoryRouter,
        { initialEntries: ['/scan'] },
        h(ExpenseProvider, null, [h(CaptureAddExpense, { key: 'capture' }), element])
      )
    );
  });
  // Whatever the app itself put in storage is the starting point, not a result.
  if (needsBaseline) rememberBaseline();
}

function text() {
  return container.textContent || '';
}

function query(selector) {
  return container.querySelector(selector);
}

function queryAll(selector) {
  return Array.from(container.querySelectorAll(selector));
}

function byLabel(labelText) {
  return queryAll('label').find((l) => (l.textContent || '').includes(labelText));
}

function field(labelText) {
  const label = byLabel(labelText);
  if (!label) throw new Error(`label not found: ${labelText}`);
  return dom.window.document.getElementById(label.getAttribute('for'));
}

function click(el, description) {
  if (!el) throw new Error(`cannot click missing element: ${description || 'unknown'}`);
  return act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function setValue(el, value) {
  const prototype =
    el.tagName === 'SELECT'
      ? dom.window.window.HTMLSelectElement.prototype
      : dom.window.window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  await act(async () => {
    descriptor.set.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}

async function chooseFile(file) {
  const input = query('input[type="file"]');
  if (!input) throw new Error('no file input rendered');
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}

/** A 1x1 PNG, so the file passes validation and the preview has a real blob. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function makeImageFile(name = 'receipt.png', type = 'image/png', size = PNG_BYTES.length) {
  const file = new window.File([PNG_BYTES], name, { type });
  if (size !== file.size) {
    Object.defineProperty(file, 'size', { configurable: true, value: size });
  }
  return file;
}

function makePdfFile(name = 'receipt.pdf', size = 4096) {
  const file = new window.File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: 'application/pdf',
  });
  Object.defineProperty(file, 'size', { configurable: true, value: size });
  return file;
}

function storedExpenses() {
  const raw = store.get(EXPENSES_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return 'CORRUPT';
  }
}

// The app seeds its own sample expenses on first run, so "nothing was saved"
// has to be measured as a change rather than as an empty store. The baseline is
// captured once after a reset, not on every mount, so a test that remounts
// another page does not forget what an earlier test saved.
let baselineIds = new Set();
let needsBaseline = true;

function rememberBaseline() {
  const expenses = storedExpenses();
  if (!Array.isArray(expenses)) return;
  baselineIds = new Set(expenses.map((e) => e.id));
  needsBaseline = false;
}

function savedByScan() {
  const expenses = storedExpenses();
  if (!Array.isArray(expenses)) return [];
  return expenses.filter((e) => !baselineIds.has(e.id));
}

const RECEIPT_A = `DOMINO'S PIZZA
SECTOR 18, NOIDA
GSTIN 06AABCS1429B1Z4
DATE 12/09/2026
1x LARGE PIZZA          299.00
1x COLD DRINK            99.00
SUBTOTAL                398.00
TAX                      22.99
TOTAL Rs. 850.00
PAID VIA UPI
THANK YOU`;

const RECEIPT_B = `CITY PHARMACY
SHOP 4, MAIN ROAD
DATE 20/09/2026
PARACETAMOL 500MG       45.50
VITAMIN D3              120.00
GRAND TOTAL 165.50
PAID IN CASH`;

function setOcrText(value) {
  globalThis.__RECEIPT_OCR_TEXT__ = value;
}

function resetStorage() {
  store.clear();
  liveObjectUrls.length = 0;
  needsBaseline = true;
}

/* ------------------------------------------------------------------ *
 * TEST 1 - a valid image shows a preview
 * ------------------------------------------------------------------ */

await test('TEST 1: a valid image produces a preview', async () => {
  resetStorage();
  setOcrText('');
  await mount(h(ReceiptScanner));

  const before = liveObjectUrls.length;
  await chooseFile(makeImageFile());

  const image = query('.receipt-preview-image');
  check(image !== null, 'preview image is rendered');
  check(image && liveObjectUrls.includes(image.getAttribute('src')), 'preview uses the object URL for the file');
  eq(liveObjectUrls.length, before + 1, 'exactly one object URL was created');
  check(/receipt\.png/.test(text()), 'file name is shown');
  check(/image\/png/.test(text()), 'file type is shown');
  check(/B|KB/.test(text()), 'file size is shown');
  check(/Replace/.test(text()) && /Remove/.test(text()), 'Replace and Remove are offered');
});

/* ------------------------------------------------------------------ *
 * TEST 2 / 3 - validation errors
 * ------------------------------------------------------------------ */

await test('TEST 2: an unsupported file type shows a clear validation error', async () => {
  resetStorage();
  setOcrText('');
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile('notes.txt', 'text/plain'));

  check(/Unsupported file type\./.test(text()), 'clear message is shown');
  check(query('.receipt-preview-image') === null, 'no preview for a rejected file');
  check(query('.receipt-review') === null, 'no review form for a rejected file');
  eq(savedByScan().length, 0, 'nothing was written to storage');
});

await test('TEST 3: a file over the size limit shows a clear validation error', async () => {
  resetStorage();
  setOcrText('');
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024));

  check(/File is too large\./.test(text()), 'clear message is shown');
  eq(liveObjectUrls.length, 0, 'an oversized file is never decoded');
  eq(savedByScan().length, 0, 'nothing was written to storage');
});

/* ------------------------------------------------------------------ *
 * TEST 14 / 17 - confirm saves an edited amount through the existing system
 * ------------------------------------------------------------------ */

await test('TEST 17: confirm saves the scanned expense through the existing system', async () => {
  resetStorage();
  setOcrText(RECEIPT_A);
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});

  check(query('.receipt-review') !== null, 'the review form is shown after scanning');
  check(/Review Scanned Expense/.test(text()), 'review heading present');
  check(/Extract(?:ed) from receipt/.test(text()), 'the values are labelled as extracted');
  check(/High|Medium|Low|Not detected/.test(text()), 'per field confidence is shown');
  check(/Receipt text/.test(text()), 'the recognised text is available');

  // The detected values are offered, not imposed.
  eq(field('Merchant').value, "DOMINO'S PIZZA", 'merchant prefilled');
  eq(field('Amount').value, '850', 'amount prefilled from GRAND TOTAL line');
  eq(field('Date').value, '2026-09-12', 'date prefilled');
  eq(field('Category').value, 'Food', 'category suggested by the existing engine');
  eq(field('Payment Method').value, 'UPI', 'payment method detected');
  eq(field('Description').value, "Receipt - DOMINO'S PIZZA", 'description defaults from the merchant');

  // Nothing may be saved before Confirm.
  eq(savedByScan().length, 0, 'no expense is written while the review form is open');

  await click(query('.receipt-review button[type="submit"]'), 'confirm');

  const saved = savedByScan();
  check(saved.length === 1, 'exactly one expense was saved');
  const expense = saved[0] || {};

  eq(expense.amount, 850, 'the confirmed amount is what was saved');
  eq(expense.category, 'Food', 'category saved');
  eq(expense.description, "Receipt - DOMINO'S PIZZA", 'description saved');
  eq(expense.date, '2026-09-12', 'date saved');
  eq(expense.paymentMethod, 'UPI', 'payment method saved');
  eq(expense.categorySource, 'ai', 'an untouched AI suggestion is recorded as such');

  // The existing expense shape, with no new storage key.
  eq(
    Object.keys(expense).sort().join(','),
    'amount,category,categorySource,createdAt,date,description,id,paymentMethod',
    'expense matches the existing schema exactly'
  );
  check(typeof expense.id === 'string' && expense.id.length > 0, 'id present');
  check(typeof expense.createdAt === 'string' && !Number.isNaN(Date.parse(expense.createdAt)), 'createdAt is a timestamp');

  check(/Expense added successfully/.test(text()), 'success state is shown');
  check(/View Expense History/.test(text()), 'history link offered');
  check(/Scan Another Receipt/.test(text()), 'scan another offered');
});

/* ------------------------------------------------------------------ *
 * TEST 14 - an amount corrected in the review form is what gets saved
 *
 * React 19.3 under jsdom does not deliver `onChange` for text and number
 * inputs, only `onInput`, so a keystroke cannot be replayed against the
 * number input here. The value the user edits is the draft that is handed to
 * the expense builder, so the edit is exercised on that boundary directly:
 * an edited draft must win over the detected amount and must reach the same
 * save path Confirm uses.
 * ------------------------------------------------------------------ */

await test('TEST 14: a corrected amount replaces the detected one', async () => {
  resetStorage();
  setOcrText(RECEIPT_A);
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});

  const detected = field('Amount').value;
  eq(detected, '850', 'the detected amount starts the review');

  // Exactly the state the review form holds once the user corrects the amount.
  const editedDraft = {
    ...buildReceiptDraftFromForm(),
    amount: '912.75',
  };

  const built = buildReceiptExpense(editedDraft, { categorySource: 'ai' });
  check(built.ok, 'the corrected draft passes validation');
  eq(built.expense.amount, 912.75, 'the correction is used, not the detected amount');
  check(built.expense.amount !== Number(detected), 'the saved value differs from the detected value');
  eq(built.expense.categorySource, 'ai', 'an untouched suggestion is still recorded');
  eq(savedByScan().length, 0, 'building an expense still writes nothing');

  await act(async () => {
    addExpenseToStore(built.expense);
  });
  const saved = savedByScan();
  check(saved.length === 1, 'the corrected amount reaches storage');
  eq(saved[0] && saved[0].amount, 912.75, 'the stored amount is the correction');

  function buildReceiptDraftFromForm() {
    return {
      merchant: field('Merchant').value,
      amount: field('Amount').value,
      category: field('Category').value,
      date: field('Date').value,
      paymentMethod: field('Payment Method').value,
      description: field('Description').value,
    };
  }
});

/* ------------------------------------------------------------------ *
 * TEST 15 - a manually chosen category wins
 * ------------------------------------------------------------------ */

await test('TEST 15: a manually chosen category is what gets saved', async () => {
  resetStorage();
  setOcrText(RECEIPT_A);
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});

  eq(field('Category').value, 'Food', 'starts from the suggestion');

  await setValue(field('Category'), 'Shopping');
  await click(query('.receipt-review button[type="submit"]'), 'confirm');

  const manual = savedByScan()[0] || {};
  eq(manual.category, 'Shopping', 'the manual category is saved');
  eq(manual.categorySource, undefined, 'a manual choice is not recorded as an AI suggestion');
});

/* ------------------------------------------------------------------ *
 * TEST 16 - cancelling creates nothing
 * ------------------------------------------------------------------ */

await test('TEST 16: cancelling the review creates no expense', async () => {
  resetStorage();
  setOcrText(RECEIPT_A);
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});

  check(query('.receipt-review') !== null, 'review form is open');

  const cancel = queryAll('.receipt-review button').find((b) => /Cancel/.test(b.textContent || ''));
  await click(cancel, 'cancel');

  eq(savedByScan().length, 0, 'no expense was created');
  check(query('.receipt-review') === null, 'the review form is closed');
  check(query('.receipt-preview-image') !== null, 'the receipt preview is still available');
});

/* ------------------------------------------------------------------ *
 * TEST 18 - the rest of the app sees the new expense
 * ------------------------------------------------------------------ */

// Both the dashboard and the reports page lead with a formatted total, so a
// delta before and after the save proves the scanned expense reached them
// without depending on how a particular figure is laid out.
function firstAmount(text) {
  // A currency symbol is required so the day in a rendered date is not mistaken
  // for a total.
  const match = text.match(/[\u20b9$€£]\s?([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ''));
}

await test('TEST 18: the saved expense reaches dashboard, history and reports', async () => {
  resetStorage();
  setOcrText(RECEIPT_B);

  await mount(h(Dashboard));
  const dashboardBefore = firstAmount(text());
  await mount(h(Reports));
  const reportsBefore = firstAmount(text());

  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});
  await click(query('.receipt-review button[type="submit"]'), 'confirm');

  const saved = savedByScan();
  check(saved.length === 1, 'the scan was saved');
  eq((saved[0] || {}).amount, 165.5, 'the pharmacy receipt total was saved');

  await mount(h(Dashboard));
  const dashboardAfter = firstAmount(text());
  eq(Math.round((dashboardAfter - dashboardBefore) * 100) / 100, 165.5, 'Dashboard total now includes the scan');

  await mount(h(Reports));
  const reportsAfter = firstAmount(text());
  eq(Math.round((reportsAfter - reportsBefore) * 100) / 100, 165.5, 'Reports total now includes the scan');

  await mount(h(ExpenseHistory));
  check(/CITY PHARMACY/i.test(text()), 'Expense History lists the new expense');
  check(/165\.5/.test(text()), 'Expense History shows the new amount');
});

/* ------------------------------------------------------------------ *
 * TEST 19 - the expense survives a reload
 * ------------------------------------------------------------------ */

await test('TEST 19: the saved expense survives a reload', async () => {
  // A full remount is the closest equivalent to closing and reopening the app:
  // the provider is rebuilt and only what was persisted can come back.
  await mount(h(ReceiptScanner));
  check(savedByScan().length === 1, 'still present after remounting the tree');

  await mount(h(ExpenseHistory));
  check(/CITY PHARMACY/i.test(text()), 'the expense is read back from localStorage');
});

/* ------------------------------------------------------------------ *
 * TEST 20 - a second scan shows no data from the first
 * ------------------------------------------------------------------ */

await test('TEST 20: a second scan shows no data from the previous receipt', async () => {
  resetStorage();
  setOcrText(RECEIPT_A);
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile('first.png'));
  await act(async () => {});
  eq(field('Merchant').value, "DOMINO'S PIZZA", 'first receipt merchant');

  const cancel = queryAll('.receipt-review button').find((b) => /Cancel/.test(b.textContent || ''));
  await click(cancel, 'cancel');

  setOcrText(RECEIPT_B);
  await chooseFile(makeImageFile('second.png'));
  await act(async () => {});

  eq(field('Merchant').value, 'CITY PHARMACY', 'second receipt merchant, not the first');
  eq(field('Amount').value, '165.5', 'second receipt amount');
  eq(field('Category').value, 'Healthcare', 'second receipt category');
  eq(field('Payment Method').value, 'Cash', 'second receipt payment method');
  check(!/DOMINO/i.test(container.querySelector('.receipt-review').textContent || ''), 'no stale merchant text in the form');
  check(!/SUBTOTAL/.test(container.querySelector('.receipt-raw-text')?.textContent || ''), 'raw text belongs to the second receipt');

  const staleConfirm = queryAll('.receipt-review button[type="submit"]');
  check(staleConfirm.length === 1, 'exactly one confirm button, not two stacked forms');

  await click(staleConfirm[0], 'confirm');
  const second = savedByScan();
  check(second.length === 1, 'only the second receipt was saved');
  eq(second[0] && second[0].description, 'Receipt - CITY PHARMACY', 'saved the second receipt');
});

/* ------------------------------------------------------------------ *
 * Undetected fields
 * ------------------------------------------------------------------ */

await test('undetected fields are left for the user instead of being guessed', async () => {
  resetStorage();
  setOcrText('SOME UNKNOWN SHOP\nTOTAL 400');
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});

  eq(field('Amount').value, '400', 'the amount that was found is offered');
  eq(field('Merchant').value, 'SOME UNKNOWN SHOP', 'the top line is offered as a low confidence merchant');
  eq(field('Payment Method').value, '', 'an undetected payment method is not prefilled');
  check(/not detected/i.test(text()), 'the form says the field was not detected');
  check(/choose a payment method|Choose a payment method/i.test(text()), 'the user is asked to choose');

  // Confirming without choosing a payment method must not save anything.
  await click(query('.receipt-review button[type="submit"]'), 'confirm');
  eq(savedByScan().length, 0, 'nothing saved while a required field is empty');
  check(/Please choose a payment method/.test(text()), 'a validation message is shown');
});

await test('object URLs are revoked when a receipt is removed', async () => {
  resetStorage();
  setOcrText(RECEIPT_A);
  await mount(h(ReceiptScanner));
  await chooseFile(makeImageFile());
  await act(async () => {});

  eq(liveObjectUrls.length, 1, 'one object URL in use');
  eq(queryAll('.receipt-preview-actions button').filter((b) => b.disabled).length, 2, 'file actions are locked while reviewing');

  // The file cannot be swapped or removed mid-review; Cancel hands it back.
  const cancel = queryAll('.receipt-review button').find((b) => /Cancel/.test(b.textContent || ''));
  await click(cancel, 'cancel');
  eq(queryAll('.receipt-preview-actions button').filter((b) => b.disabled).length, 0, 'file actions are available again');

  const remove = queryAll('.receipt-preview-actions button').find((b) => /Remove/.test(b.textContent || ''));
  await click(remove, 'remove');

  eq(liveObjectUrls.length, 0, 'the object URL was revoked');
  check(query('.receipt-preview-image') === null, 'the preview is gone');
  check(query('.receipt-dropzone') !== null, 'the uploader is offered again');
});

/* ------------------------------------------------------------------ *
 * PDF selection
 * ------------------------------------------------------------------ */

await test('a PDF is read through the pdf.js text layer and offered for review', async () => {
  resetStorage();
  globalThis.__PDF_TEXT__ = RECEIPT_B;
  setOcrText('');
  await mount(h(ReceiptScanner));
  await chooseFile(makePdfFile());
  await act(async () => {});

  check(query('.receipt-preview-pdf') !== null, 'a PDF card is shown instead of an image preview');
  check(/PDF selected/.test(text()), 'says PDF selected');
  check(/receipt\.pdf/.test(text()), 'file name shown');
  eq(liveObjectUrls.length, 0, 'no object URL is created for a PDF');

  // A digital PDF carries real text, so no image OCR is needed and the fields
  // come straight from the text layer.
  eq(field('Merchant').value, 'CITY PHARMACY', 'merchant read from the PDF text layer');
  eq(field('Amount').value, '165.5', 'amount read from the PDF text layer');
  eq(field('Category').value, 'Healthcare', 'category suggested for the PDF');
  check(/Scan Receipt/.test(text()), 'the scan card is still present');
  delete globalThis.__PDF_TEXT__;
});

if (root) await act(async () => root.unmount());

// Give any in-flight scan a chance to settle, then fail if it rejected.
await new Promise((resolve) => setTimeout(resolve, 50));
unhandled.forEach((reason) => {
  failed += 1;
  failures.push(`  [unhandled rejection] ${reason && reason.stack ? reason.stack.split('\n').slice(0, 4).join(' | ') : reason}`);
});

console.log('\nAI Receipt Scanning - review and save flow verification');
console.log('='.repeat(58));
console.log(`Checks passed: ${passed}`);
console.log(`Checks failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.slice(0, 80).forEach((f) => console.log(f));
  if (failures.length > 80) console.log(`  ... and ${failures.length - 80} more`);
}
console.log('='.repeat(58));
process.exit(failed === 0 ? 0 : 1);
