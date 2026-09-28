/**
 * Receipt file validation.
 *
 * Kept free of browser APIs so the rules can be unit tested under Node with
 * plain objects standing in for a File.
 */

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const RECEIPT_KIND_BY_TYPE = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
};

export const RECEIPT_KIND_BY_EXTENSION = {
  jpg: 'image',
  jpeg: 'image',
  jfif: 'image',
  png: 'image',
  webp: 'image',
  pdf: 'pdf',
};

export const SUPPORTED_FORMAT_LABEL = 'JPG, JPEG, PNG, WEBP, PDF';

export const RECEIPT_FILE_ERRORS = {
  NOT_A_FILE: 'Unable to process this file.',
  UNSUPPORTED_TYPE: 'Unsupported file type.',
  TOO_LARGE: 'File is too large.',
  EMPTY: 'This file is empty.',
};

function extensionOf(name) {
  if (typeof name !== 'string') return '';
  const dot = name.lastIndexOf('.');
  if (dot === -1) return '';
  return name.slice(dot + 1).trim().toLowerCase();
}

/**
 * Some platforms hand over an empty `type` for files dragged from certain
 * sources, so the extension is used as a fallback rather than rejecting a
 * genuinely valid image.
 */
export function detectReceiptKind(file) {
  if (!file || typeof file !== 'object') return null;

  const type = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
  if (type && RECEIPT_KIND_BY_TYPE[type]) return RECEIPT_KIND_BY_TYPE[type];

  const byExtension = RECEIPT_KIND_BY_EXTENSION[extensionOf(file.name)];
  if (byExtension) return byExtension;

  return null;
}

/**
 * Returns `{ ok: true, kind, file }` or `{ ok: false, code, message }`.
 * Never throws, so a bad file can be reported in the UI instead of crashing.
 */
export function validateReceiptFile(file, options = {}) {
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : MAX_RECEIPT_BYTES;

  if (!file || typeof file !== 'object' || typeof file.name !== 'string') {
    return { ok: false, code: 'NOT_A_FILE', message: RECEIPT_FILE_ERRORS.NOT_A_FILE };
  }

  const kind = detectReceiptKind(file);

  // The size check runs first so an unsupported 40MB file reports the type
  // problem rather than a size problem the user cannot act on.
  if (!kind) {
    return { ok: false, code: 'UNSUPPORTED_TYPE', message: RECEIPT_FILE_ERRORS.UNSUPPORTED_TYPE };
  }

  const size = Number(file.size);
  if (Number.isFinite(size) && size <= 0) {
    return { ok: false, code: 'EMPTY', message: RECEIPT_FILE_ERRORS.EMPTY };
  }

  if (Number.isFinite(size) && size > maxBytes) {
    return { ok: false, code: 'TOO_LARGE', message: RECEIPT_FILE_ERRORS.TOO_LARGE };
  }

  return { ok: true, kind, file };
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMaxSize(bytes = MAX_RECEIPT_BYTES) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
