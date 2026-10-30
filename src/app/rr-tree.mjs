import { createRRGraph, processRows, statusLabels } from '../data/rr-tree.mjs';
import {
  CARD_SIZES,
  RR_TREE_STORAGE_KEY,
  createRRTreeStore,
  findRRNode,
  getCardSize,
  getDefaultCollapsedIds,
  getGraphBounds,
  getHierarchyDescendants,
  getHierarchyPath,
  layoutRRGraph,
  projectRRGraph,
} from '../core/rr-tree.mjs';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const confirmation = (value) => {
  const text = String(value ?? '').trim();
  return !text || /^por confirmar(?: con rosas)?$/i.test(text) ? 'Por confirmar con Rosas' : text;
};
const COLORS = { fuchsia: '#be076d', mustard: '#ded116', orchid: '#973d8f', ink: '#070001', ok: '#4f9d64', warn: '#ded116', off: '#be076d' };
const CANVAS_MINIMUM = { width: 2_400, height: 1_800 };

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
const saveStatus = $('[data-save-status]');
const breadcrumbs = $('[data-breadcrumbs]');

const notify = (message) => {
  toastElement.textContent = message;
  toastElement.hidden = false;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { toastElement.hidden = true; }, 3_200);
};

const safeStorage = (() => {
  try {
    const storage = window.localStorage;
    const probe = '__rr_atlas_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
})();

const initialGraph = layoutRRGraph(createRRGraph());
const store = createRRTreeStore({
  initialGraph,
  storage: safeStorage,
  storageKey: RR_TREE_STORAGE_KEY,
  onStorageError: (error) => notify(error?.message || 'No se pudo guardar; exporta una copia JSON.'),
});

const state = {
  graph: store.getGraph(),
  visibleGraph: store.getGraph(),
  selectedId: 'rr-labs',
  selectedIds: new Set(),
  query: '',
  filters: { line: 'all', stage: 'all', bpmn: 'all', type: 'all' },
  collapsed: new Set(getDefaultCollapsedIds(store.getGraph())),
  hiddenCounts: {},
  expandedIds: new Set(),
  zoom: window.innerWidth < 700 ? 0.34 : 0.52,
  panX: 0,
  panY: 32,
  wiresVisible: true,
  crossVisible: true,
  linkMode: false,
  linkSource: null,
  dragging: null,
  connecting: null,
  panning: null,
  ignoreClick: false,
  skipNextClick: null,
  editing: null,
  viewPositions: new Map(),
  formDirty: false,
};

function nodeById(id, graph = state.graph) {
  return graph.nodes.find((node) => node.id === id) ?? null;
}

function positionOf(node) {
  if (state.dragging?.id === node.id) return state.dragging.preview;
  return state.viewPositions.get(node.id) ?? node;
}

function visibleState() {
  const projection = projectRRGraph(state.graph, {
    collapsedIds: [...state.collapsed],
    filters: state.filters,
    query: state.query,
  });
  const hasActiveProjection = Boolean(state.query.trim())
    || Object.values(state.filters).some((value) => value && value !== 'all')
    || state.collapsed.size > 0;
  const projected = hasActiveProjection ? layoutRRGraph(projection.graph) : projection.graph;
  const nodes = projected.nodes.map((node) => {
    const override = state.viewPositions.get(node.id);
    return override ? { ...node, ...override } : node;
  });
  state.hiddenCounts = projection.hiddenCounts;
  state.expandedIds = new Set(projection.expandedIds ?? []);
  state.visibleGraph = { ...projected, nodes };
  return state.visibleGraph;
}

function setTransform() {
  canvas.style.transform = `translate(${Math.round(state.panX)}px, ${Math.round(state.panY)}px) scale(${state.zoom})`;
  zoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
}

function updateSaveStatus() {
  const status = store.getStatus();
  const dirty = status.dirty || state.formDirty;
  saveStatus.textContent = state.formDirty
    ? 'Cambios sin guardar · pulsa Guardar cambios'
    : dirty
      ? 'Cambios sin guardar · exporta una copia'
      : 'Cambios guardados localmente';
  saveStatus.classList.toggle('is-dirty', dirty);
}

function selectNode(id, { additive = false } = {}) {
  if (!nodeById(id)) return;
  const preserveForm = state.formDirty && state.selectedId === id;
  if (state.selectedId !== id) state.formDirty = false;
  if (additive) {
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    state.selectedId = id;
  } else {
    state.selectedIds = new Set([id]);
    state.selectedId = id;
  }
  applySelectionClasses();
  if (!preserveForm) renderInspector();
  renderBreadcrumbs();
}

function applySelectionClasses() {
  $$('.node-card', nodesLayer).forEach((card) => card.classList.toggle('is-selected', state.selectedIds.has(card.dataset.id)));
}

function edgeExists(source, target) {
  return state.graph.edges.some((edge) => edge.source === source && edge.target === target);
}

function connectNodes(source, target) {
  if (!source || !target || source === target) {
    notify('El enlace necesita dos nodos distintos.');
    return false;
  }
  if (edgeExists(source, target)) {
    notify('Ese enlace ya existe.');
    return false;
  }
  try {
    return store.commit((graph) => graph.edges.push({ source, target, kind: 'cross' }), 'connect');
  } catch (error) {
    notify(error.message);
    return false;
  }
}

function finishConnection(event) {
  if (!state.connecting) return;
  const connection = state.connecting;
  state.connecting = null;
  const targetCard = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.node-card');
  const target = targetCard?.dataset.id;
  if (target) connectNodes(connection.source, target);
  else notify('Suelta sobre otro nodo para crear el enlace.');
  renderInspector();
}

function startConnection(event, node) {
  event.preventDefault();
  event.stopPropagation();
  state.connecting = { source: node.id, pointerId: event.pointerId };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  notify('Arrastra hasta otro nodo y suelta para conectar.');
}

function startInlineEdit(node, card) {
  if (state.editing) return;
  const title = $('.node-title', card);
  if (!title) return;
  const input = document.createElement('input');
  input.className = 'inline-title-input';
  input.type = 'text';
  input.value = node.title;
  input.setAttribute('aria-label', `Editar título de ${node.title}`);
  title.replaceWith(input);
  input.focus();
  input.select();
  state.editing = { nodeId: node.id, input, title };
  let finished = false;
  const finish = (saveChanges) => {
    if (finished) return;
    finished = true;
    const value = input.value.trim();
    input.replaceWith(title);
    state.editing = null;
    if (saveChanges && value && value !== node.title) {
      try { store.commit((graph) => { const current = nodeById(node.id, graph); if (current) current.title = value; }, 'inline-edit'); } catch (error) { notify(error.message); }
    } else {
      title.textContent = node.title;
    }
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true), { once: true });
}

