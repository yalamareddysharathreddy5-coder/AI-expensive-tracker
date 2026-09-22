import { useState, useEffect, useCallback } from 'react';
import { loadExpenses, saveExpenses } from '../utils/storage';

export default function useExpenses(initialSeed) {
  const [expenses, setExpenses] = useState(() => {
    const stored = loadExpenses();
    if (stored !== null) return stored;

    const seed = typeof initialSeed === 'function' ? initialSeed() : initialSeed;
    return Array.isArray(seed) ? seed : [];
  });

  useEffect(() => {
    saveExpenses(expenses);
  }, [expenses]);

  const addExpense = useCallback((expense) => {
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const deleteExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
  }, []);

  const clearExpenses = useCallback(() => {
    setExpenses([]);
  }, []);

  const replaceExpenses = useCallback((next) => {
    setExpenses(Array.isArray(next) ? next : []);
  }, []);

  return { expenses, addExpense, deleteExpense, clearExpenses, replaceExpenses };
}