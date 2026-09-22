export const CATEGORIES = [
  'Food',
  'Transportation',
  'Shopping',
  'Bills',
  'Entertainment',
  'Education',
  'Healthcare',
  'Travel',
  'Other',
];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other'];

export const CURRENCIES = ['₹', '$', '€', '£', '¥'];

export const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Transportation: '#3b82f6',
  Shopping: '#ec4899',
  Bills: '#ef4444',
  Entertainment: '#8b5cf6',
  Education: '#06b6d4',
  Healthcare: '#10b981',
  Travel: '#f97316',
  Other: '#64748b',
};

export const DEFAULT_BUDGET = {
  monthly: 20000,
  categories: {
    Food: 5000,
    Transportation: 3000,
    Shopping: 4000,
    Bills: 3000,
    Entertainment: 2000,
    Education: 2000,
    Healthcare: 2000,
    Travel: 2000,
    Other: 1000,
  },
};

export const DEFAULT_SETTINGS = {
  name: '',
  email: '',
  currency: '₹',
  income: 50000,
  darkMode: false,
  notifications: {
    expenseAdded: true,
    budgetWarning: true,
    weeklySummary: false,
  },
};