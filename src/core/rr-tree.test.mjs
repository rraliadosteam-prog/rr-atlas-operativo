import test from 'node:test';
import assert from 'node:assert/strict';
import { createRRGraph } from '../data/rr-tree.mjs';
import {
  CARD_SIZES,
  RRTreeError,
  collapseRRGraph,
  createRRTreeStore,
  findNodeOverlaps,
  filterRRGraph,
  getCardSize,
  getGraphBounds,
  getHierarchyPath,
  hierarchyEdgeCrossings,
  layoutRRGraph,
  loadLegacyRRGraph,
  normalizeSearch,
  projectRRGraph,
  parseRRGraph,
  saveRRGraph,
  searchRRNodes,
  serializeRRGraph,
} from './rr-tree.mjs';

const smallGraph = () => ({
  nodes: [
    { id: 'root', title: 'Árbol', type: 'root', x: 0, y: 0 },
    { id: 'line', title: 'Línea', type: 'line', lineId: 'ropa', x: 0, y: 0 },
    { id: 'stage', title: 'Captación', type: 'stage', lineId: 'ropa', stage: 'captacion', x: 0, y: 0 },
    { id: 'process', title: 'Prospección', type: 'process', lineId: 'ropa', stage: 'captacion', statusKey: 'borrador', status: 'Borrador', owner: 'Rol genérico', x: 0, y: 0 },
    { id: 'bot', title: 'Bot compartido', type: 'bot', x: 0, y: 0 },
  ],
  edges: [
    { source: 'root', target: 'line', kind: 'hierarchy' },
    { source: 'line', target: 'stage', kind: 'hierarchy' },
    { source: 'stage', target: 'process', kind: 'hierarchy' },
    { source: 'process', target: 'bot', kind: 'responsibility' },
  ],
});

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('carga y validación clonan el grafo sin mutar la entrada', () => {
  const original = createRRGraph();
  const before = structuredClone(original);
  const parsed = parseRRGraph(serializeRRGraph(original));
  assert.deepEqual(original, before);
  assert.deepEqual(parsed.nodes, original.nodes);
  assert.deepEqual(parsed.edges, original.edges);
  assert.notStrictEqual(parsed, original);
});

test('layout arriba-abajo coincide con las tarjetas y evita solapes o cruces jerárquicos', () => {
  const laidOut = layoutRRGraph(createRRGraph());
  assert.equal(findNodeOverlaps(laidOut).length, 0);
  assert.equal(hierarchyEdgeCrossings(laidOut).length, 0);
  const bounds = getGraphBounds(laidOut);
  assert.ok(bounds.width > 0 && bounds.height > 0);
  assert.deepEqual(getCardSize(laidOut.nodes.find((node) => node.type === 'root')), CARD_SIZES.root);
  for (const node of laidOut.nodes) {
    const parent = laidOut.edges.find((edge) => edge.kind === 'hierarchy' && edge.target === node.id);
    if (parent) {
      const source = laidOut.nodes.find((item) => item.id === parent.source);
      assert.ok(node.y > source.y, `${node.id} debe estar debajo de su padre`);
    }
  }
});

test('guardar y cargar usa JSON versionado', () => {
  const storage = memoryStorage();
  const graph = smallGraph();
  saveRRGraph(storage, 'test', graph);
  const raw = storage.values.get('test');
  assert.equal(JSON.parse(raw).schemaVersion, 1);
  const store = createRRTreeStore({ initialGraph: graph, storage, storageKey: 'test' });
  assert.deepEqual(store.getGraph(), graph);
  assert.equal(store.getStatus().loadedFromStorage, true);
});

test('commit, deshacer y rehacer conservan el orden de historial', () => {
  const graph = smallGraph();
  const store = createRRTreeStore({ initialGraph: graph, storage: memoryStorage(), storageKey: 'history' });
  store.commit((draft) => { draft.nodes[0].title = 'Primero'; }, 'rename');
  store.commit((draft) => { draft.nodes.push({ id: 'new', title: 'Nuevo', type: 'note', x: 0, y: 0 }); }, 'add');
  assert.equal(store.getGraph().nodes.length, 6);
  assert.equal(store.undo(), true);
  assert.equal(store.getGraph().nodes.length, 5);
  assert.equal(store.getGraph().nodes[0].title, 'Primero');
  assert.equal(store.undo(), true);
  assert.equal(store.getGraph().nodes[0].title, 'Árbol');
  assert.equal(store.redo(), true);
  assert.equal(store.getGraph().nodes[0].title, 'Primero');
});

