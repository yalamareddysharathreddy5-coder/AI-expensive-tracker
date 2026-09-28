import { FiFileText, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { formatFileSize } from '../../services/receiptScanner';

/**
 * Shows the selected file before and after scanning.
 *
 * Images render from a temporary object URL. PDFs are shown as a file card
 * rather than an embedded viewer, so no plugin or backend is needed just to
 * confirm the right file was picked.
 */
export default function ReceiptPreview({ file, kind, previewUrl, onReplace, onRemove, disabled }) {
  if (!file) return null;

  const size = formatFileSize(file.size);

  return (
    <div className="receipt-preview">
      <div className="receipt-preview-head">
        <div>
          <div className="receipt-preview-name" title={file.name}>
            {file.name}
          </div>
          <div className="receipt-preview-meta">
            {file.type || 'unknown type'} &middot; {size}
            {kind === 'pdf' ? ' · PDF' : ''}
          </div>
        </div>
        <div className="receipt-preview-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onReplace}
            disabled={disabled}
          >
            <FiRefreshCw /> Replace
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRemove}
            disabled={disabled}
          >
            <FiTrash2 /> Remove
          </button>
        </div>
      </div>

      <div className="receipt-preview-body">
        {kind === 'image' && previewUrl ? (
          <img className="receipt-preview-image" src={previewUrl} alt={`Selected receipt: ${file.name}`} />
        ) : (
          <div className="receipt-preview-pdf">
            <FiFileText />
            <div>
              <div className="receipt-preview-pdf-title">PDF selected</div>
              <div className="receipt-preview-pdf-sub">
                Readable text is taken from the PDF, with on-device OCR as a fallback.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
