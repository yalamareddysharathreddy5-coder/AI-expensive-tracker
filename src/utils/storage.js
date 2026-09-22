export const EXPENSES_STORAGE_KEY = 'ai_expenses';
export const LEGACY_EXPENSES_STORAGE_KEY = 'expense-tracker.expenses';
export const MONTHLY_BUDGET_STORAGE_KEY = 'ai_monthly_budget';
export const CATEGORY_BUDGETS_STORAGE_KEY = 'ai_category_budgets';
export const LEGACY_BUDGET_STORAGE_KEY = 'expense-tracker.budget';

function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read "${key}" from localStorage`, error);
    return null;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not write "${key}" to localStorage`, error);
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Could not remove "${key}" from localStorage`, error);
  }
}

export function loadExpenses() {
  const stored = loadFromStorage(EXPENSES_STORAGE_KEY);
  if (Array.isArray(stored)) return stored;

  const legacy = loadFromStorage(LEGACY_EXPENSES_STORAGE_KEY);
  if (Array.isArray(legacy) && legacy.length > 0) {
    saveToStorage(EXPENSES_STORAGE_KEY, legacy);
    return legacy;
  }

  return null;
}

export function saveExpenses(expenses) {
  saveToStorage(EXPENSES_STORAGE_KEY, expenses);
}

export function clearStoredExpenses() {
  removeFromStorage(EXPENSES_STORAGE_KEY);
}

export function loadMonthlyBudget() {
  const stored = loadFromStorage(MONTHLY_BUDGET_STORAGE_KEY);
  if (Number.isFinite(Number(stored)) && Number(stored) > 0) {
    return Number(stored);
  }

  const legacy = loadFromStorage(LEGACY_BUDGET_STORAGE_KEY);
  if (legacy && Number.isFinite(Number(legacy.monthly)) && Number(legacy.monthly) > 0) {
    const migrated = Number(legacy.monthly);
    saveToStorage(MONTHLY_BUDGET_STORAGE_KEY, migrated);
    return migrated;
  }

  return null;
}

export function saveMonthlyBudget(budget) {
  saveToStorage(MONTHLY_BUDGET_STORAGE_KEY, budget);
}

export function saveCategoryBudgets(budgets) {
  saveToStorage(CATEGORY_BUDGETS_STORAGE_KEY, budgets);
}

export function loadCategoryBudgets() {
  const stored = loadFromStorage(CATEGORY_BUDGETS_STORAGE_KEY);
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return stored;
  }

  const legacy = loadFromStorage(LEGACY_BUDGET_STORAGE_KEY);
  if (legacy && legacy.categories && typeof legacy.categories === 'object') {
    const migrated = {};
    Object.entries(legacy.categories).forEach(([category, value]) => {
      if (Number.isFinite(Number(value)) && Number(value) > 0) migrated[category] = Number(value);
    });
    saveToStorage(CATEGORY_BUDGETS_STORAGE_KEY, migrated);
    return migrated;
  }

  return {};
}