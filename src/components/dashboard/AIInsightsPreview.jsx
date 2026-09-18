import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { buildInsights } from '../../utils/insights';
import InsightIcon from '../dashboard/InsightIcon';
import useExpenseContext from '../../context/ExpenseContext';

function AIInsightsPreview({ limit }) {
  const { expenses, budget, settings } = useExpenseContext();
  const insights = buildInsights(expenses, budget, settings.currency, settings.income).slice(0, limit);

  if (insights.length === 0) {
    return <p className="hint">Add more expenses to unlock insights.</p>;
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
          View all insights <FiArrowRight />
        </Link>
      </div>
    </div>
  );
}

export default AIInsightsPreview;