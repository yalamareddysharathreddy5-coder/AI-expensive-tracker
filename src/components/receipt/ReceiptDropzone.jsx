import { useRef, useState } from 'react';
import { FiUploadCloud } from 'react-icons/fi';
import { SUPPORTED_FORMAT_LABEL, formatMaxSize } from '../../services/receiptScanner';

/**
 * Click or drop target for choosing a receipt. Drag and drop is a convenience
 * here; the file input is the primary path so the control works with a
 * keyboard and on touch devices.
 */
export default function ReceiptDropzone({ onFile, disabled, hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(fileList) {
    const file = fileList && fileList[0];
    if (file) onFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer && event.dataTransfer.files);
  }

  return (
    <div
      className={`receipt-dropzone${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden-input"
        accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
        onChange={(event) => {
          handleFiles(event.target.files);
          // Reset so choosing the same file twice still fires a change event.
          event.target.value = '';
        }}
        disabled={disabled}
        aria-label="Choose a receipt file"
      />

      <div className="receipt-dropzone-icon">
        <FiUploadCloud />
      </div>
      <div className="receipt-dropzone-title">Upload a receipt image or PDF</div>
      <div className="receipt-dropzone-sub">
        Drag and drop a file here, or choose one from your device.
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={disabled}
      >
        <FiUploadCloud /> Choose File
      </button>

      <div className="receipt-dropzone-meta">
        <span>
          Supported: <strong>{SUPPORTED_FORMAT_LABEL}</strong>
        </span>
        <span className="receipt-dropzone-dot" aria-hidden="true">
          &bull;
        </span>
        <span>Maximum {formatMaxSize()}</span>
      </div>

      {hint && <div className="receipt-dropzone-hint">{hint}</div>}
    </div>
  );
}
