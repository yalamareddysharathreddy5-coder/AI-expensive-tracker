import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { sortExpensesNewestFirst, formatDate, formatCurrency } from '../../utils/format';
import { CATEGORY_COLORS } from '../../data/constants';
import useExpenseContext from '../../context/ExpenseContext';

function RecentTransactions({ limit }) {
  const { expenses, settings } = useExpenseContext();
  const sorted = sortExpensesNewestFirst(expenses).slice(0, limit);

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="hint">No transactions yet. Add your first expense!</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td data-label="Description">
                    <span className="cell-title">{e.description}</span>
                    <div className="cell-sub">via {e.paymentMethod}</div>
                  </td>
                  <td data-label="Category">
                    <span className="chip">
                      <span
                        className="chip-dot"
                        style={{ background: CATEGORY_COLORS[e.category] || '#64748b' }}
                      />
                      {e.category}
                    </span>
                  </td>
                  <td data-label="Date">{formatDate(e.date)}</td>
                  <td data-label="Amount" className="amount-neg">
                    -{formatCurrency(e.amount, settings.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expenses.length > limit && (
        <div style={{ marginTop: 12 }}>
          <Link to="/history" className="link-btn">
            View all transactions <FiArrowRight />
          </Link>
        </div>
      )}
    </div>
  );
}

export default RecentTransactions;