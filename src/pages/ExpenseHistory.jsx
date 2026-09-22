import { useMemo, useState } from 'react';
import { FiSearch, FiTrash2 } from 'react-icons/fi';
import { CATEGORIES, PAYMENT_METHODS } from '../data/constants';
import { formatDate, sortExpensesNewestFirst, formatCurrency } from '../utils/format';
import CategoryChip from '../components/common/CategoryChip';
import EmptyState from '../components/common/EmptyState';
import useExpenseContext from '../context/ExpenseContext';

function ExpenseHistory() {
  const { expenses, deleteExpense, settings } = useExpenseContext();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortExpensesNewestFirst(
      expenses.filter((e) => {
        const matchesQuery =
          query.length === 0 ||
          e.description.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query) ||
          e.paymentMethod.toLowerCase().includes(query);
        const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
        const matchesPayment = paymentFilter === 'All' || e.paymentMethod === paymentFilter;
        return matchesQuery && matchesCategory && matchesPayment;
      })
    );
  }, [expenses, search, categoryFilter, paymentFilter]);

  function handleDelete(id, description) {
    if (window.confirm(`Delete "${description}"?`)) {
      deleteExpense(id);
    }
  }

  const totalShown = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense History</h1>
          <p className="page-subtitle">{filtered.length} transaction(s) shown</p>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-bar">
          <FiSearch />
          <input
            className="form-input"
            type="text"
            placeholder="Search by description, category or method..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="select-wrap">
          <select
            className="form-select"
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="select-wrap">
          <select
            className="form-select"
            aria-label="Filter by payment method"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="All">All Payment Methods</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No expenses found"
            message="Try a different search or category. Or start by adding your first expense."
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{formatDate(e.date)}</td>
                  <td data-label="Description">
                    <span className="cell-title">{e.description}</span>
                  </td>
                  <td data-label="Category">
                    <CategoryChip category={e.category} />
                  </td>
                  <td data-label="Payment Method" className="cell-sub">
                    {e.paymentMethod}
                  </td>
                  <td data-label="Amount" className="amount-neg">
                    -{formatCurrency(e.amount, settings.currency)}
                  </td>
                  <td data-label="Action" style={{ textAlign: 'right' }}>
                    <button
                      className="delete-btn"
                      title="Delete expense"
                      aria-label="Delete expense"
                      onClick={() => handleDelete(e.id, e.description)}
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="hint" style={{ marginTop: 12 }}>
          Total shown: {formatCurrency(totalShown, settings.currency)}
        </p>
      )}
    </div>
  );
}

export default ExpenseHistory;