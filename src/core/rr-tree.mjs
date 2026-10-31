/**
 * Núcleo puro del árbol del Atlas.
 *
 * Este módulo no conoce el DOM: valida snapshots, conserva historial,
 * resuelve búsquedas/filtros y ordena solamente las aristas jerárquicas.
 */

export const RR_TREE_SCHEMA_VERSION = 1;
export const RR_TREE_STORAGE_KEY = 'rr-atlas-arbol-v2';
export const RR_TREE_LEGACY_STORAGE_KEY = 'rr-atlas-arbol-v1';
export const MAX_NODES = 600;
export const MAX_EDGES = 6_000;

export const CARD_SIZES = Object.freeze({
  root: Object.freeze({ width: 270, height: 135 }),
  line: Object.freeze({ width: 210, height: 128 }),
  stage: Object.freeze({ width: 122, height: 90 }),
  process: Object.freeze({ width: 210, height: 120 }),
  bot: Object.freeze({ width: 210, height: 100 }),
  project: Object.freeze({ width: 210, height: 100 }),
  client: Object.freeze({ width: 210, height: 100 }),
  note: Object.freeze({ width: 210, height: 100 }),
});

const EDGE_KINDS = new Set(['hierarchy', 'responsibility', 'project', 'cross', 'client']);
const SHARED_TYPES = new Set(['bot', 'project', 'client']);
const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export class RRTreeError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'RRTreeError';
    this.code = code;
  }
}

function fail(code, message, cause) {
  throw new RRTreeError(code, message, cause);
}

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    fail('STORAGE_ADAPTER_REQUIRED', 'Se necesita un adaptador de almacenamiento válido.');
  }
}

function finiteCoordinate(value, field, index) {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) {
    fail('INVALID_GRAPH', `La coordenada ${field} del nodo ${index} no es válida.`);
  }
  return value;
}

/** Devuelve un texto comparable sin acentos ni diferencias de mayúsculas. */
export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function nodeSearchText(node) {
  return [
    node?.title,
    node?.type,
    node?.status,
    node?.statusKey,
    node?.owner,
    node?.bot,
    node?.desc,
    node?.notes,
    node?.lineId,
    node?.stage,
    node?.kpi,
  ].filter((value) => value !== undefined && value !== null).join(' ');
}

export function getCardSize(node) {
  return CARD_SIZES[node?.type] ?? CARD_SIZES.note;
}

/**
 * Valida y clona la forma pública { nodes, edges }. No modifica el argumento.
 * Las aristas desconocidas no se inventan: se rechazan para evitar perder
 * semántica durante un guardado/importación.
 */
