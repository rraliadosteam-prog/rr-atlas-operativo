import localOverrides from './local-overrides.mjs';
import {
  FALLBACK_STATUS,
  bots as botDefinitions,
  etapas as stages,
  evidencias as crossEvidence,
  lineas as lineDefinitions,
  procesos as processRows,
} from './dataset-publico.mjs';

const statusLabels = {
  valido: 'BPMN válido',
  borrador: 'Borrador',
  deuda: 'BPMN con deuda',
  texto: 'Solo texto',
  'no-existe': 'No existe',
  pausa: 'En pausa',
};

const statusTone = (status) => status === 'valido' ? 'ok' : ['borrador', 'deuda', 'pausa'].includes(status) ? 'warn' : 'off';
const safeId = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Se conservan los IDs de los dos bots que ya eran públicos. Los demás son
// estables y no dependen de nombres de personas, clientes o proyectos reales.
const LOCAL_NODE_FIELDS = [
  'title',
  'shortTitle',
  'desc',
  'owner',
  'kpi',
  'bpmnPath',
  'status',
  'statusKey',
  'notes',
  'links',
  'media',
  'metadata',
];

const cloneValue = (value) => {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const collectLocalEntries = (data) => {
  if (!data) return [];
  const raw = Array.isArray(data) ? data : data.nodes ?? data.overrides ?? data;
  if (Array.isArray(raw)) return raw.filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string');
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .filter(([, patch]) => patch && typeof patch === 'object' && !Array.isArray(patch))
    .map(([id, patch]) => ({ ...patch, id }));
};

/**
 * Aplica únicamente metadatos privados a nodos públicos ya existentes.
 * No agrega nodos, no cambia IDs, geometría, tipos ni aristas.
 */
export function applyLocalData(graph, data) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new TypeError('El grafo debe tener las colecciones nodes y edges.');
  }
  const overrides = new Map(collectLocalEntries(data).map((entry) => [entry.id, entry]));
  const nodes = graph.nodes.map((node) => {
    const patch = overrides.get(node.id);
    if (!patch) return { ...node };
    const next = { ...node };
    const metadataPatch = patch.metadata && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata)
      ? { ...patch.metadata, ...patch }
      : patch;
    for (const field of LOCAL_NODE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(metadataPatch, field)) next[field] = cloneValue(metadataPatch[field]);
    }
    return next;
  });
  const edges = graph.edges.map((edge) => cloneValue(edge));
  return { ...graph, nodes, edges };
}

