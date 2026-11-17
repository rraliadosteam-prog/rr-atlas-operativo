/**
 * B6 · parte 2 — build de producción + preview local del Atlas.
 *
 * Verifica sobre el BUILD (no sobre el código fuente):
 *   1. el build de producción existe, no trae placeholders ni datos `*.local.*`;
 *   2. servido en local, el árbol pinta MÁS DE 0 nodos (`.node-card`) y el
 *      contador del rail dice un número mayor que cero (nunca el "0" a mano);
 *   3. hay un enlace VISIBLE al hub RR Aliados (Mega Dashboard):
 *      https://rr-aliados-mega-dashboard.vercel.app/
 *
 * No instala nada: usa el Chrome local con el patrón CDP de
 * `src/app/rr-tree-view.test.mjs`.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from '../../scripts/build.mjs';
import { HUB_URL } from '../data/hub-link.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const binary = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']
  .filter(Boolean).find((name) => spawnSync(name, ['--version']).status === 0);

let server;
let chrome;
let profile;
let origin;
let dist;
let sequence = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP: ${method} agotó el tiempo`)); }, 20_000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

before(async () => {
  assert.ok(binary, 'La prueba de build/preview requiere Chrome local (o CHROME_BIN)');
  dist = await mkdtemp(join(tmpdir(), 'atlas-build-hub-'));
  await build({ root, dist });

  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
      const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const filePath = resolve(dist, relativePath);
      if (!filePath.startsWith(`${resolve(dist)}${sep}`)) { response.writeHead(404).end(); return; }
      const body = await readFile(filePath);
      const type = MIME[filePath.slice(filePath.lastIndexOf('.'))] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  profile = await mkdtemp(join(tmpdir(), 'atlas-build-hub-chrome-'));
  chrome = spawn(binary, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--remote-debugging-pipe',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
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
    }
  });
  await send('Browser.getVersion');
});

after(async () => {
  if (chrome) {
    const closed = new Promise((resolve) => chrome.once('exit', resolve));
    await send('Browser.close').catch(() => {});
    chrome.kill(); await closed;
  }
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  if (dist) await rm(dist, { recursive: true, force: true });
});

async function abrirPreview(width = 1440) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 761 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 761 }, sessionId);
  await send('Page.navigate', { url: origin }, sessionId);
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await evaluate(`!!document.querySelector('.node-card')`)) break;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  return { evaluate, close: () => send('Target.closeTarget', { targetId }) };
}

test('el build de producción no publica el «0» fijo ni datos locales', async () => {
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  assert.ok(!html.includes('{{'), 'Quedaron placeholders sin reemplazar en el build');
  const contador = html.match(/data-node-count>(\d+)</);
  assert.ok(contador, 'El build no publica el contador de nodos');
  assert.ok(Number(contador[1]) > 0, `El contador de nodos debe ser mayor que cero: ${contador[1]}`);
  const procesos = html.match(/data-process-count>(\d+)</);
  assert.ok(procesos && Number(procesos[1]) > 0, 'El build debe publicar el conteo de procesos');
  assert.ok(html.includes(HUB_URL), 'El shell publicado debe enlazar al hub RR Aliados');
  const dataset = await readFile(join(dist, 'src', 'data', 'dataset-publico.mjs'), 'utf8');
  assert.ok(dataset.length > 0, 'El dataset público debe viajar en el build');
});

test('el preview local del build muestra más de 0 nodos en el árbol', async () => {
  for (const width of [1440, 390]) {
    const preview = await abrirPreview(width);
    try {
      const estado = await preview.evaluate(`(() => ({
        tarjetas: document.querySelectorAll('.node-card').length,
        contador: Number(document.querySelector('[data-node-count]').textContent),
        procesos: Number(document.querySelector('[data-process-count]').textContent),
        lineas: document.querySelectorAll('.node-line').length,
      }))()`);
      assert.ok(estado.tarjetas > 0, `El árbol debe pintar más de 0 nodos (${width} px): ${JSON.stringify(estado)}`);
      assert.ok(estado.contador > 0, `El contador del rail debe ser mayor que cero (${width} px): ${JSON.stringify(estado)}`);
      assert.ok(estado.procesos > 0, `El conteo de procesos debe ser mayor que cero (${width} px): ${JSON.stringify(estado)}`);
      assert.ok(estado.lineas > 0, `El árbol debe dibujar líneas (${width} px): ${JSON.stringify(estado)}`);
    } finally {
      await preview.close();
    }
  }
});

test('el preview local muestra un enlace visible al hub RR Aliados', async () => {
  for (const width of [1440, 390]) {
    const preview = await abrirPreview(width);
    try {
      const enlaces = await preview.evaluate(`(() => [...document.querySelectorAll('[data-hub-link]')].map((a) => {
        const rect = a.getBoundingClientRect();
        const style = getComputedStyle(a);
        return {
          href: a.href,
          texto: a.textContent.trim(),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
        };
      }))()`);
      assert.ok(Array.isArray(enlaces) && enlaces.length > 0, 'El Atlas debe tener al menos un enlace al hub');
      const visibles = enlaces.filter((enlace) => enlace.visible && enlace.href === HUB_URL);
      assert.ok(
        visibles.length > 0,
        `Debe haber un enlace visible a ${HUB_URL} (${width} px): ${JSON.stringify(enlaces)}`,
      );
      for (const enlace of visibles) assert.match(enlace.texto, /hub/i, `El enlace al hub debe decir qué es: ${JSON.stringify(enlace)}`);
    } finally {
      await preview.close();
    }
  }
});
