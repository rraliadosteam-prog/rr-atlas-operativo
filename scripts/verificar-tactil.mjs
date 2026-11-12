// Verificación táctil del item A (responsive y táctil).
//
//   node scripts/verificar-tactil.mjs
//
// Comprueba, con Chrome real y eventos de verdad, lo que el item 7 dejó
// comprovado a mano:
//
//   1. objetivos  → todos los controles visibles miden 44 px de alto (y de
//                    ancho cuando el control es solo un ícono).
//   2. cabecera   → el título de la vista BPMN no queda montado encima de las
//                    acciones («Unir» encima del título a 390 px).
//   3. menu       → en celular los controles menos usados están en el botón
//                    «⋯» (exportar, restaurar, deshacer…) y caben en pantalla.
//   4. pellizco-mapa → pellizco con dos dedos en el tablero.
//   5. pan-mapa   → arrastre con un dedo en el tablero.
//   6. pellizco-diagrama → pellizco con dos dedos en el diagrama BPMN.
//   7. banda      → la banda de lectura del paso se ve, dice en qué paso se
//                    está y sus objetivos (los botones que tenga) miden 44 px.
//   8. zoom-menos → el botón «−» **reduce** el zoom (el bug B2: «−» que
//                    agrandaba nunca tuvo una prueba que lo detectara).
//
// Salidas: docs/fusion/capturas/tactil-<flujo>-<ancho>.png y
// docs/fusion/TACTIL.json.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4232;

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

const MEDIDAS = [
  { ancho: 390, alto: 844, nombre: '390' },
  { ancho: 768, alto: 1024, nombre: '768' },
  { ancho: 360, alto: 740, nombre: '360' },
];

const base = `http://127.0.0.1:${PUERTO}`;
const resultados = [];
const fallos = [];

async function abrirPagina(context, hash = '') {
  const page = await context.newPage();
  const errores = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(String(error.message ?? error)));
  await page.goto(`${base}/${hash}`, { waitUntil: 'domcontentloaded' });
  return { page, errores };
}

async function capturar(page, flujo, ancho) {
  const archivo = resolve(CARPETA, `tactil-${flujo}-${ancho}.png`);
  try {
    await page.screenshot({ path: archivo, animations: 'disabled', caret: 'hide', timeout: 12000 });
    return `docs/fusion/capturas/tactil-${flujo}-${ancho}.png`;
  } catch (error) {
    console.warn(`  (aviso) no se pudo capturar ${flujo} @ ${ancho}px`);
    return null;
  }
}

async function registrar(flujo, ancho, ok, detalle, errores, captura) {
  resultados.push({ flujo, ancho, ok, detalle, errores, captura });
  if (!ok) fallos.push(`${flujo} @ ${ancho}px: ${detalle}${errores.length ? ` | consola: ${errores.join(' | ')}` : ''}`);
}

/** Espera un cuadro para que el navegador aplique el gesto. */
const RAF = `(callback) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`;

/** 1 · Objetivos táctiles: todo control visible mide 44 px de alto. */
async function flujoObjetivos(page) {
  await page.waitForSelector('.node-title', { timeout: 15000 });
  const medidos = await page.evaluate(() => {
    const selectores = [
      '.topbar button', '.topbar a.button', '.topbar .icon-button', '.topbar .brand',
      '.toolbar button', '.toolbar .button-small', '.rail button', '.rail a.button',
      '.node-card button', '.node-card .node-control', '.searchbar button', '.searchbar input',
    ];
    const vistos = new Set();
    const lista = [];
    for (const selector of selectores) {
      for (const elemento of document.querySelectorAll(selector)) {
        if (vistos.has(elemento)) continue;
        vistos.add(elemento);
        const caja = elemento.getBoundingClientRect();
        if (caja.width < 1 || caja.height < 1) continue;
        if (getComputedStyle(elemento).visibility === 'hidden') continue;
        const texto = (elemento.innerText ?? '').trim();
        const soloIcono = texto.length <= 2;
        lista.push({
          etiqueta: (elemento.getAttribute('aria-label') || texto || elemento.className || selector).slice(0, 48),
          ancho: Math.round(caja.width * 10) / 10,
          alto: Math.round(caja.height * 10) / 10,
          soloIcono,
        });
      }
    }
    return lista;
  });
  if (!medidos.length) return { ok: false, detalle: 'no se encontró ningún control visible' };
  const bajos = medidos.filter((item) => item.alto < 43.5);
  const angostos = medidos.filter((item) => item.soloIcono && item.ancho < 43.5);
  const detalle = `${medidos.length} controles medidos; mínimo ${Math.min(...medidos.map((m) => m.alto))} px de alto`;
  if (bajos.length || angostos.length) {
    const lista = [...bajos.map((m) => `${m.etiqueta} (${m.ancho}×${m.alto})`), ...angostos.map((m) => `${m.etiqueta} (${m.ancho}×${m.alto})`)];
    return { ok: false, detalle: `${detalle}; por debajo de 44 px: ${lista.join(', ')}` };
  }
  return { ok: true, detalle };
}

