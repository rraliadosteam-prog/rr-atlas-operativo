// Decisión de la puerta de 390 px · diseño v3 · bloque 1A (ítem 13).
//
//   node scripts/verificar-pulido.mjs   → la usa (ver scripts/piso-390.test.mjs)
//
// La lógica del veredicto vive aquí, en funciones **puras**, para que
// `npm test` la cubra sin necesidad de un navegador: `scripts/verificar-pulido.mjs`
// solo trae la lectura del gancho y aplica el veredicto.
//
// Los tres casos que el diseño pide, cada uno con su veredicto:
//
//   · El gancho **existe** (bloque 1B entregado): falla si no se pudo leer el
//     zoom y falla si el zoom leído está por debajo del piso de legibilidad
//     declarado (1,15). Es el veredicto que cuenta.
//   · El gancho **todavía no existe** (bloque 1A, antes de que se fusione el
//     PR #7): la puerta **no falla**; escribe `modo: 'sin-gancho'` y
//     `zoom: null` y avisa de que el diagrama todavía no se puede certificar.
//     Una puerta no puede fallar por lo que todavía no se ha escrito.
//   · El gancho existe pero **apunta a otro diagrama**: falla.
//
// Y el caso del **escritorio** (lienzo ancho): allí el diagrama entero cabe
// con margen, así que el piso de 1,15 **no** aplica (el escritorio abre en
// «ver el todo», no en una esquina a 1:1). En un lienzo ancho la puerta
// afirma el **modo** («todo») y que el diagrama entero se ve dentro del
// lienzo; el zoom legible solo se exige en lienzo angosto (≤ 900 px).

import { PISO_LEGIBILIDAD_DIAGRAMA } from '../src/core/zoom.mjs';

/** El diagrama todavía no se puede certificar: no hay gancho que leer. */
export const MODO_SIN_GANCHO = 'sin-gancho';

/** El diagrama abre a un zoom legible (≥ 1,15). */
export const MODO_LEGIBLE = 'legible';

/** El diagrama abre por debajo del piso de legibilidad. */
export const MODO_ILEGIBLE = 'ilegible';

/** El gancho existe, pero el zoom no se pudo leer como número. */
export const MODO_SIN_ZOOM = 'sin-zoom';

/** El gancho existe, pero apunta a otro diagrama. */
export const MODO_OTRO_DIAGRAMA = 'otro-diagrama';

/** El diagrama abre en «ver el todo» (lo que se exige en lienzo ancho). */
export const MODO_TODO_ANCHO = 'todo-ancho';

/** El diagrama abre en un modo que no es «ver el todo». */
export const MODO_NO_TODO = 'no-todo';

/**
 * Veredicto de la puerta de 390 px a partir de lo que se leyó en el lienzo.
 *
 * @param {object} lectura
 * @param {boolean} lectura.existeGancho ¿Hay un gancho de depuración con el estado del lienzo?
 * @param {number|null} lectura.zoom El zoom leído (o `null` si no se pudo leer).
 * @param {string|null} lectura.proceso El proceso al que apunta el gancho.
 * @param {string|null} lectura.procesoEsperado El diagrama que la puerta está revisando.
 * @returns {{modo: string, ok: boolean, zoom: number|null, mensaje: string}}
 */
export function evaluarPiso390(lectura = {}) {
  const {
    existeGancho = false,
    zoom = null,
    proceso = null,
    procesoEsperado = null,
  } = lectura;

  if (!existeGancho) {
    return {
      modo: MODO_SIN_GANCHO,
      ok: true,
      zoom: null,
      mensaje: 'todavía no se puede certificar: no hay gancho con el estado del lienzo',
    };
  }

  if (proceso && procesoEsperado && proceso !== procesoEsperado) {
    return {
      modo: MODO_OTRO_DIAGRAMA,
      ok: false,
      zoom: Number.isFinite(zoom) ? zoom : null,
      mensaje: `el gancho apunta a «${proceso}» y no a «${procesoEsperado}»`,
    };
  }

  if (!Number.isFinite(zoom)) {
    return {
      modo: MODO_SIN_ZOOM,
      ok: false,
      zoom: null,
      mensaje: 'el gancho existe pero el zoom no se pudo leer como número',
    };
  }

  if (zoom < PISO_LEGIBILIDAD_DIAGRAMA) {
    return {
      modo: MODO_ILEGIBLE,
      ok: false,
      zoom,
      mensaje: `abre a zoom ${zoom} y el piso de legibilidad es ${PISO_LEGIBILIDAD_DIAGRAMA}`,
    };
  }

  return {
    modo: MODO_LEGIBLE,
    ok: true,
    zoom,
    mensaje: `abre a zoom ${zoom} (piso de legibilidad ${PISO_LEGIBILIDAD_DIAGRAMA})`,
  };
}

