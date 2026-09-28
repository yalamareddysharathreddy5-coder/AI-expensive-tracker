import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiPlus,
  FiCpu,
  FiTrendingUp,
  FiCalendar,
  FiClock,
  FiTarget,
  FiPieChart,
  FiBarChart2,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiPercent,
  FiHelpCircle,
} from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ProgressBar from '../components/common/ProgressBar';
import ProjectionBars from '../components/prediction/ProjectionBars';
import CategoryPredictionList from '../components/prediction/CategoryPredictionList';
import { predictExpenses } from '../utils/expensePrediction';
import { formatCurrency } from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';

const DASH = '—';

function finite(value) {
  return Number.isFinite(Number(value));
}

function money(value, currency) {
  return finite(value) ? formatCurrency(Math.round(Number(value)), currency) : DASH;
}

function pace(value, currency) {
  return finite(value) && Number(value) > 0 ? `${money(value, currency)}/day` : DASH;
}

const OBSERVATION_PRIORITY = {
  warning: { icon: FiAlertTriangle, tone: 'warning', label: 'Heads up' },
  positive: { icon: FiCheckCircle, tone: 'positive', label: 'Good news' },
  info: { icon: FiInfo, tone: 'info', label: 'Estimate' },
};

function PredictionObservations({ observations }) {
  if (observations.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-header">
        <div className="card-title">
          <FiActivity /> Prediction Observations
        </div>
      </div>
      <ul className="observations-list" style={{ marginTop: 0 }}>
        {observations.map((observation) => {
          const meta = OBSERVATION_PRIORITY[observation.priority] || OBSERVATION_PRIORITY.info;
          const Icon = meta.icon;
          return (
            <li className="observation-item" key={observation.id}>
              <div className={`observation-priority ${meta.tone}`}>
                <Icon />
              </div>
              <div className="observation-body">
                <div className="observation-title">{observation.title}</div>
                <div className="observation-metric">{observation.metric}</div>
                <div className="observation-desc">{observation.description}</div>
                {observation.explanation && (
                  <div className="focus-note">{observation.explanation}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConfidencePanel({ confidence, period }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiPercent /> Prediction Confidence
        </div>
      </div>

      <div className="confidence-row">
        <span className={`tag ${confidence.tone}`}>Data quality: {confidence.label}</span>
      </div>
      <p className="hint" style={{ margin: '10px 0 0' }}>
        {confidence.reason}
      </p>
      <p className="focus-note">
        This indicates how much recorded data the estimate is based on. It is not a statistical
        measure of certainty.
      </p>

      <div className="budget-head" style={{ marginTop: 14 }}>
        <span>Month progress</span>
        <span className="amount-strong">
          {period.elapsedDays} of {period.daysInMonth} days
        </span>
      </div>
      <ProgressBar value={period.progressPct} />
      <div className="budget-usage">
        <span>{Math.round(period.progressPct)}% of the month elapsed</span>
      </div>
    </div>
  );
}

function PacePanel({ prediction }) {
  const { dailyPace, historical, period, currency } = prediction;
  const rows = [
    {
      key: 'current',
      label: 'Current pace',
      value: pace(dailyPace.value, currency),
      note: `${period.elapsedDays} ${period.elapsedDays === 1 ? 'day' : 'days'} elapsed`,
    },
    {
      key: 'previous',
      label: `Previous month pace (${historical.previousLabel})`,
      value: pace(historical.previousMonthPace, currency),
      note: historical.previousMonth > 0 ? `${money(historical.previousMonth, currency)} total` : 'No data',
    },
    {
      key: 'average',
      label: 'Historical average pace',
      value: pace(historical.averageDailyPace, currency),
      note: historical.hasEnough
        ? `${money(historical.averageMonthly, currency)} average across ${historical.monthLabel}`
        : 'No data',
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiClock /> Spending Pace
        </div>
      </div>
      <div className="pace-list">
        {rows.map((row) => (
          <div className="pace-row" key={row.key}>
            <div>
              <div className="pace-label">{row.label}</div>
              <div className="pace-note">{row.note}</div>
            </div>
            <div className="pace-value">{row.value}</div>
          </div>
        ))}
      </div>
      <p className="focus-note">
        Pace is recorded spending divided by the days observed. Historical figures are shown for
        reference only.
      </p>
    </div>
  );
}

function BudgetPanel({ prediction }) {
  const { budgetComparison, remainingCapacity, currency } = prediction;

  if (!budgetComparison.hasBudget) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FiTarget /> Budget Projection
          </div>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {budgetComparison.message}{' '}
          <Link to="/budget">Set a monthly budget</Link> to compare your projection against a
          target.
        </p>
      </div>
    );
  }

  const above = Number(budgetComparison.projectedRemaining) < 0;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiTarget /> Budget Projection
        </div>
        <Link to="/budget" className="link-btn">
          Manage
        </Link>
      </div>

      <div className="budget-head">
        <span>Monthly budget</span>
        <span className="budget-value">{money(budgetComparison.monthly, currency)}</span>
      </div>
      <div className="budget-head" style={{ marginTop: 6 }}>
        <span>Actual so far</span>
        <span className="amount-strong">{money(budgetComparison.actual, currency)}</span>
      </div>
      <div className="budget-head" style={{ marginTop: 6 }}>
        <span>Projected</span>
        <span className="amount-strong">{money(budgetComparison.projected, currency)}</span>
      </div>
      <div className="budget-head" style={{ marginTop: 6 }}>
        <span>{above ? 'Projected over budget' : 'Projected remaining'}</span>
        <span className={above ? 'amount-neg' : 'amount-strong'}>
          {money(Math.abs(Number(budgetComparison.projectedRemaining)), currency)}
        </span>
      </div>

      <ProgressBar value={budgetComparison.projectedPctOfBudget} />
      <div className="budget-usage">
        <span>Projected usage: {Math.round(Number(budgetComparison.projectedPctOfBudget))}%</span>
      </div>

      <div className={`budget-msg ${above ? 'over' : 'ok'}`}>
        {above ? <FiAlertTriangle /> : <FiCheckCircle />} {budgetComparison.message}
      </div>

      <div className="budget-head" style={{ marginTop: 12 }}>
        <span>Remaining budget</span>
        <span className="amount-strong">{money(remainingCapacity.remaining, currency)}</span>
      </div>
      <div className="budget-head" style={{ marginTop: 6 }}>
        <span>{remainingCapacity.label}</span>
        <span className="amount-strong">{pace(remainingCapacity.perDay, currency)}</span>
      </div>
      <p className="focus-note">
        {remainingCapacity.perDay === null
          ? `There are ${remainingCapacity.remainingDays} days left this month, so a per-day figure is not available.`
          : `Across ${remainingCapacity.remainingDays} remaining ${
              remainingCapacity.remainingDays === 1 ? 'day' : 'days'
            }. ${remainingCapacity.note}`}
      </p>
    </div>
  );
}

function HistoricalPanel({ prediction }) {
  const { historical, projectedSpending, currency, period } = prediction;

  if (!historical.hasEnough) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FiBarChart2 /> Historical Comparison
          </div>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {historical.message}
        </p>
      </div>
    );
  }

  const above = Number(historical.difference) > 0;
  const max = Math.max(projectedSpending.total, historical.averageMonthly, 1);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiBarChart2 /> Historical Comparison
        </div>
      </div>

      <div className="budget-head">
        <span>Current projection ({period.label})</span>
        <span className="amount-strong">{money(projectedSpending.total, currency)}</span>
      </div>
      <div className="budget-head" style={{ marginTop: 6 }}>
        <span>Average of {historical.monthLabel}</span>
        <span className="amount-strong">{money(historical.averageMonthly, currency)}</span>
      </div>
      <div className="budget-head" style={{ marginTop: 6 }}>
        <span>Difference</span>
        <span className={above ? 'amount-neg' : 'amount-strong'}>
          {above ? '+' : DASH}
          {money(Math.abs(Number(historical.difference)), currency)}
        </span>
      </div>

      <div className="pace-list" style={{ marginTop: 12 }}>
        <div className="pace-row">
          <div>
            <div className="pace-label">Current projection</div>
            <div className="pace-note">{period.label}</div>
          </div>
          <div className="pace-value">
            <span
              className="projection-track"
              style={{ width: '140px' }}
              role="img"
              aria-label={`Current projection ${money(projectedSpending.total, currency)}`}
            >
              <span
                className="projection-fill"
                style={{
                  width: `${(projectedSpending.total / max) * 100}%`,
                  background: 'var(--primary)',
                }}
              />
            </span>
          </div>
        </div>
        <div className="pace-row">
          <div>
            <div className="pace-label">Historical average</div>
            <div className="pace-note">{historical.monthLabel}</div>
          </div>
          <div className="pace-value">
            <span
              className="projection-track"
              style={{ width: '140px' }}
              role="img"
              aria-label={`Historical average ${money(historical.averageMonthly, currency)}`}
            >
              <span
                className="projection-fill"
                style={{
                  width: `${(historical.averageMonthly / max) * 100}%`,
                  background: 'var(--info)',
                }}
              />
            </span>
          </div>
        </div>
      </div>

      {finite(historical.differencePct) && (
        <p className="focus-note">
          Current projected spending is{' '}
          {Math.abs(Math.round(Number(historical.differencePct)))}%{' '}
          {above ? 'above' : 'below'} the average of {historical.monthLabel}. This is a comparison
          of recorded figures, not a judgement.
        </p>
      )}
    </div>
  );
}

function ExplanationPanel({ explanation }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <FiHelpCircle /> How this estimate is calculated
        </div>
      </div>
      <p className="ai-analysis-summary-text" style={{ marginTop: 0 }}>
        {explanation.summary}
      </p>
      <div className="prediction-method">
        <div className="prediction-method-label">Method</div>
        <div className="prediction-method-value">
          {explanation.method} — {explanation.basis}
        </div>
      </div>
      <div className="prediction-method">
        <div className="prediction-method-label">Calculation</div>
        <div className="prediction-method-value">{explanation.formula}</div>
      </div>
      <ol className="prediction-steps">
        {explanation.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="focus-note">{explanation.note}</p>
    </div>
  );
}

function ExpensePrediction() {
  const { expenses, budget, settings } = useExpenseContext();

  const prediction = useMemo(
    () => predictExpenses(expenses, budget, { currency: settings.currency }),
    [expenses, budget, settings.currency]
  );

  const {
    period,
    actualSpending,
    dailyPace,
    projectedSpending,
    budgetComparison,
    categoryPredictions,
  } = prediction;

  const hasExpenses = expenses.length > 0;
  const hasPrediction = prediction.hasPrediction;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Expense Prediction</h1>
          <p className="page-subtitle">
            Estimate future spending from your recorded spending patterns.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/analysis" className="btn btn-outline">
            <FiTrendingUp /> View Spending Analysis
          </Link>
          <Link to="/insights" className="btn btn-outline">
            <FiCpu /> View AI Insights
          </Link>
        </div>
      </div>

      {!hasExpenses ? (
        <div className="card">
          <EmptyState
            title="No spending data available"
            message="Add expenses to generate a spending projection."
            action={
              <Link to="/add" className="btn btn-primary">
                <FiPlus /> Add Expense
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {!hasPrediction && (
            <div className="card" style={{ marginBottom: 18 }}>
              <EmptyState
                title="Prediction needs more spending data"
                message={`No expenses have been recorded in ${period.label} yet. Add an expense dated in the current month to generate a projection.`}
                action={
                  <Link to="/add" className="btn btn-primary">
                    <FiPlus /> Add Expense
                  </Link>
                }
              />
            </div>
          )}

          {hasPrediction && prediction.limitedData && (
            <div className="alert alert-error" role="status" style={{ marginBottom: 18 }}>
              <FiAlertTriangle />
              <div>
                <strong>Limited data.</strong> {prediction.confidence.limitedMessage}
              </div>
            </div>
          )}

          {hasPrediction && (
            <>
              <div className="stats-grid">
                <StatCard
                  icon={<FiActivity />}
                  label="Actual Spending"
                  value={money(actualSpending.total, settings.currency)}
                  hint={`${period.label}, so far`}
                />
                <StatCard
                  icon={<FiClock />}
                  tone="green"
                  label="Current Daily Pace"
                  value={pace(dailyPace.value, settings.currency)}
                  hint="Based on current spending pace"
                />
                <StatCard
                  icon={<FiTrendingUp />}
                  tone="amber"
                  label="Projected Month-End"
                  value={money(projectedSpending.total, settings.currency)}
                  hint="Estimate, not guaranteed"
                />
                <StatCard
                  icon={<FiCalendar />}
                  label="Days Remaining"
                  value={period.remainingDays}
                  hint={`${period.daysInMonth} days in ${period.label}`}
                />
                {budgetComparison.hasBudget && (
                  <StatCard
                    icon={<FiTarget />}
                    label="Monthly Budget"
                    value={money(budgetComparison.monthly, settings.currency)}
                    hint={`${Math.round(Number(budgetComparison.usedPct))}% used so far`}
                  />
                )}
                {budgetComparison.hasBudget && (
                  <StatCard
                    icon={<FiPieChart />}
                    tone={
                      Number(budgetComparison.projectedRemaining) < 0 ? 'red' : 'green'
                    }
                    label="Projected Difference"
                    value={`${money(
                      Math.abs(Number(budgetComparison.projectedRemaining)),
                      settings.currency
                    )} ${Number(budgetComparison.projectedRemaining) < 0 ? 'above' : 'below'}`}
                    hint="Compared with the monthly budget"
                  />
                )}
              </div>

              <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <FiBarChart2 /> Actual vs Projected
                    </div>
                  </div>
                  <ProjectionBars prediction={prediction} />
                </div>

                <ConfidencePanel confidence={prediction.confidence} period={period} />
              </div>

              <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <PacePanel prediction={prediction} />
                <BudgetPanel prediction={prediction} />
              </div>

              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <div className="card-title">
                    <FiPieChart /> Projected Category Spending
                  </div>
                </div>
                <CategoryPredictionList
                  entries={categoryPredictions}
                  currency={settings.currency}
                />
                <p className="focus-note">
                  Category projections apply the same daily pace calculation to each category
                  separately, using only categories with recorded spending this month.
                </p>
              </div>

              <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <HistoricalPanel prediction={prediction} />
                <ExplanationPanel explanation={prediction.explanation} />
              </div>

              <PredictionObservations observations={prediction.observations} />
            </>
          )}
        </>
      )}
    </div>
  );
}

export default ExpensePrediction;
