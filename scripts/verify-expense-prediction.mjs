import {
  predictExpenses,
  resolvePredictionPeriod,
  CONFIDENCE_LABELS,
} from '../src/utils/expensePrediction.js';

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
  check(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

function near(actual, expected, tolerance, message) {
  const ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
  check(ok, `${message} (expected ~${expected}, got ${actual})`);
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

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

let seq = 0;
function expense(amount, date, category = 'Food', extra = {}) {
  seq += 1;
  return {
    id: `test-expense-${seq}`,
    amount,
    category,
    description: `Test expense ${seq}`,
    paymentMethod: 'Cash',
    date,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

function walkFinite(value, path = 'result') {
  if (typeof value === 'number') {
    check(Number.isFinite(value), `${path} must be a finite number (got ${value})`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkFinite(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => walkFinite(child, `${path}.${key}`));
    return;
  }
  if (typeof value === 'string') {
    check(
      !value.includes('NaN') && !value.includes('Infinity') && !value.includes('undefined'),
      `${path} must not contain NaN/Infinity/undefined (got "${value}")`
    );
  }
}

const NOW = new Date(2026, 8, 18); // 18 September 2026, local
const NOW_ISO = '2026-09-18';
const NO_BUDGET = { monthly: null, categories: {} };
const BUDGET_25K = { monthly: 25000, categories: {} };
const predict = (expenses, budget = NO_BUDGET) =>
  predictExpenses(expenses, budget, { currency: '₹', now: NOW });

// ---------------------------------------------------------------------------
// TEST 1: No expenses
// ---------------------------------------------------------------------------
test('TEST 1 - no expenses yields no prediction', () => {
  const r = predict([]);
  eq(r.hasPrediction, false, 'hasPrediction should be false');
  eq(r.actualSpending.total, 0, 'actual total should be 0');
  eq(r.actualSpending.count, 0, 'count should be 0');
  eq(r.dailyPace.value, 0, 'daily pace should be 0');
  eq(r.projectedSpending.total, 0, 'projection should be 0');
  eq(r.categoryPredictions.length, 0, 'no category predictions');
  eq(r.observations.length, 0, 'no observations');
  eq(r.historical.hasEnough, false, 'no historical comparison');
  eq(r.budgetComparison.hasBudget, false, 'no budget comparison');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 2: One expense on the current date
// ---------------------------------------------------------------------------
test('TEST 2 - one expense on current date', () => {
  const r = predict([expense(1200, NOW_ISO)]);
  eq(r.hasPrediction, true, 'hasPrediction should be true');
  eq(r.actualSpending.total, 1200, 'actual total');
  eq(r.actualSpending.count, 1, 'count');
  near(r.dailyPace.value, 1200 / 18, 0.01, 'daily pace');
  near(r.projectedSpending.total, 2000, 0.01, 'projected month-end');
  eq(r.confidence.level, 'strong', 'day 18 with history is strong data quality');
  eq(r.limitedData, false, 'day 18 is not limited data');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 3: Multiple current-month expenses
// ---------------------------------------------------------------------------
test('TEST 3 - multiple current-month expenses', () => {
  const expenses = [];
  for (let day = 1; day <= 18; day += 1) expenses.push(expense(100, iso(2026, 9, day)));
  const r = predict(expenses);
  eq(r.hasPrediction, true, 'hasPrediction');
  eq(r.actualSpending.count, 18, 'count');
  eq(r.actualSpending.total, 1800, 'total');
  eq(r.actualSpending.activeDays, 18, 'active days');
  near(r.dailyPace.value, 100, 0.001, 'daily pace');
  near(r.projectedSpending.total, 3000, 0.001, 'projected');
  eq(r.projectedSpending.remainingAmount, 1200, 'remaining amount');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 4: Current month + previous month data -> historical comparison works
// ---------------------------------------------------------------------------
test('TEST 4 - historical comparison with previous month data', () => {
  const expenses = [
    expense(1000, '2026-09-05'),
    expense(800, '2026-09-10'),
    expense(5000, '2026-08-05'),
    expense(7000, '2026-07-05'),
  ];
  const r = predict(expenses);
  eq(r.historical.hasEnough, true, 'hasEnough should be true');
  eq(r.historical.monthsUsed, 2, 'two prior months with data');
  eq(r.historical.previousMonth, 5000, 'previous month total');
  eq(r.historical.averageMonthly, 6000, 'average monthly');
  near(r.projectedSpending.total, 3000, 0.01, 'projection');
  near(r.historical.difference, 3000 - 6000, 0.01, 'difference vs average');
  near(r.historical.differencePct, -50, 0.01, 'difference pct');
  check(
    r.observations.some((o) => o.id === 'prediction-historical'),
    'historical observation should exist'
  );
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 5: Current month data but no previous months -> no misleading comparison
// ---------------------------------------------------------------------------
test('TEST 5 - no previous months means no historical comparison', () => {
  const r = predict([expense(1000, '2026-09-05'), expense(500, '2026-09-12')]);
  eq(r.historical.hasEnough, false, 'hasEnough should be false');
  eq(r.historical.difference, null, 'difference should be null');
  eq(r.historical.differencePct, null, 'differencePct should be null');
  eq(r.historical.averageMonthly, 0, 'average should be 0');
  check(
    !r.observations.some((o) => o.id === 'prediction-historical'),
    'no historical observation should be emitted'
  );
  check(typeof r.historical.message === 'string', 'should expose a message');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 6: Monthly budget exists -> projection compared with budget
// ---------------------------------------------------------------------------
test('TEST 6 - projection compared with monthly budget', () => {
  const expenses = [];
  for (let day = 1; day <= 18; day += 1) expenses.push(expense(700, iso(2026, 9, day)));
  const r = predict(expenses, BUDGET_25K); // 18 * 700 = 12600, pace 700, projected 21000
  eq(r.budgetComparison.hasBudget, true, 'hasBudget');
  eq(r.budgetComparison.monthly, 25000, 'monthly budget');
  eq(r.budgetComparison.actual, 12600, 'actual');
  near(r.budgetComparison.usedPct, 50.4, 0.01, 'used pct');
  eq(r.budgetComparison.remaining, 12400, 'remaining');
  near(r.projectedSpending.total, 21000, 0.01, 'projected');
  near(r.budgetComparison.projectedRemaining, 4000, 0.01, 'projected remaining');
  near(r.budgetComparison.projectedPctOfBudget, 84, 0.01, 'projected pct of budget');
  check(
    r.budgetComparison.message.includes('below the monthly budget'),
    `message should say below, got: ${r.budgetComparison.message}`
  );
  check(
    r.budgetComparison.message.includes('4,000'),
    `message should include the gap, got: ${r.budgetComparison.message}`
  );
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 7: No monthly budget -> prediction still works
// ---------------------------------------------------------------------------
test('TEST 7 - prediction works without a budget', () => {
  const r = predict([expense(600, '2026-09-02'), expense(400, '2026-09-09')], { monthly: null });
  eq(r.hasPrediction, true, 'hasPrediction');
  near(r.projectedSpending.total, (1000 / 18) * 30, 0.01, 'projection still computed');
  eq(r.budgetComparison.hasBudget, false, 'no budget comparison');
  eq(r.remainingCapacity.perDay, null, 'no remaining budget per day');
  check(
    r.budgetComparison.message === 'Set a monthly budget to compare your projection against a target.',
    `expected prompt message, got: ${r.budgetComparison.message}`
  );
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 8: Spending already exceeds budget
// ---------------------------------------------------------------------------
test('TEST 8 - already over budget keeps comparison accurate', () => {
  const expenses = [];
  for (let day = 1; day <= 18; day += 1) expenses.push(expense(2000, iso(2026, 9, day)));
  const r = predict(expenses, BUDGET_25K); // 36000 actual vs 25000 budget
  eq(r.budgetComparison.hasBudget, true, 'hasBudget');
  eq(r.budgetComparison.actual, 36000, 'actual exceeds budget');
  near(r.budgetComparison.usedPct, 144, 0.01, 'used pct over 100');
  near(r.budgetComparison.remaining, -11000, 0.01, 'remaining is negative');
  near(r.projectedSpending.total, 60000, 0.01, 'projection');
  near(r.budgetComparison.projectedRemaining, -35000, 0.01, 'projected remaining negative');
  check(
    r.budgetComparison.message.includes('above the monthly budget'),
    `message should say above, got: ${r.budgetComparison.message}`
  );
  eq(r.remainingCapacity.perDay, null, 'no per-day capacity when already over budget');
  const budgetObs = r.observations.find((o) => o.id === 'prediction-budget');
  check(budgetObs && budgetObs.priority === 'warning', 'over-budget observation is a warning');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 9: Very small current-month data -> limited state
// ---------------------------------------------------------------------------
test('TEST 9 - very small data yields limited data quality', () => {
  const r = predictExpenses([expense(900, '2026-09-01')], BUDGET_25K, {
    currency: '₹',
    now: new Date(2026, 8, 3),
  });
  eq(r.confidence.level, 'limited', 'confidence limited');
  eq(r.confidence.label, CONFIDENCE_LABELS.limited, 'confidence label');
  eq(r.limitedData, true, 'limitedData flag');
  check(
    r.observations.some((o) => o.id === 'prediction-limited-data'),
    'limited data observation should exist'
  );
  check(typeof r.confidence.reason === 'string' && r.confidence.reason.length > 0, 'has reason');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 10: Multiple categories -> category projections
// ---------------------------------------------------------------------------
test('TEST 10 - category projections across multiple categories', () => {
  const expenses = [
    expense(4000, '2026-09-10', 'Food'),
    expense(2000, '2026-09-12', 'Transportation'),
    expense(1000, '2026-09-14', 'Bills'),
    expense(500, '2026-09-16', 'Travel'),
  ];
  const r = predict(expenses);
  eq(r.categoryPredictions.length, 4, 'four category predictions');
  eq(r.categoryPredictions[0].category, 'Food', 'sorted by projected descending');
  near(r.categoryPredictions[0].actual, 4000, 0.01, 'Food actual');
  near(r.categoryPredictions[0].dailyPace, 4000 / 18, 0.01, 'Food daily pace');
  near(r.categoryPredictions[0].projected, (4000 / 18) * 30, 0.01, 'Food projected');
  near(r.categoryPredictions[1].projected, (2000 / 18) * 30, 0.01, 'Transportation projected');
  const shareSum = r.categoryPredictions.reduce(
    (sum, c) => sum + c.percentageOfProjectedTotal,
    0
  );
  near(shareSum, 100, 0.05, 'category shares sum to 100%');
  check(
    !r.categoryPredictions.some((c) => c.category === 'Healthcare'),
    'categories with no evidence are excluded'
  );
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 11: Future-dated expense must not inflate pace
// ---------------------------------------------------------------------------
test('TEST 11 - future-dated expenses excluded from current pace', () => {
  const withFuture = predict([
    expense(1000, '2026-09-10'),
    expense(90000, '2026-09-25'),
  ]);
  const withoutFuture = predict([expense(1000, '2026-09-10')]);

  eq(withFuture.actualSpending.total, 1000, 'future expense excluded from actual total');
  eq(withFuture.actualSpending.count, 1, 'future expense excluded from count');
  eq(withFuture.actualSpending.futureCount, 1, 'future expense counted separately');
  eq(withFuture.actualSpending.futureTotal, 90000, 'future total reported');
  near(
    withFuture.dailyPace.value,
    withoutFuture.dailyPace.value,
    0.0001,
    'daily pace must not be inflated by future expenses'
  );
  near(
    withFuture.projectedSpending.total,
    withoutFuture.projectedSpending.total,
    0.0001,
    'projection must not be inflated by future expenses'
  );
  check(
    withFuture.observations.some((o) => o.id === 'prediction-future-dated'),
    'future-dated observation should exist'
  );
  walkFinite(withFuture);
});

test('TEST 11b - a future expense dated today is counted', () => {
  const r = predict([expense(500, NOW_ISO), expense(70000, '2026-09-19')]);
  eq(r.actualSpending.futureCount, 1, 'tomorrow is future');
  eq(r.actualSpending.total, 500, 'today is not future');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 12: Malformed localStorage data
// ---------------------------------------------------------------------------
test('TEST 12 - malformed expense data does not crash', () => {
  const malformed = [
    null,
    undefined,
    'not-an-object',
    42,
    {},
    { id: 'x' },
    { id: 'y', amount: 'abc', date: '2026-09-10' },
    { id: 'z', amount: null, date: '2026-09-10' },
    { id: 'w', amount: -500, date: '2026-09-10' },
    { id: 'v', amount: 100, date: '2026-9-1' },
    { id: 'u', amount: 100, date: '15/09/2026' },
    { id: 't', amount: 100, date: '2026-13-45' },
    { id: 's', amount: 100, date: '' },
    { id: 'r', amount: 100, date: null },
    { id: 'q', amount: 100, date: 20260910 },
    { id: 'p', amount: 100, date: '2026-09-10', category: null },
    { id: 'o', amount: 100, date: '2026-09-10', description: undefined },
    expense(1000, '2026-09-10'),
  ];
  let r;
  try {
    r = predict(malformed);
  } catch (error) {
    check(false, `predictExpenses threw: ${error && error.message}`);
    return;
  }
  check(true, 'predictExpenses did not throw');

  // Invalid dates and unusable amounts are dropped. A null amount is coerced to
  // zero by the shared sanitizeExpenses helper, matching every other page, and
  // still counts as a recorded transaction of zero value.
  eq(r.actualSpending.count, 4, 'null amount, null category and missing description are kept as zero/unknown');
  eq(r.actualSpending.total, 1200, 'unusable amounts contribute nothing, usable amounts add up');
  eq(r.actualSpending.futureCount, 0, 'none of the malformed records are future-dated');
  walkFinite(r);
});

test('TEST 12b - non-array expenses input is handled', () => {
  [null, undefined, 'x', 5, {}].forEach((input) => {
    let r;
    try {
      r = predictExpenses(input, NO_BUDGET, { currency: '₹', now: NOW });
      eq(r.hasPrediction, false, `no prediction for ${JSON.stringify(input)}`);
      walkFinite(r);
    } catch (error) {
      check(false, `threw for ${JSON.stringify(input)}: ${error && error.message}`);
    }
  });
});

// ---------------------------------------------------------------------------
// TEST 13: Invalid dates
// ---------------------------------------------------------------------------
test('TEST 13 - invalid dates handled safely', () => {
  const r = predict([
    expense(1000, '2026-02-30'),
    expense(1000, '2026-09-10'),
  ]);
  eq(r.actualSpending.count, 1, 'impossible date rejected, valid date kept');
  eq(r.actualSpending.total, 1000, 'total from valid record only');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 14: Zero / invalid amounts
// ---------------------------------------------------------------------------
test('TEST 14 - zero and invalid amounts produce no NaN', () => {
  const r = predict([
    expense(0, '2026-09-01'),
    expense(0, '2026-09-02'),
    expense(1000, '2026-09-03'),
  ]);
  eq(r.actualSpending.count, 3, 'zero-amount records still count as transactions');
  eq(r.actualSpending.total, 1000, 'zero amounts add nothing');
  near(r.dailyPace.value, 1000 / 18, 0.01, 'pace is finite');
  walkFinite(r);
});

test('TEST 14b - all-zero current month does not divide by zero', () => {
  const r = predict([expense(0, '2026-09-01')]);
  eq(r.hasPrediction, true, 'record exists');
  eq(r.dailyPace.value, 0, 'pace is 0');
  eq(r.projectedSpending.total, 0, 'projection is 0');
  eq(r.categoryPredictions.length, 0, 'no category predictions without positive spend');
  walkFinite(r);
});

test('TEST 14c - first day of the month', () => {
  const r = predictExpenses([expense(500, '2026-09-01')], BUDGET_25K, {
    currency: '₹',
    now: new Date(2026, 8, 1),
  });
  eq(r.period.elapsedDays, 1, 'elapsed days on the first of the month');
  near(r.dailyPace.value, 500, 0.001, 'pace on day one');
  near(r.projectedSpending.total, 500 * 30, 0.001, 'projection on day one');
  eq(r.confidence.level, 'limited', 'day one is limited data');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 15: January
// ---------------------------------------------------------------------------
test('TEST 15 - January boundaries', () => {
  const now = new Date(2026, 0, 15); // 15 Jan 2026 -> 31 days
  const p = resolvePredictionPeriod(now);
  eq(p.key, '2026-01', 'month key');
  eq(p.daysInMonth, 31, 'January has 31 days');
  eq(p.elapsedDays, 15, 'elapsed days');
  eq(p.remainingDays, 16, 'remaining days');
  eq(p.startDate, '2026-01-01', 'first day');
  eq(p.endDate, '2026-01-31', 'last day');

  const r = predictExpenses([expense(300, '2026-01-05'), expense(300, '2026-01-10')], NO_BUDGET, {
    currency: '₹',
    now,
  });
  near(r.dailyPace.value, 600 / 15, 0.01, 'January pace');
  near(r.projectedSpending.total, (600 / 15) * 31, 0.01, 'January projection uses 31 days');
  eq(r.historical.previousKey, '2025-12', 'previous month crosses the year boundary');
  walkFinite(r);
});

// ---------------------------------------------------------------------------
// TEST 16: February in a leap year
// ---------------------------------------------------------------------------
test('TEST 16 - February in a leap year has 29 days', () => {
  const leap = new Date(2028, 1, 15);
  const lp = resolvePredictionPeriod(leap);
  eq(lp.daysInMonth, 29, 'leap February has 29 days');
  eq(lp.endDate, '2028-02-29', 'leap year end date');
  eq(lp.remainingDays, 14, 'remaining days');

  const lr = predictExpenses([expense(290, '2028-02-01')], NO_BUDGET, {
    currency: '₹',
    now: leap,
  });
  near(lr.projectedSpending.total, (290 / 15) * 29, 0.01, 'leap February projection');

  const nonLeap = resolvePredictionPeriod(new Date(2027, 1, 15));
  eq(nonLeap.daysInMonth, 28, 'non-leap February has 28 days');
  const nr = predictExpenses([expense(280, '2027-02-01')], NO_BUDGET, {
    currency: '₹',
    now: new Date(2027, 1, 15),
  });
  near(nr.projectedSpending.total, (280 / 15) * 28, 0.01, 'non-leap February projection');
  walkFinite(nr);
});

// ---------------------------------------------------------------------------
// TEST 17: December / year boundary
// ---------------------------------------------------------------------------
test('TEST 17 - December and year boundaries', () => {
  const now = new Date(2026, 11, 20);
  const p = resolvePredictionPeriod(now);
  eq(p.key, '2026-12', 'month key');
  eq(p.daysInMonth, 31, 'December has 31 days');
  eq(p.endDate, '2026-12-31', 'December end date');

  const r = predictExpenses([expense(1000, '2026-12-20'), expense(2000, '2026-11-10')], NO_BUDGET, {
    currency: '₹',
    now,
  });
  eq(r.historical.previousKey, '2026-11', 'previous month is November');
  eq(r.historical.previousMonth, 2000, 'previous month total');
  eq(r.historical.monthsUsed, 1, 'one prior month');
  near(r.projectedSpending.total, (1000 / 20) * 31, 0.01, 'December projection');
  walkFinite(r);

  const janNext = resolvePredictionPeriod(new Date(2027, 0, 1));
  eq(janNext.key, '2027-01', 'January 2027 key');
  const crossYear = predictExpenses(
    [expense(500, '2027-01-01'), expense(4000, '2026-12-15')],
    NO_BUDGET,
    { currency: '₹', now: new Date(2027, 0, 1) }
  );
  eq(crossYear.historical.previousKey, '2026-12', 'previous month crosses into last year');
  eq(crossYear.historical.previousMonth, 4000, 'previous month total across year boundary');
  walkFinite(crossYear);
});

// ---------------------------------------------------------------------------
// TEST 18: Adding an expense updates the prediction
// ---------------------------------------------------------------------------
test('TEST 18 - adding an expense updates the prediction', () => {
  const before = predict([expense(1000, '2026-09-10')]);
  const after = predict([expense(1000, '2026-09-10'), expense(1000, '2026-09-12')]);
  eq(before.actualSpending.total, 1000, 'total before');
  eq(after.actualSpending.total, 2000, 'total after');
  eq(after.actualSpending.count, 2, 'count after');
  check(
    after.projectedSpending.total > before.projectedSpending.total,
    'projection increases after adding an expense'
  );
  walkFinite(after);
});

// ---------------------------------------------------------------------------
// TEST 19: Deleting an expense updates the prediction
// ---------------------------------------------------------------------------
test('TEST 19 - deleting an expense updates the prediction', () => {
  const list = [expense(1000, '2026-09-10'), expense(1000, '2026-09-12')];
  const before = predict(list);
  const after = predict(list.slice(0, 1));
  eq(before.actualSpending.count, 2, 'count before delete');
  eq(after.actualSpending.count, 1, 'count after delete');
  eq(after.actualSpending.total, 1000, 'total after delete');
  check(
    after.projectedSpending.total < before.projectedSpending.total,
    'projection decreases after deleting an expense'
  );
  walkFinite(after);
});

// ---------------------------------------------------------------------------
// TEST 20: Source data is never mutated
// ---------------------------------------------------------------------------
test('TEST 20 - original expense array is not mutated', () => {
  const expenses = [
    expense(4000, '2026-09-10', 'Food'),
    expense(2000, '2026-09-12', 'Transportation'),
    expense(1000, '2026-08-05', 'Bills'),
  ];
  const snapshot = JSON.stringify(expenses);
  const result = predict(expenses, BUDGET_25K);
  eq(JSON.stringify(expenses), snapshot, 'expense array unchanged');
  result.categoryPredictions.forEach((c) => check(typeof c === 'object', 'prediction entries are objects'));
  check(Array.isArray(result.categoryPredictions), 'categoryPredictions is a new array');
  check(result.categoryPredictions !== expenses, 'categoryPredictions is not the input');
  walkFinite(result);
});

test('TEST 20b - observations are unique and well formed', () => {
  const expenses = [];
  for (let day = 1; day <= 18; day += 1) {
    expenses.push(expense(300, iso(2026, 9, day), ['Food', 'Bills', 'Travel'][day % 3]));
  }
  expenses.push(expense(5000, '2026-08-04', 'Food'));
  expenses.push(expense(4000, '2026-07-04', 'Food'));
  expenses.push(expense(3000, '2026-06-04', 'Food'));
  expenses.push(expense(2000, '2026-05-04', 'Food'));

  const r = predict(expenses, BUDGET_25K);
  const ids = r.observations.map((o) => o.id);
  eq(new Set(ids).size, ids.length, 'observation ids must be unique');

  r.observations.forEach((o) => {
    check(typeof o.id === 'string' && o.id.length > 0, 'observation has an id');
    check(
      ['pace', 'projection', 'budget', 'category', 'historical'].includes(o.type),
      `observation type "${o.type}" is valid`
    );
    check(
      ['info', 'warning', 'positive'].includes(o.priority),
      `observation priority "${o.priority}" is valid`
    );
    check(typeof o.title === 'string' && o.title.length > 0, 'observation has a title');
    check(typeof o.description === 'string' && o.description.length > 0, 'observation has a description');
    check(typeof o.metric === 'string' && o.metric.length > 0, 'observation has a metric');
  });

  const banned = /\b(you should|you must|we recommend|guaranteed|will definitely)\b/i;
  r.observations.forEach((o) => {
    check(!banned.test(`${o.title} ${o.description}`), `observation "${o.id}" avoids judgmental or absolute language`);
  });
  check(
    !banned.test(r.explanation.summary),
    'explanation avoids judgmental or absolute language'
  );
  check(
    r.explanation.note.toLowerCase().includes('not a guaranteed'),
    'explanation states it is not guaranteed'
  );
  walkFinite(r);
});

test('TEST 21 - confidence levels respond to data volume', () => {
  const byDay = (day) =>
    predictExpenses([expense(100, '2026-09-01')], NO_BUDGET, {
      currency: '₹',
      now: new Date(2026, 8, day),
    });

  eq(byDay(3).confidence.level, 'limited', 'day 3 is limited');
  eq(byDay(7).confidence.level, 'moderate', 'day 7 is moderate');
  eq(byDay(14).confidence.level, 'moderate', 'day 14 is moderate');
  eq(byDay(15).confidence.level, 'strong', 'day 15 is strong');
  eq(byDay(30).confidence.level, 'strong', 'day 30 is strong');
  eq(byDay(30).period.remainingDays, 0, 'last day has no remaining days');
  eq(byDay(30).projectedSpending.finalDay, true, 'final day flag');
  near(byDay(30).projectedSpending.total, byDay(30).actualSpending.total, 0.01, 'last day projection equals actual');
  walkFinite(byDay(30));
});

test('TEST 22 - historical months upgrade data quality', () => {
  const base = [expense(100, '2026-09-01')];
  const withHistory = [
    ...base,
    expense(500, '2026-08-02'),
    expense(500, '2026-07-02'),
    expense(500, '2026-06-02'),
  ];
  const alone = predictExpenses(base, NO_BUDGET, { currency: '₹', now: new Date(2026, 8, 3) });
  const helped = predictExpenses(withHistory, NO_BUDGET, { currency: '₹', now: new Date(2026, 8, 3) });
  eq(alone.confidence.level, 'limited', 'without history day 3 is limited');
  eq(helped.confidence.level, 'moderate', 'with 3 prior months day 3 upgrades to moderate');
  check(
    helped.confidence.reason.includes('previous months of history'),
    `reason mentions history, got: ${helped.confidence.reason}`
  );
  walkFinite(helped);
});

test('TEST 23 - remaining budget per day capacity', () => {
  const r = predictExpenses([expense(12000, '2026-09-18')], { monthly: 22000, categories: {} }, {
    currency: '₹',
    now: NOW,
  });
  // 12000 spent, 22000 budget, 10000 left, 12 days remaining
  eq(r.remainingCapacity.remaining, 10000, 'remaining budget');
  eq(r.remainingCapacity.remainingDays, 12, 'remaining days');
  near(r.remainingCapacity.perDay, 10000 / 12, 0.01, 'remaining budget per day');
  check(
    r.observations.some((o) => o.id === 'prediction-capacity'),
    'capacity observation should exist'
  );
  walkFinite(r);
});

test('TEST 24 - category predictions fold unknown categories into Other', () => {
  const r = predict([
    expense(500, '2026-09-05', 'NotARealCategory'),
    { id: 'no-cat', amount: 500, date: '2026-09-06', paymentMethod: 'Cash' },
  ]);
  eq(r.categoryPredictions.length, 1, 'a single Other bucket');
  eq(r.categoryPredictions[0].category, 'Other', 'unknown and missing categories fold to Other');
  near(r.categoryPredictions[0].actual, 1000, 0.01, 'Other total');
  walkFinite(r);
});

test('TEST 24b - a real category is not folded into Other', () => {
  const r = predict([
    expense(500, '2026-09-05', 'Food'),
    expense(500, '2026-09-06', 'Bills'),
  ]);
  eq(r.categoryPredictions.length, 2, 'two real categories');
  eq(r.categoryPredictions[0].category, 'Food', 'Food present');
  eq(r.categoryPredictions[1].category, 'Bills', 'Bills present');
  walkFinite(r);
});

test('TEST 25 - zero-amount and budget edge cases', () => {
  const r = predict([expense(1000, '2026-09-10')], { monthly: 0, categories: {} });
  eq(r.budgetComparison.hasBudget, false, 'zero budget is not a budget');
  eq(r.budgetComparison.monthly, null, 'monthly is null');

  const badBudget = predict([expense(1000, '2026-09-10')], { monthly: 'abc', categories: {} });
  eq(badBudget.budgetComparison.hasBudget, false, 'non-numeric budget is not a budget');

  const noBudgetArg = predict([expense(1000, '2026-09-10')], undefined);
  eq(noBudgetArg.budgetComparison.hasBudget, false, 'undefined budget is not a budget');
  eq(noBudgetArg.hasPrediction, true, 'prediction still works');

  const exactBudget = predictExpenses([expense(25000, '2026-09-30')], { monthly: 25000 }, {
    currency: '₹',
    now: new Date(2026, 8, 30),
  });
  near(exactBudget.projectedSpending.total, 25000, 0.01, 'on the final day the projection equals actual');
  near(exactBudget.budgetComparison.projectedRemaining, 0, 0.01, 'landing exactly on budget is zero difference');
  check(
    exactBudget.budgetComparison.message.includes('below the monthly budget'),
    'landing exactly on budget reads as not above budget'
  );
  walkFinite(exactBudget);
});

test('TEST 26 - currency option is respected', () => {
  const r = predictExpenses([expense(1000, '2026-09-10')], BUDGET_25K, {
    currency: '$',
    now: NOW,
  });
  eq(r.currency, '$', 'currency echoed');
  check(r.budgetComparison.message.includes('$'), `message uses currency, got: ${r.budgetComparison.message}`);
  check(r.observations.every((o) => !JSON.stringify(o).includes('₹')), 'no stray rupee symbols');

  const fallback = predictExpenses([expense(1000, '2026-09-10')], BUDGET_25K, { now: NOW });
  eq(fallback.currency, '₹', 'default currency');
  walkFinite(fallback);
});

test('TEST 27 - the full result shape is present', () => {
  const r = predict([expense(1000, '2026-09-10')], BUDGET_25K);
  [
    'period',
    'actualSpending',
    'dailyPace',
    'projectedSpending',
    'budgetComparison',
    'remainingCapacity',
    'categoryPredictions',
    'historical',
    'confidence',
    'explanation',
    'observations',
  ].forEach((key) => check(r[key] !== undefined, `result exposes "${key}"`));

  ['key', 'label', 'daysInMonth', 'elapsedDays', 'remainingDays', 'startDate', 'endDate'].forEach((key) =>
    check(r.period[key] !== undefined, `period exposes "${key}"`)
  );
  check(typeof r.explanation.summary === 'string', 'explanation has a summary');
  check(Array.isArray(r.explanation.steps) && r.explanation.steps.length > 0, 'explanation has steps');
  check(typeof r.explanation.formula === 'string', 'explanation has a formula');
  check(r.projectedSpending.basis === 'Based on current spending pace', 'projection is labelled as a pace basis');
});

console.log('\nAI Expense Prediction - engine verification');
console.log('='.repeat(52));
console.log(`Checks passed: ${passed}`);
console.log(`Checks failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(f));
}
console.log('='.repeat(52));
process.exit(failed === 0 ? 0 : 1);