export function validateRRGraph(input, { maxNodes = MAX_NODES, maxEdges = MAX_EDGES } = {}) {
  if (!isRecord(input) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    fail('INVALID_GRAPH', 'El mapa debe tener listas nodes y edges.');
  }
  if (input.nodes.length > maxNodes) fail('INVALID_GRAPH', `El mapa supera el máximo de ${maxNodes} nodos.`);
  if (input.edges.length > maxEdges) fail('INVALID_GRAPH', `El mapa supera el máximo de ${maxEdges} enlaces.`);

  const ids = new Set();
  const nodes = input.nodes.map((rawNode, index) => {
    if (!isRecord(rawNode)) fail('INVALID_GRAPH', `El nodo ${index} no es un objeto válido.`);
    const node = clone(rawNode);
    if (typeof node.id !== 'string' || !node.id.trim() || ids.has(node.id)) {
      fail('INVALID_GRAPH', `El nodo ${index} tiene un id vacío o repetido.`);
    }
    ids.add(node.id);
    if (typeof node.title !== 'string' || !node.title.trim()) {
      fail('INVALID_GRAPH', `El nodo ${node.id} necesita un título.`);
    }
    node.type = typeof node.type === 'string' && node.type.trim() ? node.type : 'note';
    node.x = finiteCoordinate(node.x ?? 0, 'x', index);
    node.y = finiteCoordinate(node.y ?? 0, 'y', index);
    if (node.status !== undefined && typeof node.status !== 'string') {
      fail('INVALID_GRAPH', `El estado del nodo ${node.id} debe ser texto.`);
    }
    return node;
  });

  const edgeKeys = new Set();
  const edges = input.edges.map((rawEdge, index) => {
    if (!isRecord(rawEdge) || typeof rawEdge.source !== 'string' || typeof rawEdge.target !== 'string') {
      fail('INVALID_GRAPH', `El enlace ${index} no tiene source y target válidos.`);
    }
    if (!ids.has(rawEdge.source) || !ids.has(rawEdge.target)) {
      fail('INVALID_GRAPH', `El enlace ${index} apunta a un nodo inexistente.`);
    }
    if (rawEdge.source === rawEdge.target) fail('INVALID_GRAPH', `El enlace ${index} no puede apuntar al mismo nodo.`);
    const kind = rawEdge.kind ?? 'hierarchy';
    if (!EDGE_KINDS.has(kind)) fail('INVALID_GRAPH', `El tipo de enlace ${kind} no está permitido.`);
    const edge = { ...clone(rawEdge), kind };
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.kind}`;
    if (edgeKeys.has(key)) fail('INVALID_GRAPH', `El enlace ${index} está repetido.`);
    edgeKeys.add(key);
    return edge;
  });

  const hierarchyParent = new Map();
  const hierarchyChildren = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (edge.kind !== 'hierarchy') continue;
    if (hierarchyParent.has(edge.target)) {
      fail('INVALID_GRAPH', `El nodo ${edge.target} tiene múltiples padres jerárquicos.`);
    }
    hierarchyParent.set(edge.target, edge.source);
    hierarchyChildren.get(edge.source).push(edge.target);
  }
  const visiting = new Set();
  const visited = new Set();
  const visitHierarchy = (id) => {
    if (visiting.has(id)) fail('INVALID_GRAPH', `El mapa contiene un ciclo jerárquico que incluye ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const childId of hierarchyChildren.get(id) ?? []) visitHierarchy(childId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes) visitHierarchy(node.id);

  const result = { ...clone(input), nodes, edges };
  delete result.schemaVersion;
  delete result.exportedAt;
  return result;
}

export function toRRPayload(graph, exportedAt = new Date().toISOString()) {
  const normalized = validateRRGraph(graph);
  return {
    schemaVersion: RR_TREE_SCHEMA_VERSION,
    exportedAt,
    nodes: clone(normalized.nodes),
    edges: clone(normalized.edges),
    ...(normalized.source ? { source: normalized.source } : {}),
  };
}

export function serializeRRGraph(graph) {
  return JSON.stringify(toRRPayload(graph));
}

/** Parsea un export versionado y deja intacto el mapa actual si falla. */
export function parseRRGraph(text) {
  if (typeof text !== 'string') {
    fail('INVALID_JSON', 'JSON inválido: el contenido importado no es texto; no se modificó el mapa.');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    fail('INVALID_JSON', 'JSON inválido: no se pudo leer el archivo; no se modificó el mapa.', cause);
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== RR_TREE_SCHEMA_VERSION) {
    fail('INVALID_JSON', `JSON inválido: se esperaba schemaVersion ${RR_TREE_SCHEMA_VERSION}; no se modificó el mapa.`);
  }
  try {
    return validateRRGraph(parsed);
  } catch (cause) {
    if (cause instanceof RRTreeError && cause.code === 'INVALID_JSON') throw cause;
    fail('INVALID_JSON', `JSON inválido: ${cause.message} No se modificó el mapa.`, cause);
  }
}

export function saveRRGraph(storage, key = RR_TREE_STORAGE_KEY, graph) {
  requireStorage(storage);
  const normalized = validateRRGraph(graph);
  const serialized = serializeRRGraph(normalized);
  try {
    storage.setItem(key, serialized);
  } catch (cause) {
    fail('STORAGE_WRITE_FAILED', 'No se pudo guardar el mapa; conserva la copia sin guardar o expórtala.', cause);
  }
  return normalized;
}

function legacyStorageKeys(key) {
  const keys = new Set([RR_TREE_LEGACY_STORAGE_KEY, 'rr-atlas-arbol', `${key}-v1`]);
  if (key.endsWith('-v2')) keys.add(`${key.slice(0, -3)}v1`);
  keys.delete(key);
  return [...keys];
}