/** 2 · La cabecera del diagrama no superpone el título con las acciones. */
async function flujoCabecera(page) {
  await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
  await page.locator('[data-bpmn-catalog] .bpmn-card').first().click();
  await page.waitForSelector('[data-bpmn-canvas] svg', { timeout: 20000 });
  await page.waitForTimeout(900);
  const cajas = await page.evaluate(() => {
    const titulo = document.querySelector('[data-bpmn-title]');
    const acciones = document.querySelector('.bpmn-view__actions');
    if (!titulo || !acciones) return null;
    const a = titulo.getBoundingClientRect();
    const b = acciones.getBoundingClientRect();
    return { titulo: { left: a.left, right: a.right, top: a.top, bottom: a.bottom }, acciones: { left: b.left, right: b.right, top: b.top, bottom: b.bottom } };
  });
  if (!cajas) return { ok: false, detalle: 'no se encontró el título ni las acciones' };
  const solapan = cajas.titulo.right > cajas.acciones.left + 0.5
    && cajas.acciones.right > cajas.titulo.left + 0.5
    && cajas.titulo.bottom > cajas.acciones.top + 0.5
    && cajas.acciones.bottom > cajas.titulo.top + 0.5;
  const detalle = `título ${Math.round(cajas.titulo.right)} px · acciones desde ${Math.round(cajas.acciones.left)} px`;
  if (solapan) return { ok: false, detalle: `el título se monta sobre las acciones: ${detalle}` };
  if (cajas.acciones.right > windowWidth(page)) return { ok: false, detalle: `las acciones se salen de la pantalla: ${detalle}` };
  return { ok: true, detalle: `sin solape: ${detalle}` };
}

function windowWidth(page) {
  return page.viewportSize()?.width ?? 0;
}

/** 3 · En celular, los controles menos usados viven en el menú «⋯». */
async function flujoMenu(page) {
  const menu = page.locator('[data-bpmn-menu-mas]');
  if (!(await menu.isVisible().catch(() => false))) {
    return { ok: true, detalle: 'el menú «⋯» no aplica en este ancho (barra completa)' };
  }
  await menu.locator('summary').click();
  await page.waitForTimeout(350);
  const abierta = await menu.evaluate((elemento) => elemento.open);
  if (!abierta) return { ok: false, detalle: 'el menú «⋯» no se abrió' };
  const acciones = await menu.locator('.bpmn-menu__lista button').evaluateAll((botones) => botones.map((boton) => ({
    texto: (boton.innerText ?? '').trim(),
    alto: Math.round(boton.getBoundingClientRect().height * 10) / 10,
    ancho: Math.round(boton.getBoundingClientRect().width * 10) / 10,
    derecha: Math.round(boton.getBoundingClientRect().right),
    visible: boton.getBoundingClientRect().width > 0,
  })));
  const esperadas = ['deshacer', 'rehacer', 'guardar', 'restaurar', 'exportar'];
  const faltan = esperadas.filter((clave) => !acciones.some((accion) => accion.texto.toLowerCase().includes(clave)));
  if (faltan.length) return { ok: false, detalle: `faltan acciones en el menú: ${faltan.join(', ')}` };
  const bajos = acciones.filter((accion) => accion.alto < 43.5);
  if (bajos.length) {
    return { ok: false, detalle: `acciones del menú con menos de 44 px: ${bajos.map((a) => `${a.texto} (${a.alto})`).join(', ')}` };
  }
  const ancho = windowWidth(page);
  const fuera = acciones.filter((accion) => accion.derecha > ancho + 1);
  if (fuera.length) return { ok: false, detalle: 'el menú se sale de la pantalla' };
  const ocultas = await page.locator('.bpmn-toolbar .bpmn-secundario:visible').count();
  if (ocultas) return { ok: false, detalle: `las acciones del menú siguen duplicadas en la barra (${ocultas})` };
  return { ok: true, detalle: `${acciones.length} acciones en el menú «⋯», todas de ${acciones[0].alto} px` };
}

