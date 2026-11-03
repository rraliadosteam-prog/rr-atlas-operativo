// Verificación del bloque 2 · Pulido UX en celular (390 y 360 px).
//
//   node scripts/verificar-movil.mjs
//
// Revisa, con Chrome real, los cuatro arreglos de bajo riesgo que pidió Rosas
// para el celular. No rediseña nada: solo mide.
//
//   1. táctil    → todo control visible mide 44 px de alto (y de ancho cuando
//                  el control es solo un ícono).
//   2. cortes    → ningún texto se queda cortado sin señal (contenido más
//                  alto que la caja y sin puntos suspensivos ni scrolls).
//   3. solapes   → dos controles visibles no se pisan entre sí.
//   4. espaciado → nada queda escondido detrás de la barra inferior ni se
//                  sale de la pantalla por la derecha.
//
// Rutas revisadas: mapa, catálogo BPMN, diagrama BPMN y vista de datos.
//
// Salidas: docs/fusion/MOVIL.json y docs/fusion/capturas/movil-<ruta>-<ancho>.png.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4234;

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
  { ancho: 390, alto: 844 },
  { ancho: 360, alto: 740 },
];

const RUTAS = [
  { nombre: 'mapa', hash: '' },
  { nombre: 'catalogo', hash: '#/bpmn' },
  { nombre: 'diagrama', hash: '#/bpmn/gobierno_como_se_gobierna_la_documentacion' },
  { nombre: 'datos', hash: '#/datos' },
];

const base = `http://127.0.0.1:${PUERTO}`;
const resultados = [];
const fallos = [];

