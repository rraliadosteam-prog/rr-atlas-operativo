import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const dist = resolve('dist');
const tipos = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.bpmn': 'application/xml' };

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
await new Promise((r) => server.listen(4199, '127.0.0.1', r));
await mkdir('docs/fusion/capturas', { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });

await page.goto('http://127.0.0.1:4199/#/bpmn', { waitUntil: 'load' });
await page.waitForSelector('.bpmn-card', { timeout: 15000 });
const catalogo = await page.evaluate(() => ({
  tarjetas: document.querySelectorAll('.bpmn-card').length,
  areas: document.querySelectorAll('.bpmn-area').length,
  titulo: document.querySelector('[data-bpmn-title]').textContent,
}));
await page.screenshot({ path: 'docs/fusion/capturas/fase1-catalogo-bpmn.png' });

await page.click('[data-bpmn-open="ventas_como_una_oportunidad_se_convierte_en_cliente"]');
await page.waitForSelector('.bpmn-canvas .djs-container svg', { timeout: 20000 });
await page.waitForTimeout(1200);
const diagrama = await page.evaluate(() => {
  const svg = document.querySelector('.bpmn-canvas .djs-container svg');
  return {
    formas: svg ? svg.querySelectorAll('.djs-visual').length : 0,
    carriles: svg ? [...svg.querySelectorAll('g[data-element-id^="lane_"]')].length : 0,
    titulo: document.querySelector('[data-bpmn-title]').textContent,
    estado: document.querySelector('[data-bpmn-status]').textContent,
    informe: document.querySelector('[data-bpmn-report]').textContent.slice(0, 160),
    hash: location.hash,
  };
});
await page.screenshot({ path: 'docs/fusion/capturas/fase1-proceso-bpmn.png' });

// Marca RR: tipografía y fondo.
const marca = await page.evaluate(() => ({
  h1: getComputedStyle(document.querySelector('.bpmn-view__title')).fontFamily,
  body: getComputedStyle(document.body).fontFamily,
  fondo: getComputedStyle(document.body).backgroundColor,
  tituloBpmn: getComputedStyle(document.querySelector('[data-bpmn-title]')).fontFamily,
}));

// Vuelta al mapa.
await page.click('[data-bpmn-back]');
await page.waitForTimeout(600);
const mapa = await page.evaluate(() => ({
  bpmnOculto: document.querySelector('[data-bpmn-view]').hidden,
  shellVisible: !document.querySelector('.shell').hidden,
  hash: location.hash,
}));

console.log(JSON.stringify({ catalogo, diagrama, marca, mapa, errores }, null, 2));
await browser.close();
server.close();
