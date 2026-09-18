import { CATEGORIES, CATEGORY_COLORS } from '../../data/constants';
import { getCategoryTotals, formatCurrency } from '../../utils/format';
import useExpenseContext from '../../context/ExpenseContext';

function CategorySummary() {
  const { expenses, settings } = useExpenseContext();
  const totals = getCategoryTotals(expenses, CATEGORIES);
  const total = Object.values(totals).reduce((sum, v) => sum + v, 0);
  const active = CATEGORIES.map((category) => ({ category, value: totals[category] }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (active.length === 0) {
    return <p className="hint">Add expenses to see your category breakdown.</p>;
  }

  return (
    <div className="category-list">
      {active.map(({ category, value }) => (
        <div className="category-row" key={category}>
          <div>
            <div className="category-name">
              <span className="chip-dot" style={{ background: CATEGORY_COLORS[category] }} />
              {category}
            </div>
            <div className="category-amount">{formatCurrency(value, settings.currency)}</div>
          </div>
          <div className="right">
            <div className="category-track">
              <div
                className="category-fill"
                style={{
                  width: `${total > 0 ? (value / total) * 100 : 0}%`,
                  background: CATEGORY_COLORS[category],
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default CategorySummary;