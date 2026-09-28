import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import { monthKey, formatCurrency } from './format';
import { calculateBudgetUsage, calculateRemainingBudget } from './budget';
import { sanitizeExpenses } from './aiInsights';

export const CONFIDENCE_LEVELS = ['limited', 'moderate', 'strong'];

export const CONFIDENCE_LABELS = {
  limited: 'Limited',
  moderate: 'Moderate',
  strong: 'Strong',
};

export const CONFIDENCE_TONES = {
  limited: 'warning',
  moderate: 'info',
  strong: 'positive',
};

export const PREDICTION_METHOD = {
  key: 'daily-pace',
  label: 'Current-month spending pace',
  basis: 'Based on current spending pace',
};

const PRIORITY_WEIGHT = { warning: 0, info: 1, positive: 2 };
const LIMITED_DAYS_THRESHOLD = 7;
const MODERATE_DAYS_THRESHOLD = 14;
const MODERATE_MIN_HISTORY_MONTHS = 3;
const STRONG_MIN_HISTORY_MONTHS = 4;
const NO_BUDGET_MESSAGE = 'Set a monthly budget to compare your projection against a target.';
const NO_HISTORY_MESSAGE = 'More historical expense data is needed for this comparison.';
const LIMITED_DATA_MESSAGE =
  'Your projection is based on a small amount of recorded spending and may change significantly as more expenses are added.';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

