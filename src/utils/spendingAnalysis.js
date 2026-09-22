import { CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS, PAYMENT_COLORS } from '../data/constants';
import { currentMonthKey, previousMonthKey, getTotalExpenses, formatCurrency } from './format';
import { calculatePercentageChange } from './calculations';
import { calculateBudgetUsage, getBudgetStatus, calculateCategoryBudgetUsage } from './budget';
import { sanitizeExpenses } from './aiInsights';
import {
  filterExpensesByRange,
  calculateHighestExpense,
  calculateLowestExpense,
} from './reports';

export const ANALYSIS_PERIODS = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'prevMonth', label: 'Last Month' },
  { key: 'last3', label: 'Last 3 Months' },
  { key: 'last6', label: 'Last 6 Months' },
  { key: 'thisYear', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const PRIORITY_WEIGHT = { warning: 0, positive: 1, info: 2 };

export const UNUSUAL_MULTIPLE = 2.5;
const WEEKEND_NOTE_PCT = 25;
const CONSISTENCY_MIN_COUNT = 8;
const CONSISTENCY_CLOSE_RATIO = 2;
const CONSISTENCY_VARY_RATIO = 4;

function validatePeriod(period) {
  if (typeof period === 'string' && ANALYSIS_PERIODS.some((p) => p.key === period)) {
    return period;
  }
  return 'all';
}

function normalizeCategory(category) {
  return typeof category === 'string' && CATEGORIES.includes(category) ? category : 'Other';
}

function normalizeDescription(description) {
  if (typeof description !== 'string') return '';
  const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function computeSummary(active, safe) {
  const total = getTotalExpenses(active);
  const count = active.length;
  const average = count > 0 ? total / count : 0;
  const highest = calculateHighestExpense(active);
  const lowest = calculateLowestExpense(active);

  const currentMonth = getTotalExpenses(safe, currentMonthKey());
  const previousMonth = getTotalExpenses(safe, previousMonthKey());
  const monthOverMonthPct =
    currentMonth > 0 && previousMonth > 0
      ? calculatePercentageChange(currentMonth, previousMonth)
      : null;

  const activeDays = new Set(active.map((e) => e.date)).size;
  const perActiveDay = activeDays > 0 ? total / activeDays : 0;

  return { total, count, average, highest, lowest, currentMonth, previousMonth, monthOverMonthPct, activeDays, perActiveDay };
}

function computeCategories(active) {
  const totals = {};
  const counts = {};
  const catMonthly = {};
  const total = getTotalExpenses(active);

  active.forEach((expense) => {
    const category = normalizeCategory(expense.category);
    const amount = Number(expense.amount) || 0;
    totals[category] = (totals[category] || 0) + amount;
    counts[category] = (counts[category] || 0) + 1;
    const key = expense.date.slice(0, 7);
    catMonthly[category] = catMonthly[category] || {};
    catMonthly[category][key] = (catMonthly[category][key] || 0) + amount;
  });

  const categories = CATEGORIES.map((category) => {
    const amount = totals[category] || 0;
    const count = counts[category] || 0;
    return {
      category,
      total: amount,
      count,
      pct: total > 0 ? (amount / total) * 100 : 0,
      average: count > 0 ? amount / count : 0,
      color: CATEGORY_COLORS[category],
      trend: classifyTrend(catMonthly[category]),
    };
  })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const topCategory = categories.length > 0 ? categories[0] : null;
  return { categories, topCategory };
}

function classifyTrend(monthTotals) {
  if (!monthTotals) return null;
  const entries = Object.entries(monthTotals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (entries.length < 2) return null;

  const fromKey = entries[0][0];
  const toKey = entries[entries.length - 1][0];
  const fromValue = monthTotals[fromKey];
  const toValue = monthTotals[toKey];
  const delta = toValue - fromValue;

  const tolerance = Math.max(fromValue * 0.05, 1);
  const direction = Math.abs(delta) <= tolerance ? 'stable' : delta > 0 ? 'increasing' : 'decreasing';

  return {
    direction,
    from: { key: fromKey, value: fromValue },
    to: { key: toKey, value: toValue },
    months: entries.length,
  };
}

function computeMonthly(active) {
  const byMonth = {};
  active.forEach((expense) => {
    const key = expense.date.slice(0, 7);
    const amount = Number(expense.amount) || 0;
    byMonth[key] = byMonth[key] || { total: 0, count: 0 };
    byMonth[key].total += amount;
    byMonth[key].count += 1;
  });

  const months = Object.keys(byMonth)
    .sort()
    .map((key) => {
      const { total, count } = byMonth[key];
      return { key, label: monthLabel(key), total, count, average: count > 0 ? total / count : 0 };
    });

  let highestMonth = null;
  let lowestMonth = null;
  let total = 0;
  months.forEach((month) => {
    total += month.total;
    if (!highestMonth || month.total > highestMonth.total) highestMonth = month;
    if (!lowestMonth || month.total < lowestMonth.total) lowestMonth = month;
  });

  const averageMonthly = months.length > 0 ? total / months.length : 0;
  return { months, highestMonth, lowestMonth, averageMonthly };
}

function computePatterns(active, total) {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: DAY_NAMES[i], total: 0, count: 0 }));

  active.forEach((expense) => {
    const dayIndex = new Date(`${expense.date}T00:00:00`).getDay();
    const amount = Number(expense.amount) || 0;
    days[dayIndex].total += amount;
    days[dayIndex].count += 1;
  });

  const weekday = { total: 0, count: 0 };
  const weekend = { total: 0, count: 0 };
  days.forEach((day, index) => {
    if (index === 0 || index === 6) {
      weekend.total += day.total;
      weekend.count += day.count;
    } else {
      weekday.total += day.total;
      weekday.count += day.count;
    }
  });

  weekday.average = weekday.count > 0 ? weekday.total / weekday.count : 0;
  weekend.average = weekend.count > 0 ? weekend.total / weekend.count : 0;

  const weekendPctOfSpending = total > 0 ? (weekend.total / total) * 100 : 0;
  const weekendPctOfTransactions = active.length > 0 ? (weekend.count / active.length) * 100 : 0;
  const enough =
    weekday.count > 0 && weekend.count > 0 && weekday.count + weekend.count >= 5;

  const daysOfWeek = DISPLAY_DAY_ORDER.map((index) => ({
    day: days[index].day,
    total: days[index].total,
    count: days[index].count,
    average: days[index].count > 0 ? days[index].total / days[index].count : 0,
  }));

  let highestDay = null;
  daysOfWeek.forEach((day) => {
    if (day.count > 0 && (!highestDay || day.total > highestDay.total)) highestDay = day;
  });

  return { weekday, weekend, weekendPctOfSpending, weekendPctOfTransactions, enough, daysOfWeek, highestDay };
}

