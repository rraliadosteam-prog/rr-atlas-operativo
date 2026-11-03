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
