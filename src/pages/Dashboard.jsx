import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiCreditCard,
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
} from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import BarChart from '../components/charts/BarChart';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import CategorySummary from '../components/dashboard/CategorySummary';
import AIInsightsPreview from '../components/dashboard/AIInsightsPreview';
import { getTotalExpenses, getLastMonthlySeries, currentMonthKey, formatCurrency } from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';

function Dashboard() {
  const { expenses, budget, settings } = useExpenseContext();

  const monthlySpent = getTotalExpenses(expenses, currentMonthKey());
  const transactionCount = expenses.length;
  const totalExpenses = getTotalExpenses(expenses);
  const balance = settings.income - totalExpenses;
  const remainingBudget = budget.monthly - monthlySpent;
  const monthlySeries = getLastMonthlySeries(expenses, 6);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

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
          icon={<FiCreditCard />}
          tone="green"
          label="Total Balance"
          value={formatCurrency(balance, settings.currency)}
          hint="Income minus all expenses"
        />
        <StatCard
          icon={<FiTrendingUp />}
          label="Total Income"
          value={formatCurrency(settings.income, settings.currency)}
          hint="Monthly income"
        />
        <StatCard
          icon={<FiTrendingDown />}
          tone="red"
          label="Total Expenses"
          value={formatCurrency(totalExpenses, settings.currency)}
          hint={`${transactionCount} transactions · ${formatCurrency(monthlySpent, settings.currency)} this month`}
        />
        <StatCard
          icon={<FiTarget />}
          tone="amber"
          label="Remaining Budget"
          value={formatCurrency(remainingBudget, settings.currency)}
          hint={`${formatCurrency(monthlySpent, settings.currency)} of ${formatCurrency(budget.monthly, settings.currency)} used`}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Monthly Expenses</div>
          </div>
          <BarChart data={monthlySeries} symbol={settings.currency} />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Category Summary</div>
          </div>
          <CategorySummary />
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
    </div>
  );
}

export default Dashboard;