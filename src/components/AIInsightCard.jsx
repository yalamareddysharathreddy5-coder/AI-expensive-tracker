import { FiCheckCircle, FiAlertTriangle, FiInfo, FiCpu } from 'react-icons/fi';
import InsightIcon from './dashboard/InsightIcon';

const PRIORITY_LABELS = {
  positive: 'Good news',
  info: 'Did you know',
  warning: 'Heads up',
};

const PRIORITY_ICONS = {
  positive: FiCheckCircle,
  info: FiInfo,
  warning: FiAlertTriangle,
};

function AIInsightCard({ insight }) {
  const PriorityIcon = PRIORITY_ICONS[insight.priority] || FiInfo;

  return (
    <article className={`ai-insight-card priority-${insight.priority}`}>
      <div className={`ai-insight-icon priority-${insight.priority}`}>
        <InsightIcon icon={insight.icon} />
      </div>
      <div className="ai-insight-content">
        <div className="ai-insight-priority">
          <PriorityIcon /> {PRIORITY_LABELS[insight.priority] || insight.priority}
        </div>
        <h3 className="ai-insight-title">{insight.title}</h3>
        <p className="ai-insight-desc">{insight.description}</p>
        {insight.metric && <div className="ai-insight-metric">{insight.metric}</div>}
        <div className="ai-insight-source">
          <FiCpu /> {insight.source}
        </div>
      </div>
    </article>
  );
}

export default AIInsightCard;