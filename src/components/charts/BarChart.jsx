import { formatCompactCurrency } from '../../utils/format';

function BarChart({ data, symbol, tone = '' }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bar-chart">
      {data.map((d, index) => (
        <div className="bar-col" key={d.key || index}>
          <div className="bar-value">{d.value > 0 ? formatCompactCurrency(d.value, symbol) : ''}</div>
          <div className="bar-track">
            <div
              className={`bar-fill${tone ? ` ${tone}` : ''}`}
              style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
            />
          </div>
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default BarChart;