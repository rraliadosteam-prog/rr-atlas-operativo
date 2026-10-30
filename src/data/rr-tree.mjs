import localOverrides from './local-overrides.mjs';

const FALLBACK_STATUS = 'Por confirmar con Rosas';

const stages = [
  ['captacion', 'Captación'],
  ['venta', 'Venta'],
  ['entrega', 'Entrega'],
  ['cobro', 'Cobro'],
  ['soporte', 'Soporte'],
];

const lineDefinitions = [
  { id: 'ropa', title: 'SaaS ropa', state: 'Piloto', color: 'fuchsia', bot: 'Bot Ropa SaaS', project: 'Proyecto tienda genérica', projectId: 'project-proyecto-tienda-generica' },
  { id: 'restaurantes', title: 'SaaS restaurantes', state: 'Opera', color: 'orchid', bot: 'Bot Resto SaaS', project: 'Proyecto núcleo multi-tenant genérico', projectId: 'project-proyecto-nucleo-multi-tenant' },
  { id: 'buen-puente', title: 'Buen Puente', state: 'Pre-lanzamiento', color: 'mustard', bot: 'Bot Buen Puente', project: 'Proyecto marketplace genérico', projectId: 'project-proyecto-marketplace-generico' },
  { id: 'creadores', title: 'Creadores', state: 'No opera', color: 'fuchsia', bot: 'Bot Creadores', project: 'Proyecto creadores genérico', projectId: 'project-proyecto-infoproductos' },
  { id: 'a-la-medida', title: 'Desarrollo a la medida', state: 'Por confirmar', color: 'mustard', bot: 'Bot Pingui', project: 'Proyecto software a medida genérico', projectId: 'project-proyecto-software-a-medida' },
  { id: 'contenido', title: 'Contenido y pauta', state: 'Por confirmar', color: 'orchid', bot: 'Bot Pingui', project: 'Proyecto Content Hub genérico', projectId: 'project-proyecto-content-hub-generico' },
  { id: 'otras', title: 'Otras líneas', state: 'Transversal', color: 'ink', bot: 'Bot Fin', project: 'Proyectos transversales genéricos', projectId: 'project-proyectos-transversales' },
];