function computePaymentMethods(active, total) {
  const totals = {};
  const counts = {};

  active.forEach((expense) => {
    const method =
      typeof expense.paymentMethod === 'string' &&
      PAYMENT_METHODS.includes(expense.paymentMethod)
        ? expense.paymentMethod
        : 'Other';
    totals[method] = (totals[method] || 0) + (Number(expense.amount) || 0);
    counts[method] = (counts[method] || 0) + 1;
  });

  const paymentMethods = PAYMENT_METHODS.map((method) => {
    const amount = totals[method] || 0;
    const count = counts[method] || 0;
    return {
      method,
      total: amount,
      count,
      pct: total > 0 ? (amount / total) * 100 : 0,
      average: count > 0 ? amount / count : 0,
      color: PAYMENT_COLORS[method],
    };
  })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.total - a.total);

  let mostFrequentMethod = null;
  let highestValueMethod = null;
  paymentMethods.forEach((method) => {
    if (!mostFrequentMethod || method.count > mostFrequentMethod.count) mostFrequentMethod = method;
    if (!highestValueMethod || method.total > highestValueMethod.total) highestValueMethod = method;
  });

  return { paymentMethods, mostFrequentMethod, highestValueMethod };
}

function computeUnusualExpenses(active) {
  if (active.length < 3) return [];
  const average = getTotalExpenses(active) / active.length;
  if (average <= 0) return [];

  return active
    .map((expense) => {
      const amount = Number(expense.amount) || 0;
      return {
        amount,
        category: normalizeCategory(expense.category),
        description: typeof expense.description === 'string' ? expense.description : '',
        date: expense.date,
        averageTransaction: average,
        multipleOfAverage: average > 0 ? amount / average : 0,
      };
    })
    .filter((entry) => entry.amount > 0 && entry.multipleOfAverage >= UNUSUAL_MULTIPLE)
    .map((entry) => ({ ...entry, multipleOfAverage: Math.round(entry.multipleOfAverage * 100) / 100 }))
    .sort((a, b) => b.multipleOfAverage - a.multipleOfAverage);
}

