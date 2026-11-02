// Leyenda y guía de lectura de los diagramas BPMN del Atlas RR.
// Reglas: todo lo que se dice aquí es lectura del diagrama, no dato nuevo de la
// empresa. Lo que sí es dato de proceso (objetivo, disparador, resultado) viene
// del guion de procesos del mega prompt de fusión §6 y de las semillas BPMN,
// y cada ficha lleva su fuente y su corte.

export const FUENTE_GUIA = 'Guion de procesos del mega prompt Atlas RR (A→B) §6 · semillas en src/bpmn/seeds/';
export const CORTE_GUIA = '2026-11-02';

// Símbolos BPMN que usa el motor, con la lectura que les da el tema de RR.
export const SIMBOLOS = [
  {
    id: 'inicio',
    nombre: 'Evento de inicio',
    glifo: '<circle cx="10" cy="10" r="7.5"/>',
    descripcion: 'Por dónde entra el proceso. Marca «entra».',
  },
  {
    id: 'fin',
    nombre: 'Evento de fin',
    glifo: '<circle cx="10" cy="10" r="7.5" stroke-width="3.4"/>',
    descripcion: 'Dónde termina el proceso. Si es final de error, va en fucsia.',
  },
  {
    id: 'tarea',
    nombre: 'Tarea',
    glifo: '<rect x="2" y="4" width="16" height="12" rx="2"/>',
    descripcion: 'Una acción que alguien hace dentro del carril.',
  },
  {
    id: 'tarea-usuario',
    nombre: 'Tarea de usuario',
    glifo: '<rect x="2" y="4" width="16" height="12" rx="2"/><circle cx="10" cy="9" r="2"/><path d="M6.6 14.4a3.4 3.4 0 0 1 6.8 0"/>',
    descripcion: 'La hace una persona (no un bot).',
  },
  {
    id: 'tarea-servicio',
    nombre: 'Tarea de servicio',
    glifo: '<rect x="2" y="4" width="16" height="12" rx="2"/><circle cx="10" cy="10" r="2.6"/>',
    descripcion: 'La hace un sistema, un bot o una herramienta.',
  },
  {
    id: 'compuerta',
    nombre: 'Compuerta (decisión)',
    glifo: '<polygon points="10,2.5 17.5,10 10,17.5 2.5,10"/>',
    descripcion: 'Punto de decisión. Su nombre debe ser una pregunta y sus salidas, las respuestas.',
  },
  {
    id: 'compuerta-paralela',
    nombre: 'Compuerta paralela',
    glifo: '<polygon points="10,2.5 17.5,10 10,17.5 2.5,10"/><path d="M10 7.4v5.2M7.4 10h5.2"/>',
    descripcion: 'Todo lo que sale de ahí avanza a la vez.',
  },
  {
    id: 'carril',
    nombre: 'Carril (piscina)',
    glifo: '<rect x="1.5" y="3" width="17" height="14"/><path d="M6.5 3v14"/>',
    descripcion: 'La banda que dice quién responde de cada paso.',
  },
  {
    id: 'secuencia',
    nombre: 'Flujo de secuencia',
    glifo: '<path d="M2 10h13"/><polygon points="17,10 12.5,7 12.5,13"/>',
    descripcion: 'El orden: de la flecha sale lo que sigue.',
  },
  {
    id: 'dato',
    nombre: 'Dato o documento',
    glifo: '<path d="M3.5 3.5h8.5l4.5 4.5v8.5h-13z"/><path d="M12 3.5V8h4.5"/>',
    descripcion: 'Insumo o salida de información. Va en gris.',
  },
  {
    id: 'trampa',
    nombre: 'Punto donde se traba',
    glifo: '<rect x="2" y="4" width="16" height="12" rx="2" stroke-width="3"/>',
    descripcion: 'Bloqueo o error conocido. Va en fucsia con la marca «se traba».',
  },
];

// Colores de la marca RR y para qué se usan en el diagrama.
export const COLORES = [
  { id: 'crema', nombre: 'Crema RR', variable: '--rr-crema', uso: 'Forma normal: el paso está bien.' },
  { id: 'fucsia', nombre: 'Fucsia RR', variable: '--rr-fucsia', uso: 'Se traba: bloqueo, error o escalation a Rosas.' },
  { id: 'mostaza', nombre: 'Mostaza RR', variable: '--rr-mostaza', uso: 'Atención: compuertas, decisiones y el paso marcado.' },
  { id: 'oruquidea', nombre: 'Orquídea RR', variable: '--rr-orquidea', uso: 'Carriles: quién responde.' },
  { id: 'gris', nombre: 'Gris RR', variable: '--rr-gris', uso: 'Datos y flechas: el hilo del proceso.' },
];

