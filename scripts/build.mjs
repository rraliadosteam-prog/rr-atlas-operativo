import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DATA_PATH = ['src', 'data', 'atlas.local.json'];
const LOCAL_FLUJOS_PATH = ['src', 'data', 'flujos-v3.local.json'];
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
      dist: rootOrOptions.dist ? resolve(rootOrOptions.dist) : undefined,
    };
  }
  return {
    root: resolve(rootOrOptions ?? DEFAULT_ROOT),
    local: Boolean(maybeOptions?.local),
    dist: maybeOptions?.dist ? resolve(maybeOptions.dist) : undefined,
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

async function copyLocalFlujos(root, dist, local) {
  if (!local) return;
  const source = resolve(root, ...LOCAL_FLUJOS_PATH);
  try {
    await stat(source);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  await cp(source, resolve(dist, ...LOCAL_FLUJOS_PATH));
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

// El visor BPMN (bpmn-js, diagram-js y bpmnlint) no se puede cargar como ESM
// suelto desde el navegador: se empaqueta con esbuild. La licencia de bpmn.io
// exige que el aviso "Powered by bpmn.io" siga visible, y por eso los CSS
// oficiales se copian a dist/src/bpmn/vendor.
async function buildBpmnBundle(root, dist) {
  const entry = resolve(root, 'src', 'bpmn', 'entry.mjs');
  try {
    await stat(entry);
  } catch {
    console.log('Atlas shell build: sin motor BPMN en esta raiz; se omite el bundle.');
    return { bundled: false, vendor: false };
  }
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    outfile: resolve(dist, 'src', 'bpmn', 'bpmn-bundle.mjs'),
    legalComments: 'inline',
    minify: true,
    banner: {
      js: '/* Visor BPMN de RR Atlas. bpmn-js se usa bajo la licencia de bpmn.io: el aviso Powered by bpmn.io permanece visible. */',
    },
  });
  const assets = resolve(root, 'node_modules', 'bpmn-js', 'dist', 'assets');
  try {
    await stat(assets);
  } catch {
    console.log('Atlas shell build: bundle BPMN listo; faltan los CSS de bpmn-js.');
    return { bundled: true, vendor: false };
  }
  await cp(assets, resolve(dist, 'src', 'bpmn', 'vendor'), { recursive: true });
  return { bundled: true, vendor: true };
}

export async function findLocalArtifacts(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await findLocalArtifacts(resolve(directory, entry.name), relativePath));
    else if (entry.name.includes('.local.')) found.push(relativePath);
  }
  return found;
}

export async function assertNoLocalArtifacts(dist) {
  const leaked = await findLocalArtifacts(dist);
  if (leaked.length > 0) {
    throw new Error(`Artefactos locales filtrados en el dist: ${leaked.join(', ')}`);
  }
  return true;
}

export async function build(rootOrOptions = DEFAULT_ROOT, maybeOptions = {}) {
  const { root, local, dist: customDist } = normalizeBuildOptions(rootOrOptions, maybeOptions);
  const input = await readFile(resolve(root, 'index.html'), 'utf8');
  const output = validateShell(input);
  const localData = local ? await readLocalData(root) : {};
  const dist = customDist ?? resolve(root, 'dist');

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await writeFile(resolve(dist, 'index.html'), output, 'utf8');
  await copyPublicSource(root, dist);
  await copyGrafoViewer(root, dist);
  await copyLocalFlujos(root, dist, local);
  await mkdir(resolve(dist, ...LOCAL_OVERRIDE_PATH.slice(0, -1)), { recursive: true });
  const serialized = local ? JSON.stringify(localData, null, 2) : '{}';
  await writeFile(resolve(dist, ...LOCAL_OVERRIDE_PATH), `export default ${serialized};\n`, 'utf8');
  await cp(resolve(root, 'rr-logo-mark.png'), resolve(dist, 'rr-logo-mark.png'));
  const bpmn = await buildBpmnBundle(root, dist);
  // Exclusión explícita: ningún *.local.* puede llegar al dist público.
  if (!local) await assertNoLocalArtifacts(dist);
  console.log(`Atlas shell build: modular frontend validated; output dist/index.html (BPMN bundle: ${bpmn.bundled ? 'sí' : 'no'}, vendor CSS: ${bpmn.vendor ? 'sí' : 'no'})`);
  return { dist, local };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await build(DEFAULT_ROOT, { local: process.argv.includes('--local') });
}
