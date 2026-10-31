import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRRGraph } from '../data/rr-tree.mjs';
import { layoutRRGraph } from '../core/rr-tree.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baseline = process.env.ATLAS_VIEW_BASE;
const evidence = process.env.ATLAS_VIEW_EVIDENCE;
const metrics = [];
let server, chrome, profile, origin;
let sequence = 0;
const pending = new Map();
const errors = new Map();
const frames = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))';
const binary = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']
  .filter(Boolean).find((name) => spawnSync(name, ['--version']).status === 0);

function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP: ${method} agotó el tiempo`)); }, 15_000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
}

before(async () => {
  assert.ok(binary, 'Las pruebas de vista requieren Chrome local (o CHROME_BIN), sin instalar dependencias');
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://local').pathname;
      const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
      const path = resolve(root, relative);
      if (!path.startsWith(`${resolve(root)}${sep}`) || !/^(index\.html|src\/.*\.(mjs|css)|rr-logo-mark\.png)$/.test(relative)) {
        response.writeHead(404).end(); return;
      }
      const body = baseline && relative !== 'rr-logo-mark.png'
        ? execFileSync('git', ['show', `${baseline}:${relative}`], { cwd: root })
        : await readFile(path);
      const type = relative.endsWith('.mjs') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.png') ? 'image/png' : 'text/html';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  profile = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'atlas-view-'));
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
  if (evidence) await mkdir(evidence, { recursive: true });
});

after(async () => {
  if (evidence) await writeFile(join(evidence, 'browser-metrics.json'), JSON.stringify(metrics, null, 2));
  if (chrome) {
    const closed = new Promise((resolve) => chrome.once('exit', resolve));
    await send('Browser.close').catch(() => {});
    chrome.kill(); await closed;
  }
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function openPage(width, seed = null) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Network.setBlockedURLs', { urls: ['*://fonts.googleapis.com/*', '*://fonts.gstatic.com/*'] }, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 761 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 761 }, sessionId);
  await send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' }, sessionId);
  if (seed) await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('rr-atlas-arbol-v2', ${JSON.stringify(seed)})` }, sessionId);
  await send('Page.navigate', { url: origin }, sessionId);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`!!document.querySelector('.node-card')`)) break;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  await evaluate(frames);
  return {
    evaluate,
    click: async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await evaluate(frames); },
    resize: async (width, height) => { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 761 }, sessionId); await evaluate(frames); },
    key: async (key) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key }, sessionId); await evaluate(frames); },
    drag: async (x, startY, endY) => {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x, y: startY }, sessionId);
      for (let step = 1; step <= 5; step++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x, y: startY + (endY-startY)*step/5 }, sessionId);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x, y: endY }, sessionId);
      await evaluate(frames);
    },
    close: async () => { assert.deepEqual(errors.get(sessionId) ?? [], [], 'Sin excepciones de JavaScript'); await send('Target.closeTarget', { targetId }); },
    screenshot: async (name) => {
      if (!evidence || baseline) return;
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      await writeFile(join(evidence, name), Buffer.from(data, 'base64'));
    },
  };
}

async function bounds(page) {
  return page.evaluate(`(() => {
    const wrap = document.querySelector('[data-canvas-wrap]').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.node-card')].map(node => node.getBoundingClientRect());
    const left = Math.min(...cards.map(r => r.left)), right = Math.max(...cards.map(r => r.right));
    const top = Math.min(...cards.map(r => r.top)), bottom = Math.max(...cards.map(r => r.bottom));
    return { count: cards.length, left: left-wrap.left, right: wrap.right-right, top: top-wrap.top, bottom: wrap.bottom-bottom,
      centerX: (left+right-wrap.left-wrap.right)/2, centerY: (top+bottom-wrap.top-wrap.bottom)/2,
      width: wrap.width, height: wrap.height, zoom: document.querySelector('[data-zoom]').textContent };
  })()`);
}

function assertFit(result) {
  assert.ok(result.count > 0);
  for (const edge of ['left', 'right', 'top', 'bottom']) assert.ok(result[edge] >= 23, `Todos los nodos dentro, margen ${edge}: ${JSON.stringify(result)}`);
  assert.ok(Math.abs(result.centerX) <= 1.5 && Math.abs(result.centerY) <= 1.5, `Grafo centrado: ${JSON.stringify(result)}`);
}

