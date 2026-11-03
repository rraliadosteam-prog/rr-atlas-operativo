// Verificación del bloque 1 · Pulido del visor BPMN a 390 px.
//
//   node scripts/verificar-pulido.mjs [ancho]
//
// Revisa, con Chrome real, los arreglos del visor BPMN en pantalla de
// celular (390 px por defecto; también 768 y 1440), en los 16 diagramas:
//
//   a) legibilidad → el diagrama abre a un zoom legible: el gancho de
//                    depuración se lee y el zoom tiene que estar en el piso
//                    declarado (1,15). Si el gancho existe y no se pudo
//                    leer el zoom, o el zoom está por debajo del piso, la
//                    puerta **falla**. Si el gancho no existe (todavía no
//                    se ha escrito) se dice (`modo: 'sin-gancho'`) y la
//                    puerta no falla por eso… salvo que **ningún** diagrama
//                    lo tenga: en el bloque 1B el gancho tiene que existir.
//   a2) escritorio → en un lienzo **ancho** (> 900 px) el diagrama entero
//                    cabe con margen: el piso de 1,15 **no** aplica y el
//                    diagrama tiene que abrir en modo «todo» («ver el
//                    todo»), con el diagrama entero dentro del lienzo.
//   b) encuadre    → a escala legible el diagrama entero **no cabe** (el
//                    motor no oculta lo que no es el paso actual), así que
//                    la aserción «encuadre y centrado» sería falsa por
//                    construcción. En modo paso se comprueba que **el paso
//                    actual está dentro del lienzo**; en modo «ver el todo»
//                    (el motor encuadra el diagrama entero) se comprueba
//                    que se ve dentro del lienzo y centrado.
//   c) pool        → el título vertical del pool no lo tacha ninguna línea
//                    del borde: vive dentro de su banda.
//   d) inicio      → la etiqueta «entra» no se monta sobre el ícono del
//                    evento de inicio.
//   e) seguro      → con `?atlas=seguro` (el apagado de emergencia) el
//                    diagrama **sigue legible** (zoom ≥ 1,15 en lienzo
//                    angosto, porque la válvula no toca la bandera
//                    `legibilidad`) y la banda de lectura no aparece.
//   f) dividir     → solo hay **un** botón «Dividir» visible (el de la
//                    cabecera): dos veces el mismo control confundía.
//
// Salidas: docs/fusion/PULIDO.json (o PULIDO-<ancho>.json) y
// docs/fusion/capturas/pulido-<flujo>-<ancho>.png.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { ANCHO_ESTRECHO_PX, PISO_LEGIBILIDAD_DIAGRAMA } from '../src/core/zoom.mjs';
import { evaluarAncho, evaluarConjunto390, evaluarPiso390, leerEstadoLienzo } from './piso-390.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas');
const PUERTO = 4233;

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

const ANCHO = Number(process.argv[2] || 390);
const ALTO = ANCHO === 1440 ? 900 : ANCHO === 768 ? 1024 : 844;
// El piso de legibilidad (1,15) solo aplica en lienzo angosto: en un lienzo
// ancho el diagrama entero cabe y el escritorio abre en «ver el todo».
const LECTURA_ESTRECHA = ANCHO <= ANCHO_ESTRECHO_PX;
const base = `http://127.0.0.1:${PUERTO}`;

// Los flujos con captura: tres diagramas, uno de ellos «Gobierno documental».
const CON_CAPTURA = new Set([
  'gobierno_como_se_gobierna_la_documentacion',
  'ventas_como_una_oportunidad_se_convierte_en_cliente',
  'finanzas_como_entra_y_se_sale_la_plata',
]);

const catalogo = JSON.parse(await readFile(resolve(DIST, 'src/bpmn/seeds/index.json'), 'utf8'));
const resultados = [];
const fallos = [];

