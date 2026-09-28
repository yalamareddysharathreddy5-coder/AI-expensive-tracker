import { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

const PREVIEW_CHARS = 1200;

/**
 * The OCR output, kept for verification. Receipt text can be long, so only a
 * short preview is shown until it is expanded.
 */
export default function ExtractedTextPanel({ text, truncated }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || text.trim().length === 0) return null;

  const isLong = text.length > PREVIEW_CHARS;
  const shown = expanded || !isLong ? text : `${text.slice(0, PREVIEW_CHARS)}\n…`;

  return (
    <div className="receipt-raw">
      <div className="receipt-raw-head">
        <span className="receipt-raw-title">Receipt text</span>
        <span className="receipt-raw-hint">
          {text.length} character{text.length === 1 ? '' : 's'} recognised
        </span>
      </div>

      {truncated && (
        <div className="receipt-raw-note">
          The recognised text was longer than the review screen keeps and has been trimmed.
        </div>
      )}

      <pre className="receipt-raw-text">{shown}</pre>

      {isLong && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? <FiChevronUp /> : <FiChevronDown />}{' '}
          {expanded ? 'Show less' : 'Show extracted text'}
        </button>
      )}
    </div>
  );
}
