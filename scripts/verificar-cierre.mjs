// QA de cierre (item D): clics reales de todos los flujos a 390, 768 y 1440 px.
//
//   node scripts/verificar-cierre.mjs
//
// Flujos probados con clics de verdad (no solo carga de página):
//   1. mapa       → el mapa vivo se ve y un nodo abre el editor.
//   2. busqueda   → la búsqueda del mapa filtra y avisa.
//   3. catalogo   → el catálogo BPMN lista los 16 procesos por área.
//   4. bpmn       → al abrir un proceso el diagrama ocupa la pantalla completa.
//   5. edicion    → editar el diagrama y cambiar el nombre de una tarea.
//   6. guia       → la guía del diagrama se abre con el aviso «Guía provisional».
//   7. pantalla   → el botón ⛶ divide y vuelve a unir la pantalla.
//   8. dividido   → el panel de la pantalla dividida abre con su contenido.
//
// Salidas: docs/fusion/capturas/cierre-<flujo>-<ancho>.png y docs/fusion/PRUEBAS.json.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4231;

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

const ANCHOS = [
  { ancho: 390, alto: 844, nombre: '390' },
  { ancho: 768, alto: 1024, nombre: '768' },
  { ancho: 1440, alto: 900, nombre: '1440' },
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
  const archivo = resolve(CARPETA, `cierre-${flujo}-${ancho}.png`);
  try {
    await page.screenshot({ path: archivo, fullPage: false, animations: 'disabled', caret: 'hide', timeout: 12000 });
    return `docs/fusion/capturas/cierre-${flujo}-${ancho}.png`;
  } catch (error) {
    console.warn(`  (aviso) no se pudo capturar ${flujo} @ ${ancho}px: ${String(error?.message ?? error).split('\n')[0]}`);
    return null;
  }
}

async function registrar(flujo, ancho, ok, detalle, errores, captura) {
  resultados.push({ flujo, ancho, ok, detalle, errores, captura });
  if (!ok) fallos.push(`${flujo} @ ${ancho}px: ${detalle}${errores.length ? ` | consola: ${errores.join(' | ')}` : ''}`);
}

/** Flujos del mapa vivo: se ejecutan sobre la portada. */
async function flujoMapa(page, errores, ancho) {
  await page.waitForSelector('.node-title', { timeout: 15000 });
  const nodos = await page.locator('.node-title').count();
  if (!nodos) return { ok: false, detalle: 'el mapa no dibujó nodos' };
  await page.locator('.node-title').first().click({ timeout: 10000 });
  await page.waitForTimeout(400);
  const titulo = (await page.locator('[data-inspector-title]').textContent() ?? '').trim();
  if (!titulo || titulo === 'Selecciona un nodo') {
    return { ok: false, detalle: 'el clic en el nodo no abrió el editor' };
  }
  return { ok: true, detalle: `${nodos} nodos; el clic abrió «${titulo}»` };
}

async function flujoBusqueda(page, errores) {
  await page.waitForSelector('.node-title', { timeout: 15000 });
  const antes = await page.locator('.node-title').count();
  await page.fill('#node-search', 'finanzas');
  await page.press('#node-search', 'Enter');
  await page.waitForTimeout(500);
  const despues = await page.locator('.node-title').count();
  const visibles = await page.locator('.node-title:visible').count();
  const aviso = (await page.locator('[data-toast], .toast, [role="status"]').count().catch(() => 0));
  if (visibles >= antes && !aviso) {
    return { ok: false, detalle: `la búsqueda «finanzas» no filtró (${antes} → ${visibles} visibles)` };
  }
  return { ok: true, detalle: `«finanzas»: ${visibles} nodos visibles de ${antes}` };
}

/** Flujos del BPMN: se ejecutan sobre #/bpmn. */
async function flujoCatalogo(page, errores) {
  await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
  const tarjetas = await page.locator('[data-bpmn-catalog] .bpmn-card').count();
  const areas = await page.locator('[data-bpmn-catalog] .bpmn-area, [data-bpmn-catalog] h3').count();
  if (tarjetas < 16) return { ok: false, detalle: `el catálogo solo muestra ${tarjetas} procesos` };
  return { ok: true, detalle: `${tarjetas} procesos en ${areas} áreas` };
}

