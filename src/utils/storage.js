export const EXPENSES_STORAGE_KEY = 'ai_expenses';
export const LEGACY_EXPENSES_STORAGE_KEY = 'expense-tracker.expenses';

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