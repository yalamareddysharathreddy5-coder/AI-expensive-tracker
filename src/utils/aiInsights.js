import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import {
  currentMonthKey,
  previousMonthKey,
  getCategoryTotals,
  getTotalExpenses,
  formatCurrency,
  monthKey,
} from './format';
import { calculateBudgetUsage } from './budget';

export const INSIGHT_TIMEFRAMES = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'last3', label: 'Last 3 Months' },
  { key: 'last6', label: 'Last 6 Months' },
  { key: 'all', label: 'All Time' },
];

const PRIORITY_WEIGHT = { warning: 0, positive: 1, info: 2 };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HIGH_VALUE_THRESHOLD = 3;
const CONCENTRATION_THRESHOLD = 50;
const BUDGET_WARNING_THRESHOLD = 80;

export function isValidExpenseDate(dateStr) {
  if (typeof dateStr !== 'string' || !DATE_PATTERN.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function sanitizeExpenses(expenses) {
  if (!Array.isArray(expenses)) return [];
  return expenses.filter(
    (expense) =>
      expense &&
      typeof expense === 'object' &&
      isValidExpenseDate(expense.date) &&
      Number.isFinite(Number(expense.amount)) &&
      Number(expense.amount) >= 0
  );
}

function monthKeyOffset(offset) {
  const now = new Date();
  return monthKey(new Date(now.getFullYear(), now.getMonth() + offset, 1));
}

export function filterExpensesByTimeframe(expenses, timeframe) {
  const valid = sanitizeExpenses(expenses);
  if (timeframe === 'all') return valid;

  let startKey;
  let endKey;

  switch (timeframe) {
    case 'thisMonth':
      startKey = currentMonthKey();
      endKey = currentMonthKey();
      break;
    case 'lastMonth':
      startKey = previousMonthKey();
      endKey = previousMonthKey();
      break;
    case 'last3':
      startKey = monthKeyOffset(-2);
      endKey = currentMonthKey();
      break;
    case 'last6':
      startKey = monthKeyOffset(-5);
      endKey = currentMonthKey();
      break;
    default:
      startKey = currentMonthKey();
      endKey = currentMonthKey();
  }

  return valid.filter((expense) => {
    const key = expense.date.slice(0, 7);
    return key >= startKey && key <= endKey;
  });
}

function validateTimeframe(timeframe) {
  if (typeof timeframe === 'string' && INSIGHT_TIMEFRAMES.some((t) => t.key === timeframe)) {
    return timeframe;
  }
  return 'thisMonth';
}

function topCategoryInsight(expenses, currency) {
  if (expenses.length === 0) return null;
  const totals = getCategoryTotals(expenses, CATEGORIES);
  let category = null;
  let amount = 0;
  Object.entries(totals).forEach(([name, value]) => {
    if (value > amount) {
      amount = value;
      category = name;
    }
  });
  if (!category || amount <= 0) return null;

  const total = getTotalExpenses(expenses);
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;

  return {
    id: 'insight-top-category',
    type: 'top-category',
    priority: 'info',
    title: `${category} is your top spending category`,
    description: `You spent ${formatCurrency(amount, currency)} on ${category.toLowerCase()} in this period.`,
    source: `Calculated from ${expenses.length} recorded transaction${expenses.length === 1 ? '' : 's'} in this period.`,
    metric: `${pct}% of total spending`,
    category,
    icon: CATEGORY_COLORS[category],
  };
}

function budgetUsageInsight(expenses, budget, currency, timeframe) {
  if (timeframe !== 'thisMonth' || expenses.length === 0) return null;
  const monthly = budget && Number(budget.monthly);
  if (!Number.isFinite(monthly) || monthly <= 0) return null;

  const spent = getTotalExpenses(expenses);
  const usage = calculateBudgetUsage(spent, monthly);

  if (spent > monthly) {
    return {
      id: 'insight-budget-usage',
      type: 'budget',
      priority: 'warning',
      title: 'Your spending is above your monthly budget',
      description: `You have spent ${formatCurrency(spent, currency)} this month against a monthly budget of ${formatCurrency(monthly, currency)}.`,
      source: `Based on your monthly budget of ${formatCurrency(monthly, currency)} and this month's total spending.`,
      metric: `Over by ${formatCurrency(spent - monthly, currency)}`,
      icon: 'piggy',
    };
  }

  if (usage >= 100) {
    return {
      id: 'insight-budget-usage',
      type: 'budget',
      priority: 'warning',
      title: 'Your spending has reached your monthly budget',
      description: `You have spent the full ${formatCurrency(monthly, currency)} of your monthly budget this month.`,
      source: `Based on your monthly budget of ${formatCurrency(monthly, currency)} and this month's total spending.`,
      metric: '100% of budget used',
      icon: 'piggy',
    };
  }

  if (usage >= BUDGET_WARNING_THRESHOLD) {
    return {
      id: 'insight-budget-usage',
      type: 'budget',
      priority: 'warning',
      title: 'Your spending is approaching your monthly budget',
      description: `You have used ${Math.round(usage)}% of your ${formatCurrency(monthly, currency)} monthly budget so far.`,
      source: `Calculated as this month's spending divided by your monthly budget.`,
      metric: `${Math.round(usage)}% of budget used`,
      icon: 'piggy',
    };
  }

  return {
    id: 'insight-budget-usage',
    type: 'budget',
    priority: 'positive',
    title: 'Your spending is below your monthly budget',
    description: `You have spent ${formatCurrency(spent, currency)} this month, which is ${Math.round(usage)}% of your ${formatCurrency(monthly, currency)} monthly budget.`,
    source: `Calculated as this month's spending divided by your monthly budget.`,
    metric: `${Math.round(usage)}% of budget used`,
    icon: 'piggy',
  };
}

function monthOverMonthInsight(expenses, currency) {
  const current = getTotalExpenses(expenses, currentMonthKey());
  const previous = getTotalExpenses(expenses, previousMonthKey());

  if (current <= 0 || previous <= 0) return null;

  const diff = current - previous;
  const pct = Math.round((Math.abs(diff) / previous) * 100);

  if (diff === 0) {
    return {
      id: 'insight-month-over-month',
      type: 'month-over-month',
      priority: 'info',
      title: 'Your spending stayed level compared with last month',
      description: `You spent ${formatCurrency(current, currency)} this month, matching last month's total of ${formatCurrency(previous, currency)}.`,
      source: `Compared this month's total with last month's total.`,
      metric: 'No change vs last month',
      icon: 'calendar',
    };
  }

  const increased = diff > 0;
  return {
    id: 'insight-month-over-month',
    type: 'month-over-month',
    priority: increased ? 'warning' : 'positive',
    title: increased
      ? 'Your spending increased compared with last month'
      : 'Your spending decreased compared with last month',
    description: `You spent ${formatCurrency(current, currency)} this month compared with ${formatCurrency(previous, currency)} last month, a ${pct}% ${increased ? 'increase' : 'decrease'}.`,
    source: `Compared this month (${formatCurrency(current, currency)}) with last month (${formatCurrency(previous, currency)}).`,
    metric: `${pct}% ${increased ? 'higher' : 'lower'} than last month`,
    icon: increased ? 'trend-up' : 'trend-down',
  };
}

function largestExpenseInsight(expenses, currency) {
  if (expenses.length === 0) return null;
  const largest = expenses.reduce(
    (best, expense) => (Number(expense.amount) > Number(best.amount) ? expense : best),
    expenses[0]
  );

  const label =
    typeof largest.description === 'string' && largest.description.trim()
      ? `"${largest.description.trim()}" in ${largest.category}`
      : `for ${largest.category}`;

  return {
    id: 'insight-largest-expense',
    type: 'largest-expense',
    priority: 'info',
    title: `Your largest expense was ${formatCurrency(Number(largest.amount), currency)}`,
    description: `You spent ${formatCurrency(Number(largest.amount), currency)} on ${label}.`,
    source: `Identified from ${expenses.length} recorded transaction${expenses.length === 1 ? '' : 's'} in this period.`,
    metric: formatCurrency(Number(largest.amount), currency),
    category: largest.category,
    icon: 'flag',
  };
}

function frequentCategoryInsight(expenses, currency) {
  if (expenses.length < 2) return null;
  const counts = {};
  expenses.forEach((expense) => {
    const category =
      typeof expense.category === 'string' && expense.category ? expense.category : 'Other';
    counts[category] = (counts[category] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [category, count] = sorted[0];
  if (!category || !count) return null;

  return {
    id: 'insight-frequent-category',
    type: 'frequent-category',
    priority: 'info',
    title: `${category} is your most frequent spending category`,
    description: `You recorded ${count} transaction${count === 1 ? '' : 's'} in ${category.toLowerCase()} during this period.`,
    source: `Counted the number of transactions per category in this period.`,
    metric: `${count} of ${expenses.length} transactions`,
    category,
    icon: CATEGORY_COLORS[category] || '#64748b',
  };
}

function paymentMethodInsight(expenses, currency) {
  if (expenses.length < 3) return null;
  const counts = {};
  expenses.forEach((expense) => {
    const method =
      typeof expense.paymentMethod === 'string' && expense.paymentMethod
        ? expense.paymentMethod
        : 'Other';
    counts[method] = (counts[method] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [method, count] = sorted[0];
  if (!method) return null;

  return {
    id: 'insight-payment-method',
    type: 'payment-method',
    priority: 'info',
    title: `${method} is your most frequently used payment method`,
    description: `You used ${method} for ${count} of your ${expenses.length} transactions in this period.`,
    source: `Counted how often each payment method was used in this period.`,
    metric: `${Math.round((count / expenses.length) * 100)}% of transactions`,
    icon: 'credit-card',
  };
}

function highValueExpenseInsight(expenses, currency) {
  if (expenses.length < 2) return null;
  const average = getTotalExpenses(expenses) / expenses.length;
  if (average <= 0) return null;

  const matches = expenses.filter((expense) => Number(expense.amount) >= average * HIGH_VALUE_THRESHOLD);
  if (matches.length === 0) return null;

  const standout = matches.reduce(
    (best, expense) => (Number(expense.amount) > Number(best.amount) ? expense : best),
    matches[0]
  );

  const ratio = Math.round(Number(standout.amount) / average);
  const label =
    typeof standout.description === 'string' && standout.description.trim()
      ? `"${standout.description.trim()}"`
      : `a ${standout.category} expense`;

  return {
    id: 'insight-high-value-expense',
    type: 'high-value',
    priority: 'warning',
    title: 'One expense stands out from your normal spending',
    description: `${label} (${formatCurrency(Number(standout.amount), currency)}) is noticeably higher than your average transaction of ${formatCurrency(Math.round(average), currency)}.`,
    source: `Flagged because it is at least ${HIGH_VALUE_THRESHOLD}x your average transaction amount in this period.`,
    metric: `${ratio}x your average transaction`,
    category: standout.category,
    icon: 'alert',
  };
}

function categoryConcentrationInsight(expenses, currency) {
  if (expenses.length < 3) return null;
  const totals = getCategoryTotals(expenses, CATEGORIES);
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const activeCategories = Object.values(totals).filter((value) => value > 0).length;
  if (activeCategories < 2) return null;

  const entries = Object.entries(totals)
    .map(([category, amount]) => ({ category, amount, share: (amount / total) * 100 }))
    .filter((entry) => entry.amount > 0 && entry.share >= CONCENTRATION_THRESHOLD)
    .sort((a, b) => b.amount - a.amount);

  const top = entries[0];
  if (!top) return null;

  return {
    id: 'insight-category-concentration',
    type: 'concentration',
    priority: 'warning',
    title: `A large share of your spending is in ${top.category}`,
    description: `${formatCurrency(top.amount, currency)} of your spending this period is in ${top.category.toLowerCase()}, representing ${Math.round(top.share)}% of the total.`,
    source: `Calculated as the ${top.category} share of total spending for this period.`,
    metric: `${Math.round(top.share)}% of spending`,
    category: top.category,
    icon: CATEGORY_COLORS[top.category],
  };
}

export function generateInsights(expenses, budget, options = {}) {
  const currency = typeof options.currency === 'string' && options.currency ? options.currency : '₹';
  const timeframe = validateTimeframe(options.timeframe);

  const safe = sanitizeExpenses(expenses);
  const active = filterExpensesByTimeframe(safe, timeframe);

  const insights = [
    topCategoryInsight(active, currency),
    budgetUsageInsight(active, budget, currency, timeframe),
    largestExpenseInsight(active, currency),
    frequentCategoryInsight(active, currency),
    paymentMethodInsight(active, currency),
    highValueExpenseInsight(active, currency),
    categoryConcentrationInsight(active, currency),
  ].filter(Boolean);

  if (timeframe === 'thisMonth') {
    const mom = monthOverMonthInsight(safe, currency);
    if (mom) insights.push(mom);
  }

  return insights
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    .slice(0, 8);
}

export function generateInsightSummary(expenses, budget, options = {}) {
  const currency = typeof options.currency === 'string' && options.currency ? options.currency : '₹';
  const timeframe = validateTimeframe(options.timeframe);

  const active = filterExpensesByTimeframe(expenses, timeframe);
  const total = getTotalExpenses(active);
  const count = active.length;
  const average = count > 0 ? total / count : 0;

  const totals = getCategoryTotals(active, CATEGORIES);
  let topCategory = null;
  let topCategoryAmount = 0;
  Object.entries(totals).forEach(([name, value]) => {
    if (value > topCategoryAmount) {
      topCategoryAmount = value;
      topCategory = name;
    }
  });

  const monthly = budget && Number(budget.monthly);
  const budgetUsage =
    Number.isFinite(monthly) && monthly > 0 && timeframe === 'thisMonth'
      ? calculateBudgetUsage(total, monthly)
      : null;

  return { total, count, average, topCategory, topCategoryAmount, budgetUsage, timeframe, currency };
}