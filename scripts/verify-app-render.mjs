import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ExpenseProvider } from '../src/context/ExpenseContext.jsx';
import { generateSampleExpenses } from '../src/data/sampleData.js';
import { predictExpenses } from '../src/utils/expensePrediction.js';
import Dashboard from '../src/pages/Dashboard.jsx';
import AddExpense from '../src/pages/AddExpense.jsx';
import ExpenseHistory from '../src/pages/ExpenseHistory.jsx';
import Budget from '../src/pages/Budget.jsx';
import AIInsights from '../src/pages/AIInsights.jsx';
import SpendingAnalysis from '../src/pages/SpendingAnalysis.jsx';
import ExpensePrediction from '../src/pages/ExpensePrediction.jsx';
import Reports from '../src/pages/Reports.jsx';
import Settings from '../src/pages/Settings.jsx';
import ReceiptScanner from '../src/pages/ReceiptScanner.jsx';
import App from '../src/App.jsx';

let passed = 0;
let failed = 0;
const failures = [];
let current = '';

// React reports key warnings, invalid props and hook misuse through
// console.error, so they are captured and failed like any other check.
const reactWarnings = [];
const realConsoleError = console.error.bind(console);
const realConsoleWarn = console.warn.bind(console);
console.error = (...args) => {
  reactWarnings.push(`[${current}] error: ${args.map(String).join(' ')}`);
};
console.warn = (...args) => {
  reactWarnings.push(`[${current}] warn: ${args.map(String).join(' ')}`);
};

function check(condition, message) {
  if (condition) passed += 1;
  else {
    failed += 1;
    failures.push(`  [${current}] ${message}`);
  }
}

function test(name, fn) {
  current = name;
  try {
    fn();
  } catch (error) {
    failed += 1;
    failures.push(`  [${name}] threw: ${error && error.stack ? error.stack.split('\n')[0] : error}`);
  }
}

// In-memory localStorage so the real useLocalStorage hook works under Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

// Minimal DOM surface so App.jsx can mount its BrowserRouter under Node.
// BrowserRouter builds a real URL, so window.location must be a URL instance.
const location = new URL('http://localhost/');
globalThis.document = {
  documentElement: { setAttribute() {}, getAttribute: () => null },
  baseURI: location.href,
  querySelector: () => null,
  createElement: () => ({ style: {}, setAttribute() {} }),
  addEventListener() {},
  removeEventListener() {},
};
globalThis.window = {
  location,
  history: {
    length: 1,
    state: null,
    pushState() {},
    replaceState() {},
    go() {},
    back() {},
    forward() {},
  },
  addEventListener() {},
  removeEventListener() {},
  navigator: { userAgent: 'node' },
};
globalThis.window.document = globalThis.document;
globalThis.document.defaultView = globalThis.window;
// Node 24 exposes a read-only `navigator`, so redefine instead of assigning.
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node' },
  configurable: true,
  writable: true,
});

function seed(records) {
  store.clear();
  store.set('ai_expenses', JSON.stringify(records));
}

function renderRoute(element) {
  return renderToStaticMarkup(
    h(MemoryRouter, { initialEntries: ['/'] }, h(ExpenseProvider, null, element))
  );
}

const PAGES = [
  ['Dashboard', Dashboard],
  ['AddExpense', AddExpense],
  ['ExpenseHistory', ExpenseHistory],
  ['Budget', Budget],
  ['AIInsights', AIInsights],
  ['SpendingAnalysis', SpendingAnalysis],
  ['ExpensePrediction', ExpensePrediction],
  ['Reports', Reports],
  ['Settings', Settings],
  ['ReceiptScanner', ReceiptScanner],
];

function assertNoBadNumbers(html, label) {
  ['NaN', 'Infinity', 'undefined'].forEach((token) => {
    check(!html.includes(token), `${label} must not render "${token}"`);
  });
}

function allPages(label) {
  PAGES.forEach(([name, Page]) => {
    let html = '';
    try {
      html = renderRoute(h(Page));
    } catch (error) {
      check(false, `${label}: ${name} failed to render: ${error && error.message}`);
      return;
    }
    check(html.length > 200, `${label}: ${name} rendered substantial output`);
    assertNoBadNumbers(html, `${label}: ${name}`);
  });
}

const sample = generateSampleExpenses();

// ---------------------------------------------------------------------------
test('every page renders with the default sample data', () => {
  seed(sample);
  allPages('sample data');
});