function computeRecurring(active) {
  const groups = {};
  active.forEach((expense) => {
    const key = normalizeDescription(expense.description);
    if (!key) return;
    const title =
      typeof expense.description === 'string' && expense.description.trim()
        ? expense.description.trim()
        : 'Unnamed expense';
    groups[key] = groups[key] || { title, categoryTotals: {}, amounts: [], dates: [] };
    groups[key].categoryTotals[normalizeCategory(expense.category)] =
      (groups[key].categoryTotals[normalizeCategory(expense.category)] || 0) +
      (Number(expense.amount) || 0);
    groups[key].amounts.push(Number(expense.amount) || 0);
    groups[key].dates.push(expense.date);
  });

  return Object.values(groups)
    .filter((group) => group.dates.length >= 2)
    .map((group) => {
      const categoryEntries = Object.entries(group.categoryTotals).sort((a, b) => b[1] - a[1]);
      const category = categoryEntries.length > 0 ? categoryEntries[0][0] : 'Other';
      const dates = [...group.dates].sort();
      const total = group.amounts.reduce((sum, amount) => sum + amount, 0);
      const sameAmount = group.amounts.every((amount) => amount === group.amounts[0]);
      return {
        title: group.title,
        category,
        count: dates.length,
        total,
        average: total / dates.length,
        sameAmount,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
      };
    })
    .sort((a, b) => b.count - a.count || b.total - a.total);
}

