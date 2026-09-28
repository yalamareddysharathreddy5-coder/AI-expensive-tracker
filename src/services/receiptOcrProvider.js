/**
 * Receipt OCR provider abstraction.
 *
 * The rest of the application talks only to `runReceiptOcr`, never to an OCR
 * engine directly. Each provider is loaded with a dynamic import, so neither
 * Tesseract nor pdf.js is part of the initial page bundle and a receipt image
 * is only ever decoded in the browser tab.
 *
 * The Tesseract WASM core and the English language model are fetched from a
 * public CDN the first time a receipt is scanned. Nothing about the receipt
 * itself is ever uploaded: the model is downloaded, the image is read locally.
 * If that download fails the caller receives a `provider_unavailable` result
 * and offers manual entry instead of showing a fabricated value.
 */

export const OCR_STAGES = {
  READ: 'Reading file',
  TEXT: 'Extracting text',
  FIELDS: 'Detecting receipt fields',
  PREPARE: 'Preparing expense',
};

export const OCR_ERROR_CODES = {
  UNAVAILABLE: 'provider_unavailable',
  FAILED: 'provider_failed',
  ABORTED: 'aborted',
  NO_TEXT: 'no_text',
};

export const OCR_ERROR_MESSAGES = {
  [OCR_ERROR_CODES.UNAVAILABLE]:
    'The on-device text recognition engine could not be loaded. It is downloaded on first use, so this usually means the network is unavailable. You can enter the expense manually.',
  [OCR_ERROR_CODES.FAILED]:
    'This file could not be read as a receipt. Try a clearer photo, or enter the expense manually.',
  [OCR_ERROR_CODES.ABORTED]: 'Scanning was cancelled.',
  [OCR_ERROR_CODES.NO_TEXT]:
    "We couldn't read enough information from this receipt.",
};

export class ReceiptOcrError extends Error {
  constructor(code, message, cause) {
    super(message || OCR_ERROR_MESSAGES[code] || 'Receipt scanning failed.');
    this.name = 'ReceiptOcrError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw new ReceiptOcrError(OCR_ERROR_CODES.ABORTED);
  }
}

function isOfflineError(error) {
  const message = String((error && error.message) || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('err_internet_disconnected') ||
    message.includes('dynamically imported module')
  );
}

/* ------------------------------------------------------------------ *
 * Tesseract (on-device OCR, images and rasterised PDF pages)
 * ------------------------------------------------------------------ */

const TESSERACT_LANG = 'eng';

async function recognizeWithTesseract(source, { signal, onProgress } = {}) {
  throwIfAborted(signal);

  let createWorker;
  try {
    const module = await import('tesseract.js');
    createWorker = module.createWorker || (module.default && module.default.createWorker);
  } catch (error) {
    throw new ReceiptOcrError(
      isOfflineError(error) ? OCR_ERROR_CODES.UNAVAILABLE : OCR_ERROR_CODES.FAILED,
      undefined,
      error
    );
  }

  if (typeof createWorker !== 'function') {
    throw new ReceiptOcrError(OCR_ERROR_CODES.UNAVAILABLE);
  }

  let worker = null;
  const abort = () => {
    if (worker) {
      const pending = worker.terminate();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    }
  };

  try {
    worker = await createWorker(TESSERACT_LANG, 1, {
      logger: (message) => {
        if (onProgress && message && typeof message.progress === 'number') {
          onProgress(message);
        }
      },
    });
  } catch (error) {
    throw new ReceiptOcrError(
      isOfflineError(error) ? OCR_ERROR_CODES.UNAVAILABLE : OCR_ERROR_CODES.FAILED,
      undefined,
      error
    );
  }

  if (signal) {
    if (signal.aborted) {
      abort();
      throw new ReceiptOcrError(OCR_ERROR_CODES.ABORTED);
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  try {
    const result = await worker.recognize(source);
    const data = (result && result.data) || {};
    return {
      text: typeof data.text === 'string' ? data.text : '',
      meanConfidence: Number.isFinite(data.confidence) ? data.confidence : null,
    };
  } catch (error) {
    if (signal && signal.aborted) throw new ReceiptOcrError(OCR_ERROR_CODES.ABORTED);
    throw new ReceiptOcrError(
      isOfflineError(error) ? OCR_ERROR_CODES.UNAVAILABLE : OCR_ERROR_CODES.FAILED,
      undefined,
      error
    );
  } finally {
    if (signal) signal.removeEventListener('abort', abort);
    abort();
  }
}

/* ------------------------------------------------------------------ *
 * pdf.js (PDF text layer, with OCR fallback for scanned pages)
 * ------------------------------------------------------------------ */

const PDF_MAX_OCR_PAGES = 2;
const PDF_RASTER_SCALE = 2;

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    if (workerModule && workerModule.default) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    }
  } catch {
    // Older pdf.js builds can resolve their worker relative to the bundle.
  }
  return pdfjs;
}

