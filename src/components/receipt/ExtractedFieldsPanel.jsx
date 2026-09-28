import { CONFIDENCE } from '../../services/receiptFieldParser';

const LEVEL_TEXT = {
  [CONFIDENCE.HIGH]: 'High',
  [CONFIDENCE.MEDIUM]: 'Medium',
  [CONFIDENCE.LOW]: 'Low',
  [CONFIDENCE.NONE]: 'Not detected',
};

const ROWS = [
  { key: 'merchant', label: 'Merchant' },
  { key: 'amount', label: 'Amount' },
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Suggested Category' },
  { key: 'paymentMethod', label: 'Payment Method' },
];

function displayValue(field, result) {
  if (!field || !field.detected) return 'Not detected';
  if (field.level === CONFIDENCE.NONE) return 'Not detected';

  if (field.key === 'amount') {
    return result.amount === null || result.amount === undefined
      ? 'Not detected'
      : String(result.amount);
  }
  if (field.key === 'date') return result.date || 'Not detected';
  if (field.key === 'category') return result.category || 'Not detected';
  if (field.key === 'paymentMethod') return result.paymentMethod || 'Not detected';
  return result.merchant || 'Not detected';
}

/**
 * Per-field extraction quality, derived from the evidence the parser actually
 * found. Nothing here is a statistical probability.
 */
export default function ExtractedFieldsPanel({ result }) {
  if (!result || !result.fields) return null;

  const { fields, quality } = result;

  return (
    <div className="receipt-quality">
      <div className="receipt-quality-head">
        <h3 className="card-title">Receipt data quality</h3>
        <span className={`receipt-quality-badge ${quality.quality}`}>{quality.label}</span>
      </div>

      <ul className="receipt-quality-list">
        {ROWS.map((row) => {
          const field = fields[row.key];
          const level = field ? field.level : CONFIDENCE.NONE;
          return (
            <li key={row.key} className={`receipt-quality-row ${level}`}>
              <span className="receipt-quality-row-label">{row.label}</span>
              <span className="receipt-quality-row-value">
                {displayValue({ ...field, key: row.key }, result)}
              </span>
              <span className={`receipt-quality-row-level ${level}`}>
                {LEVEL_TEXT[level] || LEVEL_TEXT[CONFIDENCE.NONE]}
              </span>
            </li>
          );
        })}
      </ul>

      {result.engine && (
        <div className="receipt-quality-engine">
          Read on this device by {result.engine}. Nothing was uploaded.
        </div>
      )}
    </div>
  );
}