/** Valida la forma sin versión usada por el editor del ciclo anterior. */
export function parseLegacyRRGraph(text) {
  if (typeof text !== 'string') fail('LEGACY_INVALID', 'El guardado anterior no contiene texto JSON válido.');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    fail('LEGACY_INVALID', 'El guardado anterior está dañado y no se pudo migrar.', cause);
  }
  const candidate = isRecord(parsed) && isRecord(parsed.graph) ? parsed.graph : parsed;
  try {
    return validateRRGraph(candidate);
  } catch (cause) {
    fail('LEGACY_INVALID', `El guardado anterior no es válido y no se migró: ${cause.message}`, cause);
  }
}

/** Lee una clave legacy aislada sin borrarla ni escribir datos reales. */
export function loadLegacyRRGraph(storage, key = RR_TREE_LEGACY_STORAGE_KEY) {
  requireStorage(storage);
  let raw;
  try {
    raw = storage.getItem(key);
  } catch (cause) {
    fail('STORAGE_READ_FAILED', 'No se pudo leer el guardado anterior.', cause);
  }
  if (raw === null || raw === undefined || raw === '') return null;
  return parseLegacyRRGraph(raw);
}

export const migrateLegacyRRGraph = parseLegacyRRGraph;

export function loadRRGraph(storage, key = RR_TREE_STORAGE_KEY, fallback = null) {
  requireStorage(storage);
  let raw;
  try {
    raw = storage.getItem(key);
  } catch (cause) {
    fail('STORAGE_READ_FAILED', 'No se pudo leer el almacenamiento local; se conserva el mapa original.', cause);
  }
  if (raw !== null && raw !== undefined && raw !== '') return parseRRGraph(raw);

  for (const legacyKey of legacyStorageKeys(key)) {
    let legacyRaw;
    try {
      legacyRaw = storage.getItem(legacyKey);
    } catch (cause) {
      fail('STORAGE_READ_FAILED', 'No se pudo leer el guardado anterior.', cause);
    }
    if (legacyRaw === null || legacyRaw === undefined || legacyRaw === '') continue;
    const migrated = parseLegacyRRGraph(legacyRaw);
    try {
      storage.setItem(key, serializeRRGraph(migrated));
    } catch (cause) {
      fail('STORAGE_WRITE_FAILED', 'El guardado anterior es válido, pero no se pudo migrar a la nueva clave.', cause);
    }
    return migrated;
  }
  return fallback === null ? null : validateRRGraph(fallback);
}

function storageMessage(error) {
  return error?.message || 'No se pudo guardar el mapa; conserva la copia sin guardar o expórtala.';
}

/**
 * Store pequeño para el editor. commit clona y valida antes de asignar; el
 * snapshot de historial se agrega antes del cambio y un fallo de storage no
 * descarta el estado nuevo: queda marcado como no guardado.
 */