// ── Lo que se mide dentro de la página ─────────────────────────────────────
//
// Un solo volcado por diagrama: la caja del lienzo, la de todo lo que se ve
// del diagrama, el pool con su título vertical, el evento de inicio con la
// palabra «entra» y la banda de lectura.
const MEDIR = () => {
  const lienzo = document.querySelector('[data-bpmn-canvas]');
  const caja = lienzo.getBoundingClientRect();
  const cajaLienzo = {
    x: caja.left, y: caja.top, w: caja.width, h: caja.height,
    right: caja.right, bottom: caja.bottom,
  };
  // Todo lo que se ve del diagrama.
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const visual of lienzo.querySelectorAll('.djs-visual')) {
    const b = visual.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
    maxX = Math.max(maxX, b.right); maxY = Math.max(maxY, b.bottom);
  }
  const contenido = {
    x: minX, y: minY, w: maxX - minX, h: maxY - minY, right: maxX, bottom: maxY,
  };
  // El pool y su título vertical.
  const pool = lienzo.querySelector('[data-element-id="part_1"]');
  const titulo = pool?.querySelector('text.rr-banda-vertical') ?? null;
  const borde = pool?.querySelector('rect') ?? null;
  const linea = pool?.querySelector('path') ?? null;
  // El evento de inicio y la palabra «entra».
  const inicio = lienzo.querySelector('[data-element-id="e_ini"]');
  const circulo = inicio?.querySelector('circle') ?? null;
  const entra = [...lienzo.querySelectorAll('.rr-sem-word')]
    .find((t) => (t.textContent || '').trim() === 'entra') ?? null;
  const a = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
  };
  // La banda de lectura del paso (P1.4): vive fuera del lienzo.
  const banda = document.querySelector('[data-bpmn-banda]');
  const bandaCaja = banda ? banda.getBoundingClientRect() : null;
  // Los botones «Dividir» que se ven: solo puede haber uno (el de la
  // cabecera). El de la barra se quitó por duplicado.
  const dividir = [...document.querySelectorAll('button, a[href]')]
    .filter((elemento) => {
      const caja = elemento.getBoundingClientRect();
      if (caja.width < 1 || caja.height < 1) return false;
      const estilo = getComputedStyle(elemento);
      if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
      return (elemento.innerText ?? '').trim().toLowerCase().includes('dividir');
    })
    .map((elemento) => (elemento.innerText ?? '').trim().replace(/\s+/g, ' '));
  return {
    lienzo: cajaLienzo,
    contenido,
    pool: a(pool),
    titulo: a(titulo),
    tituloTexto: titulo?.textContent?.trim() ?? '',
    tituloVertical: Boolean(titulo?.getAttribute('transform')),
    borde: a(borde),
    bordeAncho: Number(borde?.getAttribute('width') || 0),
    linea: a(linea),
    inicio: a(inicio),
    circulo: a(circulo),
    entra: a(entra),
    dividir,
    banda: {
      existe: Boolean(banda),
      visible: Boolean(banda) && !banda.hidden && Boolean(bandaCaja && bandaCaja.width > 0 && bandaCaja.height > 0),
      posicion: document.querySelector('[data-bpmn-banda-posicion]')?.textContent?.trim() ?? '',
      nombre: document.querySelector('[data-bpmn-banda-nombre]')?.textContent?.trim() ?? '',
      carril: document.querySelector('[data-bpmn-banda-carril]')?.textContent?.trim() ?? '',
      alto: bandaCaja ? Math.round(bandaCaja.height * 10) / 10 : 0,
    },
  };
};

