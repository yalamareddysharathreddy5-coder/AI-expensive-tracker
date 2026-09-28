import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const entry = resolve(here, 'verify-expense-prediction.mjs');
const outDir = join(projectRoot, 'node_modules', '.cache', 'expense-tracker-tests');
const outfile = join(outDir, 'prediction-bundle.mjs');
mkdirSync(outDir, { recursive: true });

// The app source uses Vite-style extensionless imports, which Node's native ESM
// resolver does not accept. esbuild ships with Vite, so bundle with it and run
// the bundle rather than adding a new dependency.
try {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    outfile,
    logLevel: 'error',
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