function moveSelection(direction) {
  const current = nodeById(state.selectedId);
  const nodes = state.visibleGraph.nodes;
  if (!current || !nodes.length) return;
  const origin = positionOf(current);
  const candidates = nodes.filter((node) => node.id !== current.id);
  const scored = candidates.map((node) => {
    const point = positionOf(node);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const forward = direction === 'right' ? dx > 0 : direction === 'left' ? dx < 0 : direction === 'down' ? dy > 0 : dy < 0;
    return { node, forward, distance: Math.hypot(dx, dy), axis: direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx) };
  }).filter((item) => item.forward).sort((left, right) => (left.axis - right.axis) || (left.distance - right.distance));
  const next = scored[0]?.node;
  if (next) {
    selectNode(next.id);
    const visibleNext = nodeById(next.id, state.visibleGraph) ?? next;
    centerOn(visibleNext);
    window.requestAnimationFrame?.(() => {
      $$('.node-card', nodesLayer).find((card) => card.dataset.id === next.id)?.focus({ preventScroll: true });
    });
  }
}

function finishDrag(node, card) {
  const drag = state.dragging;
  if (!drag || drag.id !== node.id) return;
  state.dragging = null;
  if (drag.moved) {
    state.viewPositions.set(node.id, { x: drag.preview.x, y: drag.preview.y });
    try {
      store.commit((graph) => {
        const current = nodeById(node.id, graph);
        if (current) { current.x = drag.preview.x; current.y = drag.preview.y; }
      }, 'move-node', { before: drag.before });
    } catch (error) { notify(error.message); }
    state.ignoreClick = true;
  } else {
    const origin = positionOf(node);
    card.style.left = `${origin.x}px`;
    card.style.top = `${origin.y}px`;
  }
  renderEdges();
}

