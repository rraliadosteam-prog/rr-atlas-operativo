// Prueba de clics reales de la pantalla dividida (item 6 del encargo).
//   node scripts/verificar-dividido.mjs
//
// Qué verifica, con clics de verdad, en escritorio 1440×900 y móvil 390×844:
//   1. El botón «▥ Dividir» abre el panel al lado del diagrama.
//   2. El diagrama principal sigue vivo (formas, recorrido, informe de lint).
//   3. La pestaña «Otro diagrama» muestra un segundo diagrama (visor aparte).
//   4. La pestaña «Esquema» muestra las áreas con sus procesos y, al tocar
//      un proceso, ese proceso se abre en el diagrama principal.
//   5. La pestaña «Inicio» muestra las tarjetas de cliente y de servicio, con
//      su fuente y su corte, y sin cifras ni datos de personas.
//   6. El panel se cierra con «×» y la tecla D lo vuelve a abrir.
//   7. Nada de scroll horizontal y ningún error de consola.
//
// Salidas: docs/fusion/capturas/dividido-*.png y salida por consola.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4218;

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

const MEDIR = () => {
  const vista = document.querySelector('[data-bpmn-view]');
  const panel = document.querySelector('[data-bpmn-split]');
  const lienzo = document.querySelector('[data-bpmn-canvas]');
  const lienzoMini = document.querySelector('[data-bpmn-split-canvas]');
  const chips = document.querySelectorAll('[data-bpmn-esquema-proceso]');
  const tarjetas = document.querySelectorAll('.bpmn-tarjeta');
  const caja = (elemento) => {
    if (!elemento) return null;
    const r = elemento.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) };
  };
  const visible = (elemento) => {
    if (!elemento) return false;
    const estilos = getComputedStyle(elemento);
    return estilos.display !== 'none' && estilos.visibility !== 'hidden' && !elemento.hidden;
  };
  return {
    dividido: vista?.classList.contains('is-dividido') ?? false,
    panelVisible: visible(panel),
    lienzoCaja: caja(lienzo),
    miniCaja: caja(lienzoMini),
    formas: document.querySelectorAll('[data-bpmn-canvas] .djs-element').length,
    formasMini: document.querySelectorAll('[data-bpmn-split-canvas] .djs-element').length,
    formasMiniVisibles: (() => {
      if (!lienzoMini) return 0;
      const r = lienzoMini.getBoundingClientRect();
      return [...document.querySelectorAll('[data-bpmn-split-canvas] .djs-element')].filter((elemento) => {
        const b = elemento.getBoundingClientRect();
        return b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right;
      }).length;
    })(),
    chips: chips.length,
    areas: document.querySelectorAll('.bpmn-esquema__area').length,
    tarjetas: tarjetas.length,
    clientes: document.querySelectorAll('[data-bpmn-pane="inicio"] .bpmn-inicio__grupo:first-child .bpmn-tarjeta').length,
    opciones: document.querySelectorAll('[data-bpmn-split-proceso] option').length,
    pestanaActiva: document.querySelector('[data-bpmn-panel][aria-selected="true"]')?.dataset.bpmnPanel ?? '',
    scrollPagina: document.scrollingElement?.scrollWidth ?? 0,
    anchoVentana: window.innerWidth,
    titulo: document.querySelector('[data-bpmn-title]')?.textContent?.trim() ?? '',
    hash: location.hash,
  };
};