export function createRRTreeStore({
  initialGraph,
  storage = null,
  storageKey = RR_TREE_STORAGE_KEY,
  historyLimit = 40,
  onStorageError = () => {},
} = {}) {
  let graph = validateRRGraph(initialGraph);
  const original = clone(graph);
  const history = [];
  const future = [];
  const listeners = new Set();
  let dirty = false;
  let lastError = null;
  let loadedFromStorage = false;

  if (storage) {
    try {
      const saved = loadRRGraph(storage, storageKey, null);
      if (saved) {
        graph = saved;
        loadedFromStorage = true;
      }
    } catch (error) {
      lastError = error;
      onStorageError(error);
    }
  }

  const snapshot = (reason = 'snapshot') => ({
    graph: clone(graph),
    selectedId: null,
    reason,
    dirty,
    lastError,
  });
  const emit = (reason) => {
    const value = snapshot(reason);
    for (const listener of listeners) listener(value);
  };
  const persist = () => {
    if (!storage) {
      dirty = true;
      lastError = new RRTreeError('STORAGE_UNAVAILABLE', 'No hay almacenamiento local disponible; conserva el cambio o expórtalo como JSON.');
      onStorageError(lastError);
      return false;
    }
    try {
      saveRRGraph(storage, storageKey, graph);
      dirty = false;
      lastError = null;
      return true;
    } catch (error) {
      dirty = true;
      lastError = error;
      onStorageError(error);
      return false;
    }
  };
  const addHistory = (before) => {
    history.push(clone(before));
    if (history.length > historyLimit) history.shift();
    future.length = 0;
  };

  const commit = (mutator, reason = 'change', { before = null, persistChange = true } = {}) => {
    const draft = clone(graph);
    try {
      if (typeof mutator === 'function') mutator(draft);
      else if (mutator && typeof mutator === 'object') draft.nodes = mutator.nodes, draft.edges = mutator.edges;
      else fail('INVALID_GRAPH', 'El cambio del mapa no es una función ni un gráfico.');
      const next = validateRRGraph(draft);
      if (same(next, graph)) return false;
      // La entrada de historial se escribe antes de cambiar la referencia viva.
      addHistory(before ? validateRRGraph(before) : graph);
      graph = next;
      if (persistChange) persist();
      emit(reason);
      return true;
    } catch (error) {
      if (error instanceof RRTreeError) throw error;
      fail('INVALID_GRAPH', `No se pudo aplicar el cambio: ${error.message}`, error);
    }
  };

  return Object.freeze({
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot('init'));
      return () => listeners.delete(listener);
    },
    getGraph: () => clone(graph),
    getSnapshot: () => snapshot(),
    getStatus: () => ({ dirty, lastError, loadedFromStorage, canUndo: history.length > 0, canRedo: future.length > 0 }),
    commit,
    replace(nextGraph, { recordHistory = false, persistChange = true, reason = 'replace' } = {}) {
      const next = validateRRGraph(nextGraph);
      if (same(next, graph)) return false;
      if (recordHistory) addHistory(graph);
      graph = next;
      if (persistChange) persist();
      emit(reason);
      return true;
    },
    save() {
      const ok = persist();
      emit('save');
      return ok;
    },
    importJSON(text) {
      const imported = parseRRGraph(text);
      return commit(imported, 'import');
    },
    exportPayload() {
      return toRRPayload(graph);
    },
    undo() {
      const previous = history.pop();
      if (!previous) return false;
      future.push(clone(graph));
      graph = validateRRGraph(previous);
      persist();
      emit('undo');
      return true;
    },
    redo() {
      const next = future.pop();
      if (!next) return false;
      history.push(clone(graph));
      graph = validateRRGraph(next);
      persist();
      emit('redo');
      return true;
    },
    reset() {
      return commit(original, 'reset');
    },
    errorMessage(error = lastError) {
      return storageMessage(error);
    },
  });
}

function hierarchyMaps(graph) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const children = new Map(graph.nodes.map((node) => [node.id, []]));
  const parent = new Map();
  for (const edge of graph.edges) {
    if ((edge.kind ?? 'hierarchy') !== 'hierarchy' || !byId.has(edge.source) || !byId.has(edge.target)) continue;
    if (edge.source === edge.target || parent.has(edge.target)) continue;
    parent.set(edge.target, edge.source);
    children.get(edge.source).push(edge.target);
  }
  return { byId, children, parent };
}

export function getHierarchyChildren(graph, id) {
  const normalized = validateRRGraph(graph);
  const { children } = hierarchyMaps(normalized);
  return [...(children.get(id) ?? [])];
}

export function getHierarchyDescendants(graph, id) {
  const normalized = validateRRGraph(graph);
  const { children } = hierarchyMaps(normalized);
  const result = [];
  const seen = new Set([id]);
  const visit = (current) => {
    for (const child of children.get(current) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      result.push(child);
      visit(child);
    }
  };
  visit(id);
  return result;
}

export function getHierarchyPath(graph, id) {
  const normalized = validateRRGraph(graph);
  const { parent, byId } = hierarchyMaps(normalized);
  const path = [];
  const seen = new Set();
  let current = id;
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    path.unshift(byId.get(current));
    current = parent.get(current);
  }
  return path;
}

export function getDefaultCollapsedIds(graph) {
  const normalized = validateRRGraph(graph);
  return normalized.nodes.filter((node) => node.type === 'stage').map((node) => node.id);
}