/** 4 y 5 · Gestos del tablero: pellizco y pan con punteros táctiles. */
async function gestoTablero(page, tipo) {
  const antes = await page.locator('[data-canvas]').evaluate((elemento) => elemento.style.transform || '');
  const lectura = await page.evaluate(async ({ tipo, raf }) => {
    const wrap = document.querySelector('[data-canvas-wrap]');
    const caja = wrap.getBoundingClientRect();
    const cx = caja.left + caja.width / 2;
    const cy = caja.top + caja.height / 2;
    const esperar = eval(raf);
    const puntero = (tipoEvento, id, x, y) => wrap.dispatchEvent(new PointerEvent(tipoEvento, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
      bubbles: true, cancelable: true, isPrimary: id === 1, buttons: tipoEvento === 'pointerup' ? 0 : 1,
    }));
    if (tipo === 'pellizco') {
      puntero('pointerdown', 1, cx - 40, cy);
      puntero('pointerdown', 2, cx + 40, cy);
      await esperar();
      puntero('pointermove', 1, cx - 90, cy);
      puntero('pointermove', 2, cx + 90, cy);
      await esperar();
      puntero('pointerup', 1, cx - 90, cy);
      puntero('pointerup', 2, cx + 90, cy);
    } else {
      puntero('pointerdown', 1, cx, cy);
      await esperar();
      puntero('pointermove', 1, cx + 120, cy + 60);
      await esperar();
      puntero('pointerup', 1, cx + 120, cy + 60);
    }
    await esperar();
    const lienzo = document.querySelector('[data-canvas]');
    return { transform: lienzo.style.transform || '', zoom: (document.querySelector('[data-zoom]')?.textContent ?? '').trim() };
  }, { tipo, raf: RAF });
  const despues = lectura.transform;
  if (!despues || despues === antes) {
    return { ok: false, detalle: `el gesto «${tipo}» no movió el tablero (${antes || 'sin transform'})` };
  }
  return { ok: true, detalle: `«${tipo}» con el dedo: ${antes || 'sin transform'} → ${despues}${lectura.zoom ? ` (zoom ${lectura.zoom})` : ''}` };
}

/** 6 · Pellizco en el diagrama BPMN. */
async function gestoDiagrama(page) {
  // Se mide el tamaño de una forma del diagrama: al pellizcar, la forma crece
  // o se achica en pantalla (así funciona el zoom de diagram-js).
  const medir = () => page.evaluate(() => {
    const forma = document.querySelector('[data-bpmn-canvas] .djs-element');
    if (!forma) return 0;
    return Math.round(forma.getBoundingClientRect().width * 10) / 10;
  });
  const antes = await medir();
  await page.evaluate(async ({ raf }) => {
    const canvas = document.querySelector('[data-bpmn-canvas]');
    const caja = canvas.getBoundingClientRect();
    const cx = caja.left + caja.width / 2;
    const cy = caja.top + caja.height / 2;
    const esperar = eval(raf);
    const puntero = (tipoEvento, id, x, y) => canvas.dispatchEvent(new PointerEvent(tipoEvento, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
      bubbles: true, cancelable: true, isPrimary: id === 1, buttons: tipoEvento === 'pointerup' ? 0 : 1,
    }));
    puntero('pointerdown', 1, cx - 40, cy);
    puntero('pointerdown', 2, cx + 40, cy);
    await esperar();
    puntero('pointermove', 1, cx - 100, cy);
    puntero('pointermove', 2, cx + 100, cy);
    await esperar();
    puntero('pointerup', 1, cx - 100, cy);
    puntero('pointerup', 2, cx + 100, cy);
    await esperar();
  }, { raf: RAF });
  const despues = await medir();
  if (!despues || Math.abs(despues - antes) < 1) {
    return { ok: false, detalle: `el pellizco no movió el diagrama (forma de ${antes} px a ${despues} px)` };
  }
  return { ok: true, detalle: `pellizco en el diagrama: la forma pasó de ${antes} px a ${despues} px` };
}

