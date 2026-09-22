import { useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiSave } from 'react-icons/fi';
import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import { currentMonthKey, formatCurrency } from '../utils/format';
import {
  getMonthlyBudgetStatus,
  calculateCategoryBudgetUsage,
} from '../utils/budget';
import {
  calculateCurrentMonthExpenses,
  calculateCategoryTotals,
} from '../utils/calculations';
import ProgressBar from '../components/common/ProgressBar';
import useExpenseContext from '../context/ExpenseContext';

function Budget() {
  const { expenses, budget, updateMonthlyBudget, setCategoryBudget, settings } =
    useExpenseContext();
  const [monthlyInput, setMonthlyInput] = useState(budget.monthly ?? '');
  const [monthlyError, setMonthlyError] = useState('');

  const spent = calculateCurrentMonthExpenses(expenses);
  const budgetStatus = getMonthlyBudgetStatus(budget.monthly, spent, settings.currency);
  const categoryTotals = calculateCategoryTotals(expenses, currentMonthKey());
  const categoryBudgets = calculateCategoryBudgetUsage(
    budget.categories,
    categoryTotals,
    CATEGORIES
  );

  function handleMonthlySubmit(event) {
    event.preventDefault();
    const value = Number(monthlyInput);
    if (String(monthlyInput).trim() === '' || !Number.isFinite(value) || value <= 0) {
      setMonthlyError('Please enter a budget greater than 0');
      return;
    }
    updateMonthlyBudget(value);
    setMonthlyInput(value);
    setMonthlyError('');
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

          {budget.monthly ? (
            <>
              <div className="budget-head">
                <span>Total budget</span>
                <span className="budget-value">
                  {formatCurrency(budget.monthly, settings.currency)}
                </span>
              </div>
              <div className="budget-head" style={{ marginTop: 6 }}>
                <span>Spent this month</span>
                <span className="amount-neg" style={{ fontWeight: 700 }}>
                  {formatCurrency(spent, settings.currency)}
                </span>
              </div>
              <div className="budget-head" style={{ marginTop: 6 }}>
                <span>{budgetStatus.remaining < 0 ? 'Over budget' : 'Remaining'}</span>
                <span className={budgetStatus.remaining < 0 ? 'amount-neg' : 'amount-strong'}>
                  {formatCurrency(Math.abs(budgetStatus.remaining), settings.currency)}
                </span>
              </div>

              <ProgressBar value={budgetStatus.usage} />

              <div className="budget-usage">
                <span>{Math.round(budgetStatus.usage)}% of budget used</span>
              </div>

              {budgetStatus.key === 'ok' ? (
                <div className="budget-msg ok">
                  <FiCheckCircle /> {budgetStatus.message}
                </div>
              ) : (
                <div className={`budget-msg ${budgetStatus.key === 'over' ? 'over' : 'warn'}`}>
                  <FiAlertTriangle /> {budgetStatus.message}
                </div>
              )}
            </>
          ) : (
            <div className="budget-empty">
              <div className="budget-empty-title">No monthly budget set</div>
              <p>Set a monthly budget to track how much you spend each month.</p>
            </div>
          )}

          <form className="budget-edit-row" onSubmit={handleMonthlySubmit}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="monthly-budget">
                {budget.monthly ? 'Update your monthly budget' : 'Set your monthly budget'}
              </label>
              <input
                id="monthly-budget"
                className={`form-input${monthlyError ? ' invalid' : ''}`}
                type="number"
                min="0"
                placeholder="0"
                value={monthlyInput}
                onChange={(e) => {
                  setMonthlyInput(e.target.value);
                  if (monthlyError) setMonthlyError('');
                }}
              />
              {monthlyError && <div className="input-error">{monthlyError}</div>}
            </div>
            <button className="btn btn-primary" type="submit">
              <FiSave /> {budget.monthly ? 'Update' : 'Set Budget'}
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: 20, marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
            <div className="card-title">Category Budgets</div>
          </div>
          <div className="budget-grid" style={{ padding: 8 }}>
            {categoryBudgets.map((category) => {
              const { category: name, limit, spent: catSpent, usage, remaining, status } = category;

              return (
                <div className="budget-item" key={name}>
                  <div className="budget-item-top">
                    <span className="budget-item-name">
                      <span className="chip-dot" style={{ background: CATEGORY_COLORS[name] }} />
                      {name}
                    </span>
                    <span className="budget-item-amounts">
                      {formatCurrency(catSpent, settings.currency)} /{' '}
                      {formatCurrency(limit, settings.currency)}
                    </span>
                  </div>

                  {limit > 0 && <ProgressBar value={usage} />}

                  <div className="budget-item-status">
                    <span className="hint">
                      {limit > 0
                        ? remaining >= 0
                          ? `${formatCurrency(remaining, settings.currency)} left`
                          : `Over by ${formatCurrency(Math.abs(remaining), settings.currency)}`
                        : 'Set a limit to track this category'}
                    </span>
                    {limit > 0 && <span className={`tag ${status.tone}`}>{status.label}</span>}
                  </div>

                  <div className="budget-edit-row" style={{ marginTop: 12 }}>
                    <label className="hint" htmlFor={`budget-${name}`} style={{ alignSelf: 'center' }}>
                      Limit
                    </label>
                    <input
                      id={`budget-${name}`}
                      className="budget-limit-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={limit}
                      onChange={(e) => setCategoryBudget(name, e.target.value)}
                    />
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