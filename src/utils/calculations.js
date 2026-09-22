import { currentMonthKey, previousMonthKey, getTotalExpenses, getCategoryTotals } from './format';
import { CATEGORIES } from '../data/constants';

export function calculateTotalExpenses(expenses) {
  return getTotalExpenses(expenses);
}

export function calculateMonthlyExpenses(expenses, key) {
  return getTotalExpenses(expenses, key);
}

export function calculateCurrentMonthExpenses(expenses) {
  return calculateMonthlyExpenses(expenses, currentMonthKey());
}

export function calculatePreviousMonthExpenses(expenses) {
  return calculateMonthlyExpenses(expenses, previousMonthKey());
}

export function calculateAverageExpense(expenses) {
  if (!Array.isArray(expenses) || expenses.length === 0) return 0;
  return calculateTotalExpenses(expenses) / expenses.length;
}

export function calculateCategoryTotals(expenses, key) {
  return getCategoryTotals(expenses, CATEGORIES, key);
}

export function calculatePercentageChange(current, previous) {
  const curr = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}