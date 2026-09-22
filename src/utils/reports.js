import { getLastMonthlySeries, getCategoryTotals, todayISO } from './format';
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS } from '../data/constants';

export const DATE_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'prevMonth', label: 'Previous Month' },
  { key: 'last3', label: 'Last 3 Months' },
  { key: 'last6', label: 'Last 6 Months' },
  { key: 'thisYear', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function getRangeBounds(rangeKey, from, to) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = todayISO();

  switch (rangeKey) {
    case 'thisMonth':
      return { start: `${year}-${pad(month + 1)}-01`, end: today };
    case 'prevMonth': {
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      return {
        start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
        end: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
      };
    }
    case 'last3': {
      const first = new Date(year, month - 3, 1);
      return {
        start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
        end: today,
      };
    }
    case 'last6': {
      const first = new Date(year, month - 6, 1);
      return {
        start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
        end: today,
      };
    }
    case 'thisYear':
      return { start: `${year}-01-01`, end: today };
    case 'custom':
      return { start: from || null, end: to || null };
    default:
      return { start: null, end: null };
  }
}

export function filterExpensesByRange(expenses, rangeKey, from = '', to = '') {
  const { start, end } = getRangeBounds(rangeKey, from, to);
  if (!start && !end) return expenses;
  return expenses.filter((e) => {
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });
}

export function filterExpenses(expenses, filters) {
  const { range, from, to, category, payment } = filters;
  let list = filterExpensesByRange(expenses, range, from, to);
  if (category && category !== 'all') list = list.filter((e) => e.category === category);
  if (payment && payment !== 'all') list = list.filter((e) => e.paymentMethod === payment);
  return list;
}

export function calculateMonthlyTrend(expenses, count = 6) {
  return getLastMonthlySeries(expenses, count);
}

export function calculateCategoryBreakdown(expenses, categories = CATEGORIES) {
  const totals = getCategoryTotals(expenses, categories);
  return categories
    .map((category) => ({
      category,
      value: totals[category] || 0,
      color: CATEGORY_COLORS[category],
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function calculatePaymentBreakdown(expenses, methods = PAYMENT_METHODS) {
  const totals = {};
  expenses.forEach((e) => {
    totals[e.paymentMethod] = (totals[e.paymentMethod] || 0) + e.amount;
  });
  return methods
    .map((method) => ({ method, value: totals[method] || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function calculateHighestExpense(expenses) {
  if (expenses.length === 0) return null;
  return expenses.reduce((best, e) => (e.amount > best.amount ? e : best), expenses[0]);
}

export function calculateLowestExpense(expenses) {
  if (expenses.length === 0) return null;
  return expenses.reduce((lowest, e) => (e.amount < lowest.amount ? e : lowest), expenses[0]);
}

export function calculateMostSpentCategory(expenses) {
  const breakdown = calculateCategoryBreakdown(expenses);
  return breakdown.length > 0 ? breakdown[0] : null;
}

export function calculateMostUsedPaymentMethod(expenses) {
  if (expenses.length === 0) return null;
  const counts = {};
  expenses.forEach((e) => {
    counts[e.paymentMethod] = (counts[e.paymentMethod] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([method, count]) => ({ method, count }))[0];
}