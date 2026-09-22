import { CATEGORIES, PAYMENT_METHODS } from '../data/constants';

export function generateId() {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createExpense({ amount, category, description, date, paymentMethod, categorySource }) {
  const expense = {
    id: generateId(),
    amount: Number(amount),
    category,
    description: description.trim(),
    date,
    paymentMethod,
    createdAt: new Date().toISOString(),
  };
  if (categorySource === 'ai') {
    expense.categorySource = 'ai';
  }
  return expense;
}

export function validateExpense({ amount, category, description, date, paymentMethod }) {
  const errors = {};
  const parsed = Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.amount = 'Please enter an amount greater than 0.';
  }
  if (typeof description !== 'string' || description.trim().length === 0) {
    errors.description = 'Please add a short description.';
  }
  if (!date) {
    errors.date = 'Please choose a date.';
  }
  if (!CATEGORIES.includes(category)) {
    errors.category = 'Please choose a category.';
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    errors.paymentMethod = 'Please choose a payment method.';
  }

  return errors;
}