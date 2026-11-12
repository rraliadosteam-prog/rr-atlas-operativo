// Auditoría UX/UI de la fusión Atlas RR.
// Recorre el shell de B y la vista BPMN en 1440, 768 y 360 px, mide el layout,
// hace los cuatro recorridos (ver, navegar, editar, exportar) y guarda capturas.
//
//   node scripts/auditoria-ux-fusion.mjs
//
// Salidas:
//   docs/fusion/capturas/auditoria/*.png   capturas por viewport y recorrido
//   docs/fusion/AUDITORIA_UX.json          mediciones crudas (el .md lo escribe el agente)

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(RAIZ, 'dist');
const CARPETA = resolve(RAIZ, 'docs/fusion/capturas/auditoria');
const PUERTO = 4210;

const tipos = {
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.bpmn': 'application/xml', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

const VIEWPORTS = [
  { nombre: 'escritorio-1440', width: 1440, height: 900, movil: false },
  { nombre: 'tableta-768', width: 768, height: 1024, movil: false },
  { nombre: 'movil-360', width: 360, height: 740, movil: true },
];

const PROCESO = 'ventas_como_una_oportunidad_se_convierte_en_cliente';

// ---------- servidor estático ----------
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

// ---------- utilidades dentro de la página ----------
const SONDA_LAYOUT = () => {
  const doc = document.documentElement;
  const nombre = (el) => {
    if (!el) return '?';
    const etiqueta = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const clase = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const dato = [...el.attributes].find((a) => a.name.startsWith('data-'));
    return `${etiqueta}${id}${clase}${dato ? `[${dato.name}="${dato.value}"]` : ''}`;
  };
  const fuera = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.position === 'fixed') continue;
    if (r.right > doc.clientWidth + 1 || r.left < -1) {
      fuera.push({ elemento: nombre(el), left: Math.round(r.left), right: Math.round(r.right), ancho: Math.round(r.width) });
    }
  }
  const objetivos = [];
  // El lienzo del mapa aplica zoom con transform: los tamaños se normalizan.
  const canvas = document.querySelector('[data-canvas]');
  let escala = 1;
  if (canvas) {
    const matriz = getComputedStyle(canvas).transform;
    if (matriz && matriz !== 'none') {
      const a = Number((matriz.match(/matrix\(([^)]+)\)/) || [])[1]?.split(',')[0]);
      if (Number.isFinite(a) && a > 0) escala = a;
    }
  }
  const interactivos = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]');
  for (const el of interactivos) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    if (r.bottom < 0 || r.top > innerHeight * 4) continue;
    const dentro = canvas && canvas.contains(el);
    const w = dentro ? r.width / escala : r.width;
    const h = dentro ? r.height / escala : r.height;
    if (h < 32 || w < 24) {
      objetivos.push({ elemento: nombre(el), w: Math.round(w), h: Math.round(h), zoom: dentro ? Number(escala.toFixed(2)) : null, texto: (el.textContent || '').trim().slice(0, 28) });
    }
  }
  // Contraste: solo elementos con texto propio visible.
  const luminancia = (rgb) => {
    const canal = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * canal[0] + 0.7152 * canal[1] + 0.0722 * canal[2];
  };
  const aRgb = (color) => {
    const partes = (color.match(/[\d.]+/g) || []).map(Number);
    if (!partes.length) return null;
    // color(srgb 0.89 0.80 0.88) viene en 0..1; rgb() viene en 0..255.
    if (/^color\(/i.test(color)) return partes.slice(0, 3).map((v) => v * 255);
    return partes.slice(0, 3);
  };
  const fondoDe = (el) => {
    let actual = el;
    while (actual) {
      const c = getComputedStyle(actual).backgroundColor;
      const partes = aRgb(c);
      const alfa = (c.match(/[\d.]+/g) || [])[3];
      if (partes.length === 3 && (alfa === undefined || Number(alfa) > 0.85)) return partes;
      actual = actual.parentElement;
    }
    return [7, 0, 1];
  };
  const contraste = [];
  for (const el of document.querySelectorAll('body *')) {
    const texto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!texto) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.4) continue;
    const fg = aRgb(st.color);
    const bg = fondoDe(el);
    if (!fg || fg.length < 3) continue;
    const l1 = luminancia(fg);
    const l2 = luminancia(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const grande = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && Number(st.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (ratio < minimo) {
      contraste.push({
        elemento: nombre(el),
        texto: (el.textContent || '').trim().slice(0, 34),
        ratio: Number(ratio.toFixed(2)),
        minimo,
        color: st.color,
        fondo: `rgb(${bg.join(', ')})`,
        tamano: st.fontSize,
      });
    }
  }
  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    overflowHorizontal: doc.scrollWidth - doc.clientWidth > 1,
    desborde: fuera.slice(0, 12),
    objetivosChicos: objetivos.slice(0, 14),
    contraste: contraste.slice(0, 14),
    alto: document.documentElement.scrollHeight,
  };
};

