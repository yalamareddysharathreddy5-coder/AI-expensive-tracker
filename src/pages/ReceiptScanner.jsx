import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiFileText, FiRefreshCw } from 'react-icons/fi';
import { formatCurrency, todayISO } from '../utils/format';
import useExpenseContext from '../context/ExpenseContext';
import {
  SCAN_STATUS,
  SUPPORTED_FORMAT_LABEL,
  buildReceiptDraft,
  describeScanStatus,
  detectReceiptKind,
  scanReceipt,
  validateReceiptFile,
} from '../services/receiptScanner';
import { buildReceiptExpense } from '../services/receiptExpense';
import ReceiptDropzone from '../components/receipt/ReceiptDropzone';
import ReceiptPreview from '../components/receipt/ReceiptPreview';
import ScanningState from '../components/receipt/ScanningState';
import ExtractedFieldsPanel from '../components/receipt/ExtractedFieldsPanel';
import ExtractedTextPanel from '../components/receipt/ExtractedTextPanel';
import ReceiptReviewForm from '../components/receipt/ReceiptReviewForm';

const IDLE = 'idle';
const SELECTED = 'selected';
const SCANNING = 'scanning';
const REVIEW = 'review';
const ERROR = 'error';
const SAVED = 'saved';

const EMPTY_DRAFT = {
  merchant: '',
  amount: '',
  category: '',
  date: '',
  paymentMethod: '',
  description: '',
};

