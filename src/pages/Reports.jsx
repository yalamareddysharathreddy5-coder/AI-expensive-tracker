import { FiArrowDown, FiArrowUp, FiPieChart } from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import GroupedBarChart from '../components/charts/GroupedBarChart';
import DonutChart from '../components/charts/DonutChart';
import EmptyState from '../components/common/EmptyState';
import { CATEGORIES, CATEGORY_COLORS } from '../data/constants';
import {
  getTotalExpenses,
  getCategoryTotals,
  getLastMonthlySeries,
  currentMonthKey,
  formatCurrency,
  previousMonthKey,
} from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';

function Reports() {
  const { expenses, settings } = useExpenseContext();

  const monthlySpent = getTotalExpenses(expenses, currentMonthKey());
  const lastMonthSpent = getTotalExpenses(expenses, previousMonthKey());
  const savings = settings.income - monthlySpent;
  const savingsRate = settings.income > 0 ? Math.round((savings / settings.income) * 100) : 0;

  const monthlySeries = getLastMonthlySeries(expenses, 6);
  const incomeExpenseSeries = monthlySeries.map((m) => ({
    ...m,
    income: settings.income,
    expense: m.value,
  }));

  const categoryTotals = getCategoryTotals(expenses, CATEGORIES, currentMonthKey());
  const donutData = CATEGORIES.filter((c) => categoryTotals[c] > 0)
    .map((c) => ({ label: c, value: categoryTotals[c], color: CATEGORY_COLORS[c] }))
    .sort((a, b) => b.value - a.value);

  const chartData = CATEGORIES.map((c) => ({
    category: c,
    value: categoryTotals[c],
    color: CATEGORY_COLORS[c],
  }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Monthly performance at a glance</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={<FiArrowUp />}
          tone="green"
          label="This Month Income"
          value={formatCurrency(settings.income, settings.currency)}
          hint="Set in Settings"
        />
        <StatCard
          icon={<FiArrowDown />}
          tone="red"
          label="This Month Expenses"
          value={formatCurrency(monthlySpent, settings.currency)}
          hint={`${formatCurrency(lastMonthSpent, settings.currency)} last month`}
        />
        <StatCard
          icon={<FiPieChart />}
          tone={savings >= 0 ? 'green' : 'red'}
          label="Savings"
          value={formatCurrency(savings, settings.currency)}
          hint={savingsRate > 0 ? `${savingsRate}% savings rate` : 'Spending exceeds income'}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Income vs Expenses</div>
          </div>
          <GroupedBarChart data={incomeExpenseSeries} />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Category-wise Expenses</div>
          </div>
          {donutData.length === 0 ? (
            <EmptyState title="No data" message="Add expenses to see this chart." />
          ) : (
            <DonutChart data={donutData} symbol={settings.currency} />
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Spending by Category</div>
        </div>
        {chartData.length === 0 ? (
          <EmptyState title="No data" message="Add expenses to see this chart." />
        ) : (
          <div className="category-list" style={{ maxWidth: 900 }}>
            {chartData.map((d) => (
              <div className="category-row" key={d.category}>
                <div>
                  <div className="category-name">
                    <span className="chip-dot" style={{ background: d.color }} />
                    {d.category}
                  </div>
                  <div className="category-amount">{formatCurrency(d.value, settings.currency)}</div>
                </div>
                <div className="right">
                  <div className="category-track">
                    <div
                      className="category-fill"
                      style={{
                        width: `${chartData[0].value > 0 ? (d.value / chartData[0].value) * 100 : 0}%`,
                        background: d.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;