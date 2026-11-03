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
// Y, desde el bloque 1B (P1.4 · P1.9 · P1.11), en la ruta del diagrama:
//
//   5. legibilidad → el diagrama abre a un zoom legible (≥ 1,15), leído por
//                     el gancho de depuración.
//   6. banda       → la banda de lectura del paso se ve y dice en qué paso
//                     se está (posición y nombre, no vacíos).
//   7. lienzo      → el lienzo conserva 44 px útiles: la banda no se come el
//                     diagrama.
//   8. apagado     → con la preferencia `modoPaso` apagada (escrita en el
//                     navegador antes de cargar) la banda **no** se ve: el
//                     interruptor para apagar funciona.
//   9. zoom-menos  → el botón «−» (alejar) se ve en la **primera fila** de
//                     la barra, sin deslizar ni abrir el menú «⋯».
//  10. inicio      → el evento de inicio **y su etiqueta** se ven enteros
//                     dentro del lienzo, con 16 px de margen por cada lado.
//  11. entra       → la palabra «entra» se ve **una sola vez** (el marcador
//                     del paso actual no puede proyectar sombra sobre el
//                     texto: dibujaba una segunda «entra» fucsia encima).
//
// Rutas revisadas: mapa, catálogo BPMN, diagrama BPMN y vista de datos.
//
// Salidas: docs/fusion/MOVIL.json y docs/fusion/capturas/movil-<ruta>-<ancho>.png.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { PISO_LEGIBILIDAD_DIAGRAMA } from '../src/core/zoom.mjs';
import { CLAVE_PREFS, VERSION_PREFS } from '../src/core/prefs.mjs';
import { leerEstadoLienzo } from './piso-390.mjs';

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
  // La raíz del mapa se pide con «#top»: es la ruta que miden las demás
  // puertas y la que abre la app (P1.9).
  { nombre: 'mapa', hash: '#top' },
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
      // Bloque 1B: la banda de lectura del paso y la altura útil del
      // lienzo (P1.4 · R4). La banda vive **fuera** del lienzo: no puede
      // tapar el diagrama, pero tampoco puede dejar el lienzo en cero.
      banda: (() => {
        const banda = document.querySelector('[data-bpmn-banda]');
        if (!banda) return { existe: false, visible: false, posicion: '', nombre: '', carril: '', alto: 0 };
        const caja = banda.getBoundingClientRect();
        const estilo = getComputedStyle(banda);
        const visible = !banda.hidden && estilo.display !== 'none' && estilo.visibility !== 'hidden'
          && caja.width > 0 && caja.height > 0;
        return {
          existe: true,
          visible,
          posicion: (document.querySelector('[data-bpmn-banda-posicion]')?.textContent ?? '').trim(),
          nombre: (document.querySelector('[data-bpmn-banda-nombre]')?.textContent ?? '').trim(),
          carril: (document.querySelector('[data-bpmn-banda-carril]')?.textContent ?? '').trim(),
          alto: Math.round(caja.height * 10) / 10,
        };
      })(),
      lienzoAlto: (() => {
        const lienzo = document.querySelector('[data-bpmn-canvas]');
        if (!lienzo) return 0;
        const caja = lienzo.getBoundingClientRect();
        return Math.round(caja.height * 10) / 10;
      })(),
      // El botón «−» (alejar) tiene que verse en la **primera fila** de la
      // barra: dentro de la pantalla y en la misma fila que «Anterior».
      zoomMenos: (() => {
        const menos = document.querySelector('[data-bpmn-accion="alejar"]');
        const anterior = document.querySelector('[data-bpmn-accion="anterior"]');
        if (!menos || !anterior) return { existe: false };
        const a = menos.getBoundingClientRect();
        const b = anterior.getBoundingClientRect();
        const ancho = document.documentElement.clientWidth;
        return {
          existe: true,
          dentro: a.left >= -0.5 && a.right <= ancho + 0.5,
          mismaFila: Math.abs(a.top - b.top) <= 2,
          x: Math.round(a.left),
          derecha: Math.round(a.right),
          y: Math.round(a.top),
          anchoVentana: ancho,
        };
      })(),
      // El evento de inicio y su etiqueta tienen que verse enteros dentro
      // del lienzo, con 16 px de margen por cada lado.
      inicioEnLienzo: (() => {
        const lienzo = document.querySelector('[data-bpmn-canvas]');
        const evento = lienzo?.querySelector('[data-element-id="e_ini"]');
        const etiqueta = lienzo?.querySelector('[data-element-id="e_ini_label"]');
        if (!lienzo || !evento || !etiqueta) return { existe: false };
        const c = lienzo.getBoundingClientRect();
        const a = evento.getBoundingClientRect();
        const b = etiqueta.getBoundingClientRect();
        const caja = {
          left: Math.min(a.left, b.left),
          right: Math.max(a.right, b.right),
          top: Math.min(a.top, b.top),
          bottom: Math.max(a.bottom, b.bottom),
        };
        const margen = 16;
        return {
          existe: true,
          dentro: caja.left >= c.left + margen - 0.5
            && caja.right <= c.right - margen + 0.5
            && caja.top >= c.top + margen - 0.5
            && caja.bottom <= c.bottom - margen + 0.5,
          margenes: {
            izquierda: Math.round(caja.left - c.left),
            derecha: Math.round(c.right - caja.right),
            arriba: Math.round(caja.top - c.top),
            abajo: Math.round(c.bottom - caja.bottom),
          },
          ancho: Math.round(caja.right - caja.left),
        };
      })(),
      // La palabra «entra» se ve **una sola vez**: el marcador del paso
      // actual no puede proyectar sombra sobre el texto (la sombra dibujaba
      // una segunda «entra» fucsia encima de la negra).
      entra: (() => {
        const lienzo = document.querySelector('[data-bpmn-canvas]');
        if (!lienzo) return { existe: false };
        const textos = [...lienzo.querySelectorAll('text')]
          .filter((nodo) => (nodo.textContent || '').trim() === 'entra');
        const visibles = textos.filter((nodo) => {
          const caja = nodo.getBoundingClientRect();
          return caja.width > 0 && caja.height > 0;
        });
        const conSombra = visibles.filter((nodo) => {
          let padre = nodo.parentElement;
          while (padre && padre !== lienzo) {
            const filtro = getComputedStyle(padre).filter;
            if (filtro && filtro !== 'none') return true;
            padre = padre.parentElement;
          }
          return false;
        });
        return { existe: true, total: textos.length, visibles: visibles.length, conSombra: conSombra.length };
      })(),
    };
  });
}