test('every page renders with no expenses at all', () => {
  seed([]);
  allPages('no expenses');
});

test('every page renders with a monthly budget set', () => {
  seed(sample);
  store.set('ai_monthly_budget', '25000');
  store.set(
    'ai_category_budgets',
    JSON.stringify({ Food: 8000, Bills: 4000, Transportation: 3000 })
  );
  allPages('with budget');
});

test('every page renders with zero monthly budget', () => {
  seed(sample);
  store.set('ai_monthly_budget', '0');
  allPages('zero budget');
});

test('every page renders with only future-dated expenses', () => {
  const future = new Date();
  future.setMonth(future.getMonth() + 2);
  const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-15`;
  seed([
    { id: 'f1', amount: 5000, category: 'Food', description: 'Future', paymentMethod: 'Cash', date: iso },
  ]);
  allPages('future only');
});

test('every page renders with malformed localStorage records', () => {
  seed([
    null,
    'garbage',
    { id: 'm1' },
    { id: 'm2', amount: 'abc', date: 'not-a-date' },
    { id: 'm3', amount: 100, date: '2026-02-30' },
    { id: 'm4', amount: -900, date: '2026-09-10', category: 'Food' },
    { id: 'm5', amount: 750, date: '2026-09-10', category: 'Food', description: 'ok', paymentMethod: 'UPI' },
  ]);
  allPages('malformed records');
});

test('every page renders with a single tiny current-month expense', () => {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  seed([
    { id: 't1', amount: 120, category: 'Food', description: 'Coffee', paymentMethod: 'Cash', date: iso },
  ]);
  allPages('tiny data');
});

test('every page renders with malformed settings in localStorage', () => {
  seed(sample);
  store.set('expense-tracker.settings', JSON.stringify({ name: 'Test' }));
  allPages('partial settings');
});
test('the full App router renders every route', () => {
  seed(sample);
  store.set('ai_monthly_budget', '25000');
  const routes = ['/', '/add', '/scan', '/history', '/budget', '/insights', '/analysis', '/prediction', '/reports', '/settings', '/nonsense'];

  routes.forEach((route) => {
    // App owns its own ExpenseProvider and BrowserRouter, so the route is
    // selected by pointing window.location at it rather than nesting a Router.
    globalThis.window.location.pathname = route;    let html = '';
    try {
      html = renderToStaticMarkup(h(App));
    } catch (error) {
      check(false, `App at ${route} failed: ${error && error.message}`);
      return;
    }
    check(html.length > 200, `App at ${route} rendered`);
    assertNoBadNumbers(html, `App at ${route}`);
  });
});

// ---------------------------------------------------------------------------
// Receipt scanner
// ---------------------------------------------------------------------------
test('scanner page shows the uploader, its limits and the local privacy note', () => {
  seed(sample);
  const html = renderRoute(h(ReceiptScanner));

  check(html.includes('Receipt Scanner'), 'page title present');
  check(html.includes('Scan Receipt'), 'scanner card heading present');
  check(html.includes('Upload a receipt image or PDF'), 'dropzone instruction present');
  check(html.includes('Choose File'), 'a keyboard reachable file control is offered');
  check(html.includes('JPG, JPEG, PNG, WEBP, PDF'), 'accepted formats are stated');
  check(html.includes('10 MB'), 'the size limit is stated');
  check(html.includes('Read on this device'), 'local processing is stated');
  check(html.includes('No receipt is uploaded to a server'), 'no upload claim present');
  check(html.includes('/add'), 'offers manual entry instead');
  check(!html.includes('Review Scanned Expense'), 'no review form before a file is chosen');
  check(!html.includes('Expense added successfully'), 'no success state before a file is chosen');
  assertNoBadNumbers(html, 'scanner page');
});

test('scanner page saves nothing on its own', () => {
  seed([]);
  const before = store.get('ai_expenses');
  renderRoute(h(ReceiptScanner));
  check(store.get('ai_expenses') === before, 'rendering the scanner does not write expenses');
});

// ---------------------------------------------------------------------------
// Page content expectations
// ---------------------------------------------------------------------------
test('prediction page shows the required summary values', () => {
  seed(sample);
  store.set('ai_monthly_budget', '25000');
  const html = renderRoute(h(ExpensePrediction));

  check(html.includes('AI Expense Prediction'), 'page title present');
  check(html.includes('Actual Spending'), 'actual spending card present');
  check(html.includes('Current Daily Pace'), 'daily pace card present');
  check(html.includes('Projected Month-End'), 'projected card present');
  check(html.includes('Days Remaining'), 'days remaining card present');
  check(html.includes('Monthly Budget'), 'budget card present');
  check(html.includes('Projected Difference'), 'projected difference card present');
  check(html.includes('/day'), 'a per-day figure is shown');
  check(html.includes('Projected Category Spending'), 'category section present');
  check(html.includes('How this estimate is calculated'), 'explanation section present');
  check(html.includes('Prediction Confidence'), 'confidence section present');
  check(html.includes('Spending Pace'), 'pace section present');
  check(html.includes('Budget Projection'), 'budget projection section present');
  check(html.includes('Historical Comparison'), 'historical section present');
  check(html.includes('Prediction Observations'), 'observations section present');
  check(html.includes('Based on current spending pace'), 'projection basis is labelled');
  check(html.includes('not a guaranteed future outcome'), 'disclaimer present');
  check(html.includes('Projection'), 'projection bars heading present');
  check(html.includes('/analysis'), 'links to spending analysis');
  check(html.includes('/insights'), 'links to AI insights');
  assertNoBadNumbers(html, 'prediction page');
});

test('prediction page shows the empty state with no expenses', () => {
  seed([]);
  const html = renderRoute(h(ExpensePrediction));
  check(html.includes('No spending data available'), 'empty state title');
  check(html.includes('Add expenses to generate a spending projection.'), 'empty state message');
  check(html.includes('Add Expense'), 'add expense action offered');
  assertNoBadNumbers(html, 'prediction empty state');
});

test('prediction page shows a limited-data notice early in the month', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  // Build data only for the current month, first day of the month, to force limited.
  seed([
    { id: 'l1', amount: 400, category: 'Food', description: 'Lunch', paymentMethod: 'Cash', date: `${y}-${m}-01` },
  ]);
  // Only meaningful when today is early in the month; otherwise assert it still renders.
  const html = renderRoute(h(ExpensePrediction));
  const prediction = predictExpenses(
    [{ id: 'l1', amount: 400, category: 'Food', description: 'Lunch', paymentMethod: 'Cash', date: `${y}-${m}-01` }],
    { monthly: 20000, categories: {} },
    { currency: '₹' }
  );
  if (day < 7) {
    check(prediction.confidence.level === 'limited', 'early month is limited data');
    check(html.includes('Limited data'), 'limited data notice shown');
    check(
      html.includes('may change significantly as more expenses are added'),
      'limited data explanation shown'
    );
  } else {
    check(prediction.confidence.level !== 'limited', `day ${day} is not limited`);
  }
  assertNoBadNumbers(html, 'limited data page');
});

test('prediction page does not count future expenses in the pace', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (n) => String(n).padStart(2, '0');
  const todayIso = `${y}-${pad(m)}-${pad(now.getDate())}`;
  const futureIso = `${y}-${pad(m + 1 > 12 ? 1 : m + 1)}-15`;

  const records = [
    { id: 'c1', amount: 1000, category: 'Food', description: 'Real', paymentMethod: 'Cash', date: todayIso },
  ];
  if (futureIso.slice(0, 7) !== todayIso.slice(0, 7)) {
    records.push({ id: 'c2', amount: 999999, category: 'Shopping', description: 'Later', paymentMethod: 'Cash', date: futureIso });
  }

  seed(records);
  const html = renderRoute(h(ExpensePrediction));
  const prediction = predictExpenses(records, { monthly: 25000, categories: {} }, { currency: '₹' });
  check(prediction.actualSpending.total <= 1000, 'future expense excluded from actual total');
  assertNoBadNumbers(html, 'future expense page');
});

test('prediction page works with no budget set', () => {
  seed(sample);
  const html = renderRoute(h(ExpensePrediction));
  check(
    html.includes('Set a monthly budget to compare your projection against a target'),
    'no-budget prompt shown'
  );
  assertNoBadNumbers(html, 'no budget page');
});

test('dashboard shows the prediction preview with a link to the page', () => {
  seed(sample);
  const html = renderRoute(h(Dashboard));
  check(html.includes('AI Expense Prediction'), 'dashboard prediction card heading');
  check(html.includes('Projected Month-End'), 'projected month-end in preview');
  check(html.includes('Current Pace'), 'current pace in preview');
  check(html.includes('View Prediction'), 'view prediction link');
  check(html.includes('href="/prediction"'), 'link targets the prediction route');
  assertNoBadNumbers(html, 'dashboard');
});

test('dashboard preview degrades gracefully with no current-month data', () => {
  const past = new Date();
  past.setMonth(past.getMonth() - 3);
  const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-10`;
  seed([
    { id: 'o1', amount: 3000, category: 'Food', description: 'Old', paymentMethod: 'Cash', date: iso },
  ]);
  const html = renderRoute(h(Dashboard));
  check(
    html.includes('Prediction needs more spending data'),
    'dashboard shows insufficient data message instead of misleading numbers'
  );
  assertNoBadNumbers(html, 'dashboard no current month');
});

