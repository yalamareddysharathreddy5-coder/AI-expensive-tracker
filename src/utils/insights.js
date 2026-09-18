import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import {
  currentMonthKey,
  previousMonthKey,
  getTotalExpenses,
  getCategoryTotals,
  isInMonth,
  formatCurrency,
} from './format';

function topCategory(expenses, currency, mk) {
  const totals = getCategoryTotals(expenses, CATEGORIES, mk);
  const [category, amount] = Object.entries(totals).reduce(
    (best, [name, val]) => (val > best[1] ? [name, val] : best),
    ['None', 0]
  );
  if (amount === 0) return null;
  return {
    id: 'top-category',
    icon: CATEGORY_COLORS[category],
    type: 'neutral',
    title: `${category} is your top spending category`,
    description: `You have spent ${formatCurrency(amount, currency)} on ${category.toLowerCase()} this month.`,
  };
}

function monthOverMonth(expenses, currency) {
  const curr = getTotalExpenses(expenses, currentMonthKey());
  const prev = getTotalExpenses(expenses, previousMonthKey());
  if (prev === 0 && curr === 0) return null;
  const diff = curr - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : diff > 0 ? 100 : 0;
  if (diff === 0) return null;
  return {
    id: 'mom-change',
    icon: diff > 0 ? 'trend-up' : 'trend-down',
    type: diff > 0 ? 'warning' : 'good',
    title: diff > 0 ? 'Spending increased' : 'Spending decreased',
    description: `Your expenses are ${Math.abs(pct)}% ${diff > 0 ? 'higher' : 'lower'} compared to last month.`,
  };
}

function budgetWarnings(expenses, budget, currency) {
  const curr = currentMonthKey();
  const totals = getCategoryTotals(expenses, CATEGORIES, curr);
  const warnings = [];
  Object.entries(budget.categories).forEach(([category, limit]) => {
    const spent = totals[category] || 0;
    if (limit > 0 && spent > 0) {
      const ratio = spent / limit;
      if (ratio >= 1) {
        warnings.push({
          id: `budget-${category.toLowerCase()}`,
          icon: CATEGORY_COLORS[category],
          type: 'danger',
          title: `Over budget on ${category}`,
          description: `You have spent ${formatCurrency(spent, currency)} of your ${formatCurrency(limit, currency)} budget for ${category.toLowerCase()}.`,
        });
      } else if (ratio >= 0.8) {
        warnings.push({
          id: `budget-warn-${category.toLowerCase()}`,
          icon: CATEGORY_COLORS[category],
          type: 'warning',
          title: `${category} budget is running low`,
          description: `You have used ${Math.round(ratio * 100)}% of your ${category.toLowerCase()} budget.`,
        });
      }
    }
  });
  return warnings;
}

function weekendSpending(expenses, currency) {
  const curr = currentMonthKey();
  const active = expenses.filter((e) => isInMonth(e.date, curr));
  const weekday = active.filter((e) => {
    const d = new Date(e.date).getDay();
    return d > 0 && d < 6;
  });
  const weekend = active.filter((e) => {
    const d = new Date(e.date).getDay();
    return d === 0 || d === 6;
  });
  const wdAvg = weekday.length > 0 ? weekday.reduce((s, e) => s + e.amount, 0) / weekday.length : 0;
  const weAvg = weekend.length > 0 ? weekend.reduce((s, e) => s + e.amount, 0) / weekend.length : 0;
  if (weekend.length === 0 || weekday.length === 0 || weAvg <= wdAvg * 1.05) return null;
  return {
    id: 'weekend-spend',
    icon: 'weekend',
    type: 'warning',
    title: 'Weekends are more expensive',
    description: `Your average weekend expense (${formatCurrency(Math.round(weAvg), currency)}) is higher than weekdays (${formatCurrency(Math.round(wdAvg), currency)}).`,
  };
}

function largestExpense(expenses, currency) {
  const curr = currentMonthKey();
  const active = expenses.filter((e) => isInMonth(e.date, curr));
  if (active.length === 0) return null;
  const biggest = active.reduce((max, e) => (e.amount > max.amount ? e : max), active[0]);
  return {
    id: 'biggest-expense',
    icon: 'flag',
    type: 'neutral',
    title: 'Biggest expense this month',
    description: `${biggest.description} (${formatCurrency(biggest.amount, currency)}) in ${biggest.category.toLowerCase()}.`,
  };
}

function avgDailySpend(expenses, currency) {
  const curr = currentMonthKey();
  const active = expenses.filter((e) => isInMonth(e.date, curr));
  if (active.length === 0) return null;
  const daysSoFar = new Date().getDate();
  const total = active.reduce((s, e) => s + e.amount, 0);
  const avg = Math.round(total / Math.max(daysSoFar, 1));
  return {
    id: 'daily-avg',
    icon: 'clock',
    type: 'neutral',
    title: 'Average daily spend',
    description: `You are spending approximately ${formatCurrency(avg, currency)} per day this month.`,
  };
}

function savingsRate(expenses, income, currency) {
  const curr = currentMonthKey();
  const totalExpenses = getTotalExpenses(expenses, curr);
  const savings = income - totalExpenses;
  if (income <= 0) return null;
  const rate = Math.round((savings / income) * 100);
  return {
    id: 'savings-rate',
    icon: 'piggy',
    type: savings > 0 ? 'good' : 'danger',
    title: savings > 0 ? 'You are saving money' : 'You are spending more than your income',
    description: savings > 0
      ? `You have saved ${formatCurrency(savings, currency)} (${rate}% savings rate) this month.`
      : `You have overspent by ${formatCurrency(Math.abs(savings), currency)} this month.`,
  };
}

export function buildInsights(expenses, budget, currency, income) {
  const results = [
    topCategory(expenses, currency),
    monthOverMonth(expenses, currency),
    ...budgetWarnings(expenses, budget, currency),
    weekendSpending(expenses, currency),
    largestExpense(expenses, currency),
    avgDailySpend(expenses, currency),
    savingsRate(expenses, income, currency),
  ].filter(Boolean);

  return results.slice(0, 8);
}