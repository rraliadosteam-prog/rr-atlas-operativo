import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let dist;
const rutasPath = resolve('/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/rutas-v3.json');
const binary = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']
  .filter(Boolean).find((name) => spawnSync(name, ['--version']).status === 0);

let server, chrome, profile, origin;
let sequence = 0;
const pending = new Map();
const errors = new Map();

function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP: ${method} agotó el tiempo`)); }, 15_000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
}

async function evaluate(expression, sessionId) {
  const { result } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result?.subtype === 'error') throw new Error(result.description);
  return result?.value;
}

async function navigate(url, sessionId) {
  await send('Page.navigate', { url }, sessionId);
  await send('Runtime.evaluate', { expression: 'new Promise(r => { const check = () => { if (document.readyState === "complete") r(); else requestAnimationFrame(check); }; check(); })', awaitPromise: true }, sessionId);
  await new Promise((r) => setTimeout(r, 200));
}

before(async () => {
  assert.ok(binary, 'Las pruebas de flujo requieren Chrome local (o CHROME_BIN)');
  dist = resolve(await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'atlas-flujo-dist-')));
  await mkdir(dist, { recursive: true });
  await build(root, { local: true, dist });
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://local').pathname;
      const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
      const path = resolve(dist, relative);
      if (!path.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
      const body = await readFile(path);
      const type = relative.endsWith('.mjs') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.png') ? 'image/png' : 'text/html';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  profile = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'atlas-flujo-'));
  chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-pipe'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  let buffer = '';
  chrome.stdio[4].on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const waiting = pending.get(message.id);
      if (waiting) {
        clearTimeout(waiting.timer); pending.delete(message.id);
        if (message.error) waiting.reject(new Error(message.error.message)); else waiting.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const list = errors.get(message.sessionId) ?? [];
        list.push(message.params.exceptionDetails.text); errors.set(message.sessionId, list);
      }
    }
  });
  await send('Browser.getVersion');
});

after(async () => {
  if (chrome) {
    const closed = new Promise((resolve) => chrome.once('exit', resolve));
    await send('Browser.close').catch(() => {});
    await closed;
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
  if (dist) await rm(dist, { recursive: true, force: true });
});

test('las rutas #flujo/<id> de la carcasa v3 renderizan contenido no vacío', async () => {
  const rutas = JSON.parse(await readFile(rutasPath, 'utf8'));
  const flujoIds = rutas.rutas.filter((r) => r.startsWith('#flujo/')).map((r) => decodeURIComponent(r.slice('#flujo/'.length)));
  assert.ok(flujoIds.length > 0, 'Se encontraron rutas #flujo en rutas-v3.json');

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  for (const id of flujoIds) {
    const url = `${origin}/#flujo/${encodeURIComponent(id)}`;
    await navigate(url, sessionId);
    const text = await evaluate('document.body.innerText', sessionId);
    assert.ok(text && text.trim().length > 20, `Ruta #flujo/${id} no renderizó contenido`);
    assert.ok(text.includes('nodos') || text.includes('Volver al árbol'), `Ruta #flujo/${id} no muestra el visor de flujo`);
  }

  await send('Target.closeTarget', { targetId });
});
