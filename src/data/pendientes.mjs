/**
 * Huecos «sin confirmar» del Atlas RR (mega prompt §10).
 *
 * Cada hueco apunta a lo que la fuente de RR todavía no dice: falta de dato,
 * falta de decisión o falta de confirmación. Nada aquí se inventa: cada
 * registro trae su `fuente` y su `corte`, y el estado es «sin confirmar»
 * hasta que Rosas o el equipo lo confirmen.
 *
 * Esta lista es la que la app muestra en la vista Datos («Lo que falta
 * confirmar») y en el panel Inicio de la pantalla dividida, y la que la
 * puerta de cierre (`scripts/verificar-cierre-final.mjs`) comprueba.
 */

export const ESTADO_SIN_CONFIRMAR = 'sin confirmar';

export const PENDIENTES = Object.freeze([
  {
    id: 'pendiente-pm-camarografo',
    titulo: 'Project Manager y Camarógrafo por definir',
    detalle: 'El manual de roles deja los dos cargos por definir. El Atlas los muestra como rol sin persona; no se inventó quién los ocupa.',
    tipo: 'equipo',
    fuente: '20_Empresa/equipo.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-sla-soporte',
    titulo: 'SLA de soporte',
    detalle: 'No hay tiempos de respuesta ni de solución por prioridad. Los diagramas de soporte muestran el flujo, no el plazo.',
    tipo: 'soporte',
    fuente: '00_HUECOS.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-cobertura-soporte',
    titulo: 'Quién cubre soporte',
    detalle: 'No está definido quién responde cuando la persona responsable no está disponible.',
    tipo: 'soporte',
    fuente: '00_HUECOS.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-kpi-produccion',
    titulo: 'KPI de producción',
    detalle: 'No hay indicador de producción definido (piezas, tiempos o calidad). El Atlas no muestra cifras de avance.',
    tipo: 'produccion',
    fuente: '00_HUECOS.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-metodo-grabacion',
    titulo: 'Método de la sesión de grabación',
    detalle: 'El checklist y el método de la sesión no están escritos: el diagrama de producción de contenido deja el paso como «sin confirmar».',
    tipo: 'produccion',
    fuente: '00_HUECOS.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-cuenta-cobro',
    titulo: 'Quién puede tener cuenta de cobro',
    detalle: 'No está definido si corresponde a colaborador, contrato o terceros. El Atlas solo muestra el flujo de facturación, nunca una cuenta.',
    tipo: 'administracion',
    fuente: 'inventario.md · Huecos sin confirmar',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-obligaciones-fiscales',
    titulo: 'Obligaciones fiscales (checkpoints con la contadora)',
    detalle: 'El proceso de obligaciones fiscales queda en borrador: el detalle de los checkpoints no está escrito.',
    tipo: 'administracion',
    fuente: 'inventario.md · Huecos sin confirmar',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-precios-saas',
    titulo: 'Precios y planes de SaaS Ropa, SaaS Resto y Creadores',
    detalle: 'Sin precios, sin planes y sin responsables humanos de cada línea. El Atlas no muestra cifras de planes.',
    tipo: 'producto',
    fuente: 'mega prompt §6.4 – §6.6',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-estado-buen-puente',
    titulo: 'Estado de negocio de Buen Puente',
    detalle: 'Alcance, responsables y estado de negocio no están confirmados. Lo único con fuente es que el producto tiene frontend en Railway.',
    tipo: 'producto',
    fuente: '20_Empresa/proyectos.md',
    corte: '2026-10-14',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-vigencia-hermes',
    titulo: 'Vigencia de la flota Hermes',
    detalle: 'La flota anterior (ceo-radar, operations-coo, tech-orchestrator, project-manager-coordinador-central, analista-de-leads, estratega-de-crecimiento, redactor-b-u-c-m, revisor-comercial-qa, finance-controller) se cargó como histórica o sin confirmar vigencia.',
    tipo: 'bots',
    fuente: '20_Empresa/flota_ia.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-bots-extra',
    titulo: 'Media Manager y Gains',
    detalle: 'Aparecen en el árbol del mapa vivo pero no en el Manual de bots: quedan «sin confirmar». Buen Puente y Becas de Exposición sí quedaron vigentes por decisión de Rosas.',
    tipo: 'bots',
    fuente: 'Manual de los bots de RR (oct 2026)',
    corte: '2026-10-24',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-personas-rama-a',
    titulo: 'Personas de la tarjeta de talento de la rama A',
    detalle: 'La tarjeta de talento de A nombra a «Martín» e «Isabela» y dice un conteo de internos y externos. No coincide con el Second Brain: no se cargaron.',
    tipo: 'equipo',
    fuente: 'inventario.md · Huecos sin confirmar',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-carriles-roles',
    titulo: 'Cargos reales de los carriles de los diagramas',
    detalle: 'Los 16 diagramas usan roles genéricos (Comercial, Dirección, Finanzas, Soporte, Legal, Contenido, Desarrollo, Cliente, Bot, Solicitante, Equipo RR). Falta el cargo del manual de roles en cada carril.',
    tipo: 'procesos',
    fuente: 'manual de roles y responsabilidades',
    corte: '2026-07',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-tipografia-brand-kit',
    titulo: 'Tipografía oficial del brand kit',
    detalle: 'El brand kit oficial (Neue Haas Grotesk / Graphie) no está confirmado. El Atlas usa Inter Tight para títulos y Lexend para cuerpo.',
    tipo: 'marca',
    fuente: 'mega prompt · Marca RR',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-zapatos-shoes',
    titulo: 'Relación Zapatos / Shoes Colombia',
    detalle: 'La fuente menciona la relación sin confirmar de qué tipo es.',
    tipo: 'clientes',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-estados-clientes',
    titulo: 'Clientes en pausa y su estado real',
    detalle: 'Turismo Anheyca, Satiro_Sushi, IMF Visions, Amsterdam y Billares Charly Brown quedaron en pausa por la decisión de estados del 2-nov; Wundeer sigue con contrato pendiente de confirmar.',
    tipo: 'clientes',
    fuente: 'decisión de Rosas (2026-11-02) · 00_RUTAS.md',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-nombre-imf',
    titulo: 'Nombre canónico de IMF',
    detalle: 'En las fuentes de RR el cliente es «IMF Visions»; la decisión del 2-nov lo llama «IMF Weddings». El Atlas usa el nombre de la decisión y la fuente queda anotada.',
    tipo: 'clientes',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-rutas-rama-a',
    titulo: 'Rutas /bpmn/, /flujos/ y /grafo/ de la rama A',
    detalle: 'En el preview de A esas rutas respondían con muy pocos bytes: no está confirmado que funcionen. El Atlas resuelve la lectura con su propio visor.',
    tipo: 'producto',
    fuente: 'inventario.md · Huecos sin confirmar',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-cifras-demo-rama-a',
    titulo: 'Cifras de demostración de la rama A',
    detalle: 'Las cifras de ejemplo (avance de proyectos, cartera y runway) que se veían en las tarjetas de A no se migraron: no coinciden con el Second Brain y el Atlas no muestra cifras financieras.',
    tipo: 'datos',
    fuente: 'inventario.md · Huecos sin confirmar',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-notas-vault-vencidas',
    titulo: 'Notas del vault marcadas «revisar 2026-10-26»',
    detalle: 'Varias notas del Second Brain vencieron ese día: hay que revisarlas antes de citarlas como fuente.',
    tipo: 'datos',
    fuente: 'inventario.md · Huecos sin confirmar',
    corte: '2026-11-02',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
  {
    id: 'pendiente-datos-contacto',
    titulo: 'Datos de contacto del equipo',
    detalle: 'No hay correo ni teléfono de contacto confirmados para el equipo: el Atlas muestra solo nombre y rol.',
    tipo: 'equipo',
    fuente: 'mega prompt §3 · Persona',
    corte: '2026-09-26',
    estado: ESTADO_SIN_CONFIRMAR,
    actualizadoEn: '2026-11-02',
  },
]);

/** Títulos de los tipos de hueco, para agrupar en la interfaz. */
export const TIPOS_PENDIENTE = Object.freeze({
  equipo: 'Equipo',
  soporte: 'Soporte',
  produccion: 'Producción',
  administracion: 'Administración',
  producto: 'Producto y servicio',
  bots: 'Bots e IA',
  procesos: 'Procesos',
  clientes: 'Clientes',
  marca: 'Marca',
  datos: 'Datos',
});

/** Agrupa los huecos por tipo, con el nombre legible de cada tipo. */
export function agruparPendientes(pendientes = PENDIENTES) {
  const grupos = new Map();
  for (const pendiente of pendientes) {
    const tipo = pendiente.tipo ?? 'datos';
    const grupo = grupos.get(tipo) ?? { tipo, titulo: TIPOS_PENDIENTE[tipo] ?? 'Otros', pendientes: [], total: 0 };
    grupo.pendientes.push(pendiente);
    grupo.total += 1;
    grupos.set(tipo, grupo);
  }
  return [...grupos.values()];
}

/** Texto corto para la lista: «Título · fuente · corte». */
export function lineaPendiente(pendiente = {}) {
  const fuente = String(pendiente.fuente ?? '').trim() || 'sin confirmar';
  const corte = String(pendiente.corte ?? '').trim() || 'sin confirmar';
  return `${pendiente.titulo ?? pendiente.id ?? 'Hueco'} · ${fuente} · corte ${corte}`;
}
