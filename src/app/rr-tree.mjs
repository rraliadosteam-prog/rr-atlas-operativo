import { createRRGraph, processRows, statusLabels } from '../data/rr-tree.mjs';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));
const STORAGE_KEY = 'rr-atlas-arbol-v1';
const COLORS = { fuchsia: '#be076d', mustard: '#ded116', orchid: '#973d8f', ink: '#070001', ok: '#4f9d64', warn: '#ded116', off: '#be076d' };
const CANVAS_SIZE = { width: 3400, height: 2520 };

const app = $('#rr-app');
const canvas = $('[data-canvas]');
const canvasWrap = $('[data-canvas-wrap]');
const nodesLayer = $('[data-nodes]');
const edgeLayer = $('[data-edge-layer]');
const edgesSvg = $('[data-edges]');
const inspector = $('[data-inspector]');
const inspectorBody = $('[data-inspector-body]');
const inspectorTitle = $('[data-inspector-title]');
const searchInput = $('[data-search-input]');
const minimap = $('[data-minimap]');
const minimapBody = $('[data-minimap-body]');
const toastElement = $('[data-toast]');
const zoomOutput = $('[data-zoom]');

const state = { graph: null, selectedId: 'rr-labs', query: '', zoom: 0.58, panX: 0, panY: 32, linkMode: false, wiresVisible: true, history: [], future: [], dragging: null, panning: null };

const notify = (message) => {
  toastElement.textContent = message;
  toastElement.hidden = false;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { toastElement.hidden = true; }, 2600);
};

const graphSnapshot = () => clone(state.graph);
const save = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.graph)); } catch { notify('No se pudo guardar; exporta una copia JSON.'); }
};
const loadGraph = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createRRGraph();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('invalid');
    return parsed;
  } catch { return createRRGraph(); }
};
const nodeById = (id) => state.graph.nodes.find((node) => node.id === id) ?? null;
const visibleNodes = () => {
  const query = state.query.trim().toLocaleLowerCase();
  if (!query) return state.graph.nodes;
  return state.graph.nodes.filter((node) => [node.title, node.type, node.status, node.owner, node.bot, node.desc].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
};
const setTransform = () => {
  canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  zoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
};
const pushHistory = () => {
  state.history.push(graphSnapshot());
  if (state.history.length > 30) state.history.shift();
  state.future = [];
};
const commit = (mutator, message) => {
  pushHistory();
  mutator(state.graph);
  save();
  render();
  if (message) notify(message);
};

function createCard(node) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `node-card node-${node.type} tone-${node.color}${state.selectedId === node.id ? ' is-selected' : ''}`;
  card.dataset.id = node.id;
  card.style.left = `${node.x}px`;
  card.style.top = `${node.y}px`;
  card.style.setProperty('--tone', COLORS[node.color] ?? COLORS.fuchsia);
  card.setAttribute('aria-label', `${node.title}, ${node.type}, ${node.status}`);
  const meta = document.createElement('span');
  meta.className = 'node-meta';
  meta.textContent = node.type === 'process' ? node.shortTitle ?? 'Proceso' : node.type === 'stage' ? 'ETAPA' : node.type.toUpperCase();
  const title = document.createElement('strong');
  title.textContent = node.title;
  const status = document.createElement('span');
  status.className = 'node-status';
  status.textContent = node.status;
  const desc = document.createElement('span');
  desc.className = 'node-desc';
  desc.textContent = node.desc ?? '';
  card.append(meta, title, status, desc);

  card.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (state.linkMode) {
      if (state.selectedId && state.selectedId !== node.id) {
        const exists = state.graph.edges.some((edge) => edge.source === state.selectedId && edge.target === node.id);
        if (exists) notify('Ese enlace ya existe.');
        else commit((graph) => graph.edges.push({ source: state.selectedId, target: node.id, kind: 'cross' }), 'Enlace creado');
        state.linkMode = false;
        renderInspector();
      } else {
        state.selectedId = node.id;
        notify('Ahora selecciona el nodo de destino.');
      }
      return;
    }
    state.selectedId = node.id;
    state.dragging = { id: node.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y, moved: false };
    card.setPointerCapture(event.pointerId);
    renderInspector();
    render();
  });
  card.addEventListener('pointermove', (event) => {
    const drag = state.dragging;
    if (!drag || drag.id !== node.id) return;
    const nextX = Math.round(drag.originX + (event.clientX - drag.startX) / state.zoom);
    const nextY = Math.round(drag.originY + (event.clientY - drag.startY) / state.zoom);
    if (Math.abs(nextX - drag.originX) + Math.abs(nextY - drag.originY) > 3) drag.moved = true;
    card.style.left = `${nextX}px`;
    card.style.top = `${nextY}px`;
    node.x = nextX;
    node.y = nextY;
    renderEdges();
  });
  const finishDrag = () => {
    const drag = state.dragging;
    if (!drag || drag.id !== node.id) return;
    state.dragging = null;
    if (drag.moved) { pushHistory(); save(); render(); }
  };
  card.addEventListener('pointerup', finishDrag);
  card.addEventListener('pointercancel', finishDrag);
  card.addEventListener('click', (event) => {
    if (state.dragging?.moved) event.preventDefault();
    state.selectedId = node.id;
    renderInspector();
  });
  return card;
}

