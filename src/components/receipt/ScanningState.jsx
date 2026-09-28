import { FiXCircle } from 'react-icons/fi';
import { OCR_STAGES } from '../../services/receiptScanner';

const STAGE_ORDER = [OCR_STAGES.READ, OCR_STAGES.TEXT, OCR_STAGES.FIELDS, OCR_STAGES.PREPARE];

/**
 * Indeterminate scanning indicator.
 *
 * No percentage is shown: OCR does not report trustworthy overall progress,
 * and the first run also downloads the recognition model, so a fake bar would
 * be a lie. The current stage is shown instead.
 */
export default function ScanningState({ stage, fileName, onCancel }) {
  const activeIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="receipt-scanning" role="status" aria-live="polite">
      <div className="receipt-scanning-title">Scanning receipt...</div>
      {fileName && <div className="receipt-scanning-file">{fileName}</div>}

      <div className="receipt-indeterminate" aria-hidden="true">
        <div className="receipt-indeterminate-bar" />
      </div>

      <ol className="receipt-stages">
        {STAGE_ORDER.map((name, index) => {
          const state = activeIndex < 0 ? 'pending' : index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
          return (
            <li key={name} className={`receipt-stage ${state}`}>
              <span className="receipt-stage-dot" aria-hidden="true" />
              <span>{name}</span>
              {state === 'done' && <span className="visually-hidden">completed</span>}
              {state === 'active' && <span className="visually-hidden">in progress</span>}
            </li>
          );
        })}
      </ol>

      <p className="receipt-scanning-note">
        The first scan of a session downloads the on-device recognition model, which can take a
        moment. Your receipt is read in this browser tab and is never uploaded.
      </p>

      <button type="button" className="btn btn-outline" onClick={onCancel}>
        <FiXCircle /> Cancel
      </button>
    </div>
  );
}
