import { FiCheckCircle, FiInfo, FiXCircle } from 'react-icons/fi';
import { CATEGORIES, PAYMENT_METHODS } from '../../data/constants';
import { todayISO } from '../../utils/format';
import { buildReceiptDescription } from '../../services/receiptExpense';

const FIELD_META = {
  merchant: { label: 'Merchant', placeholder: 'Enter the store or merchant name' },
  amount: { label: 'Amount', placeholder: 'Enter the total' },
  date: { label: 'Date', placeholder: '' },
  category: { label: 'Category', placeholder: 'Choose a category' },
  paymentMethod: { label: 'Payment Method', placeholder: 'Choose a payment method' },
  description: { label: 'Description', placeholder: 'Add a short description' },
};

/**
 * The mandatory review step.
 *
 * Every extracted value is offered as a suggestion and every field stays
 * editable. Nothing here saves anything: only the Confirm button does, and it
 * is the sole path into the existing expense system.
 */
export default function ReceiptReviewForm({
  draft,
  fields = null,
  onChange,
  errors = {},
  notices = [],
  currency = 'USD',
  onConfirm,
  onCancel,
  onManualEntry,
  saving = false,
}) {
  function set(field, value) {
    const next = { ...draft, [field]: value };
    if (field === 'merchant') {
      next.description = buildReceiptDescription(value, draft.description);
    }
    onChange(next, field);
  }

  function detectedBadge(fieldKey, fields) {
    const field = fields && fields[fieldKey];
    if (!field) return null;
    if (!field.detected) {
      return <span className="receipt-field-badge none">Not detected</span>;
    }
    return (
      <span className={`receipt-field-badge ${field.level}`}>
        {field.levelLabel}
        {field.ambiguous ? ' · check' : ''}
      </span>
    );
  }

  return (
    <form
      className="receipt-review"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
      noValidate
    >
      <div className="card">
        <div className="card-header">
          <div className="card-title">Review Scanned Expense</div>
        </div>

        <div className="alert alert-info receipt-review-notice">
          <FiInfo /> Extracted from receipt. Review every field before saving.
        </div>

        {notices && notices.length > 0 && (
          <ul className="receipt-review-notices">
            {notices.map((notice) => (
              <li key={notice}>
                <FiInfo /> {notice}
              </li>
            ))}
          </ul>
        )}

        <div className="form-group">
          <div className="receipt-field-label">
            <label className="form-label" htmlFor="receipt-merchant">
              {FIELD_META.merchant.label}
            </label>
            {detectedBadge('merchant', fields)}
          </div>
          <input
            id="receipt-merchant"
            className="form-input"
            type="text"
            placeholder={FIELD_META.merchant.placeholder}
            value={draft.merchant}
            onChange={(event) => set('merchant', event.target.value)}
          />
        </div>

        <div className="receipt-review-row">
          <div className="form-group">
            <div className="receipt-field-label">
              <label className="form-label" htmlFor="receipt-amount">
                {FIELD_META.amount.label} ({currency})
              </label>
              {detectedBadge('amount', fields)}
            </div>
            <input
              id="receipt-amount"
              className={`form-input${errors.amount ? ' invalid' : ''}`}
              type="number"
              min="0"
              step="0.01"
              placeholder={FIELD_META.amount.placeholder}
              value={draft.amount}
              onChange={(event) => set('amount', event.target.value)}
            />
            {errors.amount && <div className="input-error">{errors.amount}</div>}
          </div>

          <div className="form-group">
            <div className="receipt-field-label">
              <label className="form-label" htmlFor="receipt-date">
                {FIELD_META.date.label}
              </label>
              {detectedBadge('date', fields)}
            </div>
            <input
              id="receipt-date"
              className={`form-input${errors.date ? ' invalid' : ''}`}
              type="date"
              max={todayISO()}
              value={draft.date}
              onChange={(event) => set('date', event.target.value)}
            />
            {errors.date && <div className="input-error">{errors.date}</div>}
          </div>
        </div>

        <div className="receipt-review-row">
          <div className="form-group">
            <div className="receipt-field-label">
              <label className="form-label" htmlFor="receipt-category">
                {FIELD_META.category.label}
              </label>
              {detectedBadge('category', fields)}
            </div>
            <div className="select-wrap">
              <select
                id="receipt-category"
                className={`form-select${errors.category ? ' invalid' : ''}`}
                value={draft.category}
                onChange={(event) => set('category', event.target.value)}
              >
                <option value="">{FIELD_META.category.placeholder}</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            {errors.category && <div className="input-error">{errors.category}</div>}
          </div>

          <div className="form-group">
            <div className="receipt-field-label">
              <label className="form-label" htmlFor="receipt-payment-method">
                {FIELD_META.paymentMethod.label}
              </label>
              {detectedBadge('paymentMethod', fields)}
            </div>
            <div className="select-wrap">
              <select
                id="receipt-payment-method"
                className={`form-select${errors.paymentMethod ? ' invalid' : ''}`}
                value={draft.paymentMethod}
                onChange={(event) => set('paymentMethod', event.target.value)}
              >
                <option value="">{FIELD_META.paymentMethod.placeholder}</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            {errors.paymentMethod && <div className="input-error">{errors.paymentMethod}</div>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="receipt-description">
            {FIELD_META.description.label}
          </label>
          <input
            id="receipt-description"
            className={`form-input${errors.description ? ' invalid' : ''}`}
            type="text"
            placeholder={FIELD_META.description.placeholder}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
          />
          {errors.description && <div className="input-error">{errors.description}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <FiCheckCircle /> Confirm and Save
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
            <FiXCircle /> Cancel
          </button>
          <button type="button" className="link-btn" onClick={onManualEntry} disabled={saving}>
            Enter manually instead
          </button>
        </div>
      </div>
    </form>
  );
}