export function collapseRRGraph(input, collapsedIds = []) {
  const graph = validateRRGraph(input);
  const collapsed = new Set(collapsedIds);
  const hidden = new Set();
  const hiddenCounts = {};
  for (const id of collapsed) {
    if (!graph.nodes.some((node) => node.id === id)) continue;
    const descendants = getHierarchyDescendants(graph, id);
    hiddenCounts[id] = descendants.length;
    descendants.forEach((descendant) => hidden.add(descendant));
  }
  const visibleIds = new Set(graph.nodes.filter((node) => !hidden.has(node.id)).map((node) => node.id));
  return {
    graph: {
      ...graph,
      nodes: graph.nodes.filter((node) => visibleIds.has(node.id)),
      edges: graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    },
    hiddenCounts,
    hiddenIds: [...hidden],
  };
}

function matchesFilter(node, filters) {
  const line = filters.line ?? filters.lineId;
  const stage = filters.stage;
  const bpmn = filters.bpmn ?? filters.statusKey ?? filters.status;
  const type = filters.type ?? filters.nodeType;
  if (line && line !== 'all' && node.lineId !== line) return false;
  if (stage && stage !== 'all' && node.stage !== stage) return false;
  if (bpmn && bpmn !== 'all' && node.statusKey !== bpmn && node.status !== bpmn) return false;
  if (type && type !== 'all' && node.type !== type) return false;
  if (filters.query && !normalizeSearch(nodeSearchText(node)).includes(normalizeSearch(filters.query))) return false;
  return true;
}