/** El estado del lienzo BPMN, leído por el gancho de depuración. */
const leerEstado = (page) => page.evaluate(leerEstadoLienzo);

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

    // Bloque 1B · la ruta del diagrama comprueba además que el diagrama
    // abre legible, que la banda de lectura dice en qué paso se está y que
    // el lienzo conserva altura útil (P1.4 · P1.9 · R4).
    if (ruta.nombre === 'diagrama') {
      const estado = await leerEstado(page);
      const zoom = estado.zoom;
      const legible = Number.isFinite(zoom) && zoom >= PISO_LEGIBILIDAD_DIAGRAMA;
      resultados.push({
        ruta: 'diagrama-legible',
        ancho: medida.ancho,
        ok: legible,
        detalle: legible
          ? `abre a zoom ${zoom} (piso de legibilidad ${PISO_LEGIBILIDAD_DIAGRAMA})`
          : `abre a zoom ${zoom ?? 'ilegible'} y el piso de legibilidad es ${PISO_LEGIBILIDAD_DIAGRAMA}`,
        errores,
        captura,
      });
      if (!legible) fallos.push(`diagrama-legible @ ${medida.ancho}px: abre a zoom ${zoom ?? 'ilegible'}`);

      const banda = midido.banda;
      const bandaOk = banda.visible && Boolean(banda.posicion) && Boolean(banda.nombre);
      resultados.push({
        ruta: 'diagrama-banda',
        ancho: medida.ancho,
        ok: bandaOk,
        detalle: bandaOk
          ? `la banda dice «${banda.posicion} · ${banda.nombre}»`
          : `la banda no dice en qué paso se está (visible: ${banda.visible}, posición: «${banda.posicion}», nombre: «${banda.nombre}»)`,
        errores,
        captura,
      });
      if (!bandaOk) fallos.push(`diagrama-banda @ ${medida.ancho}px: ${banda.posicion || 'sin posición'} · ${banda.nombre || 'sin nombre'}`);

      const lienzoOk = midido.lienzoAlto >= 44;
      resultados.push({
        ruta: 'diagrama-lienzo',
        ancho: medida.ancho,
        ok: lienzoOk,
        detalle: lienzoOk
          ? `el lienzo conserva ${midido.lienzoAlto} px útiles (la banda, ${banda.alto} px, vive fuera)`
          : `el lienzo solo conserva ${midido.lienzoAlto} px útiles y necesita 44`,
        errores,
        captura,
      });
      if (!lienzoOk) fallos.push(`diagrama-lienzo @ ${medida.ancho}px: ${midido.lienzoAlto} px útiles`);

      // El botón «−» (alejar) en la primera fila de la barra: sin deslizar
      // y sin abrir el menú «⋯».
      const menos = midido.zoomMenos ?? {};
      const menosOk = Boolean(menos.existe) && menos.dentro && menos.mismaFila;
      resultados.push({
        ruta: 'diagrama-zoom-menos',
        ancho: medida.ancho,
        ok: menosOk,
        detalle: menosOk
          ? `el botón «−» se ve en la primera fila de la barra (x ${menos.x}–${menos.derecha} de ${menos.anchoVentana} px, en la misma fila que «Anterior»)`
          : !menos.existe
            ? 'no se encontró el botón «−» ni el «Anterior» en la barra'
            : `el botón «−» no se ve sin deslizar (x ${menos.x}–${menos.derecha} de ${menos.anchoVentana} px${menos.mismaFila ? '' : ' y no está en la misma fila que «Anterior»'})`,
        errores,
        captura,
      });
      if (!menosOk) fallos.push(`diagrama-zoom-menos @ ${medida.ancho}px: el botón «−» no está en la primera fila`);

      // El evento de inicio y su etiqueta, enteros dentro del lienzo.
      const inicio = midido.inicioEnLienzo ?? {};
      const inicioOk = Boolean(inicio.existe) && inicio.dentro;
      resultados.push({
        ruta: 'diagrama-inicio',
        ancho: medida.ancho,
        ok: inicioOk,
        detalle: inicioOk
          ? `el evento de inicio y su etiqueta caben en el lienzo (${inicio.ancho} px de ancho; márgenes ${inicio.margenes.izquierda}/${inicio.margenes.derecha}/${inicio.margenes.arriba}/${inicio.margenes.abajo} px)`
          : !inicio.existe
            ? 'no se encontró el evento de inicio con su etiqueta en el lienzo'
            : `el evento de inicio o su etiqueta se salen del lienzo (márgenes ${inicio.margenes.izquierda}/${inicio.margenes.derecha}/${inicio.margenes.arriba}/${inicio.margenes.abajo} px; se piden 16)`,
        errores,
        captura,
      });
      if (!inicioOk) fallos.push(`diagrama-inicio @ ${medida.ancho}px: el evento de inicio con su etiqueta no cabe en el lienzo`);

      // La palabra «entra», una sola vez y sin sombra encima.
      const entra = midido.entra ?? {};
      const entraOk = Boolean(entra.existe) && entra.visibles === 1 && entra.conSombra === 0;
      resultados.push({
        ruta: 'diagrama-entra',
        ancho: medida.ancho,
        ok: entraOk,
        detalle: entraOk
          ? `la palabra «entra» aparece una sola vez (${entra.visibles}) y sin sombra encima`
          : !entra.existe
            ? 'no se encontró la palabra «entra» en el lienzo'
            : `la palabra «entra» sale ${entra.visibles} veces${entra.conSombra ? ' y con una sombra encima' : ''}`,
        errores,
        captura,
      });
      if (!entraOk) fallos.push(`diagrama-entra @ ${medida.ancho}px: la palabra «entra» sale ${entra.visibles} veces`);
    }

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

