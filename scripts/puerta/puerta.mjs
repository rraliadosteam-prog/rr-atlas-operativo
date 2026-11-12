#!/usr/bin/env node
// Puerta de verificación del Atlas: corre ANTES de cada entrega.
// Cuatro puntos con semáforo y captura: estructura, flujo, Drive y base de datos.
// Salida: puerta-salida/<fecha>/reporte.html (+ capturas/ y resultado.json).
// Uso: npm run puerta   ·   ver docs/PUERTA.md
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  AMARILLO, ROJO, VERDE, clasificarTsc, colorDatos, colorDrive, colorEstructura, colorFlujo, peor,
} from './semaforo.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(RAIZ, 'dist');
const sello = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(/[: ]/g, '-').slice(0, 16);
const SALIDA = resolve(process.env.PUERTA_SALIDA ?? join(RAIZ, 'puerta-salida', sello));
const CAPTURAS = join(SALIDA, 'capturas');
const MAX_BOTONES = Number(process.env.PUERTA_MAX_BOTONES ?? 14);
const TS_VERSION = process.env.PUERTA_TS_VERSION ?? '5.9.3';
const NO_BLOQUEAR = process.argv.includes('--no-bloquear');

const MEDIDAS = [
  { nombre: 'celular', ancho: 390, alto: 844, tactil: true },
  { nombre: 'tableta', ancho: 768, alto: 1024, tactil: true },
  { nombre: 'escritorio', ancho: 1440, alto: 900, tactil: false },
];
const RUTAS = [
  { nombre: 'Mapa', hash: '#top' },
  { nombre: 'Procesos', hash: '#/bpmn' },
  { nombre: 'Un proceso', hash: '#/bpmn/gobierno_como_se_gobierna_la_documentacion' },
  { nombre: 'Datos', hash: '#/datos' },
];

const log = (...a) => console.log('[puerta]', ...a);
const correr = (cmd, args, opciones = {}) => {
  const r = spawnSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opciones });
  return { ok: r.status === 0, codigo: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

async function archivos(dir, filtro, fuera = []) {
  const lista = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (fuera.some((f) => ruta.includes(f))) continue;
    if (e.isDirectory()) lista.push(...await archivos(ruta, filtro, fuera));
    else if (filtro(ruta)) lista.push(ruta);
  }
  return lista;
}

// ───────────── a. Estructura ─────────────
async function puntoEstructura() {
  log('a. estructura: build, pruebas, sintaxis y tipos');
  const build = correr('npm', ['run', 'build']);
  const pruebas = correr('npm', ['test']);
  const pasan = Number((pruebas.salida.match(/ℹ pass (\d+)/) ?? [])[1] ?? 0);
  const fallan = Number((pruebas.salida.match(/ℹ fail (\d+)/) ?? [])[1] ?? 0);
  const modulos = await archivos(join(RAIZ, 'src'), (r) => r.endsWith('.mjs'));
  const scripts = await archivos(join(RAIZ, 'scripts'), (r) => r.endsWith('.mjs'));
  const malos = [...modulos, ...scripts].filter((f) => !correr('node', ['--check', f]).ok).map((f) => relative(RAIZ, f));
  const sintaxis = { ok: malos.length === 0, malos };
  const fuentes = modulos.filter((f) => !f.endsWith('.test.mjs')).map((f) => relative(RAIZ, f));
  const t = correr('npx', ['-y', '-p', `typescript@${TS_VERSION}`, 'tsc', '--noEmit', '--allowJs', '--checkJs',
    '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--skipLibCheck',
    '--lib', 'es2023,dom,dom.iterable', ...fuentes]);
  const corrio = t.ok || /error TS\d+/.test(t.salida);
  const { graves, avisos } = clasificarTsc(t.salida);
  const tsc = { corrio, graves, avisos, version: TS_VERSION };
  const color = colorEstructura({ build, pruebas, sintaxis, tsc });
  const filas = [
    ['La app se construye', build.ok ? 'sí' : 'NO', build.ok ? VERDE : ROJO],
    ['Pruebas automáticas', `${pasan} pasan · ${fallan} fallan`, pruebas.ok ? VERDE : ROJO],
    ['Archivos sin errores de escritura', malos.length ? `${malos.length} con error` : `los ${modulos.length + scripts.length}`, sintaxis.ok ? VERDE : ROJO],
    ['Revisión de tipos (tsc)', !corrio ? 'no se pudo correr' : `${graves.length} fallos reales · ${avisos.length} avisos menores`, !corrio ? AMARILLO : graves.length ? ROJO : VERDE],
  ];
  return {
    id: 'estructura', titulo: 'Estructura', pregunta: '¿La app está sana por dentro?', color, filas,
    resumen: color === VERDE ? 'Se construye, todas las pruebas pasan y no hay fallos reales de código.'
      : color === AMARILLO ? 'Se construye y las pruebas pasan, pero no se pudo revisar todo.'
        : 'Hay algo roto por dentro: ver la tabla.',
    nota: avisos.length ? `Los ${avisos.length} avisos menores son anotaciones de tipos que el código JavaScript no declara (por ejemplo «hidden» en un elemento); no rompen la app. Se cuentan para vigilar que no crezcan.` : '',
    detalle: { pasan, fallan, sintaxis: malos, graves: graves.map((g) => `${g.archivo}:${g.fila} ${g.codigo} ${g.texto}`), avisos: avisos.length,
      buildSalida: build.ok ? '' : build.salida.slice(-2000), pruebasSalida: pruebas.ok ? '' : pruebas.salida.slice(-3000) },
  };
}

