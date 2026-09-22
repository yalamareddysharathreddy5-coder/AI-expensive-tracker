export function calculateBudgetUsage(spent, budget) {
  const amount = Number(spent) || 0;
  const limit = Number(budget);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return (amount / limit) * 100;
}

export function calculateRemainingBudget(budget, spent) {
  const limit = Number(budget);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return limit - (Number(spent) || 0);
}

export function getBudgetStatus(usagePct) {
  if (usagePct === null || !Number.isFinite(usagePct)) {
    return { key: 'unset', label: 'No budget set', tone: 'neutral' };
  }
  if (usagePct < 70) return { key: 'ok', label: 'Within budget', tone: 'good' };
  if (usagePct < 90) return { key: 'warning', label: 'Approaching budget', tone: 'warning' };
  if (usagePct < 100) return { key: 'near', label: 'Near budget limit', tone: 'danger' };
  return { key: 'over', label: 'Over budget', tone: 'danger' };
}

export function getMonthlyBudgetStatus(budget, spent, symbol) {
  const usage = calculateBudgetUsage(spent, budget);
  const remaining = calculateRemainingBudget(budget, spent);
  const status = getBudgetStatus(usage);

  let message;
  if (status.key === 'over') {
    message = `Over budget by ${symbol}${Math.abs(remaining).toLocaleString('en-US')}.`;
  } else if (status.key === 'near') {
    message = `Near budget limit - ${Math.round(usage)}% used.`;
  } else if (status.key === 'warning') {
    message = `Approaching budget - ${Math.round(usage)}% used.`;
  } else if (status.key === 'ok' && remaining !== null) {
    message = `${symbol}${remaining.toLocaleString('en-US')} left this month.`;
  } else {
    message = 'No budget set.';
  }

  return { budget, spent, usage, remaining, status, message };
}

export function calculateCategoryBudgetUsage(categoryBudgets, categorySpending, categories) {
  return categories.map((category) => {
    const limit = Number(categoryBudgets[category]) || 0;
    const spent = Number(categorySpending[category]) || 0;
    const usage = limit > 0 ? (spent / limit) * 100 : null;
    const remaining = limit > 0 ? limit - spent : null;
    return { category, limit, spent, usage, remaining, status: getBudgetStatus(usage) };
  });
}