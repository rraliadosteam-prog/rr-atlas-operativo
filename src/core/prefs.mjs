// Preferencias locales del Atlas · diseño v3 · bloque 1A (ítems 62 y 63).
//
// Viven en `localStorage`, en una clave **versionada** (`rr-atlas:prefs:v1`),
// con el patrón que el repo ya usa (`rr-atlas-arbol-v2`, `rr-atlas:v5`,
// `rr-atlas:bpmn:<id>`). Sin DOM: se prueba en Node sobre **datos**, no sobre
// la interfaz.
//
// Son el **interruptor para apagar** (R8, D15): apagan en **este navegador**,
// no en el de los demás (no hay backend y no se puede forzar un apagado
// general sin redesplegar). El apagado de emergencia por URL (`?atlas=seguro`,
// bloque 1B) es otra cosa: solo dura la sesión y no toca `legibilidad`.
//
// Si `localStorage` no está disponible (Node, modo privado, cookies
// bloqueadas), la app **no se rompe**: se usan los valores por defecto y no
// se escribe nada.

/** Versión del formato de preferencias. */
export const VERSION_PREFS = 1;

/** Clave versionada del almacén de preferencias. */
export const CLAVE_PREFS = `rr-atlas:prefs:v${VERSION_PREFS}`;

/**
 * Valores por defecto.
 * · `modoPaso` apaga el modo paso **y** la banda de lectura.
 * · `legibilidad` apaga el piso 1,15 y vuelve al encuadre viejo (es local y
 *   **no** entra en el apagado de emergencia).
 * · `copiador` apaga la acción «Compartir».
 * · `guiaVista` no abre la guía sola la primera vez.
 * · `avisosVistos` es una **lista** de versiones ya vistas (no es un
 *   interruptor).
 */
export const PREFERENCIAS_POR_DEFECTO = Object.freeze({
  modoPaso: true,
  legibilidad: true,
  copiador: true,
  guiaVista: false,
  avisosVistos: Object.freeze([]),
});

/** Las cuatro banderas booleanas (las que llevan interruptor). */
export const BANDERAS_PREFS = Object.freeze(['modoPaso', 'legibilidad', 'copiador', 'guiaVista']);

/**
 * El almacén, o `null` si este entorno no lo tiene (o no lo deja usar).
 * Nunca lanza: que no haya `localStorage` es un caso normal, no un error.
 */
function almacenSeguro() {
  try {
    const almacen = globalThis.localStorage;
    if (!almacen || typeof almacen.getItem !== 'function') return null;
    return almacen;
  } catch {
    return null;
  }
}