// ───────────── servidor local del build ─────────────
const TIPOS = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bpmn': 'application/xml', '.wasm': 'application/wasm', '.webp': 'image/webp' };
async function servir() {
  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const ruta = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const archivo = resolve(DIST, `.${ruta}`);
    if (!archivo.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    try {
      const cuerpo = await readFile(archivo);
      res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end('no encontrado'); }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return { servidor, base: `http://127.0.0.1:${servidor.address().port}` };
}

// En la página: lista estable de cosas que se pueden pulsar y visibles.
function listarPulsables(max) {
  const sel = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, select';
  const vistos = new Set();
  const lista = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden], [aria-hidden="true"], [inert]')) continue;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    const caja = el.getBoundingClientRect();
    if (caja.width < 2 || caja.height < 2) continue;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    // Si está dentro de la pantalla pero otra capa lo tapa (p. ej. un visor a pantalla
    // completa), la persona no lo ve: no se cuenta como botón de esa pantalla.
    const cx = caja.left + caja.width / 2;
    const cy = caja.top + caja.height / 2;
    if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
      const arriba = document.elementFromPoint(cx, cy);
      if (arriba && arriba !== el && !el.contains(arriba) && !arriba.contains(el)) continue;
    }
    const texto = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!texto) continue;
    const clave = `${el.tagName}|${texto}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    el.setAttribute('data-puerta-i', String(lista.length));
    const actual = el.getAttribute('aria-current') && el.getAttribute('aria-current') !== 'false';
    lista.push({ i: lista.length, texto, etiqueta: el.tagName.toLowerCase(), href: el.getAttribute('href') || '', actual });
    if (lista.length >= max) break;
  }
  return lista;
}
const firma = () => `${location.href}|${scrollX},${scrollY}|${document.body.innerHTML.length}|${[...document.body.innerHTML].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)}|${document.querySelectorAll('dialog[open]').length}`;

async function prepararContexto(browser, medida, registro) {
  const contexto = await browser.newContext({
    viewport: { width: medida.ancho, height: medida.alto }, hasTouch: medida.tactil, isMobile: medida.ancho < 500, deviceScaleFactor: 1,
  });
  await contexto.route('**/*', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) registro.escrituras.push(`${req.method()} ${url.host}${url.pathname}`);
    if (url.hostname !== '127.0.0.1') { registro.externas.add(url.host); return route.abort(); }
    return route.continue();
  });
  return contexto;
}

async function abrir(contexto, base, ruta) {
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e.message ?? e).slice(0, 200)));
  await pagina.goto(`${base}/${ruta.hash}`, { waitUntil: 'load' });
  await pagina.waitForTimeout(900);
  return { pagina, errores };
}

// ───────────── b. Flujo ─────────────
async function puntoFlujo(browser, base, registro) {
  log('b. flujo: clics reales a 390, 768 y 1440 px');
  const clics = [];
  const capturas = [];
  for (const medida of MEDIDAS) {
    for (const ruta of RUTAS) {
      const ctxLista = await prepararContexto(browser, medida, registro);
      const { pagina, errores: erroresCarga } = await abrir(ctxLista, base, ruta);
      const lista = await pagina.evaluate(listarPulsables, MAX_BOTONES);
      await ctxLista.close();
      const resultados = [];
      for (const boton of lista) {
        const ctx = await prepararContexto(browser, medida, registro);
        const { pagina: p, errores } = await abrir(ctx, base, ruta);
        let estado = 'funciona';
        let motivo = '';
        try {
          const actual = await p.evaluate(listarPulsables, MAX_BOTONES);
          const igual = actual.find((b) => b.texto === boton.texto && b.etiqueta === boton.etiqueta);
          if (!igual) throw new Error('no aparece al volver a abrir la pantalla');
          const antes = await p.evaluate(firma);
          const paginas = ctx.pages().length;
          let pidioArchivo = false;
          p.once('filechooser', () => { pidioArchivo = true; });
          const loc = p.locator(`[data-puerta-i="${igual.i}"]`);
          if (medida.tactil) await loc.tap({ timeout: 2500 }); else await loc.click({ timeout: 2500 });
          await p.waitForTimeout(700);
          const despues = await p.evaluate(firma).catch(() => 'navegó');
          // Llevar el foco a un campo (p. ej. «Buscar») también es una respuesta.
          const foco = await p.evaluate((i) => {
            const a = document.activeElement;
            const el = document.querySelector(`[data-puerta-i="${i}"]`);
            return Boolean(a && a !== document.body && a !== el && !(el && el.contains(a)) && a.matches('input, textarea, select, [contenteditable], [role="searchbox"], [role="dialog"], dialog'));
          }, igual.i).catch(() => false);
          const abrioOtra = ctx.pages().length > paginas;
          const externo = boton.href && /^https?:/.test(boton.href) && !boton.href.includes('127.0.0.1');
          if (errores.length) { estado = 'falla'; motivo = `error de la app: ${errores[0]}`; }
          else if (antes === despues && !abrioOtra && !externo && !foco && !pidioArchivo) {
            if (boton.actual) motivo = 'ya estás en esa pantalla';
            else { estado = 'sin-respuesta'; motivo = 'al pulsarlo no cambia nada visible'; }
          } else if (externo) motivo = 'abre un enlace externo';
          else if (pidioArchivo) motivo = 'abre el selector de archivos';
          else if (foco && antes === despues) motivo = 'lleva al campo de escritura';
        } catch (e) {
          estado = 'falla';
          const m = String(e.message ?? e);
          motivo = /intercepts pointer events/.test(m) ? 'otra cosa lo tapa y no se deja pulsar'
            : /outside of the viewport/.test(m) ? 'queda fuera de la pantalla'
              : /Timeout/.test(m) ? 'no se deja pulsar (tiempo agotado)' : m.split('\n')[0].slice(0, 120);
        }
        const r = { medida: medida.ancho, pantalla: ruta.nombre, boton: boton.texto, estado, motivo, errorApp: errores[0] ?? '' };
        resultados.push(r);
        clics.push(r);
        await ctx.close();
      }
      // Captura marcada: verde funciona, rojo falla, ámbar sin respuesta.
      const ctxFoto = await prepararContexto(browser, medida, registro);
      const { pagina: foto } = await abrir(ctxFoto, base, ruta);
      await foto.evaluate(listarPulsables, MAX_BOTONES);
      await foto.evaluate((res) => {
        const colores = { funciona: '#16a34a', falla: '#dc2626', 'sin-respuesta': '#f59e0b' };
        res.forEach((r, i) => {
          const el = document.querySelector(`[data-puerta-i="${i}"]`);
          if (!el) return;
          el.style.outline = `3px solid ${colores[r.estado]}`;
          el.style.outlineOffset = '2px';
        });
      }, resultados);
      const nombre = `flujo-${medida.ancho}-${ruta.nombre.toLowerCase().replace(/\s+/g, '-')}.png`;
      await foto.screenshot({ path: join(CAPTURAS, nombre) });
      capturas.push({ archivo: `capturas/${nombre}`, pie: `${ruta.nombre} a ${medida.ancho} px (${medida.nombre})${erroresCarga.length ? ' · error al abrir' : ''}` });
      if (erroresCarga.length) clics.push({ medida: medida.ancho, pantalla: ruta.nombre, boton: '(abrir la pantalla)', estado: 'falla', motivo: `error al abrir: ${erroresCarga[0]}`, errorApp: erroresCarga[0] });
      await ctxFoto.close();
    }
  }
  const color = colorFlujo(clics);
  const n = (e) => clics.filter((c) => c.estado === e).length;
  return {
    id: 'flujo', titulo: 'Flujo', pregunta: '¿Los botones hacen lo que deben en celular, tableta y computador?', color,
    filas: [
      ['Botones probados (con clic o toque real)', String(clics.length), VERDE],
      ['Funcionan', String(n('funciona')), VERDE],
      ['Fallan', String(n('falla')), n('falla') ? ROJO : VERDE],
      ['Sin respuesta visible', String(n('sin-respuesta')), n('sin-respuesta') ? AMARILLO : VERDE],
    ],
    resumen: color === VERDE ? 'Todos los botones probados responden en los tres tamaños.'
      : color === AMARILLO ? 'La app funciona, pero algunos botones no responden o no se dejan pulsar.'
        : 'Hay botones que rompen la app o demasiados que fallan.',
    nota: `Se prueban hasta ${MAX_BOTONES} botones distintos por pantalla, cada uno en una ventana nueva. Los enlaces externos (Drive, YouTube…) no se abren de verdad: se comprueba que el botón responde. En las capturas: verde = funciona, rojo = falla, ámbar = sin respuesta.`,
    clics, capturas,
  };
}

// ───────────── c. Drive ─────────────
async function puntoDrive(browser, base, registro) {
  log('c. sincronización con Drive');
  const fuentes = await archivos(join(RAIZ, 'src'), (r) => r.endsWith('.mjs') && !r.endsWith('.test.mjs'), ['bpmn-bundle']);
  const patron = /googleapis\.com\/drive|drive\/v3|gapi\.client\.drive|files\.list\(|changes\.(list|watch)\(|drive\.files\./;
  const sincroniza = [];
  const lecturas = new Set();
  for (const f of fuentes) {
    const texto = await readFile(f, 'utf8');
    if (patron.test(texto)) sincroniza.push(relative(RAIZ, f));
    for (const m of texto.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)) lecturas.add(m[1].replace(/\$\{[^}]+\}/g, '…'));
  }
  const ganchoMedir = join(RAIZ, 'scripts', 'puerta', 'drive-medir.mjs');
  const hayGancho = await stat(ganchoMedir).then(() => true, () => false);
  const implementada = sincroniza.length > 0;
  let medida = false;
  let segundos = null;
  let motivoMedida = '';
  if (implementada && hayGancho && process.env.PUERTA_DRIVE_CARPETA_PRUEBAS) {
    try {
      const { medir } = await import(ganchoMedir);
      segundos = await medir({ base, carpeta: process.env.PUERTA_DRIVE_CARPETA_PRUEBAS });
      medida = true;
    } catch (e) { motivoMedida = `la medición falló: ${String(e.message ?? e).slice(0, 160)}`; }
  } else if (implementada) motivoMedida = 'falta la carpeta de pruebas de Drive o sus credenciales en esta máquina';
  const color = colorDrive({ implementada, medida, segundos });
  // Captura: la vista Datos, que es donde se vería lo que llega de Drive.
  const ctx = await prepararContexto(browser, MEDIDAS[2], registro);
  const { pagina } = await abrir(ctx, base, RUTAS[3]);
  await pagina.screenshot({ path: join(CAPTURAS, 'drive-datos-1440.png') });
  await ctx.close();
  return {
    id: 'drive', titulo: 'Sincronización con Drive', pregunta: '¿Un cambio en Drive aparece solo en el Atlas, y cuánto tarda?', color,
    filas: [
      ['El Atlas lee Drive por su cuenta', implementada ? `sí (${sincroniza.join(', ')})` : 'NO', implementada ? VERDE : ROJO],
      ['De dónde saca hoy los datos', [...lecturas].join(' · ') || '—', implementada ? VERDE : AMARILLO],
      ['Tiempo medido con el archivo de prueba', medida ? `${segundos} s` : `sin medir${motivoMedida ? ` (${motivoMedida})` : ''}`, medida ? VERDE : implementada ? AMARILLO : ROJO],
    ],
    resumen: !implementada
      ? 'Hoy el Atlas NO se sincroniza con Drive: muestra los datos que están guardados en el repositorio cuando se publica. Un cambio en Drive no aparece hasta que alguien actualice esos datos y vuelva a publicar.'
      : medida ? `Un cambio en Drive tardó ${segundos} s en verse en el Atlas.` : 'La sincronización existe pero no se pudo medir en esta corrida.',
    nota: 'La medición usa SOLO un archivo de prueba propio y marcado («PUERTA-prueba-no-editar») dentro de una carpeta de pruebas; nunca documentos reales del equipo. Ver docs/PUERTA.md.',
    capturas: [{ archivo: 'capturas/drive-datos-1440.png', pie: 'Vista «Datos» a 1440 px: datos leídos del repositorio, no de Drive' }],
  };
}

// ───────────── d. Base de datos ─────────────
async function puntoDatos(browser, base, registro) {
  log('d. base de datos: quién escribe y qué');
  const fuentes = await archivos(join(RAIZ, 'src'), (r) => r.endsWith('.mjs') && !r.endsWith('.test.mjs'), ['bpmn-bundle']);
  const remotas = [];
  const locales = new Set();
  const patronRemoto = /createClient\(|supabase\.from|\.from\(['"][a-z_]+['"]\)\.(insert|upsert|update|delete)|\.rpc\(|method:\s*['"](POST|PUT|PATCH|DELETE)|sendBeacon\(|new XMLHttpRequest|new WebSocket\(/;
  for (const f of fuentes) {
    const lineas = (await readFile(f, 'utf8')).split('\n');
    lineas.forEach((l, i) => {
      if (patronRemoto.test(l)) remotas.push(`${relative(RAIZ, f)}:${i + 1}`);
      if (/localStorage\.setItem|storage\.setItem|\.setItem\(/.test(l) && !/__rr_atlas_probe__|sonda/.test(l)) locales.add(relative(RAIZ, f));
    });
  }
  const migraciones = await readdir(join(RAIZ, 'supabase', 'migrations')).catch(() => []);
  // Prueba viva: abrir y usar la app no debe mandar escrituras a ningún servidor (las del punto b ya quedaron registradas).
  const ctx = await prepararContexto(browser, MEDIDAS[2], registro);
  const { pagina } = await abrir(ctx, base, RUTAS[0]);
  const claves = await pagina.evaluate(() => Object.keys(localStorage));
  await pagina.screenshot({ path: join(CAPTURAS, 'datos-mapa-1440.png') });
  await ctx.close();
  const guardadoLocal = [...locales];
  const color = colorDatos({ escriturasRemotas: remotas, peticionesEscritura: registro.escrituras, guardadoLocal });
  return {
    id: 'datos', titulo: 'Base de datos', pregunta: '¿La base solo recibe lo que viene de Drive?', color,
    filas: [
      ['Código que escribe en una base o servidor', remotas.length ? remotas.join(', ') : 'ninguno', remotas.length ? ROJO : VERDE],
      ['Escrituras enviadas mientras se usó la app', registro.escrituras.length ? [...new Set(registro.escrituras)].slice(0, 6).join(', ') : `ninguna (en todos los clics del punto b)`, registro.escrituras.length ? ROJO : VERDE],
      ['Base conectada', migraciones.length ? `no; hay ${migraciones.length} borrador(es) de tablas sin aplicar (${migraciones.join(', ')})` : 'no', VERDE],
      ['Datos guardados fuera de Drive (en el navegador de cada persona)', guardadoLocal.length ? `sí: ${guardadoLocal.length} partes de la app guardan cambios o preferencias` : 'no', guardadoLocal.length ? AMARILLO : VERDE],
    ],
    resumen: color === VERDE ? 'La base no recibe nada que no venga de Drive.'
      : color === AMARILLO ? 'Ninguna base ni servidor recibe escrituras. Ojo: algunas pantallas guardan cambios y preferencias solo en el navegador de quien las usa; eso no ensucia la base, pero esos cambios no vienen de Drive.'
        : 'Hay escrituras que no vienen de Drive: ver la tabla.',
    nota: `Claves que la app deja en el navegador al abrir: ${claves.join(', ') || 'ninguna'}. Archivos que guardan en el navegador: ${guardadoLocal.join(', ') || 'ninguno'}.`,
    capturas: [{ archivo: 'capturas/datos-mapa-1440.png', pie: 'El mapa a 1440 px abierto sin ninguna escritura a servidores' }],
  };
}

// ───────────── reporte ─────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLOR = { verde: '#16a34a', amarillo: '#f59e0b', rojo: '#dc2626' };
const NOMBRE = { verde: 'VERDE', amarillo: 'AMARILLO', rojo: 'ROJO' };
const punto = (c) => `<span class="luz" style="background:${COLOR[c]}"></span>`;

function tarjeta(p) {
  return `<section class="tarjeta" id="${p.id}">
  <header>${punto(p.color)}<div><h2>${esc(p.titulo)} · <span style="color:${COLOR[p.color]}">${NOMBRE[p.color]}</span></h2><p class="preg">${esc(p.pregunta)}</p></div></header>
  <p class="resumen">${esc(p.resumen)}</p>
  <table>${p.filas.map(([a, b, c]) => `<tr><td>${punto(c)}</td><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
  ${p.nota ? `<p class="nota">${esc(p.nota)}</p>` : ''}
  ${p.clics ? tablaClics(p.clics) : ''}
  <div class="galeria">${(p.capturas ?? []).map((c) => `<figure><a href="${esc(c.archivo)}"><img src="${esc(c.archivo)}" loading="lazy" alt="${esc(c.pie)}"></a><figcaption>${esc(c.pie)}</figcaption></figure>`).join('')}</div>
</section>`;
}
function tablaClics(clics) {
  const malos = clics.filter((c) => c.estado !== 'funciona');
  const buenos = clics.filter((c) => c.estado === 'funciona');
  const fila = (c) => `<tr><td>${c.medida} px</td><td>${esc(c.pantalla)}</td><td>${esc(c.boton)}</td><td>${esc(c.motivo || '')}</td></tr>`;
  return `<details open><summary>Botones que fallan o no responden (${malos.length})</summary><table class="clics"><tr><th>Ancho</th><th>Pantalla</th><th>Botón</th><th>Qué pasa</th></tr>${malos.map(fila).join('') || '<tr><td colspan="4">ninguno</td></tr>'}</table></details>
<details><summary>Botones que funcionan (${buenos.length})</summary><table class="clics"><tr><th>Ancho</th><th>Pantalla</th><th>Botón</th><th>Nota</th></tr>${buenos.map(fila).join('')}</table></details>`;
}
function html(puntos, meta) {
  const total = peor(...puntos.map((p) => p.color));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Puerta del Atlas · ${esc(meta.fecha)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f5f5f4;color:#1c1917}
main{max-width:1100px;margin:0 auto;padding:24px}
h1{margin:0 0 4px}.sub{color:#57534e;margin:0 0 20px}
.semaforos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px}
.semaforos a{display:flex;gap:12px;align-items:center;background:#fff;border-radius:12px;padding:14px 16px;text-decoration:none;color:inherit;box-shadow:0 1px 3px #0002}
.semaforos b{display:block}.luz{display:inline-block;width:22px;height:22px;border-radius:50%;flex:none;box-shadow:inset 0 -2px 4px #0003}
.tarjeta{background:#fff;border-radius:14px;padding:20px;margin-bottom:22px;box-shadow:0 1px 3px #0002}
.tarjeta header{display:flex;gap:14px;align-items:center}.tarjeta header .luz{width:34px;height:34px}
h2{margin:0;font-size:1.3rem}.preg{margin:2px 0 0;color:#57534e}.resumen{font-size:1.08rem;line-height:1.5}
table{border-collapse:collapse;width:100%;margin:8px 0}td,th{padding:7px 8px;border-bottom:1px solid #e7e5e4;text-align:left;vertical-align:top;font-size:.95rem}
td:first-child{width:28px}.clics td:first-child{width:auto}.nota{color:#57534e;font-size:.92rem;background:#fafaf9;padding:10px;border-radius:8px}
.galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px}
figure{margin:0}img{width:100%;border:1px solid #e7e5e4;border-radius:8px;max-height:420px;object-fit:cover;object-position:top}figcaption{font-size:.85rem;color:#57534e}
summary{cursor:pointer;font-weight:600;margin-top:10px}.total{display:inline-flex;gap:8px;align-items:center;font-weight:700}
</style></head><body><main>
<h1>Puerta de verificación del Atlas</h1>
<p class="sub">Rama <b>${esc(meta.rama)}</b> · versión <b>${esc(meta.sha)}</b> · ${esc(meta.fecha)} (hora de Bogotá) · Resultado general: <span class="total">${punto(total)} ${NOMBRE[total]}</span></p>
<div class="semaforos">${puntos.map((p) => `<a href="#${p.id}">${punto(p.color)}<span><b>${esc(p.titulo)}</b>${NOMBRE[p.color]}</span></a>`).join('')}</div>
${puntos.map(tarjeta).join('\n')}
<p class="sub">Verde = listo · Amarillo = funciona con reparos · Rojo = no cumple. Esta puerta se corre antes de cada entrega con <b>npm run puerta</b>; los criterios están en docs/PUERTA.md.</p>
</main></body></html>`;
}

async function capturaTarjeta(browser, puntos) {
  // Una captura de cada tarjeta (el resumen visual del punto) para quien no abra el HTML.
  const contexto = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  const pagina = await contexto.newPage();
  await pagina.goto(`file://${join(SALIDA, 'reporte.html')}`);
  for (const p of puntos) {
    const archivo = `tarjeta-${p.id}.png`;
    const loc = pagina.locator(`#${p.id}`);
    await loc.evaluate((el) => { el.querySelectorAll('.galeria, details').forEach((x) => { x.style.display = 'none'; }); });
    await loc.screenshot({ path: join(CAPTURAS, archivo) });
    await loc.evaluate((el) => { el.querySelectorAll('.galeria, details').forEach((x) => { x.style.display = ''; }); });
    p.capturas = [{ archivo: `capturas/${archivo}`, pie: `Resumen del punto «${p.titulo}»` }, ...(p.capturas ?? [])];
  }
  await contexto.close();
}

async function main() {
  await mkdir(CAPTURAS, { recursive: true });
  const rama = correr('git', ['rev-parse', '--abbrev-ref', 'HEAD']).salida.trim();
  const sha = correr('git', ['rev-parse', '--short', 'HEAD']).salida.trim();
  const sucio = correr('git', ['status', '--porcelain', '--', 'src', 'scripts', 'index.html', 'package.json']).salida.trim();
  const meta = { rama, sha: sucio ? `${sha} + cambios sin guardar` : sha, fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) };
  const estructura = await puntoEstructura();
  const { servidor, base } = await servir();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const registro = { escrituras: [], externas: new Set() };
  try {
    const puntos = [estructura];
    if (estructura.detalle.buildSalida) {
      for (const [id, titulo] of [['flujo', 'Flujo'], ['drive', 'Sincronización con Drive'], ['datos', 'Base de datos']]) {
        puntos.push({ id, titulo, pregunta: '', color: ROJO, filas: [['No se pudo probar', 'la app no se construye', ROJO]], resumen: 'Sin build no hay app que probar.' });
      }
    } else {
      puntos.push(await puntoFlujo(browser, base, registro));
      puntos.push(await puntoDrive(browser, base, registro));
      puntos.push(await puntoDatos(browser, base, registro));
    }
    await writeFile(join(SALIDA, 'reporte.html'), html(puntos, meta));
    await capturaTarjeta(browser, puntos);
    await writeFile(join(SALIDA, 'reporte.html'), html(puntos, meta));
    const resultado = { meta, general: peor(...puntos.map((p) => p.color)), puntos: puntos.map((p) => ({ id: p.id, color: p.color, resumen: p.resumen, filas: p.filas, detalle: p.detalle, clics: p.clics })), externas: [...registro.externas] };
    await writeFile(join(SALIDA, 'resultado.json'), `${JSON.stringify(resultado, null, 2)}\n`);
    log(`reporte: ${join(SALIDA, 'reporte.html')}`);
    for (const p of puntos) log(`${p.titulo}: ${NOMBRE[p.color]}`);
    log(`general: ${NOMBRE[resultado.general]}`);
    if (resultado.general === ROJO && !NO_BLOQUEAR) process.exitCode = 1;
  } finally {
    await browser.close();
    servidor.close();
  }
}

await main();
