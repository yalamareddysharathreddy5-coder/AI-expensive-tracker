import { useState } from 'react';
import { FiPlus, FiCheckCircle } from 'react-icons/fi';
import { CATEGORIES, PAYMENT_METHODS } from '../data/constants';
import { todayISO } from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';

function AddExpense() {
  const { addExpense, settings } = useExpenseContext();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [errors, setErrors] = useState({});
  const [successId, setSuccessId] = useState(null);

  function validate() {
    const nextErrors = {};
    const parsedAmount = parseFloat(amount);

    if (description.trim().length === 0) {
      nextErrors.description = 'Please add a short description.';
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Please enter an amount greater than 0.';
    }
    if (!date) {
      nextErrors.date = 'Please choose a date.';
    }
    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      date,
      paymentMethod,
    };

    addExpense(expense);
    setAmount('');
    setDescription('');
    setDate(todayISO());
    setSuccessId(expense.id);

    window.setTimeout(() => setSuccessId(null), 4000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Expense</h1>
          <p className="page-subtitle">Record a new transaction</p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card" style={{ gridColumn: '1 / -1', maxWidth: 720 }}>
          <form onSubmit={handleSubmit} noValidate>
            {successId && (
              <div className="alert alert-success">
                <FiCheckCircle /> Expense added successfully!
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="amount">
                Amount ({settings.currency})
              </label>
              <input
                id="amount"
                className={`form-input${errors.amount ? ' invalid' : ''}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {errors.amount && <div className="input-error">{errors.amount}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="category">
                Category
              </label>
              <div className="select-wrap">
                <select
                  id="category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">
                Description
              </label>
              <input
                id="description"
                className={`form-input${errors.description ? ' invalid' : ''}`}
                type="text"
                placeholder="e.g. Lunch with friends"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {errors.description && <div className="input-error">{errors.description}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="date">
                Date
              </label>
              <input
                id="date"
                className={`form-input${errors.date ? ' invalid' : ''}`}
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <div className="input-error">{errors.date}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="payment-method">
                Payment Method
              </label>
              <div className="select-wrap">
                <select
                  id="payment-method"
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                <FiPlus /> Add Expense
              </button>
              <span className="hint" style={{ alignSelf: 'center' }}>
                Data is stored locally in your browser.
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddExpense;