import { useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiSave } from 'react-icons/fi';
import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import {
  getCategoryTotals,
  getTotalExpenses,
  currentMonthKey,
  formatCurrency,
} from '../utils/format';
import ProgressBar from '../components/common/ProgressBar';
import useExpenseContext from '../context/ExpenseContext';

function Budget() {
  const { expenses, budget, updateBudget, setCategoryBudget, settings } = useExpenseContext();
  const [monthlyInput, setMonthlyInput] = useState(budget.monthly);

  const spent = getTotalExpenses(expenses, currentMonthKey());
  const remaining = budget.monthly - spent;
  const usedPct = budget.monthly > 0 ? (spent / budget.monthly) * 100 : 0;
  const categoryTotals = getCategoryTotals(expenses, CATEGORIES, currentMonthKey());

  function saveMonthly() {
    const value = parseFloat(monthlyInput);
    if (Number.isFinite(value) && value > 0) {
      updateBudget({ monthly: value });
    }
  }

  let monthlyStatus = 'ok';
  let monthlyMsg = `Great progress! You have ${formatCurrency(remaining, settings.currency)} left this month.`;
  if (usedPct >= 100) {
    monthlyStatus = 'over';
    monthlyMsg = `You are over your monthly budget by ${formatCurrency(Math.abs(remaining), settings.currency)}.`;
  } else if (usedPct >= 80) {
    monthlyStatus = 'warn';
    monthlyMsg = `Careful! You have used ${Math.round(usedPct)}% of your monthly budget.`;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget</h1>
          <p className="page-subtitle">Track your monthly and category limits</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Monthly Budget</div>
          </div>

          <div className="budget-head">
            <span>Total budget</span>
            <span className="budget-value">{formatCurrency(budget.monthly, settings.currency)}</span>
          </div>
          <div className="budget-head" style={{ marginTop: 6 }}>
            <span>Spent this month</span>
            <span className="amount-neg" style={{ fontWeight: 700 }}>
              {formatCurrency(spent, settings.currency)}
            </span>
          </div>
          <div className="budget-head" style={{ marginTop: 6 }}>
            <span>Remaining</span>
            <span className="amount-strong">{formatCurrency(remaining, settings.currency)}</span>
          </div>

          <ProgressBar value={usedPct} />

          {monthlyStatus === 'ok' ? (
            <div className="budget-msg ok">
              <FiCheckCircle /> {monthlyMsg}
            </div>
          ) : (
            <div className={`budget-msg ${monthlyStatus}`}>
              <FiAlertTriangle /> {monthlyMsg}
            </div>
          )}

          <div className="budget-edit-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="monthly-budget">
                Set your monthly budget
              </label>
              <input
                id="monthly-budget"
                className="form-input"
                type="number"
                min="0"
                value={monthlyInput}
                onChange={(e) => setMonthlyInput(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={saveMonthly}>
              <FiSave /> Save
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: 20, marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
            <div className="card-title">Category Budgets</div>
          </div>
          <div className="budget-grid" style={{ padding: 8 }}>
            {CATEGORIES.map((category) => {
              const limit = budget.categories[category] || 0;
              const catSpent = categoryTotals[category] || 0;
              const catRemaining = limit - catSpent;
              const catPct = limit > 0 ? (catSpent / limit) * 100 : 0;

              return (
                <div className="budget-item" key={category}>
                  <div className="budget-item-top">
                    <span className="budget-item-name">
                      <span className="chip-dot" style={{ background: CATEGORY_COLORS[category] }} />
                      {category}
                    </span>
                    <span className="budget-item-amounts">
                      {formatCurrency(catSpent, settings.currency)} /{' '}
                      {formatCurrency(limit, settings.currency)}
                    </span>
                  </div>

                  <ProgressBar value={catPct} />

                  <div className="budget-edit-row" style={{ marginTop: 12 }}>
                    <label className="hint" htmlFor={`budget-${category}`} style={{ alignSelf: 'center' }}>
                      Limit
                    </label>
                    <input
                      id={`budget-${category}`}
                      className="budget-limit-input"
                      type="number"
                      min="0"
                      value={limit}
                      onChange={(e) => setCategoryBudget(category, e.target.value)}
                    />
                    <span className="hint" style={{ alignSelf: 'center' }}>
                      {catPct >= 100
                        ? `Over by ${formatCurrency(Math.abs(catRemaining), settings.currency)}`
                        : `${formatCurrency(catRemaining, settings.currency)} left`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Budget;