function createCard(node) {
  const card = document.createElement('article');
  const size = getCardSize(node);
  card.className = `node-card node-${node.type} tone-${node.color ?? 'fuchsia'}${state.selectedIds.has(node.id) ? ' is-selected' : ''}`;
  card.dataset.id = node.id;
  card.style.left = `${node.x}px`;
  card.style.top = `${node.y}px`;
  card.style.width = `${size.width}px`;
  card.style.height = `${size.height}px`;
  card.style.setProperty('--tone', COLORS[node.color] ?? COLORS.fuchsia);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${node.title}, ${node.type}, ${node.status || 'Por confirmar'}`);

  const meta = document.createElement('span');
  meta.className = 'node-meta';
  meta.textContent = node.type === 'process' ? node.shortTitle ?? 'Proceso' : node.type === 'stage' ? 'ETAPA' : node.type.toUpperCase();
  const title = document.createElement('strong');
  title.className = 'node-title';
  title.textContent = node.title;
  const status = document.createElement('span');
  status.className = 'node-status';
  status.textContent = node.status || 'Por confirmar con Rosas';
  const desc = document.createElement('span');
  desc.className = 'node-desc';
  desc.textContent = node.desc ?? '';
  card.append(meta, title, status, desc);

  const controls = document.createElement('span');
  controls.className = 'node-controls';
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'node-control node-handle';
  handle.textContent = '◇';
  handle.title = 'Arrastrar para conectar';
  handle.setAttribute('aria-label', `Conectar desde ${node.title}`);
  handle.addEventListener('pointerdown', (event) => startConnection(event, node));
  handle.addEventListener('pointerup', finishConnection);
  controls.appendChild(handle);
  const hiddenCount = state.hiddenCounts[node.id] ?? 0;
  if (hiddenCount || getHierarchyDescendants(state.graph, node.id).length) {
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'node-control node-collapse';
    const isCollapsed = state.collapsed.has(node.id) && !state.expandedIds.has(node.id);
    collapse.textContent = isCollapsed ? `+${hiddenCount}` : '−';
    collapse.title = isCollapsed ? 'Expandir rama' : 'Colapsar rama';
    collapse.setAttribute('aria-label', `${isCollapsed ? 'Expandir' : 'Colapsar'} ${node.title}${hiddenCount ? `, ${hiddenCount} hijos ocultos` : ''}`);
    collapse.addEventListener('click', (event) => {
      event.stopPropagation();
      if (state.collapsed.has(node.id)) state.collapsed.delete(node.id); else state.collapsed.add(node.id);
      render();
      notify(isCollapsed ? 'Rama expandida.' : `Rama colapsada: ${hiddenCount || getHierarchyDescendants(state.graph, node.id).length} nodos ocultos.`);
    });
    controls.appendChild(collapse);
  }
  card.appendChild(controls);

  card.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('.node-control, .inline-title-input')) return;
    event.stopPropagation();
    if (state.linkMode) {
      if (state.linkSource && state.linkSource !== node.id) connectNodes(state.linkSource, node.id);
      state.linkMode = false;
      state.linkSource = null;
      renderInspector();
      return;
    }
    selectNode(node.id, { additive: event.shiftKey });
    state.skipNextClick = { id: node.id, pointerId: event.pointerId };
    if (event.shiftKey) return;
    const origin = positionOf(node);
    state.dragging = {
      id: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: origin.x, y: origin.y },
      preview: { x: origin.x, y: origin.y },
      before: store.getGraph(),
      moved: false,
    };
    card.setPointerCapture?.(event.pointerId);
  });
  card.addEventListener('pointermove', (event) => {
    const drag = state.dragging;
    if (!drag || drag.id !== node.id) return;
    const nextX = Math.round(drag.origin.x + (event.clientX - drag.startX) / state.zoom);
    const nextY = Math.round(drag.origin.y + (event.clientY - drag.startY) / state.zoom);
    drag.preview = { x: nextX, y: nextY };
    if (Math.abs(nextX - drag.origin.x) + Math.abs(nextY - drag.origin.y) > 3) drag.moved = true;
    card.style.left = `${nextX}px`;
    card.style.top = `${nextY}px`;
    renderEdges();
  });
  card.addEventListener('pointerup', () => finishDrag(node, card));
  card.addEventListener('pointercancel', () => { state.dragging = null; state.skipNextClick = null; render(); });
  card.addEventListener('click', (event) => {
    if (state.ignoreClick) { state.ignoreClick = false; state.skipNextClick = null; event.preventDefault(); return; }
    if (state.skipNextClick?.id === node.id) {
      state.skipNextClick = null;
      event.preventDefault();
      return;
    }
    selectNode(node.id, { additive: event.shiftKey });
  });
  card.addEventListener('dblclick', (event) => {
    event.preventDefault();
    startInlineEdit(node, card);
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(node.id, { additive: event.shiftKey }); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); moveSelection(event.key.slice(5).toLowerCase());
    }
  });
  return card;
}

function renderEdges() {
  const graph = state.visibleGraph;
  const bounds = getGraphBounds(state.visibleGraph);
  edgeLayer.replaceChildren();
  edgesSvg.setAttribute('viewBox', `0 0 ${Math.max(CANVAS_MINIMUM.width, bounds.right + 160)} ${Math.max(CANVAS_MINIMUM.height, bounds.bottom + 160)}`);
  edgesSvg.setAttribute('width', String(Math.max(CANVAS_MINIMUM.width, bounds.right + 160)));
  edgesSvg.setAttribute('height', String(Math.max(CANVAS_MINIMUM.height, bounds.bottom + 160)));
  if (!state.wiresVisible) return;
  const visible = new Set(graph.nodes.map((node) => node.id));
  graph.edges.forEach((edge) => {
    if (edge.kind === 'cross' && !state.crossVisible) return;
    if (!visible.has(edge.source) || !visible.has(edge.target)) return;
    const source = nodeById(edge.source, graph);
    const target = nodeById(edge.target, graph);
    if (!source || !target) return;
    const sourcePoint = positionOf(source);
    const targetPoint = positionOf(target);
    const sourceSize = getCardSize(source);
    const targetSize = getCardSize(target);
    const x1 = sourcePoint.x + sourceSize.width / 2;
    const y1 = sourcePoint.y + sourceSize.height;
    const x2 = targetPoint.x + targetSize.width / 2;
    const y2 = targetPoint.y;
    const curve = Math.max(42, Math.abs(y2 - y1) * 0.38);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + curve}, ${x2} ${y2 - curve}, ${x2} ${y2}`);
    path.setAttribute('class', `edge edge-${edge.kind ?? 'hierarchy'}${source.id === state.selectedId || target.id === state.selectedId ? ' edge-active' : ''}`);
    path.setAttribute('aria-label', `Enlace de ${source.title} a ${target.title}`);
    edgeLayer.appendChild(path);
  });
}