/** El zoom que dice el gancho de depuración (o `null` si no se puede leer). */
async function leerZoom(page) {
  return page.evaluate(() => {
    const estado = window.__rrAtlasBpmn?.estado?.();
    const zoom = estado && typeof estado === 'object' ? estado.zoom : null;
    return Number.isFinite(zoom) ? zoom : null;
  });
}

/** 7 · La banda de lectura del paso: se ve y sus objetivos son táctiles. */
async function flujoBanda(page) {
  await page.waitForSelector('[data-bpmn-canvas] .djs-visual', { timeout: 20000 });
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const banda = document.querySelector('[data-bpmn-banda]');
    if (!banda) return null;
    const caja = banda.getBoundingClientRect();
    const estilo = getComputedStyle(banda);
    const visible = !banda.hidden && estilo.display !== 'none' && estilo.visibility !== 'hidden'
      && caja.width > 0 && caja.height > 0;
    const objetivos = [...banda.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
      .map((elemento) => {
        const c = elemento.getBoundingClientRect();
        return {
          etiqueta: (elemento.getAttribute('aria-label') || elemento.innerText || elemento.tagName).trim().slice(0, 32),
          ancho: Math.round(c.width * 10) / 10,
          alto: Math.round(c.height * 10) / 10,
        };
      });
    return {
      visible,
      posicion: (document.querySelector('[data-bpmn-banda-posicion]')?.textContent ?? '').trim(),
      nombre: (document.querySelector('[data-bpmn-banda-nombre]')?.textContent ?? '').trim(),
      alto: Math.round(caja.height * 10) / 10,
      objetivos,
    };
  });
  if (!info) return { ok: false, detalle: 'no se encontró la banda de lectura' };
  if (!info.visible) return { ok: false, detalle: 'la banda de lectura no se ve' };
  if (!info.posicion || !info.nombre) {
    return { ok: false, detalle: `la banda no dice en qué paso se está («${info.posicion}» · «${info.nombre}»)` };
  }
  const bajos = info.objetivos.filter((objetivo) => objetivo.alto < 43.5);
  if (bajos.length) {
    return {
      ok: false,
      detalle: `objetivos de la banda por debajo de 44 px: ${bajos.map((o) => `${o.etiqueta} ${o.ancho}×${o.alto}`).join(', ')}`,
    };
  }
  return {
    ok: true,
    detalle: `la banda dice «${info.posicion} · ${info.nombre}» (${info.alto} px de alto) y `
      + (info.objetivos.length
        ? `sus ${info.objetivos.length} objetivos miden 44 px o más`
        : 'no tiene botones propios que medir'),
  };
}

/** 8 · El botón «−» reduce el zoom (bug B2). */
async function flujoZoomMenos(page) {
  await page.waitForSelector('[data-bpmn-canvas] .djs-visual', { timeout: 20000 });
  await page.waitForTimeout(900);
  const antes = await leerZoom(page);
  if (!Number.isFinite(antes)) return { ok: false, detalle: 'no se pudo leer el zoom por el gancho' };
  const boton = page.locator('[data-bpmn-accion="alejar"]');
  await boton.scrollIntoViewIfNeeded({ timeout: 8000 });
  await boton.click({ timeout: 8000 });
  await page.waitForTimeout(700);
  const despues = await leerZoom(page);
  if (!Number.isFinite(despues)) return { ok: false, detalle: 'no se pudo leer el zoom después de pulsar «−»' };
  if (despues >= antes) {
    return { ok: false, detalle: `el botón «−» no reduce el zoom (${antes} → ${despues})` };
  }
  return { ok: true, detalle: `el botón «−» reduce el zoom (${antes} → ${despues})` };
}

