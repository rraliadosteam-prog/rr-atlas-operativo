// Verificación del bloque 1 · Pulido del visor BPMN a 390 px.
//
//   node scripts/verificar-pulido.mjs
//
// Revisa, con Chrome real, los tres arreglos que pidió Rosas para el visor
// BPMN en pantalla de celular (390 px), en los 16 diagramas (10 de ellos se
// revisan también como flujo de usuario):
//
//   a) encuadre  → el diagrama abre con zoom fit al contenido y centrado:
//                  todo el diagrama se ve dentro del lienzo y su centro
//                  coincide con el centro del lienzo.
//   b) pool      → el título vertical del pool no lo tacha ninguna línea del
//                  borde: vive dentro de su banda, sin tocar el borde ni la
//                  línea que separa la banda.
//   c) inicio    → la etiqueta «entra» no se monta sobre el ícono del evento
//                  de inicio.
//
// Salidas: docs/fusion/PULIDO.json y docs/fusion/capturas/pulido-<flujo>-390.png.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

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

const ANCHO = 390;
const ALTO = 844;
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

const rect = (el) => {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return {
    x: Math.round(b.left * 10) / 10,
    y: Math.round(b.top * 10) / 10,
    w: Math.round(b.width * 10) / 10,
    h: Math.round(b.height * 10) / 10,
    right: Math.round(b.right * 10) / 10,
    bottom: Math.round(b.bottom * 10) / 10,
  };
};

const seCruzan = (a, b) => Boolean(a && b)
  && a.x < b.right && a.right > b.x
  && a.y < b.bottom && a.bottom > b.y;

for (const proceso of catalogo.procesos) {
  const context = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errores = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(String(error.message ?? error)));
  await page.goto(`${base}/#/bpmn/${proceso.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-bpmn-canvas] .djs-visual', { timeout: 15000 });
  await page.waitForTimeout(900);

  const medido = await page.evaluate(() => {
    const lienzo = document.querySelector('[data-bpmn-canvas]');
    const caja = lienzo.getBoundingClientRect();
    const cajaRect = {
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
    return {
      lienzo: cajaRect,
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
      zoom: window.__rrAtlasBpmn?.get?.('canvas')?.zoom?.() ?? null,
    };
  });

  // (a) Encadre: todo el diagrama dentro del lienzo y centrado.
  const dentro = medido.contenido.x >= medido.lienzo.x - 1
    && medido.contenido.right <= medido.lienzo.right + 1
    && medido.contenido.y >= medido.lienzo.y - 1
    && medido.contenido.bottom <= medido.lienzo.bottom + 1;
  const centroX = (medido.contenido.x + medido.contenido.right) / 2;
  const centroY = (medido.contenido.y + medido.contenido.bottom) / 2;
  const centroLienzoX = (medido.lienzo.x + medido.lienzo.right) / 2;
  const centroLienzoY = (medido.lienzo.y + medido.lienzo.bottom) / 2;
  const centrado = Math.abs(centroX - centroLienzoX) <= 4 && Math.abs(centroY - centroLienzoY) <= 4;
  const encuadre = dentro && centrado;

  // (b) El título del pool no lo tacha ninguna línea. Las distancias se miden
  // en unidades del diagrama (no en píxeles): a 390 px el diagrama se ve
  // pequeño y un margen de medio píxel no significa nada.
  const escala = medido.bordeAncho ? (medido.borde.right - medido.borde.x) / medido.bordeAncho : 1;
  const margenIzq = medido.titulo && escala ? (medido.titulo.x - medido.borde.x) / escala : 0;
  const margenDer = medido.titulo && medido.linea && escala ? (medido.linea.x - medido.titulo.right) / escala : 0;
  const tituloDentro = Boolean(medido.titulo)
    && medido.titulo.y > medido.borde.y
    && medido.titulo.bottom < medido.borde.bottom;
  // La banda del pool son 30 unidades: el texto vive dentro, sin tocar ni el
  // borde de la piscina ni la línea que separa la banda.
  const bandaOk = margenIzq >= 1.5 && margenDer >= 1.5;
  const poolOk = tituloDentro && bandaOk && medido.tituloVertical;

  // (c) La palabra «entra» no se monta sobre el ícono del evento de inicio.
  const entraOk = Boolean(medido.entra) && Boolean(medido.circulo)
    && !seCruzan(medido.entra, medido.circulo);

  let captura = null;
  if (CON_CAPTURA.has(proceso.id)) {
    const archivo = resolve(CARPETA, `pulido-${proceso.id}-390.png`);
    await page.screenshot({ path: archivo, fullPage: false, animations: 'disabled', caret: 'hide' });
    captura = `docs/fusion/capturas/pulido-${proceso.id}-390.png`;
  }

  const detalle = [
    `escala 1:${escala ? Math.round(1 / escala) : '—'}`,
    `contenido ${Math.round(medido.contenido.w)}×${Math.round(medido.contenido.h)} px`,
    encuadre ? 'encuadrado y centrado' : (dentro ? 'dentro pero descentrado' : 'se sale del lienzo'),
    poolOk ? 'título del pool sin tachón' : 'el título del pool lo cruza una línea',
    entraOk ? '«entra» libre del ícono' : '«entra» sobre el ícono',
  ].join(' · ');

  const ok = encuadre && poolOk && entraOk && !errores.length;
  resultados.push({
    proceso: proceso.id,
    titulo: proceso.titulo,
    ok,
    encuadre,
    centrado,
    poolOk,
    entraOk,
    zoom: medido.zoom,
    detalle,
    errores,
    captura,
  });
  if (!ok) fallos.push(`${proceso.id}: ${detalle}${errores.length ? ` | consola: ${errores.join(' | ')}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${proceso.id} · ${detalle}`);
  await context.close();
}

await browser.close();
server.close();

const resumen = {
  fecha: new Date().toISOString().slice(0, 10),
  ancho: ANCHO,
  diagramas: resultados.length,
  conOk: resultados.filter((r) => r.ok).length,
  fallos,
  resultados,
};
await writeFile(resolve(RAIZ, 'docs/fusion/PULIDO.json'), `${JSON.stringify(resumen, null, 2)}\n`);
console.log(`\n${resumen.conOk}/${resumen.diagramas} diagramas con los tres arreglos bien a ${ANCHO} px.`);
if (fallos.length) {
  console.log(fallos.join('\n'));
  process.exitCode = 1;
}