async function corrida(nombreViewport, viewport, esMovil) {
  const page = await browser.newPage({ viewport, isMobile: esMovil, hasTouch: esMovil });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  const pasos = {};

  // 1. Abrir un proceso desde el catálogo.
  await page.goto(`http://127.0.0.1:${PUERTO}/#/bpmn`, { waitUntil: 'load' });
  await page.waitForSelector('.bpmn-card', { timeout: 20000 });
  await page.click(`[data-bpmn-open="${PROCESO}"]`);
  await page.waitForSelector('[data-bpmn-canvas] .djs-container svg', { timeout: 30000 });
  await page.waitForTimeout(1200);
  pasos.proceso = await page.evaluate(MEDIR);

  // 2. Abrir la pantalla dividida.
  await page.click('[data-bpmn-accion="dividir"]');
  await page.waitForTimeout(1600);
  pasos.dividido = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/dividido-${nombreViewport}-diagrama.png` });

  // 3. La pestaña «Esquema».
  await page.click('[data-bpmn-panel="esquema"]');
  await page.waitForTimeout(700);
  pasos.esquema = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/dividido-${nombreViewport}-esquema.png` });

  // 4. Tocar un proceso del esquema: se abre en el diagrama principal.
  const chip = await page.$('[data-bpmn-esquema-proceso]:not(.is-active)');
  const idChip = chip ? await chip.getAttribute('data-bpmn-esquema-proceso') : '';
  if (chip) await chip.click();
  await page.waitForTimeout(1400);
  pasos.esquemaClick = { ...(await page.evaluate(MEDIR)), idChip };

  // 5. La pestaña «Inicio» con las tarjetas de cliente y servicio.
  await page.click('[data-bpmn-panel="inicio"]');
  await page.waitForTimeout(700);
  pasos.inicio = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/dividido-${nombreViewport}-inicio.png` });

  // 6. Volver a «Otro diagrama» y cambiar el proceso del visor de al lado.
  await page.click('[data-bpmn-panel="diagrama"]');
  await page.waitForTimeout(1200);
  pasos.otroDiagrama = await page.evaluate(MEDIR);
  const opciones = await page.$$eval('[data-bpmn-split-proceso] option', (nodes) => nodes.map((n) => n.value));
  if (opciones.length > 3) {
    await page.selectOption('[data-bpmn-split-proceso]', opciones[opciones.length - 1]);
    await page.waitForTimeout(1400);
    pasos.otroDiagramaCambiado = await page.evaluate(MEDIR);
  }

  // 7. Cerrar el panel con «×» y volverlo a abrir con la tecla D.
  await page.click('[data-bpmn-accion="cerrar-split"]');
  await page.waitForTimeout(700);
  pasos.cerrado = await page.evaluate(MEDIR);
  await page.keyboard.press('d');
  await page.waitForTimeout(1400);
  pasos.reabierto = await page.evaluate(MEDIR);
  await page.screenshot({ path: `${CARPETA}/dividido-${nombreViewport}-completo.png` });

  await page.close();
  return { pasos, errores };
}

const escritorio = await corrida('escritorio-1440', { width: 1440, height: 900 }, false);
const movil390 = await corrida('movil-390', { width: 390, height: 844 }, true);

console.log(JSON.stringify({ escritorio, movil390 }, null, 2));

await browser.close();
server.close();

const fallos = [];
const revisar = (nombre, corrida, esMovil) => {
  const { pasos, errores } = corrida;
  if (!pasos.dividido.dividido) fallos.push(`${nombre}: el botón «▥ Dividir» no activó la vista dividida`);
  if (!pasos.dividido.panelVisible) fallos.push(`${nombre}: el panel dividido no se ve`);
  if (!pasos.dividido.formas) fallos.push(`${nombre}: el diagrama principal quedó vacío al dividir`);
  if (esMovil) {
    // En vertical el panel va debajo del diagrama: ambos deben tener alto.
    if ((pasos.dividido.lienzoCaja?.height ?? 0) < 180) fallos.push(`${nombre}: el diagrama quedó muy bajo en móvil`);
    if ((pasos.dividido.miniCaja?.height ?? 0) < 120) fallos.push(`${nombre}: el panel de al lado quedó muy bajo en móvil`);
    if ((pasos.dividido.miniCaja?.top ?? 0) < (pasos.dividido.lienzoCaja?.bottom ?? 0)) {
      fallos.push(`${nombre}: en móvil el panel no quedó debajo del diagrama`);
    }
  } else if (pasos.dividido.lienzoCaja?.width >= pasos.dividido.anchoVentana) {
    fallos.push(`${nombre}: el diagrama no se encogió al dividir (${pasos.dividido.lienzoCaja?.width}px)`);
  }
  if (!pasos.dividido.formasMini) fallos.push(`${nombre}: el segundo diagrama no dibujó formas`);
  if (!pasos.dividido.formasMiniVisibles) fallos.push(`${nombre}: el segundo diagrama no tiene formas a la vista`);
  if (!pasos.esquema.chips) fallos.push(`${nombre}: el esquema no listó procesos`);
  if (pasos.esquema.areas < 2) fallos.push(`${nombre}: el esquema no agrupó por áreas`);
  if (pasos.esquemaClick.hash !== `#/bpmn/${pasos.esquemaClick.idChip}`) {
    fallos.push(`${nombre}: tocar un proceso del esquema no abrió ese proceso`);
  }
  if (!pasos.inicio.tarjetas) fallos.push(`${nombre}: el Inicio no mostró tarjetas`);
  if (pasos.inicio.clientes !== 11) fallos.push(`${nombre}: el Inicio no mostró los 11 clientes (mostró ${pasos.inicio.clientes})`);
  if (!pasos.otroDiagrama.formasMini) fallos.push(`${nombre}: al volver a «Otro diagrama» el visor quedó vacío`);
  if (pasos.otroDiagramaCambiado && !pasos.otroDiagramaCambiado.formasMini) {
    fallos.push(`${nombre}: al cambiar el proceso del visor de al lado no se dibujó`);
  }
  if (pasos.cerrado.panelVisible) fallos.push(`${nombre}: «×» no cerró el panel`);
  if (!pasos.reabierto.panelVisible) fallos.push(`${nombre}: la tecla D no volvió a abrir el panel`);
  if (pasos.dividido.scrollPagina > pasos.dividido.anchoVentana + 2) {
    fallos.push(`${nombre}: la página hace scroll horizontal (${pasos.dividido.scrollPagina} > ${pasos.dividido.anchoVentana})`);
  }
  if (errores.length) fallos.push(`${nombre}: errores de consola: ${errores.join(' | ')}`);
};

revisar('escritorio', escritorio, false);
revisar('movil-390', movil390, true);

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: pantalla dividida verificada en escritorio 1440 y móvil 390.');
}