function renderMinimap() {
  minimapBody.replaceChildren();
  const bounds = getGraphBounds(state.visibleGraph);
  state.visibleGraph.nodes.forEach((node) => {
    const marker = document.createElement('span');
    marker.className = `mini-node${node.id === state.selectedId ? ' is-selected' : ''}`;
    marker.setAttribute('aria-hidden', 'true');
    marker.style.left = `${((node.x - bounds.left) / bounds.width) * 100}%`;
    marker.style.top = `${((node.y - bounds.top) / bounds.height) * 100}%`;
    marker.style.background = COLORS[node.color] ?? COLORS.fuchsia;
    marker.title = node.title;
    minimapBody.appendChild(marker);
  });
}

function renderBreadcrumbs() {
  breadcrumbs.replaceChildren();
  const path = getHierarchyPath(state.graph, state.selectedId);
  path.forEach((node, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.textContent = ' / ';
      breadcrumbs.appendChild(separator);
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = node.shortTitle ?? node.title;
    item.setAttribute('aria-label', `Seleccionar ${node.title}`);
    item.addEventListener('click', () => { selectNode(node.id); centerOn(node); });
    breadcrumbs.appendChild(item);
  });
}

function addField(labelText, value, type = 'input') {
  const label = document.createElement('label');
  label.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  control.value = value ?? '';
  if (type !== 'textarea') control.type = 'text';
  label.append(caption, control);
  return { label, control };
}

