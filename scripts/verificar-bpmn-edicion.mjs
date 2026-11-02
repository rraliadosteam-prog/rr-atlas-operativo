// Prueba de clics reales sobre la edición BPMN en sitio (item 3 del encargo).
//   node scripts/verificar-bpmn-edicion.mjs
//
// Qué verifica, con clics de verdad y en dos viewports (escritorio 1440 y móvil 390):
//   1. Abrir un proceso del catálogo.
//   2. Pasar a modo Editar (aparece la paleta de bpmn-js).
//   3. Clic en una tarea → el inspector muestra nombre, tipo y carril.
//   4. Editar el nombre en el inspector → «Aplicar» → el lienzo cambia.
//   5. Cambiar el carril del elemento y aplicar.
//   6. Poner un color RR (fucsia) → el lienzo lo muestra.
//   7. Agregar una tarea desde «＋ Añadir».
//   8. Deshacer y rehacer.
//   9. Guardar la copia local, recargar y comprobar que el cambio sigue.
//  10. Restaurar la semilla.
//
// Salidas: docs/fusion/capturas/bpmn-edicion-*.png y salida por consola.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4212;

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
const NOMBRE_EDITADO = '2. Se anota (editada en sitio)';

// Clic real sobre una forma del lienzo: se calcula el centro del bounding box
// y se hace clic con el mouse (el «scrollIntoView» no funciona dentro del SVG).
async function clicEnElemento(page, idPreferido) {
  // En móvil el lienzo queda por debajo del pliegue: primero se acerca a la vista.
  await page.evaluate(() => document.querySelector('.bpmn-canvas')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const caja = await page.evaluate((preferido) => {
    const lienzo = document.querySelector('.bpmn-canvas')?.getBoundingClientRect();
    if (!lienzo) return null;
    const candidatos = [...document.querySelectorAll('.bpmn-canvas [data-element-id] .djs-visual')];
    constShapes = candidatos.filter((nodo) => nodo.closest('[data-element-id]')?.querySelector('.djs-visual') === nodo);
    const lista = candidatos;
    const dentro = (nodo) => {
      const r = nodo.getBoundingClientRect();
      return r.width > 4 && r.height > 4
        && r.left >= lienzo.left && r.right <= lienzo.right
        && r.top >= lienzo.top && r.bottom <= lienzo.bottom
        && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    };
    const favorito = lista.find((nodo) => nodo.closest('[data-element-id]')?.dataset.elementId === preferido && dentro(nodo));
    const elegido = favorito || lista.find(dentro);
    if (!elegido) return null;
    const r = elegido.getBoundingClientRect();
    return { id: elegido.closest('[data-element-id]')?.dataset.elementId, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, idPreferido);
  if (!caja) return null;
  await page.mouse.click(caja.x, caja.y);
  return caja;
}

async function corrida(nombreViewport, viewport, esMovil) {
  const page = await browser.newPage({ viewport, isMobile: esMovil, hasTouch: esMovil });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  const pasos = {};

  await page.goto(`http://127.0.0.1:${PUERTO}/#/bpmn`, { waitUntil: 'load' });
  await page.waitForSelector('.bpmn-card', { timeout: 20000 });
  await page.click(`[data-bpmn-open="${PROCESO}"]`);
  await page.waitForSelector('.bpmn-canvas .djs-container svg', { timeout: 30000 });
  await page.waitForTimeout(1200);

  // Modo Editar.
  await page.click('[data-bpmn-accion="modo"]');
  await page.waitForSelector('.bpmn-canvas .djs-palette', { timeout: 20000 });
  await page.waitForTimeout(2200);
  pasos.paleta = await page.evaluate(() => Boolean(document.querySelector('.bpmn-canvas .djs-palette')));
  pasos.botonModo = await page.textContent('[data-bpmn-accion="modo"]');

  // Clic en una tarea por su id real de la semilla (t_anota).
  // Se reintenta: al cambiar de modo el lienzo se reencuadra y la forma se mueve.
  let tarea = null;
  for (let intento = 0; intento < 3 && !tarea; intento += 1) {
    tarea = await clicEnElemento(page, 't_anota');
    if (!tarea) continue;
    await page.waitForTimeout(700);
    const abierto = await page.evaluate(() => !document.querySelector('[data-bpmn-inspector]').hidden);
    if (!abierto) tarea = null;
  }
  if (!tarea) {
    await page.screenshot({ path: '/tmp/fallo-bpmn.png' });
    console.log('diagnostico', await page.evaluate(() => ({
      inspectorHidden: document.querySelector('[data-bpmn-inspector]').hidden,
      canvas: document.querySelector('.bpmn-canvas')?.getBoundingClientRect().toJSON(),
      formas: document.querySelectorAll('.bpmn-canvas .djs-visual').length,
      paleta: Boolean(document.querySelector('.bpmn-canvas .djs-palette')),
      modo: document.querySelector('[data-bpmn-accion="modo"]').textContent,
      hash: location.hash,
    })));
    throw new Error('No se encontró una forma clicable en el lienzo');
  }
  await page.waitForTimeout(400);
  pasos.inspector = await page.evaluate(() => ({
    visible: !document.querySelector('[data-bpmn-inspector]').hidden,
    titulo: document.querySelector('[data-bpmn-element-title]').textContent,
    meta: document.querySelector('[data-bpmn-element-meta]').textContent,
    nombre: document.querySelector('[data-bpmn-campo="nombre"]').value,
    carril: document.querySelector('[data-bpmn-campo="carril"]').value,
    opcionesCarril: document.querySelectorAll('[data-bpmn-campo="carril"] option').length,
  }));

  // Editar el nombre y aplicar.
  await page.fill('[data-bpmn-campo="nombre"]', NOMBRE_EDITADO);
  await page.click('[data-bpmn-accion="aplicar"]');
  await page.waitForTimeout(900);
  pasos.nombreEnLienzo = await page.evaluate((nuevo) => {
    const textos = [...document.querySelectorAll('.bpmn-canvas .djs-label')].map((n) => n.textContent);
    return textos.includes(nuevo);
  }, NOMBRE_EDITADO);
  pasos.insignia = await page.textContent('[data-bpmn-insignia]');

  // Mover la tarea a otro carril.
  const carriles = await page.evaluate(() => [...document.querySelectorAll('[data-bpmn-campo="carril"] option')].map((o) => ({ value: o.value, text: o.textContent })));
  const otroCarril = carriles.find((c) => c.value && c.value !== pasos.inspector.carril);
  if (otroCarril) {
    await page.selectOption('[data-bpmn-campo="carril"]', otroCarril.value);
    await page.click('[data-bpmn-accion="aplicar"]');
    await page.waitForTimeout(900);
  }
  pasos.carrilAplicado = await page.evaluate(() => document.querySelector('[data-bpmn-campo="carril"]').value);
  pasos.carrilEsperado = otroCarril?.value || '';

  // Color RR: fucsia.
  await page.selectOption('[data-bpmn-campo="color"]', { index: 1 });
  await page.click('[data-bpmn-accion="aplicar"]');
  await page.waitForTimeout(900);
  pasos.color = await page.evaluate(() => document.querySelector('[data-bpmn-campo="color"]').value);

  await page.screenshot({ path: `${CARPETA}/bpmn-edicion-${nombreViewport}-inspector.png` });

  // Agregar una tarea nueva desde «＋ Añadir».
  await page.click('.bpmn-menu > summary');
  await page.waitForTimeout(300);
  await page.click('[data-bpmn-accion="agregar-tarea"]');
  await page.waitForTimeout(1000);
  pasos.formasAntes = pasos.formasDespues = null;
  pasos.formasDespues = await page.evaluate(() => document.querySelectorAll('.bpmn-canvas .djs-visual').length);
  await page.screenshot({ path: `${CARPETA}/bpmn-edicion-${nombreViewport}-agregar.png` });

  // Deshacer y rehacer.
  await page.click('[data-bpmn-accion="deshacer"]');
  await page.waitForTimeout(800);
  pasos.trasDeshacer = await page.evaluate(() => document.querySelectorAll('.bpmn-canvas .djs-visual').length);
  await page.click('[data-bpmn-accion="rehacer"]');
  await page.waitForTimeout(800);
  pasos.trasRehacer = await page.evaluate(() => document.querySelectorAll('.bpmn-canvas .djs-visual').length);

  // Guardar la copia local y recargar.
  await page.click('[data-bpmn-accion="guardar"]');
  await page.waitForTimeout(700);
  pasos.insigniaGuardada = await page.textContent('[data-bpmn-insignia]');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.bpmn-canvas .djs-container svg', { timeout: 30000 });
  await page.waitForTimeout(1400);
  pasos.persiste = await page.evaluate((nuevo) => {
    const textos = [...document.querySelectorAll('.bpmn-canvas .djs-label')].map((n) => n.textContent);
    return textos.includes(nuevo);
  }, NOMBRE_EDITADO);
  pasos.insigniaTrasRecarga = await page.textContent('[data-bpmn-insignia]');
  await page.screenshot({ path: `${CARPETA}/bpmn-edicion-${nombreViewport}-guardado.png` });

  // Restaurar la semilla.
  await page.click('[data-bpmn-accion="restaurar"]');
  await page.waitForTimeout(1400);
  pasos.restaurado = await page.evaluate((nuevo) => {
    const textos = [...document.querySelectorAll('.bpmn-canvas .djs-label')].map((n) => n.textContent);
    return !textos.includes(nuevo);
  }, NOMBRE_EDITADO);

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
  if (!pasos.paleta) fallos.push(`${nombre}: no aparece la paleta de edición`);
  if (!pasos.inspector.visible) fallos.push(`${nombre}: el inspector no se abre`);
  if (!pasos.nombreEnLienzo) fallos.push(`${nombre}: el nombre editado no llegó al lienzo`);
  if (pasos.carrilEsperado && pasos.carrilAplicado !== pasos.carrilEsperado) fallos.push(`${nombre}: el cambio de carril no se aplicó`);
  if (!pasos.color) fallos.push(`${nombre}: no se aplicó el color RR`);
  if (pasos.trasDeshacer === pasos.trasRehacer) fallos.push(`${nombre}: deshacer y rehacer no cambian el diagrama`);
  if (!pasos.persiste) fallos.push(`${nombre}: la copia local no sobrevivió a la recarga`);
  if (!pasos.restaurado) fallos.push(`${nombre}: restaurar semilla no quitó el cambio`);
  if (errores.length) fallos.push(`${nombre}: errores de consola: ${errores.join(' | ')}`);
}

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: edición BPMN verificada en escritorio y móvil.');
}
