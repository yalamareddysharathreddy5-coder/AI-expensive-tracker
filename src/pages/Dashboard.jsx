import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiTrendingDown,
  FiCalendar,
  FiList,
  FiCreditCard,
  FiPieChart,
  FiCheckCircle,
  FiAlertTriangle,
} from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import AIInsightsPreview from '../components/dashboard/AIInsightsPreview';
import EmptyState from '../components/common/EmptyState';
import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import {
  calculateTotalExpenses,
  calculateAverageExpense,
  calculateCurrentMonthExpenses,
  calculatePreviousMonthExpenses,
  calculateCategoryTotals,
  calculatePercentageChange,
} from '../utils/calculations';
import { getLastMonthlySeries, formatCurrency, currentMonthKey } from '../utils/format';
import { getMonthlyBudgetStatus } from '../utils/budget';
import useExpenseContext from '../context/ExpenseContext';

function Dashboard() {
  const { expenses, budget, settings } = useExpenseContext();

  const totalExpenses = calculateTotalExpenses(expenses);
  const averageExpense = calculateAverageExpense(expenses);
  const currentMonthSpent = calculateCurrentMonthExpenses(expenses);
  const previousMonthSpent = calculatePreviousMonthExpenses(expenses);
  const transactionCount = expenses.length;
  const monthChange = calculatePercentageChange(currentMonthSpent, previousMonthSpent);

  const balance = settings.income - totalExpenses;
  const monthlySeries = getLastMonthlySeries(expenses, 6);
  const hasExpenses = transactionCount > 0;

  const categoryTotals = calculateCategoryTotals(expenses, currentMonthKey());
  const donutData = CATEGORIES.filter((c) => categoryTotals[c] > 0)
    .map((c) => ({ label: c, value: categoryTotals[c], color: CATEGORY_COLORS[c] }))
    .sort((a, b) => b.value - a.value);
  const monthTotal = monthlySeries.reduce((sum, m) => sum + m.value, 0);
  const budgetOverview = getMonthlyBudgetStatus(budget.monthly, currentMonthSpent, settings.currency);

  const now = new Date();
  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const previousMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString(
    'en-US',
    { month: 'long' }
  );

  const trendText = previousMonthSpent === 0
    ? 'No previous month data yet'
    : `${monthChange > 0 ? '+' : ''}${monthChange.toFixed(1)}% vs ${previousMonthLabel}`;
  const trendClass = previousMonthSpent === 0 ? '' : monthChange > 0 ? 'bad' : 'good';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <Link to="/add" className="btn btn-primary">
          <FiPlus /> Quick Add Expense
        </Link>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={<FiTrendingDown />}
          tone="red"
          label="Total Expenses"
          value={formatCurrency(totalExpenses, settings.currency)}
          hint="All-time spending"
        />
        <StatCard
          icon={<FiCalendar />}
          tone="amber"
          label="Current Month"
          value={formatCurrency(currentMonthSpent, settings.currency)}
          hint={currentMonthLabel}
        />
        <StatCard
          icon={<FiList />}
          label="Transactions"
          value={transactionCount}
          hint="All-time transactions"
        />
        <StatCard
          icon={<FiCreditCard />}
          tone="green"
          label="Average Expense"
          value={formatCurrency(Math.round(averageExpense), settings.currency)}
          hint="Per transaction"
        />
      </div>

      {hasExpenses ? (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="snapshot">
              <div>
                <div className="snapshot-label">Monthly Income</div>
                <div className="snapshot-value">
                  {formatCurrency(settings.income, settings.currency)}
                </div>
                <div className="snapshot-sub">Set in Settings</div>
              </div>
              <div>
                <div className="snapshot-label">Total Balance</div>
                <div className="snapshot-value">{formatCurrency(balance, settings.currency)}</div>
                <div className="snapshot-sub">Income minus all expenses</div>
              </div>
              <div>
                <div className="snapshot-label">This Month vs Last</div>
                <div className="snapshot-value">
                  {formatCurrency(currentMonthSpent, settings.currency)}
                </div>
                <div className={`snapshot-trend${trendClass ? ` ${trendClass}` : ''}`}>
                  {trendText}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-header">
              <div className="card-title">
                <FiPieChart /> Budget Overview
              </div>
              <Link to="/budget" className="link-btn">
                Manage
              </Link>
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
                    {formatCurrency(currentMonthSpent, settings.currency)}
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
                  <span>{Math.round(budgetOverview.usage)}% of budget used</span>
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
              </>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                No monthly budget set yet. <Link to="/budget">Set a budget</Link> to track your
                monthly spending.
              </p>
            )}
          </div>

          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Monthly Spending</div>
              </div>
              {monthTotal === 0 ? (
                <EmptyState
                  title="No spending data yet"
                  message="Add expenses to see your monthly trends."
                />
              ) : (
                <BarChart data={monthlySeries} symbol={settings.currency} />
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Spending by Category</div>
              </div>
              {donutData.length === 0 ? (
                <EmptyState
                  title="No category spending yet"
                  message="Add an expense this month to see your category breakdown."
                />
              ) : (
                <DonutChart data={donutData} symbol={settings.currency} />
              )}
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Transactions</div>
              </div>
              <RecentTransactions limit={5} />
            </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">AI Insights Preview</div>
              <Link to="/insights" className="link-btn">
                View all
              </Link>
            </div>
            <AIInsightsPreview limit={3} />
          </div>
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="No expenses yet"
            message="Add your first expense to start building your financial dashboard."
            action={
              <Link to="/add" className="btn btn-primary">
                <FiPlus /> Add Your First Expense
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;