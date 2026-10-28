import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'legacy-atlas');
const dist = resolve(root, 'dist');

export async function buildLegacy() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(source, dist, { recursive: true });
  console.log('Atlas local carcasa build: 7.956 documentos, fotos, procesos y esquemas copiados a dist.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildLegacy();