for (const width of [390, 1440]) {
  test(`P1 ${width}: carga sin selección ni editor, cierre persistente y Escape`, async () => {
    const page = await openPage(width);
    try {
      const initial = await page.evaluate(`({ selected: document.querySelectorAll('.node-card.is-selected').length, hidden: document.querySelector('[data-inspector]').hidden, display: getComputedStyle(document.querySelector('[data-inspector]')).display, rail: document.querySelector('[data-rail-panel]').open })`);
      metrics.push({ test: 'P1', width, initial });
      assert.equal(initial.selected, 0); assert.equal(initial.hidden, true); assert.equal(initial.display, 'none');
      assert.equal(initial.rail, width > 760);
      await page.screenshot(`${width}px-arbol-general.png`);
      await page.click('[data-id="rr-labs"]');
      assert.equal(await page.evaluate(`document.querySelector('[data-inspector]').hidden`), false);
      await page.key('Escape');
      assert.equal(await page.evaluate(`document.querySelector('[data-inspector]').hidden`), true, 'Escape cierra el editor');
      await page.click('[data-action="add-node"]');
      assert.equal(await page.evaluate(`document.querySelector('[data-inspector]').hidden`), false, 'Añadir abre su editor');
      await page.click('[data-action="close-inspector"]');
      await page.click('[data-action="undo"]'); await page.click('[data-action="redo"]');
      assert.equal(await page.evaluate(`document.querySelector('[data-inspector]').hidden`), true, 'Undo/redo no reabren el editor');
    } finally { await page.close(); }
  });

  test(`P1/P3 ${width}: recarga guardada sin selección, copia interna sin reescribir datos`, async () => {
    const graph = layoutRRGraph(createRRGraph());
    graph.nodes.find(node => node.id === 'rr-labs').desc = 'Mapa público de líneas, etapas, procesos, proyectos y bots responsables.';
    const seed = JSON.stringify({ schemaVersion: 1, ...graph });
    const page = await openPage(width, seed);
    try {
      assert.equal(await page.evaluate(`document.querySelectorAll('.node-card.is-selected').length`), 0);
      assert.equal(await page.evaluate(`document.querySelector('[data-inspector]').hidden`), true);
      await page.click('[data-id="rr-labs"]');
      assert.equal(await page.evaluate(`document.querySelector('.inspector-detail').textContent`), 'Mapa interno de líneas, etapas, procesos, proyectos y bots responsables.');
      assert.equal(await page.evaluate(`localStorage.getItem('rr-atlas-arbol-v2')`), seed);
    } finally { await page.close(); }
  });

  test(`P2 ${width}: fit inicial, resize, rail y grafo ancho con margen sin guardar geometría`, async () => {
    const page = await openPage(width);
    try {
      const initial = await bounds(page); metrics.push({ test: 'P2', width, initial }); assertFit(initial);
      await page.resize(width === 390 ? 430 : 1000, 900); assertFit(await bounds(page));
      await page.click('[data-rail-panel] > summary'); assertFit(await bounds(page));
      await page.evaluate(`(() => { const select=document.querySelector('[data-filter="type"]'); select.value='process'; select.dispatchEvent(new Event('change')); })()`);
      await page.click('[data-action="fit"]');
      const wide = await bounds(page); metrics.push({ test: 'P2-amplio', width, wide }); assertFit(wide);
      assert.equal(await page.evaluate(`localStorage.getItem('rr-atlas-arbol-v2')`), null, 'Encuadrar y filtrar no guardan geometría');
    } finally { await page.close(); }
  });

  test(`P3 ${width}: raíz exacta y todo el texto de la vista es interno`, async () => {
    const page = await openPage(width);
    try {
      await page.click('[data-id="rr-labs"]');
      assert.equal(await page.evaluate(`document.querySelector('.inspector-detail').textContent`), 'Mapa interno de líneas, etapas, procesos, proyectos y bots responsables.');
      assert.doesNotMatch(await page.evaluate(`document.body.textContent`), /\bp[uú]blic[oa]s?\b/i);
      await page.click('[data-action="add-node"]');
      assert.doesNotMatch(await page.evaluate(`document.querySelector('.inspector-detail').textContent`), /\bp[uú]blic[oa]s?\b/i);
    } finally { await page.close(); }
  });

  test(`P4 ${width}: minimapa cerrado, <=160 px, esquina interior y nunca visible en móvil`, async () => {
    const page = await openPage(width);
    try {
      assert.equal(await page.evaluate(`document.querySelector('[data-minimap]').hidden`), true);
      await page.click('.toolbar [data-action="toggle-minimap"]');
      const result = await page.evaluate(`(() => {
        const map=document.querySelector('[data-minimap]'), rect=map.getBoundingClientRect(), wrap=document.querySelector('[data-canvas-wrap]').getBoundingClientRect();
        return { display: getComputedStyle(map).display, width:rect.width, height:rect.height, right:wrap.right-rect.right, bottom:wrap.bottom-rect.bottom, pressed:document.querySelector('.toolbar [data-action="toggle-minimap"]').getAttribute('aria-pressed') };
      })()`);
      metrics.push({ test: 'P4', width, result });
      if (width < 761) assert.equal(result.display, 'none');
      else {
        assert.ok(result.width <= 160 && result.height <= 160);
        assert.ok(result.right >= 8 && result.right <= 20 && result.bottom >= 8 && result.bottom <= 20, JSON.stringify(result));
        assert.equal(result.pressed, 'true');
        await page.click('.minimap [data-action="toggle-minimap"]');
        assert.equal(await page.evaluate(`document.querySelector('[data-minimap]').hidden`), true);
      }
    } finally { await page.close(); }
  });

  test(`J1-J4 ${width}: barra, LOD dinámico, enlaces incidentes y panel de proceso visible`, async () => {
    const page = await openPage(width);
    try {
      assert.equal(await page.evaluate(`document.querySelectorAll('.node-line').length`), 7);
      assert.equal(await page.evaluate(`document.querySelectorAll('.node-stage').length`), 35);
      assert.equal(await page.evaluate(`document.querySelectorAll('.node-process').length`), 0);
      assert.equal(await page.evaluate(`document.querySelectorAll('.edge:not(.edge-hierarchy)').length`), 0);
      assert.equal(await page.evaluate(`!!document.querySelector('.canvas-hint')`), false);
      const toolbar = await page.evaluate(`(() => { const row=document.querySelector('.toolbar-actions').getBoundingClientRect(); return [...document.querySelectorAll('.toolbar-actions button')].filter(e=>e.getBoundingClientRect().width).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,rowRight:row.right})); })()`);
      assert.ok(toolbar.every(r => r.width >= 44 && r.height >= 44 && Math.abs(r.top-toolbar[0].top)<1 && r.left>=0 && r.right<=width), JSON.stringify(toolbar));
      await page.evaluate(`(() => { for(let i=0;i<30;i++) document.querySelector('[data-action="zoom-out"]').click(); for(let i=0;i<7;i++) document.querySelector('[data-action="zoom-in"]').click(); })()`);
      const low = await page.evaluate(`(() => { const card=document.querySelector('.node-line'); return {title:parseFloat(getComputedStyle(card.querySelector('.node-title')).fontSize),status:getComputedStyle(card.querySelector('.node-status')).display}; })()`);
      assert.ok(low.title >= 26); assert.equal(low.status, 'none');
      for (let i=0; i<5; i++) await page.click('[data-action="zoom-in"]');
      assert.equal(await page.evaluate(`document.querySelector('.node-line').classList.contains('lod-high')`), true, 'LOD cambia al hacer zoom sin reconstruir');
      await page.evaluate(`(() => {const input=document.querySelector('[data-search-input]'); input.value='RO-1'; input.dispatchEvent(new Event('input'));})()`);
      await page.click('[data-action="search"]');
      assert.equal(await page.evaluate(`document.querySelector('.inspector-badge').textContent`), 'process');
      assert.equal(await page.evaluate(`document.querySelectorAll('.process-meta dt').length`), 3);
      const selected = await page.evaluate(`(() => {const node=document.querySelector('.node-card.is-selected').getBoundingClientRect(), wrap=document.querySelector('[data-canvas-wrap]').getBoundingClientRect(), editor=document.querySelector('[data-inspector]').getBoundingClientRect(); return {left:node.left-wrap.left,right:wrap.right-node.right,top:node.top-wrap.top,bottom:Math.min(wrap.bottom,innerWidth<=760?editor.top:wrap.bottom)-node.bottom,editorHeight:editor.height};})()`);
      metrics.push({ test: 'panel-proceso', width, selected });
      assert.ok(['left','right','top','bottom'].every(edge => selected[edge] >= 0), JSON.stringify(selected));
      if (width < 761) assert.ok(selected.editorHeight >= 410 && selected.editorHeight <= 430, 'Hoja inicial a 50dvh');
      await page.screenshot(`${width}px-panel-proceso.png`);
      if (width < 761) {
        await page.drag(180, 436, 100);
        const maximum = await page.evaluate(`document.querySelector('[data-inspector]').getBoundingClientRect().height`);
        assert.ok(Math.abs(maximum-844*.85)<1, `Arrastre hasta 85dvh: ${maximum}`);
        await page.drag(180, 140, 800);
        const minimum = await page.evaluate(`document.querySelector('[data-inspector]').getBoundingClientRect().height`);
        assert.ok(Math.abs(minimum-844*.35)<1, `Arrastre hasta 35dvh: ${minimum}`);
      }
      await page.evaluate(`(() => { const input=document.querySelector('[data-search-input]'); input.value=''; input.dispatchEvent(new Event('input')); })()`);
      await page.click('[data-id="line-ropa"] .node-collapse');
      await page.click('[data-id="line-ropa"] .node-collapse');
      await page.click('[data-id="stage-ropa-captacion"] .node-collapse');
      await page.click('[data-id="process-ro-1"]');
      assert.ok(await page.evaluate(`document.querySelectorAll('.edge-cross').length > 0`));
      assert.equal(await page.evaluate(`[...document.querySelectorAll('.edge-cross')].every(e => /Prospección/.test(e.getAttribute('aria-label')) && parseFloat(getComputedStyle(e).strokeWidth)<=1.2 && getComputedStyle(e).stroke==='rgb(151, 61, 143)')`), true);
    } finally { await page.close(); }
  });
}
