import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DATA_PATH = ['src', 'data', 'atlas.local.json'];
const LOCAL_OVERRIDE_PATH = ['src', 'data', 'local-overrides.mjs'];

export function validateShell(html) {
  if (typeof html !== 'string' || !/^<!doctype html>/i.test(html.trim())) throw new Error('Invalid HTML shell');
  const required = [
    'src/app/rr-tree.mjs',
    'src/styles/rr-tree.css',
    'data-canvas',
    'data-nodes',
    'data-inspector',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`Missing shell marker: ${marker}`);
  }
  if (html.includes('const DEFAULT=') || html.includes('localStorage.setItem')) {
    throw new Error('Application logic leaked into index.html');
  }
  return html;
}

function normalizeBuildOptions(rootOrOptions, maybeOptions) {
  if (rootOrOptions && typeof rootOrOptions === 'object') {
    return {
      root: resolve(rootOrOptions.root ?? DEFAULT_ROOT),
      local: Boolean(rootOrOptions.local),
    };
  }
  return {
    root: resolve(rootOrOptions ?? DEFAULT_ROOT),
    local: Boolean(maybeOptions?.local),
  };
}

async function readLocalData(root) {
  const source = resolve(root, ...LOCAL_DATA_PATH);
  let raw;
  try {
    raw = await readFile(source, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }

  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('La fuente local no contiene JSON válido');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La fuente local debe ser un objeto JSON, no un array');
  }
  return value;
}

async function copyGrafoViewer(root, dist) {
  const source = resolve(root, 'public', 'grafo');
  try {
    await stat(source);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  await cp(source, resolve(dist, 'grafo'), { recursive: true });
}

async function copyPublicSource(root, dist) {
  const source = resolve(root, 'src');
  const destination = resolve(dist, 'src');
  await cp(source, destination, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = relative(source, sourcePath);
      return !relativePath.split(sep).some((part) => part.includes('.local.'));
    },
  });
}

export async function build(rootOrOptions = DEFAULT_ROOT, maybeOptions = {}) {
  const { root, local } = normalizeBuildOptions(rootOrOptions, maybeOptions);
  const input = await readFile(resolve(root, 'index.html'), 'utf8');
  const output = validateShell(input);
  const localData = local ? await readLocalData(root) : {};
  const dist = resolve(root, 'dist');

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await writeFile(resolve(dist, 'index.html'), output, 'utf8');
  await copyPublicSource(root, dist);
  await copyGrafoViewer(root, dist);
  await mkdir(resolve(dist, ...LOCAL_OVERRIDE_PATH.slice(0, -1)), { recursive: true });
  const serialized = local ? JSON.stringify(localData, null, 2) : '{}';
  await writeFile(resolve(dist, ...LOCAL_OVERRIDE_PATH), `export default ${serialized};\n`, 'utf8');
  await cp(resolve(root, 'rr-logo-mark.png'), resolve(dist, 'rr-logo-mark.png'));
  console.log('Atlas shell build: modular frontend validated; output dist/index.html');
  return { dist, local };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await build(DEFAULT_ROOT, { local: process.argv.includes('--local') });
}
