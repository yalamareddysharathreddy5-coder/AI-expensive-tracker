/**
 * Test double for `tesseract.js`.
 *
 * The real engine needs a browser, a WebAssembly runtime and a downloadable
 * language model, none of which exist under Node. Substituting only this
 * engine means the flow test still exercises the real provider plumbing, field
 * parsers, categoriser, review form, expense service and localStorage.
 *
 * The text it "reads" comes from `globalThis.__RECEIPT_OCR_TEXT__`, so each
 * test can supply genuine receipt text.
 */
export async function createWorker() {
  return {
    async recognize() {
      const text = globalThis.__RECEIPT_OCR_TEXT__ || '';
      return { data: { text, confidence: 92 } };
    },
    async terminate() {},
  };
}

export function setLogging() {}
