import { createContext, useContext, useEffect } from 'react';
import useExpenses from '../hooks/useExpenses';
import useLocalStorage from '../hooks/useLocalStorage';
import { generateSampleExpenses } from '../data/sampleData';
import { DEFAULT_BUDGET, DEFAULT_SETTINGS } from '../data/constants';

const ExpenseContext = createContext(null);

export function ExpenseProvider({ children }) {
  const { expenses, addExpense, deleteExpense, replaceExpenses } =
    useExpenses(generateSampleExpenses);
  const [budget, setBudget] = useLocalStorage('expense-tracker.budget', DEFAULT_BUDGET);
  const [settings, setSettings] = useLocalStorage('expense-tracker.settings', DEFAULT_SETTINGS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
  }, [settings.darkMode]);

  function updateBudget(next) {
    setBudget((prev) => ({ ...prev, ...next }));
  }

  function setCategoryBudget(category, value) {
    setBudget((prev) => ({
      ...prev,
      categories: { ...prev.categories, [category]: Number(value) || 0 },
    }));
  }

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
        updateBudget,
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