export function createRRGraph(localData = localOverrides) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeKeys = new Set();
  const addNode = (node) => {
    if (!node?.id || nodeIds.has(node.id)) throw new Error(`ID de nodo duplicado: ${node?.id ?? 'vacío'}`);
    const next = { editable: true, ...node };
    nodes.push(next);
    nodeIds.add(next.id);
    return next;
  };
  const addEdge = (source, target, kind = 'hierarchy', metadata = {}) => {
    if (source === target) throw new Error(`Autoenlace no permitido: ${source}`);
    if (!nodeIds.has(source) || !nodeIds.has(target)) throw new Error(`Arista huérfana: ${source} → ${target}`);
    const key = `${source}\u0000${target}\u0000${kind}`;
    if (edgeKeys.has(key)) throw new Error(`Arista duplicada: ${source} → ${target}`);
    const edge = { ...metadata, source, target, kind };
    edges.push(edge);
    edgeKeys.add(key);
    return edge;
  };

  const laneWidth = 430;
  const rootX = 7 * laneWidth / 2 - 135;
  addNode({
    id: 'rr-labs',
    title: 'RR Labs',
    type: 'root',
    level: 0,
    x: rootX,
    y: 70,
    color: 'ink',
    status: 'Sistema completo',
    desc: 'Mapa interno de líneas, etapas, procesos, proyectos y bots responsables.',
    owner: 'Dirección',
    stage: '',
    lineId: 'root',
  });

  botDefinitions.forEach((bot, index) => {
    addNode({
      id: bot.id,
      title: bot.title,
      type: 'bot',
      level: 4,
      x: 150 + index * 220,
      y: 2320,
      color: 'orchid',
      status: FALLBACK_STATUS,
      desc: 'Bot interno representado por un rol genérico; solo se enlaza con evidencia de las fuentes.',
      owner: 'Rol genérico',
      lineId: 'transversal',
      stage: '',
    });
  });

  lineDefinitions.forEach((line, lineIndex) => {
    const lineX = 100 + lineIndex * laneWidth;
    const lineId = `line-${line.id}`;
    addNode({
      id: lineId,
      title: line.title,
      type: 'line',
      level: 1,
      x: lineX,
      y: 260,
      color: line.color,
      status: line.state,
      desc: 'Línea de negocio con clientes y proyectos representados de forma genérica.',
      owner: line.state === 'Por confirmar' ? FALLBACK_STATUS : 'Dirección',
      lineId: line.id,
      stage: '',
    });
    addEdge('rr-labs', lineId);

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
      const [stageId, stageTitle] = stages[stageIndex];
      const stageNodeId = `stage-${line.id}-${stageId}`;
      const processList = processRows.filter((row) => row[2] === line.id && row[3] === stageId);
      const stageY = 470 + stageIndex * 345;
      addNode({
        id: stageNodeId,
        title: stageTitle,
        type: 'stage',
        level: 2,
        x: lineX + 44,
        y: stageY,
        color: line.color,
        status: `${processList.length} proceso${processList.length === 1 ? '' : 's'}`,
        desc: `Etapa de ${line.title}. Las etapas se interpretan dentro de cada línea.`,
        owner: line.state === 'Por confirmar' ? FALLBACK_STATUS : 'Dirección',
        lineId: line.id,
        stage: stageId,
      });
      addEdge(lineId, stageNodeId);

      processList.forEach((row, processIndex) => {
        const [id, title, , , status, bot, owner] = row;
        const processId = `process-${safeId(id)}`;
        const processX = lineX + (processIndex - (processList.length - 1) / 2) * 230;
        const processY = stageY + 132;
        addNode({
          id: processId,
          title: `${id} · ${title}`,
          shortTitle: id,
          type: 'process',
          level: 3,
          x: processX,
          y: processY,
          color: statusTone(status),
          status: statusLabels[status],
          statusKey: status,
          desc: `Proceso del inventario v0. Bot o ejecutor documentado: ${bot}.`,
          owner,
          bot,
          lineId: line.id,
          stage: stageId,
          source: 'atlas_mapa/inventario_v0.md',
        });
        addEdge(stageNodeId, processId);
      });
    }

    const projectId = line.projectId ?? `project-${safeId(line.project)}`;
    addNode({
      id: projectId,
      title: line.project,
      type: 'project',
      level: 4,
      x: lineX + 125,
      y: 2320,
      color: 'mustard',
      status: 'Proyecto genérico',
      desc: 'Nodo interno sin nombres ni datos de clientes reales.',
      owner: 'Equipo RR',
      lineId: line.id,
      stage: '',
    });
    processRows.filter((row) => row[2] === line.id).forEach(([id]) => {
      addEdge(`process-${safeId(id)}`, projectId, 'project');
    });

    const clientId = `client-${line.id}`;
    addNode({
      id: clientId,
      title: `Cliente genérico · ${line.title}`,
      type: 'client',
      level: 4,
      x: lineX + 44,
      y: 2175,
      color: 'mustard',
      status: 'Nodo interno',
      desc: 'Representación genérica; no contiene nombres reales.',
      owner: 'Cliente genérico',
      lineId: line.id,
      stage: '',
    });
    addEdge(lineId, clientId, 'client');
  });

  crossEvidence.forEach(([botId, processCode, source, evidence]) => {
    const processId = `process-${safeId(processCode)}`;
    addEdge(botId, processId, 'cross', {
      evidence: { source, detail: evidence },
    });
  });

  const linkedBots = new Set(edges.filter((edge) => edge.kind === 'cross').map((edge) => edge.source));
  nodes.filter((node) => node.type === 'bot').forEach((node) => {
    if (linkedBots.has(node.id)) node.status = 'Responsable con fuente';
  });

  return applyLocalData({ nodes, edges, source: 'atlas_mapa/inventario_v0.md' }, localData);
}

/**
 * Corrige copia heredada que describe el mapa como público.
 * No muta datos personalizados ni textos en los que "público" es parte
 * de un dominio (p. ej. "sector público").
 */
export function getInternalTreeCopy(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/Mapa público de líneas, etapas, procesos, proyectos y bots responsables\./g, 'Mapa interno de líneas, etapas, procesos, proyectos y bots responsables.')
    .replace(/Mapa público seguro\./g, 'Mapa interno seguro.')
    .replace(/Bot público representado por un rol genérico; solo se enlaza con evidencia de las fuentes\./g, 'Bot interno representado por un rol genérico; solo se enlaza con evidencia de las fuentes.')
    .replace(/Nodo público sin nombres ni datos de clientes reales\./g, 'Nodo interno sin nombres ni datos de clientes reales.')
    .replace(/Nodo público\b/g, 'Nodo interno')
    .replace(/Sin descripción pública\./g, 'Sin descripción interna.')
    .replace(/alcance público/g, 'alcance interno');
}

export { FALLBACK_STATUS, botDefinitions, lineDefinitions, processRows, stages, statusLabels };