/** Filtra nodos y conserva sus ancestros jerárquicos para no romper el contexto. */
export function filterRRGraph(input, filters = {}) {
  const graph = validateRRGraph(input);
  const { parent } = hierarchyMaps(graph);
  const matching = new Set(graph.nodes.filter((node) => matchesFilter(node, filters)).map((node) => node.id));
  if (Object.values(filters).every((value) => !value || value === 'all')) {
    return graph;
  }
  for (const id of [...matching]) {
    let current = parent.get(id);
    while (current) {
      matching.add(current);
      current = parent.get(current);
    }
  }
  const nodes = graph.nodes.filter((node) => matching.has(node.id));
  const ids = new Set(nodes.map((node) => node.id));
  return { ...graph, nodes, edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
}

/**
 * Proyecta el grafo completo para la vista. Las búsquedas y filtros se
 * resuelven antes de colapsar: un resultado oculto vuelve visibles sus
 * ancestros y conserva el contexto jerárquico.
 */
export function projectRRGraph(input, { collapsedIds = [], filters = {}, query = '' } = {}) {
  const graph = validateRRGraph(input);
  const normalizedQuery = normalizeSearch(query);
  const activeFilters = Object.entries(filters).some(([key, value]) => key !== 'query' && value && value !== 'all');
  const active = Boolean(normalizedQuery || activeFilters);
  const collapsed = collapseRRGraph(graph, collapsedIds);
  if (!active) return { ...collapsed, expandedIds: [] };

  const filteredGraph = filterRRGraph(graph, { ...filters, query: normalizedQuery });
  const visibleIds = new Set(filteredGraph.nodes.map((node) => node.id));
  const expandedIds = collapsedIds.filter((id) => {
    if (!visibleIds.has(id)) return false;
    return getHierarchyDescendants(graph, id).some((descendant) => visibleIds.has(descendant));
  });
  return { graph: filteredGraph, hiddenCounts: collapsed.hiddenCounts, hiddenIds: graph.nodes.filter((node) => !visibleIds.has(node.id)).map((node) => node.id), expandedIds };
}

export function searchRRNodes(input, query) {
  const graph = validateRRGraph(input);
  const term = normalizeSearch(query);
  if (!term) return graph.nodes;
  return graph.nodes.filter((node) => normalizeSearch(nodeSearchText(node)).includes(term));
}

export function findRRNode(input, query) {
  return searchRRNodes(input, query)[0] ?? null;
}

function layoutTree(graph, options = {}) {
  const gapX = options.gapX ?? 34;
  const gapY = options.gapY ?? 64;
  const startX = options.startX ?? 40;
  const startY = options.startY ?? 42;
  const { byId, children, parent } = hierarchyMaps(graph);
  const treeChildren = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const [id, childIds] of children) {
    if (SHARED_TYPES.has(byId.get(id)?.type)) continue;
    for (const childId of childIds) {
      if (!SHARED_TYPES.has(byId.get(childId)?.type)) treeChildren.get(id).push(childId);
    }
  }

  const treeRoots = graph.nodes.filter((node) => !SHARED_TYPES.has(node.type) && !parent.has(node.id));
  const visited = new Set();
  const depth = new Map();
  const measureMemo = new Map();
  const measure = (id, stack = new Set()) => {
    if (measureMemo.has(id)) return measureMemo.get(id);
    if (stack.has(id)) return getCardSize(byId.get(id)).width;
    const nextStack = new Set(stack).add(id);
    const own = getCardSize(byId.get(id)).width;
    const childWidth = treeChildren.get(id).reduce((total, childId, index) => (
      total + measure(childId, nextStack) + (index ? gapX : 0)
    ), 0);
    const width = Math.max(own, childWidth);
    measureMemo.set(id, width);
    return width;
  };

  const allRoots = [...treeRoots];
  for (const node of graph.nodes) {
    if (!SHARED_TYPES.has(node.type) && !allRoots.includes(node) && !visited.has(node.id)) allRoots.push(node);
  }
  const positions = new Map();
  const assign = (id, left, currentDepth, stack = new Set()) => {
    if (stack.has(id) || visited.has(id)) return;
    visited.add(id);
    depth.set(id, currentDepth);
    const width = measure(id);
    const childIds = treeChildren.get(id) ?? [];
    if (!childIds.length) {
      positions.set(id, { x: left, depth: currentDepth });
      return;
    }
    const childTotal = childIds.reduce((total, childId, index) => total + measure(childId) + (index ? gapX : 0), 0);
    let childLeft = left + Math.max(0, (width - childTotal) / 2);
    for (const childId of childIds) {
      assign(childId, childLeft, currentDepth + 1, new Set(stack).add(id));
      childLeft += measure(childId) + gapX;
    }
    positions.set(id, { x: left + (width - getCardSize(byId.get(id)).width) / 2, depth: currentDepth });
  };

  let cursor = startX;
  for (const root of allRoots) {
    if (visited.has(root.id)) continue;
    assign(root.id, cursor, 0);
    cursor += measure(root.id) + gapX * 2;
  }

  const rowHeights = [];
  for (const [id, currentDepth] of depth) {
    rowHeights[currentDepth] = Math.max(rowHeights[currentDepth] ?? 0, getCardSize(byId.get(id)).height);
  }
  const rowY = [];
  for (let index = 0; index < rowHeights.length; index += 1) {
    rowY[index] = index === 0 ? startY : rowY[index - 1] + rowHeights[index - 1] + gapY;
  }
  const positioned = new Map();
  for (const [id, point] of positions) positioned.set(id, { x: Math.round(point.x), y: Math.round(rowY[point.depth] ?? startY) });
  return { positioned, rowY, lastTreeY: rowY.length ? rowY.at(-1) + rowHeights.at(-1) : startY };
}

/**
 * Ordena de arriba abajo. Solo kind=hierarchy decide padre e hijos; los
 * enlaces responsibility/project/cross/client se conservan pero nunca alteran
 * el árbol ni generan multiparent. Bots, proyectos y clientes quedan en una
 * banda inferior independiente para evitar solapes.
 */
export function layoutRRGraph(input, options = {}) {
  const graph = validateRRGraph(input);
  const { positioned, lastTreeY } = layoutTree(graph, options);
  const bandGap = options.bandGap ?? 150;
  const sharedGap = options.sharedGap ?? 34;
  const sharedStartY = lastTreeY + bandGap;
  const shared = graph.nodes.filter((node) => !positioned.has(node.id) || SHARED_TYPES.has(node.type));
  const positions = new Map(positioned);
  const maxWidth = options.bandWidth ?? Math.max(1_200, (options.canvasWidth ?? 3_400) - 80);
  let x = options.startX ?? 40;
  let y = sharedStartY;
  let rowHeight = 0;
  for (const node of shared) {
    const size = getCardSize(node);
    if (x > (options.startX ?? 40) && x + size.width > maxWidth) {
      x = options.startX ?? 40;
      y += rowHeight + sharedGap;
      rowHeight = 0;
    }
    positions.set(node.id, { x: Math.round(x), y: Math.round(y) });
    x += size.width + sharedGap;
    rowHeight = Math.max(rowHeight, size.height);
  }
  const nodes = graph.nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? { x: node.x, y: node.y }) }));
  return { ...graph, nodes };
}

