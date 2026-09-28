/**
 * Test double for `pdfjs-dist`.
 *
 * Real PDF parsing needs a WebAssembly engine and a rendering canvas, neither
 * of which exist under Node. This stub mirrors the shape the provider actually
 * uses - `getDocument()` returns a loading task whose `promise` resolves to a
 * document - and serves text from `globalThis.__PDF_TEXT__`, so the PDF text
 * layer path, the field parsers and the whole save flow are all exercised for
 * real.
 */
export function getDocument() {
  const text = globalThis.__PDF_TEXT__ || '';

  return {
    promise: Promise.resolve({
      numPages: 1,
      async getPage() {
        return {
          async getTextContent() {
            return { items: text ? [{ str: text }] : [] };
          },
          getViewport() {
            return { width: 100, height: 100 };
          },
          render() {
            return { promise: Promise.resolve() };
          },
          cleanup() {},
        };
      },
      async destroy() {},
    }),
  };
}

export const GlobalWorkerOptions = { workerSrc: '' };
export const version = 'stub';
