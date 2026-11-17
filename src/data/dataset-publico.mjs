// Dataset público del Atlas: inventario de líneas, etapas, procesos, bots y
// fuentes, más los flujos BPMN públicos. Es el único origen de datos que el
// build de producción sirve; los detalles privados siguen en `*.local.*`
// (fuera del deploy) y solo se aplican como parches sobre este dataset.
//
// Sin datos sensibles: roles genéricos, clientes genéricos, fuentes de
// proceso y textos ya saneados (sin correos, teléfonos, nombres de terceros
// ni cifras). Se valida en src/data/dataset-publico.test.mjs.
import { flujosPublicos } from './flujos-publicos.mjs';

export const VERSION_DATASET_PUBLICO = '2026-11-16';

export const FALLBACK_STATUS = 'Por confirmar con Rosas';

export const etapas = [
  ['captacion', 'Captación'],
  ['venta', 'Venta'],
  ['entrega', 'Entrega'],
  ['cobro', 'Cobro'],
  ['soporte', 'Soporte'],
];

export const lineas = [
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
export const procesos = [
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

export const bots = [
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

export const evidencias = [
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


export const datasetPublico = {
  version: VERSION_DATASET_PUBLICO,
  etapas,
  lineas,
  procesos,
  bots,
  evidencias,
  flujos: flujosPublicos,
};

export default datasetPublico;