/** Lo que hay guardado en la clave, o `null` si no hay nada legible. */
function leerBruto(almacen) {
  if (!almacen) return null;
  try {
    const texto = almacen.getItem(CLAVE_PREFS);
    if (!texto) return null;
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/**
 * Las preferencias guardadas, con los valores por defecto para lo que falte.
 * **Nunca escribe**: leer no deja rastro en el almacén.
 * Una clave de **otra versión** se ignora entera y se usan los valores por
 * defecto.
 */
export function leerPreferencias(almacen = almacenSeguro()) {
  const resultado = { ...PREFERENCIAS_POR_DEFECTO, avisosVistos: [] };
  const guardadas = leerBruto(almacen);
  if (!guardadas || typeof guardadas !== 'object' || Array.isArray(guardadas)) return resultado;
  if (guardadas.version !== VERSION_PREFS) return resultado;
  for (const bandera of BANDERAS_PREFS) {
    if (typeof guardadas[bandera] === 'boolean') resultado[bandera] = guardadas[bandera];
  }
  if (Array.isArray(guardadas.avisosVistos)) {
    resultado.avisosVistos = guardadas.avisosVistos.filter((version) => typeof version === 'string');
  }
  return resultado;
}

/**
 * Guarda las preferencias (se mezclan con las que ya había) y devuelve si
 * se pudieron guardar. Sin almacén, o con un almacén que falla, devuelve
 * `false` **sin lanzar**: la app sigue con los valores por defecto.
 */
export function escribirPreferencias(preferencias = {}, almacen = almacenSeguro()) {
  if (!almacen) return false;
  const actuales = leerPreferencias(almacen);
  const siguiente = { ...actuales, avisosVistos: [...actuales.avisosVistos] };
  for (const bandera of BANDERAS_PREFS) {
    if (typeof preferencias[bandera] === 'boolean') siguiente[bandera] = preferencias[bandera];
  }
  if (Array.isArray(preferencias.avisosVistos)) {
    siguiente.avisosVistos = preferencias.avisosVistos.filter((version) => typeof version === 'string');
  }
  try {
    almacen.setItem(CLAVE_PREFS, JSON.stringify({ ...siguiente, version: VERSION_PREFS }));
    return true;
  } catch {
    return false;
  }
}

/**
 * El valor de una preferencia. Las banderas booleanas y la lista
 * `avisosVistos` se leen igual; una clave que no existe devuelve `undefined`.
 */
export function preferencia(clave, almacen = almacenSeguro()) {
  const preferencias = leerPreferencias(almacen);
  return Object.hasOwn(preferencias, clave) ? preferencias[clave] : undefined;
}

/**
 * Marca la guía como vista. Es el **único** momento en que se escribe
 * `guiaVista`: se escribe al cerrar la guía, no antes.
 */
export function marcarGuiaVista(almacen = almacenSeguro()) {
  return escribirPreferencias({ guiaVista: true }, almacen);
}

/**
 * Marca una versión del aviso de cambios como vista. La lista no se escribe
 * al leer: solo cuando se marca una versión concreta.
 */
export function marcarAvisoVisto(version, almacen = almacenSeguro()) {
  if (typeof version !== 'string' || !version.trim()) return false;
  const actuales = leerPreferencias(almacen);
  const lista = actuales.avisosVistos.includes(version)
    ? [...actuales.avisosVistos]
    : [...actuales.avisosVistos, version];
  return escribirPreferencias({ avisosVistos: lista }, almacen);
}

// ── El override de sesión (bloque 1B) ─────────────────────────────────────
//
// El override es un objeto **en memoria** que manda sobre lo guardado. No
// se escribe nunca en el almacén: dura lo que dura la sesión. Es lo que
// necesita el apagado de emergencia por URL (`?atlas=seguro`, ítem 67) y
// cualquier ajuste que no deba tocar el `localStorage`.
//
// Solo se aceptan las claves del contrato —las cuatro banderas booleanas y
// la lista `avisosVistos`— y **solo con el tipo correcto**: el override no
// puede inventar preferencias ni romper la forma de las que ya existen.

/** El override de sesión vigente (o `null` si no hay). */
let overrideSesion = null;

/** Solo las claves del contrato, y con el tipo correcto. */
function sanearOverride(override) {
  const limpio = {};
  if (!override || typeof override !== 'object' || Array.isArray(override)) return limpio;
  for (const bandera of BANDERAS_PREFS) {
    if (typeof override[bandera] === 'boolean') limpio[bandera] = override[bandera];
  }
  if (Array.isArray(override.avisosVistos)) {
    limpio.avisosVistos = override.avisosVistos.filter((version) => typeof version === 'string');
  }
  return limpio;
}

/**
 * Fija el override de sesión (se **fusiona** con el que hubiera: no borra
 * las banderas que no se mencionan). `null` (o `sin argumentos`) lo quita.
 *
 * No escribe nada en el almacén: es memoria de la sesión.
 *
 * @param {object|null} override
 * @returns {object|null} el override vigente (o `null` si se quitó)
 */
export function fijarOverrideSesion(override = null) {
  if (override === null || override === undefined) {
    overrideSesion = null;
    return null;
  }
  const limpio = sanearOverride(override);
  overrideSesion = { ...(overrideSesion || {}), ...limpio };
  return { ...overrideSesion };
}

/**
 * Las preferencias **vigentes**: lo guardado con el override de sesión
 * encima. Es lo que lee la interfaz (la banda de lectura, entre otros),
 * porque el override manda mientras dure la sesión.
 */
export function obtenerPreferenciasVigentes(almacen = almacenSeguro()) {
  const guardadas = leerPreferencias(almacen);
  if (!overrideSesion) return guardadas;
  return { ...guardadas, ...overrideSesion };
}

/** Vuelve a los valores de fábrica: borra la clave versionada. */
export function restablecerPreferencias(almacen = almacenSeguro()) {
  if (!almacen) return false;
  try {
    almacen.removeItem(CLAVE_PREFS);
    return true;
  } catch {
    return false;
  }
}

// ── El apagado de emergencia por URL (bloque 1B · ítem 67) ───────────────
//
// `?atlas=seguro` es la **válvula de escape** (R8, D15): apaga el modo
// paso (y con él la banda de lectura), el copiador y la guía automática
// **en memoria**, sin escribir nada en `localStorage` y sin tocar
// `legibilidad`: el piso de 1,15 que el dueño aprobó queda siempre
// activo, también en modo seguro.
//
// Dura **lo que dura la sesión** y solo afecta a quien abre ese enlace,
// en ese navegador: no hay apagado general sin redesplegar.

/** Parámetro de la URL que pide el modo seguro. */
export const PARAMETRO_ATLAS = 'atlas';

/** Valor de ese parámetro que activa el modo seguro. */
export const VALOR_SEGURO = 'seguro';

/**
 * El override que impone `?atlas=seguro`.
 *
 * · `modoPaso: false` apaga el modo paso **y** la banda de lectura.
 * · `copiador: false` apaga la acción «Compartir».
 * · `guiaVista: true` marca la guía como vista: **no se abre sola**.
 *
 * **No menciona `legibilidad`**: el piso de 1,15 queda siempre activo.
 */
export const OVERRIDE_SEGURO = Object.freeze({
  modoPaso: false,
  copiador: false,
  guiaVista: true,
});

/** Lo que llega en `location.search`, como parámetros (o `null`). */
function parametrosDe(search) {
  if (search instanceof URLSearchParams) return search;
  if (typeof search !== 'string') return null;
  try {
    return new URLSearchParams(search);
  } catch {
    return null;
  }
}

/**
 * El override de sesión que pide la URL, o `null` si la URL no pide nada.
 *
 * **Función pura**: no lee ni escribe el almacén y devuelve siempre un
 * objeto **nuevo** (cambiarlo no cambia nada de lo que sigue).
 *
 * @param {string|URLSearchParams} search `location.search` o sus parámetros
 * @returns {object|null} `{ modoPaso: false, copiador: false, guiaVista: true }`
 *   para `?atlas=seguro`; `null` en cualquier otro caso
 */
export function overrideDesdeQuery(search) {
  const parametros = parametrosDe(search);
  if (!parametros) return null;
  if (parametros.get(PARAMETRO_ATLAS) !== VALOR_SEGURO) return null;
  return { ...OVERRIDE_SEGURO };
}

/**
 * ¿Se puede abrir la guía **automáticamente** (sin que nadie la pida)? La
 * preferencia `guiaVista` dice que la guía ya se vio: entonces no se
 * abre sola. En modo seguro el override la deja en `true`, así que la
 * guía automática **no** se abre.
 */
export function puedeAbrirGuiaAuto(almacen = almacenSeguro()) {
  return obtenerPreferenciasVigentes(almacen).guiaVista !== true;
}