// La caja del paso actual (el elemento que el motor dice que es el paso).
const MEDIR_PASO = (idElemento) => {
  const lienzo = document.querySelector('[data-bpmn-canvas]');
  if (!idElemento || !lienzo) return null;
  const elemento = lienzo.querySelector(`[data-element-id="${idElemento}"]`);
  if (!elemento) return null;
  const b = elemento.getBoundingClientRect();
  return { x: b.left, y: b.top, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
};

// ── Veredictos ─────────────────────────────────────────────────────────────

const seCruzan = (a, b) => Boolean(a && b)
  && a.x < b.right && a.right > b.x
  && a.y < b.bottom && a.bottom > b.y;

/**
 * El diagrama entero se ve dentro del lienzo y centrado.
 * Es el veredicto clásico: solo vale cuando el diagrama cabe (por debajo
 * del piso de legibilidad, o cuando se fuerza el encuadre).
 */
function veredictoEncuadre(medido) {
  const dentro = medido.contenido.x >= medido.lienzo.x - 1
    && medido.contenido.right <= medido.lienzo.right + 1
    && medido.contenido.y >= medido.lienzo.y - 1
    && medido.contenido.bottom <= medido.lienzo.bottom + 1;
  const centroX = (medido.contenido.x + medido.contenido.right) / 2;
  const centroY = (medido.contenido.y + medido.contenido.bottom) / 2;
  const centroLienzoX = (medido.lienzo.x + medido.lienzo.right) / 2;
  const centroLienzoY = (medido.lienzo.y + medido.lienzo.bottom) / 2;
  // Tolerancia proporcional: el motor centra la caja completa del diagrama
  // (formas + rótulos) y la comprobación mira las formas; el margenAdmisible
  // es de 4 px o el 2 % del lienzo, lo que sea mayor.
  const margenAdmisible = Math.max(4, medido.lienzo.h * 0.02);
  const centrado = Math.abs(centroX - centroLienzoX) <= margenAdmisible
    && Math.abs(centroY - centroLienzoY) <= margenAdmisible;
  return {
    ok: dentro && centrado,
    veredicto: 'encuadre y centrado',
    detalle: dentro
      ? (centrado ? 'el diagrama entero se ve dentro del lienzo y centrado' : 'dentro del lienzo pero descentrado')
      : 'el diagrama se sale del lienzo',
  };
}

/**
 * El veredicto de encuadre del diagrama **con el que abre**: a escala
 * legible el diagrama entero no cabe (el motor no oculta lo que no es el
 * paso actual), así que lo que se comprueba es que **el paso actual está
 * dentro del lienzo** (P1.9). En modo «ver el todo» el paso actual es el
 * primero: el motor se deja ahí para empezar a leer.
 */
function veredictoPaso(medido, cajaPaso) {
  if (!cajaPaso) {
    return {
      ok: false,
      veredicto: 'el paso actual está dentro del lienzo',
      detalle: 'no se encuentra el elemento del paso actual en el lienzo',
    };
  }
  const dentro = cajaPaso.x >= medido.lienzo.x - 1
    && cajaPaso.right <= medido.lienzo.right + 1
    && cajaPaso.y >= medido.lienzo.y - 1
    && cajaPaso.bottom <= medido.lienzo.bottom + 1;
  if (dentro) {
    return {
      ok: true,
      veredicto: 'el paso actual está dentro del lienzo',
      detalle: `el paso actual (${Math.round(cajaPaso.w)}×${Math.round(cajaPaso.h)} px) está dentro del lienzo`,
    };
  }
  // Si el paso es más grande que el lienzo, el motor lo marca como
  // «paso-ajustado»: entonces lo que se comprueba es que su centro está
  // dentro (que es lo que el motor garantiza) y que se ve.
  const centroX = (cajaPaso.x + cajaPaso.right) / 2;
  const centroY = (cajaPaso.y + cajaPaso.bottom) / 2;
  const centroDentro = centroX >= medido.lienzo.x && centroX <= medido.lienzo.right
    && centroY >= medido.lienzo.y && centroY <= medido.lienzo.bottom;
  return {
    ok: centroDentro,
    veredicto: 'el paso actual está dentro del lienzo',
    detalle: centroDentro
      ? 'el paso actual es más grande que el lienzo: su centro está dentro (modo «paso-ajustado»)'
      : 'el paso actual se sale del lienzo',
  };
}

/**
 * El título del pool no lo tacha ninguna línea. Las distancias se miden
 * en unidades del diagrama (no en píxeles): a 390 px el diagrama se ve
 * pequeño y un margen de medio píxel no significa nada.
 */
function veredictoPool(medido) {
  const escala = medido.bordeAncho ? (medido.borde.right - medido.borde.x) / medido.bordeAncho : 1;
  const margenIzq = medido.titulo && escala ? (medido.titulo.x - medido.borde.x) / escala : 0;
  const margenDer = medido.titulo && medido.linea && escala ? (medido.linea.x - medido.titulo.right) / escala : 0;
  const tituloDentro = Boolean(medido.titulo)
    && medido.titulo.y > medido.borde.y
    && medido.titulo.bottom < medido.borde.bottom;
  // La banda del pool son 30 unidades: el texto vive dentro, sin tocar ni el
  // borde de la piscina ni la línea que separa la banda.
  const bandaOk = margenIzq >= 1.5 && margenDer >= 1.5;
  const ok = tituloDentro && bandaOk && medido.tituloVertical;
  return {
    ok,
    detalle: ok ? 'título del pool sin tachón' : 'el título del pool lo cruza una línea',
  };
}

/** La palabra «entra» no se monta sobre el ícono del evento de inicio. */
function veredictoEntra(medido) {
  const ok = Boolean(medido.entra) && Boolean(medido.circulo) && !seCruzan(medido.entra, medido.circulo);
  return { ok, detalle: ok ? '«entra» libre del ícono' : '«entra» sobre el ícono' };
}

// ── Recorrido ──────────────────────────────────────────────────────────────

for (const proceso of catalogo.procesos) {
  const errores = [];
  const contexto = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO },
    deviceScaleFactor: 2,
    isMobile: ANCHO < 900,
    hasTouch: ANCHO < 900,
  });
  const page = await contexto.newPage();
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(String(error.message ?? error)));

  // ── A · Apertura: lo que ve quien abre el diagrama ─────────────────────
  await page.goto(`${base}/#/bpmn/${proceso.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-bpmn-canvas] .djs-visual', { timeout: 15000 });
  await page.waitForTimeout(900);

  const medido = await page.evaluate(MEDIR);
  const estado = await page.evaluate(leerEstadoLienzo);
  // En lienzo angosto se exige el zoom legible (1,15); en lienzo ancho el
  // diagrama entero cabe y lo que se exige es el modo «todo».
  const apertura = LECTURA_ESTRECHA
    ? evaluarPiso390({ ...estado, procesoEsperado: proceso.id })
    : evaluarAncho({ ...estado, procesoEsperado: proceso.id });
  const cajaPaso = await page.evaluate(MEDIR_PASO, estado.paso?.idElemento || '');

  // El veredicto de encuadre del diagrama **con el que abre**: a escala
  // legible el diagrama entero no cabe (el motor no oculta lo que no es el
  // paso actual), así que lo que se comprueba es que **el paso que muestra
  // la vista está dentro del lienzo**: en modo paso, el paso actual; en modo
  // «ver el todo», el primero (el motor se deja ahí para empezar a leer).
  // El veredicto clásico («encuadre y centrado») vive en la forma «ver el
  // todo» de más abajo.
  // En lienzo ancho el diagrama abre en «ver el todo»: entonces sí se
  // comprueba el encuadre completo (el diagrama entero dentro del lienzo).
  const encuadre = LECTURA_ESTRECHA
    ? veredictoPaso(medido, cajaPaso)
    : veredictoEncuadre(medido);

  let captura = null;
  if (CON_CAPTURA.has(proceso.id)) {
    const archivo = resolve(CARPETA, `pulido-${proceso.id}-${ANCHO}.png`);
    await page.screenshot({ path: archivo, fullPage: false, animations: 'disabled', caret: 'hide' });
    captura = `docs/fusion/capturas/pulido-${proceso.id}-${ANCHO}.png`;
  }

  // ── B · «Ver el todo»: el motor encuadra el diagrama entero ────────────
  // Se le pide al motor su propio encuadre (sin el piso de legibilidad, que
  // es lo que impide que el diagrama entero quepa en un celular). Es la
  // forma en la que el veredicto «encuadre y centrado» sigue teniendo
  // sentido: a escala legible el diagrama entero no cabe y la aserción
  // sería falsa por construcción.
  const forzado = await page.evaluate(async () => {
    const gancho = window.__rrAtlasBpmn;
    if (!gancho?.workspace?.fit) return { ok: false, detalle: 'el gancho no expone el motor' };
    try {
      gancho.workspace.fit({ modo: 'todo', forzar: true });
      await new Promise((r) => setTimeout(r, 500));
      return { ok: true, detalle: 'el motor encuadró el diagrama entero' };
    } catch (error) {
      return { ok: false, detalle: `el motor no pudo encuadrar: ${String(error?.message ?? error).split('\n')[0]}` };
    }
  });
  const medidoTodo = forzado.ok ? await page.evaluate(MEDIR) : medido;
  const encuadreTodo = forzado.ok
    ? veredictoEncuadre(medidoTodo)
    : { ok: false, veredicto: 'encuadre y centrado', detalle: forzado.detalle };
  const estadoTodo = forzado.ok ? await page.evaluate(leerEstadoLienzo) : estado;

  await contexto.close();

  // ── C · Apagado de emergencia (`?atlas=seguro`) ─────────────────────────
  const contextoSeguro = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO },
    deviceScaleFactor: 2,
    isMobile: ANCHO < 900,
    hasTouch: ANCHO < 900,
  });
  const pageSeguro = await contextoSeguro.newPage();
  pageSeguro.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  pageSeguro.on('pageerror', (error) => errores.push(String(error.message ?? error)));
  await pageSeguro.goto(`${base}/?atlas=seguro#/bpmn/${proceso.id}`, { waitUntil: 'domcontentloaded' });
  await pageSeguro.waitForSelector('[data-bpmn-canvas] .djs-visual', { timeout: 15000 });
  await pageSeguro.waitForTimeout(900);
  const medidoSeguro = await pageSeguro.evaluate(MEDIR);
  const estadoSeguro = await pageSeguro.evaluate(leerEstadoLienzo);
  // En lienzo angosto el diagrama tiene que seguir legible; en lienzo
  // ancho tiene que seguir en «ver el todo» (con el diagrama entero).
  const aperturaSegura = LECTURA_ESTRECHA
    ? evaluarPiso390({ ...estadoSeguro, procesoEsperado: proceso.id })
    : evaluarAncho({ ...estadoSeguro, procesoEsperado: proceso.id });
  const encuadreSeguro = LECTURA_ESTRECHA
    ? { ok: true, detalle: 'en lienzo angosto no se comprueba el encuadre completo' }
    : veredictoEncuadre(medidoSeguro);
  // El apagado de emergencia apaga el modo paso: la banda no se ve. Y no
  // toca `legibilidad`: el diagrama sigue legible.
  const bandaSegura = !medidoSeguro.banda.visible;
  const seguro = {
    ok: aperturaSegura.ok && bandaSegura && encuadreSeguro.ok,
    modo: estadoSeguro.modo,
    zoom: aperturaSegura.zoom,
    bandaVisible: medidoSeguro.banda.visible,
    detalle: `${aperturaSegura.mensaje} · ${encuadreSeguro.detalle} · ${bandaSegura ? 'la banda de lectura está apagada' : 'la banda de lectura sigue visible'}`,
  };
  await contextoSeguro.close();

  const pool = veredictoPool(medido);
  const entra = veredictoEntra(medido);
  const banda = medido.banda;
  const escala = medido.bordeAncho && medido.borde
    ? (medido.borde.right - medido.borde.x) / medido.bordeAncho
    : 1;

  // Un solo botón «Dividir» visible: el de la cabecera. En la barra estaba
  // duplicado y no se sabía cuál era el bueno. En celular el de la cabecera
  // es solo un ícono (el texto no cabe): entonces el que se ve con la
  // palabra «Dividir» es ninguno, pero nunca puede haber dos.
  const dividir = medido.dividir ?? [];
  const dividirOk = LECTURA_ESTRECHA ? dividir.length <= 1 : dividir.length === 1;

  const detalle = [
    `escala 1:${escala ? Math.round(1 / escala) : '—'}`,
    `contenido ${Math.round(medido.contenido.w)}×${Math.round(medido.contenido.h)} px`,
    encuadre.detalle,
    encuadreTodo.detalle,
    pool.detalle,
    entra.detalle,
    `apertura: ${apertura.mensaje}`,
    `seguro: ${seguro.detalle}`,
    dividirOk
      ? 'un solo botón «Dividir»'
      : `botones «Dividir» visibles: ${dividir.length} (${dividir.join(' · ') || 'ninguno'})`,
  ].join(' · ');

  const ok = apertura.ok && encuadre.ok && encuadreTodo.ok && pool.ok && entra.ok
    && seguro.ok && dividirOk && !errores.length;

  resultados.push({
    proceso: proceso.id,
    titulo: proceso.titulo,
    ok,
    // El modo y el zoom con los que abre el diagrama (P1.9: se escriben
    // por diagrama en el JSON de la puerta).
    modo: estado.modo,
    zoom: apertura.zoom,
    // En lienzo angosto el veredicto es el del piso (1,15); en lienzo
    // ancho, el del modo «todo».
    legibilidad: LECTURA_ESTRECHA ? apertura : null,
    apertura,
    encuadre,
    verTodo: {
      ok: encuadreTodo.ok,
      modo: estadoTodo.modo,
      zoom: estadoTodo.zoom,
      veredicto: encuadreTodo.veredicto,
      detalle: encuadreTodo.detalle,
    },
    seguro,
    banda,
    poolOk: pool.ok,
    entraOk: entra.ok,
    dividir: { ok: dividirOk, botones: dividir },
    detalle,
    errores,
    captura,
  });
  if (!ok) fallos.push(`${proceso.id}: ${detalle}${errores.length ? ` | consola: ${errores.join(' | ')}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${proceso.id} · ${detalle}`);
}

// El gancho tiene que existir: si ningún diagrama lo tiene, la puerta falla
// (aunque el veredicto de cada diagrama no falle por él).
const conjunto = evaluarConjunto390(resultados.map((item) => item.apertura));
if (!conjunto.ok) fallos.push(conjunto.mensaje);

await browser.close();
server.close();

const resumen = {
  fecha: new Date().toISOString().slice(0, 10),
  ancho: ANCHO,
  diagramas: resultados.length,
  conOk: resultados.filter((r) => r.ok).length,
  pisoLegibilidad: PISO_LEGIBILIDAD_DIAGRAMA,
  // En lienzo angosto el piso de 1,15 manda; en lienzo ancho, no.
  lecturaEstrecha: LECTURA_ESTRECHA,
  modos: [...new Set(resultados.map((r) => r.modo))],
  botonesDividir: [...new Set(resultados.flatMap((r) => r.dividir?.botones ?? []))],
  gancho: conjunto,
  fallos,
  resultados,
};
const SALIDA = ANCHO === 390 ? 'docs/fusion/PULIDO.json' : `docs/fusion/PULIDO-${ANCHO}.json`;
await writeFile(resolve(RAIZ, SALIDA), `${JSON.stringify(resumen, null, 2)}\n`);
console.log(`\n${resumen.conOk}/${resumen.diagramas} diagramas con los arreglos bien a ${ANCHO} px.`);
console.log(conjunto.mensaje);
if (fallos.length) {
  console.log(fallos.join('\n'));
  process.exitCode = 1;
}
