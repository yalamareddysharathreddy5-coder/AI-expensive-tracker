import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowRight, FiClock } from 'react-icons/fi';
import { predictExpenses } from '../../utils/expensePrediction';
import { formatCurrency } from '../../utils/format';
import useExpenseContext from '../../context/ExpenseContext';

const DASH = '—';

function PredictionPreview() {
  const { expenses, budget, settings } = useExpenseContext();

  const prediction = useMemo(
    () => predictExpenses(expenses, budget, { currency: settings.currency }),
    [expenses, budget, settings.currency]
  );

  if (!prediction.hasPrediction) {
    return <p className="hint" style={{ margin: 0 }}>Prediction needs more spending data.</p>;
  }

  const projected = Math.round(prediction.projectedSpending.total);
  const dailyPace = Math.round(prediction.dailyPace.value);
  const remaining = Number(prediction.period.remainingDays);

  return (
    <div>
      <div className="prediction-preview">
        <div>
          <div className="prediction-preview-label">Projected Month-End</div>
          <div className="prediction-preview-value">
            {formatCurrency(projected, settings.currency)}
          </div>
          <div className="prediction-preview-note">Estimate, based on current spending pace</div>
        </div>
        <div>
          <div className="prediction-preview-label">
            <FiClock /> Current Pace
          </div>
          <div className="prediction-preview-value">
            {dailyPace > 0 ? `${formatCurrency(dailyPace, settings.currency)}/day` : DASH}
          </div>
          <div className="prediction-preview-note">
            {remaining} {remaining === 1 ? 'day' : 'days'} remaining this month
          </div>
        </div>
      </div>

      {prediction.limitedData && (
        <p className="focus-note">{prediction.confidence.limitedMessage}</p>
      )}

      <Link to="/prediction" className="btn btn-outline" style={{ marginTop: 12 }}>
        <FiActivity /> View Prediction <FiArrowRight />
      </Link>
    </div>
  );
}

export default PredictionPreview;