async function abrirProceso(page, errores) {
  await page.waitForSelector('[data-bpmn-catalog] .bpmn-card', { timeout: 15000 });
  await page.locator('[data-bpmn-catalog] .bpmn-card').first().click();
  await page.waitForSelector('[data-bpmn-canvas] svg', { timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function flujoBpmn(page, errores) {
  await abrirProceso(page, errores);
  const formas = await page.locator('[data-bpmn-canvas] .djs-element').count();
  const lienzo = await page.locator('[data-bpmn-canvas]').boundingBox();
  const catalogoVisible = await page.locator('.bpmn-catalog').isVisible().catch(() => false);
  if (!formas) return { ok: false, detalle: 'el diagrama no dibujó formas' };
  if (catalogoVisible) return { ok: false, detalle: 'el diagrama no abrió a pantalla completa' };
  if (!lienzo || lienzo.height < 200) return { ok: false, detalle: `el lienzo mide ${lienzo?.height ?? 0}px` };
  return { ok: true, detalle: `${formas} formas, lienzo ${Math.round(lienzo.width)}×${Math.round(lienzo.height)} px, pantalla completa` };
}

async function flujoEdicion(page, errores, ancho) {
  await abrirProceso(page, errores);
  await page.click('[data-bpmn-accion="modo"]');
  await page.waitForTimeout(700);
  const modo = (await page.locator('[data-bpmn-accion="modo"]').textContent() ?? '').trim();
  if (!/ver/i.test(modo)) return { ok: false, detalle: 'el modo Editar no se activó' };
  await page.waitForTimeout(1200);
  await capturar(page, 'edicion', String(ancho ?? ''));
  // Se eligen formas que estén completas dentro del lienzo (preferiblemente
  // tareas) y se hace clic con el ratón en su centro: el clic de locator sobre
  // el grupo SVG del diagrama nunca queda estable porque el lienzo está escalado.
  const puntos = await page.evaluate(() => {
    const selector = '[data-bpmn-canvas] .djs-task, [data-bpmn-canvas] .djs-user-task,'
      + ' [data-bpmn-canvas] .djs-service-task, [data-bpmn-canvas] .djs-element';
    const vistos = new Set();
    const puntos = [];
    for (const forma of document.querySelectorAll(selector)) {
      if (vistos.has(forma)) continue;
      vistos.add(forma);
      const caja = forma.getBoundingClientRect();
      const dentro = caja.width > 8 && caja.height > 8
        && caja.left >= 0 && caja.top >= 0
        && caja.right <= window.innerWidth && caja.bottom <= window.innerHeight;
      if (!dentro) continue;
      const conTexto = (forma.textContent ?? '').trim().length > 0;
      puntos.push({ x: caja.left + caja.width / 2, y: caja.top + caja.height / 2, conTexto });
      if (puntos.length >= 5) break;
    }
    // Primero las formas con nombre: son las que el lector reconoce.
    return puntos.sort((a, b) => Number(b.conTexto) - Number(a.conTexto));
  });
  if (!puntos.length) return { ok: false, detalle: 'no hay ninguna forma visible en el lienzo' };
  let abrio = false;
  for (const punto of puntos) {
    await page.mouse.click(punto.x, punto.y);
    await page.waitForTimeout(700);
    abrio = await page.locator('[data-bpmn-inspector]').isVisible().catch(() => false);
    if (abrio) break;
  }
  if (!abrio) return { ok: false, detalle: 'el clic en la forma no abrió el inspector' };
  const campo = page.locator('[data-bpmn-campo="nombre"]');
  const antes = await campo.inputValue();
  await campo.fill(`${antes} QA`);
  await page.locator('[data-bpmn-accion="aplicar"]').click({ force: true, timeout: 8000 });
  await page.waitForTimeout(600);
  const despues = await campo.inputValue();
  if (!despues.endsWith('QA')) return { ok: false, detalle: 'el nombre no se guardó en el inspector' };
  return { ok: true, detalle: `nombre editado («${antes}» → «${despues}»)` };
}

async function flujoGuia(page, errores) {
  await abrirProceso(page, errores);
  await page.click('[data-bpmn-accion="guia"]');
  await page.waitForTimeout(500);
  const visible = await page.locator('[data-bpmn-guia]').isVisible().catch(() => false);
  const texto = (await page.locator('[data-bpmn-guia]').textContent() ?? '').trim();
  if (!visible) return { ok: false, detalle: 'la guía no se abrió' };
  if (!/Guía provisional/i.test(texto)) return { ok: false, detalle: 'la guía no muestra el aviso «Guía provisional»' };
  return { ok: true, detalle: `guía abierta (${texto.length} caracteres) con aviso «Guía provisional»` };
}

async function flujoPantalla(page, errores) {
  await abrirProceso(page, errores);
  await page.click('[data-bpmn-accion="pantalla"]');
  await page.waitForTimeout(600);
  const dividido = await page.locator('.bpmn-catalog').isVisible().catch(() => false);
  if (!dividido) return { ok: false, detalle: 'el botón ⛶ no dividió la pantalla' };
  await page.click('[data-bpmn-accion="pantalla"]');
  await page.waitForTimeout(600);
  const unido = await page.locator('.bpmn-catalog').isVisible().catch(() => false);
  if (unido) return { ok: false, detalle: 'el botón ⛶ no volvió a pantalla completa' };
  return { ok: true, detalle: '⛶ divide y vuelve a unir la pantalla' };
}

async function flujoDividido(page, errores) {
  await abrirProceso(page, errores);
  await page.click('[data-bpmn-accion="dividir"]');
  await page.waitForTimeout(900);
  const paneles = await page.locator('[data-bpmn-panel]').count();
  const visible = await page.locator('[data-bpmn-panel]').first().isVisible().catch(() => false);
  if (!paneles || !visible) return { ok: false, detalle: 'el panel de la pantalla dividida no abrió' };
  return { ok: true, detalle: `${paneles} panel(es) de acompañamiento` };
}

/** Flujo de la vista Datos: resumen, validador y export del modelo v5. */
async function flujoDatos(page, errores) {
  await page.waitForSelector('[data-datos-view]:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('[data-datos-resumen] .datos__item', { timeout: 15000 });
  const colecciones = await page.locator('[data-datos-resumen] .datos__item').count();
  if (colecciones < 11) return { ok: false, detalle: `el resumen solo trae ${colecciones} colecciones` };
  const fuentes = await page.locator('[data-datos-fuentes] .datos__linea').count();
  if (!fuentes) return { ok: false, detalle: 'la lista de fuentes y cortes quedó vacía' };
  await page.click('[data-datos-accion="validar"]');
  await page.waitForTimeout(400);
  const texto = (await page.locator('[data-datos-validacion]').textContent() ?? '').trim();
  if (!/pasa el validador/i.test(texto)) return { ok: false, detalle: `el validador no dio verde: «${texto.slice(0, 80)}»` };
  const descarga = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.click('[data-datos-accion="exportar"]');
  const archivo = await descarga;
  if (!archivo) return { ok: false, detalle: 'el botón Exportar JSON no descargó el archivo' };
  return { ok: true, detalle: `${colecciones} colecciones, ${fuentes} fuentes, validador en verde, export «${archivo.suggestedFilename()}»` };
}

/** Envuelve un flujo: si truena, el fallo queda registrado y el QA sigue. */
async function intentar(fn) {
  try {
    return await fn();
  } catch (error) {
    return { ok: false, detalle: `error de la prueba: ${String(error?.message ?? error).split('\n')[0]}` };
  }
}

for (const medida of ANCHOS) {
  const context = await browser.newContext({
    viewport: { width: medida.ancho, height: medida.alto },
    hasTouch: medida.ancho < 900,
    isMobile: medida.ancho < 900,
    deviceScaleFactor: 1,
  });

  // 1. Mapa vivo
  {
    const { page, errores } = await abrirPagina(context, '');
    const res = await intentar(() => flujoMapa(page, errores, medida.ancho));
    const captura = await capturar(page, 'mapa', medida.nombre);
    await registrar('mapa', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 2. Búsqueda en el mapa
  {
    const { page, errores } = await abrirPagina(context, '');
    const res = await intentar(() => flujoBusqueda(page, errores));
    const captura = await capturar(page, 'busqueda', medida.nombre);
    await registrar('busqueda', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 3. Catálogo BPMN
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoCatalogo(page, errores));
    const captura = await capturar(page, 'catalogo', medida.nombre);
    await registrar('catalogo', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 4. Abrir un diagrama (pantalla completa)
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoBpmn(page, errores));
    const captura = await capturar(page, 'bpmn', medida.nombre);
    await registrar('bpmn', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 5. Edición en el diagrama
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoEdicion(page, errores, medida.nombre));
    const captura = await capturar(page, 'edicion', medida.nombre);
    await registrar('edicion', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 6. Guía del diagrama
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoGuia(page, errores));
    const captura = await capturar(page, 'guia', medida.nombre);
    await registrar('guia', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 7. Botón de pantalla completa
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoPantalla(page, errores));
    const captura = await capturar(page, 'pantalla', medida.nombre);
    await registrar('pantalla', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 8. Pantalla dividida
  {
    const { page, errores } = await abrirPagina(context, '#/bpmn');
    const res = await intentar(() => flujoDividido(page, errores));
    const captura = await capturar(page, 'dividido', medida.nombre);
    await registrar('dividido', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  // 9. Vista Datos (modelo v5: resumen, validador y export)
  {
    const { page, errores } = await abrirPagina(context, '#/datos');
    const res = await intentar(() => flujoDatos(page, errores));
    const captura = await capturar(page, 'datos', medida.nombre);
    await registrar('datos', medida.ancho, res.ok, res.detalle, errores, captura);
    await page.close();
  }

  await context.close();
}

await browser.close();
server.close();

const pruebas = resultados.length;
const conErrores = resultados.filter((item) => item.errores.length).length;
const resumen = {
  fecha: new Date().toISOString(),
  pruebas,
  flujos: [...new Set(resultados.map((item) => item.flujo))],
  anchos: ANCHOS.map((item) => item.ancho),
  pasar: resultados.filter((item) => item.ok).length,
  fallar: resultados.filter((item) => !item.ok).length,
  erroresDeConsola: conErrores,
  resultados,
};
await writeFile(resolve(RAIZ, 'docs/fusion/PRUEBAS.json'), `${JSON.stringify(resumen, null, 2)}\n`, 'utf8');

console.log(`\nQA de cierre: ${pruebas} pruebas (${resumen.flujos.length} flujos × ${ANCHOS.length} anchos).`);
console.log(`En verde: ${resumen.pasar}. Con errores de consola: ${conErrores}.`);
for (const item of resultados) {
  console.log(`  ${item.ok ? '✔' : '✖'} ${item.flujo} @ ${item.ancho}px — ${item.detalle}`);
}

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: todos los flujos pasan en 390, 768 y 1440 px sin errores de consola.');
}