const medirCaja = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  return {
    ancho: Math.round(r.width),
    alto: Math.round(r.height),
    visible: r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none',
    overflow: st.overflow,
    display: st.display,
  };
};

const navegador = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const reporte = { generadoEn: new Date().toISOString(), viewports: [] };
const base = `http://127.0.0.1:${PUERTO}/`;

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: { width: vp.width, height: vp.height },
    acceptDownloads: true,
    hasTouch: vp.movil,
    isMobile: vp.movil,
    deviceScaleFactor: 1,
  });
  const page = await contexto.newPage();
  const consola = [];
  page.on('pageerror', (e) => consola.push({ tipo: 'pageerror', texto: String(e).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error') consola.push({ tipo: 'console', texto: m.text().slice(0, 300) }); });
  page.on('requestfailed', (r) => consola.push({ tipo: 'red', texto: `${r.url().slice(0, 140)} — ${r.failure()?.errorText}` }));

  const datos = { viewport: vp, pasos: [] };
  const captura = async (nombre) => {
    const ruta = resolve(CARPETA, `${vp.nombre}-${nombre}.png`);
    await page.screenshot({ path: ruta });
    return `docs/fusion/capturas/auditoria/${vp.nombre}-${nombre}.png`;
  };
  const paso = async (nombre, fn) => {
    const registro = { nombre, ok: true };
    try {
      Object.assign(registro, (await fn()) ?? {});
    } catch (error) {
      registro.ok = false;
      registro.error = String(error?.message ?? error).slice(0, 300);
    }
    datos.pasos.push(registro);
    return registro;
  };

  // ---------- 1. Mapa vivo ----------
  await paso('mapa-vivo', async () => {
    await page.goto(`${base}#top`, { waitUntil: 'load' });
    await page.waitForSelector('.node-card', { timeout: 15000 });
    await page.waitForTimeout(600);
    const layout = await page.evaluate(SONDA_LAYOUT);
    const cajas = await page.evaluate(() => ({
      topbar: (() => { const e = document.querySelector('.topbar'); const r = e.getBoundingClientRect(); return { alto: Math.round(r.height) }; })(),
      rail: (() => { const e = document.querySelector('.rail'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), visible: r.width > 0 }; })(),
      busqueda: (() => { const e = document.querySelector('.searchbar'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), visible: r.width > 0 }; })(),
      botonBpmn: (() => { const e = document.querySelector('[data-bpmn-link]'); const r = e.getBoundingClientRect(); return { visible: r.width > 0, ancho: Math.round(r.width) }; })(),
      botonHub: (() => { const e = document.querySelector('[data-hub-link]'); const r = e.getBoundingClientRect(); return { visible: r.width > 0 }; })(),
      nodo: (() => { const e = document.querySelector('.node-card'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height) }; })(),
      minimapa: (() => { const e = document.querySelector('[data-minimap]'); return { visible: e && !e.hidden }; })(),
      tabbar: (() => { const e = document.querySelector('.tabbar, [data-tabbar]'); return { visible: Boolean(e) }; })(),
    }));
    return { layout, cajas, captura: await captura('01-mapa-vivo') };
  });

  // ---------- 2. Navegar: buscar + seleccionar nodo ----------
  await paso('navegar', async () => {
    const antes = await page.textContent('[data-node-count]');
    await page.fill('[data-search-input]', 'ventas');
    await page.waitForTimeout(500);
    const despues = await page.textContent('[data-node-count]');
    await page.fill('[data-search-input]', '');
    await page.waitForTimeout(400);
    await page.click('.node-card', { position: { x: 20, y: 8 } });
    await page.waitForTimeout(400);
    const inspector = await page.evaluate(() => {
      const e = document.querySelector('[data-inspector]');
      return { visible: e && !e.hidden, titulo: document.querySelector('[data-inspector-title]')?.textContent?.trim() };
    });
    const migas = await page.textContent('[data-breadcrumbs]').catch(() => '');
    return {
      busqueda: { antes: Number(antes), despues: Number(despues), filtra: Number(despues) !== Number(antes) },
      inspector,
      migas: migas?.trim().slice(0, 60),
      captura: await captura('02-navegar-inspector'),
    };
  });

  // ---------- 3. Catálogo BPMN ----------
  await paso('bpmn-catalogo', async () => {
    await page.goto(`${base}#/bpmn`, { waitUntil: 'load' });
    await page.waitForSelector('.bpmn-card', { timeout: 20000 });
    await page.waitForTimeout(500);
    const layout = await page.evaluate(SONDA_LAYOUT);
    const cajas = await page.evaluate(() => ({
      vista: (() => { const e = document.querySelector('[data-bpmn-view]'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height) }; })(),
      catalogo: (() => { const e = document.querySelector('.bpmn-catalog'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width) }; })(),
      area: (() => { const e = document.querySelector('.bpmn-area'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width) }; })(),
      tarjeta: (() => { const e = document.querySelector('.bpmn-card'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height) }; })(),
      toolbarVisible: (() => { const e = document.querySelector('.bpmn-toolbar'); const r = e.getBoundingClientRect(); return { visible: r.width > 0, alto: Math.round(r.height) }; })(),
    }));
    const areas = await page.evaluate(() => [...document.querySelectorAll('.bpmn-area__title span:first-child')].map((e) => e.textContent.trim()));
    const tarjetas = await page.evaluate(() => document.querySelectorAll('.bpmn-card').length);
    return { layout, cajas, areas, tarjetas, captura: await captura('03-bpmn-catalogo') };
  });

  // ---------- 4. Proceso BPMN: ver ----------
  await paso('bpmn-ver', async () => {
    await page.click(`[data-bpmn-open="${PROCESO}"]`);
    await page.waitForSelector('.bpmn-canvas .djs-container svg', { timeout: 25000 });
    await page.waitForTimeout(1500);
    const estado = await page.evaluate(() => ({
      hash: location.hash,
      formas: document.querySelectorAll('.bpmn-canvas .djs-visual').length,
      carriles: document.querySelectorAll('.bpmn-canvas g[data-element-id^="lane_"]').length,
      titulo: document.querySelector('[data-bpmn-title]')?.textContent?.trim(),
      informe: document.querySelector('[data-bpmn-report]')?.textContent?.trim().slice(0, 120),
      lienzo: (() => { const e = document.querySelector('.bpmn-canvas'); const r = e.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height) }; })(),
      // Bloque 1B (P1.9): el zoom legible que dice el gancho de depuración y
      // la banda de lectura del paso (si se ve y qué dice).
      zoom: (() => {
        const estadoLienzo = window.__rrAtlasBpmn?.estado?.();
        const zoom = estadoLienzo && typeof estadoLienzo === 'object' ? estadoLienzo.zoom : null;
        return Number.isFinite(zoom) ? zoom : null;
      })(),
      modo: window.__rrAtlasBpmn?.estado?.()?.modo ?? null,
      banda: (() => {
        const banda = document.querySelector('[data-bpmn-banda]');
        if (!banda) return { existe: false, visible: false, posicion: '', nombre: '', carril: '' };
        const caja = banda.getBoundingClientRect();
        const estilo = getComputedStyle(banda);
        return {
          existe: true,
          visible: !banda.hidden && estilo.display !== 'none' && estilo.visibility !== 'hidden' && caja.width > 0 && caja.height > 0,
          posicion: (document.querySelector('[data-bpmn-banda-posicion]')?.textContent ?? '').trim(),
          nombre: (document.querySelector('[data-bpmn-banda-nombre]')?.textContent ?? '').trim(),
          carril: (document.querySelector('[data-bpmn-banda-carril]')?.textContent ?? '').trim(),
          alto: Math.round(caja.height),
        };
      })(),
    }));
    // clic en un elemento -> inspector
    // Las semillas usan ids tipo t_*, e_*, g_*, part_*, lane_* (no Activity_).
    const forma = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.bpmn-canvas .djs-element')]
        .find((item) => item.querySelector('.djs-hit') && !item.dataset.elementId.startsWith('lane_') && !item.dataset.elementId.startsWith('part_'));
      const hit = el?.querySelector('.djs-hit');
      const r = hit?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, id: el.dataset.elementId } : null;
    });
    if (forma) await page.mouse.click(forma.x, forma.y);
    await page.waitForTimeout(500);
    const inspector = await page.evaluate(() => {
      const e = document.querySelector('[data-bpmn-inspector]');
      return { visible: e && !e.hidden, titulo: document.querySelector('[data-bpmn-element-title]')?.textContent?.trim(), meta: document.querySelector('[data-bpmn-element-meta]')?.textContent?.trim() };
    });
    // recorrido: Siguiente
    const antes = await page.textContent('[data-bpmn-status]');
    await page.click('[data-bpmn-accion="siguiente"]');
    await page.waitForTimeout(700);
    const despues = await page.textContent('[data-bpmn-status]');
    return {
      estado,
      inspector,
      recorrido: { antes: antes.trim(), despues: despues.trim(), avanza: antes !== despues },
      layout: await page.evaluate(SONDA_LAYOUT),
      captura: await captura('04-bpmn-proceso-ver'),
    };
  });

  // ---------- 5. Editar ----------
  await paso('bpmn-editar', async () => {
    await page.click('[data-bpmn-accion="modo"]');
    await page.waitForTimeout(1800);
    const modo = await page.evaluate(() => ({
      etiqueta: document.querySelector('[data-bpmn-accion="modo"]')?.textContent?.trim(),
      paleta: Boolean(document.querySelector('.bpmn-canvas .djs-palette')),
      contextPad: Boolean(document.querySelector('.bpmn-canvas .djs-context-pad')),
      editable: document.querySelector('.bpmn-canvas .djs-container')?.classList?.contains('djs-editable') ?? false,
    }));
    // Edición directa de una etiqueta: doble clic sobre la etiqueta del diagrama.
    let edicionDirecta = { disponible: false };
    const etiqueta = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.bpmn-canvas .djs-element')]
        .find((item) => item.querySelector('.djs-label') && !item.dataset.elementId.startsWith('lane_') && !item.dataset.elementId.startsWith('part_') && !item.dataset.elementId.endsWith('_label'));
      const l = el?.querySelector('.djs-label');
      const r = l?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, texto: l.textContent.trim(), id: el.dataset.elementId } : null;
    });
    if (etiqueta) {
      await page.mouse.dblclick(etiqueta.x, etiqueta.y).catch(() => {});
      await page.waitForTimeout(800);
      const abierto = await page.$('.djs-direct-editing-content');
      if (abierto) {
        edicionDirecta = { disponible: true, textoOriginal: etiqueta.texto };
        await page.keyboard.press('End');
        await page.keyboard.type(' (editada)', { delay: 15 }).catch(() => {});
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        edicionDirecta.textoFinal = await page.evaluate(() => {
          const e = [...document.querySelectorAll('.bpmn-canvas .djs-label')].find((x) => x.textContent.includes('editada'));
          return e?.textContent?.trim() ?? null;
        });
        edicionDirecta.cambioAplicado = Boolean(edicionDirecta.textoFinal);
      }
    }
    return { modo, edicionDirecta, captura: await captura('05-bpmn-editar') };
  });

  // ---------- 6. Exportar ----------
  await paso('exportar', async () => {
    const descargas = [];
    const contexto2 = page.context();
    page.on('download', async (d) => {
      try {
        const ruta = await d.path();
        const { size } = await (await import('node:fs/promises')).stat(ruta);
        descargas.push({ archivo: d.suggestedFilename(), bytes: size });
      } catch (error) {
        descargas.push({ archivo: d.suggestedFilename(), error: String(error.message) });
      }
    });
    for (const accion of ['bpmn', 'svg', 'png']) {
      // Item 7 · en celular los controles de exportación viven en el menú «⋯».
      await page.evaluate(() => {
        const menu = document.querySelector('[data-bpmn-menu-mas]');
        if (menu) menu.open = true;
      });
      await page.waitForTimeout(200);
      await page.click(`[data-bpmn-accion="${accion}"]`).catch(() => {});
      await page.waitForTimeout(1200);
    }
    // exportar JSON del mapa
    await page.goto(`${base}#top`, { waitUntil: 'load' });
    await page.waitForSelector('.node-card', { timeout: 15000 });
    await page.click('[data-action="export"]').catch(() => {});
    await page.waitForTimeout(1200);
    const toast = await page.evaluate(() => {
      const e = document.querySelector('[data-toast]');
      return { visible: e && !e.hidden, texto: e?.textContent?.trim().slice(0, 90) };
    });
    return { descargas, toast, captura: await captura('06-exportar') };
  });

  // ---------- 7. Volver al mapa desde BPMN ----------
  await paso('volver-al-mapa', async () => {
    await page.goto(`${base}#/bpmn/${PROCESO}`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await page.click('[data-bpmn-back]');
    await page.waitForTimeout(900);
    const estado = await page.evaluate(() => ({
      hash: location.hash,
      bpmnOculto: document.querySelector('[data-bpmn-view]')?.hidden,
      shellVisible: !document.querySelector('.shell')?.hidden,
      scrollHorizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    return { estado, captura: await captura('07-volver-al-mapa') };
  });

  datos.consola = consola;
  reporte.viewports.push(datos);
  await contexto.close();
}

await navegador.close();
server.close();

await writeFile(resolve(RAIZ, 'docs/fusion/AUDITORIA_UX.json'), `${JSON.stringify(reporte, null, 2)}\n`);
console.log(JSON.stringify(reporte, null, 2));
