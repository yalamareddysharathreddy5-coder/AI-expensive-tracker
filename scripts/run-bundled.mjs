import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const entry = resolve(here, process.argv[2] || 'verify-app-render.mjs');

// The bundle must live inside the project so Node can resolve the external
// react packages from the project's node_modules.
const outDir = join(projectRoot, 'node_modules', '.cache', 'expense-tracker-tests');
const outfile = join(outDir, 'bundle.mjs');
mkdirSync(outDir, { recursive: true });

// The app source uses Vite-style extensionless and .jsx imports, which Node's
// native ESM resolver does not accept. esbuild ships with Vite, so bundle with
// it and run the bundle rather than adding a new dependency.
try {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    jsx: 'automatic',
    loader: { '.js': 'jsx' },
    outfile,
    logLevel: 'error',
    external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom', 'react-icons/fi'],
  });
  await import(pathToFileURL(outfile).href);
} finally {
  process.on('exit', () => {
    try {
      rmSync(outDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });
}