test('JSON inválido rechaza con mensaje claro y no modifica el mapa', () => {
  const graph = smallGraph();
  const store = createRRTreeStore({ initialGraph: graph });
  const before = store.getGraph();
  assert.throws(() => store.importJSON('{ roto'), (error) => {
    assert.ok(error instanceof RRTreeError);
    assert.match(error.message, /JSON inválido/);
    return true;
  });
  assert.deepEqual(store.getGraph(), before);
  assert.throws(() => parseRRGraph(JSON.stringify({ schemaVersion: 1, nodes: [], edges: [{ source: 'a', target: 'b' }] })), /JSON inválido/);
});

test('búsqueda y filtros ignoran acentos y conservan contexto jerárquico', () => {
  const graph = smallGraph();
  assert.equal(normalizeSearch('Captación'), 'captacion');
  assert.equal(searchRRNodes(graph, 'captacion')[0].id, 'stage');
  const filtered = filterRRGraph(graph, { line: 'ropa', stage: 'captacion', bpmn: 'borrador', type: 'process' });
  assert.deepEqual(filtered.nodes.map((node) => node.id), ['root', 'line', 'stage', 'process']);
});

test('colapsar devuelve contador y no elimina el grafo original', () => {
  const graph = smallGraph();
  const before = structuredClone(graph);
  const collapsed = collapseRRGraph(graph, ['line']);
  assert.equal(collapsed.hiddenCounts.line, 2);
  assert.deepEqual(collapsed.graph.nodes.map((node) => node.id), ['root', 'line', 'bot']);
  assert.deepEqual(graph, before);
  assert.deepEqual(getHierarchyPath(graph, 'process').map((node) => node.id), ['root', 'line', 'stage', 'process']);
});

test('fallo de storage conserva el cambio y lo marca no guardado', () => {
  const errors = [];
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const store = createRRTreeStore({ initialGraph: smallGraph(), storage, onStorageError: (error) => errors.push(error) });
  store.commit((draft) => { draft.nodes[0].title = 'Sin guardar'; });
  assert.equal(store.getGraph().nodes[0].title, 'Sin guardar');
  assert.equal(store.getStatus().dirty, true);
  assert.ok(errors.length > 0);
});

test('storage ausente conserva cambios y deja el estado sucio', () => {
  const store = createRRTreeStore({ initialGraph: smallGraph() });
  store.commit((draft) => { draft.nodes[0].title = 'Sin almacenamiento'; });
  assert.equal(store.getGraph().nodes[0].title, 'Sin almacenamiento');
  assert.equal(store.getStatus().dirty, true);
  assert.equal(store.getStatus().lastError.code, 'STORAGE_UNAVAILABLE');
});

test('rechaza ciclos y múltiples padres jerárquicos sin mutar la entrada', () => {
  const cyclic = smallGraph();
  cyclic.edges = cyclic.edges.filter((edge) => !(edge.source === 'root' && edge.target === 'line'));
  cyclic.edges.push({ source: 'stage', target: 'line', kind: 'hierarchy' });
  assert.throws(() => parseRRGraph(JSON.stringify({ schemaVersion: 1, ...cyclic })), /ciclo/i);
  const multiParent = smallGraph();
  multiParent.edges.push({ source: 'root', target: 'stage', kind: 'hierarchy' });
  const before = structuredClone(multiParent);
  assert.throws(() => parseRRGraph(JSON.stringify({ schemaVersion: 1, ...multiParent })), /múltiples padres/i);
  assert.deepEqual(multiParent, before);
});

test('migra la clave legacy a v2 sin borrar la fuente anterior', () => {
  const storage = memoryStorage();
  const legacy = smallGraph();
  storage.setItem('rr-atlas-arbol-v1', JSON.stringify(legacy));
  const loaded = loadLegacyRRGraph(storage, 'rr-atlas-arbol-v1');
  assert.deepEqual(loaded, legacy);
  const store = createRRTreeStore({ initialGraph: smallGraph(), storage, storageKey: 'rr-atlas-arbol-v2' });
  assert.deepEqual(store.getGraph(), legacy);
  assert.equal(JSON.parse(storage.values.get('rr-atlas-arbol-v2')).schemaVersion, 1);
  assert.equal(storage.values.get('rr-atlas-arbol-v1'), JSON.stringify(legacy));
});

test('proyección de búsqueda y filtros usa el grafo pleno y expande ancestros ocultos', () => {
  const graph = smallGraph();
  const projected = projectRRGraph(graph, { collapsedIds: ['line'], query: 'Prospección' });
  assert.deepEqual(projected.graph.nodes.map((node) => node.id), ['root', 'line', 'stage', 'process']);
  assert.ok(projected.expandedIds.includes('line'));
  const filtered = projectRRGraph(graph, {
    collapsedIds: ['line'],
    filters: { line: 'ropa', stage: 'captacion', bpmn: 'borrador', type: 'process' },
  });
  assert.deepEqual(filtered.graph.nodes.map((node) => node.id), ['root', 'line', 'stage', 'process']);
});
