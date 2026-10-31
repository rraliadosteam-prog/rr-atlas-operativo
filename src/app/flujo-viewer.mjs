// Visor de flujos v3 integrado en atlas-arbol-pro.
// Los datos se cargan desde /src/data/flujos-v3.local.json solo en builds --local;
// en builds públicos el visor existe pero no tiene flujos cargados.

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

let cache = null;

export async function loadFlujos() {
  if (cache) return cache;
  try {
    const res = await fetch('/src/data/flujos-v3.local.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache = data?.flujos ?? [];
  } catch {
    cache = [];
  }
  return cache;
}

export function clearFlujoCache() {
  cache = null;
}

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const tipoEmoji = {
  evento_inicio: '●',
  evento_fin: '◆',
  tarea: '▢',
  decision: '◈',
  hueco: '◉',
};

function renderMiniBpmn(f) {
  const lanes = f.lanes || [];
  const nodos = f.nodos || [];
  const conexiones = f.conexiones || [];
  const laneIndex = new Map(lanes.map((l, i) => [l, i]));
  const byLane = lanes.map(() => []);
  for (const n of nodos) {
    const idx = laneIndex.get(n.carril) ?? 0;
    byLane[idx].push(n);
  }
  // Calcular posiciones simples en grid
  const cellW = 220;
  const cellH = 70;
  const marginX = 40;
  const marginY = 60;
  const positions = new Map();
  byLane.forEach((list, li) => {
    list.forEach((n, i) => {
      positions.set(n.id, { x: marginX + i * cellW, y: marginY + li * cellH });
    });
  });
  const width = Math.max(600, marginX * 2 + Math.max(...byLane.map((l) => l.length), 1) * cellW);
  const height = marginY * 2 + lanes.length * cellH;
  const nodeHtml = nodos.map((n) => {
    const p = positions.get(n.id) ?? { x: 0, y: 0 };
    const emoji = tipoEmoji[n.tipo] ?? '▢';
    return `<div class="flujo-node flujo-node-${esc(n.tipo)}" style="left:${p.x}px;top:${p.y}px" title="${esc(n.nombre)}">
      <span class="flujo-node-ico">${emoji}</span>
      <span class="flujo-node-name">${esc(n.nombre)}</span>
    </div>`;
  }).join('');
  const lineHtml = conexiones.map((c) => {
    const a = positions.get(c.a);
    const b = positions.get(c.b);
    if (!a || !b) return '';
    return `<line x1="${a.x + 90}" y1="${a.y + 24}" x2="${b.x + 10}" y2="${b.y + 24}" />`;
  }).join('');
  const laneHtml = lanes.map((l, i) => `<div class="flujo-lane" style="top:${marginY + i * cellH - 16}px">${esc(l)}</div>`).join('');
  return `<div class="flujo-board" style="width:${width}px;height:${height}px">
    ${laneHtml}
    <svg class="flujo-edges" width="${width}" height="${height}"><defs><marker id="flujo-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6" fill="none" stroke="currentColor" stroke-width="1.2" /></marker></defs><g>${lineHtml}</g></svg>
    <div class="flujo-nodes">${nodeHtml}</div>
  </div>`;
}

export function renderFlujoPage(flujo) {
  const anotaciones = (flujo.anotaciones || []).map((a) => `<li>${esc(a.texto)}</li>`).join('') || '<li>Sin anotaciones.</li>';
  return `<div class="flujo-page">
    <nav class="flujo-nav">
      <a class="button button-outline" href="#top">← Volver al árbol</a>
      <span class="flujo-meta">${esc(flujo.nodos_total)} nodos · ${esc(flujo.lanes?.length || 0)} carriles · ${esc(flujo.area_nombre)}</span>
    </nav>
    <header class="flujo-header">
      <h1>${esc(flujo.titulo)}</h1>
      <p>${esc(flujo.produce || '')}</p>
    </header>
    <div class="flujo-canvas-wrap">${renderMiniBpmn(flujo)}</div>
    <section class="flujo-lanes-list">
      <h2>Carriles</h2>
      <ul>${(flujo.lanes || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </section>
    <section class="flujo-notes">
      <h2>Anotaciones</h2>
      <ul>${anotaciones}</ul>
    </section>
  </div>`;
}

function ensureStyles() {
  if ($('#flujo-viewer-styles')) return;
  const style = document.createElement('style');
  style.id = 'flujo-viewer-styles';
  style.textContent = `
    .flujo-view { position: fixed; inset: 0; z-index: 100; background: var(--fondo, #070001); color: var(--texto, #fffff3); overflow: auto; }
    .flujo-view .flujo-page { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .flujo-nav { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .flujo-meta { color: var(--apagado, #888); font-size: 14px; }
    .flujo-header { margin-bottom: 24px; }
    .flujo-header h1 { margin: 0 0 8px; font-size: clamp(26px, 3vw, 42px); text-transform: uppercase; letter-spacing: -0.03em; }
    .flujo-header p { margin: 0; color: var(--apagado, #888); }
    .flujo-canvas-wrap { overflow: auto; border: 1px solid var(--linea, #2a2a2a); border-radius: 8px; margin-bottom: 24px; }
    .flujo-board { position: relative; background: #0d0d0d; }
    .flujo-lane { position: absolute; left: 8px; font-size: 12px; color: var(--apagado, #888); white-space: nowrap; }
    .flujo-edges { position: absolute; inset: 0; pointer-events: none; }
    .flujo-edges line { stroke: var(--linea, #444); stroke-width: 1.5; marker-end: url(#flujo-arrow); }
    .flujo-nodes { position: absolute; inset: 0; }
    .flujo-node { position: absolute; width: 180px; background: #181818; border: 1px solid var(--linea, #333); border-radius: 6px; padding: 8px; display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .flujo-node-ico { font-size: 16px; flex-shrink: 0; }
    .flujo-node-name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .flujo-node-evento_inicio { border-color: #4ea0ff; }
    .flujo-node-evento_fin { border-color: #ded116; }
    .flujo-node-decision { border-color: #e0a12a; }
    .flujo-node-hueco { border-color: #e05252; }
    .flujo-lanes-list ul, .flujo-notes ul { padding-left: 20px; }
    .flujo-lanes-list li, .flujo-notes li { margin-bottom: 6px; }
    .flujo-empty { padding: 40px; text-align: center; color: var(--apagado, #888); }
  `;
  document.head.appendChild(style);
}

export async function mountFlujo(id, container) {
  await loadFlujos();
  const flujo = cache.find((f) => f.id === id);
  container.innerHTML = flujo
    ? renderFlujoPage(flujo)
    : '<div class="flujo-page"><div class="flujo-empty"><h1>Flujo no encontrado</h1><p>El id <code>' + esc(id) + '</code> no está cargado en este build.</p><a class="button button-outline" href="#top">← Volver al árbol</a></div></div>';
}

export function createFlujoContainer() {
  ensureStyles();
  let el = $('#flujo-view');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flujo-view';
    el.className = 'flujo-view';
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

export function showFlujoView(show) {
  const view = createFlujoContainer();
  const app = $('#rr-app');
  view.hidden = !show;
  if (app) app.hidden = show;
  if (!show) view.innerHTML = '';
}

export async function navigateToFlujo(id) {
  const view = createFlujoContainer();
  showFlujoView(true);
  await mountFlujo(id, view);
}
