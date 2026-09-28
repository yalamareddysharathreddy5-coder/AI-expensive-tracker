import { formatCurrency } from '../../utils/format';

function ProjectionBars({ prediction }) {
  const { actualSpending, projectedSpending, budgetComparison, currency, period } = prediction;

  const rows = [
    {
      key: 'actual',
      label: 'Actual',
      value: actualSpending.total,
      color: 'var(--info)',
      note: `Recorded over ${period.elapsedDays} ${period.elapsedDays === 1 ? 'day' : 'days'}`,
    },
    {
      key: 'projected',
      label: 'Projected',
      value: projectedSpending.total,
      color: 'var(--primary)',
      note: projectedSpending.basis,
    },
  ];

  if (budgetComparison.hasBudget) {
    rows.push({
      key: 'budget',
      label: 'Monthly budget',
      value: budgetComparison.monthly,
      color: 'var(--amber)',
      note: 'Recorded budget',
    });
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="projection-bars">
      {rows.map((row) => {
        const width = max > 0 ? (row.value / max) * 100 : 0;
        return (
          <div className="projection-row" key={row.key}>
            <div className="projection-row-head">
              <span className="projection-row-label">{row.label}</span>
              <span className="projection-row-value">
                {formatCurrency(Math.round(row.value), currency)}
              </span>
            </div>
            <div
              className="projection-track"
              role="img"
              aria-label={`${row.label}: ${formatCurrency(Math.round(row.value), currency)}. ${row.note}.`}
            >
              <div
                className="projection-fill"
                style={{ width: `${width}%`, background: row.color }}
              />
            </div>
            <div className="projection-row-note">{row.note}</div>
          </div>
        );
      })}

      <ul className="projection-legend">
        {rows.map((row) => (
          <li className="projection-legend-item" key={`legend-${row.key}`}>
            <span className="projection-swatch" style={{ background: row.color }} aria-hidden="true" />
            {row.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProjectionBars;
