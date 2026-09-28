import {
  CONFIDENCE,
  DATA_QUALITY_LABELS,
  extractMerchant,
  extractPaymentMethod,
  extractReceiptDate,
  extractTotalAmount,
  isMeaningfulReceiptText,
  parseAmountToken,
  summariseDataQuality,
} from '../src/services/receiptFieldParser.js';
import {
  MAX_RECEIPT_BYTES,
  detectReceiptKind,
  formatFileSize,
  validateReceiptFile,
} from '../src/services/receiptFileValidation.js';
import {
  SCAN_STATUS,
  buildReceiptDraft,
  describeScanStatus,
  suggestCategoryFromReceipt,
} from '../src/services/receiptScanner.js';
import { CATEGORIES, PAYMENT_METHODS } from '../src/data/constants.js';

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
  check(actual === expected, `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function test(name, fn) {
  currentTest = name;
  try {
    fn();
  } catch (error) {
    failed += 1;
    failures.push(`  [${name}] threw: ${error && error.message}`);
  }
}

function fakeFile(name, type, size) {
  return { name, type, size };
}

/* ------------------------------------------------------------------ *
 * TEST 2 / 3 - file validation
 * ------------------------------------------------------------------ */

test('TEST 2: unsupported file type is rejected with a clear message', () => {
  const result = validateReceiptFile(fakeFile('notes.txt', 'text/plain', 1200));
  eq(result.ok, false, 'text file rejected');
  eq(result.code, 'UNSUPPORTED_TYPE', 'code');
  eq(result.message, 'Unsupported file type.', 'message');

  const gif = validateReceiptFile(fakeFile('receipt.gif', 'image/gif', 4000));
  eq(gif.ok, false, 'gif rejected');
  eq(gif.code, 'UNSUPPORTED_TYPE', 'gif code');
});

test('TEST 3: a file over the size limit is rejected with a clear message', () => {
  const over = validateReceiptFile(fakeFile('big.jpg', 'image/jpeg', MAX_RECEIPT_BYTES + 1));
  eq(over.ok, false, 'oversized rejected');
  eq(over.code, 'TOO_LARGE', 'code');
  eq(over.message, 'File is too large.', 'message');

  const exact = validateReceiptFile(fakeFile('edge.jpg', 'image/jpeg', MAX_RECEIPT_BYTES));
  eq(exact.ok, true, 'exactly at the limit is accepted');

  const custom = validateReceiptFile(fakeFile('small.jpg', 'image/jpeg', 2048), { maxBytes: 1024 });
  eq(custom.code, 'TOO_LARGE', 'custom limit honoured');
});

test('TEST 1: a valid receipt image is accepted and classified as an image', () => {
  ['image/jpeg', 'image/png', 'image/webp'].forEach((type) => {
    const result = validateReceiptFile(fakeFile('receipt', type, 2048));
    eq(result.ok, true, `${type} accepted`);
    eq(result.kind, 'image', `${type} classified as image`);
  });

  const pdf = validateReceiptFile(fakeFile('receipt.pdf', 'application/pdf', 4096));
  eq(pdf.ok, true, 'pdf accepted');
  eq(pdf.kind, 'pdf', 'pdf classified as pdf');
});

test('file validation handles empty, malformed and extension-only inputs', () => {
  eq(validateReceiptFile(fakeFile('empty.jpg', 'image/jpeg', 0)).code, 'EMPTY', 'zero byte file');
  eq(validateReceiptFile(null).code, 'NOT_A_FILE', 'null file');
  eq(validateReceiptFile(undefined).code, 'NOT_A_FILE', 'undefined file');
  eq(validateReceiptFile({}).code, 'NOT_A_FILE', 'object with no name');
  // A File-like object with a name but no reported size must not crash.
  eq(validateReceiptFile({ name: 'x.jpg' }).ok, true, 'name-only object is still classified');

  // Some platforms report an empty MIME type; the extension is the fallback.
  eq(detectReceiptKind({ name: 'scan.PNG', type: '' }), 'image', 'extension fallback, uppercase');
  eq(detectReceiptKind({ name: 'scan', type: 'image/webp' }), 'image', 'no extension but valid type');
  eq(detectReceiptKind({ name: 'scan.exe', type: 'application/octet-stream' }), null, 'executable rejected');
});

test('file sizes are formatted for display', () => {
  eq(formatFileSize(0), '0 B', 'zero');
  eq(formatFileSize(512), '512 B', 'bytes');
  eq(formatFileSize(2048), '2 KB', 'kilobytes');
  eq(formatFileSize(5 * 1024 * 1024), '5.0 MB', 'megabytes');
  eq(formatFileSize(-1), 'Unknown size', 'negative');
  eq(formatFileSize('nope'), 'Unknown size', 'non numeric');
});

/* ------------------------------------------------------------------ *
 * TEST 4 / 5 / 11 / 12 - amounts
 * ------------------------------------------------------------------ */

test('TEST 4: TOTAL with a rupee symbol yields 850', () => {
  const result = extractTotalAmount('DOMINO\'S PIZZA\nTOTAL ₹850');
  eq(result.value, 850, 'amount');
  check(result.level !== CONFIDENCE.NONE, 'detected');
  check(result.evidence.includes('TOTAL'), 'evidence names the label');
});

test('TEST 5: GRAND TOTAL 1250.00 yields 1250', () => {
  const result = extractTotalAmount('SUPERMART\nSUBTOTAL 1000.00\nTAX 250.00\nGRAND TOTAL 1250.00');
  eq(result.value, 1250, 'amount');
  check(result.level === CONFIDENCE.HIGH, `confidence should be high, got ${result.level}`);
});

test('TEST 11: the parser prefers TOTAL over item prices and SUBTOTAL', () => {
  const text = [
    'SHOPPING MALL',
    'Item A            1,299.00',
    'Item B              450.50',
    'SUBTOTAL           1,749.50',
    'DISCOUNT           -200.00',
    'TOTAL              1,549.50',
  ].join('\n');
  const result = extractTotalAmount(text);
  eq(result.value, 1549.5, 'picks the labelled TOTAL, not the largest number');
  eq(result.evidence.split(' ')[0], 'TOTAL', 'label recorded');

  const withGrand = `${text}\nGRAND TOTAL 1,549.50`;
  eq(extractTotalAmount(withGrand).value, 1549.5, 'GRAND TOTAL still wins');

  const grandOnly = 'STORE\nItem A 900.00\nGRAND TOTAL 2500.00';
  eq(extractTotalAmount(grandOnly).value, 2500, 'GRAND TOTAL beats a larger item line');
});

test('TEST 12: a receipt with no labelled total reports not detected', () => {
  const result = extractTotalAmount('CAFE\nCoffee 120\nSandwich 180\nThank you');
  eq(result.value, null, 'no amount invented');
  eq(result.level, CONFIDENCE.NONE, 'level is none');
  check(typeof result.note === 'string' && result.note.length > 0, 'explains why');
});

test('amount parsing accepts the common printed currency formats', () => {
  const cases = [
    ['TOTAL 850.00', 850],
    ['TOTAL Rs. 850', 850],
    ['TOTAL Rs 850.50', 850.5],
    ['TOTAL INR 1,250.50', 1250.5],
    ['TOTAL 1,250', 1250],
    ['TOTAL ₹1,25,450.75', 125450.75],
    ['TOTAL 850,00', 850],
    ['TOTAL: 850', 850],
    ['TOTAL   . 850', 850],
  ];
  cases.forEach(([line, expected]) => {
    eq(extractTotalAmount(`SHOP\n${line}`).value, expected, `format "${line}"`);
  });
});

test('amount parsing rejects non-money numbers and zero totals', () => {
  eq(extractTotalAmount('SHOP\nTOTAL 0').value, null, 'zero total rejected');
  eq(extractTotalAmount('SHOP\nTOTAL -50').value, null, 'negative total rejected');
  eq(extractTotalAmount('SHOP\nINVOICE 1234567890\nTOTAL 0.00').value, null, 'invoice number is not a total');
  eq(extractTotalAmount('').level, CONFIDENCE.NONE, 'empty text');
  eq(extractTotalAmount(null).level, CONFIDENCE.NONE, 'null text');
  eq(extractTotalAmount(undefined).level, CONFIDENCE.NONE, 'undefined text');
});

test('amount parsing ignores label-like words that are not totals', () => {
  eq(extractTotalAmount('SHOP\nTOTAL GST 45.00\nTOTAL TAX 90.00').value, null, 'TOTAL GST is not a total');
  eq(extractTotalAmount('SHOP\nTOTAL SAVINGS 200.00\nTOTAL 900.00').value, 900, 'TOTAL SAVINGS ignored, real TOTAL used');
  eq(extractTotalAmount('SHOP\nTOTAL ITEMS 4\nTOTAL 640.00').value, 640, 'TOTAL ITEMS ignored');
});

test('amount parsing handles a total printed on the line below the label', () => {
  const result = extractTotalAmount('SHOP\nTOTAL\n1,299.00\nTHANK YOU');
  eq(result.value, 1299, 'amount found on the following line');
});

test('parseAmountToken is defensive', () => {
  eq(parseAmountToken('1,250.50'), 1250.5, 'comma thousands');
  eq(parseAmountToken('1.250,50'), 1250.5, 'european decimal comma');
  eq(parseAmountToken('abc'), null, 'letters only');
  eq(parseAmountToken(''), null, 'empty');
  eq(parseAmountToken(null), null, 'null');
  eq(parseAmountToken('-'), null, 'bare minus');
});

/* ------------------------------------------------------------------ *
 * TEST 6 - dates
 * ------------------------------------------------------------------ */

test('TEST 6: 12/09/2026 is detected as a date candidate', () => {
  const result = extractReceiptDate('DOMINO\'S PIZZA\nDATE 12/09/2026\nTOTAL 850');
  eq(result.value, '2026-09-12', 'read as the Indian DD/MM/YYYY order');
  check(result.detected !== false, 'detected');
  check(result.level !== CONFIDENCE.NONE, 'has a confidence level');
});

test('dates are read unambiguously when a component exceeds 12', () => {
  eq(extractReceiptDate('SHOP\n25/12/2025').value, '2025-12-25', '25 cannot be a month');
  eq(extractReceiptDate('SHOP\n12/25/2025').value, '2025-12-25', '25 cannot be a day');
  eq(extractReceiptDate('SHOP\n2026-03-09').value, '2026-03-09', 'ISO order');
  eq(extractReceiptDate('SHOP\n09-03-2026').value, '2026-03-09', 'DD-MM-YYYY');
  eq(extractReceiptDate('SHOP\n12 Sep 2026').value, '2026-09-12', 'day month name');
  eq(extractReceiptDate('SHOP\nSep 12, 2026').value, '2026-09-12', 'month day name');
  eq(extractReceiptDate('SHOP\n12/09/26').value, '2026-09-12', 'two digit year');
});

test('an ambiguous day/month order is flagged rather than presented as certain', () => {
  const result = extractReceiptDate('SHOP\nDATE 05/06/2026');
  eq(result.value, '2026-06-05', 'still offers a value for review');
  eq(result.ambiguous, true, 'flagged ambiguous');
  check(typeof result.note === 'string' && /confirm/i.test(result.note), 'asks the user to confirm');
});

test('expiry and validity dates are not mistaken for the purchase date', () => {
  eq(extractReceiptDate('CARD\nVALID UNTIL 12/2030\nDATE 05/06/2026').value, '2026-06-05', 'expiry line ignored');
  eq(extractReceiptDate('SHOP\nEXPIRY 12/09/2026').level, CONFIDENCE.NONE, 'expiry only is not a date');
  eq(extractReceiptDate('SHOP\nUSE BY 12/09/2026').level, CONFIDENCE.NONE, 'use by only is not a date');
  eq(extractReceiptDate('SHOP\nINVOICE NO 12/09/2026').level, CONFIDENCE.NONE, 'invoice number is not a date');
  eq(extractReceiptDate('SHOP\nBATCH 12/09/2026').level, CONFIDENCE.NONE, 'batch code is not a date');
});

test('impossible and far-future dates are rejected', () => {
  eq(extractReceiptDate('SHOP\nDATE 31/02/2026').level, CONFIDENCE.NONE, '31 February');
  eq(extractReceiptDate('SHOP\nDATE 00/09/2026').level, CONFIDENCE.NONE, 'day zero');
  eq(extractReceiptDate('SHOP\nDATE 13/13/2026').level, CONFIDENCE.NONE, 'both parts invalid');
  eq(extractReceiptDate('SHOP\nDATE 12/09/2099').level, CONFIDENCE.NONE, 'far future year');
  eq(extractReceiptDate('').level, CONFIDENCE.NONE, 'empty text');
});

test('a US style MM/DD date is read when the day cannot be a month', () => {
  const result = extractReceiptDate('SHOP\nDATE 12/25/2026');
  eq(result.value, '2026-12-25', '25 forces month-first');
  eq(result.ambiguous, false, 'not ambiguous');
});

/* ------------------------------------------------------------------ *
 * TEST 7 / 8 - payment method
 * ------------------------------------------------------------------ */

test('TEST 7: UPI is detected as the payment method', () => {
  const result = extractPaymentMethod('SHOP\nPAID VIA UPI\nREF 12345\nTOTAL 850');
  eq(result.value, 'UPI', 'payment method');
  check(PAYMENT_METHODS.includes(result.value), 'is a valid option for the form');
  check(result.level === CONFIDENCE.HIGH, 'high confidence on an explicit keyword');
});

test('TEST 8: a VISA receipt is not falsely split into credit or debit', () => {
  const result = extractPaymentMethod('SHOP\nVISA **** 1234\nTOTAL 850');
  eq(result.value, null, 'no credit/debit claim is made');
  check(result.cardBrand === 'visa', `card brand captured, got ${result.cardBrand}`);
  eq(result.level, CONFIDENCE.LOW, 'low confidence');
  check(result.ambiguous, 'flagged as needing a decision');
  check(/credit or debit/i.test(result.note), 'explains the choice is not determinable');
});

test('payment method is read when the receipt states credit or debit', () => {
  eq(extractPaymentMethod('SHOP\nDEBIT CARD **** 1').value, 'Debit Card', 'explicit debit');
  eq(extractPaymentMethod('SHOP\nCREDIT CARD **** 1').value, 'Credit Card', 'explicit credit');
  eq(extractPaymentMethod('SHOP\nPAID IN CASH').value, 'Cash', 'cash');
  eq(extractPaymentMethod('SHOP\nNEFT TRANSFER').value, 'Bank Transfer', 'neft');
  eq(extractPaymentMethod('SHOP\nRTGS').value, 'Bank Transfer', 'rtgs');
  eq(extractPaymentMethod('SHOP\nGoogle Pay').value, 'UPI', 'gpay is upi');
  eq(extractPaymentMethod('SHOP\nPhonePe').value, 'UPI', 'phonepe is upi');
});

test('a UPI payment with cash change is read as UPI', () => {
  const result = extractPaymentMethod('SHOP\nPAID BY UPI\nCASH TENDER 500\nCHANGE 120\nTOTAL 380');
  eq(result.value, 'UPI', 'digital method wins over the cash-change line');
  check(typeof result.note === 'string' && /Cash/i.test(result.note), 'mentions the competing evidence');
});

test('payment method is not detected when the receipt is silent', () => {
  const result = extractPaymentMethod('SHOP\nTOTAL 850');
  eq(result.value, null, 'no guess');
  eq(result.level, CONFIDENCE.NONE, 'none');
  eq(result.cardBrand, null, 'no brand');
  eq(extractPaymentMethod('').level, CONFIDENCE.NONE, 'empty text');
});

/* ------------------------------------------------------------------ *
 * TEST 9 / 10 - category through the existing engine
 * ------------------------------------------------------------------ */

test('TEST 9: a Domino\'s receipt suggests Food through the existing engine', () => {
  const result = suggestCategoryFromReceipt("DOMINO'S PIZZA", "DOMINO'S PIZZA\n1x Large Pizza 250\nTOTAL 850");
  eq(result.category, 'Food', 'category');
  check(CATEGORIES.includes(result.category), 'is a valid category option');
  check(result.level !== CONFIDENCE.NONE, 'has a confidence level');
  check(/receipt|merchant/i.test(result.evidence), 'evidence explains the basis');
});

test('TEST 10: an Uber receipt suggests Transportation through the existing engine', () => {
  const result = suggestCategoryFromReceipt('UBER', 'UBER TRIP\nFare 450\nTOTAL 450');
  eq(result.category, 'Transportation', 'category');
  check(CATEGORIES.includes(result.category), 'is a valid category option');
});

test('known merchants map to the categories the existing engine already defines', () => {
  // These are merchant names the Step 8 categoriser already knows about. The
  // scanner reuses that table rather than keeping a list of its own.
  const cases = [
    ['SWIGGY ORDER', 'Food'],
    ['ZOMATO', 'Food'],
    ['AMAZON.IN', 'Shopping'],
    ['FLIPKART', 'Shopping'],
    ['NETFLIX', 'Entertainment'],
    ['APOLLO PHARMACY', 'Healthcare'],
    ['CITY PHARMACY', 'Healthcare'],
    ['UBER', 'Transportation'],
    ['SHELL PETROL', 'Transportation'],
    ['FLIGHT BOOKING', 'Travel'],
  ];
  cases.forEach(([merchant, expected]) => {
    eq(suggestCategoryFromReceipt(merchant, `${merchant}\nTOTAL 100`).category, expected, merchant);
  });
});

test('a receipt with no recognisable merchant does not force a category', () => {
  const result = suggestCategoryFromReceipt(null, 'ITEM 1  10.00\nITEM 2  20.00\nTOTAL 30.00');
  eq(result.category, null, 'no category invented');
  eq(result.level, CONFIDENCE.NONE, 'reported as not detected');
  check(/choose a category/i.test(result.note), 'asks the user to choose');
  eq(suggestCategoryFromReceipt('', ''), null, 'no text at all');
});

/* ------------------------------------------------------------------ *
 * Merchant
 * ------------------------------------------------------------------ */

test('merchant is read from the top of the receipt', () => {
  const result = extractMerchant("DOMINO'S PIZZA\nSECTOR 18\nGSTIN 06AABCS1234\nTOTAL 850");
  check(/DOMINO/i.test(result.value), `merchant detected, got ${result.value}`);
  eq(result.level, CONFIDENCE.HIGH, 'known merchant is high confidence');
  check(result.matchedKeyword !== null, 'records the matched keyword');
});

test('document headers and codes are not mistaken for a merchant', () => {
  const result = extractMerchant('TAX INVOICE\nGSTIN: 29ABCDE1234F1Z5\nTOTAL 850');
  eq(result.value, null, 'no merchant read from header noise');
  eq(result.level, CONFIDENCE.NONE, 'reported as not detected');
});

test('merchant extraction is defensive', () => {
  eq(extractMerchant('').level, CONFIDENCE.NONE, 'empty');
  eq(extractMerchant(null).level, CONFIDENCE.NONE, 'null');
  eq(extractMerchant(undefined).level, CONFIDENCE.NONE, 'undefined');
  eq(extractMerchant('1234567890123\n9876543210').value, null, 'numbers only');
});

/* ------------------------------------------------------------------ *
 * TEST 13 - unreadable input
 * ------------------------------------------------------------------ */

test('TEST 13: unreadable or empty OCR text is detected as not meaningful', () => {
  eq(isMeaningfulReceiptText(''), false, 'empty');
  eq(isMeaningfulReceiptText('   '), false, 'whitespace only');
  eq(isMeaningfulReceiptText('12345678901234567890'), false, 'digits only');
  eq(isMeaningfulReceiptText('...'), false, 'punctuation only');
  eq(isMeaningfulReceiptText('ab'), false, 'too short');
  eq(isMeaningfulReceiptText('TOTAL 850'), true, 'a minimal but real receipt is meaningful');
});

/* ------------------------------------------------------------------ *
 * Quality summary
 * ------------------------------------------------------------------ */

test('data quality reflects how many fields were actually detected', () => {
  const strong = summariseDataQuality({
    merchant: { level: CONFIDENCE.HIGH },
    amount: { level: CONFIDENCE.HIGH },
    date: { level: CONFIDENCE.HIGH },
    paymentMethod: { level: CONFIDENCE.HIGH },
  });
  eq(strong.quality, 'high', 'all detected is high');
  eq(DATA_QUALITY_LABELS[strong.quality], 'High', 'label');

  const limited = summariseDataQuality({
    merchant: { level: CONFIDENCE.NONE },
    amount: { level: CONFIDENCE.MEDIUM },
    date: { level: CONFIDENCE.NONE },
    paymentMethod: { level: CONFIDENCE.NONE },
  });
  eq(limited.quality, 'limited', 'one field only is limited');

  const medium = summariseDataQuality({
    merchant: { level: CONFIDENCE.MEDIUM },
    amount: { level: CONFIDENCE.MEDIUM },
    date: { level: CONFIDENCE.NONE },
    paymentMethod: { level: CONFIDENCE.NONE },
  });
  eq(medium.quality, 'medium', 'two fields is medium');
  eq(summariseDataQuality({}).quality, 'limited', 'no fields at all');
});

/* ------------------------------------------------------------------ *
 * Review draft
 * ------------------------------------------------------------------ */

function resultWith(fields) {
  const none = {
    level: CONFIDENCE.NONE,
    levelLabel: 'Not detected',
    evidence: null,
    note: 'nothing detected',
    detected: false,
    needsReview: true,
    ambiguous: false,
  };
  const fieldsMap = {
    merchant: { ...none, value: null },
    amount: { ...none, value: null },
    date: { ...none, value: null },
    category: { ...none, category: null },
    paymentMethod: { ...none, method: null, cardBrand: null },
  };

  const values = {
    merchant: { value: null },
    amount: { value: null },
    date: { value: null },
    category: { category: null },
    paymentMethod: { method: null, cardBrand: null },
  };

  Object.keys(fields).forEach((key) => {
    const spec = fields[key];
    if (spec.value !== undefined) {
      fieldsMap[key] = { ...fieldsMap[key], level: CONFIDENCE.HIGH, levelLabel: 'High', detected: true, needsReview: false, value: spec.value };
      values[key].value = spec.value;
    }
    if (spec.category !== undefined) {
      fieldsMap[key] = { ...fieldsMap[key], level: CONFIDENCE.HIGH, levelLabel: 'High', detected: true, needsReview: false, category: spec.category };
      values[key].category = spec.category;
    }
    if (spec.method !== undefined) {
      fieldsMap[key] = { ...fieldsMap[key], level: CONFIDENCE.HIGH, levelLabel: 'High', detected: true, needsReview: false, method: spec.method };
      values[key].method = spec.method;
    }
  });

  return {
    status: SCAN_STATUS.OK,
    merchant: values.merchant.value,
    amount: values.amount.value,
    date: values.date.value,
    category: values.category.category,
    paymentMethod: values.paymentMethod.method,
    fields: fieldsMap,
  };
}

test('a detected field is offered to the review form as read', () => {
  const result = resultWith({
    merchant: { value: "DOMINO'S PIZZA" },
    amount: { value: 850 },
    date: { value: '2026-09-12' },
    category: { category: 'Food' },
    paymentMethod: { method: 'UPI' },
  });
  const draft = buildReceiptDraft(result, { today: '2026-09-28' });
  eq(draft.merchant, "DOMINO'S PIZZA", 'merchant');
  eq(draft.amount, '850', 'amount is a string for the input');
  eq(draft.date, '2026-09-12', 'date');
  eq(draft.category, 'Food', 'category');
  eq(draft.paymentMethod, 'UPI', 'payment method');
  eq(draft.description, "Receipt - DOMINO'S PIZZA", 'description defaults from the merchant');
  eq(draft.notices.length, 0, 'nothing to warn about');
});

test('undetected fields are left empty instead of being guessed', () => {
  const result = resultWith({ amount: { value: 850 } });
  const draft = buildReceiptDraft(result, { today: '2026-09-28' });

  eq(draft.merchant, '', 'merchant left empty');
  eq(draft.category, '', 'category left empty');
  eq(draft.paymentMethod, '', 'payment method left empty');
  eq(draft.description, 'Receipt expense', 'generic description when no merchant');

  // The date is the one field offered as a labelled suggestion.
  eq(draft.date, '2026-09-28', 'date falls back to today');
  check(
    draft.notices.some((n) => /Date not detected.*using today/i.test(n)),
    'the date fallback is explicitly labelled'
  );
  check(draft.notices.some((n) => /Amount not detected/i.test(n) === false), 'detected amount raises no notice');
  check(draft.notices.some((n) => /Category not detected/i.test(n)), 'category notice');
  check(draft.notices.some((n) => /Payment method not detected/i.test(n)), 'payment notice');
});

test('a card brand without a credit/debit statement prompts for the choice', () => {
  const result = resultWith({ merchant: { value: 'SHOP' }, amount: { value: 850 } });
  result.fields.paymentMethod = {
    ...result.fields.paymentMethod,
    cardBrand: 'visa',
    note: 'A card was used, but the receipt does not say whether it is credit or debit. Please choose.',
  };
  const draft = buildReceiptDraft(result, { today: '2026-09-28' });
  eq(draft.paymentMethod, '', 'not pre-filled');
  check(draft.notices.some((n) => /visa/i.test(n)), 'mentions the detected brand');
  check(draft.notices.some((n) => /credit or debit/i.test(n)), 'explains the choice is open');
});

test('scan status descriptions are honest and non-empty', () => {
  check(describeScanStatus({ status: SCAN_STATUS.OK }).length > 0, 'ok');
  check(/manual/i.test(describeScanStatus({ status: SCAN_STATUS.UNAVAILABLE })), 'unavailable offers a way forward');
  check(describeScanStatus({ status: SCAN_STATUS.NO_TEXT }).length > 0, 'no text');
  eq(describeScanStatus(null), '', 'no result');
});

console.log('\nAI Receipt Scanning - parsing and validation verification');
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