function renderEdges() {
  edgeLayer.replaceChildren();
  edgesSvg.setAttribute('viewBox', `0 0 ${CANVAS_SIZE.width} ${CANVAS_SIZE.height}`);
  edgesSvg.setAttribute('width', String(CANVAS_SIZE.width));
  edgesSvg.setAttribute('height', String(CANVAS_SIZE.height));
  if (!state.wiresVisible) return;
  const visible = new Set(visibleNodes().map((node) => node.id));
  state.graph.edges.forEach((edge) => {
    if (!visible.has(edge.source) || !visible.has(edge.target)) return;
    const source = nodeById(edge.source);
    const target = nodeById(edge.target);
    if (!source || !target) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const x1 = source.x + 105;
    const y1 = source.y + 116;
    const x2 = target.x + 105;
    const y2 = target.y;
    const curve = Math.max(48, Math.abs(y2 - y1) * 0.38);
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + curve}, ${x2} ${y2 - curve}, ${x2} ${y2}`);
    path.setAttribute('class', `edge edge-${edge.kind ?? 'hierarchy'}${source.id === state.selectedId || target.id === state.selectedId ? ' edge-active' : ''}`);
    path.dataset.source = source.id;
    path.dataset.target = target.id;
    edgeLayer.appendChild(path);
  });
}

function renderMinimap() {
  minimapBody.replaceChildren();
  visibleNodes().forEach((node) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `mini-node${node.id === state.selectedId ? ' is-selected' : ''}`;
    marker.style.left = `${(node.x / CANVAS_SIZE.width) * 100}%`;
    marker.style.top = `${(node.y / CANVAS_SIZE.height) * 100}%`;
    marker.style.background = COLORS[node.color] ?? COLORS.fuchsia;
    marker.title = node.title;
    marker.setAttribute('aria-label', `Ir a ${node.title}`);
    marker.addEventListener('click', () => { state.selectedId = node.id; centerOn(node); render(); renderInspector(); });
    minimapBody.appendChild(marker);
  });
}

const addField = (labelText, value, type = 'input') => {
  const label = document.createElement('label');
  label.className = 'field';
  label.textContent = labelText;
  const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  control.value = value ?? '';
  if (type !== 'textarea') control.type = 'text';
  label.appendChild(control);
  return { label, control };
};

function renderInspector() {
  const node = nodeById(state.selectedId);
  inspectorTitle.textContent = node?.title ?? 'Selecciona un nodo';
  inspectorBody.replaceChildren();
  if (!node) { inspectorBody.innerHTML = '<p class="empty">Selecciona un cuadro del mapa para ver sus detalles.</p>'; return; }
  inspector.classList.add('is-open');
  const badge = document.createElement('span'); badge.className = `inspector-badge tone-${node.color}`; badge.textContent = node.type;
  const detail = document.createElement('p'); detail.className = 'inspector-detail'; detail.textContent = node.desc ?? '';
  inspectorBody.append(badge, detail);

  const title = addField('Título', node.title);
  const owner = addField('Responsable / bot', node.owner || node.bot || '');
  const status = addField('Estado', node.status || 'Por confirmar');
  const notes = addField('Notas', node.notes || '', 'textarea');
  [title, owner, status, notes].forEach(({ label, control }) => {
    let timer;
    control.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => commit((graph) => {
        const current = graph.nodes.find((item) => item.id === node.id);
        if (!current) return;
        if (control === title.control) current.title = control.value;
        if (control === owner.control) current.owner = control.value;
        if (control === status.control) current.status = control.value;
        if (control === notes.control) current.notes = control.value;
      }), 260);
    });
    inspectorBody.appendChild(label);
  });

  const links = document.createElement('section'); links.className = 'inspector-links';
  const linkHeading = document.createElement('div'); linkHeading.className = 'section-line';
  const linkTitle = document.createElement('strong'); linkTitle.textContent = 'Enlaces';
  const linkButton = document.createElement('button'); linkButton.type = 'button'; linkButton.className = 'button button-small button-outline'; linkButton.textContent = state.linkMode ? 'Selecciona destino' : 'Enlazar';
  linkButton.addEventListener('click', () => { state.linkMode = !state.linkMode; notify(state.linkMode ? 'Selecciona el nodo de destino.' : 'Modo enlace cancelado.'); renderInspector(); });
  linkHeading.append(linkTitle, linkButton); links.appendChild(linkHeading);
  const related = state.graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  if (!related.length) { const empty = document.createElement('p'); empty.className = 'empty small'; empty.textContent = 'Sin enlaces directos todavía.'; links.appendChild(empty); }
  related.forEach((edge) => {
    const other = nodeById(edge.source === node.id ? edge.target : edge.source);
    if (!other) return;
    const row = document.createElement('div'); row.className = 'link-row';
    const text = document.createElement('span'); text.textContent = `${edge.source === node.id ? '→' : '←'} ${other.title}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button danger'; remove.textContent = '×'; remove.setAttribute('aria-label', `Eliminar enlace con ${other.title}`);
    remove.addEventListener('click', () => commit((graph) => { graph.edges = graph.edges.filter((item) => item !== edge), null; }, 'Enlace eliminado'));
    row.append(text, remove); links.appendChild(row);
  });
  inspectorBody.appendChild(links);

  const actions = document.createElement('div'); actions.className = 'inspector-actions';
  const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'button button-danger'; deleteButton.textContent = 'Eliminar nodo';
  deleteButton.addEventListener('click', () => { if (window.confirm('¿Eliminar este nodo y sus enlaces?')) { commit((graph) => { graph.nodes = graph.nodes.filter((item) => item.id !== node.id); graph.edges = graph.edges.filter((edge) => edge.source !== node.id && edge.target !== node.id); }, 'Nodo eliminado'); state.selectedId = 'rr-labs'; renderInspector(); } });
  actions.appendChild(deleteButton); inspectorBody.appendChild(actions);
}

