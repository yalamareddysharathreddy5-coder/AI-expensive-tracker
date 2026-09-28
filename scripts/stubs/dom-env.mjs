import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/scan',
  pretendToBeVisual: true,
});

const { window } = dom;

// A minimal browser surface. Anything the scanner touches is a real
// implementation, not a hand-written mock, so the test exercises the same
// code paths the browser would.
const store = new Map();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});

// jsdom has no object URL support, which is all the preview needs.
let objectUrlCounter = 0;
const liveObjectUrls = [];
window.URL.createObjectURL = () => {
  objectUrlCounter += 1;
  const url = `blob:receipt/${objectUrlCounter}`;
  liveObjectUrls.push(url);
  return url;
};
window.URL.revokeObjectURL = (url) => {
  const index = liveObjectUrls.indexOf(url);
  if (index !== -1) liveObjectUrls.splice(index, 1);
};

const exposed = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'URL',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLFormElement',
  'Event',
  'MouseEvent',
  'File',
  'FileList',
  'Blob',
  'DataTransfer',
  'Node',
  'Element',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'DOMParser',
  'Image',
];

exposed.forEach((key) => {
  const value = window[key];
  if (value === undefined) return;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: key === 'navigator' ? window.navigator : value,
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export { dom, window, store, liveObjectUrls };
export const inputFiles = () => store;