async function readPdfTextLayer(file, signal) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;

  const pages = [];
  try {
    const pageCount = Math.min(doc.numPages, 3);
    for (let i = 1; i <= pageCount; i += 1) {
      throwIfAborted(signal);
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => (typeof item.str === 'string' ? item.str : ''))
          .filter((text) => text.length > 0)
          .join('\n')
      );
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return { text: pages.join('\n\n'), pageCount: doc.numPages };
}

async function rasterizePdfPage(file, pageNumber, signal) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    throwIfAborted(signal);
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PDF_RASTER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new ReceiptOcrError(OCR_ERROR_CODES.FAILED);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    page.cleanup();
    return canvas;
  } finally {
    await doc.destroy();
  }
}

/* ------------------------------------------------------------------ *
 * Provider registry
 * ------------------------------------------------------------------ */

export const RECEIPT_OCR_PROVIDERS = [
  {
    id: 'tesseract-image',
    label: 'On-device OCR (Tesseract)',
    description: 'Reads the image in this browser tab. Nothing is uploaded.',
    kinds: ['image'],
    async extract(file, context) {
      const result = await recognizeWithTesseract(file, context);
      return { ...result, engine: this.label, method: 'image-ocr' };
    },
  },
  {
    id: 'pdf-text',
    label: 'PDF text layer (pdf.js)',
    description: 'Reads selectable text from a digital PDF, then falls back to OCR.',
    kinds: ['pdf'],
    async extract(file, context) {
      const { signal, onStage } = context;

      let text = '';
      try {
        const layer = await readPdfTextLayer(file, signal);
        text = layer.text;
      } catch (error) {
        if (error instanceof ReceiptOcrError) throw error;
        // A missing or broken worker is recoverable: fall through to OCR.
        text = '';
      }

      if (text && text.replace(/\s/g, '').length >= 40) {
        return { text, meanConfidence: null, engine: this.label, method: 'pdf-text-layer' };
      }

      if (onStage) onStage(OCR_STAGES.TEXT);

      // Image-only PDF: rasterise the leading pages and OCR them.
      let combined = text ? `${text}\n` : '';
      let pagesRead = 0;
      for (let page = 1; page <= PDF_MAX_OCR_PAGES; page += 1) {
        let canvas;
        try {
          canvas = await rasterizePdfPage(file, page, signal);
        } catch {
          break;
        }
        if (!canvas) break;
        // eslint-disable-next-line no-await-in-loop
        const ocr = await recognizeWithTesseract(canvas, context);
        combined += `${ocr.text}\n`;
        pagesRead += 1;
        canvas.width = 0;
        canvas.height = 0;
        if (pagesRead >= 1 && ocr.text.replace(/\s/g, '').length >= 40) break;
      }

      if (!combined.trim()) {
        throw new ReceiptOcrError(OCR_ERROR_CODES.NO_TEXT);
      }

      return {
        text: combined,
        meanConfidence: null,
        engine: `${this.label} + on-device OCR`,
        method: pagesRead > 0 ? 'pdf-raster-ocr' : 'pdf-text-layer',
      };
    },
  },
];

export function getReceiptOcrProviders() {
  return RECEIPT_OCR_PROVIDERS.map(({ id, label, description, kinds }) => ({ id, label, description, kinds }));
}

export function selectReceiptOcrProvider(kind) {
  return RECEIPT_OCR_PROVIDERS.find((provider) => provider.kinds.includes(kind)) || null;
}

/**
 * Single entry point used by the scanner service.
 * Always resolves with `{ ok, text, engine, method, meanConfidence, code }`.
 */
export async function runReceiptOcr(file, { kind, signal, onStage, onProgress } = {}) {
  const provider = selectReceiptOcrProvider(kind);
  if (!provider) {
    return { ok: false, code: OCR_ERROR_CODES.FAILED, text: '', engine: null, method: null };
  }

  try {
    throwIfAborted(signal);
    if (onStage) onStage(OCR_STAGES.READ);

    const result = await provider.extract(file, { signal, onStage, onProgress });

    if (!result || typeof result.text !== 'string') {
      return { ok: false, code: OCR_ERROR_CODES.FAILED, text: '', engine: provider.label, method: null };
    }

    return {
      ok: true,
      text: result.text,
      engine: result.engine,
      method: result.method,
      meanConfidence: result.meanConfidence,
    };
  } catch (error) {
    if (error instanceof ReceiptOcrError) {
      return { ok: false, code: error.code, text: '', engine: provider.label, method: null };
    }
    return {
      ok: false,
      code: isOfflineError(error) ? OCR_ERROR_CODES.UNAVAILABLE : OCR_ERROR_CODES.FAILED,
      text: '',
      engine: provider.label,
      method: null,
    };
  }
}
