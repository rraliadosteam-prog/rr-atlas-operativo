// Prueba de clics reales sobre las rutas #flujo/<id> en escritorio y movil.
// Sirve un dist temporal (nunca el dist del repo) con el fixture de flujos
// inyectado, abre cada ruta con clics reales y guarda capturas en
// docs/fusion/capturas/.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tipos = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.bpmn': 'application/xml' };
const capturas = resolve(root, 'docs', 'fusion', 'capturas');
const rutas = JSON.parse(await readFile(resolve(root, 'fixtures', 'flujo-rutas.json'), 'utf8'));
const flujoIds = rutas.rutas.filter((r) => r.startsWith('#flujo/')).map((r) => decodeURIComponent(r.slice('#flujo/'.length)));

const dist = await mkdtemp(join(tmpdir(), 'atlas-flujo-verify-'));
await build(root, { local: true, dist });
await writeFile(
  resolve(dist, 'src', 'data', 'flujos-v3.local.json'),
  await readFile(resolve(root, 'fixtures', 'flujo-demo.json'), 'utf8'),
  'utf8',
);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = resolve(dist, rel.replace(/^\//, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': tipos[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('no');
  }
});
await new Promise((r) => server.listen(4198, '127.0.0.1', r));
await mkdir(capturas, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errores = [];
const resultados = [];

const vistas = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'movil', width: 390, height: 844 },
];

for (const vista of vistas) {
  const page = await browser.newPage({ viewport: { width: vista.width, height: vista.height }, isMobile: vista.nombre === 'movil', hasTouch: vista.nombre === 'movil' });
  page.on('pageerror', (e) => errores.push(`${vista.nombre}: ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${vista.nombre} console: ${m.text()}`); });

  for (const id of flujoIds) {
    await page.goto(`http://127.0.0.1:4198/#flujo/${encodeURIComponent(id)}`, { waitUntil: 'load' });
    await page.waitForSelector('.flujo-page', { timeout: 15000 });
    await page.waitForTimeout(120);
    const datos = await page.evaluate(() => ({
      titulo: document.querySelector('.flujo-header h1')?.textContent ?? '',
      meta: document.querySelector('.flujo-meta')?.textContent ?? '',
      nodos: document.querySelectorAll('.flujo-node').length,
      carriles: document.querySelectorAll('.flujo-lane').length,
      vacio: document.body.innerText.includes('Flujo no encontrado'),
      volver: document.body.innerText.includes('Volver al árbol'),
    }));
    resultados.push({ vista: vista.nombre, id, ...datos });
  }

  const id = flujoIds[0];
  await page.goto(`http://127.0.0.1:4198/#flujo/${encodeURIComponent(id)}`, { waitUntil: 'load' });
  await page.waitForSelector('.flujo-page', { timeout: 15000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(capturas, `bloque1-flujo-${vista.nombre}-${vista.width}.png`), fullPage: false });
  await page.close();
}

await browser.close();
server.close();
await rm(dist, { recursive: true, force: true });

const conProblema = resultados.filter((r) => r.vacio || r.nodos === 0 || !r.meta.includes('nodos'));
console.log(JSON.stringify({
  rutasProbadas: resultados.length,
  vistas: vistas.map((v) => `${v.nombre} ${v.width}x${v.height}`),
  capturas: vistas.map((v) => `docs/fusion/capturas/bloque1-flujo-${v.nombre}-${v.width}.png`),
  conProblema,
  errores,
  muestra: resultados.slice(0, 3),
}, null, 2));
if (conProblema.length || errores.length) process.exitCode = 1;