export const layoutGraph = layoutRRGraph;

export function getGraphBounds(input, nodeIds = null) {
  const graph = validateRRGraph(input);
  const selected = nodeIds ? new Set(nodeIds) : null;
  const nodes = graph.nodes.filter((node) => !selected || selected.has(node.id));
  if (!nodes.length) return { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 };
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + getCardSize(node).width));
  const bottom = Math.max(...nodes.map((node) => node.y + getCardSize(node).height));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function findNodeOverlaps(input) {
  const graph = validateRRGraph(input);
  const overlaps = [];
  for (let leftIndex = 0; leftIndex < graph.nodes.length; leftIndex += 1) {
    const left = graph.nodes[leftIndex];
    const leftSize = getCardSize(left);
    for (let rightIndex = leftIndex + 1; rightIndex < graph.nodes.length; rightIndex += 1) {
      const right = graph.nodes[rightIndex];
      const rightSize = getCardSize(right);
      if (
        left.x < right.x + rightSize.width &&
        left.x + leftSize.width > right.x &&
        left.y < right.y + rightSize.height &&
        left.y + leftSize.height > right.y
      ) overlaps.push([left.id, right.id]);
    }
  }
  return overlaps;
}

export const hasOverlaps = (graph) => findNodeOverlaps(graph).length > 0;

export function hierarchyEdgeCrossings(input) {
  const graph = validateRRGraph(input);
  const { parent } = hierarchyMaps(graph);
  const hierarchy = graph.edges.filter((edge) => edge.kind === 'hierarchy');
  const crossings = [];
  const segment = (edge) => {
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!source || !target) return null;
    return { left: source.x + getCardSize(source).width / 2, right: target.x + getCardSize(target).width / 2, top: source.y, bottom: target.y };
  };
  const segments = hierarchy.map(segment).filter(Boolean);
  for (let i = 0; i < segments.length; i += 1) for (let j = i + 1; j < segments.length; j += 1) {
    const a = segments[i]; const b = segments[j];
    if (a.bottom <= b.top || b.bottom <= a.top) continue;
    if ((a.left - b.left) * (a.right - b.right) < 0) crossings.push([hierarchy[i], hierarchy[j]]);
  }
  return crossings;
}

/** Helper reutilizable para comandos que necesiten un commit sin DOM. */
export function commitGraph(currentGraph, mutator, { history = [], historyLimit = 40 } = {}) {
  const before = validateRRGraph(currentGraph);
  const draft = clone(before);
  if (typeof mutator !== 'function') fail('INVALID_GRAPH', 'El commit necesita una función mutadora.');
  mutator(draft);
  const next = validateRRGraph(draft);
  if (same(next, before)) return { graph: before, history: [...history], future: [], changed: false };
  const nextHistory = [...history, clone(before)];
  return {
    graph: next,
    history: nextHistory.slice(-historyLimit),
    future: [],
    changed: true,
  };
}

export const searchNodes = searchRRNodes;
export const searchGraph = searchRRNodes;
export const filterGraph = filterRRGraph;
export const projectGraph = projectRRGraph;
export const projectVisibleGraph = projectRRGraph;
export const projectVisibleRRGraph = projectRRGraph;
export const collapseGraph = collapseRRGraph;
export const parseSnapshot = parseRRGraph;
export const parseGraph = parseRRGraph;
export const serializeGraph = serializeRRGraph;
export const validateGraph = validateRRGraph;
export const saveGraph = saveRRGraph;
export const loadGraph = loadRRGraph;
export const createTreeStore = createRRTreeStore;
