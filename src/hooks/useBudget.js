import { useState, useEffect, useCallback } from 'react';
import {
  loadMonthlyBudget,
  saveMonthlyBudget,
  loadCategoryBudgets,
  saveCategoryBudgets,
} from '../utils/storage';

export default function useBudget() {
  const [monthly, setMonthly] = useState(loadMonthlyBudget);
  const [categories, setCategories] = useState(loadCategoryBudgets);

  useEffect(() => {
    saveMonthlyBudget(monthly);
  }, [monthly]);

  useEffect(() => {
    saveCategoryBudgets(categories);
  }, [categories]);

  const updateMonthlyBudget = useCallback((value) => {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) {
      setMonthly(amount);
    }
  }, []);

  const setCategoryBudget = useCallback((category, value) => {
    const amount = Number(value);
    const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    setCategories((prev) => ({
      ...prev,
      [category]: safeAmount > 0 ? safeAmount : undefined,
    }));
  }, []);

  return { monthly, categories, updateMonthlyBudget, setCategoryBudget };
}