/** Envuelve un flujo: si truena, el fallo queda registrado y la QA sigue. */
async function intentar(fn) {
  try {
    return await fn();
  } catch (error) {
    return { ok: false, detalle: `error de la prueba: ${String(error?.message ?? error).split('\n')[0]}` };
  }
}

for (const medida of MEDIDAS) {
  const context = await browser.newContext({
    viewport: { width: medida.ancho, height: medida.alto },
    hasTouch: medida.ancho < 900,
    isMobile: medida.ancho < 900,
    deviceScaleFactor: 1,
  });

  // 1 · Objetivos táctiles del mapa y la barra superior
  {
    const { page, errores } = await abrirPagina(context, '');
    const res = await intentar(() => flujoObjetivos(page));
    const captura = await capturar(page, 'objetivos', medida.nombre);
    await registrar('objetivos', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 2 · Cabecera del diagrama sin solape
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoCabecera(page));
    const captura = await capturar(page, 'cabecera', medida.nombre);
    await registrar('cabecera', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 3 · Menú «⋯» del celular
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
    await page.locator('[data-bpmn-catalog] .bpmn-card').first().click();
    await page.waitForSelector('[data-bpmn-canvas] svg', { timeout: 20000 });
    await page.waitForTimeout(700);
    const res = await intentar(() => flujoMenu(page));
    const captura = await capturar(page, 'menu', medida.nombre);
    await registrar('menu', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 4 y 5 · Gestos del tablero
  for (const tipo of ['pellizco', 'pan']) {
    const { page, errores } = await abrirPagina(context, '');
    await page.waitForSelector('.node-title', { timeout: 15000 });
    await page.waitForTimeout(500);
    const res = await intentar(() => gestoTablero(page, tipo));
    const captura = await capturar(page, `${tipo}-mapa`, medida.nombre);
    await registrar(`${tipo}-mapa`, medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 6 · Pellizco en el diagrama
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
    await page.locator('[data-bpmn-catalog] .bpmn-card').first().click();
    await page.waitForSelector('[data-bpmn-canvas] svg', { timeout: 20000 });
    await page.waitForTimeout(900);
    const res = await intentar(() => gestoDiagrama(page));
    const captura = await capturar(page, 'pellizco-diagrama', medida.nombre);
    await registrar('pellizco-diagrama', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 7 · La banda de lectura del paso
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
    await page.locator('[data-bpmn-catalog] .bpmn-card').first().click();
    await page.waitForSelector('[data-bpmn-canvas] svg', { timeout: 20000 });
    await page.waitForTimeout(900);
    const res = await intentar(() => flujoBanda(page));
    const captura = await capturar(page, 'banda', medida.nombre);
    await registrar('banda', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 8 · El botón «−» reduce el zoom
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
    await page.locator('[data-bpmn-catalog] .bpmn-card').first().click();
    await page.waitForSelector('[data-bpmn-canvas] svg', { timeout: 20000 });
    await page.waitForTimeout(900);
    const res = await intentar(() => flujoZoomMenos(page));
    const captura = await capturar(page, 'zoom-menos', medida.nombre);
    await registrar('zoom-menos', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  await context.close();
}

await browser.close();
server.close();

const resumen = {
  fecha: new Date().toISOString(),
  pruebas: resultados.length,
  pasar: resultados.filter((item) => item.ok).length,
  fallar: resultados.filter((item) => !item.ok).length,
  erroresDeConsola: resultados.filter((item) => item.errores.length).length,
  anchos: MEDIDAS.map((item) => item.ancho),
  resultados,
};
await writeFile(resolve(RAIZ, 'docs/fusion/TACTIL.json'), `${JSON.stringify(resumen, null, 2)}\n`, 'utf8');

console.log(`\nVerificación táctil: ${resumen.pruebas} pruebas (${MEDIDAS.length} anchos).`);
console.log(`En verde: ${resumen.pasar}. Con errores de consola: ${resumen.erroresDeConsola}.`);
for (const item of resultados) {
  console.log(`  ${item.ok ? '✔' : '✖'} ${item.flujo} @ ${item.ancho}px — ${item.detalle}`);
}

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: los controles y los gestos táctiles pasan en 390, 768 y 360 px.');
}
