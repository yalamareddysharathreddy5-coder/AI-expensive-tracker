import { formatCurrency } from '../../utils/format';

function CategoryPredictionList({ entries, currency }) {
  if (entries.length === 0) {
    return <p className="hint" style={{ margin: 0 }}>No category spending recorded this month yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Actual</th>
            <th scope="col">Projected</th>
            <th scope="col">Share of projection</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.category}>
              <td>
                <span className="chip">
                  <span className="chip-dot" style={{ background: entry.color }} aria-hidden="true" />
                  {entry.category}
                </span>
              </td>
              <td>{formatCurrency(Math.round(entry.actual), currency)}</td>
              <td className="amount-strong">
                {formatCurrency(Math.round(entry.projected), currency)}
              </td>
              <td>
                <span className="prediction-share">
                  <span className="prediction-share-track" aria-hidden="true">
                    <span
                      className="prediction-share-fill"
                      style={{
                        width: `${Math.min(Math.max(entry.percentageOfProjectedTotal, 0), 100)}%`,
                        background: entry.color,
                      }}
                    />
                  </span>
                  <span className="prediction-share-value">
                    {Math.round(entry.percentageOfProjectedTotal)}%
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CategoryPredictionList;