function render() {
  const visible = visibleNodes();
  nodesLayer.replaceChildren(...visible.map(createCard));
  renderEdges();
  renderMinimap();
  setTransform();
  $('[data-node-count]').textContent = String(visible.length);
  $('[data-process-count]').textContent = String(processRows.length);
  canvas.classList.toggle('linking', state.linkMode);
}

function centerOn(node) {
  if (!node) return;
  const width = canvasWrap.clientWidth || 900;
  state.panX = Math.round(width / 2 - (node.x + 105) * state.zoom);
  state.panY = Math.max(24, Math.round(88 - node.y * state.zoom));
  setTransform();
}
function search() {
  const term = searchInput.value.trim().toLocaleLowerCase();
  state.query = term;
  const found = term ? state.graph.nodes.find((node) => [node.title, node.type, node.status, node.owner, node.bot].filter(Boolean).join(' ').toLocaleLowerCase().includes(term)) : nodeById('rr-labs');
  if (found) { state.selectedId = found.id; centerOn(found); notify(`Nodo encontrado: ${found.title}`); } else notify('No encontramos ese nodo.');
  render(); renderInspector();
}
function fit() {
  state.zoom = window.innerWidth < 700 ? 0.42 : 0.52;
  state.panX = Math.max(18, (canvasWrap.clientWidth - CANVAS_SIZE.width * state.zoom) / 2);
  state.panY = 28;
  setTransform(); renderMinimap();
}
function mutateZoom(delta) { state.zoom = Math.min(1.25, Math.max(0.28, Number((state.zoom + delta).toFixed(2)))); setTransform(); }
function addNode() {
  const id = `custom-${Date.now()}`;
  const node = { id, title: 'Nuevo nodo', type: 'note', level: 3, x: Math.round((canvasWrap.scrollLeft + 220) / state.zoom), y: Math.round((canvasWrap.scrollTop + 260) / state.zoom), color: 'fuchsia', status: 'Por confirmar', desc: 'Añade aquí el alcance público.', owner: 'Por confirmar', notes: '', lineId: 'custom', stage: '' };
  commit((graph) => graph.nodes.push(node), 'Nodo añadido'); state.selectedId = id; renderInspector(); centerOn(node); render();
}
function undo() { const previous = state.history.pop(); if (!previous) return notify('No hay cambios para deshacer.'); state.future.push(graphSnapshot()); state.graph = previous; save(); render(); renderInspector(); notify('Cambio deshecho'); }
function redo() { const next = state.future.pop(); if (!next) return notify('No hay cambios para rehacer.'); state.history.push(graphSnapshot()); state.graph = next; save(); render(); renderInspector(); notify('Cambio rehecho'); }
function exportGraph() {
  const payload = { schemaVersion: 1, exportedAt: new Date().toISOString(), ...state.graph, source: 'RR Atlas · inventario público' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'rr-atlas-arbol.json'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); notify('JSON exportado');
}
async function importGraph(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || parsed.nodes.length > 600) throw new Error('invalid');
    commit((graph) => { graph.nodes = parsed.nodes; graph.edges = parsed.edges; }, 'Mapa importado'); state.selectedId = parsed.nodes[0]?.id ?? null; renderInspector();
  } catch { notify('JSON inválido; no se reemplazó el mapa.'); }
}