// Cómo se lee cualquier diagrama del Atlas, paso a paso.
export const COMO_LEER = [
  'Arranca por el círculo de inicio y sigue las flechas: el diagrama cuenta una historia de izquierda a derecha.',
  'Mira primero los carriles: cada banda dice quién hace ese paso (persona, bot o área).',
  'Las compuertas son preguntas: su nombre debe leerse como pregunta y sus salidas, como respuestas.',
  'El círculo de fin dice que el proceso terminó; el fucsia avisa que ese camino se traba.',
  'Usa «Anterior» y «Siguiente» para recorrer el flujo paso a paso y el clic en cualquier forma para ver su detalle.',
];

// Ficha de cada diagrama: qué busca, cómo arranca, qué entrega y qué mirar.
export const PROCESOS = {
  gobierno_como_se_gobierna_la_documentacion: {
    objetivo: 'Que ningún documento quede sin dueño ni duplicado, y que se sepa dónde está la versión que vale.',
    disparador: 'Entra un documento nuevo.',
    resultado: 'Documento archivado, con índice actualizado y sin espejos.',
    pasos: ['Decide el área canónica', 'Crea o actualiza su contexto', 'Registra el historial y actualiza los índices', 'Archiva los espejos'],
    ojo: 'Si el documento ya existía, la compuerta lo devuelve al área correcta en vez de duplicarlo.',
  },
  informacion_de_donde_sale_la_respuesta: {
    objetivo: 'Que cualquiera pueda rastrear de dónde salió una respuesta y con qué fuente la sostiene.',
    disparador: 'Alguien necesita responder algo.',
    resultado: 'Respuesta con la fuente y el corte que la sostienen.',
    pasos: ['Formula la pregunta', 'Identifica la fuente canónica', 'Consulta el corte vigente', 'Responde con la referencia'],
    ojo: 'Los datos se muestran como flujos; nunca hay cifras de caja en el diagrama.',
  },
  ventas_como_una_oportunidad_se_convierte_en_cliente: {
    objetivo: 'Convertir un prospecto o referido en un cliente firmado, sin saltarse el control de margen y capacidad.',
    disparador: 'Entra alguien que puede ser cliente.',
    resultado: 'Cliente con onboarding, o archivo con el motivo.',
    pasos: ['Registro en el pipeline', 'Diagnóstico rápido', 'Prototipo o propuesta', 'Revisión de margen y capacidad', 'Precontrato y negociación', 'Compuerta: ¿firmó?'],
    ojo: 'La compuerta final tiene tres salidas: sí, no y pausa. Cada una lleva su propio final.',
  },
  alianzas_como_nace_una_alianza: {
    objetivo: 'Formalizar una alianza con origen y seguimiento claros, para saber de dónde vienen los referidos.',
    disparador: 'Alguien propone un aliado.',
    resultado: 'Alianza registrada y con reporte al aliado.',
    pasos: ['Identificar aliado', 'Validar reputación y encaje', 'Definir tipo de relación', 'Acordar comisión', 'Recibir prospecto y hacer seguimiento'],
    ojo: 'El diagrama termina en «cierre o archivo»: los dos desenlaces están dibujados.',
  },
  clientes_que_pasa_despues_de_que_firman: {
    objetivo: 'Dejar el cliente listo para empezar a trabajar: carpeta, contexto, alcance y calendario.',
    disparador: 'Se firma el contrato.',
    resultado: 'Carpeta en Drive, _CONTEXTO, plan de ejecución e hitos con fechas.',
    pasos: ['Carpeta en Drive', 'Contrato o precontrato', 'Levantamiento y brand kit', 'Alcance y plan de ejecución', 'Calendario de hitos'],
    ojo: 'La compuerta «¿checklist de 8 puntos completo?» es la que decide si el cliente arranca.',
  },
  desarrollo_como_llega_un_producto_de_software_a_produccion: {
    objetivo: 'Llevar una idea hasta software en producción con QA, aprobación de despliegue y documentación.',
    disparador: 'Hay un brief técnico.',
    resultado: 'Producto desplegado, documentado y en mantenimiento.',
    pasos: ['Brief técnico', 'Arquitectura y prototipo', 'Implementación', 'QA interno y revisión del cliente', 'Despliegue con aprobación', 'Documentación y mantenimiento'],
    ojo: 'El despliegue no es automático: pide aprobación antes de salir a producción.',
  },
  produccion_como_se_hace_una_pieza: {
    objetivo: 'Pasar de una pieza de contenido aprobada a una pieza publicada y medida.',
    disparador: 'Entra el brief de la pieza.',
    resultado: 'Pieza publicada con su medición.',
    pasos: ['Brief e ideación', 'Guiones', 'Aprobación del cliente', 'Preproducción', 'Grabación', 'Edición', 'Revisión y publicación', 'Medición'],
    ojo: 'Cada carril es un rol: dirección creativa, consultoría, editor, camarógrafo y cliente.',
  },
  clientes_que_pasa_despues_de_entregar: {
    objetivo: 'Cerrar el ciclo con el cliente: informe, aprendizaje y decisión de renovación.',
    disparador: 'Se entrega el trabajo.',
    resultado: 'Cliente renovado o salida con archivo.',
    pasos: ['Informe de entrega', 'Post mortem', 'Escalar fallas', 'Compuerta: ¿el cliente sigue?'],
    ojo: 'La compuerta final decide entre renovación y salida con archivo.',
  },
  finanzas_como_entra_y_se_sale_la_plata: {
    objetivo: 'Mostrar el recorrido del dinero en RR: de dónde entra, por dónde pasa y adónde sale.',
    disparador: 'Movimiento de dinero.',
    resultado: 'Trazabilidad del flujo. Sin cifras: el Atlas muestra flujos, no montos.',
    pasos: ['Entra un pago', 'Se ubica en su cuenta', 'Se factura o se registra', 'Sale el pago', 'Se concilia'],
    ojo: 'Ninguna cifra financiera aparece en el diagrama: solo el camino.',
  },
  finanzas_como_entra_un_peso_a_la_cuenta: {
    objetivo: 'Dejar clara la regla de facturación: si no hay contrato firmado, no se factura.',
    disparador: 'Hay un acuerdo con el cliente.',
    resultado: 'Cuenta de cobro enviada, pagada y conciliada.',
    pasos: ['Acuerdo', 'Compuerta: ¿contrato firmado?', 'Factura o cuenta de cobro', 'Envío', 'Pago', 'Conciliación y actualización'],
    ojo: 'La compuerta «¿contrato firmado?» es el control: sin contrato no se factura y se marca alerta roja.',
  },
  finanzas_como_se_le_paga_a_alguien: {
    objetivo: 'Mostrar el camino de un pago a un colaborador o proveedor, con sus controles.',
    disparador: 'Hay un pago que hacer.',
    resultado: 'Pago hecho y con su evidencia.',
    pasos: ['Solicitud del pago', 'Validación', 'Programación', 'Pago', 'Registro y evidencia'],
    ojo: 'El diagrama habla de flujos, nunca de montos ni de cuentas.',
  },
  finanzas_la_quincena: {
    objetivo: 'Ordenar el corte quincenal de pagos para que nada quede por fuera.',
    disparador: 'Llega el corte de quincena.',
    resultado: 'Quincena cerrada con los pagos soportados.',
    pasos: ['Corte del período', 'Consolidación de pendientes', 'Validación', 'Programación', 'Cierre'],
    ojo: 'Sirve de referencia para el resto de flujos de pago.',
  },
  ia_como_se_usa_la_ia_en_rr_aliados: {
    objetivo: 'Dejar claro cuándo se usa IA en RR y cuándo no: primero pensar, después delegar.',
    disparador: 'Tarea con componente de IA.',
    resultado: 'Decisión documentada de usar IA o de hacerla a mano.',
    pasos: ['¿La tarea es repetitiva?', 'Si sí, se convierte en agente', 'Si no, se hace con criterio humano'],
    ojo: 'La compuerta abre dos caminos: agente o criterio humano.',
  },
  ia_como_se_convierte_un_trabajo_repetitivo_en_un_agente: {
    objetivo: 'Convertir un trabajo repetitivo en un agente con dueño, instrucciones y evidencia.',
    disparador: 'Se detecta una tarea repetitiva.',
    resultado: 'Agente con prompt, disparador y forma de verificar.',
    pasos: ['Describir la tarea', 'Definir disparador y entregable', 'Escribir las instrucciones', 'Probar', 'Poner en manos del equipo'],
    ojo: 'Un agente sin prueba no se pone a trabajar: el diagrama exige la prueba.',
  },
  soporte_como_se_resuelve_un_problema_de_un_cliente: {
    objetivo: 'Resolver el problema del cliente con prioridad, responsable y cierre validado por el cliente.',
    disparador: 'Entra una solicitud de soporte.',
    resultado: 'Problema cerrado con aprendizaje.',
    pasos: ['Registro', 'Prioridad', 'Asignación', 'Respuesta y solución', 'Validación del cliente', 'Cierre y aprendizaje'],
    ojo: 'La prioridad define el SLA; quién cubre soporte está «sin confirmar».',
  },
  legal_como_se_firma_un_contrato: {
    objetivo: 'Mostrar el camino de una firma: de la solicitud al archivo con control de renovación.',
    disparador: 'Alguien pide firmar un contrato.',
    resultado: 'Contrato firmado, archivado en Drive y con renovación controlada.',
    pasos: ['Solicitud', 'Plantilla', 'Revisión interna', 'Compuerta: ¿requiere abogada?', 'Aprobación de Dirección', 'Firma y archivo'],
    ojo: 'Después de archivar aparece el control de renovación: ningún contrato se pierde.',
  },
};

// Ficha genérica cuando el proceso todavía no tiene texto propio.
export const GUIA_GENERICA = {
  objetivo: 'Este diagrama todavía no tiene ficha: muestra el flujo modelado hasta ahora y se puede completar en modo Editar.',
  disparador: 'Por definir.',
  resultado: 'Por definir.',
  pasos: [],
  ojo: 'Modo Editar: agrega el nombre que falta, pon la compuerta en forma de pregunta y guarda la copia.',
};

export function fichaDeProceso(id) {
  return PROCESOS[id] ?? GUIA_GENERICA;
}
