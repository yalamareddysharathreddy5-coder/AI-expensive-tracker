import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import useExpenses from '../hooks/useExpenses';
import useBudget from '../hooks/useBudget';
import useLocalStorage from '../hooks/useLocalStorage';
import { generateSampleExpenses } from '../data/sampleData';
import { DEFAULT_SETTINGS } from '../data/constants';

const ExpenseContext = createContext(null);

function normalizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS };
  }
  const storedNotifications =
    value.notifications && typeof value.notifications === 'object' && !Array.isArray(value.notifications)
      ? value.notifications
      : {};
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...storedNotifications },
  };
}

export function ExpenseProvider({ children }) {
  const { expenses, addExpense, deleteExpense, replaceExpenses } =
    useExpenses(generateSampleExpenses);
  const { monthly, categories, updateMonthlyBudget, setCategoryBudget } = useBudget();
  const [settings, setSettings] = useLocalStorage(
    'expense-tracker.settings',
    DEFAULT_SETTINGS,
    normalizeSettings
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
  }, [settings.darkMode]);

  const budget = useMemo(() => ({ monthly, categories }), [monthly, categories]);

  const updateSettings = useCallback(
    (next) => {
      setSettings((prev) => ({ ...prev, ...next }));
    },
    [setSettings]
  );

  const resetSampleData = useCallback(() => {
    replaceExpenses(generateSampleExpenses());
  }, [replaceExpenses]);

  const value = useMemo(
    () => ({
      expenses,
      addExpense,
      deleteExpense,
      budget,
      updateMonthlyBudget,
      setCategoryBudget,
      settings,
      updateSettings,
      resetSampleData,
    }),
    [
      expenses,
      addExpense,
      deleteExpense,
      budget,
      updateMonthlyBudget,
      setCategoryBudget,
      settings,
      updateSettings,
      resetSampleData,
    ]
  );

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
}

export default function useExpenseContext() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenseContext must be used inside an ExpenseProvider');
  }
  return context;
}