/**
 * Modelo de datos v5 del Atlas RR.
 *
 * Un solo estado (`AtlasModel`) con las entidades del mega prompt (área, rol,
 * persona, línea de negocio, proyecto, cliente, sistema, proceso, paso,
 * fragmento y tarea de plan). Todo registro lleva `fuente` y `corte`; lo que
 * no tenga fuente queda como «sin confirmar».
 *
 * Reglas duras:
 *   - Prohibidos los campos salary/cedula/cuenta/token/password (y parientes).
 *   - El XML BPMN es la verdad del diagrama; el modelo guarda el resumen.
 *   - Exportar e importar es idempotente: exportar(importar(paquete)) === paquete.
 */

export const SCHEMA_VERSION = 5;
export const STORAGE_KEY = 'rr-atlas:v5';
export const LIMITE_HISTORIAL = 100;

export const COLECCIONES = Object.freeze([
  'area',
  'rol',
  'persona',
  'lineaNegocio',
  'proyecto',
  'cliente',
  'sistema',
  'proceso',
  'paso',
  'fragmento',
  'tarea',
]);

/** Campos que nunca pueden aparecer en el modelo (ni en base ni en cambios). */
export const CAMPOS_PROHIBIDOS = Object.freeze([
  'salario',
  'cedula',
  'cuenta',
  'cuentaBancaria',
  'numeroCuenta',
  'token',
  'password',
  'clave',
  'secret',
  'contrasena',
]);

/** Campos mínimos de toda entidad. */
export const CAMPOS_OBLIGATORIOS = Object.freeze(['id', 'nombre', 'fuente', 'corte']);

export const ESTADOS_PROCESO = Object.freeze(['válido', 'borrador', 'con deuda', 'solo texto', 'no existe', 'en pausa', 'sin confirmar']);
export const ESTADOS_CLIENTE = Object.freeze(['activo', 'prospecto', 'pausado', 'histórico', 'sin confirmar']);
export const TIPOS_ROL = Object.freeze(['humano', 'bot', 'externo']);

export const SIN_CONFIRMAR = 'sin confirmar';

