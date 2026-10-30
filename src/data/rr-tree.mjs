const stages = [
  ['captacion', 'Captación'],
  ['venta', 'Venta'],
  ['entrega', 'Entrega'],
  ['cobro', 'Cobro'],
  ['soporte', 'Soporte'],
];

const lineDefinitions = [
  { id: 'ropa', title: 'SaaS ropa', state: 'Piloto', color: 'fuchsia', bot: 'Bot Ropa SaaS', project: 'Proyecto tienda genérica' },
  { id: 'restaurantes', title: 'SaaS restaurantes', state: 'Opera', color: 'orchid', bot: 'Bot Resto SaaS', project: 'Proyecto núcleo multi-tenant' },
  { id: 'buen-puente', title: 'Buen Puente', state: 'Pre-lanzamiento', color: 'mustard', bot: 'Bot Buen Puente', project: 'Proyecto marketplace genérico' },
  { id: 'creadores', title: 'Creadores', state: 'No opera', color: 'fuchsia', bot: 'Bot Creadores', project: 'Proyecto infoproductos' },
  { id: 'a-la-medida', title: 'Desarrollo a la medida', state: 'Por confirmar', color: 'mustard', bot: 'Bot Desarrollo', project: 'Proyecto software a medida' },
  { id: 'contenido', title: 'Contenido y pauta', state: 'Por confirmar', color: 'orchid', bot: 'Bot Contenido', project: 'Proyecto Content Hub genérico' },
  { id: 'otras', title: 'Otras líneas', state: 'Transversal', color: 'ink', bot: 'Botardo / Bot Fin', project: 'Proyectos transversales' },
];