test('AI insights references the projection concisely', () => {
  seed(sample);
  store.set('ai_monthly_budget', '25000');
  const html = renderRoute(h(AIInsights));
  check(html.includes('insight-projection') || html.includes('Estimate, not guaranteed'), 'projection insight present');
  check(html.includes('View Expense Prediction'), 'link to prediction page');
  check(html.includes('Spending Analysis'), 'link to spending analysis retained');
  assertNoBadNumbers(html, 'ai insights');
});

test('spending analysis still links to insights and prediction', () => {
  seed(sample);
  const html = renderRoute(h(SpendingAnalysis));
  check(html.includes('View AI Insights'), 'insights link retained');
  check(html.includes('View Expense Prediction'), 'prediction link added');
  assertNoBadNumbers(html, 'spending analysis');
});

test('sidebar exposes the prediction route', () => {
  seed(sample);
  const html = renderRoute(h(Dashboard));
  check(html.includes('href="/prediction"'), 'sidebar link present');
  check(html.includes('Expense Prediction'), 'sidebar label present');
});

test('existing steps 1-9 pages still render their core content', () => {
  seed(sample);
  store.set('ai_monthly_budget', '25000');

  const dashboard = renderRoute(h(Dashboard));
  check(dashboard.includes('Total Expenses'), 'dashboard total expenses');
  check(dashboard.includes('Budget Overview'), 'dashboard budget overview');
  check(dashboard.includes('Monthly Spending'), 'dashboard monthly chart');
  check(dashboard.includes('Spending by Category'), 'dashboard category donut');
  check(dashboard.includes('Recent Transactions'), 'dashboard recent transactions');
  check(dashboard.includes('AI Insights Preview'), 'dashboard insights preview');

  const insights = renderRoute(h(AIInsights));
  check(insights.includes('Total Spending'), 'insights summary');
  check(insights.includes('Refresh Insights'), 'insights refresh retained');

  const analysis = renderRoute(h(SpendingAnalysis));
  check(analysis.includes('Total Spending'), 'analysis summary');
  check(analysis.includes('Observation'), 'analysis observations');

  const reports = renderRoute(h(Reports));
  check(reports.includes('Total Expenses'), 'reports summary');

  const budget = renderRoute(h(Budget));
  check(budget.includes('Budget'), 'budget page');

  const history = renderRoute(h(ExpenseHistory));
  check(history.includes('Expense History') || history.includes('Search'), 'history page');

  const add = renderRoute(h(AddExpense));
  check(add.includes('Add Expense') || add.includes('Amount'), 'add expense page');

  const settings = renderRoute(h(Settings));
  check(settings.includes('Settings'), 'settings page');
});

test('existing user data is never rewritten by reading', () => {
  seed(sample);
  const before = store.get('ai_expenses');
  renderRoute(h(Dashboard));
  renderRoute(h(ExpensePrediction));
  renderRoute(h(Reports));
  check(store.get('ai_expenses') === before, 'ai_expenses key untouched by rendering');
});

console.error = realConsoleError;
console.warn = realConsoleWarn;

// useLayoutEffect warnings are inherent to server rendering and are not a
// defect in the app, so they are not treated as failures.
const actionableWarnings = reactWarnings.filter(
  (w) => !/useLayoutEffect does nothing on server/.test(w)
);
actionableWarnings.forEach((w) => {
  failed += 1;
  failures.push(`  [console] ${w}`);
});

console.log('\nAI Expense Prediction - application render verification');
console.log('='.repeat(56));
console.log(`Checks passed: ${passed}`);
console.log(`Checks failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.slice(0, 60).forEach((f) => console.log(f));
  if (failures.length > 60) console.log(`  ... and ${failures.length - 60} more`);
}
console.log(`Console warnings ignored (server-render only): ${reactWarnings.length - actionableWarnings.length}`);
console.log('='.repeat(56));
process.exit(failed === 0 ? 0 : 1);
