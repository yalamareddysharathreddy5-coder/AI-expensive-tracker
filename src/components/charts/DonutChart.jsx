import { formatCurrency, formatCompactCurrency } from '../../utils/format';

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function DonutChart({ data, symbol, emptyTitle = 'No spending yet' }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="donut-wrap">
        <svg className="donut-svg" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={RADIUS} className="donut-empty-ring" />
          <text x="100" y="100" textAnchor="middle" dominantBaseline="central" className="donut-center-sub">
            {emptyTitle}
          </text>
        </svg>
      </div>
    );
  }

  let offset = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const seg = { ...d, dash: fraction * CIRCUMFERENCE, offset };
    offset += fraction * CIRCUMFERENCE;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={RADIUS} className="donut-empty-ring" />
        {segments.map((s, index) => (
          <circle
            key={index}
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke={s.color}
            strokeWidth="26"
            strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 100 100)"
          />
        ))}
        <text x="100" y="96" textAnchor="middle" dominantBaseline="central" className="donut-center-text">
          {formatCompactCurrency(total, symbol)}
        </text>
        <text x="100" y="116" textAnchor="middle" dominantBaseline="central" className="donut-center-sub">
          spent this month
        </text>
      </svg>

      <ul className="legend-list">
        {segments
          .filter((s) => s.value > 0)
          .map((s, index) => (
            <li className="legend-item" key={index}>
              <span className="chip-dot" style={{ background: s.color }} />
              <span className="legend-name">{s.label}</span>
              <span className="legend-pct">{Math.round((s.value / total) * 100)}%</span>
              <span className="legend-value">{formatCurrency(s.value, symbol)}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default DonutChart;