function renderInspector() {
  const node = nodeById(state.selectedId);
  inspectorTitle.textContent = node?.title ?? 'Selecciona un nodo';
  inspectorBody.replaceChildren();
  if (!node) {
    inspectorBody.appendChild(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Selecciona un cuadro del mapa para ver sus detalles.' }));
    return;
  }
  inspector.classList.add('is-open');
  const badge = document.createElement('span');
  badge.className = `inspector-badge tone-${node.color ?? 'fuchsia'}`;
  badge.textContent = node.type;
  const detail = document.createElement('p');
  detail.className = 'inspector-detail';
  detail.textContent = node.desc ?? 'Sin descripción pública.';
  inspectorBody.append(badge, detail);

  const fields = {
    title: addField('Título', node.title),
    owner: addField('Responsable / bot', confirmation(node.owner || node.bot)),
    status: addField('Estado', confirmation(node.status)),
    kpi: addField('KPI', confirmation(node.kpi)),
    notes: addField('Notas', node.notes || '', 'textarea'),
  };
  Object.values(fields).forEach(({ label, control }) => {
    inspectorBody.appendChild(label);
    control.addEventListener('input', () => {
      state.formDirty = true;
      updateSaveStatus();
    });
  });
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'button button-primary inspector-save';
  saveButton.textContent = 'Guardar cambios';
  saveButton.addEventListener('click', () => {
    try {
      store.commit((graph) => {
        const current = nodeById(node.id, graph);
        if (!current) return;
        current.title = fields.title.control.value.trim() || current.title;
        current.owner = confirmation(fields.owner.control.value);
        current.status = confirmation(fields.status.control.value);
        current.kpi = confirmation(fields.kpi.control.value);
        current.notes = fields.notes.control.value;
      }, 'update-node');
      state.formDirty = false;
      renderInspector();
      notify(store.getStatus().dirty ? 'Cambios conservados, pero aún no están guardados localmente.' : 'Cambios guardados.');
    } catch (error) { notify(error.message); }
  });
  inspectorBody.appendChild(saveButton);

  if (node.type === 'process') {
    const processMeta = document.createElement('dl');
    processMeta.className = 'process-meta';
    [['Dueño', confirmation(node.owner)], ['KPI', confirmation(node.kpi)], ['Estado BPMN', confirmation(node.status || statusLabels[node.statusKey])]].forEach(([label, value]) => {
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value;
      processMeta.append(term, description);
    });
    inspectorBody.appendChild(processMeta);
    const pending = document.createElement('p');
    pending.className = 'pending-note';
    pending.textContent = node.bpmnPath
      ? `Visor bpmn-js pendiente: el archivo ${node.bpmnPath} está documentado, pero todavía no se abre desde el editor.`
      : 'Visor bpmn-js pendiente: no hay archivo .bpmn asociado.';
    inspectorBody.appendChild(pending);
  }

  const links = document.createElement('section'); links.className = 'inspector-links';
  const linkHeading = document.createElement('div'); linkHeading.className = 'section-line';
  const linkTitle = document.createElement('strong'); linkTitle.textContent = 'Enlaces';
  const linkButton = document.createElement('button'); linkButton.type = 'button'; linkButton.className = 'button button-small button-outline'; linkButton.textContent = state.linkMode ? 'Selecciona destino' : 'Enlazar';
  linkButton.addEventListener('click', () => {
    state.linkMode = !state.linkMode;
    state.linkSource = state.linkMode ? node.id : null;
    notify(state.linkMode ? 'Selecciona el nodo de destino.' : 'Modo enlace cancelado.');
    renderInspector();
  });
  linkHeading.append(linkTitle, linkButton); links.appendChild(linkHeading);
  const related = state.graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  if (!related.length) {
    const empty = document.createElement('p'); empty.className = 'empty small'; empty.textContent = 'Sin enlaces directos todavía.'; links.appendChild(empty);
  }
  related.forEach((edge) => {
    const other = nodeById(edge.source === node.id ? edge.target : edge.source);
    if (!other) return;
    const row = document.createElement('div'); row.className = 'link-row';
    const text = document.createElement('span'); text.textContent = `${edge.source === node.id ? '→' : '←'} ${other.title} · ${edge.kind}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button danger'; remove.textContent = '×'; remove.setAttribute('aria-label', `Eliminar enlace con ${other.title}`);
    remove.addEventListener('click', () => store.commit((graph) => {
      graph.edges = graph.edges.filter((item) => !(item.source === edge.source && item.target === edge.target && item.kind === edge.kind));
    }, 'remove-edge'));
    row.append(text, remove); links.appendChild(row);
  });
  inspectorBody.appendChild(links);

  const actions = document.createElement('div'); actions.className = 'inspector-actions';
  const collapseButton = document.createElement('button'); collapseButton.type = 'button'; collapseButton.className = 'button button-outline';
  collapseButton.textContent = state.collapsed.has(node.id) ? 'Expandir rama' : 'Colapsar rama';
  collapseButton.addEventListener('click', () => { if (state.collapsed.has(node.id)) state.collapsed.delete(node.id); else state.collapsed.add(node.id); render(); });
  actions.appendChild(collapseButton);
  const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'button button-danger'; deleteButton.textContent = `Eliminar seleccionado${state.selectedIds.size > 1 ? ` (${state.selectedIds.size})` : ''}`;
  deleteButton.addEventListener('click', () => {
    const ids = new Set(state.selectedIds.size ? state.selectedIds : [node.id]);
    if (ids.has('rr-labs')) { notify('La raíz del mapa no se puede eliminar.'); return; }
    if (!window.confirm('¿Eliminar el nodo seleccionado y sus enlaces?')) return;
    store.commit((graph) => {
      graph.nodes = graph.nodes.filter((item) => !ids.has(item.id));
      graph.edges = graph.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target));
    }, 'delete-node');
    state.selectedIds.clear(); state.selectedId = 'rr-labs';
  });
  actions.appendChild(deleteButton); inspectorBody.appendChild(actions);
}

function updateCanvasSize() {
  const bounds = getGraphBounds(state.visibleGraph);
  const width = Math.max(CANVAS_MINIMUM.width, bounds.right + 180);
  const height = Math.max(CANVAS_MINIMUM.height, bounds.bottom + 180);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function render() {
  const visible = visibleState();
  updateCanvasSize();
  nodesLayer.replaceChildren(...visible.nodes.map(createCard));
  renderEdges();
  renderMinimap();
  renderBreadcrumbs();
  setTransform();
  applySelectionClasses();
  $('[data-node-count]').textContent = String(visible.nodes.length);
  $('[data-process-count]').textContent = String(processRows.length);
  canvas.classList.toggle('linking', state.linkMode);
  updateSaveStatus();
}

function centerOn(node) {
  if (!node) return;
  const visualNode = nodeById(node.id, state.visibleGraph) ?? node;
  const size = getCardSize(visualNode);
  const width = canvasWrap.clientWidth || 900;
  const height = canvasWrap.clientHeight || 640;
  const point = positionOf(visualNode);
  state.panX = Math.round(width / 2 - (point.x + size.width / 2) * state.zoom);
  state.panY = Math.round(height / 2 - (point.y + size.height / 2) * state.zoom);
  setTransform();
}

function fitBounds(bounds = getGraphBounds(state.visibleGraph)) {
  const width = canvasWrap.clientWidth || 900;
  const height = canvasWrap.clientHeight || 640;
  const padding = 44;
  state.zoom = clamp(Math.min((width - padding * 2) / bounds.width, (height - 130) / bounds.height), 0.12, 1.25);
  state.panX = Math.round((width - bounds.width * state.zoom) / 2 - bounds.left * state.zoom);
  state.panY = Math.round((height - bounds.height * state.zoom) / 2 - bounds.top * state.zoom);
  setTransform();
}

function fit() { fitBounds(getGraphBounds(state.visibleGraph)); }

function focusBranch() {
  const selected = nodeById(state.selectedId);
  if (!selected) return notify('Selecciona un nodo para enfocar su rama.');
  const ids = [selected.id, ...getHierarchyDescendants(state.graph, selected.id)];
  const visibleIds = ids.filter((id) => nodeById(id, state.visibleGraph));
  fitBounds(getGraphBounds(state.visibleGraph, visibleIds.length ? visibleIds : [selected.id]));
  notify(`Rama enfocada: ${selected.title}`);
}

function search() {
  const query = searchInput.value;
  state.query = query;
  if (!query.trim()) {
    render();
    return;
  }
  const found = findRRNode(state.graph, query);
  render();
  if (found) {
    selectNode(found.id);
    centerOn(nodeById(found.id, state.visibleGraph) ?? found);
    notify(`Nodo encontrado: ${found.title}`);
  } else notify('No encontramos ese nodo.');
}

function mutateZoom(delta) {
  state.zoom = clamp(Number((state.zoom + delta).toFixed(2)), 0.12, 1.25);
  setTransform();
}

function addNode() {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const bounds = getGraphBounds(state.graph);
  const node = { id, title: 'Nuevo nodo', type: 'note', x: Math.round(bounds.left + 60), y: Math.round(bounds.bottom + 150), color: 'fuchsia', status: 'Por confirmar con Rosas', desc: 'Añade aquí el alcance público.', owner: 'Por confirmar con Rosas', notes: '', lineId: 'custom', stage: '' };
  state.selectedId = id; state.selectedIds = new Set([id]);
  store.commit((graph) => graph.nodes.push(node), 'add-node');
  centerOn(node);
}

function orderTree() {
  try {
    const ordered = layoutRRGraph(state.graph);
    state.viewPositions.clear();
    store.commit((graph) => {
      const positions = new Map(ordered.nodes.map((node) => [node.id, node]));
      graph.nodes.forEach((node) => { const position = positions.get(node.id); if (position) { node.x = position.x; node.y = position.y; } });
    }, 'order-tree');
    fit();
    notify('Árbol ordenado de arriba hacia abajo.');
  } catch (error) { notify(error.message); }
}

function exportGraph() {
  const payload = store.exportPayload();
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'rr-atlas-arbol.json'; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  notify('JSON versionado exportado.');
}

async function importGraph(file) {
  try {
    await store.importJSON(await file.text());
    state.viewPositions.clear();
    state.formDirty = false;
    state.collapsed = new Set(getDefaultCollapsedIds(store.getGraph()));
    state.selectedId = store.getGraph().nodes[0]?.id ?? null;
    state.selectedIds = new Set(state.selectedId ? [state.selectedId] : []);
    fit();
    notify('Mapa importado y validado.');
  } catch (error) {
    notify(error.message || 'JSON inválido: no se modificó el mapa.');
  }
}

function restoreOriginal() {
  if (!window.confirm('¿Restaurar el mapa original y descartar cambios locales?')) return;
  store.reset();
  state.viewPositions.clear();
  state.formDirty = false;
  state.collapsed = new Set(getDefaultCollapsedIds(store.getGraph()));
  state.selectedId = 'rr-labs'; state.selectedIds = new Set(['rr-labs']);
  fit();
  notify('Mapa original restaurado.');
}

function bindActions() {
  const railPanel = $('[data-rail-panel]');
  if (railPanel && window.innerWidth > 760) railPanel.open = true;
  $('[data-action="search"]').addEventListener('click', search);
  searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') search(); });
  searchInput.addEventListener('input', () => { state.query = searchInput.value; render(); });
  $('[data-action="add-node"]').addEventListener('click', addNode);
  $('[data-action="zoom-in"]').addEventListener('click', () => mutateZoom(0.08));
  $('[data-action="zoom-out"]').addEventListener('click', () => mutateZoom(-0.08));
  $('[data-action="fit"]').addEventListener('click', fit);
  $('[data-action="focus-branch"]').addEventListener('click', focusBranch);
  $('[data-action="order"]').addEventListener('click', orderTree);
  $('[data-action="restore"]').addEventListener('click', restoreOriginal);
  $('[data-action="undo"]').addEventListener('click', () => store.undo());
  $('[data-action="redo"]').addEventListener('click', () => store.redo());
  $('[data-action="export"]').addEventListener('click', exportGraph);
  $('[data-action="import"]').addEventListener('click', () => $('[data-import-input]').click());
  $('[data-import-input]').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) importGraph(file); event.target.value = ''; });
  $('[data-action="toggle-cross"]').addEventListener('click', (event) => {
    state.crossVisible = !state.crossVisible;
    event.currentTarget.textContent = state.crossVisible ? '◇ Ocultar cross' : '◇ Mostrar cross';
    event.currentTarget.setAttribute('aria-pressed', String(state.crossVisible));
    renderEdges();
  });
  $$('[data-action="toggle-minimap"]').forEach((button) => button.addEventListener('click', () => { minimap.hidden = !minimap.hidden; }));
  $('[data-action="close-inspector"]').addEventListener('click', () => inspector.classList.remove('is-open'));
  $('[data-action="help"]').addEventListener('click', () => $('[data-help-dialog]').showModal());
  $$('[data-filter]').forEach((select) => select.addEventListener('change', () => { state.filters[select.dataset.filter] = select.value; render(); }));
  const lineSelect = $('[data-filter="line"]');
  state.graph.nodes.filter((node) => node.type === 'line').forEach((node) => {
    const option = document.createElement('option'); option.value = node.lineId ?? node.id; option.textContent = node.title; lineSelect.appendChild(option);
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const inInput = target.matches?.('input, textarea, select, [contenteditable="true"]');
    const modifier = event.metaKey || event.ctrlKey;
    if (inInput) {
      if (event.key === 'Escape') target.blur();
      return;
    }
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? store.redo() : store.undo(); return; }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); store.redo(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); $('.button-danger', inspector)?.click(); return; }
    if (event.key === '/') { event.preventDefault(); searchInput.focus(); searchInput.select(); return; }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); fit(); return; }
    if (event.key === 'Escape') { state.linkMode = false; state.linkSource = null; renderInspector(); }
  });
  document.addEventListener('pointerup', finishConnection);
}

canvasWrap.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.node-card')) return;
  state.panning = { startX: event.clientX, startY: event.clientY, originX: state.panX, originY: state.panY, pointerId: event.pointerId };
  canvasWrap.setPointerCapture?.(event.pointerId);
});
canvasWrap.addEventListener('pointermove', (event) => {
  if (!state.panning) return;
  state.panX = state.panning.originX + event.clientX - state.panning.startX;
  state.panY = state.panning.originY + event.clientY - state.panning.startY;
  setTransform();
});
canvasWrap.addEventListener('pointerup', () => { state.panning = null; });
canvasWrap.addEventListener('pointercancel', () => { state.panning = null; });
canvasWrap.addEventListener('wheel', (event) => { event.preventDefault(); mutateZoom(event.deltaY > 0 ? -0.04 : 0.04); }, { passive: false });

store.subscribe((snapshot) => {
  state.graph = snapshot.graph;
  if (!nodeById(state.selectedId)) {
    state.selectedId = state.graph.nodes[0]?.id ?? null;
    state.selectedIds = state.selectedId ? new Set([state.selectedId]) : new Set();
  }
  render();
  if (!state.formDirty) renderInspector();
});

window.addEventListener('beforeunload', (event) => {
  if (!store.getStatus().dirty && !state.formDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

state.selectedIds = new Set([state.selectedId]);
bindActions();
render();
renderInspector();
centerOn(nodeById(state.selectedId));