// Cada fila conserva el contrato que consume la vista: id, título, línea, etapa,
// estado del esquema, bots mencionados por una fuente y dueño como rol.
const processRows = [
  ['RO-1', 'Prospección outbound de marcas de ropa', 'ropa', 'captacion', 'borrador', 'Bot Captación + Bot Ropa SaaS', 'Dirección'],
  ['RO-2', 'Oferta, demo, propuesta, contrato y primer pago', 'ropa', 'venta', 'texto', 'Bot Ropa SaaS', 'Dirección'],
  ['RO-3', 'Onboarding de tienda y publicación', 'ropa', 'entrega', 'texto', FALLBACK_STATUS, FALLBACK_STATUS],
  ['RO-4', 'Cobro recurrente y liquidación', 'ropa', 'cobro', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['RO-5', 'Soporte y mejoras por temporada', 'ropa', 'soporte', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['RE-1', 'Lead, oferta, precio, alcance, demo y decisión', 'restaurantes', 'captacion', 'borrador', 'Bot Captación + Bot Resto SaaS', 'Dirección'],
  ['RE-2', 'Precontrato, revisión, firma, primera cuota y alta', 'restaurantes', 'venta', 'borrador', 'Bot Resto SaaS', 'Dirección'],
  ['RE-3', 'Onboarding y núcleo multi-tenant', 'restaurantes', 'entrega', 'texto', FALLBACK_STATUS, 'Equipo técnico'],
  ['RE-4', 'Cuotas mensuales y mantenimiento', 'restaurantes', 'cobro', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['RE-5', 'Soporte y bolsa de mantenimiento', 'restaurantes', 'soporte', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['BP-1A', 'Captación de fincas y anfitriones', 'buen-puente', 'captacion', 'borrador', 'Bot Buen Puente', 'Dirección'],
  ['BP-1B', 'Captación de huéspedes y registro', 'buen-puente', 'captacion', 'texto', FALLBACK_STATUS, FALLBACK_STATUS],
  ['BP-2', 'Reserva y aprobación de disponibilidad', 'buen-puente', 'venta', 'borrador', FALLBACK_STATUS, FALLBACK_STATUS],
  ['BP-3', 'Publicación, estadía, check-in y reseña', 'buen-puente', 'entrega', 'borrador', 'Bot Fin', FALLBACK_STATUS],
  ['BP-4', 'Cobro, webhook, reembolsos y liquidación', 'buen-puente', 'cobro', 'borrador', FALLBACK_STATUS, FALLBACK_STATUS],
  ['BP-5', 'Soporte, incidentes y documentación', 'buen-puente', 'soporte', 'texto', 'Botardo', FALLBACK_STATUS],
  ['CR-1', 'Identificar creador, contactar y agendar', 'creadores', 'captacion', 'texto', 'Bot Captación', 'Dirección'],
  ['CR-2', 'Llamada con guion y onboarding', 'creadores', 'venta', 'texto', FALLBACK_STATUS, 'Dirección'],
  ['CR-3', 'Expectativa, masterclass, curso y venta', 'creadores', 'entrega', 'texto', FALLBACK_STATUS, 'Producción'],
  ['CR-4', 'Cobro y reparto', 'creadores', 'cobro', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['CR-5', 'Soporte a creadores', 'creadores', 'soporte', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['DM-1', 'Captación de proyectos a la medida', 'a-la-medida', 'captacion', 'no-existe', 'Bot Captación + Bot Pingui', FALLBACK_STATUS],
  ['DM-2', 'Diagnóstico, propuesta, precontrato y firma', 'a-la-medida', 'venta', 'valido', FALLBACK_STATUS, FALLBACK_STATUS],
  ['DM-3', 'Brief, arquitectura, prototipo, QA y deploy', 'a-la-medida', 'entrega', 'valido', FALLBACK_STATUS, 'Dirección'],
  ['CP-1', 'Captación y venta de contenido y pauta', 'contenido', 'captacion', 'no-existe', 'Bot Pingui', FALLBACK_STATUS],
  ['CP-2', 'Producción de una pieza y publicación', 'contenido', 'entrega', 'valido', FALLBACK_STATUS, 'Dirección Operativa'],
  ['CP-3', 'Pauta en plataformas de anuncios', 'contenido', 'entrega', 'no-existe', FALLBACK_STATUS, FALLBACK_STATUS],
  ['CP-5', 'Soporte, informe mensual y post mortem', 'contenido', 'soporte', 'deuda', FALLBACK_STATUS, 'Dirección'],
  ['AL-1', 'Alianzas y referidos', 'otras', 'captacion', 'valido', FALLBACK_STATUS, 'Partnerships / Comercial'],
  ['PS-1', 'Paquetes de servicios', 'otras', 'venta', 'no-existe', FALLBACK_STATUS, 'Dirección'],
  ['NU-1', 'NÜMA, producto para locales', 'otras', 'entrega', 'no-existe', FALLBACK_STATUS, 'Dirección técnica'],
  ['PL-1', 'Playbook comercial por segmento', 'otras', 'venta', 'deuda', FALLBACK_STATUS, 'Comercial'],
  ['MD-1', 'Monetización digital', 'otras', 'entrega', 'pausa', FALLBACK_STATUS, FALLBACK_STATUS],
  ['IN-1', 'Cobro y facturación a clientes', 'otras', 'cobro', 'valido', 'Bot Fin + Bot Pingui', 'Finanzas'],
  ['IN-2', 'Pago a colaboradores', 'otras', 'cobro', 'deuda', 'Bot Fin', 'Dirección'],
  ['IN-3', 'La quincena y decisión de caja', 'otras', 'cobro', 'deuda', 'Bot Fin', 'Finanzas / Dirección'],
  ['IN-4', 'Firma de contratos', 'otras', 'venta', 'deuda', FALLBACK_STATUS, 'Admin / Legal'],
  ['IN-5', 'Onboarding de cliente genérico', 'otras', 'entrega', 'deuda', FALLBACK_STATUS, 'Dirección'],
  ['IN-6', 'Soporte a clientes', 'otras', 'soporte', 'deuda', FALLBACK_STATUS, FALLBACK_STATUS],
  ['IN-7', 'Marca RR, contenido propio y redes', 'otras', 'captacion', 'no-existe', 'Bot Marca RR + Bot Pingui', FALLBACK_STATUS],
  ['IN-8', 'Conversión web a lead', 'otras', 'captacion', 'no-existe', 'Bot Captación', FALLBACK_STATUS],
  ['IN-9', 'Enrutamiento de leads entre bots', 'otras', 'captacion', 'borrador', 'Bot Captación + Botardo', 'Dirección'],
  ['IN-10', 'Convertir trabajo repetitivo en un agente', 'otras', 'entrega', 'valido', FALLBACK_STATUS, 'Tecnología / IA'],
  ['IN-11', 'Elegir y usar herramientas de IA', 'otras', 'entrega', 'valido', FALLBACK_STATUS, 'Tecnología / IA'],
  ['IN-12', 'Gobierno documental', 'otras', 'soporte', 'deuda', FALLBACK_STATUS, 'Gobierno documental'],
  ['IN-13', 'De dónde sale una respuesta', 'otras', 'soporte', 'valido', FALLBACK_STATUS, FALLBACK_STATUS],
  ['IN-14', 'Contratación y vinculación de talento', 'otras', 'captacion', 'no-existe', FALLBACK_STATUS, 'Dirección'],
  ['IN-15', 'Normativa y cumplimiento', 'otras', 'soporte', 'no-existe', 'Bot Fin', 'Contadora / Dirección'],
  ['IN-16', 'Flujo de la plata de RR', 'otras', 'cobro', 'borrador', FALLBACK_STATUS, FALLBACK_STATUS],
];

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
const botDefinitions = [
  { id: 'bot-captacion', title: 'Bot Captación' },
  { id: 'bot-bot-ropa-saas', title: 'Bot Ropa SaaS' },
  { id: 'bot-bot-resto-saas', title: 'Bot Resto SaaS' },
  { id: 'bot-bot-buen-puente', title: 'Bot Buen Puente' },
  { id: 'bot-bot-creadores', title: 'Bot Creadores' },
  { id: 'bot-marca-rr', title: 'Bot Marca RR' },
  { id: 'bot-media-manager', title: 'Bot Media Manager' },
  { id: 'bot-fin', title: 'Bot Fin' },
  { id: 'bot-gains', title: 'Bot Gains' },
  { id: 'bot-becas-y-exposicion', title: 'Bot Becas y Exposicion' },
  { id: 'bot-pingui', title: 'Bot Pingui' },
  { id: 'bot-secre', title: 'Bot secre' },
  { id: 'bot-botardo-bot-fin', title: 'Botardo' },
  { id: 'bot-atlas', title: 'Bot Atlas' },
];

const crossEvidence = [
  ['bot-captacion', 'RO-1', 'atlas_mapa/inventario_v0.md', 'RO-1 indica que Captación busca, califica y redacta.'],
  ['bot-captacion', 'RE-1', 'atlas_mapa/inventario_v0.md', 'RE-1 indica que Captación detecta el lead.'],
  ['bot-captacion', 'CR-1', 'atlas_mapa/inventario_v0.md', 'CR-1 asigna a Captación el diseño del primer contacto.'],
  ['bot-captacion', 'DM-1', 'atlas_mapa/inventario_v0.md', 'DM-1 indica que Captación pasa el lead a Pingui.'],
  ['bot-captacion', 'IN-8', 'atlas_mapa/insumos/bots_1210.md', 'La conversión web dirige el formulario a Captación.'],
  ['bot-captacion', 'IN-9', 'atlas_mapa/inventario_v0.md', 'IN-9 asigna el enrutamiento de leads a Captación.'],
  ['bot-bot-ropa-saas', 'RO-1', 'atlas_mapa/inventario_v0.md', 'RO-1 indica que Ropa SaaS cruza el pipeline.'],
  ['bot-bot-ropa-saas', 'RO-2', 'atlas_mapa/insumos/bots_1209.md', 'La sección de venta indica seguimiento de Ropa SaaS.'],
  ['bot-bot-resto-saas', 'RE-1', 'atlas_mapa/insumos/bots_1209.md', 'Resto SaaS arma la oferta, precio, alcance y siguiente paso.'],
  ['bot-bot-resto-saas', 'RE-2', 'atlas_mapa/insumos/bots_1209.md', 'Resto SaaS redacta el precontrato.'],
  ['bot-bot-buen-puente', 'BP-1A', 'atlas_mapa/inventario_v0.md', 'BP-1A asigna a Buen Puente la ficha y las preguntas.'],
  ['bot-botardo-bot-fin', 'BP-5', 'atlas_mapa/inventario_v0.md', 'BP-5 menciona a Botardo para código e incidentes.'],
  ['bot-botardo-bot-fin', 'IN-9', 'atlas_mapa/insumos/bots_1209.md', 'La regla transversal indica WhatsApp por Hermes vía Botardo.'],
  ['bot-pingui', 'DM-1', 'atlas_mapa/inventario_v0.md', 'DM-1 indica que el lead se pasa a Pingui.'],
  ['bot-pingui', 'CP-1', 'atlas_mapa/inventario_v0.md', 'CP-1 identifica a Pingui como ejecutor pendiente de la línea.'],
  ['bot-pingui', 'IN-1', 'atlas_mapa/inventario_v0.md', 'IN-1 indica que Pingui avisa a las 10:00.'],
  ['bot-pingui', 'IN-7', 'atlas_mapa/insumos/bots_1210.md', 'Pingui monta LinkedIn dentro del flujo de redes.'],
  ['bot-marca-rr', 'IN-7', 'atlas_mapa/insumos/bots_1210.md', 'IN-7 documenta que Marca RR propone y publica con aprobación.'],
  ['bot-fin', 'BP-3', 'atlas_mapa/inventario_v0.md', 'La revisión de la TRA de BP-3 está pendiente con Fin.'],
  ['bot-fin', 'IN-1', 'atlas_mapa/inventario_v0.md', 'IN-1 indica que Fin lee y calcula.'],
  ['bot-fin', 'IN-2', 'atlas_mapa/insumos/bots_1210.md', 'Fin genera y audita las cuentas de cobro.'],
  ['bot-fin', 'IN-3', 'atlas_mapa/inventario_v0.md', 'IN-3 asigna la decisión de caja a Finanzas y Bot Fin.'],
  ['bot-fin', 'IN-15', 'atlas_mapa/inventario_v0.md', 'IN-15 asigna el cumplimiento a Fin y roles financieros.'],
];

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
    desc: 'Mapa público de líneas, etapas, procesos, proyectos y bots responsables.',
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
      desc: 'Bot público representado por un rol genérico; solo se enlaza con evidencia de las fuentes.',
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
      desc: 'Nodo público sin nombres ni datos de clientes reales.',
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
      status: 'Nodo público',
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

export { FALLBACK_STATUS, botDefinitions, lineDefinitions, processRows, stages, statusLabels };