/** Mide en la página lo que el bloque 2 considera «arreglado». */
async function medir(page) {
  return page.evaluate(() => {
    const visibles = (elemento) => {
      const caja = elemento.getBoundingClientRect();
      if (caja.width < 1 || caja.height < 1) return false;
      const estilo = getComputedStyle(elemento);
      if (estilo.visibility === 'hidden' || estilo.display === 'none' || estilo.opacity === '0') return false;
      return true;
    };
    const etiqueta = (elemento) => (
      elemento.getAttribute('aria-label')
      || (elemento.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      || elemento.className
      || elemento.tagName.toLowerCase()
    );

    // Rectángulo visible de verdad: recortado por los ancestros que
    // recortan (overflow hidden/auto/scroll). Lo que queda fuera no se ve.
    const recorte = (elemento) => {
      let caja = elemento.getBoundingClientRect();
      let padre = elemento.parentElement;
      while (padre && padre !== document.body) {
        const estilo = getComputedStyle(padre);
        if (['hidden', 'auto', 'scroll', 'clip'].includes(estilo.overflow) || ['hidden', 'auto', 'scroll', 'clip'].includes(estilo.overflowX) || ['hidden', 'auto', 'scroll', 'clip'].includes(estilo.overflowY)) {
          const marco = padre.getBoundingClientRect();
          const izquierda = Math.max(caja.left, marco.left);
          const derecha = Math.min(caja.right, marco.right);
          const arriba = Math.max(caja.top, marco.top);
          const abajo = Math.min(caja.bottom, marco.bottom);
          caja = { left: izquierda, right: derecha, top: arriba, bottom: abajo, width: derecha - izquierda, height: abajo - arriba };
          if (caja.width <= 0 || caja.height <= 0) return null;
        }
        padre = padre.parentElement;
      }
      return caja;
    };

    const interactivos = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary')]
      .filter((elemento) => visibles(elemento) && !elemento.closest('[hidden]'));

    // Una vista a pantalla completa (el diagrama BPMN) tapa el shell: lo que
    // queda detrás no se ve ni se toca, así que no se cuenta.
    const anchoVista = document.documentElement.clientWidth;
    const altoVista = document.documentElement.clientHeight;
    const pantallas = [...document.querySelectorAll('body *')].filter((elemento) => {
      if (getComputedStyle(elemento).position !== 'fixed') return false;
      const caja = elemento.getBoundingClientRect();
      return caja.width >= anchoVista * 0.95 && caja.height >= altoVista * 0.95;
    });
    const tapadoPorPantalla = (elemento) => pantallas.some((pantalla) => !pantalla.contains(elemento) && !elemento.contains(pantalla));

    // El tablero infinito se puede alejar: sus tarjetas miden menos de 44 px
    // en pantalla por el zoom (los controles se compensan con --zoom-inv).
    const enTablero = (elemento) => Boolean(elemento.closest('[data-canvas]'));

    const tactiles = interactivos
      .filter((elemento) => !['INPUT', 'TEXTAREA', 'SELECT'].includes(elemento.tagName))
      .filter((elemento) => !enTablero(elemento) || elemento.classList.contains('node-control'))
      .map((elemento) => {
        const caja = elemento.getBoundingClientRect();
        return {
          etiqueta: etiqueta(elemento),
          ancho: Math.round(caja.width * 10) / 10,
          alto: Math.round(caja.height * 10) / 10,
          soloIcono: (elemento.innerText ?? '').trim().length <= 2,
        };
      });

    const cortes = [];
    for (const elemento of document.querySelectorAll('h1, h2, h3, h4, p, span, li, label, td, th, button, a, dd, dt')) {
      if (!visibles(elemento)) continue;
      if (elemento.closest('[hidden]')) continue;
      if (!elemento.textContent?.trim()) continue;
      const caja = elemento.getBoundingClientRect();
      if (caja.width <= 2 || caja.height <= 2) continue; // texto solo para lectores
      const estilo = getComputedStyle(elemento);
      if (estilo.overflow !== 'hidden' && estilo.overflowY !== 'hidden') continue;
      if (estilo.textOverflow === 'ellipsis') continue;
      if (estilo.webkitLineClamp && estilo.webkitLineClamp !== 'none') continue;
      const desbordado = elemento.scrollHeight - elemento.clientHeight > 2;
      if (!desbordado) continue;
      const visible = recorte(elemento);
      if (!visible || visible.height <= 2) continue; // está fuera de vista por scroll
      cortes.push({
        etiqueta: etiqueta(elemento),
        clase: typeof elemento.className === 'string' ? elemento.className : '',
        alto: elemento.clientHeight,
        contenido: elemento.scrollHeight,
      });
    }

    const solapes = [];
    const cajas = interactivos
      .filter((elemento) => !enTablero(elemento) && !tapadoPorPantalla(elemento))
      .map((elemento) => ({ elemento, caja: recorte(elemento) }))
      .filter((item) => item.caja);
    for (let i = 0; i < cajas.length; i += 1) {
      for (let j = i + 1; j < cajas.length; j += 1) {
        const a = cajas[i];
        const b = cajas[j];
        if (a.elemento.contains(b.elemento) || b.elemento.contains(a.elemento)) continue;
        const solapaX = Math.min(a.caja.right, b.caja.right) - Math.max(a.caja.left, b.caja.left);
        const solapaY = Math.min(a.caja.bottom, b.caja.bottom) - Math.max(a.caja.top, b.caja.top);
        if (solapaX > 2 && solapaY > 2) {
          solapes.push(`${etiqueta(a.elemento)} ↔ ${etiqueta(b.elemento)}`);
        }
      }
    }

    const ancho = document.documentElement.clientWidth;
    const fuera = [];
    for (const elemento of interactivos) {
      if (enTablero(elemento) || tapadoPorPantalla(elemento)) continue;
      const caja = recorte(elemento);
      if (!caja) continue;
      if (caja.right > ancho + 1 || caja.left < -1) fuera.push(`${etiqueta(elemento)} (${Math.round(caja.left)}→${Math.round(caja.right)})`);
    }

    // Un control queda «tapado» cuando otra capa se le monta encima y le
    // impide el toque: se comprueba qué elemento está realmente arriba.
    const tapados = [];
    for (const elemento of interactivos) {
      if (enTablero(elemento) || tapadoPorPantalla(elemento)) continue;
      const caja = recorte(elemento);
      if (!caja || caja.width <= 2 || caja.height <= 2) continue;
      const centroX = (caja.left + caja.right) / 2;
      const centroY = (caja.top + caja.bottom) / 2;
      if (centroX < 0 || centroY < 0 || centroX > anchoVista || centroY > altoVista) continue;
      const encima = document.elementFromPoint(centroX, centroY);
      if (!encima) continue;
      if (encima === elemento || elemento.contains(encima) || encima.contains(elemento)) continue;
      tapados.push(`${etiqueta(elemento)} bajo «${etiqueta(encima)}»`);
    }

    return {
      tactiles,
      cortes: cortes.slice(0, 12),
      solapes: solapes.slice(0, 12),
      fuera: fuera.slice(0, 12),
      tapados: tapados.slice(0, 12),
      desbordamiento: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const medida of MEDIDAS) {
  const context = await browser.newContext({
    viewport: { width: medida.ancho, height: medida.alto },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  for (const ruta of RUTAS) {
    const page = await context.newPage();
    const errores = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    page.on('pageerror', (error) => errores.push(String(error.message ?? error)));
    await page.goto(`${base}/${ruta.hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(ruta.nombre === 'diagrama' ? 2200 : 1200);

    const midido = await medir(page);
    const bajos = midido.tactiles.filter((item) => item.alto < 43.5);
    const angostos = midido.tactiles.filter((item) => item.soloIcono && item.ancho < 43.5);
    const problemas = [];
    if (bajos.length) problemas.push(`táctiles bajos: ${bajos.map((i) => `${i.etiqueta} ${i.ancho}×${i.alto}`).join(', ')}`);
    if (angostos.length) problemas.push(`táctiles angostos: ${angostos.map((i) => `${i.etiqueta} ${i.ancho}×${i.alto}`).join(', ')}`);
    if (midido.cortes.length) problemas.push(`textos cortados: ${midido.cortes.map((i) => `${i.etiqueta} (${i.alto}/${i.contenido})`).join(', ')}`);
    if (midido.solapes.length) problemas.push(`solapes: ${midido.solapes.join(', ')}`);
    if (midido.fuera.length) problemas.push(`fuera de pantalla: ${midido.fuera.join(', ')}`);
    if (midido.tapados.length) problemas.push(`tapados: ${midido.tapados.join(', ')}`);
    if (midido.desbordamiento > 1) problemas.push(`desbordamiento horizontal de ${midido.desbordamiento} px`);

    const captura = `docs/fusion/capturas/movil-${ruta.nombre}-${medida.ancho}.png`;
    await page.screenshot({ path: resolve(CARPETA, `movil-${ruta.nombre}-${medida.ancho}.png`), animations: 'disabled', caret: 'hide' }).catch(() => {});

    const ok = problemas.length === 0 && errores.length === 0;
    const detalle = ok
      ? `${midido.tactiles.length} controles ≥ 44 px, sin cortes, solapes ni desbordes`
      : problemas.join(' · ');
    resultados.push({ ruta: ruta.nombre, ancho: medida.ancho, ok, detalle, errores, captura });
    if (!ok) fallos.push(`${ruta.nombre} @ ${medida.ancho}px: ${detalle}${errores.length ? ` | consola: ${errores.join(' | ')}` : ''}`);

    // La hoja del inspector (mapa) se abre al tocar un nodo: se mide aparte.
    if (ruta.nombre === 'mapa') {
      const tarjeta = page.locator('.node-card').first();
      if (await tarjeta.count()) {
        await tarjeta.click({ force: true }).catch(() => {});
        await page.waitForTimeout(700);
        const hoja = await medir(page);
        const bajosHoja = hoja.tactiles.filter((item) => item.alto < 43.5);
        const problemasHoja = [];
        if (bajosHoja.length) problemasHoja.push(`táctiles bajos: ${bajosHoja.map((i) => `${i.etiqueta} ${i.ancho}×${i.alto}`).join(', ')}`);
        if (hoja.cortes.length) problemasHoja.push(`textos cortados: ${hoja.cortes.map((i) => `${i.etiqueta} (${i.alto}/${i.contenido})`).join(', ')}`);
        if (hoja.solapes.length) problemasHoja.push(`solapes: ${hoja.solapes.join(', ')}`);
        if (hoja.fuera.length) problemasHoja.push(`fuera de pantalla: ${hoja.fuera.join(', ')}`);
        if (hoja.tapados.length) problemasHoja.push(`tapados: ${hoja.tapados.join(', ')}`);
        if (hoja.desbordamiento > 1) problemasHoja.push(`desbordamiento horizontal de ${hoja.desbordamiento} px`);
        const capturaHoja = `docs/fusion/capturas/movil-hoja-${medida.ancho}.png`;
        await page.screenshot({ path: resolve(CARPETA, `movil-hoja-${medida.ancho}.png`), animations: 'disabled', caret: 'hide' }).catch(() => {});
        const okHoja = problemasHoja.length === 0;
        const detalleHoja = okHoja
          ? `hoja del inspector: ${hoja.tactiles.length} controles ≥ 44 px, sin cortes ni solapes`
          : problemasHoja.join(' · ');
        resultados.push({ ruta: 'hoja', ancho: medida.ancho, ok: okHoja, detalle: detalleHoja, errores, captura: capturaHoja });
        if (!okHoja) fallos.push(`hoja @ ${medida.ancho}px: ${detalleHoja}`);
      }
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
server.close();

const resumen = {
  fecha: new Date().toISOString(),
  anchos: MEDIDAS.map((item) => item.ancho),
  rutas: RUTAS.map((item) => item.nombre),
  pruebas: resultados.length,
  pasar: resultados.filter((item) => item.ok).length,
  fallar: resultados.filter((item) => !item.ok).length,
  resultados,
};
await writeFile(resolve(RAIZ, 'docs/fusion/MOVIL.json'), `${JSON.stringify(resumen, null, 2)}\n`, 'utf8');

console.log(`\nPulido móvil: ${resumen.pruebas} pruebas (${resumen.rutas.length} rutas × ${MEDIDAS.length} anchos).`);
console.log(`En verde: ${resumen.pasar}. Con fallos: ${resumen.fallar}.`);
for (const item of resultados) {
  console.log(`  ${item.ok ? '✔' : '✖'} ${item.ruta} @ ${item.ancho}px — ${item.detalle}`);
}

if (fallos.length) {
  console.error(`\nFALLAS (${fallos.length}):\n- ${fallos.join('\n- ')}`);
  process.exitCode = 1;
}