export default function ReceiptScanner() {
  const { addExpense, settings } = useExpenseContext();
  const navigate = useNavigate();

  const replaceInputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const abortRef = useRef(null);
  const scanTokenRef = useRef(0);

  const [file, setFile] = useState(null);
  const [kind, setKind] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileError, setFileError] = useState(null);
  const [status, setStatus] = useState(IDLE);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [notices, setNotices] = useState([]);
  const [errors, setErrors] = useState({});
  const [categorySource, setCategorySource] = useState(null);
  const [saved, setSaved] = useState(null);

  // Only the temporary object URL is released. The user's file is never copied
  // into app state, and the preview URL is revoked as soon as it is replaced so
  // a long session does not hold several decoded receipts at once.
  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  // A scan in flight is abandoned if the page goes away mid-recognition.
  useEffect(
    () => () => {
      if (abortRef.current) abortRef.current.abort();
    },
    []
  );

  function resetToUpload() {
    scanTokenRef.current += 1;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    releasePreview();
    setFile(null);
    setKind(null);
    setPreviewUrl('');
    setFileError(null);
    setStatus(IDLE);
    setStage('');
    setResult(null);
    setDraft(EMPTY_DRAFT);
    setNotices([]);
    setErrors({});
    setCategorySource(null);
    setSaved(null);
  }

  async function handleFile(nextFile) {
    if (!nextFile) return;

    // Abandon any scan already in flight *before* validating, so an earlier
    // recognition cannot land on top of the file the user just picked.
    scanTokenRef.current += 1;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    releasePreview();
    setSaved(null);
    setResult(null);
    setErrors({});
    setNotices([]);
    setDraft(EMPTY_DRAFT);
    setCategorySource(null);
    setFileError(null);
    setStatus(SELECTED);
    setStage('');

    // A rejected file is reported without ever being decoded, so an oversized
    // or unsupported file costs nothing.
    const validation = validateReceiptFile(nextFile);
    if (!validation.ok) {
      setStatus(IDLE);
      setFile(null);
      setKind(null);
      setPreviewUrl('');
      setFileError({ code: validation.code, message: validation.message });
      return;
    }

    const token = scanTokenRef.current;

    const controller = new AbortController();
    abortRef.current = controller;

    setFile(nextFile);
    setKind(detectReceiptKind(nextFile));

    if (validation.kind === 'image') {
      const url = URL.createObjectURL(nextFile);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }

    setStatus(SCANNING);

    // `handleFile` is an un-awaited React handler, so a rejected promise here
    // would become an unhandled rejection. The scan service is already written
    // to resolve with a status, and this is the backstop for anything it might
    // not anticipate.
    let scanResult;
    try {
      scanResult = await scanReceipt(nextFile, {
        signal: controller.signal,
        onStage: (value) => {
          if (scanTokenRef.current === token) setStage(value);
        },
      });
    } catch {
      if (scanTokenRef.current !== token) return;
      abortRef.current = null;
      setStatus(ERROR);
      setFileError({
        code: 'scan_failed',
        message: 'This receipt could not be processed. You can try again or enter the expense manually.',
      });
      return;
    }

    // A newer scan, a cancel or a remove has already superseded this one.
    if (scanTokenRef.current !== token) return;
    abortRef.current = null;

    setResult(scanResult);

    if (scanResult.status === SCAN_STATUS.OK) {
      const nextDraft = buildReceiptDraft(scanResult, { today: todayISO() });
      setDraft({
        merchant: nextDraft.merchant,
        amount: nextDraft.amount,
        category: nextDraft.category,
        date: nextDraft.date,
        paymentMethod: nextDraft.paymentMethod,
        description: nextDraft.description,
      });
      setNotices(nextDraft.notices);
      setCategorySource(scanResult.fields.category.detected ? 'ai' : null);
      setStatus(REVIEW);
      return;
    }

    setStatus(ERROR);
  }

  function handleCancelScan() {
    scanTokenRef.current += 1;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setStatus(file ? SELECTED : IDLE);
    setStage('');
  }

  function handleDraftChange(next, changedField) {
    setDraft(next);
    // Choosing a category by hand overrides the suggestion, so the expense is
    // no longer recorded as categorised by the engine.
    if (changedField === 'category') setCategorySource(null);
    setErrors((prev) => {
      if (!prev[changedField]) return prev;
      const copy = { ...prev };
      delete copy[changedField];
      return copy;
    });
  }

  function handleConfirm() {
    const built = buildReceiptExpense(draft, { categorySource });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    // The only place a scanned receipt becomes an expense.
    addExpense(built.expense);
    setErrors({});
    setSaved(built.expense);
    setStatus(SAVED);
  }

  function handleCancelReview() {
    setResult(null);
    setDraft(EMPTY_DRAFT);
    setNotices([]);
    setErrors({});
    setCategorySource(null);
    setStatus(SELECTED);
  }

  const scanning = status === SCANNING;
  const showForm = status === REVIEW;
  const showLayout = status !== SAVED;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipt Scanner</h1>
          <p className="page-subtitle">
            Scan a receipt to suggest an expense, then review it before saving
          </p>
        </div>
      </div>

      {status === SAVED && saved && (
        <div className="card receipt-success">
          <div className="alert alert-success">
            <FiCheckCircle /> Expense added successfully.
          </div>
          <div className="receipt-success-body">
            <div className="receipt-success-amount">
              {formatCurrency(saved.amount, settings.currency)}
            </div>
            <div className="receipt-success-meta">
              <span className="chip">
                <span className="chip-dot" />
                {saved.category}
              </span>
              <span className="receipt-success-desc">{saved.description}</span>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/history')}
            >
              View Expense History
            </button>
            <button type="button" className="btn btn-outline" onClick={resetToUpload}>
              <FiRefreshCw /> Scan Another Receipt
            </button>
            <Link className="link-btn" to="/">
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {showLayout && (
        <>
          {fileError && (
            <div className="alert alert-error">
              <FiAlertTriangle /> {fileError.message}
            </div>
          )}

          {status === ERROR && result && (
            <div className="card receipt-failure">
              <div className="alert alert-error">
                <FiAlertTriangle /> {describeScanStatus(result)}
              </div>
              {result.status === SCAN_STATUS.NO_TEXT && (
                <p className="receipt-failure-hint">
                  A sharper photo, better lighting or a straighter angle usually helps. Nothing was
                  saved.
                </p>
              )}
              <div className="receipt-failure-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleFile(file)}
                  disabled={!file}
                >
                  <FiRefreshCw /> Try Again
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate('/add')}
                >
                  <FiFileText /> Enter Expense Manually
                </button>
              </div>
            </div>
          )}

          <div className="receipt-layout">
            <div className="receipt-layout-side">
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Scan Receipt</div>
                </div>

                {!file && (
                  <ReceiptDropzone
                    onFile={handleFile}
                    hint={`Read on this device. Supported formats: ${SUPPORTED_FORMAT_LABEL}. No receipt is uploaded to a server.`}
                  />
                )}

                {file && !scanning && (
                  <ReceiptPreview
                    file={file}
                    kind={kind}
                    previewUrl={previewUrl}
                    onReplace={() => replaceInputRef.current && replaceInputRef.current.click()}
                    onRemove={resetToUpload}
                    disabled={showForm}
                  />
                )}

                {scanning && (
                  <ScanningState
                    stage={stage}
                    fileName={file ? file.name : ''}
                    onCancel={handleCancelScan}
                  />
                )}

                <div className="receipt-footer">
                  <span className="hint">
                    Nothing is saved until you review the scan and press Confirm.
                  </span>
                  <Link className="link-btn" to="/add">
                    Add Expense instead
                  </Link>
                </div>
              </div>

              {result && result.status === SCAN_STATUS.OK && (
                <>
                  <ExtractedFieldsPanel result={result} />
                  <div className="card">
                    <ExtractedTextPanel text={result.rawText} truncated={result.rawTextTruncated} />
                  </div>
                </>
              )}
            </div>

            <div className="receipt-layout-main">
              {showForm ? (
                <ReceiptReviewForm
                  draft={draft}
                  fields={result ? result.fields : null}
                  onChange={handleDraftChange}
                  errors={errors}
                  notices={notices}
                  currency={settings.currency}
                  onConfirm={handleConfirm}
                  onCancel={handleCancelReview}
                  onManualEntry={() => navigate('/add')}
                />
              ) : (
                <div className="card receipt-placeholder">
                  <div className="empty-state">
                    <div className="empty-icon">
                      <FiFileText />
                    </div>
                    <h3>Nothing to review yet</h3>
                    <p>
                      Choose a receipt to extract a suggested merchant, amount, date, category and
                      payment method. Extracted values are suggestions and are never saved
                      automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kept mounted so "Replace" can reopen the file picker after the
              dropzone has been replaced by the preview. */}
          <input
            ref={replaceInputRef}
            type="file"
            className="receipt-hidden-input"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            onChange={(event) => {
              const next = event.target.files && event.target.files[0];
              event.target.value = '';
              if (next) handleFile(next);
            }}
          />
        </>
      )}
    </div>
  );
}