function computeConsistency(active) {
  const amounts = active
    .map((expense) => Number(expense.amount) || 0)
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  if (amounts.length === 0) return null;

  const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
  const median =
    amounts.length % 2 === 1
      ? amounts[(amounts.length - 1) / 2]
      : (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2;
  const maxRatio = mean > 0 ? amounts[amounts.length - 1] / mean : 0;

  return { count: amounts.length, mean, median, maxRatio: Math.round(maxRatio * 100) / 100 };
}

function computeBudget(safe, budget, currency) {
  if (!budget || typeof budget !== 'object') return null;
  const monthly = Number(budget.monthly);
  if (!Number.isFinite(monthly) || monthly <= 0) return null;

  const spent = getTotalExpenses(safe, currentMonthKey());
  const usage = calculateBudgetUsage(spent, monthly);
  const remaining = monthly - spent;

  const now = new Date();
  const elapsedDays = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyPace = elapsedDays > 0 ? spent / elapsedDays : 0;
  const dailyBudget = daysInMonth > 0 ? monthly / daysInMonth : 0;

  const categorySpending = {};
  safe
    .filter((expense) => expense.date.startsWith(currentMonthKey()))
    .forEach((expense) => {
      const category = normalizeCategory(expense.category);
      categorySpending[category] = (categorySpending[category] || 0) + (Number(expense.amount) || 0);
    });

  const categoryBudgets = calculateCategoryBudgetUsage(
    budget.categories || {},
    categorySpending,
    CATEGORIES
  )
    .filter((c) => c.limit > 0 || c.spent > 0)
    .map((c) => ({
      ...c,
      pct: c.usage,
      statusLabel: getBudgetStatus(c.usage).label,
    }));

  return {
    monthly: Number(monthly),
    spent,
    usage,
    usedPct: usage,
    remaining,
    status: getBudgetStatus(usage),
    dailyPace,
    dailyBudget,
    elapsedDays,
    daysInMonth,
    monthKey: currentMonthKey(),
    categories: categoryBudgets,
    currency,
  };
}

function buildObservations(result, budgetInfo) {
  const observations = [];
  const currency = result.currency;
  const count = result.summary.count;

  if (budgetInfo && result.period === 'thisMonth' && count > 0) {
    if (budgetInfo.remaining < 0) {
      observations.push({
        id: 'analysis-budget-over',
        type: 'budget',
        priority: 'warning',
        title: 'Current spending has exceeded the monthly budget',
        description: `${formatCurrency(budgetInfo.spent, currency)} spent against a monthly budget of ${formatCurrency(budgetInfo.monthly, currency)}.`,
        metric: `${formatCurrency(Math.abs(budgetInfo.remaining), currency)} over budget`,
        explanation: `Spending is compared with the monthly budget of ${formatCurrency(budgetInfo.monthly, currency)}.`,
      });
    } else if (budgetInfo.usedPct >= 90) {
      observations.push({
        id: 'analysis-budget-near-limit',
        type: 'budget',
        priority: 'warning',
        title: 'Current spending is close to the monthly budget',
        description: `${Math.round(budgetInfo.usedPct)}% of the ${formatCurrency(budgetInfo.monthly, currency)} monthly budget has been used.`,
        metric: `${Math.round(budgetInfo.usedPct)}% of budget used`,
        explanation: `Current-month spending divided by the monthly budget.`,
      });
    } else {
      observations.push({
        id: 'analysis-budget-below',
        type: 'budget',
        priority: 'positive',
        title: 'Current spending is below the monthly budget',
        description: `${formatCurrency(budgetInfo.spent, currency)} spent this month, which is ${Math.round(budgetInfo.usedPct)}% of the ${formatCurrency(budgetInfo.monthly, currency)} budget.`,
        metric: `${formatCurrency(budgetInfo.remaining, currency)} remaining`,
        explanation: `Calculated as this month's spending divided by your monthly budget.`,
      });
    }
  }

  if (result.topCategory) {
    observations.push({
      id: 'analysis-top-category',
      type: 'category',
      priority: 'info',
      title: `${result.topCategory.category} leads spending in the selected period`,
      description: `${formatCurrency(result.topCategory.total, currency)} was spent in ${result.topCategory.category.toLowerCase()}.`,
      metric: `${Math.round(result.topCategory.pct)}% of spending`,
      explanation: `Categories are ranked by total spending in the selected period.`,
    });
  }

  if (result.summary.monthOverMonthPct !== null) {
    const pct = result.summary.monthOverMonthPct;
    const increased = pct > 0;
    observations.push({
      id: 'analysis-month-over-month',
      type: 'trend',
      priority: increased ? 'warning' : 'positive',
      title: increased
        ? `Spending increased compared with last month`
        : `Spending decreased compared with last month`,
      description: `Spending moved from ${formatCurrency(result.summary.previousMonth, currency)} to ${formatCurrency(result.summary.currentMonth, currency)}.`,
      metric: `${Math.round(Math.abs(pct))}% ${increased ? 'higher' : 'lower'} than last month`,
      explanation: `Compared the current and previous calendar month totals.`,
    });
  }

  const patterns = result.patterns;
  if (patterns.enough && patterns.weekendPctOfSpending >= WEEKEND_NOTE_PCT) {
    observations.push({
      id: 'analysis-weekend-spend',
      type: 'pattern',
      priority: 'info',
      title: 'A notable share of spending happens on weekends',
      description: `Weekend transactions account for ${Math.round(patterns.weekendPctOfSpending)}% of recorded spending.`,
      metric: `${Math.round(patterns.weekendPctOfSpending)}% of spending`,
      explanation: `Spending on Saturday and Sunday compared with total spending in the period.`,
    });
  }

  if (patterns.highestDay) {
    observations.push({
      id: 'analysis-highest-day',
      type: 'pattern',
      priority: 'info',
      title: `${patterns.highestDay.day} has the highest spending in this period`,
      description: `${formatCurrency(patterns.highestDay.total, currency)} was spent on ${patterns.highestDay.day.toLowerCase()}s.`,
      metric: formatCurrency(patterns.highestDay.total, currency),
      explanation: `Spending is totaled for each day of the week across the selected period.`,
    });
  }

  if (result.paymentMethods.mostFrequentMethod) {
    observations.push({
      id: 'analysis-payment-method',
      type: 'payment',
      priority: 'info',
      title: `${result.paymentMethods.mostFrequentMethod.method} is the most used payment method`,
      description: `${result.paymentMethods.mostFrequentMethod.method} was used for ${result.paymentMethods.mostFrequentMethod.count} transactions.`,
      metric: `${result.paymentMethods.mostFrequentMethod.count} transactions`,
      explanation: `Payment methods are ranked by how often each was used.`,
    });
  }

  if (result.unusualExpenses.length > 0) {
    const entry = result.unusualExpenses[0];
    observations.push({
      id: 'analysis-unusual-expense',
      type: 'transaction',
      priority: 'warning',
      title: 'A few transactions are well above your average',
      description: `${entry.description || entry.category} (${formatCurrency(entry.amount, currency)}) is about ${entry.multipleOfAverage} times your average transaction of ${formatCurrency(Math.round(entry.averageTransaction), currency)}.`,
      metric: `${entry.multipleOfAverage}x average transaction`,
      explanation: `Transactions at least ${UNUSUAL_MULTIPLE}x your average are flagged for review.`,
    });
  }

  result.recurringExpenses.slice(0, 2).forEach((entry, index) => {
    observations.push({
      id: `analysis-recurring-${index}`,
      type: 'recurring',
      priority: 'info',
      title: `${entry.title} appears in multiple transactions`,
      description: `${entry.title} appears ${entry.count} times in the selected period${entry.sameAmount ? ' with the same amount' : ''}.`,
      metric: `Repeated ${entry.count} times`,
      explanation: 'Repeated transaction pattern based on matching descriptions.',
    });
  });

  result.categories.filter((c) => c.trend).slice(0, 2).forEach((category) => {
    if (category.trend.direction === 'stable') return;
    const direction = category.trend.direction === 'increasing' ? 'increased' : 'decreased';
    observations.push({
      id: 'analysis-category-trend',
      type: 'trend',
      priority: 'info',
      title: `${category.category} spending has ${direction} across the months analyzed`,
      description: `Spending in ${category.category.toLowerCase()} moved from ${formatCurrency(category.trend.from.value, currency)} to ${formatCurrency(category.trend.to.value, currency)} over ${category.trend.months} months.`,
      metric: `${direction === 'increased' ? '+' : ''}${formatCurrency(category.trend.to.value - category.trend.from.value, currency)}`,
      explanation: `Monthly totals for ${category.category.toLowerCase()} were compared across available months.`,
    });
  });

  const consistency = result.consistency;
  if (consistency && consistency.count >= CONSISTENCY_MIN_COUNT) {
    if (consistency.maxRatio <= CONSISTENCY_CLOSE_RATIO) {
      observations.push({
        id: 'analysis-consistency-close',
        type: 'pattern',
        priority: 'positive',
        title: 'Most transactions are close to your average transaction',
        description: `The largest transaction is about ${consistency.maxRatio} times your average of ${formatCurrency(Math.round(consistency.mean), currency)}.`,
        metric: `${Math.round(consistency.mean * 100) / 100} median`,
        explanation: 'Comparison between the largest transaction and the average transaction.',
      });
    } else if (consistency.maxRatio >= CONSISTENCY_VARY_RATIO) {
      observations.push({
        id: 'analysis-consistency-vary',
        type: 'pattern',
        priority: 'warning',
        title: 'Transaction amounts vary considerably across the period',
        description: `The largest transaction is about ${consistency.maxRatio} times your average of ${formatCurrency(Math.round(consistency.mean), currency)}.`,
        metric: `${consistency.maxRatio}x average`,
        explanation: 'Comparison between the largest transaction and the average transaction.',
      });
    }
  }

  return observations.sort(
    (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
  );
}

function buildTextSummary(result, budgetInfo) {
  const currency = result.currency;
  const { total, count, currentMonth, previousMonth } = result.summary;
  if (count === 0) return null;

  const parts = [];
  parts.push(
    `Your recorded spending for this period is ${formatCurrency(total, currency)} across ${count} transaction${count === 1 ? '' : 's'}.`
  );

  if (result.topCategory) {
    parts.push(
      `${result.topCategory.category} is the largest category at ${formatCurrency(result.topCategory.total, currency)}.`
    );
  }

  const patterns = result.patterns;
  if (patterns.enough && patterns.weekendPctOfSpending >= WEEKEND_NOTE_PCT) {
    parts.push(
      `Weekend transactions account for ${Math.round(patterns.weekendPctOfSpending)}% of spending.`
    );
  }

  if (result.summary.monthOverMonthPct !== null && previousMonth > 0 && currentMonth > 0) {
    const pct = Math.round(Math.abs(result.summary.monthOverMonthPct));
    const direction = result.summary.monthOverMonthPct > 0 ? 'increased' : 'decreased';
    parts.push(`Spending ${direction} ${pct}% compared with last month.`);
  }

  return parts.join(' ');
}

export function analyzeSpending(expenses, budget, options = {}) {
  const currency = typeof options.currency === 'string' && options.currency ? options.currency : '₹';
  const period = validatePeriod(options.period);
  const periodLabel = ANALYSIS_PERIODS.find((p) => p.key === period)?.label || 'All Time';

  const safe = sanitizeExpenses(expenses);
  const active = filterExpensesByRange(safe, period);

  const summary = computeSummary(active, safe);
  const category = computeCategories(active);
  const monthly = computeMonthly(active);
  const patterns = computePatterns(active, summary.total);
  const payment = computePaymentMethods(active, summary.total);
  const unusualExpenses = computeUnusualExpenses(active);
  const recurringExpenses = computeRecurring(active);
  const consistency = computeConsistency(active);
  const budgetAnalysis = computeBudget(safe, budget, currency);

  const analysis = {
    period,
    periodLabel,
    currency,
    hasExpenses: active.length > 0,
    summary,
    categories: category.categories,
    topCategory: category.topCategory,
    monthly,
    patterns,
    paymentMethods: payment.paymentMethods,
    mostFrequentMethod: payment.mostFrequentMethod,
    highestValueMethod: payment.highestValueMethod,
    unusualExpenses,
    recurringExpenses,
    consistency,
    budget: budgetAnalysis,
    observations: [],
    textSummary: null,
  };

  analysis.observations = buildObservations(analysis, budgetAnalysis);
  analysis.textSummary = buildTextSummary(analysis, budgetAnalysis);

  return analysis;
}