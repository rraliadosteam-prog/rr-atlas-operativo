/* Atlas · RR Aliados — carcasa v3: brandkit RR, páginas completas, mapa maestro de la empresa. */
'use strict';

/* ============================ utilidades ============================ */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => new Intl.NumberFormat('es-CO').format(n || 0);

function bytes(n) {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
const fecha = (iso) => (iso ? String(iso).slice(0, 10) : '—');
const drive = (id) => `https://drive.google.com/open?id=${id}`;
const miniatura = (id, w = 640) => `/media/drive/${encodeURIComponent(id)}/${w}`;
const TIPO_ICONO = { markdown: '¶', pdf: 'PDF', imagen: '▣', planilla: '▦', json: '{}', codigo: '</>', documento: '▤', carpeta: '▸', otro: '•' };
const ESTADO_TXT = { activo: 'activo', ex: 'ex cliente', interno: 'interno' };

// Archivos que son ruido técnico (raws de cámara, video, comprimidos, nombres
// tipo UUID). No son "documentos" que alguien lea: ensucian la lista y pesan
// gigas. Se ocultan por defecto detrás de un toggle (S13).
const EXT_TECNICO = /\.(cr2|cr3|nef|arw|dng|raf|rw2|mp4|mov|avi|mkv|m4v|zip|rar|7z|tar|gz)$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function esTecnico(d) {
  return EXT_TECNICO.test(d.nombre) || UUID_RE.test(d.nombre);
}

/* ============================ estado ============================ */
let D = null;
let ruta = { vista: 'general', id: null };
let filtro = { area: null, q: '', tipo: null };
let mostrarTecnicos = false;
try { mostrarTecnicos = localStorage.getItem('atlas:explorar:tecnicos') === '1'; } catch { /* modo privado */ }
let tablero = null;
const abiertas = new Set();  // ramas desplegadas del árbol de esquemas
let editando = false;        // editor abierto en la página de un flujo
let ultimoMontaje = null;    // { host, base } para redibujar sin re-renderizar
let ramaY = 0;               // y de la rama que se acaba de abrir
let nodoSeleccionado = null; // id del nodo BPMN seleccionado en modo edición
const undoStack = [];        // snapshots de ediciones para deshacer
const redoStack = [];        // snapshots re-hechos

const CLAVE_EDICION = 'atlas:ediciones:v1';
let ediciones = {};
try { ediciones = JSON.parse(localStorage.getItem(CLAVE_EDICION) || '{}'); } catch { ediciones = {}; }

function guardarEdiciones() {
  try { localStorage.setItem(CLAVE_EDICION, JSON.stringify(ediciones)); } catch { /* modo privado */ }
}

function edicionDe(id) {
  if (!ediciones[id]) ediciones[id] = { campos: {}, nodos: {}, borrados: [], nuevos: [], conexionesBorradas: [] };
  return ediciones[id];
}

/* Aplica la capa de ediciones locales sobre un flujo del registro. */
function flujoEfectivo(base) {
  const e = ediciones[base.id];
  if (!e) return base;
  const nodos = base.nodos
    .filter((n) => !(e.borrados || []).includes(n.id))
    .map((n) => {
      const basePos = n.x != null && n.y != null ? { x: n.x, y: n.y } : {};
      return { ...n, ...basePos, ...(e.nodos?.[n.id] || {}) };
    })
    .concat((e.nuevos || []).map((n) => ({ ...n })));
  const conexiones = (base.conexiones || []).filter(
    (c) => !(e.conexionesBorradas || []).some((x) => x.a === c.a && x.b === c.b),
  );
  return {
    ...base,
    titulo: e.campos?.titulo || base.titulo,
    produce: e.campos?.produce ?? base.produce,
    nodos,
    nodos_total: nodos.length,
    conexiones,
    conexiones_total: conexiones.length,
  };
}

function posicionesDeEdicion(id) {
  const e = ediciones[id];
  if (!e || !e.nodos) return {};
  const out = {};
  for (const k in e.nodos) {
    const p = e.nodos[k];
    if (p && p.x != null && p.y != null) out[k] = { x: p.x, y: p.y };
  }
  return out;
}

function snapshotEdiciones() {
  try {
    undoStack.push(JSON.parse(JSON.stringify(ediciones)));
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
  } catch { /* nada */ }
}

function deshacer() {
  if (!undoStack.length || !ultimoMontaje) return;
  redoStack.push(JSON.parse(JSON.stringify(ediciones)));
  ediciones = undoStack.pop();
  guardarEdiciones();
  render();
}

function rehacer() {
  if (!redoStack.length || !ultimoMontaje) return;
  undoStack.push(JSON.parse(JSON.stringify(ediciones)));
  ediciones = redoStack.pop();
  guardarEdiciones();
  render();
}

function redibujarFlujo() {
  if (!ultimoMontaje || typeof window.BPMN === 'undefined') return;
  const { host, base } = ultimoMontaje;
  const f = flujoEfectivo(base);
  const opts = { posiciones: posicionesDeEdicion(base.id) };
  const m = window.BPMN.medir(f, opts);
  const t = host.__tablero || Tablero(host);
  t.mundo.innerHTML = window.BPMN.dibujar(f, opts);
  t.mundo.style.width = `${m.ancho}px`;
  t.mundo.style.height = `${m.alto}px`;
  destacarNodoSeleccionado();
}

function posicionNodoActual(base, nodoId) {
  const f = flujoEfectivo(base);
  const pos = window.BPMN.posiciones(f, { posiciones: posicionesDeEdicion(base.id) })[nodoId];
  return pos || { x: 0, y: 0 };
}

function moverNodoAbs(baseId, nodoId, x, y) {
  snapshotEdiciones();
  const e = edicionDe(baseId);
  const prev = e.nodos[nodoId] || {};
  e.nodos[nodoId] = { ...prev, x, y };
  guardarEdiciones();
  redibujarFlujo();
  actualizarAccionesVault();
}

function seleccionarNodo(id) {
  nodoSeleccionado = id || null;
  destacarNodoSeleccionado();
}

function destacarNodoSeleccionado() {
  $$('.bpmn-nodo').forEach((g) => g.classList.toggle('seleccionado', g.dataset.nodo === nodoSeleccionado));
}

let vaultDisponible = null;

async function detectarVault() {
  try {
    const res = await fetch('/api/estado', { cache: 'no-cache' });
    if (!res.ok) throw new Error('no ok');
    const data = await res.json();
    vaultDisponible = data.ok ? data.vault : false;
  } catch {
    vaultDisponible = false;
  }
  actualizarAccionesVault();
}

function resumenCambios(id) {
  const e = ediciones[id];
  if (!e) return null;
  const nodos = Object.keys(e.nodos || {}).length;
  const campos = Object.keys(e.campos || {}).length;
  const nuevos = (e.nuevos || []).length;
  const borrados = (e.borrados || []).length;
  const total = nodos + campos + nuevos + borrados;
  if (!total) return null;
  const partes = [];
  if (nodos) partes.push(`${nodos} posición${nodos > 1 ? 'es' : ''}`);
  if (campos) partes.push(`${campos} campo${campos > 1 ? 's' : ''}`);
  if (nuevos) partes.push(`${nuevos} nuevo${nuevos > 1 ? 's' : ''}`);
  if (borrados) partes.push(`${borrados} borrado${borrados > 1 ? 's' : ''}`);
  return partes.join(' · ');
}

function actualizarAccionesVault() {
  const cont = $('#vault-actions');
  if (!cont) return;
  const id = cont.dataset.flujoId;
  const resumen = resumenCambios(id);
  if (!editando) {
    cont.innerHTML = resumen
      ? `<p class="a-nota" style="margin-top:10px">Borrador local: ${esc(resumen)}.</p>`
      : '';
    return;
  }
  if (vaultDisponible === null) {
    cont.innerHTML = '<p class="a-nota" style="margin-top:10px">Buscando acceso al vault…</p>';
    return;
  }
  if (!vaultDisponible || !resumen) {
    cont.innerHTML = '';
    return;
  }
  cont.innerHTML = `<div class="a-btns" style="margin-top:10px">
      <button class="a-btn primario" data-edit-guardar="${esc(id)}">Guardar en el vault</button>
    </div>
    <p class="a-nota">Cambios listos: ${esc(resumen)}.</p>`;
}

async function guardarEnVault(id) {
  const base = D.flujos.find((x) => x.id === id);
  if (!base) return;
  const f = flujoEfectivo(base);
  const resumen = resumenCambios(id);
  if (!confirm(`¿Guardar "${f.titulo}" en el vault?\n\n${resumen}\n\nSe creará un backup .bak y se sobreescribirá el archivo original.`)) return;
  try {
    const res = await fetch(`/api/flujo/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    // limpiar ediciones locales porque ya están en el vault
    delete ediciones[id];
    guardarEdiciones();
    render();
    alert('Guardado en el vault. Se recargará el flujo desde el registro.');
  } catch (err) {
    alert(`No se pudo guardar: ${err.message}`);
  }
}

function activarEdicionNodos(host, base) {
  const mundo = host.querySelector('.a-world');
  if (!mundo || mundo.__edicionActivada) return;
  mundo.__edicionActivada = true;
  let drag = null;

  function finalizar() {
    if (!drag) return;
    const { el, inicioMundo, dx, dy, baseId, id } = drag;
    el.style.transform = '';
    document.body.style.cursor = '';
    const viejo = drag;
    drag = null;
    if (dx === 0 && dy === 0) return;
    moverNodoAbs(baseId, id, inicioMundo.x + dx, inicioMundo.y + dy);
  }

  mundo.addEventListener('pointerdown', (ev) => {
    if (!editando) return;
    const g = ev.target.closest('[data-nodo]');
    if (!g) { seleccionarNodo(null); return; }
    ev.stopPropagation();
    ev.preventDefault();
    const id = g.dataset.nodo;
    seleccionarNodo(id);
    const pos = posicionNodoActual(base, id);
    const t = host.__tablero;
    drag = {
      id, el: g, baseId: base.id,
      inicioCliente: { x: ev.clientX, y: ev.clientY },
      inicioMundo: { x: pos.x, y: pos.y },
      dx: 0, dy: 0, tablero: t,
    };
    document.body.style.cursor = 'grabbing';
  }, true);

  window.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const deltaX = (ev.clientX - drag.inicioCliente.x) / drag.tablero.st.s;
    const deltaY = (ev.clientY - drag.inicioCliente.y) / drag.tablero.st.s;
    drag.dx = deltaX; drag.dy = deltaY;
    drag.el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  });
  window.addEventListener('pointerup', finalizar);
  window.addEventListener('pointercancel', finalizar);
}

const VISTAS = ['general', 'areas', 'area', 'clientes', 'cliente', 'flujos', 'flujo', 'esquemas', 'esquema', 'explorar', 'duplicados'];

/* ============================ datos ============================ */
async function cargarDatos() {
  if (window.ATLAS_DATOS) return window.ATLAS_DATOS;
  const res = await fetch('datos.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`no se pudo leer datos.json (${res.status})`);
  return res.json();
}

/* ============================ tablero infinito ============================ */
function Tablero(host, opts) {
  opts = opts || {};
  const canPan = opts.canPan || (() => true);
  let mundo = host.querySelector('.a-world');
  if (!mundo) {
    mundo = document.createElement('div');
    mundo.className = 'a-world';
    host.prepend(mundo);
  }
  const st = { x: 0, y: 0, s: 1 };
  const MIN = 0.08;
  const MAX = 2.2;
  let arrastrando = false;
  let movido = 0;
  let ultimo = null;
  let panSuprimido = false;

  function aplicar() {
    mundo.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.s})`;
    host.style.setProperty('--grid', `${Math.max(10, 28 * st.s)}px`);
    const etiqueta = $('.zoom', host);
    if (etiqueta) etiqueta.textContent = `${Math.round(st.s * 100)}%`;
  }

  function aMundo(clientX, clientY) {
    const caja = host.getBoundingClientRect();
    return {
      x: (clientX - caja.left - st.x) / st.s,
      y: (clientY - caja.top - st.y) / st.s,
    };
  }

  function encajar(todo = false) {
    const W = mundo.offsetWidth || 1;
    const H = mundo.offsetHeight || 1;
    // Un diagrama es ancho por naturaleza: en ese modo encaja por alto y se recorre de costado.
    const soloAlto = host.dataset.eje === 'y';
    const ajuste = soloAlto
      ? Math.min(1, (host.clientHeight - 28) / H)
      : Math.min(1, (host.clientWidth - 28) / W, (host.clientHeight - 28) / H);
    st.s = Math.max(todo ? MIN : Number(host.dataset.minzoom || 0.5), ajuste);
    const ancho = W * st.s;
    const centro = Number(host.dataset.centro || 0);
    if (centro) {
      st.x = host.clientWidth / 2 - centro * st.s;
    } else if (soloAlto || host.dataset.alinear === 'izq') {
      st.x = 28;
    } else {
      st.x = ancho > host.clientWidth - 16 ? 28 : (host.clientWidth - ancho) / 2;
    }
    st.y = 20;
    aplicar();
  }

  function zoom(factor, cx, cy) {
    const px = cx === undefined ? host.clientWidth / 2 : cx;
    const py = cy === undefined ? host.clientHeight / 2 : cy;
    const antes = st.s;
    st.s = Math.max(MIN, Math.min(MAX, st.s * factor));
    const k = st.s / antes;
    st.x = px - (px - st.x) * k;
    st.y = py - (py - st.y) * k;
    aplicar();
  }

  host.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    // En los árboles la rueda recorre; con Ctrl/Cmd hace zoom.
    if (host.dataset.rueda === 'pan' && !ev.ctrlKey && !ev.metaKey) {
      st.x -= ev.deltaX;
      st.y -= ev.deltaY;
      aplicar();
      return;
    }
    const caja = host.getBoundingClientRect();
    zoom(Math.exp(-ev.deltaY * 0.0016), ev.clientX - caja.left, ev.clientY - caja.top);
  }, { passive: false });

  host.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    if (!canPan(ev)) return;
    arrastrando = true; movido = 0; ultimo = { x: ev.clientX, y: ev.clientY };
    host.classList.add('arrastrando');
  });

  let toqueInicial = null;
  host.addEventListener('touchstart', (ev) => {
    if (ev.touches.length === 2) {
      const rect = host.getBoundingClientRect();
      const t1 = ev.touches[0], t2 = ev.touches[1];
      toqueInicial = {
        d0: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
        s0: st.s,
        cx: (t1.clientX + t2.clientX) / 2 - rect.left,
        cy: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    }
  }, { passive: true });
  host.addEventListener('touchmove', (ev) => {
    if (!toqueInicial || ev.touches.length !== 2) return;
    ev.preventDefault();
    const t1 = ev.touches[0], t2 = ev.touches[1];
    const d1 = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const nuevaS = Math.max(MIN, Math.min(MAX, toqueInicial.s0 * (d1 / toqueInicial.d0)));
    const k = nuevaS / st.s;
    st.x = toqueInicial.cx - (toqueInicial.cx - st.x) * k;
    st.y = toqueInicial.cy - (toqueInicial.cy - st.y) * k;
    st.s = nuevaS;
    aplicar();
  }, { passive: false });
  host.addEventListener('touchend', () => { toqueInicial = null; });
  host.addEventListener('touchcancel', () => { toqueInicial = null; });
  host.addEventListener('pointermove', (ev) => {
    if (!arrastrando) return;
    const dx = ev.clientX - ultimo.x;
    const dy = ev.clientY - ultimo.y;
    movido += Math.abs(dx) + Math.abs(dy);
    if (movido > 5) {
      panSuprimido = true;
      st.x += dx; st.y += dy;
      ultimo = { x: ev.clientX, y: ev.clientY };
      aplicar();
    }
  });
  const soltar = () => {
    arrastrando = false;
    host.classList.remove('arrastrando');
    if (panSuprimido) setTimeout(() => { panSuprimido = false; }, 0);
  };
  host.addEventListener('pointerup', soltar);
  host.addEventListener('pointercancel', soltar);
  host.addEventListener('pointerleave', soltar);
  host.addEventListener('click', (ev) => {
    if (!panSuprimido) return;
    ev.stopPropagation(); ev.preventDefault();
    panSuprimido = false;
  }, true);

  function centrarEn(yMundo) {
    st.y = 120 - yMundo * st.s;
    aplicar();
  }

  const api = { mundo, encajar, aplicar, zoom, centrarEn, st, aMundo };
  host.__tablero = api;
  return api;
}