// Source: atlas_mapa/inventario_v0.md and its insumos. Names are intentionally generic for the public repository.
const processRows = [
  ['RO-1', 'Prospección outbound de marcas de ropa', 'ropa', 'captacion', 'borrador', 'Bot Captación + Bot Ropa SaaS', 'Dirección'],
  ['RO-2', 'Oferta, demo, propuesta, contrato y primer pago', 'ropa', 'venta', 'texto', 'Bot Ropa SaaS', 'Dirección'],
  ['RO-3', 'Onboarding de tienda y publicación', 'ropa', 'entrega', 'texto', 'Bot Ropa SaaS', 'Equipo técnico'],
  ['RO-4', 'Cobro recurrente y liquidación', 'ropa', 'cobro', 'no-existe', 'Bot Fin', 'Por confirmar'],
  ['RO-5', 'Soporte y mejoras por temporada', 'ropa', 'soporte', 'no-existe', 'Bot Ropa SaaS', 'Por confirmar'],
  ['RE-1', 'Lead, oferta, precio, alcance, demo y decisión', 'restaurantes', 'captacion', 'borrador', 'Bot Captación + Bot Resto SaaS', 'Dirección'],
  ['RE-2', 'Precontrato, revisión, firma, primera cuota y alta', 'restaurantes', 'venta', 'borrador', 'Bot Resto SaaS', 'Dirección'],
  ['RE-3', 'Onboarding y núcleo multi-tenant', 'restaurantes', 'entrega', 'texto', 'Bot Resto SaaS', 'Equipo técnico'],
  ['RE-4', 'Cuotas mensuales y mantenimiento', 'restaurantes', 'cobro', 'no-existe', 'Bot Fin', 'Por confirmar'],
  ['RE-5', 'Soporte y bolsa de mantenimiento', 'restaurantes', 'soporte', 'no-existe', 'Bot Resto SaaS', 'Por confirmar'],
  ['BP-1A', 'Captación de fincas y anfitriones', 'buen-puente', 'captacion', 'borrador', 'Bot Buen Puente', 'Admin RR'],
  ['BP-1B', 'Captación de huéspedes y registro', 'buen-puente', 'captacion', 'texto', 'Bot Buen Puente', 'Por confirmar'],
  ['BP-2', 'Reserva y aprobación de disponibilidad', 'buen-puente', 'venta', 'borrador', 'Bot Buen Puente', 'Anfitrión / Admin RR'],
  ['BP-3', 'Publicación, estadía, check-in y reseña', 'buen-puente', 'entrega', 'borrador', 'Bot Buen Puente', 'Admin RR'],
  ['BP-4', 'Cobro, webhook, reembolsos y liquidación', 'buen-puente', 'cobro', 'borrador', 'Bot Fin + Bot Buen Puente', 'Admin RR'],
  ['BP-5', 'Soporte, incidentes y documentación', 'buen-puente', 'soporte', 'texto', 'Botardo', 'Por confirmar'],
  ['CR-1', 'Identificar creador, contactar y agendar', 'creadores', 'captacion', 'texto', 'Bot Creadores', 'Dirección'],
  ['CR-2', 'Llamada con guion y onboarding', 'creadores', 'venta', 'texto', 'Bot Creadores', 'Dirección'],
  ['CR-3', 'Expectativa, masterclass, curso y venta', 'creadores', 'entrega', 'texto', 'Bot Creadores', 'Producción'],
  ['CR-4', 'Cobro y reparto', 'creadores', 'cobro', 'no-existe', 'Bot Fin', 'Por confirmar'],
  ['CR-5', 'Soporte a creadores', 'creadores', 'soporte', 'no-existe', 'Bot Creadores', 'Por confirmar'],
  ['DM-1', 'Captación de proyectos a la medida', 'a-la-medida', 'captacion', 'no-existe', 'Bot Captación', 'Por confirmar con Rosas'],
  ['DM-2', 'Diagnóstico, propuesta, precontrato y firma', 'a-la-medida', 'venta', 'valido', 'Bot Captación', 'Comercial'],
  ['DM-3', 'Brief, arquitectura, prototipo, QA y deploy', 'a-la-medida', 'entrega', 'valido', 'Bot Desarrollo', 'Tecnología / Dev'],
  ['CP-1', 'Captación y venta de contenido y pauta', 'contenido', 'captacion', 'no-existe', 'Bot Captación', 'Por confirmar con Rosas'],
  ['CP-2', 'Producción de una pieza y publicación', 'contenido', 'entrega', 'valido', 'Bot Contenido', 'Dirección Operativa'],
  ['CP-3', 'Pauta en plataformas de anuncios', 'contenido', 'entrega', 'no-existe', 'Bot Contenido', 'Por confirmar con Rosas'],
  ['CP-5', 'Soporte, informe mensual y post mortem', 'contenido', 'soporte', 'deuda', 'Bot Contenido', 'Dirección'],
  ['AL-1', 'Alianzas y referidos', 'otras', 'captacion', 'valido', 'Bot Captación', 'Partnerships / Comercial'],
  ['PS-1', 'Paquetes de servicios', 'otras', 'venta', 'no-existe', 'Bot Captación', 'Dirección'],
  ['NU-1', 'NÜMA, producto para locales', 'otras', 'entrega', 'no-existe', 'Bot Desarrollo', 'Dirección técnica'],
  ['PL-1', 'Playbook comercial por segmento', 'otras', 'venta', 'deuda', 'Bot Captación', 'Comercial'],
  ['MD-1', 'Monetización digital', 'otras', 'entrega', 'pausa', 'Bot Contenido', 'Por confirmar'],
  ['IN-1', 'Cobro y facturación a clientes', 'otras', 'cobro', 'valido', 'Bot Fin', 'Finanzas'],
  ['IN-2', 'Pago a colaboradores', 'otras', 'cobro', 'deuda', 'Bot Fin', 'Dirección'],
  ['IN-3', 'La quincena y decisión de caja', 'otras', 'cobro', 'deuda', 'Bot Fin', 'Finanzas / Dirección'],
  ['IN-4', 'Firma de contratos', 'otras', 'venta', 'deuda', 'Bot Captación', 'Admin / Legal'],
  ['IN-5', 'Onboarding de cliente genérico', 'otras', 'entrega', 'deuda', 'Bot Desarrollo', 'Dirección'],
  ['IN-6', 'Soporte a clientes', 'otras', 'soporte', 'deuda', 'Botardo', 'Por confirmar'],
  ['IN-7', 'Marca RR, contenido propio y redes', 'otras', 'captacion', 'no-existe', 'Bot Marca RR', 'Por confirmar'],
  ['IN-8', 'Conversión web a lead', 'otras', 'captacion', 'no-existe', 'Bot Captación', 'Por confirmar'],
  ['IN-9', 'Enrutamiento de leads entre bots', 'otras', 'captacion', 'borrador', 'Bot Captación', 'Dirección'],
  ['IN-10', 'Convertir trabajo repetitivo en un agente', 'otras', 'entrega', 'valido', 'Botardo', 'Tecnología / IA'],
  ['IN-11', 'Elegir y usar herramientas de IA', 'otras', 'entrega', 'valido', 'Botardo', 'Tecnología / IA'],
  ['IN-12', 'Gobierno documental', 'otras', 'soporte', 'deuda', 'Botardo', 'Gobierno documental'],
  ['IN-13', 'De dónde sale una respuesta', 'otras', 'soporte', 'valido', 'Botardo', 'Por confirmar'],
  ['IN-14', 'Contratación y vinculación de talento', 'otras', 'captacion', 'no-existe', 'Bot Fin', 'Dirección'],
  ['IN-15', 'Normativa y cumplimiento', 'otras', 'soporte', 'no-existe', 'Bot Fin', 'Contadora / Dirección'],
  ['IN-16', 'Flujo de la plata de RR', 'otras', 'cobro', 'borrador', 'Bot Fin', 'Por confirmar'],
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

export function createRRGraph() {
  const nodes = [];
  const edges = [];
  const addNode = (node) => nodes.push({ editable: true, ...node });
  const addEdge = (source, target, kind = 'hierarchy') => edges.push({ source, target, kind });
  const laneWidth = 430;
  const rootX = 7 * laneWidth / 2 - 135;
  addNode({ id: 'rr-labs', title: 'RR Labs', type: 'root', level: 0, x: rootX, y: 70, color: 'ink', status: 'Sistema completo', desc: 'Mapa público de líneas, etapas, procesos, proyectos y bots responsables.', owner: 'Dirección', stage: '', lineId: 'root' });

  lineDefinitions.forEach((line, lineIndex) => {
    const lineX = 100 + lineIndex * laneWidth;
    const lineId = `line-${line.id}`;
    addNode({ id: lineId, title: line.title, type: 'line', level: 1, x: lineX, y: 260, color: line.color, status: line.state, desc: 'Línea de negocio con clientes representados solo como nodos genéricos.', owner: line.state === 'Por confirmar' ? 'Por confirmar con Rosas' : 'Dirección', lineId: line.id, stage: '' });
    addEdge('rr-labs', lineId);
    for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
      const [stageId, stageTitle] = stages[stageIndex];
      const stageNodeId = `stage-${line.id}-${stageId}`;
      const processList = processRows.filter((row) => row[2] === line.id && row[3] === stageId);
      const stageY = 470 + stageIndex * 345;
      addNode({ id: stageNodeId, title: stageTitle, type: 'stage', level: 2, x: lineX + 44, y: stageY, color: line.color, status: `${processList.length} proceso${processList.length === 1 ? '' : 's'}`, desc: `Etapa de ${line.title}.`, owner: line.state === 'Por confirmar' ? 'Por confirmar con Rosas' : 'Dirección', lineId: line.id, stage: stageId });
      addEdge(lineId, stageNodeId);
      processList.forEach((row, processIndex) => {
        const [id, title, , , status, owner, responsible] = row;
        const processId = `process-${safeId(id)}`;
        const processX = lineX + (processIndex - (processList.length - 1) / 2) * 230;
        const processY = stageY + 132;
        addNode({ id: processId, title: `${id} · ${title}`, shortTitle: id, type: 'process', level: 3, x: processX, y: processY, color: statusTone(status), status: statusLabels[status], statusKey: status, desc: `Proceso del inventario v0. Responsable: ${responsible}.`, owner: responsible, bot: owner, lineId: line.id, stage: stageId, source: 'inventario_v0.md' });
        addEdge(stageNodeId, processId);
        const botId = `bot-${safeId(line.bot)}`;
        const projectId = `project-${safeId(line.project)}`;
        if (!nodes.some((node) => node.id === botId)) addNode({ id: botId, title: line.bot, type: 'bot', level: 4, x: lineX - 78, y: 2320, color: 'orchid', status: 'Responsable', desc: `Bot responsable de tareas conectadas en ${line.title}.`, owner: 'Rol genérico', lineId: line.id, stage: '' });
        if (!nodes.some((node) => node.id === projectId)) addNode({ id: projectId, title: line.project, type: 'project', level: 4, x: lineX + 125, y: 2320, color: 'mustard', status: 'Proyecto genérico', desc: 'Nodo público sin nombres ni datos de clientes reales.', owner: 'Equipo RR', lineId: line.id, stage: '' });
        addEdge(processId, botId, 'responsibility');
        addEdge(processId, projectId, 'project');
      });
    }
    const clientId = `client-${line.id}`;
    addNode({ id: clientId, title: `Cliente genérico · ${line.title}`, type: 'client', level: 4, x: lineX + 44, y: 2175, color: 'mustard', status: 'Nodo público', desc: 'Representación genérica; no contiene nombres reales.', owner: 'Cliente genérico', lineId: line.id, stage: '' });
    addEdge(lineId, clientId, 'client');
  });

  addNode({ id: 'bot-captacion', title: 'Bot Captación', type: 'bot', level: 4, x: 1220, y: 2320, color: 'orchid', status: 'Responsable transversal', desc: 'Enruta leads y prepara borradores aprobables.', owner: 'Rol genérico', lineId: 'transversal', stage: '' });
  addNode({ id: 'bot-fin', title: 'Bot Fin', type: 'bot', level: 4, x: 1660, y: 2320, color: 'orchid', status: 'Responsable transversal', desc: 'Apoya cobro y control financiero sin datos sensibles.', owner: 'Rol genérico', lineId: 'transversal', stage: '' });

  const crossLinks = [
    ['bot-captacion', 'process-ro-1'], ['bot-captacion', 'process-re-1'], ['bot-captacion', 'process-in-9'],
    ['bot-fin', 'process-in-1'], ['bot-fin', 'process-bp-4'], ['bot-fin', 'process-in-3'],
    ['botardo-bot-fin', 'process-in-6'],
    ['stage-a-la-medida-cobro', 'process-in-1'], ['stage-a-la-medida-soporte', 'process-in-6'],
    ['stage-contenido-cobro', 'process-in-1'],
  ];
  for (const [source, target] of crossLinks) if (nodes.some((node) => node.id === source) && nodes.some((node) => node.id === target)) addEdge(source, target, 'cross');
  return { nodes, edges, source: 'atlas_mapa/inventario_v0.md' };
}

export { lineDefinitions, processRows, stages, statusLabels };
