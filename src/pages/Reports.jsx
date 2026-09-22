import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTrendingDown,
  FiCalendar,
  FiList,
  FiCreditCard,
  FiPieChart,
  FiCheckCircle,
  FiAlertTriangle,
  FiFilter,
} from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import ProgressBar from '../components/common/ProgressBar';
import EmptyState from '../components/common/EmptyState';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS, PAYMENT_COLORS } from '../data/constants';
import {
  calculateTotalExpenses,
  calculateAverageExpense,
  calculateCurrentMonthExpenses,
  calculatePreviousMonthExpenses,
  calculateCategoryTotals,
  calculatePercentageChange,
} from '../utils/calculations';
import { formatCurrency, currentMonthKey } from '../utils/format';
import {
  DATE_RANGES,
  filterExpenses,
  calculateMonthlyTrend,
  calculateCategoryBreakdown,
  calculatePaymentBreakdown,
  calculateHighestExpense,
  calculateLowestExpense,
  calculateMostSpentCategory,
  calculateMostUsedPaymentMethod,
} from '../utils/reports';
import { getMonthlyBudgetStatus, calculateCategoryBudgetUsage } from '../utils/budget';
import useExpenseContext from '../context/ExpenseContext';

function Reports() {
  const { expenses, budget, settings } = useExpenseContext();

  const [range, setRange] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const filtered = useMemo(
    () =>
      filterExpenses(expenses, {
        range,
        from: fromDate,
        to: toDate,
        category: categoryFilter,
        payment: paymentFilter,
      }),
    [expenses, range, fromDate, toDate, categoryFilter, paymentFilter]
  );

  const rangeLabel = DATE_RANGES.find((r) => r.key === range).label;

  const totalExpenses = calculateTotalExpenses(filtered);
  const totalTransactions = filtered.length;
  const averageExpense = calculateAverageExpense(filtered);
  const currentMonthSpent = calculateCurrentMonthExpenses(expenses);
  const previousMonthSpent = calculatePreviousMonthExpenses(expenses);
  const monthChange = calculatePercentageChange(currentMonthSpent, previousMonthSpent);
  const monthDiff = currentMonthSpent - previousMonthSpent;

  const highest = calculateHighestExpense(filtered);
  const lowest = calculateLowestExpense(filtered);
  const mostSpentCategory = calculateMostSpentCategory(filtered);
  const mostUsedPayment = calculateMostUsedPaymentMethod(filtered);

  const monthlyTrend = calculateMonthlyTrend(filtered, 6);
  const categoryBreakdown = calculateCategoryBreakdown(filtered);
  const categoryDonutData = categoryBreakdown.map((c) => ({
    label: c.category,
    value: c.value,
    color: c.color,
  }));
  const paymentBreakdown = calculatePaymentBreakdown(filtered);
  const paymentDonutData = paymentBreakdown.map((p) => ({
    label: p.method,
    value: p.value,
    color: PAYMENT_COLORS[p.method] || '#64748b',
  }));
  const donutSubLabel = range === 'all' ? 'total spending' : `in ${rangeLabel.toLowerCase()}`;

  const budgetOverview = getMonthlyBudgetStatus(budget.monthly, currentMonthSpent, settings.currency);
  const currentCategoryTotals = calculateCategoryTotals(expenses, currentMonthKey());
  const categoryBudgets = calculateCategoryBudgetUsage(
    budget.categories,
    currentCategoryTotals,
    CATEGORIES
  ).filter((c) => c.limit > 0 || c.spent > 0);

  const now = new Date();
  const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const previousMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString(
    'en-US',
    { month: 'long' }
  );

  function clearFilters() {
    setRange('all');
    setFromDate('');
    setToDate('');
    setCategoryFilter('all');
    setPaymentFilter('all');
  }

  function handleRangeChange(nextRange) {
    setRange(nextRange);
    if (nextRange !== 'custom') {
      setFromDate('');
      setToDate('');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Detailed analytics from your real expense data</p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No expense data available for this report"
            message="Add expenses to start building your reports and analytics."
            action={
              <Link to="/add" className="btn btn-primary">
                <FiCreditCard /> Add Expense
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="filters-row" style={{ marginBottom: 0 }}>
              <div className="select-wrap">
                <select
                  className="form-select"
                  aria-label="Filter by date range"
                  value={range}
                  onChange={(e) => handleRangeChange(e.target.value)}
                >
                  {DATE_RANGES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {range === 'custom' && (
                <>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                    <label className="form-label" htmlFor="report-from">
                      From
                    </label>
                    <input
                      id="report-from"
                      className="form-input"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                    <label className="form-label" htmlFor="report-to">
                      To
                    </label>
                    <input
                      id="report-to"
                      className="form-input"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="select-wrap">
                <select
                  className="form-select"
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="select-wrap">
                <select
                  className="form-select"
                  aria-label="Filter by payment method"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                >
                  <option value="all">All Payment Methods</option>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn btn-outline btn-clear" onClick={clearFilters}>
                <FiFilter /> Clear Filters
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No expenses match the selected filters"
                message="Try a different date range, category or payment method."
                action={
                  <button className="btn btn-outline" onClick={clearFilters}>
                    <FiFilter /> Clear Filters
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <StatCard
                  icon={<FiTrendingDown />}
                  tone="red"
                  label="Total Expenses"
                  value={formatCurrency(totalExpenses, settings.currency)}
                  hint={rangeLabel}
                />
                <StatCard
                  icon={<FiCalendar />}
                  tone="amber"
                  label="Current Month Expenses"
                  value={formatCurrency(currentMonthSpent, settings.currency)}
                  hint={currentMonthLabel}
                />
                <StatCard
                  icon={<FiList />}
                  label="Transactions"
                  value={totalTransactions}
                  hint="In selected range"
                />
                <StatCard
                  icon={<FiCreditCard />}
                  tone="green"
                  label="Average Expense"
                  value={formatCurrency(Math.round(averageExpense), settings.currency)}
                  hint="Per transaction"
                />
              </div>

              <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Monthly Spending Trend</div>
                  </div>
                  <BarChart data={monthlyTrend} symbol={settings.currency} />
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Category Breakdown</div>
                  </div>
                  <DonutChart
                    data={categoryDonutData}
                    symbol={settings.currency}
                    centerSubLabel={donutSubLabel}
                  />
                </div>
              </div>

              <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Payment Methods</div>
                  </div>
                  <DonutChart
                    data={paymentDonutData}
                    symbol={settings.currency}
                    centerSubLabel={donutSubLabel}
                  />
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Monthly Comparison</div>
                  </div>
                  <div className="budget-head">
                    <span>Current Month</span>
                    <span className="budget-value">
                      {formatCurrency(currentMonthSpent, settings.currency)}
                    </span>
                  </div>
                  <div className="budget-head" style={{ marginTop: 6 }}>
                    <span>Previous Month</span>
                    <span className="amount-strong">
                      {formatCurrency(previousMonthSpent, settings.currency)}
                    </span>
                  </div>
                  <div className="budget-head" style={{ marginTop: 6 }}>
                    <span>Difference</span>
                    <span className={monthDiff < 0 ? 'amount-neg' : 'amount-strong'}>
                      {formatCurrency(Math.abs(monthDiff), settings.currency)}
                    </span>
                  </div>
                  {previousMonthSpent > 0 ? (
                    <div className={`budget-msg ${monthDiff > 0 ? 'warn' : 'ok'}`}>
                      {monthDiff > 0 ? <FiAlertTriangle /> : <FiCheckCircle />}
                      {monthChange > 0 ? '+' : ''}
                      {monthChange.toFixed(1)}% vs {previousMonthLabel}
                    </div>
                  ) : (
                    <div className="budget-msg warn">
                      <FiAlertTriangle /> No previous month data to compare.
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <div className="card-title">
                    <FiPieChart /> Budget vs Spending
                  </div>
                  <Link to="/budget" className="link-btn">
                    Manage
                  </Link>
                </div>

                {budget.monthly ? (
                  <>
                    <div className="budget-head">
                      <span>Monthly Budget</span>
                      <span className="budget-value">
                        {formatCurrency(budget.monthly, settings.currency)}
                      </span>
                    </div>
                    <div className="budget-head" style={{ marginTop: 6 }}>
                      <span>Monthly Spending</span>
                      <span className="amount-neg" style={{ fontWeight: 700 }}>
                        {formatCurrency(budgetOverview.spent, settings.currency)}
                      </span>
                    </div>
                    <div className="budget-head" style={{ marginTop: 6 }}>
                      <span>{budgetOverview.remaining < 0 ? 'Over budget' : 'Remaining'}</span>
                      <span className={budgetOverview.remaining < 0 ? 'amount-neg' : 'amount-strong'}>
                        {formatCurrency(Math.abs(budgetOverview.remaining), settings.currency)}
                      </span>
                    </div>

                    <ProgressBar value={budgetOverview.usage} />

                    <div className="budget-usage">
                      <span>
                        {Math.round(budgetOverview.usage)}% of budget used ({currentMonthLabel})
                      </span>
                    </div>

                    {budgetOverview.key === 'ok' ? (
                      <div className="budget-msg ok">
                        <FiCheckCircle /> {budgetOverview.message}
                      </div>
                    ) : (
                      <div className={`budget-msg ${budgetOverview.key === 'over' ? 'over' : 'warn'}`}>
                        <FiAlertTriangle /> {budgetOverview.message}
                      </div>
                    )}

                    <div className="report-section-title">Category Budgets</div>
                    {categoryBudgets.length === 0 ? (
                      <p className="hint" style={{ margin: 0 }}>
                        No category budgets set.{' '}
                        <Link to="/budget" className="link-btn">
                          Set category budgets
                        </Link>
                      </p>
                    ) : (
                      <div className="budget-grid">
                        {categoryBudgets.map((c) => (
                          <div className="budget-item" key={c.category}>
                            <div className="budget-item-top">
                              <span className="budget-item-name">
                                <span
                                  className="chip-dot"
                                  style={{ background: CATEGORY_COLORS[c.category] }}
                                />
                                {c.category}
                              </span>
                              <span className="budget-item-amounts">
                                {formatCurrency(c.spent, settings.currency)} /{' '}
                                {formatCurrency(c.limit, settings.currency)}
                              </span>
                            </div>
                            {c.limit > 0 && <ProgressBar value={c.usage} />}
                            <div className="budget-item-status">
                              <span className="hint">
                                {c.limit > 0
                                  ? c.remaining >= 0
                                    ? `${formatCurrency(c.remaining, settings.currency)} left`
                                    : `Over by ${formatCurrency(Math.abs(c.remaining), settings.currency)}`
                                  : 'No limit set for this category'}
                              </span>
                              {c.limit > 0 && <span className={`tag ${c.status.tone}`}>{c.status.label}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="hint" style={{ margin: 0 }}>
                    No monthly budget set yet. <Link to="/budget">Set a budget</Link> to compare it
                    with your spending.
                  </p>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Financial Statistics</div>
                </div>
                <div className="report-stats">
                  <div className="report-stat">
                    <span className="report-stat-label">Highest Expense</span>
                    <span className="report-stat-value">
                      {formatCurrency(highest.amount, settings.currency)}
                    </span>
                    <span className="report-stat-sub">
                      {highest.category} · {highest.description}
                    </span>
                  </div>
                  <div className="report-stat">
                    <span className="report-stat-label">Lowest Expense</span>
                    <span className="report-stat-value">
                      {formatCurrency(lowest.amount, settings.currency)}
                    </span>
                    <span className="report-stat-sub">
                      {lowest.category} · {lowest.description}
                    </span>
                  </div>
                  <div className="report-stat">
                    <span className="report-stat-label">Most Spent Category</span>
                    <span className="report-stat-value">{mostSpentCategory.category}</span>
                    <span className="report-stat-sub">
                      {formatCurrency(mostSpentCategory.value, settings.currency)} in range
                    </span>
                  </div>
                  <div className="report-stat">
                    <span className="report-stat-label">Most Used Payment Method</span>
                    <span className="report-stat-value">{mostUsedPayment.method}</span>
                    <span className="report-stat-sub">
                      {mostUsedPayment.count} transaction{mostUsedPayment.count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Reports;