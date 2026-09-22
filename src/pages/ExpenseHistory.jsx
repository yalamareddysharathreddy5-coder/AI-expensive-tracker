import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiTrash2, FiX, FiPlus } from 'react-icons/fi';
import { CATEGORIES, PAYMENT_METHODS } from '../data/constants';
import { formatDate, formatCurrency } from '../utils/format';
import CategoryChip from '../components/common/CategoryChip';
import EmptyState from '../components/common/EmptyState';
import useExpenseContext from '../context/ExpenseContext';

function ExpenseHistory() {
  const { expenses, deleteExpense, settings } = useExpenseContext();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [pendingDelete, setPendingDelete] = useState(null);

  const filtersActive =
    search.trim().length > 0 || categoryFilter !== 'All' || paymentFilter !== 'All';
  const sortingChanged = sortBy !== 'date-desc';

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = expenses.filter((e) => {
      const matchesQuery =
        query.length === 0 ||
        e.description.toLowerCase().includes(query) ||
        e.category.toLowerCase().includes(query) ||
        e.paymentMethod.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
      const matchesPayment = paymentFilter === 'All' || e.paymentMethod === paymentFilter;
      return matchesQuery && matchesCategory && matchesPayment;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'date-asc') return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      if (sortBy === 'date-desc') return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return b.amount - a.amount;
    });
  }, [expenses, search, categoryFilter, paymentFilter, sortBy]);

  function confirmDelete() {
    deleteExpense(pendingDelete.id);
    setPendingDelete(null);
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  function clearFilters() {
    setSearch('');
    setCategoryFilter('All');
    setPaymentFilter('All');
    setSortBy('date-desc');
  }

  const totalShown = displayed.reduce((sum, e) => sum + e.amount, 0);
  const countLabel = filtersActive
    ? `Showing ${displayed.length} of ${expenses.length} transactions`
    : `${expenses.length} transactions`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense History</h1>
          <p className="page-subtitle">Search, filter and sort your transactions</p>
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

        <div className="select-wrap">
          <select
            className="form-select"
            aria-label="Sort transactions"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </div>

        {(filtersActive || sortingChanged) && (
          <button className="btn btn-outline btn-sm btn-clear" onClick={clearFilters}>
            <FiX /> Clear Filters
          </button>
        )}
      </div>

      <div className="history-summary">
        <span className="history-count">{countLabel}</span>
        {displayed.length > 0 && (
          <span className="hint">Total shown: {formatCurrency(totalShown, settings.currency)}</span>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Your expense history is empty"
            message="Add your first expense to start tracking your spending."
            action={
              <Link to="/add" className="btn btn-primary btn-sm">
                <FiPlus /> Add Expense
              </Link>
            }
          />
        </div>
      ) : displayed.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No matching expenses found"
            message="Try a different search or filter combination."
            action={
              <button className="btn btn-outline btn-sm" onClick={clearFilters}>
                <FiX /> Clear Filters
              </button>
            }
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
              {displayed.map((e) => (
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
                      onClick={() => setPendingDelete(e)}
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

      {pendingDelete && (
        <div className="confirm-overlay" onClick={cancelDelete}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-title" id="confirm-title">
              Delete this expense?
            </div>
            <p className="confirm-desc">
              Are you sure you want to delete "{pendingDelete.description}"
              ({formatCurrency(pendingDelete.amount, settings.currency)})? This cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                <FiTrash2 /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseHistory;