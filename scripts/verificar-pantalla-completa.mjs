// Prueba de clics reales del modo «diagrama a pantalla completa» (item 5 del encargo).
//   node scripts/verificar-pantalla-completa.mjs
//
// Qué verifica, con clics de verdad y en tres viewports (escritorio 1440,
// móvil 390 y móvil 360 que es el ancho que reportó Botardo):
//   1. El catálogo se ve partido (lista + zona de diagrama).
//   2. Al abrir un BPMN la página ENTERA es el diagrama: sin catálogo,
//      sin scroll y con el lienzo tomando casi todo el viewport.
//   3. La guía se abre superpuesta encima del diagrama (no lo divide).
//   4. El botón ⛶ alterna entre pantalla completa y vista partida.
//   5. Esc y la tecla P también alternan el modo.
//   6. «Volver al mapa» sigue llevando al mapa vivo.
//
// Salidas: docs/fusion/capturas/pantalla-bpmn-*.png y salida por consola.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4214;

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

// Estado de la página: qué se ve, cuánto ocupa el lienzo y si hay scroll.
const MEDIR = () => {
  const vista = document.querySelector('[data-bpmn-view]');
  const catalogo = document.querySelector('.bpmn-catalog');
  const lienzo = document.querySelector('[data-bpmn-canvas]');
  const guia = document.querySelector('[data-bpmn-guia]');
  const barra = document.querySelector('.bpmn-toolbar');
  const caja = (elemento) => {
    if (!elemento) return null;
    const r = elemento.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) };
  };
  const oculto = (elemento) => {
    if (!elemento) return true;
    const estilos = getComputedStyle(elemento);
    return estilos.display === 'none' || estilos.visibility === 'hidden' || elemento.hidden;
  };
  return {
    completo: vista?.classList.contains('is-completo') ?? false,
    vistaCaja: caja(vista),
    catalogoVisible: !oculto(catalogo),
    guiaVisible: !oculto(guia),
    lienzoCaja: caja(lienzo),
    barraCaja: caja(barra),
    formas: document.querySelectorAll('.bpmn-canvas .djs-element').length,
    formasEnPantalla: [...document.querySelectorAll('.bpmn-canvas .djs-element')].filter((elemento) => {
      const r = elemento.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    }).length,
    scrollPagina: document.scrollingElement?.scrollHeight ?? 0,
    altoVentana: window.innerHeight,
    anchoVentana: window.innerWidth,
    hash: location.hash,
  };
};

async function corrida(nombreViewport, viewport, esMovil) {
  const page = await browser.newPage({ viewport, isMobile: esMovil, hasTouch: esMovil });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  const pasos = {};

  // 1. El catálogo se ve partido.
  await page.goto(`http://127.0.0.1:${PUERTO}/#/bpmn`, { waitUntil: 'load' });
  await page.waitForSelector('.bpmn-card', { timeout: 20000 });
  pasos.catalogo = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/pantalla-bpmn-${nombreViewport}-catalogo.png` });

  // 2. Clic en un proceso: la página entera pasa a ser el diagrama.
  await page.click(`[data-bpmn-open="${PROCESO}"]`);
  await page.waitForSelector('.bpmn-canvas .djs-container svg', { timeout: 30000 });
  await page.waitForTimeout(1400);
  pasos.proceso = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/pantalla-bpmn-${nombreViewport}-completo.png` });

  // 3. La guía se abre encima del diagrama, sin dividirlo.
  await page.click('[data-bpmn-accion="guia"]');
  await page.waitForTimeout(700);
  pasos.guia = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/pantalla-bpmn-${nombreViewport}-guia.png` });
  await page.click('[data-bpmn-accion="cerrar-guia"]');
  await page.waitForTimeout(400);

  // 4. El botón ⛶ divide y vuelve a unir.
  await page.click('[data-bpmn-accion="pantalla"]');
  await page.waitForTimeout(700);
  pasos.dividido = await page.evaluate(MEDIR);
  await page.click('[data-bpmn-accion="pantalla"]');
  await page.waitForTimeout(700);
  pasos.reunido = await page.evaluate(MEDIR);

  // 5. Esc sale de la pantalla completa y la tecla P la vuelve a abrir.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  pasos.trasEscape = await page.evaluate(MEDIR);
  await page.keyboard.press('p');
  await page.waitForTimeout(700);
  pasos.trasTeclaP = await page.evaluate(MEDIR);

  // 6. «Volver al mapa» sigue funcionando.
  await page.click('[data-bpmn-back]');
  await page.waitForTimeout(900);
  pasos.vueltaAlMapa = await page.evaluate(() => ({
    hash: location.hash,
    mapaVisible: Boolean(document.querySelector('.node-card')),
  }));

  await page.close();
  return { pasos, errores };
}

const escritorio = await corrida('escritorio-1440', { width: 1440, height: 900 }, false);
const movil390 = await corrida('movil-390', { width: 390, height: 844 }, true);
const movil360 = await corrida('movil-360', { width: 360, height: 740 }, true);

console.log(JSON.stringify({ escritorio, movil390, movil360 }, null, 2));

await browser.close();
server.close();

const fallos = [];
const revisar = (nombre, corrida) => {
  const { pasos, errores } = corrida;
  if (!pasos.catalogo.catalogoVisible) fallos.push(`${nombre}: el catálogo no se ve en la vista partida`);
  if (pasos.catalogo.completo) fallos.push(`${nombre}: la vista partida no debe ser pantalla completa`);
  if (!pasos.proceso.completo) fallos.push(`${nombre}: al abrir un BPMN la página no pasa a pantalla completa`);
  if (pasos.proceso.catalogoVisible) fallos.push(`${nombre}: el catálogo sigue visible en pantalla completa`);
  if (pasos.proceso.scrollPagina > pasos.proceso.altoVentana + 4) {
    fallos.push(`${nombre}: la página hace scroll en pantalla completa (${pasos.proceso.scrollPagina} > ${pasos.proceso.altoVentana})`);
  }
  const altoLienzo = pasos.proceso.lienzoCaja?.height ?? 0;
  if (altoLienzo < pasos.proceso.altoVentana * 0.55) {
    fallos.push(`${nombre}: el lienzo solo ocupa ${altoLienzo}px de ${pasos.proceso.altoVentana}px`);
  }
  if ((pasos.proceso.lienzoCaja?.bottom ?? 0) > pasos.proceso.altoVentana + 2) {
    fallos.push(`${nombre}: el diagrama se sale por debajo de la pantalla`);
  }
  if (!pasos.proceso.formas) fallos.push(`${nombre}: el diagrama no tiene formas dibujadas`);
  if (!pasos.proceso.formasEnPantalla) fallos.push(`${nombre}: ninguna forma del diagrama queda a la vista`);
  if (!pasos.guia.guiaVisible) fallos.push(`${nombre}: la guía no se abre`);
  if (pasos.guia.lienzoCaja?.width !== pasos.proceso.lienzoCaja?.width) {
    fallos.push(`${nombre}: la guía divide el diagrama en vez de superponerse`);
  }
  if (pasos.dividido.completo) fallos.push(`${nombre}: el botón ⛶ no divide la vista`);
  if (!pasos.dividido.catalogoVisible) fallos.push(`${nombre}: al dividir no vuelve el catálogo`);
  if (!pasos.reunido.completo) fallos.push(`${nombre}: el botón ⛶ no vuelve a pantalla completa`);
  if (pasos.trasEscape.completo) fallos.push(`${nombre}: Esc no sale de la pantalla completa`);
  if (!pasos.trasTeclaP.completo) fallos.push(`${nombre}: la tecla P no abre la pantalla completa`);
  if (!pasos.vueltaAlMapa.mapaVisible) fallos.push(`${nombre}: «Volver al mapa» no vuelve al mapa vivo`);
  if (errores.length) fallos.push(`${nombre}: errores de consola: ${errores.join(' | ')}`);
};

revisar('escritorio', escritorio);
revisar('movil-390', movil390);
revisar('movil-360', movil360);

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: diagrama a pantalla completa verificado en escritorio, móvil 390 y móvil 360.');
}
