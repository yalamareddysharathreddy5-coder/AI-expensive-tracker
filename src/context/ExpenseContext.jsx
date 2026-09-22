import { createContext, useContext, useEffect } from 'react';
import useExpenses from '../hooks/useExpenses';
import useBudget from '../hooks/useBudget';
import useLocalStorage from '../hooks/useLocalStorage';
import { generateSampleExpenses } from '../data/sampleData';
import { DEFAULT_SETTINGS } from '../data/constants';

const ExpenseContext = createContext(null);

export function ExpenseProvider({ children }) {
  const { expenses, addExpense, deleteExpense, replaceExpenses } =
    useExpenses(generateSampleExpenses);
  const { monthly, categories, updateMonthlyBudget, setCategoryBudget } = useBudget();
  const [settings, setSettings] = useLocalStorage('expense-tracker.settings', DEFAULT_SETTINGS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
  }, [settings.darkMode]);

  const budget = { monthly, categories };

  function updateSettings(next) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  function resetSampleData() {
    replaceExpenses(generateSampleExpenses());
  }

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        addExpense,
        deleteExpense,
        budget,
        updateMonthlyBudget,
        setCategoryBudget,
        settings,
        updateSettings,
        resetSampleData,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export default function useExpenseContext() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenseContext must be used inside an ExpenseProvider');
  }
  return context;
}