function tools(pista = 'arrastrá para mover · rueda para acercar') {
  return `<div class="a-board-tools">
    <button data-zoom="out" title="Alejar">−</button>
    <span class="zoom">100%</span>
    <button data-zoom="in" title="Acercar">+</button>
    <button data-zoom="fit" title="Ver todo el tablero">⤢</button>
  </div>
  <div class="a-board-hint">${pista}</div>`;
}

/* ============================ piezas ============================ */
function portada(c, razon = '16/9', glifo = null) {
  const iniciales = esc((c.nombre || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase());
  const img = c.portada ? `<img loading="eager" src="${miniatura(c.portada)}" alt="" onerror="this.remove()">` : '';
  return `<div class="a-cover" style="aspect-ratio:${razon}"><div class="a-fallback">${glifo || iniciales}</div>${img}</div>`;
}

function chipsTipos(tipos) {
  return `<div class="a-tipos">${Object.entries(tipos || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([t, n]) => `<i>${TIPO_ICONO[t] || t} ${n}</i>`).join('')}</div>`;
}

function cardCliente(c) {
  return `<button class="a-card" draggable="true" data-drag-id="${esc(c.id)}" data-drag-vista="clientes" data-ir="cliente" data-id="${esc(c.id)}">
    ${portada(c)}
    <div class="a-card-body">
      <h3>${esc(c.nombre)} <span class="a-badge ${esc(c.estado)}">${esc(ESTADO_TXT[c.estado] || c.estado)}</span></h3>
      <div class="a-meta"><span>${num(c.documentos)} docs</span><span>${num(c.carpetas)} carpetas</span><span>${fecha(c.ultima)}</span></div>
      ${chipsTipos(c.tipos)}
    </div></button>`;
}

function filaFlujo(f) {
  return `<button class="a-row" data-ir="flujo" data-id="${esc(f.id)}">
    <div><strong>${esc(f.titulo)}</strong><small>${esc(f.produce || f.id)}</small></div>
    <div class="a-row-side">
      <span>${num(f.nodos_total)} nodos · ${f.lanes.length} carriles</span>
      <span class="a-chip" style="pointer-events:none">${esc(f.area_nombre)}</span>
    </div>
  </button>`;
}

/* id de área a partir de su nombre visible (para enlazar columnas al hub) */
function idDe(nombre) {
  const a = D.areas.find((x) => x.nombre === nombre);
  return a ? a.id : '';
}

/* tablero de tarjetas: una columna por área, las áreas sin contenido también aparecen */
function tableroCartas(items, tarjeta, areasVacias = []) {
  const grupos = new Map();
  for (const it of items) {
    const clave = it.area_nombre || 'Sistema';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(it);
  }
  for (const vacia of areasVacias) if (!grupos.has(vacia)) grupos.set(vacia, []);

  const orden = [...grupos.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'),
  );
  const COL = 310;
  const GAP = 30;
  const altoMax = Math.max(1, ...orden.map(([, l]) => l.length));
  const ancho = 40 + Math.max(1, orden.length) * (COL + GAP);
  const alto = 70 + altoMax * 132 + 90;

  const columnas = orden
    .map(([nombre, lista], i) => {
      const x = 40 + i * (COL + GAP);
      const sin = lista.length === 0;
      const cards = sin
        ? `<div class="b-card" style="border-style:dashed;cursor:default">
             <small style="color:var(--apagado)">Todavía no hay flujo escrito para esta área.</small></div>`
        : lista.map(tarjeta).join('');
      return `<div class="b-col" style="left:${x}px;top:70px;width:${COL}px">
        <div class="b-col-head ${sin ? 'sin-flujo' : ''}"><button class="b-col-link" data-ir="area" data-id="${esc(idDe(nombre))}" title="Abrir el hub de esta área">${esc(nombre)} →</button> <small>${lista.length}</small></div>
        ${cards}</div>`;
    })
    .join('');
  return `<div class="a-board" data-board>${tools()}<div class="a-world" style="width:${ancho}px;height:${alto}px">${columnas}</div></div>`;
}

/* ============================ mapa maestro ============================ */
function areaOtros() {
  const empresa = new Set(D.areas.filter((a) => a.grupo === 'empresa').map((a) => a.id));
  const flujos = D.flujos.filter((f) => !empresa.has(f.area));
  const esquemas = D.esquemas.filter((e) => !empresa.has(e.area));
  return {
    id: '__otros__',
    nombre: 'Otros procesos',
    flujos: flujos.map((f) => f.id),
    esquemas: esquemas.map((e) => e.id),
    documentos: 0,
    ultima: null,
  };
}

function hojasDeAreaOtros() {
  const empresa = new Set(D.areas.filter((a) => a.grupo === 'empresa').map((a) => a.id));
  const nombreArea = (id) => D.areas.find((a) => a.id === id)?.nombre || id;
  const items = [];
  for (const f of D.flujos.filter((x) => !empresa.has(x.area))) {
    items.push({ tipo: 'flujo', id: f.id, nombre: f.titulo || f.id, info: `${f.nodos_total || 0} nodos · ${f.lanes.length || 0} carriles · ${nombreArea(f.area)}` });
  }
  for (const e of D.esquemas.filter((x) => !empresa.has(x.area))) {
    items.push({ tipo: 'esquema', id: e.id, nombre: e.nombre || e.id, info: `${e.vistas.length || 0} vistas${e.flujo ? ' · con flujo' : ''} · ${nombreArea(e.area)}` });
  }
  return items;
}

function arbolEsquemas() {
  const areas = D.areas.filter((a) => a.grupo === 'empresa');
  const otros = areaOtros();
  const ramas = otros.flujos.length + otros.esquemas.length ? [...areas, otros] : areas;
  const RAIZ_W = 420, RAIZ_H = 92;
  const AREA_W = 380, AREA_H = 72;
  const HOJA_W = 340, HOJA_H = 60;
  const SEP = 12, SEP_AREA = 20;
  const X_RAIZ = 40, X_AREA = 76, X_HOJA = 118;

  const hojasDe = (a) => [
    ...a.flujos.map((id) => {
      const f = D.flujos.find((x) => x.id === id);
      return { tipo: 'flujo', id, nombre: f?.titulo || id, info: `${f?.nodos_total || 0} nodos · ${f?.lanes.length || 0} carriles` };
    }),
    ...a.esquemas.map((id) => {
      const e = D.esquemas.find((x) => x.id === id);
      return { tipo: 'esquema', id, nombre: e?.nombre || id, info: `${e?.vistas.length || 0} vistas${e?.flujo ? ' · con flujo' : ''}` };
    }),
  ];

  const piezas = [];
  const hilos = [];
  const Y_RAIZ = 40;
  let y = Y_RAIZ + RAIZ_H + 34;

  piezas.push(`<div class="r-nodo raiz" style="left:${X_RAIZ}px;top:${Y_RAIZ}px;width:${RAIZ_W}px;height:${RAIZ_H}px">
      <div class="r-titulo">RR Aliados</div>
      <div class="r-info">${areas.length} áreas · ${D.flujos.length} flujos · ${D.esquemas.length} esquemas</div>
      <div class="r-pie">${num(D.kpis.documentos)} documentos</div>
    </div>`);

  // tronco: baja desde la raíz hasta la última área
  const yAreas = [];
  const yFin = ramas.reduce((t, a) => {
    const abierta = abiertas.has(a.id);
    const hojas = abierta ? (a.id === '__otros__' ? hojasDeAreaOtros() : hojasDe(a)) : [];
    const alto = AREA_H + (hojas.length ? 8 + hojas.length * (HOJA_H + SEP) : 0);
    yAreas.push({ a, abierta, hojas, y, alto });
    y += alto + SEP_AREA;
    return y;
  }, y);

  hilos.push(`<path class="r-hilo tronco" d="M ${X_RAIZ + 26} ${Y_RAIZ + RAIZ_H} V ${yFin - SEP_AREA / 2}"/>`);

  for (const bloque of yAreas) {
    const { a, abierta, hojas, y: ya, alto } = bloque;
    const total = a.flujos.length + a.esquemas.length;
    const esOtros = a.id === '__otros__';
    piezas.push(`<div class="r-nodo area ${abierta ? 'abierto' : ''}${esOtros ? ' otros' : ''}" data-arbol-area="${esc(a.id)}" data-y="${ya}"
        style="left:${X_AREA}px;top:${ya}px;width:${AREA_W}px;height:${AREA_H}px">
        <div class="r-titulo">${esc(a.nombre)}<span class="r-badge">${total ? (abierta ? '−' : `+${total}`) : '—'}</span></div>
        <div class="r-info">${a.flujos.length} flujos · ${a.esquemas.length} esquemas${esOtros ? ' · áreas de soporte' : ` · ${num(a.documentos)} docs`}</div>
        <div class="r-pie">${esOtros ? 'no pertenecen al organigrama de RR Aliados' : esc(fecha(a.ultima)) + (total ? '' : ' · sin procesos escritos')}${esOtros ? '' : ` <button class="r-hub" data-ir="area" data-id="${esc(a.id)}">abrir área →</button>`}</div>
      </div>`);
    // codo tronco → área
    hilos.push(`<path class="r-hilo tronco" d="M ${X_RAIZ + 26} ${ya + AREA_H / 2} H ${X_AREA}"/>`);

    if (abierta && hojas.length) {
      let yh = ya + AREA_H + 8;
      const ySpine = yh + (hojas.length * (HOJA_H + SEP) - SEP) / 2;
      for (const h of hojas) {
        hilos.push(`<path class="r-hilo hoja" d="M ${X_AREA + 26} ${yh + HOJA_H / 2} H ${X_HOJA}"/>`);
        piezas.push(`<div class="r-nodo ${h.tipo}" data-arbol-${h.tipo}="${esc(h.id)}"
            style="left:${X_HOJA}px;top:${yh}px;width:${HOJA_W}px;height:${HOJA_H}px">
            <div class="r-titulo">${esc(h.nombre)}<span class="r-badge">${h.tipo === 'flujo' ? '⇢' : '▩'}</span></div>
            <div class="r-info">${esc(h.info)}</div>
          </div>`);
        yh += HOJA_H + SEP;
      }
      // rama del área hacia sus hojas
      const xSpine = esOtros ? X_AREA + 26 : X_AREA + 26;
      hilos.push(`<path class="r-hilo hoja" d="M ${xSpine} ${ya + AREA_H} V ${ySpine}"/>`);
    }
  }

  const ancho = X_HOJA + HOJA_W + 70;
  const alto = Math.max(460, y + 50);

  return `<div class="a-board" data-board data-minzoom="1" data-rueda="pan" data-alinear="izq">${tools('clic en un área para abrir sus ramas · rueda para recorrer · arrastrá para mover')}
    <div class="a-world" style="width:${ancho}px;height:${alto}px">
      <svg style="position:absolute;left:0;top:0;width:${ancho}px;height:${alto}px;z-index:0">${hilos.join('')}</svg>
      ${piezas.join('')}
    </div></div>`;
}

/* ============================ vistas ============================ */
function vistaGeneral() {
  const k = D.kpis;
  const top = D.clientes.filter((c) => c.estado !== 'interno').slice(0, 4);
  return `
  <section class="a-hero">
    <div class="a-hero-txt">
      <h2>La empresa<br><em>en una pantalla</em></h2>
      <button class="a-buscador" type="button" data-abrir-paleta>
        <span class="i">⌕</span>
        <span class="t">Buscar clientes, procesos, esquemas o documentos…</span>
        <span class="k">Ctrl K</span>
      </button>
      <p>${num(k.documentos)} documentos · ${num(k.clientes)} clientes · ${num(k.flujos)} procesos · ${num(k.esquemas)} esquemas · ${bytes(k.bytes)}. Un solo lugar, sin carpetas que abrir.</p>
    </div>
    <div class="a-hero-img">
      <img src="assets/equipo-1600.jpg" alt="Equipo RR Aliados">
      <span class="a-hero-marca">Growth Partner</span>
    </div>
  </section>
  <div class="a-kpis">
    <div class="a-kpi"><b>${num(k.documentos)}</b><span>documentos</span></div>
    <div class="a-kpi fucsia"><b>${num(k.clientes)}</b><span>clientes</span></div>
    <div class="a-kpi"><b>${num(k.flujos)}</b><span>procesos</span></div>
    <div class="a-kpi"><b>${num(k.esquemas)}</b><span>esquemas</span></div>
  </div>
  <section class="a-sec">
    <h2>Clientes con más documentación <span>un clic abre su página</span></h2>
    <div class="a-grid">${top.map(cardCliente).join('')}</div>
  </section>
  <section class="a-sec">
    <h2>Procesos de la empresa <span>un clic abre el diagrama</span></h2>
    <div class="a-rows">${D.flujos.slice(0, 6).map(filaFlujo).join('')}</div>
  </section>
  <section class="a-sec a-general-tools">
    <h2>Herramientas <span>vistas de apoyo para entender y cuidar el Drive</span></h2>
    <div class="a-tool-grid">
      <button class="a-tool" data-general-tool data-ir="esquemas"><span>⌗</span><strong>Mapa de esquemas</strong><small>${num(k.esquemas)} esquemas conectados por área</small></button>
      <button class="a-tool" data-general-tool data-ir="duplicados"><span>⧉</span><strong>Archivos duplicados</strong><small>${num(k.duplicados_md5)} grupos para revisar, sin borrar nada</small></button>
    </div>
  </section>
  ${bloqueFaltantes()}`;
}

function bloqueFaltantes() {
  const areas = D.areas.filter((a) => a.grupo === 'empresa');
  const sinFlujo = areas.filter((a) => a.flujos.length === 0);
  const sinNada = areas.filter((a) => a.flujos.length === 0 && a.esquemas.length === 0);
  const esquemasSinFlujo = D.esquemas.filter((e) => !e.flujo);
  const filas = [
    { n: sinFlujo.length, t: 'áreas sin flujo escrito', d: sinFlujo.map((a) => a.nombre).join(' · ') || 'ninguna', ir: 'flujos' },
    { n: sinNada.length, t: 'áreas sin ningún proceso ni esquema', d: sinNada.map((a) => a.nombre).join(' · ') || 'ninguna', ir: 'explorar' },
    { n: esquemasSinFlujo.length, t: 'esquemas sin flujo BPMN', d: esquemasSinFlujo.slice(0, 4).map((e) => e.nombre).join(' · '), ir: 'esquemas' },
    { n: D.kpis.duplicados_md5, t: 'grupos de archivos repetidos', d: `${num(D.kpis.copias_extra)} copias de más en el Drive`, ir: 'duplicados' },
  ];
  return `<section class="a-sec">
    <h2>Lo que falta <span>los huecos también son información</span></h2>
    <div class="a-rows">${filas
      .map(
        (f) => `<button class="a-row" data-ir="${f.ir}">
          <div><strong>${f.n} ${esc(f.t)}</strong><small>${esc(f.d)}</small></div>
          <div class="a-row-side">ver →</div></button>`,
      )
      .join('')}</div></section>`;
}

function vistaAreas() {
  const empresa = D.areas.filter((a) => a.grupo === 'empresa').sort((a, b) => b.documentos - a.documentos);
  const otros = D.areas.filter((a) => a.grupo !== 'empresa').sort((a, b) => b.documentos - a.documentos);
  const tarjeta = (a) => {
    const clientes = D.clientes.filter((c) => c.area === a.id).length;
    return `<button class="a-area" data-ir="area" data-id="${esc(a.id)}">
      <span class="a-area-nombre">${esc(a.nombre)}</span>
      <span class="a-area-stats">
        <span class="s"><b>${num(a.documentos)}</b> <i>docs</i></span>
        <span class="s"><b>${a.flujos.length}</b> <i>flujos</i></span>
        <span class="s"><b>${a.esquemas.length}</b> <i>esquemas</i></span>
        ${clientes ? `<span class="s"><b>${clientes}</b> <i>clientes</i></span>` : ''}
      </span>
      <span class="a-area-fecha">${fecha(a.ultima)}</span>
    </button>`;
  };
  return `<section class="a-sec">
    <h2>Áreas de la empresa <span>${empresa.length} · cada área junta sus flujos, esquemas y documentos</span></h2>
    <div class="a-areas">${empresa.map(tarjeta).join('')}</div>
  </section>
  ${otros.length ? `<details class="a-sec a-otros">
    <summary><strong>Otras carpetas</strong><span>${otros.length} · clientes, archivo y sistema; fuera del organigrama</span><i>mostrar</i></summary>
    <div class="a-areas">${otros.map(tarjeta).join('')}</div>
  </details>` : ''}`;
}

function paginaArea(id) {
  const a = D.areas.find((x) => x.id === id);
  if (!a) return '<div class="a-empty">No encontré esa área.</div>';
  const docs = D.documentos.filter((d) => d.area === a.id);
  const clientes = D.clientes.filter((c) => c.area === a.id);
  const flujos = a.flujos.map((f) => D.flujos.find((x) => x.id === f)).filter(Boolean);
  const esquemas = a.esquemas.map((e) => D.esquemas.find((x) => x.id === e)).filter(Boolean);
  const recientes = [...docs]
    .sort((x, y) => String(y.modificado).localeCompare(String(x.modificado)))
    .slice(0, 12);

  return `<div class="a-page">
    <button class="a-back" data-ir="areas">← Áreas</button>
    <div class="a-page-hero">
      <div>
        <h2>${esc(a.nombre)}</h2>
        <div class="a-ruta">${num(docs.length)} documentos · ${flujos.length} flujos · ${esquemas.length} esquemas${clientes.length ? ` · ${clientes.length} clientes` : ''}</div>
        <div class="a-btns">
          <button class="a-btn primario" data-ir="explorar" data-area="${esc(a.id)}">Ver documentos del área</button>
          ${flujos.length ? `<button class="a-btn mostaza" data-ir="flujo" data-id="${esc(flujos[0].id)}">Ver su proceso</button>` : ''}
          <button class="a-btn" data-arbol-area-ir="${esc(a.id)}">Ver en el árbol</button>
        </div>
      </div>
      <dl class="a-dl">
        <dt>Documentos</dt><dd>${num(docs.length)}</dd>
        <dt>Flujos BPMN</dt><dd>${flujos.length}</dd>
        <dt>Esquemas</dt><dd>${esquemas.length}</dd>
        ${clientes.length ? `<dt>Clientes</dt><dd>${clientes.length}</dd>` : ''}
        <dt>Última actividad</dt><dd>${fecha(a.ultima)}</dd>
      </dl>
    </div>

    ${clientes.length ? `<section class="a-sec">
      <h2>Clientes de esta área <span>un clic abre su página</span></h2>
      <div class="a-grid">${clientes.map(cardCliente).join('')}</div>
    </section>` : ''}

    <section class="a-sec">
      <h2>Procesos <span>${flujos.length} flujos BPMN del área</span></h2>
      <div class="a-rows">${flujos.map(filaFlujo).join('') || '<div class="a-empty">Esta área todavía no tiene un flujo BPMN escrito.</div>'}</div>
    </section>

    ${esquemas.length ? `<section class="a-sec">
      <h2>Esquemas <span>${esquemas.length} vistas</span></h2>
      <div class="a-btns">${esquemas.map((e) => `<button class="a-btn" data-ir="esquema" data-id="${esc(e.id)}">▩ ${esc(e.nombre)}</button>`).join('')}</div>
    </section>` : ''}

    <section class="a-sec">
      <h2>Documentos recientes <span>los últimos ${recientes.length} de ${num(docs.length)}</span></h2>
      <div class="a-rows">${recientes.map((d) => `<a class="a-row" href="${drive(d.id)}" target="_blank" rel="noopener" title="${esc(d.ruta)}">
          <div><strong>${esc(d.nombre)}</strong><small>${esc(d.ruta)}</small></div>
          <div class="a-row-side"><span>${bytes(d.bytes)}</span><span>${fecha(d.modificado)}</span></div>
        </a>`).join('') || '<div class="a-empty">Sin documentos en esta área.</div>'}</div>
    </section>
  </div>`;
}

function vistaClientes() {
  const lista = aplicarOrden(D.clientes, 'clientes');
  return `<section class="a-sec">
    <h2>Todos los clientes <span>${D.clientes.length} carpetas bajo 06_Clientes · arrastrá para reordenar</span></h2>
    <div class="a-grid">${lista.map(cardCliente).join('')}</div>
  </section>`;
}

/* ---------- página de cliente ---------- */
function paginaCliente(id) {
  const c = D.clientes.find((x) => x.id === id);
  if (!c) return '<div class="a-empty">No encontré ese cliente.</div>';
  const areaNombre = D.areas.find((a) => a.id === c.area)?.nombre || c.area;
  const flujos = D.flujos.filter((f) => f.area === c.area);
  const esquemas = D.esquemas.filter((e) => e.area === c.area);
  const carpetas = c.subcarpetas
    .map((s) => `<div class="a-row"><div><strong>${esc(s.nombre)}</strong></div>
      <div class="a-row-side"><span>${num(s.documentos)} docs</span>
      ${s.id ? `<a class="a-btn" style="padding:5px 9px" href="${drive(s.id)}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}</div></div>`)
    .join('');
  const recientes = c.recientes
    .map((d) => `<div class="a-row"><div><strong><a href="${drive(d.id)}" target="_blank" rel="noopener">${esc(d.nombre)}</a></strong>
        <small>${TIPO_ICONO[d.tipo] || d.tipo} · ${esc(d.tipo)}</small></div>
        <div class="a-row-side">${fecha(d.modificado)}</div></div>`)
    .join('');

  const docs = D.documentos.filter((d) => d.cliente === c.id).slice(0, 24)
    .map((d) => `<tr>
      <td><a class="nombre" href="${drive(d.id)}" target="_blank" rel="noopener">${esc(d.nombre)}</a>
        <div class="ruta">${esc(d.ruta)}</div></td>
      <td>${TIPO_ICONO[d.tipo] || d.tipo}</td><td>${fecha(d.modificado)}</td>
      <td style="text-align:right">${bytes(d.bytes)}</td></tr>`)
    .join('');

  return `<div class="a-page">
    <button class="a-back" data-ir="clientes">← Clientes</button>
    ${c.portada ? `<div class="a-page-band"><img src="${miniatura(c.portada, 1600)}" alt="" onerror="this.parentNode.remove()"></div>` : ''}
    <div class="a-page-hero">
      <div>
        <h2>${esc(c.nombre)} <span class="a-badge ${esc(c.estado)}">${esc(ESTADO_TXT[c.estado] || c.estado)}</span></h2>
        <div class="a-ruta">${esc(c.ruta)}</div>
        <div class="a-btns">
          <a class="a-btn" href="${c.drive_id ? drive(c.drive_id) : `https://drive.google.com/drive/search?q=${encodeURIComponent(c.nombre)}`}" target="_blank" rel="noopener">Abrir la carpeta en Drive ↗</a>
          ${flujos.length ? `<button class="a-btn mostaza" data-ir="flujo" data-id="${esc(flujos[0].id)}">Ver el proceso del área</button>` : ''}
          <button class="a-btn primario" data-ir="area" data-id="${esc(c.area)}">Abrir el área</button>
        </div>
      </div>
      <dl class="a-dl">
        <dt>Documentos</dt><dd>${num(c.documentos)}</dd>
        <dt>Carpetas</dt><dd>${num(c.carpetas)}</dd>
        <dt>Peso</dt><dd>${bytes(c.bytes)}</dd>
        <dt>Última actividad</dt><dd>${fecha(c.ultima)}</dd>
        <dt>Área</dt><dd>${esc(areaNombre)}</dd>
      </dl>
    </div>
    ${carpetas ? `<section class="a-sec"><h2>Carpetas <span>${c.subcarpetas.length} principales</span></h2><div class="a-rows">${carpetas}</div></section>` : ''}
    ${recientes ? `<section class="a-sec"><h2>Últimos documentos</h2><div class="a-rows">${recientes}</div></section>` : ''}
    ${docs ? `<section class="a-sec"><h2>Documentos del cliente <span>primeros 24 por fecha</span></h2>
      <table class="a-table"><thead><tr><th>Documento</th><th>Tipo</th><th>Modificado</th><th style="text-align:right">Peso</th></tr></thead>
      <tbody>${docs}</tbody></table></section>` : ''}
    <section class="a-sec">
      <h2>Procesos y esquemas de ${esc(areaNombre)}</h2>
      <div class="a-rows">
        ${flujos.map(filaFlujo).join('') || '<div class="a-empty">Esta área todavía no tiene un flujo BPMN escrito.</div>'}
      </div>
      ${esquemas.length ? `<div class="a-btns" style="margin-top:12px">
        ${esquemas.slice(0, 6).map((e) => `<button class="a-btn" data-ir="esquema" data-id="${esc(e.id)}">▩ ${esc(e.nombre)}</button>`).join('')}
      </div>` : ''}
    </section>
  </div>`;
}

const ORDEN_KEY = 'atlas:orden:v1';
function ordenGuardado(vista) {
  try { return JSON.parse(localStorage.getItem(`${ORDEN_KEY}:${vista}`)) || []; } catch { return []; }
}
function guardarOrden(vista, ids) {
  localStorage.setItem(`${ORDEN_KEY}:${vista}`, JSON.stringify(ids));
}
function aplicarOrden(lista, vista) {
  const orden = ordenGuardado(vista);
  const idx = new Map(orden.map((id, i) => [id, i]));
  return [...lista].sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity));
}

/* ---------- flujos ---------- */
function vistaFlujos() {
  const areas = D.areas.filter((a) => a.grupo === 'empresa');
  const sinFlujo = areas.filter((a) => a.flujos.length === 0).map((a) => a.nombre);
  const lista = aplicarOrden(
    (filtro.area ? D.flujos.filter((f) => f.area === filtro.area) : D.flujos)
      .filter((f) => coincide(f.titulo + ' ' + f.produce + ' ' + f.id)),
    'flujos'
  );
  if (!lista.length && filtro.area) return '<div class="a-empty"><p>Ese filtro no deja ningún flujo.</p><button class="a-btn" data-limpiar-filtro>Limpiar filtro</button></div>';
  const tarjeta = (f) => `<button class="b-card" draggable="true" data-drag-id="${esc(f.id)}" data-drag-vista="flujos" data-ir="flujo" data-id="${esc(f.id)}">
      <strong>${esc(f.titulo)}</strong>
      <small>${esc(f.produce || '')}</small>
      <div class="b-meta"><i>${num(f.nodos_total)} nodos</i><i>${f.lanes.length} carriles</i><i>${esc(f.area_nombre)}</i></div>
    </button>`;
  const vacias = filtro.area ? [] : sinFlujo;
  return `<p class="a-nota">Los ${D.flujos.length} procesos BPMN de la empresa, cada uno en el tablero de su área.
    Las áreas marcadas con línea punteada todavía no tienen flujo escrito: eso también es información.</p>
    ${tableroCartas(lista, tarjeta, vacias)}`;
}

function paginaFlujo(id) {
  const base = D.flujos.find((x) => x.id === id);
  if (!base) return '<div class="a-empty">No encontré ese flujo.</div>';
  const f = flujoEfectivo(base);
  const opts = { posiciones: posicionesDeEdicion(id) };
  const tiene = typeof window.BPMN !== 'undefined';
  const m = tiene ? window.BPMN.medir(f, opts) : { ancho: 900, alto: 520 };
  ultimoMontaje = { host: null, base };
  setTimeout(() => {
    const host = $('#view .a-board');
    if (!host || !tiene) return;
    ultimoMontaje.host = host;
    nodoSeleccionado = null;
    const t = Tablero(host, {
      canPan: (ev) => !editando || !ev.target.closest('[data-nodo]'),
    });
    const actual = flujoEfectivo(base);
    const actualOpts = { posiciones: posicionesDeEdicion(base.id) };
    t.mundo.innerHTML = window.BPMN.dibujar(actual, actualOpts);
    t.mundo.style.width = `${m.ancho}px`;
    t.mundo.style.height = `${m.alto}px`;
    activarEdicionNodos(host, base);
    detectarVault();
    requestAnimationFrame(() => t.encajar());
  }, 0);

  return `<div class="a-page a-page-fijo">
    <button class="a-back" data-ir="flujos">← Flujos</button>
    <div style="padding:18px 0 16px">
      <h2 style="margin:0 0 8px;font-family:var(--display);font-size:clamp(24px,2.6vw,38px);text-transform:uppercase;letter-spacing:-.04em;line-height:1">${esc(f.titulo)}</h2>
      <p class="a-nota" style="margin:0">${esc(f.produce || '')}</p>
    </div>
    <div class="a-split">
      <div class="a-board" data-board data-eje="y" data-minzoom="0.5">${tools()}${tiene ? '' : '<div class="a-empty">El renderer BPMN no está cargado.</div>'}</div>
      <aside class="a-panel">
        <section class="orchid">
          <h3 style="color:var(--blanco)">El flujo</h3>
          <p style="color:rgba(255,255,243,.9)">${num(f.nodos_total)} nodos · ${f.lanes.length} carriles · área ${esc(f.area_nombre)}</p>
        </section>
        <section>
          <h3>Editar</h3>
          <div class="a-btns">
            <button class="a-btn ${editando ? 'primario' : ''}" data-edit-toggle>${editando ? 'Cerrar el editor' : 'Editar este flujo'}</button>
          </div>
          <div id="vault-actions" data-flujo-id="${esc(base.id)}"></div>
          ${editando ? panelEditor(base, f) : '<p>Los cambios se quedan en este navegador. Se pueden descargar como JSON para llevarlos al vault.</p>'}
        </section>
        <section>
          <h3>Cómo leerlo</h3>
          <div class="a-legend">
            <span><i style="background:#4ea0ff"></i>inicio</span>
            <span><i style="background:#ded116"></i>fin</span>
            <span><i style="background:#3d6ee0"></i>tarea</span>
            <span><i style="background:#e0a12a"></i>decisión</span>
            <span><i style="background:#e05252"></i>hueco</span>
          </div>
        </section>
        <section>
          <h3>Carriles</h3>
          <div class="a-rows">${(f.lanes || []).map((l) => `<div class="a-row"><div><small>${esc(l)}</small></div></div>`).join('')}</div>
        </section>
        ${f.anotaciones.length ? `<section><h3>Anotaciones</h3><div class="a-anot">${f.anotaciones.map((a) => `<div>${esc(a.texto)}</div>`).join('')}</div></section>` : ''}
      </aside>
    </div>
  </div>`;
}

/* ---------- esquemas (mapa maestro) ---------- */
function vistaEsquemas() {
  const areas = D.areas.filter((a) => a.grupo === 'empresa');
  const otros = areaOtros();
  const total = areas.filter((a) => a.flujos.length + a.esquemas.length).length + (otros.flujos.length + otros.esquemas.length ? 1 : 0);
  return `<div class="a-filtros" style="position:static;padding:0 0 14px">
      <span class="a-chip" style="pointer-events:none;border-style:dashed">${abiertas.size} de ${total} ramas abiertas</span>
      <button class="a-chip" data-arbol-todo aria-pressed="${abiertas.size === total}">Abrir todo</button>
      <button class="a-chip limpiar" data-arbol-plegar>Cerrar ramas</button>
    </div>
    ${arbolEsquemas()}`;
}

function paginaEsquema(id) {
  const e = D.esquemas.find((x) => x.id === id);
  if (!e) return '<div class="a-empty">No encontré ese esquema.</div>';
  const flujo = e.flujo ? D.flujos.find((f) => f.id === e.flujo) : null;
  const tiene = typeof window.BPMN !== 'undefined';
  if (flujo && tiene) {
    const m = window.BPMN.medir(flujo);
    setTimeout(() => {
      const host = $('#view .a-board');
      if (!host) return;
      const t = Tablero(host);
      t.mundo.innerHTML = window.BPMN.dibujar(flujo);
      t.mundo.style.width = `${m.ancho}px`;
      t.mundo.style.height = `${m.alto}px`;
      activarEdicionNodos(host, flujo);
      requestAnimationFrame(() => t.encajar());
    }, 0);
  }
  const fragmentos = `<div class="a-frag">${e.variantes
    .map((v) => `<figure><img loading="lazy" src="${miniatura(v.id, 320)}" alt=""><figcaption>${esc(v.vista)}</figcaption></figure>`)
    .join('')}</div>`;

  return `<div class="a-page a-page-fijo">
    <button class="a-back" data-ir="esquemas">← Esquemas</button>
    <div style="padding:18px 0 16px">
      <h2 style="margin:0 0 8px;font-family:var(--display);font-size:clamp(24px,2.6vw,38px);text-transform:uppercase;letter-spacing:-.04em;line-height:1">${esc(e.nombre)}</h2>
      <p class="a-nota" style="margin:0">${esc(e.area_nombre)} · ${e.variantes.length} vistas · ${bytes(e.bytes)}</p>
    </div>
    <div class="a-split">
      ${flujo && tiene ? `<div class="a-board" data-board data-eje="y" data-minzoom="0.5">${tools()}</div>` : `<div style="overflow:auto;border-right:1px solid var(--linea)">${fragmentos}</div>`}
      <aside class="a-panel">
        <section class="orchid">
          <h3 style="color:var(--blanco)">Qué es</h3>
          <p style="color:rgba(255,255,243,.9)">${flujo ? `Tiene su flujo: ${esc(flujo.titulo)}.` : 'Son los nodos sueltos con los que la bóveda arma los tableros.'}</p>
        </section>
        <section>
          <h3>Vistas</h3>
          <div class="a-btns">${e.variantes.map((v) => `<a class="a-btn" href="${drive(v.id)}" target="_blank" rel="noopener">${esc(v.vista)} ↗</a>`).join('')}</div>
        </section>
        <section>
          <h3>Abrir</h3>
          <div class="a-btns">
            ${flujo ? `<button class="a-btn primario" data-ir="flujo" data-id="${esc(flujo.id)}">Ver el flujo</button>` : ''}
            ${e.nota ? `<a class="a-btn" href="${drive(e.nota.id)}" target="_blank" rel="noopener">Ver la nota ↗</a>` : ''}
          </div>
        </section>
      </aside>
    </div>
  </div>`;
}

function panelEditor(base, f) {
  const filas = f.nodos
    .map(
      (n) => `<details class="ed-nodo">
        <summary><b>${esc(n.nombre || n.sim || n.tipo)}</b><span>${esc(n.tipo)}</span></summary>
        <label>Nombre<input data-campo="nombre" data-nodo="${esc(n.id)}" value="${esc(n.nombre || '')}"></label>
        <label>Texto<input data-campo="texto" data-nodo="${esc(n.id)}" value="${esc(n.texto || '')}"></label>
        <label>Marca
          <select data-campo="color" data-nodo="${esc(n.id)}">
            <option value="" ${!n.color ? 'selected' : ''}>sin marca</option>
            <option value="#ff5c46" ${n.color === '#ff5c46' ? 'selected' : ''}>hueco</option>
            <option value="#ded116" ${n.color === '#ded116' ? 'selected' : ''}>mostaza</option>
            <option value="#eb076d" ${n.color === '#eb076d' ? 'selected' : ''}>fucsia</option>
          </select>
        </label>
        <button class="a-btn" data-edit-borrar="${esc(n.id)}">Borrar nodo</button>
      </details>`,
    )
    .join('');
  return `<div class="a-editor">
    <label>Título del flujo<input data-campo="titulo" value="${esc(f.titulo)}"></label>
    <label>Qué produce<input data-campo="produce" value="${esc(f.produce || '')}"></label>
    ${filas}
    <div class="a-btns">
      <button class="a-btn mostaza" data-edit-agregar>+ Agregar tarea</button>
      <button class="a-btn" data-edit-export>Descargar JSON</button>
      <button class="a-btn" data-edit-descartar>Descartar cambios</button>
    </div>
  </div>`;
}

let ordenDocs = { campo: 'modificado', dir: -1 };

function vistaExplorar() {
  const areas = D.areas.filter((a) => a.documentos > 0).sort((a, b) => b.documentos - a.documentos);
  const total = D.kpis.documentos;
  const sel = filtro.area || null;
  const area = areas.find((a) => a.id === sel) || null;

  const rail = areas
    .map((a) => {
      const pct = Math.max(2, Math.round((a.documentos / total) * 100));
      return `<button class="ex-item" data-area="${esc(a.id)}" aria-pressed="${sel === a.id}">
        <span class="ex-nombre">${esc(a.nombre)}</span>
        <span class="ex-num">${num(a.documentos)}</span>
        <span class="ex-barra" style="width:${pct}%"></span>
      </button>`;
    })
    .join('');

  // Base: área + búsqueda de texto.
  const base = D.documentos
    .filter((d) => (sel ? d.area === sel : true))
    .filter((d) => coincide(d.nombre + ' ' + d.ruta));

  // Los archivos técnicos se ocultan por defecto; el toggle los revela.
  const escondeTecnicos = base.filter((d) => !esTecnico(d));
  const visibles = mostrarTecnicos ? base : escondeTecnicos;
  const ocultos = base.length - escondeTecnicos.length;

  // Conteo por tipo para los chips, sobre lo que ahora se ve.
  const porTipo = {};
  for (const d of visibles) porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1;
  const tiposOrdenados = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);

  const lista = filtro.tipo ? visibles.filter((d) => d.tipo === filtro.tipo) : visibles;

  const { campo, dir } = ordenDocs;
  lista.sort((a, b) => {
    if (a.nombre.startsWith('.') !== b.nombre.startsWith('.')) return a.nombre.startsWith('.') ? 1 : -1;
    const va = campo === 'bytes' ? a.bytes : String(a[campo] || '').toLowerCase();
    const vb = campo === 'bytes' ? b.bytes : String(b[campo] || '').toLowerCase();
    return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
  });
  const tope = 200;

  const filas = lista.slice(0, tope).map((d) => {
    const feo = UUID_RE.test(d.nombre);
    const etiqueta = feo ? d.nombre.slice(0, 8) + '…' : d.nombre;
    return `<a class="ex-doc ${esTecnico(d) ? 'tecnico' : ''}" href="${drive(d.id)}" target="_blank" rel="noopener" title="${esc(d.ruta)}">
      <span class="ex-tipo">${esc(TIPO_ICONO[d.tipo] || d.tipo)}</span>
      <span class="ex-doc-nombre">${esc(etiqueta)}</span>
      <span class="ex-doc-area">${sel ? '' : esc(d.area_nombre)}</span>
      <span class="ex-doc-fecha">${fecha(d.modificado)}</span>
      <span class="ex-doc-peso">${bytes(d.bytes)}</span>
    </a>`;
  }).join('');

  const orden = (c, etiqueta) =>
    `<button class="a-chip" data-orden="${c}" aria-pressed="${campo === c}">${etiqueta}${campo === c ? (dir === 1 ? ' ↑' : ' ↓') : ''}</button>`;

  const chipTipo = (valor, etiqueta, cuenta) =>
    `<button class="a-chip" data-tipo="${valor}" aria-pressed="${filtro.tipo === valor}">${esc(etiqueta)} <span class="n">${num(cuenta)}</span></button>`;

  return `<div class="ex">
    <aside class="ex-rail" aria-label="Áreas">
      <button class="ex-item ${sel ? '' : 'activo'}" data-area="" aria-pressed="${!sel}">
        <span class="ex-nombre">Todo el Drive</span><span class="ex-num">${num(total)}</span>
      </button>
      ${rail}
    </aside>
    <section class="ex-main">
      <header class="ex-cab">
        <div>
          <h2>${esc(area ? area.nombre : 'Todo el Drive')}</h2>
          <p>${num(lista.length)} documentos${filtro.tipo ? ` · tipo ${esc(filtro.tipo)}` : ''}${ocultos && !mostrarTecnicos ? ` · ${num(ocultos)} técnicos ocultos` : ''}${area ? ` · ${num(area.carpetas)} carpetas · actualizado ${fecha(area.ultima)}` : ''}</p>
        </div>
        <div class="ex-acciones">
          ${ocultos ? `<button class="a-btn ${mostrarTecnicos ? 'primario' : ''}" data-tecnicos aria-pressed="${mostrarTecnicos}">${mostrarTecnicos ? 'Ocultar técnicos' : `Ver técnicos (${num(ocultos)})`}</button>` : ''}
          ${area ? `<button class="a-btn primario" data-ir="area" data-id="${esc(area.id)}">Abrir el área</button>` : ''}
          ${area && area.flujos.length ? `<button class="a-btn mostaza" data-ir="flujo" data-id="${esc(area.flujos[0])}">Ver el proceso</button>` : ''}
          ${area ? `<button class="a-btn" data-arbol-area-ir="${esc(area.id)}">Ver en el árbol</button>` : ''}
        </div>
      </header>
      <div class="ex-orden">
        ${chipTipo('', 'Todo', visibles.length)}
        ${tiposOrdenados.map(([t, n]) => chipTipo(t, TIPO_ICONO[t] || t, n)).join('')}
        <span class="ex-sep"></span>
        ${orden('nombre', 'Nombre')}${orden('modificado', 'Fecha')}${orden('bytes', 'Peso')}
        <label class="ex-filtrar">
          <span class="a-sr">Filtrar esta lista</span>
          <input id="ex-q" type="text" placeholder="Filtrar esta lista…" value="${esc(filtro.q)}" autocomplete="off">
        </label>
      </div>
      <div class="ex-lista">${filas || '<div class="a-empty"><p>Nada con ese filtro.</p><button class="a-btn" data-limpiar-filtro>Mostrar todos los documentos</button></div>'}</div>
      ${lista.length > tope ? `<p class="a-nota">Mostrando los primeros ${tope} de ${num(lista.length)}.</p>` : ''}
    </section>
  </div>`;
}

function vistaDuplicados() {
  const k = D.kpis;
  return `<section class="a-sec">
    <h2>El mismo archivo en varias carpetas <span>${num(k.duplicados_md5)} grupos · ${num(k.copias_extra)} copias de más</span></h2>
    <p class="a-nota">Es un solo Drive: lo que hay son archivos idénticos guardados en varias rutas (mismo contenido,
      mismo <code>md5</code>). Atlas los muestra tal como están y no borra nada.</p>
    <div class="a-rows">${D.duplicados.slice(0, 40).map((g) => `<div class="a-row">
        <div><strong>${esc(g.nombre)}</strong>
          <small>${esc(g.copias.slice(0, 3).join('  ·  '))}${g.copias.length > 3 ? `  ·  +${g.copias.length - 3} más` : ''}</small></div>
        <div class="a-row-side">${g.copias.length} copias</div></div>`).join('')}</div>
  </section>`;
}

/* ============================ paleta de búsqueda ============================ */
let paletaSel = 0;
let paletaItems = [];

function itemsPaleta() {
  const q = $('#paleta-q').value.trim().toLowerCase();
  if (!q) {
    return [
      ...D.clientes.slice(0, 4).map((c) => ({ tipo: 'Cliente', nombre: c.nombre, meta: `${num(c.documentos)} docs`, vista: 'cliente', id: c.id })),
      ...D.flujos.slice(0, 4).map((f) => ({ tipo: 'Flujo', nombre: f.titulo, meta: f.area_nombre, vista: 'flujo', id: f.id })),
      ...D.esquemas.slice(0, 4).map((e) => ({ tipo: 'Esquema', nombre: e.nombre, meta: e.area_nombre, vista: 'esquema', id: e.id })),
    ];
  }
  const buscar = (texto) => texto.toLowerCase().includes(q);
  const items = [];
  for (const c of D.clientes) if (buscar(c.nombre) && items.length < 14) items.push({ tipo: 'Cliente', nombre: c.nombre, meta: `${num(c.documentos)} docs`, vista: 'cliente', id: c.id });
  for (const f of D.flujos) if (buscar(f.titulo + ' ' + f.area_nombre) && items.length < 22) items.push({ tipo: 'Flujo', nombre: f.titulo, meta: f.area_nombre, vista: 'flujo', id: f.id });
  for (const e of D.esquemas) if (buscar(e.nombre) && items.length < 30) items.push({ tipo: 'Esquema', nombre: e.nombre, meta: e.area_nombre, vista: 'esquema', id: e.id });
  for (const d of D.documentos) {
    if (items.length >= 44) break;
    if (buscar(d.nombre + ' ' + d.ruta)) items.push({ tipo: 'Documento', nombre: d.nombre, meta: d.ruta, vista: 'documento', id: d.id, url: drive(d.id) });
  }
  return items;
}

function pintarPaleta() {
  paletaItems = itemsPaleta();
  paletaSel = Math.min(paletaSel, Math.max(0, paletaItems.length - 1));
  const caja = $('#paleta-res');
  if (!paletaItems.length) { caja.innerHTML = '<div class="a-paleta-vacio">Nada con eso.</div>'; return; }
  caja.innerHTML = paletaItems.map((it, i) => `<button class="a-paleta-item" data-paleta="${i}" aria-selected="${i === paletaSel}">
      <span class="tipo">${esc(it.tipo)}</span>
      <span class="nombre">${esc(it.nombre)}</span>
      <span class="meta">${esc(it.meta)}</span>
    </button>`).join('');
}

let focoPrevio = null;

function focusablesEn(root) {
  return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
    .filter((el) => el.offsetParent !== null);
}

function focoTrap(dialogo, ev) {
  const lista = focusablesEn(dialogo);
  if (!lista.length) return;
  const primero = lista[0];
  const ultimo = lista[lista.length - 1];
  if (ev.shiftKey) {
    if (document.activeElement === primero || !dialogo.contains(document.activeElement)) {
      ultimo.focus();
      ev.preventDefault();
    }
  } else {
    if (document.activeElement === ultimo || !dialogo.contains(document.activeElement)) {
      primero.focus();
      ev.preventDefault();
    }
  }
}

function abrirPaleta() {
  focoPrevio = document.activeElement;
  $('#paleta').hidden = false;
  $('#paleta-q').value = '';
  paletaSel = 0;
  pintarPaleta();
  $('#paleta-q').focus();
}

function cerrarPaleta() {
  $('#paleta').hidden = true;
  if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
}

function abrirAyuda() {
  focoPrevio = document.activeElement;
  $('#ayuda').hidden = false;
  $('#ayuda').focus();
}

function cerrarAyuda() {
  $('#ayuda').hidden = true;
  if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
}

function elegirPaleta(idx) {
  const it = paletaItems[idx];
  if (!it) return;
  cerrarPaleta();
  if (it.vista === 'documento') { window.open(it.url, '_blank', 'noopener'); return; }
  ir(it.vista, it.id);
}

/* ============================ navegación ============================ */
const NAV = [
  { id: 'general', ico: '◆', etiqueta: 'Inicio' },
  { id: 'areas', ico: '⊞', etiqueta: 'Áreas', cuenta: (d) => d.areas.filter((a) => a.grupo === 'empresa').length },
  { id: 'clientes', ico: '☰', etiqueta: 'Clientes', cuenta: (d) => d.clientes.filter((c) => c.estado !== 'interno').length },
  { id: 'flujos', ico: '⇢', etiqueta: 'Procesos', cuenta: (d) => d.flujos.length },
  { id: 'explorar', ico: '▤', etiqueta: 'Explorar', cuenta: (d) => d.kpis.documentos },
];

const HERRAMIENTAS = [
  { id: 'esquemas', ico: '⌗', etiqueta: 'Mapa de esquemas', cuenta: (d) => d.esquemas.length },
  { id: 'duplicados', ico: '⧉', etiqueta: 'Archivos duplicados', cuenta: (d) => d.kpis.duplicados_md5 },
];

const SUBTITULO = {
  general: 'Todo lo que hay en el Drive de la empresa, en una pantalla',
  areas: 'La estructura de la empresa: cada área con todo lo suyo en un solo lugar',
  area: 'Todo lo de esta área junto: flujos, esquemas y documentos',
  clientes: 'Clientes activos, ex clientes y prototipos',
  flujos: 'Los procesos de la empresa en formato BPMN, en un tablero',
  esquemas: 'La empresa entera en un solo gráfico, con sus esquemas',
  explorar: 'Áreas y documentos en un solo lugar: elegí un área y ves lo suyo',
  duplicados: 'El mismo archivo repetido en varias carpetas: se muestra, no se borra',
};

const PINTAR = {
  general: vistaGeneral,
  areas: vistaAreas,
  area: paginaArea,
  clientes: vistaClientes,
  flujos: vistaFlujos,
  esquemas: vistaEsquemas,
  explorar: vistaExplorar,
  duplicados: vistaDuplicados,
};

function coincide(texto) {
  const q = filtro.q.trim().toLowerCase();
  return !q || String(texto).toLowerCase().includes(q);
}

function areasParaFiltro() {
  if (ruta.vista === 'flujos') return D.areas.filter((a) => a.grupo === 'empresa');

  return [];
}

function pintarFiltros() {
  const caja = $('#filtros');
  if (!caja) return;
  const areas = areasParaFiltro();
  if (!areas.length) { caja.hidden = true; return; }
  caja.hidden = false;
  const cuenta = (a) => (ruta.vista === 'flujos' ? a.flujos.length : a.documentos);
  caja.innerHTML = `
    <button class="a-chip limpiar" data-area="" aria-pressed="${!filtro.area}">Ver todo</button>
    ${areas.map((a) => `<button class="a-chip" data-area="${esc(a.id)}" aria-pressed="${filtro.area === a.id}">
      ${esc(a.nombre)} <span class="n">${num(cuenta(a))}</span></button>`).join('')}`;
}

function pintarRail() {
  $('#nav').innerHTML =
    NAV.map((n) => `<button data-ir="${n.id}" aria-current="${ruta.vista === n.id || ruta.vista === n.id.replace(/s$/, '')}">
        <span class="ico">${n.ico}</span><span class="lbl">${n.etiqueta}</span>
        <span class="num">${n.cuenta ? num(n.cuenta(D)) : ''}</span></button>`).join('');
  $('#rail-foot').innerHTML = `
    <div class="a-rail-tools" aria-label="Herramientas">
      <span>Herramientas</span>
      ${HERRAMIENTAS.map((n) => `<button data-ir="${n.id}" aria-current="${ruta.vista === n.id || ruta.vista === n.id.replace(/s$/, '')}">
        <i>${n.ico}</i><b>${n.etiqueta}</b><em>${num(n.cuenta(D))}</em></button>`).join('')}
    </div>
    <div>cursor <b>${esc(D.kpis.cursor || '—')}</b></div>
    <div>sync <b>${fecha(D.kpis.ultima_sincronizacion)}</b></div>
    <img class="marca" src="assets/simbolo-blanco.png" alt="RR Aliados">`;
}

const TITULO = {
  general: 'General', areas: 'Áreas', area: 'Área', clientes: 'Clientes', cliente: 'Cliente', flujos: 'Flujos', flujo: 'Flujo',
  esquemas: 'Esquemas', esquema: 'Esquema', explorar: 'Explorar', duplicados: 'Duplicados',
};

const MIGAS = {
  area: { padre: 'areas', texto: 'Áreas' },
  cliente: { padre: 'clientes', texto: 'Clientes' },
  flujo: { padre: 'flujos', texto: 'Flujos' },
  esquema: { padre: 'esquemas', texto: 'Esquemas' },
};

function pintarCabecera() {
  const miga = MIGAS[ruta.vista];
  if (!miga) {
    $('#titulo').textContent = TITULO[ruta.vista] || 'Atlas';
    $('#subtitulo').textContent = SUBTITULO[ruta.vista] || '';
    return;
  }
  const nombre =
    ruta.vista === 'cliente' ? D.clientes.find((c) => c.id === ruta.id)?.nombre
      : ruta.vista === 'flujo' ? D.flujos.find((f) => f.id === ruta.id)?.titulo
        : ruta.vista === 'area' ? D.areas.find((a) => a.id === ruta.id)?.nombre
          : D.esquemas.find((e) => e.id === ruta.id)?.nombre;
  $('#titulo').innerHTML = `<a class="a-miga" data-ir="${miga.padre}">${miga.texto}</a><span class="a-miga-sep">/</span>${esc(nombre || '—')}`;
  $('#subtitulo').textContent = SUBTITULO[miga.padre] || '';
}

function render() {
  pintarCabecera();
  $$('#nav button[data-ir]').forEach((b) =>
    b.setAttribute('aria-current', String(b.dataset.ir === ruta.vista || `${b.dataset.ir}` === `${ruta.vista}s`)));
  let html;
  if (ruta.vista === 'cliente') html = paginaCliente(ruta.id);
  else if (ruta.vista === 'area') html = paginaArea(ruta.id);
  else if (ruta.vista === 'flujo') html = paginaFlujo(ruta.id);
  else if (ruta.vista === 'esquema') html = paginaEsquema(ruta.id);
  else html = PINTAR[ruta.vista] ? PINTAR[ruta.vista]() : '<div class="a-empty">Vista desconocida.</div>';

  $('#view').innerHTML = '<div class="a-filtros" id="filtros" hidden></div>' + html;
  pintarFiltros();

  const host = $('#view .a-board');
  tablero = null;
  if (host && !['flujo', 'esquema'].includes(ruta.vista)) {
    tablero = Tablero(host);
    requestAnimationFrame(() => {
      tablero.encajar();
      if (ramaY) { tablero.centrarEn(ramaY); ramaY = 0; }
    });
  }
  $('#view').scrollTop = 0;
}

function ir(vista, id = null, reemplazar = false) {
  ruta = { vista, id };
  filtro.area = vista === 'explorar' && id ? id : null;
  filtro.q = '';
  filtro.tipo = null;
  const buscador = $('#q');
  if (buscador) buscador.value = '';
  editando = false;
  ultimoMontaje = null;
  const hash = id ? `#${vista}/${id}` : `#${vista}`;
  if (location.hash !== hash) {
    if (reemplazar) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
  }
  try { localStorage.setItem('atlas:ruta', hash); } catch { /* modo privado */ }
  render();
}

/* ============================ eventos ============================ */
function conectar() {
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-abrir-paleta]')) { abrirPaleta(); return; }

    const zoom = ev.target.closest('[data-zoom]');
    if (zoom) {
      const host = zoom.closest('[data-board]');
      const api = host && host.__tablero;
      if (api) {
        if (zoom.dataset.zoom === 'in') api.zoom(1.25);
        else if (zoom.dataset.zoom === 'out') api.zoom(0.8);
        else api.encajar(true);
      }
      return;
    }

    const irBtn = ev.target.closest('[data-ir]');
    if (irBtn) {
      if (irBtn.classList.contains('arrastrando')) { irBtn.classList.remove('arrastrando'); ev.preventDefault(); return; }
      const area = irBtn.dataset.area || null;
      ir(irBtn.dataset.ir, irBtn.dataset.id || null);
      if (area) { filtro.area = area; render(); }
      return;
    }

    const rama = ev.target.closest('[data-arbol-area]');
    if (rama) {
      const id = rama.dataset.arbolArea;
      ramaY = Number(rama.dataset.y || 0);
      if (abiertas.has(id)) abiertas.delete(id);
      else abiertas.add(id);
      history.replaceState(null, '', abiertas.size ? `#esquemas/${id}` : '#esquemas');
      render();
      return;
    }
    if (ev.target.closest('[data-arbol-plegar]')) {
      abiertas.clear();
      history.replaceState(null, '', '#esquemas');
      render();
      return;
    }
    if (ev.target.closest('[data-arbol-todo]')) {
      for (const a of D.areas) {
        if (a.grupo === 'empresa' && a.flujos.length + a.esquemas.length) abiertas.add(a.id);
      }
      const otros = areaOtros();
      if (otros.flujos.length + otros.esquemas.length) abiertas.add(otros.id);
      history.replaceState(null, '', '#esquemas/todas');
      render();
      return;
    }
    const verEnArbol = ev.target.closest('[data-arbol-area-ir]');
    if (verEnArbol) {
      abiertas.add(verEnArbol.dataset.arbolAreaIr);
      ir('esquemas');
      return;
    }
    const hojaFlujo = ev.target.closest('[data-arbol-flujo]');
    if (hojaFlujo) { ir('flujo', hojaFlujo.dataset.arbolFlujo); return; }
    const hojaEsq = ev.target.closest('[data-arbol-esquema]');
    if (hojaEsq) { ir('esquema', hojaEsq.dataset.arbolEsquema); return; }

    if (ev.target.closest('[data-edit-toggle]')) {
      editando = !editando;
      history.replaceState(null, '', editando ? `#flujo/${ruta.id}/editar` : `#flujo/${ruta.id}`);
      render();
      return;
    }
    if (ev.target.closest('[data-edit-agregar]')) {
      snapshotEdiciones();
      const e = edicionDe(ruta.id);
      const f = flujoEfectivo(D.flujos.find((x) => x.id === ruta.id));
      e.nuevos.push({
        id: `n_${Date.now().toString(36)}`,
        tipo: 'tarea',
        nombre: 'Nueva tarea',
        texto: '',
        carril: f.lanes[0] || 'General',
      });
      guardarEdiciones(); render(); setTimeout(actualizarAccionesVault, 0); return;
    }
    const borrar = ev.target.closest('[data-edit-borrar]');
    if (borrar) {
      snapshotEdiciones();
      const e = edicionDe(ruta.id);
      e.borrados.push(borrar.dataset.editBorrar);
      delete e.nodos[borrar.dataset.editBorrar];
      guardarEdiciones(); render(); setTimeout(actualizarAccionesVault, 0); return;
    }
    if (ev.target.closest('[data-edit-descartar]')) {
      snapshotEdiciones();
      delete ediciones[ruta.id];
      guardarEdiciones(); render(); setTimeout(actualizarAccionesVault, 0); return;
    }
    if (ev.target.closest('[data-edit-export]')) {
      const f = flujoEfectivo(D.flujos.find((x) => x.id === ruta.id));
      const blob = new Blob([JSON.stringify({ flujo: ruta.id, ...f }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${ruta.id}.editado.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    const guardar = ev.target.closest('[data-edit-guardar]');
    if (guardar) {
      guardarEnVault(guardar.dataset.editGuardar);
      return;
    }

    const orden = ev.target.closest('[data-orden]');
    if (orden) {
      ordenDocs = ordenDocs.campo === orden.dataset.orden
        ? { campo: orden.dataset.orden, dir: -ordenDocs.dir }
        : { campo: orden.dataset.orden, dir: 1 };
      render();
      return;
    }

    const chipTipo = ev.target.closest('[data-tipo]');
    if (chipTipo) {
      const t = chipTipo.dataset.tipo || null;
      filtro.tipo = (t && filtro.tipo === t) ? null : t;
      render();
      return;
    }

    if (ev.target.closest('[data-tecnicos]')) {
      mostrarTecnicos = !mostrarTecnicos;
      try { localStorage.setItem('atlas:explorar:tecnicos', mostrarTecnicos ? '1' : '0'); } catch { /* modo privado */ }
      render();
      return;
    }

    const copiar = ev.target.closest('[data-copiar]');
    if (copiar) {
      const url = copiar.dataset.copiar;
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      copiar.textContent = '✓';
      setTimeout(() => { copiar.textContent = '⧉'; }, 1200);
      return;
    }

    const itemPaleta = ev.target.closest('[data-paleta]');
    if (itemPaleta) { elegirPaleta(Number(itemPaleta.dataset.paleta)); return; }

    const cardDrag = ev.target.closest('[data-drag-id]');
    if (cardDrag && cardDrag.classList.contains('fue-arrastrado')) {
      cardDrag.classList.remove('fue-arrastrado');
      ev.preventDefault();
      return;
    }

    const chip = ev.target.closest('[data-area]');
    if (chip) {
      filtro.area = chip.dataset.area || null;
      const hash = filtro.area ? `#explorar/${filtro.area}` : '#explorar';
      history.replaceState(null, '', hash);
      render();
      return;
    }
    if (ev.target.closest('[data-limpiar-filtro]')) {
      filtro.area = null;
      filtro.q = '';
      filtro.tipo = null;
      history.replaceState(null, '', ruta.vista === 'explorar' ? '#explorar' : '#flujos');
      render();
      return;
    }
  });

  const escribiendo = (el) => el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

  document.addEventListener('keydown', (ev) => {
    if (escribiendo(document.activeElement) && !(ev.ctrlKey || ev.metaKey)) return;
    if (ev.key === '?' && document.activeElement !== $('#q')) { if ($('#ayuda').hidden) abrirAyuda(); else cerrarAyuda(); ev.preventDefault(); return; }
    if (ev.key === 'Escape' && !$('#ayuda').hidden) { cerrarAyuda(); ev.preventDefault(); return; }
    if (ev.key === 'Escape' && nodoSeleccionado) { seleccionarNodo(null); ev.preventDefault(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); abrirPaleta(); return; }
    if (!$('#paleta').hidden) {
      if (ev.key === 'Escape') { cerrarPaleta(); ev.preventDefault(); return; }
      if (ev.key === 'Tab') { focoTrap($('#paleta'), ev); return; }
      if (ev.key === 'ArrowDown') { paletaSel = Math.min(paletaSel + 1, paletaItems.length - 1); pintarPaleta(); ev.preventDefault(); return; }
      if (ev.key === 'ArrowUp') { paletaSel = Math.max(paletaSel - 1, 0); pintarPaleta(); ev.preventDefault(); return; }
      if (ev.key === 'Enter') { elegirPaleta(paletaSel); ev.preventDefault(); return; }
    }
    if (!$('#ayuda').hidden && ev.key === 'Tab') { focoTrap($('#ayuda'), ev); return; }
    if (ev.key === '/' && document.activeElement !== $('#q')) { ev.preventDefault(); abrirPaleta(); return; }
    if (document.activeElement === $('#q')) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) rehacer(); else deshacer();
      return;
    }
    if (editando && nodoSeleccionado && ultimoMontaje) {
      const paso = ev.shiftKey ? 20 : 4;
      let dx = 0, dy = 0;
      if (ev.key === 'ArrowLeft') dx = -paso;
      else if (ev.key === 'ArrowRight') dx = paso;
      else if (ev.key === 'ArrowUp') dy = -paso;
      else if (ev.key === 'ArrowDown') dy = paso;
      if (dx || dy) {
        ev.preventDefault();
        const pos = posicionNodoActual(ultimoMontaje.base, nodoSeleccionado);
        moverNodoAbs(ultimoMontaje.base.id, nodoSeleccionado, pos.x + dx, pos.y + dy);
        return;
      }
    }
    if (!tablero) return;
    if (ev.key === '+' || ev.key === '=') { tablero.zoom(1.2); ev.preventDefault(); }
    if (ev.key === '-') { tablero.zoom(0.83); ev.preventDefault(); }
    if (ev.key === '0') { tablero.encajar(true); ev.preventDefault(); }
  });

  let temporizador = null;
  document.addEventListener('input', (ev) => {
    const campo = ev.target.closest('[data-campo]');
    if (!campo) return;
    const e = edicionDe(ruta.id);
    const nodo = campo.dataset.nodo;
    if (nodo) {
      e.nodos[nodo] = { ...(e.nodos[nodo] || {}), [campo.dataset.campo]: campo.value };
    } else {
      e.campos[campo.dataset.campo] = campo.value;
    }
    guardarEdiciones();
    actualizarAccionesVault();
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { redibujarFlujo(); actualizarAccionesVault(); }, 350);
  });

  document.addEventListener('change', (ev) => {
    const campo = ev.target.closest('select[data-campo]');
    if (!campo) return;
    const e = edicionDe(ruta.id);
    e.nodos[campo.dataset.nodo] = { ...(e.nodos[campo.dataset.nodo] || {}), color: campo.value };
    guardarEdiciones();
    redibujarFlujo();
    actualizarAccionesVault();
  });

  $('#paleta-q').addEventListener('input', () => { paletaSel = 0; pintarPaleta(); });

  // La caja del header es la MISMA búsqueda global que Ctrl+K: al tocarla o escribir
  // abre la paleta (un solo modelo mental, S29). El filtrado de una lista larga vive
  // pegado a esa lista (Explorar), no compite en la cabecera.
  const cajaHeader = $('#q');
  const abrirDesdeHeader = () => { if ($('#paleta').hidden) abrirPaleta(); };
  cajaHeader.addEventListener('click', abrirDesdeHeader);
  cajaHeader.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey)) {
      ev.preventDefault();
      abrirDesdeHeader();
    }
  });

  // Filtrado inline de la lista de Explorar: re-renderiza solo la vista y devuelve
  // el foco al input para no perderlo mientras se escribe.
  document.addEventListener('input', (ev) => {
    if (ev.target.id !== 'ex-q') return;
    filtro.q = ev.target.value;
    render();
    requestAnimationFrame(() => {
      const el = $('#ex-q');
      if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* search */ } }
    });
  });

  window.addEventListener('popstate', aplicarRuta);

  $('#paleta').addEventListener('click', (ev) => {
    if (ev.target.id === 'paleta') cerrarPaleta();
  });
  $('#ayuda').addEventListener('click', (ev) => {
    if (ev.target.id === 'ayuda') cerrarAyuda();
  });
  $('#btn-buscar').addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      $('#q').parentElement.classList.toggle('abierto');
      if ($('#q').parentElement.classList.contains('abierto')) $('#q').focus();
    } else {
      abrirPaleta();
    }
  });
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('#btn-buscar');
    const search = $('#q')?.parentElement;
    if (search && search.classList.contains('abierto') && !btn && !search.contains(ev.target)) {
      search.classList.remove('abierto');
    }
    const cerrarAyudaBtn = ev.target.closest('[data-ayuda-cerrar]');
    if (cerrarAyudaBtn) { cerrarAyuda(); ev.preventDefault(); }
  });

  let dragId = null;
  let dragVista = null;
  document.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest('[data-drag-id]');
    if (!card) return;
    dragId = card.dataset.dragId;
    dragVista = card.dataset.dragVista || 'flujos';
    card.classList.add('arrastrando');
    ev.dataTransfer.effectAllowed = 'move';
    if (ev.dataTransfer.setData) ev.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragend', (ev) => {
    const card = ev.target.closest('[data-drag-id]');
    if (card) {
      card.classList.remove('arrastrando');
      card.classList.add('fue-arrastrado');
      setTimeout(() => card.classList.remove('fue-arrastrado'), 60);
    }
    $$('.soltar-antes,.soltar-despues,.soltar-dentro').forEach((el) => {
      el.classList.remove('soltar-antes', 'soltar-despues', 'soltar-dentro');
    });
    dragId = null;
    dragVista = null;
  });
  document.addEventListener('dragover', (ev) => {
    if (!dragId) return;
    const col = ev.target.closest('.b-col');
    const card = ev.target.closest('[data-drag-id]');
    $$('.soltar-antes,.soltar-despues,.soltar-dentro').forEach((el) => {
      el.classList.remove('soltar-antes', 'soltar-despues', 'soltar-dentro');
    });
    if (card && card.dataset.dragId !== dragId) {
      ev.preventDefault();
      const rect = card.getBoundingClientRect();
      const despues = ev.clientY > rect.top + rect.height / 2;
      card.classList.add(despues ? 'soltar-despues' : 'soltar-antes');
    } else if (col && !card) {
      ev.preventDefault();
      col.classList.add('soltar-dentro');
    }
  });
  document.addEventListener('drop', (ev) => {
    if (!dragId) return;
    const card = ev.target.closest('[data-drag-id]');
    const col = ev.target.closest('.b-col');
    if (card && card.dataset.dragId !== dragId) {
      ev.preventDefault();
      const rect = card.getBoundingClientRect();
      reordenarEn(dragVista, dragId, card.dataset.dragId, ev.clientY > rect.top + rect.height / 2);
    } else if (col) {
      ev.preventDefault();
      const ultima = col.querySelector('[data-drag-id]:last-of-type');
      if (ultima) reordenarEn(dragVista, dragId, ultima.dataset.dragId, true);
    }
  });
}

