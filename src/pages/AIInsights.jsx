import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiRotateCw,
  FiTrendingDown,
  FiTrendingUp,
  FiCreditCard,
  FiList,
  FiPieChart,
  FiPlus,
} from 'react-icons/fi';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import AIInsightCard from '../components/AIInsightCard';
import { INSIGHT_TIMEFRAMES, generateInsights, generateInsightSummary } from '../utils/aiInsights';
import { formatCurrency } from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';

function AIInsights() {
  const { expenses, budget, settings } = useExpenseContext();
  const [timeframe, setTimeframe] = useState('thisMonth');
  const [refreshKey, setRefreshKey] = useState(0);

  const timeframeLabel =
    INSIGHT_TIMEFRAMES.find((t) => t.key === timeframe)?.label || 'This Month';

  const summary = useMemo(
    () => generateInsightSummary(expenses, budget, { currency: settings.currency, timeframe }),
    [expenses, budget, settings.currency, timeframe, refreshKey]
  );

  const insights = useMemo(
    () => generateInsights(expenses, budget, { currency: settings.currency, timeframe }),
    [expenses, budget, settings.currency, timeframe, refreshKey]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Insights</h1>
          <p className="page-subtitle">Smart observations based on your spending activity</p>
        </div>
        <div className="page-actions">
          <Link to="/analysis" className="btn btn-outline">
            <FiTrendingUp /> View Spending Analysis
          </Link>
          <button
            className="btn btn-outline"
            onClick={() => setRefreshKey((key) => key + 1)}
            aria-label="Refresh insights"
          >
            <FiRotateCw /> Refresh Insights
          </button>
        </div>
      </div>

      <div className="card timeframe-card">
        <div className="timeframe-label">Analyze period</div>
        <div className="timeframe-pills">
          {INSIGHT_TIMEFRAMES.map((t) => (
            <button
              key={t.key}
              className={`timeframe-pill${timeframe === t.key ? ' active' : ''}`}
              onClick={() => setTimeframe(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No spending data yet"
            message="Add a few expenses and your AI insights will appear here."
            action={
              <Link to="/add" className="btn btn-primary">
                <FiPlus /> Add Expense
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <StatCard
              icon={<FiTrendingDown />}
              tone="red"
              label="Total Spending"
              value={formatCurrency(summary.total, settings.currency)}
              hint={timeframeLabel.toLowerCase()}
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
              icon={<FiPieChart />}
              label="Top Category"
              value={summary.topCategory || 'No spending yet'}
              hint={
                summary.topCategory
                  ? `${formatCurrency(summary.topCategoryAmount, settings.currency)} spent`
                  : 'In selected period'
              }
            />
          </div>

          {insights.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No insights for this period"
                message="Try a different timeframe or add more expenses."
              />
            </div>
          ) : (
            <div className="ai-insights-grid">
              {insights.map((insight) => (
                <AIInsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AIInsights;