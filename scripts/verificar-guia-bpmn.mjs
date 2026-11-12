// Prueba de clics reales sobre el panel por diagrama (item 4 del encargo).
//   node scripts/verificar-guia-bpmn.mjs
//
// Qué verifica, con clics de verdad y en dos viewports (escritorio 1440 y móvil 390):
//   1. El título del sitio dice «RR Aliados · Atlas operativo» (decisión de Rosas).
//   2. Abrir un proceso del catálogo.
//   3. Clic en «Guía del diagrama» → el panel aparece con:
//      qué busca el diagrama, disparador, resultado, el camino paso a paso,
//      la leyenda de símbolos, la leyenda de colores y la fuente con su corte.
//   4. Cambiar de proceso → el panel se actualiza con la ficha del nuevo diagrama.
//   5. Cerrar la guía → el panel se oculta y el diagrama recupera el ancho.
//   6. La leyenda de colores usa los tokens RR (fucsia, mostaza, orquídea).
//
// Salidas: docs/fusion/capturas/guia-bpmn-*.png y salida por consola.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4213;

const tipos = {
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.bpmn': 'application/xml', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = resolve(DIST, rel.replace(/^\//, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': tipos[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('no encontrado');
  }
});
await new Promise((r) => server.listen(PUERTO, '127.0.0.1', r));
await mkdir(CARPETA, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});

const PROCESO = 'ventas_como_una_oportunidad_se_convierte_en_cliente';
const PROCESO_2 = 'soporte_como_se_resuelve_un_problema_de_un_cliente';

async function corrida(nombreViewport, viewport, esMovil) {
  const page = await browser.newPage({ viewport, isMobile: esMovil, hasTouch: esMovil });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  const pasos = {};

  await page.goto(`http://127.0.0.1:${PUERTO}/#/bpmn`, { waitUntil: 'load' });
  await page.waitForSelector('.bpmn-card', { timeout: 20000 });
  pasos.titulo = await page.title();
  pasos.marca = await page.textContent('.brand');

  await page.click(`[data-bpmn-open="${PROCESO}"]`);
  await page.waitForSelector('.bpmn-canvas .djs-container svg', { timeout: 30000 });
  await page.waitForTimeout(1200);

  // Abrir la guía.
  await page.click('[data-bpmn-accion="guia"]');
  await page.waitForSelector('.bpmn-guia:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(600);
  pasos.guia = await page.evaluate(() => {
    const panel = document.querySelector('[data-bpmn-guia]');
    const cuerpo = document.querySelector('[data-bpmn-guia-cuerpo]');
    return {
      visible: panel && !panel.hidden,
      titulo: document.querySelector('[data-bpmn-guia-titulo]')?.textContent?.trim() ?? '',
      texto: cuerpo?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      simbolos: cuerpo?.querySelectorAll('.bpmn-guia__simbolos li').length ?? 0,
      colores: cuerpo?.querySelectorAll('.bpmn-guia__colores li').length ?? 0,
      pasos: cuerpo?.querySelectorAll('.bpmn-guia__pasos li').length ?? 0,
      colorMuestra: cuerpo?.querySelector('.bpmn-guia__muestra')?.getAttribute('style') ?? '',
      boton: document.querySelector('[data-bpmn-accion="guia"]')?.textContent?.trim() ?? '',
    };
  });
  await page.screenshot({ path: `${CARPETA}/guia-bpmn-${nombreViewport}-panel.png`, fullPage: false });

  // Cambiar de proceso: la guía debe hablar del nuevo diagrama.
  // Al abrir un BPMN la vista queda a pantalla completa (item 5), así que el
  // catálogo se esconde: se vuelve con «☰ Procesos» y se abre el otro proceso.
  await page.click('[data-bpmn-catalog-link]');
  await page.waitForSelector('.bpmn-card', { timeout: 10000 });
  await page.click(`[data-bpmn-open="${PROCESO_2}"]`);
  await page.waitForTimeout(1800);
  pasos.guiaTrasCambio = await page.evaluate(() => ({
    titulo: document.querySelector('[data-bpmn-guia-titulo]')?.textContent?.trim() ?? '',
    texto: document.querySelector('[data-bpmn-guia-cuerpo]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  }));

  // Cerrar la guía. En móvil el panel vive debajo del diagrama: primero se
  // acerca a la vista dentro del contenedor que hace scroll.
  await page.evaluate(() => document.querySelector('[data-bpmn-guia]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await page.click('[data-bpmn-accion="cerrar-guia"]');
  await page.waitForTimeout(500);
  pasos.guiaCerrada = await page.evaluate(() => document.querySelector('[data-bpmn-guia]').hidden);

  await page.close();
  return { pasos, errores };
}

const escritorio = await corrida('escritorio-1440', { width: 1440, height: 900 }, false);
const movil = await corrida('movil-390', { width: 390, height: 844 }, true);

console.log(JSON.stringify({ escritorio, movil }, null, 2));

await browser.close();
server.close();

const fallos = [];
for (const [nombre, corrida] of Object.entries({ escritorio, movil })) {
  const { pasos, errores } = corrida;
  if (!pasos.titulo.includes('RR Aliados · Atlas operativo')) fallos.push(`${nombre}: el título no dice «RR Aliados · Atlas operativo»`);
  if (!pasos.marca.includes('RR ALIADOS')) fallos.push(`${nombre}: el encabezado no dice «RR ALIADOS»`);
  if (!pasos.guia.visible) fallos.push(`${nombre}: la guía no se abre`);
  if (!pasos.guia.texto.includes('Qué busca este diagrama')) fallos.push(`${nombre}: la guía no explica qué busca el diagrama`);
  if (!pasos.guia.texto.includes('Disparador')) fallos.push(`${nombre}: la guía no dice cómo arranca el diagrama`);
  if (!pasos.guia.texto.includes('Leyenda de símbolos')) fallos.push(`${nombre}: falta la leyenda de símbolos`);
  if (!pasos.guia.texto.includes('Leyenda de colores')) fallos.push(`${nombre}: falta la leyenda de colores`);
  if (!pasos.guia.texto.includes('Fuente:')) fallos.push(`${nombre}: la guía no muestra la fuente`);
  if (pasos.guia.simbolos < 8) fallos.push(`${nombre}: la leyenda de símbolos trae ${pasos.guia.simbolos} símbolos`);
  if (pasos.guia.colores !== 5) fallos.push(`${nombre}: la leyenda de colores trae ${pasos.guia.colores} colores (se esperaban 5)`);
  if (!pasos.guia.colorMuestra.includes('var(--rr-')) fallos.push(`${nombre}: la leyenda de colores no usa los tokens RR`);
  if (!pasos.guia.pasos) fallos.push(`${nombre}: la guía no trae el camino paso a paso`);
  if (pasos.guiaTrasCambio.texto === pasos.guia.texto) fallos.push(`${nombre}: la guía no se actualiza al cambiar de proceso`);
  if (!pasos.guiaCerrada) fallos.push(`${nombre}: la guía no se cierra`);
  if (errores.length) fallos.push(`${nombre}: errores de consola: ${errores.join(' | ')}`);
}

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: panel por diagrama verificado en escritorio y móvil.');
}