// ── El interruptor para apagar (P1.11) ─────────────────────────────────────
//
// Con la preferencia `modoPaso` apagada (escrita en el navegador **antes**
// de cargar la página), la banda de lectura no se ve: es el interruptor
// para apagar, y la puerta lo comprueba de verdad.
{
  const medida = MEDIDAS[0];
  const contexto = await browser.newContext({
    viewport: { width: medida.ancho, height: medida.alto },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await contexto.addInitScript(({ clave, valor }) => {
    try {
      window.localStorage.setItem(clave, valor);
    } catch {
      /* sin almacenamiento no se puede apagar nada: la puerta lo dirá */
    }
  }, {
    clave: CLAVE_PREFS,
    valor: JSON.stringify({
      version: VERSION_PREFS,
      modoPaso: false,
      legibilidad: true,
      copiador: true,
      guiaVista: true,
      avisosVistos: [],
    }),
  });
  const page = await contexto.newPage();
  const errores = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(String(error.message ?? error)));
  await page.goto(`${base}/#/bpmn/gobierno_como_se_gobierna_la_documentacion`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-bpmn-canvas] .djs-visual', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const midido = await medir(page);
  const estado = await leerEstado(page);
  const banda = midido.banda;
  // El diagrama tiene que haberse abierto (si no, la banda no se ve por otra
  // razón y la comprobación no valdría nada).
  const abierto = Number.isFinite(estado.zoom) && estado.zoom >= PISO_LEGIBILIDAD_DIAGRAMA;
  const ok = abierto && !banda.visible && errores.length === 0;
  const detalle = ok
    ? `con «modo paso» apagado la banda de lectura no se ve y el diagrama sigue legible (zoom ${estado.zoom}; la preferencia está en ${CLAVE_PREFS})`
    : !abierto
      ? `el diagrama no se abrió bien (zoom ${estado.zoom ?? 'ilegible'}): la comprobación no vale`
      : `con «modo paso» apagado la banda ${banda.visible ? 'se sigue viendo' : 'no se ve pero hay errores'}`;
  resultados.push({ ruta: 'diagrama-sin-banda', ancho: medida.ancho, ok, detalle, errores, captura: null });
  if (!ok) fallos.push(`diagrama-sin-banda @ ${medida.ancho}px: ${detalle}`);
  await contexto.close();
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
