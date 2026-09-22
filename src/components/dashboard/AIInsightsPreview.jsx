import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { generateInsights } from '../../utils/aiInsights';
import InsightIcon from './InsightIcon';
import useExpenseContext from '../../context/ExpenseContext';

function AIInsightsPreview({ limit = 3 }) {
  const { expenses, budget, settings } = useExpenseContext();
  const insights = generateInsights(expenses, budget, {
    currency: settings.currency,
    timeframe: 'thisMonth',
  }).slice(0, limit);

  if (insights.length === 0) {
    return <p className="hint">Add a few expenses to unlock insights.</p>;
  }

  return (
    <div>
      {insights.map((insight) => (
        <div className="preview-insight" key={insight.id}>
          <div className="preview-icon">
            <InsightIcon icon={insight.icon} />
          </div>
          <div>
            <div className="insight-title">{insight.title}</div>
            <div className="insight-desc">{insight.description}</div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 12 }}>
        <Link to="/insights" className="link-btn">
          View All Insights <FiArrowRight />
        </Link>
      </div>
    </div>
  );
}

export default AIInsightsPreview;