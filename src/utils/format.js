export function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function isInMonth(dateStr, key) {
  return dateStr.startsWith(key);
}

export function isCurrentMonth(dateStr) {
  return isInMonth(dateStr, currentMonthKey());
}

export function previousMonthKey() {
  const d = new Date();
  return monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

export function formatCurrency(amount, symbol) {
  const value = Number(amount) || 0;
  return `${symbol}${value.toLocaleString('en-US')}`;
}

export function formatCompactCurrency(amount, symbol) {
  const value = Number(amount) || 0;
  if (value >= 1000) {
    return `${symbol}${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${symbol}${value}`;
}

export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function toPositiveFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function sumBy(list, getAmount) {
  return list.reduce((total, item) => total + getAmount(item), 0);
}

export function getTotalExpenses(expenses, monthKey) {
  return expenses
    .filter((e) => !monthKey || isInMonth(e.date, monthKey))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getCategoryTotals(expenses, categories, monthKey) {
  const active = monthKey ? expenses.filter((e) => isInMonth(e.date, monthKey)) : expenses;
  const totals = {};
  categories.forEach((category) => {
    totals[category] = active
      .filter((e) => e.category === category)
      .reduce((sum, e) => sum + e.amount, 0);
  });
  return totals;
}

export function getLastMonthlySeries(expenses, count) {
  const now = new Date();
  const totals = {};
  expenses.forEach((e) => {
    const key = e.date.slice(0, 7);
    totals[key] = (totals[key] || 0) + e.amount;
  });

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const key = monthKey(d);
    const label = d.toLocaleString('en-US', { month: 'short' });
    return { key, label, value: totals[key] || 0 };
  });
}

export function sortExpensesNewestFirst(expenses) {
  return [...expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}