export class ModeloError extends Error {
  constructor(code, message, detalles = []) {
    super(message);
    this.name = 'ModeloError';
    this.code = code;
    this.detalles = detalles;
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function normalizarClave(clave) {
  return String(clave ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Raíces prohibidas. «cuentaCobro» y «cuentaDeCobro» sí valen (es un flujo de
 * RR, no una cuenta bancaria); «cuenta», «cuentaBancaria» y «numeroCuenta» no.
 */
function esCampoProhibido(clave) {
  const normal = normalizarClave(clave);
  if (!normal) return false;
  // «cuentaCobro» y «cuentaDeCobro» son flujos de RR, no cuentas bancarias.
  if (normal.startsWith('cuentacobro') || normal.startsWith('cuentadecobro')) return false;
  if (normal.startsWith('cuenta')) return true;
  return CAMPOS_PROHIBIDOS.some((prohibido) => normal === normalizarClave(prohibido)
    || normal.startsWith(normalizarClave(prohibido)));
}

export function crearModelo(base = {}) {
  const completo = {};
  for (const coleccion of COLECCIONES) {
    const registros = Array.isArray(base[coleccion]) ? base[coleccion] : [];
    completo[coleccion] = registros.map((registro) => normalizarRegistro(coleccion, registro));
  }
  return { schemaVersion: SCHEMA_VERSION, exportadoEn: '', base: completo, cambios: vacio() };
}

function vacio() {
  const cambios = {};
  for (const coleccion of COLECCIONES) cambios[coleccion] = {};
  return cambios;
}

function normalizarRegistro(coleccion, registro) {
  const base = {
    id: String(registro?.id ?? '').trim(),
    nombre: String(registro?.nombre ?? registro?.nombreCanonico ?? registro?.titulo ?? '').trim(),
    descripcion: String(registro?.descripcion ?? registro?.desc ?? '').trim(),
    fuente: String(registro?.fuente ?? '').trim() || SIN_CONFIRMAR,
    corte: String(registro?.corte ?? '').trim() || SIN_CONFIRMAR,
    estado: String(registro?.estado ?? SIN_CONFIRMAR).trim() || SIN_CONFIRMAR,
    etiquetas: Array.isArray(registro?.etiquetas) ? registro.etiquetas.map((item) => String(item)) : [],
    actualizadoEn: String(registro?.actualizadoEn ?? '').trim(),
    coleccion,
  };
  // Se conservan los campos propios de cada entidad (rolIds, url, bpmnXml...).
  for (const [clave, valor] of Object.entries(registro ?? {})) {
    if (clave in base) continue;
    base[clave] = clone(valor);
  }
  return base;
}

/** Materializa el modelo: base + cambios encima. */
export function fusionar(modelo) {
  const resultado = {};
  for (const coleccion of COLECCIONES) {
    const lista = new Map();
    for (const registro of modelo?.base?.[coleccion] ?? []) lista.set(registro.id, registro);
    for (const [id, registro] of Object.entries(modelo?.cambios?.[coleccion] ?? {})) {
      if (registro === null) lista.delete(id);
      else lista.set(id, registro);
    }
    resultado[coleccion] = [...lista.values()];
  }
  return { schemaVersion: SCHEMA_VERSION, exportadoEn: modelo?.exportadoEn ?? '', entidades: resultado };
}

export function entidades(modelo) {
  return fusionar(modelo).entidades;
}

/** Valida el modelo completo. Devuelve { ok, errores }. */
export function validar(modelo) {
  const errores = [];
  if (!isRecord(modelo)) {
    return { ok: false, errores: [{ ruta: '', codigo: 'MODELO_INVALIDO', mensaje: 'El modelo no es un objeto.' }] };
  }
  if (modelo.schemaVersion !== SCHEMA_VERSION) {
    errores.push({
      ruta: 'schemaVersion',
      codigo: 'VERSION',
      mensaje: `Se esperaba schemaVersion ${SCHEMA_VERSION} y llegó ${modelo.schemaVersion}.`,
    });
  }
  for (const coleccion of COLECCIONES) {
    const registros = modelo?.base?.[coleccion];
    if (registros !== undefined && !Array.isArray(registros)) {
      errores.push({ ruta: `base.${coleccion}`, codigo: 'COLECCION', mensaje: 'La colección debe ser una lista.' });
    }
    const cambiados = modelo?.cambios?.[coleccion];
    if (cambiados !== undefined && !isRecord(cambiados)) {
      errores.push({ ruta: `cambios.${coleccion}`, codigo: 'COLECCION', mensaje: 'Los cambios deben ser un objeto por id.' });
    }
  }
  const materializado = fusionar(modelo).entidades;
  for (const coleccion of COLECCIONES) {
    for (const registro of materializado[coleccion] ?? []) {
      errores.push(...validarRegistro(coleccion, registro, `${coleccion}.${registro.id}`));
    }
  }
  return { ok: errores.length === 0, errores };
}

/** Valida una entidad suelta (base o cambios). */
export function validarRegistro(coleccion, registro, ruta = coleccion) {
  const errores = [];
  if (!isRecord(registro)) {
    return [{ ruta, codigo: 'ENTIDAD', mensaje: 'La entidad no es un objeto.' }];
  }
  for (const campo of CAMPOS_OBLIGATORIOS) {
    if (typeof registro[campo] !== 'string' || !registro[campo].trim()) {
      errores.push({ ruta: `${ruta}.${campo}`, codigo: 'CAMPO', mensaje: `Falta ${campo}.` });
    }
  }
  for (const clave of Object.keys(registro)) {
    if (esCampoProhibido(clave)) {
      errores.push({
        ruta: `${ruta}.${clave}`,
        codigo: 'CAMPO_PROHIBIDO',
        mensaje: `El campo «${clave}» está prohibido en el Atlas.`,
      });
    }
  }
  if (coleccion === 'rol' && registro.tipo && !TIPOS_ROL.includes(registro.tipo)) {
    errores.push({ ruta: `${ruta}.tipo`, codigo: 'ESTADO', mensaje: `El tipo de rol debe ser ${TIPOS_ROL.join(', ')}.` });
  }
  if (coleccion === 'cliente' && registro.estado && !ESTADOS_CLIENTE.includes(registro.estado)) {
    errores.push({ ruta: `${ruta}.estado`, codigo: 'ESTADO', mensaje: 'El estado del cliente no está en la lista.' });
  }
  if (coleccion === 'proceso' && registro.estadoBpmn && !ESTADOS_PROCESO.includes(registro.estadoBpmn)) {
    errores.push({ ruta: `${ruta}.estadoBpmn`, codigo: 'ESTADO', mensaje: 'El estado BPMN del proceso no está en la lista.' });
  }
  return errores;
}

/** Exporta el modelo en el paquete versionado de la app. */
export function exportar(modelo, { exportadoEn } = {}) {
  const sello = exportadoEn ?? modelo?.exportadoEn ?? new Date().toISOString();
  const paquete = {
    schemaVersion: SCHEMA_VERSION,
    exportadoEn: sello,
    base: clone(modelo?.base ?? {}),
    cambios: clone(modelo?.cambios ?? {}),
  };
  return paquete;
}

/**
 * Importa un paquete. Es idempotente: importar(exportar(m)) devuelve el mismo
 * modelo, y exportar(importar(paquete)) devuelve el mismo paquete.
 */
export function importar(paquete) {
  if (!isRecord(paquete)) {
    throw new ModeloError('PAQUETE_INVALIDO', 'El archivo no es un objeto.');
  }
  if (paquete.schemaVersion !== SCHEMA_VERSION) {
    throw new ModeloError('VERSION', `Se esperaba schemaVersion ${SCHEMA_VERSION} y llegó ${paquete.schemaVersion}.`);
  }
  const modelo = {
    schemaVersion: SCHEMA_VERSION,
    exportadoEn: String(paquete.exportadoEn ?? ''),
    base: {},
    cambios: {},
  };
  for (const coleccion of COLECCIONES) {
    const base = Array.isArray(paquete.base?.[coleccion]) ? paquete.base[coleccion] : [];
    modelo.base[coleccion] = base.map((registro) => normalizarRegistro(coleccion, registro));
    const cambiados = isRecord(paquete.cambios?.[coleccion]) ? paquete.cambios[coleccion] : {};
    modelo.cambios[coleccion] = {};
    for (const [id, registro] of Object.entries(cambiados)) {
      modelo.cambios[coleccion][id] = registro === null ? null : normalizarRegistro(coleccion, registro);
    }
  }
  const reporte = validar(modelo);
  if (!reporte.ok) {
    throw new ModeloError('VALIDACION', 'El archivo tiene datos que el Atlas no admite.', reporte.errores);
  }
  return modelo;
}

/** Diferencia entre la base y los cambios: qué entra, qué sale y qué se toca. */
export function diff(modelo) {
  const resultado = [];
  for (const coleccion of COLECCIONES) {
    const base = new Map((modelo?.base?.[coleccion] ?? []).map((registro) => [registro.id, registro]));
    const cambios = modelo?.cambios?.[coleccion] ?? {};
    for (const [id, cambio] of Object.entries(cambios)) {
      if (cambio === null) {
        resultado.push({ coleccion, id, tipo: 'quitado', campos: [] });
        continue;
      }
      const anterior = base.get(id);
      if (!anterior) {
        resultado.push({ coleccion, id, tipo: 'nuevo', campos: Object.keys(cambio) });
        continue;
      }
      const campos = Object.keys(cambio).filter((campo) => JSON.stringify(anterior[campo]) !== JSON.stringify(cambio[campo]));
      if (campos.length) resultado.push({ coleccion, id, tipo: 'cambiado', campos });
    }
  }
  return resultado;
}

/**
 * Migración desde el export v4 del mapa vivo (producción, rr-atlas-operativo
 * 4.3.0): `{ schemaVersion: 1, exportedAt, nodes, edges }`.
 * Los nodos del mapa se vuelven entidades del modelo v5.
 */
export function migrarDesdeV4(payload, { corte = SIN_CONFIRMAR } = {}) {
  if (!isRecord(payload) || !Array.isArray(payload.nodes)) {
    throw new ModeloError('MIGRACION_V4', 'El export v4 no tiene la lista de nodos.');
  }
  const base = crearModelo();
  const rolPorNombre = new Map();
  const asegurarRol = (nombre, tipo = 'humano') => {
    const limpio = String(nombre ?? '').trim();
    if (!limpio || limpio === 'Por confirmar con Rosas') return null;
    const id = `rol-${normalizarClave(limpio)}`;
    if (!rolPorNombre.has(id)) {
      rolPorNombre.set(id, true);
      base.base.rol.push({
        id,
        nombre: limpio,
        descripcion: '',
        fuente: SIN_CONFIRMAR,
        corte,
        estado: 'activo',
        etiquetas: [],
        actualizadoEn: '',
        coleccion: 'rol',
        tipo,
        areaIds: [],
        responsabilidades: [],
      });
    }
    return id;
  };

  for (const nodo of payload.nodes) {
    if (!isRecord(nodo)) continue;
    const id = String(nodo.id ?? '').trim();
    if (!id) continue;
    const nombre = String(nodo.title ?? '').trim();
    const tipo = String(nodo.type ?? '').trim();
    const comun = {
      id,
      nombre,
      descripcion: String(nodo.desc ?? nodo.notes ?? '').trim(),
      fuente: SIN_CONFIRMAR,
      corte,
      estado: String(nodo.status ?? SIN_CONFIRMAR),
      etiquetas: Array.isArray(nodo.tags) ? nodo.tags.map((item) => String(item)) : [],
      actualizadoEn: '',
    };
    if (tipo === 'process' || tipo === 'proceso') {
      base.base.proceso.push({
        ...comun,
        coleccion: 'proceso',
        areaId: nodo.lineId ? `linea-${normalizarClave(nodo.lineId)}` : '',
        objetivo: '',
        disparador: '',
        resultado: '',
        carriles: [],
        bpmnXml: '',
        estadoBpmn: estadoBpmnDesdeV4(nodo.statusKey ?? nodo.status),
        sistemasIds: [],
        kpis: nodo.kpi ? [String(nodo.kpi)] : [],
        fragmentos: [],
        relacionados: [],
        owner: nodo.owner ? String(nodo.owner) : '',
      });
    } else if (tipo === 'bot') {
      const rolId = asegurarRol(nombre, 'bot');
      const rol = rolId ? base.base.rol.find((item) => item.id === rolId) : null;
      if (rol) rol.tipo = 'bot';
    } else if (tipo === 'line' || tipo === 'linea') {
      base.base.lineaNegocio.push({ ...comun, coleccion: 'lineaNegocio', etapas: [], productosIds: [] });
    } else if (tipo === 'client' || tipo === 'cliente') {
      base.base.cliente.push({ ...comun, coleccion: 'cliente', nombreCanonico: nombre });
    } else if (tipo === 'stage' || tipo === 'etapa') {
      base.base.area.push({ ...comun, coleccion: 'area', color: '', responsableRolId: '' });
    } else if (tipo === 'project' || tipo === 'proyecto') {
      base.base.proyecto.push({ ...comun, coleccion: 'proyecto', lineaId: '', clienteId: '', tecnologiaIds: [], hitos: [] });
    } else {
      base.base.area.push({ ...comun, coleccion: 'area', color: '', responsableRolId: '' });
    }
  }
  return base;
}

/** Migración desde el estado de la rama A (atlas-state v1: { nodes, edges }). */
export function migrarDesdeEstadoA(estado, { corte = SIN_CONFIRMAR } = {}) {
  if (!isRecord(estado) || !Array.isArray(estado.nodes)) {
    throw new ModeloError('MIGRACION_A', 'El estado de A no tiene la lista de nodos.');
  }
  const base = crearModelo();
  for (const nodo of estado.nodes) {
    if (!isRecord(nodo)) continue;
    const id = String(nodo.id ?? '').trim();
    if (!id) continue;
    const nombre = String(nodo.label ?? nodo.title ?? '').trim();
    base.base.proceso.push({
      id,
      nombre,
      descripcion: String(nodo.detail ?? nodo.description ?? '').trim(),
      fuente: SIN_CONFIRMAR,
      corte,
      estado: SIN_CONFIRMAR,
      etiquetas: [],
      actualizadoEn: '',
      coleccion: 'proceso',
      areaId: '',
      objetivo: '',
      disparador: '',
      resultado: '',
      carriles: [],
      bpmnXml: '',
      estadoBpmn: 'borrador',
      sistemasIds: [],
      kpis: [],
      fragmentos: [],
      relacionados: [],
    });
  }
  return base;
}

function estadoBpmnDesdeV4(statusKey) {
  const mapa = {
    valido: 'válido',
    borrador: 'borrador',
    deuda: 'con deuda',
    texto: 'solo texto',
    'no-existe': 'no existe',
    pausa: 'en pausa',
  };
  return mapa[statusKey] ?? 'sin confirmar';
}