/**
 * Veredicto de la puerta en un **lienzo ancho** (escritorio): el diagrama
 * entero cabe con margen, así que el piso de 1,15 no aplica y el diagrama
 * tiene que abrir en modo «todo» (ver el todo).
 *
 * @param {object} lectura
 * @param {boolean} lectura.existeGancho
 * @param {number|null} lectura.zoom
 * @param {string|null} lectura.proceso
 * @param {string|null} lectura.procesoEsperado
 * @param {string|null} lectura.modo El modo de lectura que declara el motor.
 * @returns {{modo: string, ok: boolean, zoom: number|null, mensaje: string}}
 */
export function evaluarAncho(lectura = {}) {
  const {
    existeGancho = false,
    zoom = null,
    proceso = null,
    procesoEsperado = null,
    modo = null,
  } = lectura;

  if (!existeGancho) {
    return {
      modo: MODO_SIN_GANCHO,
      ok: false,
      zoom: null,
      mensaje: 'no hay gancho con el estado del lienzo: el diagrama no se puede certificar',
    };
  }

  if (proceso && procesoEsperado && proceso !== procesoEsperado) {
    return {
      modo: MODO_OTRO_DIAGRAMA,
      ok: false,
      zoom: Number.isFinite(zoom) ? zoom : null,
      mensaje: `el gancho apunta a «${proceso}» y no a «${procesoEsperado}»`,
    };
  }

  if (modo !== 'todo') {
    return {
      modo: MODO_NO_TODO,
      ok: false,
      zoom: Number.isFinite(zoom) ? zoom : null,
      mensaje: `el diagrama abre en modo «${modo ?? 'desconocido'}» y en lienzo ancho tiene que abrir en «todo»`,
    };
  }

  return {
    modo: MODO_TODO_ANCHO,
    ok: true,
    zoom: Number.isFinite(zoom) ? zoom : null,
    mensaje: `abre en modo «todo» a zoom ${zoom} (en lienzo ancho el piso de ${PISO_LEGIBILIDAD_DIAGRAMA} no aplica)`,
  };
}

/**
 * Lee el estado del lienzo **dentro de la página** (Playwright serializa la
 * función y la ejecuta en el navegador). Solo usa `window`: no depende de
 * nada de este módulo.
 *
 * Acepta los dos ganchos que la puerta puede encontrar:
 *   · `window.__rrAtlasZoom` — el zoom, si alguien lo expone así.
 *   · `window.__rrAtlasBpmn.estado().zoom` — el gancho que compone la vista
 *     BPMN en el bloque 1B.
 * Si no hay ninguno, el diagrama todavía no se puede certificar.
 *
 * Además del zoom devuelve el **modo de lectura** (`todo`, `paso` o
 * `paso-ajustado`) y el **paso actual**: la puerta los necesita para saber
 * qué veredicto de encuadre aplica (P1.9).
 */
export function leerEstadoLienzo(ventana = globalThis.window ?? globalThis) {
  if (ventana.__rrAtlasZoom !== undefined && ventana.__rrAtlasZoom !== null) {
    return { existeGancho: true, zoom: ventana.__rrAtlasZoom, proceso: null, modo: null, paso: null };
  }
  const gancho = ventana.__rrAtlasBpmn;
  if (gancho && typeof gancho.estado === 'function') {
    let estado = null;
    try {
      estado = gancho.estado();
    } catch {
      estado = null;
    }
    const objeto = estado && typeof estado === 'object' ? estado : {};
    return {
      existeGancho: true,
      zoom: objeto.zoom ?? null,
      proceso: objeto.proceso ?? null,
      modo: objeto.modo ?? null,
      paso: objeto.paso ?? null,
    };
  }
  return { existeGancho: false, zoom: null, proceso: null, modo: null, paso: null };
}

/**
 * Veredicto de la puerta de 390 px sobre **todos** los diagramas a la vez.
 *
 * El caso «sin gancho» sigue existiendo en el código (el diseño lo
 * conserva: una puerta no puede fallar por lo que todavía no se ha
 * escrito), pero en el bloque 1B el gancho **tiene que existir**: si
 * ninguno de los diagramas lo tiene, la puerta falla. Un diagrama suelto
 * sin gancho se avisa, pero no hunde la puerta.
 *
 * @param {Array<{modo?: string}>} veredictos el veredicto de cada diagrama
 * @returns {{ok: boolean, diagramas: number, sinGancho: number, mensaje: string}}
 */
export function evaluarConjunto390(veredictos = []) {
  const lista = Array.isArray(veredictos) ? veredictos.filter(Boolean) : [];
  const sinGancho = lista.filter((veredicto) => veredicto.modo === MODO_SIN_GANCHO).length;
  if (lista.length && sinGancho === lista.length) {
    return {
      ok: false,
      diagramas: lista.length,
      sinGancho,
      mensaje: `ninguno de los ${lista.length} diagramas tiene gancho: en el bloque 1B el gancho tiene que existir`,
    };
  }
  return {
    ok: true,
    diagramas: lista.length,
    sinGancho,
    mensaje: sinGancho
      ? `${sinGancho} de ${lista.length} diagramas sin gancho: todavía no se pueden certificar`
      : `${lista.length} diagramas leídos por el gancho`,
  };
}