function bindActions() {
  $$('[data-action="search"]').forEach((button) => button.addEventListener('click', search));
  searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') search(); });
  searchInput.addEventListener('input', () => { state.query = searchInput.value; render(); });
  $('[data-action="add-node"]').addEventListener('click', addNode);
  $('[data-action="zoom-in"]').addEventListener('click', () => mutateZoom(0.08));
  $('[data-action="zoom-out"]').addEventListener('click', () => mutateZoom(-0.08));
  $('[data-action="fit"]').addEventListener('click', fit);
  $('[data-action="undo"]').addEventListener('click', undo);
  $('[data-action="redo"]').addEventListener('click', redo);
  $('[data-action="export"]').addEventListener('click', exportGraph);
  $('[data-action="import"]').addEventListener('click', () => $('[data-import-input]').click());
  $('[data-import-input]').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) importGraph(file); event.target.value = ''; });
  $$('[data-action="toggle-minimap"]').forEach((button) => button.addEventListener('click', () => { minimap.hidden = !minimap.hidden; }));
  $('[data-action="close-inspector"]').addEventListener('click', () => inspector.classList.remove('is-open'));
  $('[data-action="help"]').addEventListener('click', () => $('[data-help-dialog]').showModal());
  document.addEventListener('keydown', (event) => { const modifier = event.metaKey || event.ctrlKey; if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); } if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); } if (event.key === 'Escape') { state.linkMode = false; renderInspector(); } });
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.node-card')) return;
  state.panning = { startX: event.clientX, startY: event.clientY, originX: state.panX, originY: state.panY, pointerId: event.pointerId };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => { if (!state.panning) return; state.panX = state.panning.originX + event.clientX - state.panning.startX; state.panY = state.panning.originY + event.clientY - state.panning.startY; setTransform(); });
canvas.addEventListener('pointerup', () => { state.panning = null; });
canvas.addEventListener('pointercancel', () => { state.panning = null; });
canvas.addEventListener('wheel', (event) => { event.preventDefault(); mutateZoom(event.deltaY > 0 ? -0.04 : 0.04); }, { passive: false });

state.graph = loadGraph();
if (!state.graph.nodes.some((node) => node.id === 'rr-labs')) state.graph = createRRGraph();
bindActions();
renderInspector();
render();
centerOn(nodeById(state.selectedId));
