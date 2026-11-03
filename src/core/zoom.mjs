// Módulo de pisos de zoom · Atlas RR (diseño v3 · bloque 1A · ítems 1 y 2).
//
// Sin dependencias y sin DOM: se prueba en Node con `node --test`.
//
// Este módulo es la **única fuente** de los pisos de zoom. Hoy el mismo
// encuadre tiene dos pisos distintos en pantalla estrecha (0,45 y 0,70) y
// tres predicados distintos de «pantalla estrecha» (≤760, ≤900 y «el
// contenedor» < 540), y el piso manual del motor (0,55) está por encima del
// zoom de encuadre real (0,12–0,25 a 390 px), que es lo que hace que el
// botón «−» agrande en vez de alejar.
//
// El módulo habla del **ancho de la superficie donde se aplica**, no del
// ancho de pantalla: el motor BPMN mide su **contenedor** (`narrow()`,
// `src/bpmn/entry.mjs:175`) y el mapa vivo mide la **ventana**.

/** «Pantalla estrecha»: por debajo o justo en este ancho se lee peor. */
export const ANCHO_ESTRECHO_PX = 900;

/** «Móvil»: el ancho de un teléfono (o de una tableta en vertical). */
export const ANCHO_MOVIL_PX = 760;

/** «Lienzo angosto»: el ancho del **contenedor** del diagrama, no el de la ventana. */
export const ANCHO_CONTENEDOR_ESTRECHO = 540;

/** Piso de lectura del mapa en móvil (≤ 760 px): `MOBILE_ZOOM_MIN`. */
export const PISO_LECTURA_MOVIL = 0.7;

/** Piso de lectura del mapa en pantalla estrecha (≤ 900 px): `ZOOM_MIN_LECTURA`. */
export const PISO_LECTURA_ESTRECHA = 0.45;

/** Piso de lectura del mapa en escritorio: el encuadre puede ser el que sea. */
export const PISO_LECTURA_MAPA_FONDO = 0.001;

/** Piso del zoom manual del mapa (rueda y pellizco): hoy 0,01 y 0,05. */
export const PISO_ZOOM_MANUAL_MAPA = 0.1;

/** Piso del zoom manual del motor en lienzo angosto: hoy 0,55 (el bug B2). */
export const PISO_ZOOM_MANUAL_MOTOR = 0.12;

/** Piso del zoom manual del motor en lienzo ancho: hoy 0,2. */
export const PISO_ZOOM_MANUAL_MOTOR_ES = 0.2;

/**
 * Piso de legibilidad del diagrama: a 390 px es escala ≈1:1 y el texto de
 * las tareas se lee. Es el valor que el motor **ya** aplica en `showStep()`
 * (`src/bpmn/entry.mjs:248`) y en `focus()` (`:548`); lo que falta es
 * usarlo **al abrir** (eso es el bloque 1B).
 */
export const PISO_LEGIBILIDAD_DIAGRAMA = 1.15;

/** Margen del encuadre del diagrama: `src/bpmn/entry.mjs:494`. */
export const MARGEN_ENCUADRE = 0.94;

/** Techo del zoom del diagrama. */
export const ZOOM_MAXIMO = 2.6;

/** Techo del zoom del mapa. */
export const ZOOM_MAXIMO_MAPA = 1.25;

/** ¿La ventana es estrecha (≤ 900 px)? */
export const esPantallaEstrecha = (anchoVentana) => anchoVentana <= ANCHO_ESTRECHO_PX;

/** ¿La ventana es de móvil (≤ 760 px)? */
export const esMovil = (anchoVentana) => anchoVentana <= ANCHO_MOVIL_PX;

/** ¿El contenedor del lienzo es angosto (< 540 px)? */
export const esLienzoAngosto = (anchoContenedor) => anchoContenedor < ANCHO_CONTENEDOR_ESTRECHO;

/**
 * Piso de lectura del mapa vivo, según el ancho de la ventana.
 * 0,70 en móvil · 0,45 en pantalla estrecha · 0,001 en escritorio.
 */
export const pisoLecturaMapa = (anchoVentana) => {
  if (esMovil(anchoVentana)) return PISO_LECTURA_MOVIL;
  if (esPantallaEstrecha(anchoVentana)) return PISO_LECTURA_ESTRECHA;
  return PISO_LECTURA_MAPA_FONDO;
};

/**
 * Piso del zoom manual del mapa (rueda y pellizco): nunca puede quedar por
 * debajo del piso de lectura de la **misma** pantalla, así que las tarjetas
 * no se pueden mini-ar.
 */
export const pisoManualMapa = (anchoVentana) => Math.max(PISO_ZOOM_MANUAL_MAPA, pisoLecturaMapa(anchoVentana));

/**
 * Piso del zoom manual del motor (botón «−»): puede quedar por debajo del
 * zoom de encuadre —tiene que poder, para que «−» aleje de verdad—, pero no
 * por encima: si fuera mayor que el encuadre real, «−» agrandaría.
 */
export const pisoManualMotor = (anchoContenedor) => (
  esLienzoAngosto(anchoContenedor) ? PISO_ZOOM_MANUAL_MOTOR : PISO_ZOOM_MANUAL_MOTOR_ES
);

/** Piso de legibilidad del diagrama (1,15). */
export const pisoLegibilidadDiagrama = () => PISO_LEGIBILIDAD_DIAGRAMA;

/**
 * Piso de lectura del mapa **vigente**: el que el mapa vivo garantiza hoy,
 * antes de que `src/app/rr-tree.mjs` lea su encuadre de este módulo (bloque
 * 1C, ítem 6). Hoy el encuadre del mapa se limita a `PISO_LECTURA_ESTRECHA`
 * en cualquier pantalla ≤ 900 px, así que el piso móvil nuevo (0,70) todavía
 * no se puede exigir en la prueba de vista.
 * Cuando 1C adopte `pisoLecturaMapa()`, esta función pasa a devolverlo.
 */
export const pisoLecturaMapaVigente = (anchoVentana) => Math.min(pisoLecturaMapa(anchoVentana), PISO_LECTURA_ESTRECHA);

// ── Ayudas puras de zoom ────────────────────────────────────────────────────

/**
 * Sube un zoom hasta el piso. Un zoom que no es un número se devuelve tal
 * cual: la función no inventa un zoom que nadie ha medido.
 */
export const aplicarPiso = (zoom, piso) => (Number.isFinite(zoom) ? Math.max(zoom, piso) : zoom);

/** Baja un zoom hasta el techo. Un zoom que no es un número se devuelve tal cual. */
export const aplicarTecho = (zoom, techo) => (Number.isFinite(zoom) ? Math.min(zoom, techo) : zoom);

/** Acota un zoom entre un piso y un techo. */
export const acotarZoom = (zoom, piso, techo) => aplicarTecho(aplicarPiso(zoom, piso), techo);

/** ¿El zoom se puede leer y es legible (≥ 1,15)? */
export const esZoomLegible = (zoom) => Number.isFinite(zoom) && zoom >= PISO_LEGIBILIDAD_DIAGRAMA;
