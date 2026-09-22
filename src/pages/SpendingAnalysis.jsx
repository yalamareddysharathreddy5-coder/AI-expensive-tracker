import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTrendingDown,
  FiCreditCard,
  FiList,
  FiArrowUp,
  FiPieChart,
  FiTarget,
  FiCpu,
  FiRepeat,
  FiAlertTriangle,
  FiCheckCircle,
  FiSun,
  FiTrendingUp,
} from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import ProgressBar from '../components/common/ProgressBar';
import EmptyState from '../components/common/EmptyState';
import BarChart from '../components/charts/BarChart';
import { ANALYSIS_PERIODS, analyzeSpending } from '../utils/spendingAnalysis';
import { formatCurrency, formatDate } from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';

function SummaryText({ analysis }) {
  if (!analysis.textSummary) return null;
  return (
    <div className="card ai-analysis-summary">
      <div className="card-title">
        <FiTrendingUp /> Spending Summary
      </div>
      <p className="ai-analysis-summary-text">{analysis.textSummary}</p>
    </div>
  );
}

function Observations({ analysis }) {
  if (analysis.observations.length === 0) return null;
  return (
    <div className="card">
      <div className="card-title">AI Observations</div>
      <ul className="observations-list">
        {analysis.observations.map((observation) => (
          <li key={observation.id} className="observation-item">
            <div className={`observation-priority ${observation.priority}`}>
              {observation.priority === 'warning' ? <FiAlertTriangle /> : <FiCheckCircle />}
            </div>
            <div className="observation-body">
              <div className="observation-title">{observation.title}</div>
              <div className="observation-metric">{observation.metric}</div>
              <p className="observation-desc">{observation.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendSection({ analysis, currency }) {
  const months = analysis.monthly.months;
  if (months.length === 0) return null;
  const data = months.map((month) => ({ key: month.key, label: month.label, value: month.total }));
  const hasMultiple = months.length >= 2;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiTrendingUp /> Spending Trend
        </div>
      </div>
      <div className="bar-chart-wrap">
        <BarChart data={data} symbol={currency} />
      </div>

      {!hasMultiple && (
        <p className="focus-note">Add expenses across multiple months to see a monthly trend.</p>
      )}

      <div className="mini-stat-grid">
        <div className="mini-stat">
          <div className="mini-stat-label">Highest Month</div>
          <div className="mini-stat-value">
            {analysis.monthly.highestMonth ? formatCurrency(analysis.monthly.highestMonth.total, currency) : '—'}
          </div>
          <div className="mini-stat-sub">
            {analysis.monthly.highestMonth ? analysis.monthly.highestMonth.label : ''}
          </div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">Lowest Month</div>
          <div className="mini-stat-value">
            {analysis.monthly.lowestMonth ? formatCurrency(analysis.monthly.lowestMonth.total, currency) : '—'}
          </div>
          <div className="mini-stat-sub">
            {analysis.monthly.lowestMonth ? analysis.monthly.lowestMonth.label : ''}
          </div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">Average Per Month</div>
          <div className="mini-stat-value">
            {formatCurrency(Math.round(analysis.monthly.averageMonthly), currency)}
          </div>
          <div className="mini-stat-sub">across {months.length} month{months.length === 1 ? '' : 's'}</div>
        </div>
      </div>
    </div>
  );
}

function CategorySection({ analysis, currency }) {
  const categories = analysis.categories;
  if (categories.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiPieChart /> Category Analysis
        </div>
      </div>
      <div className="analysis-table">
        <div className="analysis-table-head">
          <span>Category</span>
          <span>Amount</span>
          <span>% of Spending</span>
          <span>Transactions</span>
          <span>Average</span>
        </div>
        {categories.map((category) => (
          <div className="analysis-table-row" key={category.category}>
            <span data-label="Category">
              <span className="chip-dot" style={{ background: category.color }} />
              <span className="category-name">{category.category}</span>
              {category.trend && (
                <span className={`trend-chip ${category.trend.direction}`}>
                  {category.trend.direction === 'increasing' ? '↗' : category.trend.direction === 'decreasing' ? '↘' : '→'}
                </span>
              )}
            </span>
            <span data-label="Amount">{formatCurrency(category.total, currency)}</span>
            <span data-label="% of Spending">
              <div className="analysis-pct-cell">
                <div className="analysis-track">
                  <div
                    className="analysis-fill"
                    style={{ width: `${Math.min(category.pct, 100)}%`, background: category.color }}
                  />
                </div>
                <span>{Math.round(category.pct)}%</span>
              </div>
            </span>
            <span data-label="Transactions">{category.count}</span>
            <span data-label="Average">{formatCurrency(Math.round(category.average), currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatternsSection({ analysis, currency }) {
  const patterns = analysis.patterns;
  const count = analysis.summary.count;
  if (count === 0) return null;

  const dayBars = patterns.daysOfWeek.map((day) => ({
    key: day.day,
    label: day.day.substring(0, 3),
    value: day.total,
  }));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiSun /> Spending Patterns
        </div>
      </div>

      <div className="pattern-grid">
        <div className="pattern-box">
          <div className="pattern-box-title">Weekday vs Weekend</div>
          <div className="pattern-split">
            <div className="pattern-side">
              <div className="pattern-side-label">Weekdays</div>
              <div className="pattern-side-value">{formatCurrency(patterns.weekday.total, currency)}</div>
              <div className="pattern-side-sub">{patterns.weekday.count} transactions</div>
            </div>
            <div className="pattern-side">
              <div className="pattern-side-label">Weekends</div>
              <div className="pattern-side-value">{formatCurrency(patterns.weekend.total, currency)}</div>
              <div className="pattern-side-sub">{patterns.weekend.count} transactions</div>
            </div>
          </div>
          <div className="pattern-track-wrap">
            <div className="analysis-track">
              <div
                className="analysis-fill"
                style={{ width: `${Math.min(patterns.weekendPctOfSpending, 100)}%`, background: 'var(--info)' }}
              />
            </div>
            <span className="pattern-track-note">
              {Math.round(patterns.weekendPctOfSpending)}% of spending on weekends
            </span>
          </div>
        </div>

        <div className="pattern-box">
          <div className="pattern-box-title">Day of Week</div>
          <BarChart data={dayBars} symbol={currency} />
          {patterns.highestDay && (
            <p className="focus-note">
              {patterns.highestDay.day} has the highest recorded spending.
            </p>
          )}
        </div>

        <div className="pattern-box">
          <div className="pattern-box-title">Payment Methods</div>
          {analysis.paymentMethods.length === 0 ? (
            <p className="focus-note">No payment method data in this period.</p>
          ) : (
            <ul className="payment-list">
              {analysis.paymentMethods.map((method) => (
                <li className="payment-item" key={method.method}>
                  <div className="payment-item-head">
                    <span className="currency-name-method" style={{ background: method.color }}>
                      {method.method}
                    </span>
                    <span className="payment-pct">{Math.round(method.pct)}%</span>
                  </div>
                  <div className="analysis-track">
                    <div
                      className="analysis-fill"
                      style={{ width: `${Math.min(method.pct, 100)}%`, background: method.color }}
                    />
                  </div>
                  <div className="payment-meta">
                    <span>{formatCurrency(method.total, currency)}</span>
                    <span>{method.count} transactions</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function LargeExpenses({ analysis, currency }) {
  const entries = analysis.unusualExpenses;
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiAlertTriangle /> Large Expenses
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="focus-note">No unusually large transactions detected in the selected period.</p>
      ) : (
        <div className="large-expense-grid">
          {entries.slice(0, 4).map((entry, index) => (
            <div className="large-expense-card" key={`${entry.date}-${index}`}>
              <div className="large-expense-amount">{formatCurrency(entry.amount, currency)}</div>
              <div className="large-expense-desc">{entry.description || `Unnamed ${entry.category}`}</div>
              <div className="large-expense-meta">
                <span className="category-chip-text">{entry.category}</span>
                <span>{formatDate(entry.date)}</span>
              </div>
              <div className="large-expense-compare">
                {formatCurrency(entry.amount, currency)} vs {formatCurrency(Math.round(entry.averageTransaction), currency)} average ·{' '}
                {entry.multipleOfAverage}×
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecurringExpenses({ analysis }) {
  const entries = analysis.recurringExpenses;
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiRepeat /> Repeated Expenses
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="focus-note">No repeated expense patterns detected in the selected period.</p>
      ) : (
        <ul className="recurring-list">
          {entries.map((entry, index) => (
            <li className="recurring-item" key={`${entry.title}-${index}`}>
              <div className="recurring-main">
                <span className="recurring-title">{entry.title}</span>
                <span className="category-chip-text">{entry.category}</span>
                {entry.sameAmount && <span className="recurring-badge">Same amount</span>}
              </div>
              <div className="recurring-meta">
                Repeated {entry.count} times · {entry.firstDate} to {entry.lastDate}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BudgetSection({ analysis, currency }) {
  const budget = analysis.budget;

  if (!budget) {
    return (
      <div className="card">
        <div className="card-title">
          <FiTarget /> Budget Analysis
        </div>
        <p className="focus-note">Set a monthly budget to include budget analysis.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiTarget /> Budget Analysis
        </div>
      </div>

      <div className="mini-stat-grid">
        <div className="mini-stat">
          <div className="mini-stat-label">Monthly Budget</div>
          <div className="mini-stat-value">{formatCurrency(budget.monthly, currency)}</div>
          <div className="mini-stat-sub">{budget.status.label}</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">Spent This Month</div>
          <div className="mini-stat-value">{formatCurrency(budget.spent, currency)}</div>
          <div className="mini-stat-sub">{budget.elapsedDays} days elapsed</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">Remaining</div>
          <div className="mini-stat-value">
            {budget.remaining < 0 ? `−${formatCurrency(Math.abs(budget.remaining), currency)}` : formatCurrency(budget.remaining, currency)}
          </div>
          <div className="mini-stat-sub">{Math.round(budget.usedPct)}% of budget used</div>
        </div>
      </div>

      <div className="budget-usage-row">
        <ProgressBar value={budget.usedPct} />
        <span className="budget-usage-label">{Math.round(budget.usedPct)}% used</span>
      </div>

      <div className="velocity-note">
        <FiTrendingUp /> Current spending is averaging {formatCurrency(Math.round(budget.dailyPace), currency)} per day this
        month, compared with a daily budget equivalent of{' '}
        {formatCurrency(Math.round(budget.dailyBudget), currency)}.
      </div>

      {budget.categories.length > 0 && (
        <div className="budget-categories">
          <div className="budget-categories-title">Category Budgets</div>
          {budget.categories.map((item) => (
            <div className="budget-category-row" key={item.category}>
              <div className="budget-category-name">
                {item.category}
                {item.limit > 0 && <span className="budget-category-limit">of {formatCurrency(item.limit, currency)}</span>}
              </div>
              <div className="budget-category-right">
                {item.usage !== null ? (
                  <>
                    <span className="budget-category-used">{Math.round(item.usage)}%</span>
                    <ProgressBar value={item.usage} />
                  </>
                ) : (
                  <span className="budget-category-used">{formatCurrency(item.spent, currency)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpendingAnalysis() {
  const { expenses, budget, settings } = useExpenseContext();
  const [period, setPeriod] = useState('all');

  const analysis = useMemo(
    () => analyzeSpending(expenses, budget, { currency: settings.currency, period }),
    [expenses, budget, settings.currency, period]
  );

  const summary = analysis.summary;
  const periodLabel = analysis.periodLabel;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Spending Analysis</h1>
          <p className="page-subtitle">Explore patterns and trends calculated from your expense history.</p>
        </div>
        <Link to="/insights" className="btn btn-outline">
          <FiCpu /> View AI Insights
        </Link>
      </div>

      <div className="card timeframe-card">
        <div className="timeframe-label">Analyze period</div>
        <div className="timeframe-pills">
          {ANALYSIS_PERIODS.map((item) => (
            <button
              key={item.key}
              className={`timeframe-pill${period === item.key ? ' active' : ''}`}
              onClick={() => setPeriod(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No spending data yet"
            message="Add a few expenses and your spending analysis will appear here."
            action={
              <Link to="/add" className="btn btn-primary">
                <FiList /> Add Expense
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {!analysis.hasExpenses && (
            <div className="card" style={{ marginBottom: 18 }}>
              <EmptyState
                title={`No expenses in ${periodLabel.toLowerCase()}`}
                message="Try a different timeframe or add more expenses."
              />
            </div>
          )}

          {analysis.hasExpenses && (
            <>
              <SummaryText analysis={analysis} />
              <Observations analysis={analysis} />

              <div className="stats-grid">
                <StatCard
                  icon={<FiTrendingDown />}
                  tone="red"
                  label="Total Spending"
                  value={formatCurrency(summary.total, settings.currency)}
                  hint={periodLabel.toLowerCase()}
                />
                <StatCard
                  icon={<FiCreditCard />}
                  tone="green"
                  label="Average Transaction"
                  value={formatCurrency(Math.round(summary.average), settings.currency)}
                  hint="Per transaction"
                />
                <StatCard
                  icon={<FiList />}
                  label="Transactions"
                  value={summary.count}
                  hint="In selected period"
                />
                <StatCard
                  icon={<FiArrowUp />}
                  tone="red"
                  label="Highest Expense"
                  value={
                    summary.highest ? formatCurrency(summary.highest.amount, settings.currency) : '—'
                  }
                  hint={summary.highest ? summary.highest.category : 'No expenses yet'}
                />
                <StatCard
                  icon={<FiCpu />}
                  label="Top Category"
                  value={analysis.topCategory ? analysis.topCategory.category : '—'}
                  hint={
                    analysis.topCategory
                      ? `${Math.round(analysis.topCategory.pct)}% of spending`
                      : 'In selected period'
                  }
                />
                <StatCard
                  icon={<FiTarget />}
                  label="Budget Usage"
                  value={analysis.budget ? `${Math.round(analysis.budget.usedPct)}%` : '—'}
                  hint={
                    analysis.budget
                      ? `${analysis.budget.status.label} this month`
                      : 'Set a monthly budget'
                  }
                />
              </div>

              <div className="grid">
                <TrendSection analysis={analysis} currency={settings.currency} />
                <CategorySection analysis={analysis} currency={settings.currency} />
                <PatternsSection analysis={analysis} currency={settings.currency} />
                <LargeExpenses analysis={analysis} currency={settings.currency} />
                <RecurringExpenses analysis={analysis} />
                <BudgetSection analysis={analysis} currency={settings.currency} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default SpendingAnalysis;