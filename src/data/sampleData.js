import { generateId } from '../utils/expense';

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toISODate(d);
}

function makeExpense(category, description, amount, paymentMethod, date) {
  return {
    id: generateId(),
    category,
    description,
    amount: Number(amount),
    paymentMethod,
    date,
    createdAt: new Date().toISOString(),
  };
}

const THIS_MONTH_SAMPLES = [
  ['Food', 'Lunch with friends', 260, 'UPI'],
  ['Transportation', 'Metro card recharge', 200, 'UPI'],
  ['Shopping', 'Groceries from supermarket', 1450, 'Credit Card'],
  ['Bills', 'Electricity bill', 980, 'UPI'],
  ['Entertainment', 'Movie tickets', 640, 'UPI'],
  ['Food', 'Coffee and snacks', 150, 'Cash'],
  ['Education', 'Online course book', 799, 'Credit Card'],
  ['Healthcare', 'Pharmacy medicines', 320, 'Cash'],
  ['Food', 'Dinner at restaurant', 480, 'UPI'],
  ['Transportation', 'Cab to campus', 340, 'UPI'],
  ['Shopping', 'New headphones', 1299, 'Debit Card'],
  ['Bills', 'Internet bill', 699, 'UPI'],
  ['Other', 'Birthday gift', 350, 'Cash'],
  ['Entertainment', 'Concert ticket', 899, 'Credit Card'],
];

const LAST_MONTH_SAMPLES = [
  ['Food', 'Monthly grocery run', 2100, 'UPI'],
  ['Bills', 'Mobile recharge', 299, 'UPI'],
  ['Food', 'Street food', 180, 'Cash'],
  ['Shopping', 'T-shirt and jeans', 1600, 'Debit Card'],
  ['Transportation', 'Bus pass', 500, 'UPI'],
  ['Healthcare', 'Dental checkup', 650, 'Cash'],
  ['Entertainment', 'Streaming subscription', 299, 'Credit Card'],
  ['Education', 'Notebooks and stationery', 240, 'Cash'],
  ['Food', 'Pizza night', 550, 'UPI'],
  ['Travel', 'Weekend getaway travel', 1500, 'Credit Card'],
];

const OLDER_SAMPLES = [
  ['Food', 'Cafeteria lunch', 130, 'Cash'],
  ['Shopping', 'Phone case', 350, 'UPI'],
  ['Bills', 'Water bill', 410, 'UPI'],
  ['Entertainment', 'Gaming accessories', 1200, 'Debit Card'],
  ['Transportation', 'Fuel for scooter', 800, 'Cash'],
];

const SAMPLE_BANK = [...THIS_MONTH_SAMPLES, ...LAST_MONTH_SAMPLES, ...OLDER_SAMPLES];

export function generateSampleExpenses() {
  return SAMPLE_BANK.map(([category, description, amount, paymentMethod], index) =>
    makeExpense(
      category,
      description,
      amount,
      paymentMethod,
      dateOffset(index < THIS_MONTH_SAMPLES.length ? index + 1 : index + 34)
    )
  );
}