function reordenarEn(vista, dragId, targetId, despues) {
  const fuente = vista === 'clientes' ? D.clientes : D.flujos;
  const orden = fuente.map((x) => x.id);
  const idxDrag = orden.indexOf(dragId);
  const idxTarget = orden.indexOf(targetId);
  if (idxDrag === -1 || idxTarget === -1 || dragId === targetId) return;
  orden.splice(idxDrag, 1);
  let insertIdx = orden.indexOf(targetId);
  if (despues) insertIdx++;
  if (insertIdx < 0) insertIdx = orden.length;
  orden.splice(insertIdx, 0, dragId);
  guardarOrden(vista, orden);
  render();
}

/* ============================ rutas ============================ */
function aplicarRuta() {
  const partes = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
  let vista = VISTAS.includes(partes[0]) ? partes[0] : 'general';
  // rutas viejas
  if (partes[0] === 'documentos') vista = 'explorar';
  ruta = { vista, id: partes[1] || null };
  editando = partes[2] === 'editar';
  filtro.area = vista === 'explorar' ? partes[1] || null : null;
  filtro.tipo = null;
  if (vista === 'esquemas') {
    abiertas.clear();
    if (partes[1] === 'todas') {
      for (const a of D.areas) {
        if (a.grupo === 'empresa' && a.flujos.length + a.esquemas.length) abiertas.add(a.id);
      }
      const otros = areaOtros();
      if (otros.flujos.length + otros.esquemas.length) abiertas.add(otros.id);
    } else if (partes[1]) {
      abiertas.add(partes[1]);
    }
    ruta = { vista, id: null };
  }
  render();
}

/* ============================ arranque ============================ */
(async () => {
  try {
    D = await cargarDatos();
    pintarRail();
    conectar();
    if (!location.hash) {
      let guardada = '';
      try { guardada = localStorage.getItem('atlas:ruta') || ''; } catch { /* modo privado */ }
      if (guardada) history.replaceState(null, '', guardada);
    }
    aplicarRuta();
  } catch (err) {
    $('#view').innerHTML = `<div class="a-empty"><strong>No se pudieron leer los datos.</strong><br>${esc(err.message)}<br><br>
      Generá el archivo con <code>.venv/bin/python export_atlas_shell.py</code>.</div>`;
  }
})();
