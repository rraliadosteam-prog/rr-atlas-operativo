import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { DEFAULT_GRAPH } from './default-graph.mjs';
import { DIRECTUS_GRAPH } from './directus-graph.mjs';
import {
  FALLBACK_STATUS,
  applyLocalData,
  botDefinitions,
  createRRGraph,
  processRows,
} from './rr-tree.mjs';

const graph = createRRGraph();
const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

const expectedBotTitles = [
  'Bot Captación',
  'Bot Ropa SaaS',
  'Bot Resto SaaS',
  'Bot Buen Puente',
  'Bot Creadores',
  'Bot Marca RR',
  'Bot Media Manager',
  'Bot Fin',
  'Bot Gains',
  'Bot Becas y Exposicion',
  'Bot Pingui',
  'Bot secre',
  'Botardo',
  'Bot Atlas',
];

test('crea nodos únicos, aristas válidas y etapas por línea', () => {
  assert.ok(graph.nodes.length > processRows.length);
  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length);
  for (const edge of graph.edges) {
    assert.notEqual(edge.source, edge.target);
    assert.ok(nodeById.has(edge.source), `origen inexistente: ${edge.source}`);
    assert.ok(nodeById.has(edge.target), `destino inexistente: ${edge.target}`);
  }
  for (const row of processRows) {
    const processNode = nodeById.get(`process-${row[0].toLowerCase()}`);
    assert.ok(processNode, `falta el proceso ${row[0]}`);
    assert.equal(processNode.lineId, row[2]);
    assert.equal(processNode.stage, row[3]);
  }
  assert.ok(nodeById.has('stage-ropa-captacion'));
  assert.ok(nodeById.has('stage-restaurantes-captacion'));
  assert.notEqual(nodeById.get('stage-ropa-captacion').id, nodeById.get('stage-restaurantes-captacion').id);
});

test('incluye cada bot enumerado como nodo individual', () => {
  assert.equal(botDefinitions.length, expectedBotTitles.length);
  for (const title of expectedBotTitles) {
    const matches = graph.nodes.filter((node) => node.type === 'bot' && node.title === title);
    assert.equal(matches.length, 1, `bot duplicado o ausente: ${title}`);
  }
});

test('cada enlace cruzado tiene fuente y evidencia por arista', () => {
  const allowedSources = new Set([
    'atlas_mapa/inventario_v0.md',
    'atlas_mapa/insumos/bots_1209.md',
    'atlas_mapa/insumos/bots_1210.md',
  ]);
  const crossEdges = graph.edges.filter((edge) => edge.kind === 'cross');
  assert.ok(crossEdges.length >= 10);
  for (const edge of crossEdges) {
    assert.equal(nodeById.get(edge.source).type, 'bot');
    assert.equal(nodeById.get(edge.target).type, 'process');
    assert.ok(allowedSources.has(edge.evidence?.source));
    assert.match(edge.evidence?.detail ?? '', /.+/);
  }
});

test('los bots sin evidencia quedan sin cross y con estado exacto de confirmación', () => {
  const crossSources = new Set(graph.edges.filter((edge) => edge.kind === 'cross').map((edge) => edge.source));
  for (const bot of graph.nodes.filter((node) => node.type === 'bot')) {
    if (!crossSources.has(bot.id)) {
      assert.equal(bot.status, FALLBACK_STATUS);
      assert.equal(graph.edges.filter((edge) => edge.source === bot.id || edge.target === bot.id).length, 0, 'Un bot sin fuente no debe tener enlaces inventados');
    }
  }
  assert.equal(nodeById.get('bot-bot-creadores').status, FALLBACK_STATUS);
  assert.equal(nodeById.get('bot-media-manager').status, FALLBACK_STATUS);
  assert.equal(nodeById.get('bot-atlas').status, FALLBACK_STATUS);
});

test('mantiene clientes y proyectos genéricos en los datos públicos', () => {
  const publicEntities = graph.nodes.filter((node) => ['client', 'project'].includes(node.type));
  assert.ok(publicEntities.length >= 7);
  for (const node of publicEntities) {
    assert.match(node.title, /genéric/i);
    assert.doesNotMatch(node.desc, /nombre real|dato real/i);
  }

  for (const node of DIRECTUS_GRAPH.data) {
    assert.match(node.title, /genéric/i);
    assert.equal(node.owner, 'Rol genérico');
  }
  for (const node of DEFAULT_GRAPH.data) assert.match(node.title, /ejemplo/i);
});

test('aplica datos locales de forma inmutable y solo a nodos existentes', () => {
  const before = structuredClone(graph);
  const target = graph.nodes.find((node) => node.id === 'client-ropa');
  const result = applyLocalData(graph, {
    nodes: {
      'client-ropa': {
        title: 'Cliente privado de ejemplo',
        desc: 'Descripción privada de ejemplo',
        owner: 'Rol privado de ejemplo',
        kpi: 'KPI privado de ejemplo',
        x: 9999,
        type: 'root',
        id: 'otro-id',
      },
      'unknown-node': { title: 'No debe aparecer' },
    },
  });

  assert.notStrictEqual(result, graph);
  assert.deepEqual(graph, before);
  assert.equal(result.nodes.length, graph.nodes.length);
  assert.equal(result.edges.length, graph.edges.length);
  const updated = result.nodes.find((node) => node.id === 'client-ropa');
  assert.equal(updated.title, 'Cliente privado de ejemplo');
  assert.equal(updated.desc, 'Descripción privada de ejemplo');
  assert.equal(updated.owner, 'Rol privado de ejemplo');
  assert.equal(updated.kpi, 'KPI privado de ejemplo');
  assert.equal(updated.x, target.x);
  assert.equal(updated.type, target.type);
  assert.equal(result.nodes.some((node) => node.id === 'unknown-node'), false);
  assert.notStrictEqual(result.nodes, graph.nodes);
  assert.notStrictEqual(result.edges, graph.edges);
});

test('la carga inicial integra el overlay local sin cambiar el grafo público', () => {
  const publicGraph = createRRGraph();
  const localGraph = createRRGraph({ nodes: { 'client-ropa': { title: 'Cliente local de ejemplo' } } });
  assert.equal(localGraph.nodes.find((node) => node.id === 'client-ropa').title, 'Cliente local de ejemplo');
  assert.match(publicGraph.nodes.find((node) => node.id === 'client-ropa').title, /genérico/);
  assert.deepEqual(localGraph.edges, publicGraph.edges);
});

test('el fixture documental público también usa etiquetas y rutas genéricas', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../public/grafo/grafo.json', import.meta.url), 'utf8'));
  assert.ok(fixture.docs.length > 0);
  assert.ok(fixture.docs.every((doc) => /^Documento genérico \d+$/.test(doc.title)), 'El fixture público no debe contener títulos privados');
  assert.ok(fixture.docs.every((doc) => doc.owner === 'Rol genérico' && doc.obsidian === '' && doc.headings.length === 0));
  for (const [source, target] of fixture.edges) {
    assert.ok(source >= 0 && source < fixture.docs.length);
    assert.ok(target >= 0 && target < fixture.docs.length);
  }
});

test('acepta lista de sobreescrituras y no toca la geometría', () => {
  const target = graph.nodes.find((node) => node.id === 'process-ro-1');
  const result = applyLocalData(graph, {
    nodes: [{ id: target.id, status: 'Estado privado de ejemplo', y: -50 }],
  });
  assert.equal(result.nodes.find((node) => node.id === target.id).status, 'Estado privado de ejemplo');
  assert.equal(result.nodes.find((node) => node.id === target.id).y, target.y);
});