function roundMoney(value) {
  return Math.round(num(value));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function resolveNow(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function normalizeCategory(category) {
  return typeof category === 'string' && CATEGORIES.includes(category) ? category : 'Other';
}

function monthName(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function resolvePredictionPeriod(nowInput) {
  const now = resolveNow(nowInput);
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const elapsedDays = now.getDate();
  const remainingDays = Math.max(daysInMonth - elapsedDays, 0);
  const key = monthKey(now);

  return {
    key,
    label: monthName(year, monthIndex),
    year,
    month: monthIndex + 1,
    startDate: `${key}-01`,
    endDate: toISODate(new Date(year, monthIndex, daysInMonth)),
    today: toISODate(now),
    daysInMonth,
    elapsedDays,
    remainingDays,
    progressPct: daysInMonth > 0 ? round2((elapsedDays / daysInMonth) * 100) : 0,
  };
}

function splitCurrentMonth(safe, period) {
  const inMonth = safe.filter((expense) => expense.date.startsWith(period.key));
  const past = [];
  const future = [];

  inMonth.forEach((expense) => {
    if (expense.date > period.today) future.push(expense);
    else past.push(expense);
  });

  return { past, future };
}

function sumAmounts(expenses) {
  return expenses.reduce((sum, expense) => sum + num(expense.amount), 0);
}

function computeActualSpending(past, future) {
  const total = sumAmounts(past);
  const dates = past.map((expense) => expense.date).sort();
  const uniqueDays = new Set(dates).size;

  return {
    total: round2(total),
    count: past.length,
    activeDays: uniqueDays,
    averageTransaction: past.length > 0 ? round2(total / past.length) : 0,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    futureTotal: round2(sumAmounts(future)),
    futureCount: future.length,
  };
}

function computeCategoryPredictions(past, period, projectedTotal) {
  const totals = new Map();
  const counts = new Map();

  past.forEach((expense) => {
    const category = normalizeCategory(expense.category);
    totals.set(category, (totals.get(category) || 0) + num(expense.amount));
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  const divisor = period.elapsedDays > 0 ? period.elapsedDays : 0;
  const denominator = projectedTotal > 0 ? projectedTotal : 0;

  return CATEGORIES.map((category) => {
    const actual = totals.get(category) || 0;
    const projected = divisor > 0 ? round2((actual / divisor) * period.daysInMonth) : 0;
    return {
      category,
      actual: round2(actual),
      dailyPace: divisor > 0 ? round2(actual / divisor) : 0,
      projected,
      percentageOfProjectedTotal: denominator > 0 ? round2((projected / denominator) * 100) : 0,
      count: counts.get(category) || 0,
      color: CATEGORY_COLORS[category],
    };
  })
    .filter((entry) => entry.actual > 0 && entry.count > 0)
    .sort((a, b) => b.projected - a.projected || b.actual - a.actual);
}

function buildMonthTotals(safe) {
  const totals = new Map();
  safe.forEach((expense) => {
    const key = expense.date.slice(0, 7);
    totals.set(key, (totals.get(key) || 0) + num(expense.amount));
  });
  return totals;
}

function describeMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return monthName(year, month - 1);
}

function daysInMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function computeHistorical(safe, period, projectedTotal) {
  const totals = buildMonthTotals(safe);
  const previousKey = monthKey(new Date(period.year, period.month - 2, 1));

  const months = Array.from(totals.entries())
    .filter(([key]) => key < period.key)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, total]) => ({
      key,
      label: describeMonth(key),
      total: round2(total),
      days: daysInMonthKey(key),
    }));

  const available = months.filter((entry) => entry.total > 0);
  const hasEnough = available.length > 0;

  const averageMonthly = hasEnough
    ? round2(available.reduce((sum, entry) => sum + entry.total, 0) / available.length)
    : 0;
  const averageDailyPace = hasEnough
    ? round2(
        available.reduce((sum, entry) => sum + (entry.days > 0 ? entry.total / entry.days : 0), 0) /
          available.length
      )
    : 0;

  const previousTotal = num(totals.get(previousKey), 0);
  const previousDays = daysInMonthKey(previousKey);
  const difference = hasEnough ? round2(projectedTotal - averageMonthly) : null;
  const differencePct =
    hasEnough && averageMonthly > 0 ? round2((difference / averageMonthly) * 100) : null;

  return {
    hasEnough,
    message: hasEnough ? null : NO_HISTORY_MESSAGE,
    months,
    monthsUsed: available.length,
    previousKey,
    previousLabel: describeMonth(previousKey),
    previousMonth: round2(previousTotal),
    previousMonthPace:
      previousTotal > 0 && previousDays > 0 ? round2(previousTotal / previousDays) : 0,
    averageMonthly,
    averageDailyPace,
    difference,
    differencePct,
    monthLabel: available.length > 0 ? `the previous ${available.length} ${plural(available.length, 'month', 'months')}` : 'available previous months',
  };
}

function computeConfidence(period, actual, historical) {
  let level;
  if (period.elapsedDays < LIMITED_DAYS_THRESHOLD) level = 'limited';
  else if (period.elapsedDays <= MODERATE_DAYS_THRESHOLD) level = 'moderate';
  else level = 'strong';

  if (level === 'limited' && historical.monthsUsed >= MODERATE_MIN_HISTORY_MONTHS) {
    level = 'moderate';
  } else if (level === 'moderate' && historical.monthsUsed >= STRONG_MIN_HISTORY_MONTHS) {
    level = 'strong';
  }

  const parts = [
    `Based on ${period.elapsedDays} ${plural(period.elapsedDays, 'day', 'days')} of current-month spending data`,
  ];

  if (actual.activeDays !== period.elapsedDays) {
    parts.push(`recorded across ${actual.activeDays} ${plural(actual.activeDays, 'day', 'days')}`);
  }
  if (historical.monthsUsed > 0) {
    parts.push(
      `and ${historical.monthsUsed} previous ${plural(historical.monthsUsed, 'month', 'months')} of history`
    );
  }

  return {
    level,
    label: CONFIDENCE_LABELS[level],
    tone: CONFIDENCE_TONES[level],
    reason: `${parts.join(', ')}.`,
    daysObserved: period.elapsedDays,
    activeDays: actual.activeDays,
    historicalMonths: historical.monthsUsed,
    limited: level === 'limited',
    limitedMessage: LIMITED_DATA_MESSAGE,
  };
}

function computeBudgetComparison(budget, currency, actual, projected) {
  const monthly = budget && typeof budget === 'object' ? num(budget.monthly, NaN) : NaN;
  const hasBudget = Number.isFinite(monthly) && monthly > 0;

  if (!hasBudget) {
    return {
      hasBudget: false,
      monthly: null,
      actual: round2(actual),
      usedPct: null,
      remaining: null,
      projected: round2(projected),
      projectedRemaining: null,
      projectedPctOfBudget: null,
      message: NO_BUDGET_MESSAGE,
    };
  }

  const usedPct = calculateBudgetUsage(actual, monthly);
  const remaining = calculateRemainingBudget(monthly, actual);
  const projectedRemaining = calculateRemainingBudget(monthly, projected);
  const projectedPctOfBudget = monthly > 0 ? round2((projected / monthly) * 100) : null;
  const gap = formatCurrency(roundMoney(Math.abs(num(projectedRemaining))), currency);

  const message =
    num(projectedRemaining) >= 0
      ? `Projected spending is approximately ${gap} below the monthly budget.`
      : `Projected spending is approximately ${gap} above the monthly budget.`;

  return {
    hasBudget: true,
    monthly: round2(monthly),
    actual: round2(actual),
    usedPct: round2(usedPct),
    remaining: round2(remaining),
    projected: round2(projected),
    projectedRemaining: round2(projectedRemaining),
    projectedPctOfBudget,
    message,
  };
}

function computeCapacity(budgetComparison, period) {
  const hasBudget = budgetComparison.hasBudget;
  const remaining = hasBudget ? num(budgetComparison.remaining) : null;
  const perDay =
    hasBudget && remaining > 0 && period.remainingDays > 0
      ? round2(remaining / period.remainingDays)
      : null;

  return {
    hasBudget,
    remaining: hasBudget ? round2(remaining) : null,
    remainingDays: period.remainingDays,
    perDay,
    label: 'Remaining budget per day',
    note: 'A mathematical reference calculated from your budget and the days left in the month. It is not a spending recommendation.',
  };
}

function buildObservations(context) {
  const {
    currency,
    period,
    actual,
    dailyPace,
    projected,
    budgetComparison,
    capacity,
    historical,
    categoryPredictions,
    confidence,
  } = context;

  const observations = [];

  if (actual.count > 0) {
    observations.push({
      id: 'prediction-pace',
      type: 'pace',
      priority: 'info',
      title: 'Your current spending pace',
      description: `You have recorded ${formatCurrency(actual.total, currency)} across ${period.elapsedDays} ${plural(period.elapsedDays, 'day', 'days')} of ${period.label}.`,
      metric: `${formatCurrency(roundMoney(dailyPace), currency)} per day`,
      explanation: `Recorded spending divided by the ${period.elapsedDays} ${plural(period.elapsedDays, 'day', 'days')} elapsed this month.`,
    });

    observations.push({
      id: 'prediction-projection',
      type: 'projection',
      priority: 'info',
      title: 'Projected month-end spending',
      description: `At the current pace, projected month-end spending for ${period.label} is ${formatCurrency(roundMoney(projected.total), currency)}.`,
      metric: formatCurrency(roundMoney(projected.total), currency),
      explanation: `${PREDICTION_METHOD.basis}: daily pace multiplied by the ${period.daysInMonth} days in ${period.label}.`,
    });
  }

  if (budgetComparison.hasBudget) {
    const above = num(budgetComparison.projectedRemaining) < 0;
    observations.push({
      id: 'prediction-budget',
      type: 'budget',
      priority: above ? 'warning' : 'info',
      title: above
        ? 'Projected spending is above the monthly budget'
        : 'Projected spending is below the monthly budget',
      description: `Compared with a monthly budget of ${formatCurrency(budgetComparison.monthly, currency)}, projected spending is approximately ${formatCurrency(roundMoney(Math.abs(num(budgetComparison.projectedRemaining))), currency)} ${above ? 'above' : 'below'} it.`,
      metric: `${Math.round(num(budgetComparison.projectedPctOfBudget))}% of budget`,
      explanation: 'Projected month-end spending compared with your recorded monthly budget.',
    });
  }

  if (capacity.perDay !== null) {
    observations.push({
      id: 'prediction-capacity',
      type: 'budget',
      priority: 'info',
      title: 'Remaining budget per day',
      description: `${formatCurrency(capacity.remaining, currency)} of the monthly budget is unspent across ${period.remainingDays} remaining ${plural(period.remainingDays, 'day', 'days')}.`,
      metric: `${formatCurrency(roundMoney(capacity.perDay), currency)} per day`,
      explanation: 'Remaining budget divided by the days left in the month. A mathematical reference, not advice.',
    });
  }

  categoryPredictions.slice(0, 2).forEach((entry) => {
    observations.push({
      id: `prediction-category-${entry.category.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'category',
      priority: 'info',
      title: `${entry.category} represents ${Math.round(entry.percentageOfProjectedTotal)}% of projected spending`,
      description: `${formatCurrency(entry.actual, currency)} recorded so far projects to approximately ${formatCurrency(roundMoney(entry.projected), currency)} by the end of ${period.label}.`,
      metric: `${Math.round(entry.percentageOfProjectedTotal)}% of projection`,
      explanation: `${entry.category} spending divided by elapsed days, extended across the full month.`,
    });
  });

  if (historical.hasEnough) {
    const above = num(historical.difference) > 0;
    const magnitude = formatCurrency(roundMoney(Math.abs(num(historical.difference))), currency);
    const pctSuffix =
      historical.differencePct !== null ? ` (${Math.round(Math.abs(historical.differencePct))}%)` : '';

    observations.push({
      id: 'prediction-historical',
      type: 'historical',
      priority: 'info',
      title: 'Projected spending compared with previous months',
      description: `Current projected spending is ${magnitude}${pctSuffix} ${above ? 'above' : 'below'} the average of ${historical.monthLabel}.`,
      metric: `${above ? '+' : '-'}${formatCurrency(roundMoney(Math.abs(num(historical.difference))), currency)}`,
      explanation: `Average total across ${historical.monthLabel} with recorded spending, compared with the current projection.`,
    });
  }

  if (actual.futureCount > 0) {
    observations.push({
      id: 'prediction-future-dated',
      type: 'pace',
      priority: 'info',
      title: 'Future-dated expenses are excluded from the current pace',
      description: `${actual.futureCount} ${plural(actual.futureCount, 'expense', 'expenses')} totalling ${formatCurrency(actual.futureTotal, currency)} ${plural(actual.futureCount, 'is', 'are')} dated after today and ${plural(actual.futureCount, 'is', 'are')} not counted as already spent.`,
      metric: formatCurrency(actual.futureTotal, currency),
      explanation: 'Only expenses dated on or before today count towards the current spending pace.',
    });
  }

  if (confidence.limited && actual.count > 0) {
    observations.push({
      id: 'prediction-limited-data',
      type: 'pace',
      priority: 'info',
      title: 'Limited data',
      description: LIMITED_DATA_MESSAGE,
      metric: `${confidence.label} data quality`,
      explanation: 'Fewer than seven days of the current month have been observed so far.',
    });
  }

  return observations.sort(
    (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
  );
}

function buildExplanation(currency, period, actual, dailyPace, projected) {
  const pace = formatCurrency(round2(dailyPace), currency);

  return {
    method: PREDICTION_METHOD.label,
    basis: PREDICTION_METHOD.basis,
    summary:
      'This estimate uses your recorded spending so far this month and calculates a daily spending pace. That pace is extended across the remaining days of the month.',
    formula: `${formatCurrency(actual.total, currency)} ÷ ${period.elapsedDays} ${plural(period.elapsedDays, 'day', 'days')} = ${pace} per day, then × ${period.daysInMonth} ${plural(period.daysInMonth, 'day', 'days')} = ${formatCurrency(roundMoney(projected.total), currency)}`,
    steps: [
      `Record the ${formatCurrency(actual.total, currency)} of spending already logged for ${period.label}.`,
      `Divide by the ${period.elapsedDays} ${plural(period.elapsedDays, 'day', 'days')} elapsed to get a daily pace of ${pace}.`,
      `Multiply that pace by the ${period.daysInMonth} days in ${period.label} to reach ${formatCurrency(roundMoney(projected.total), currency)}.`,
      'Category projections apply the same calculation to each category separately.',
    ],
    note: 'This is a projection based on recorded spending patterns. It is not a guaranteed future outcome, not a statement about what you will spend, and not financial advice.',
  };
}

export function predictExpenses(expenses, budget, options = {}) {
  const currency = typeof options.currency === 'string' && options.currency ? options.currency : '₹';
  const period = resolvePredictionPeriod(options.now);

  const safe = sanitizeExpenses(expenses);
  const { past, future } = splitCurrentMonth(safe, period);
  const actual = computeActualSpending(past, future);
  const hasPrediction = actual.count > 0;

  const dailyPace = period.elapsedDays > 0 ? round2(actual.total / period.elapsedDays) : 0;
  // Project from the unrounded pace so the projection does not drift from the
  // recorded total; the rounded pace is only for display.
  const exactPace = period.elapsedDays > 0 ? actual.total / period.elapsedDays : 0;
  const projectedTotal = period.daysInMonth > 0 ? round2(exactPace * period.daysInMonth) : 0;

  const dailyPaceBlock = {
    value: dailyPace,
    basedOnTotal: actual.total,
    elapsedDays: period.elapsedDays,
    sufficient: hasPrediction && period.elapsedDays > 0,
  };

  const projected = {
    total: projectedTotal,
    method: PREDICTION_METHOD.key,
    methodLabel: PREDICTION_METHOD.label,
    basis: PREDICTION_METHOD.basis,
    perDay: dailyPace,
    remainingAmount: round2(Math.max(projectedTotal - actual.total, 0)),
    finalDay: period.remainingDays === 0,
  };

  const budgetComparison = computeBudgetComparison(budget, currency, actual.total, projectedTotal);
  const capacity = computeCapacity(budgetComparison, period);
  const categoryPredictions = computeCategoryPredictions(past, period, projectedTotal);
  const historical = computeHistorical(safe, period, projectedTotal);
  const confidence = computeConfidence(period, actual, historical);
  const explanation = buildExplanation(currency, period, actual, dailyPace, projected);

  const result = {
    currency,
    hasPrediction,
    limitedData: hasPrediction && confidence.limited,
    period,
    actualSpending: actual,
    dailyPace: dailyPaceBlock,
    projectedSpending: projected,
    budgetComparison,
    remainingCapacity: capacity,
    categoryPredictions,
    historical,
    confidence,
    explanation,
    observations: [],
  };

  result.observations = buildObservations({
    currency,
    period,
    actual,
    dailyPace,
    projected,
    budgetComparison,
    capacity,
    historical,
    categoryPredictions,
    confidence,
  });

  return result;
}

/**
 * Adapts the prediction into the single concise insight shape rendered by
 * AIInsightCard, so AI Insights can reference the projection without
 * duplicating the prediction dashboard.
 */
export function buildProjectionInsight(expenses, budget, options = {}) {
  const prediction = predictExpenses(expenses, budget, options);
  if (!prediction.hasPrediction) return null;

  const { currency, period, projectedSpending, budgetComparison } = prediction;
  const overBudget = budgetComparison.hasBudget && Number(budgetComparison.projectedRemaining) < 0;

  return {
    id: 'insight-projection',
    type: 'projection',
    priority: overBudget ? 'warning' : 'info',
    title: `Projected ${period.label} spending is approximately ${formatCurrency(
      roundMoney(projectedSpending.total),
      currency
    )}`,
    description: `Based on your current spending pace of ${formatCurrency(
      roundMoney(prediction.dailyPace.value),
      currency
    )} per day, projected month-end spending is ${formatCurrency(
      roundMoney(projectedSpending.total),
      currency
    )}.${
      budgetComparison.hasBudget
        ? ` That is ${overBudget ? 'above' : 'below'} your monthly budget of ${formatCurrency(
            budgetComparison.monthly,
            currency
          )}.`
        : ''
    }`,
    metric: 'Estimate, not guaranteed',
    source: 'Extended from your recorded current-month spending pace.',
    icon: 'trend-up',
  };
}
