// Puerta de verificación del Atlas · reglas del semáforo.
// Funciones puras: no tocan disco ni red, para poder probarlas solas.

export const VERDE = 'verde';
export const AMARILLO = 'amarillo';
export const ROJO = 'rojo';

const ORDEN = { [VERDE]: 0, [AMARILLO]: 1, [ROJO]: 2 };

/** El peor de varios colores. */
export function peor(...colores) {
  return colores.reduce((a, b) => (ORDEN[b] > ORDEN[a] ? b : a), VERDE);
}

/** Códigos de tsc que delatan un fallo real (nombre que no existe, archivo que falta, sintaxis). */
const TS_GRAVES = new Set(['TS2304', 'TS2552', 'TS2305', 'TS2614', 'TS2724']);

/**
 * Separa los errores de tsc en «graves» y «avisos».
 * - Graves: nombre sin definir, export que no existe, sintaxis (TS1xxx) o un
 *   import relativo a un archivo que no existe.
 * - Avisos: tipos del DOM sin anotar, imports con «?v=» (cache-busting) o con
 *   ruta absoluta del servidor, paquetes sin tipos. No rompen la app.
 */
export function clasificarTsc(salida) {
  const graves = [];
  const avisos = [];
  for (const linea of String(salida).split('\n')) {
    const m = linea.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!m) continue;
    const [, archivo, fila, , codigo, texto] = m;
    const error = { archivo, fila: Number(fila), codigo, texto };
    let grave = TS_GRAVES.has(codigo) || /^TS1\d{3}$/.test(codigo);
    if (codigo === 'TS2307') {
      const modulo = (texto.match(/'([^']+)'/) ?? [])[1] ?? '';
      grave = modulo.startsWith('.') && !modulo.includes('?');
    }
    (grave ? graves : avisos).push(error);
  }
  return { graves, avisos };
}

/** a. Estructura: build, pruebas, sintaxis y tipos. */
export function colorEstructura({ build, pruebas, sintaxis, tsc }) {
  if (!build.ok || !pruebas.ok || !sintaxis.ok) return ROJO;
  if (!tsc.corrio) return AMARILLO;
  if (tsc.graves.length > 0) return ROJO;
  return VERDE;
}

/** b. Flujo: clics reales. «falla» = error de la app o botón que no se deja pulsar. */
export function colorFlujo(clics) {
  if (clics.length === 0) return ROJO;
  const fallan = clics.filter((c) => c.estado === 'falla');
  const conError = fallan.filter((c) => c.errorApp);
  const mudos = clics.filter((c) => c.estado === 'sin-respuesta');
  if (conError.length > 0 || fallan.length / clics.length > 0.1) return ROJO;
  if (fallan.length > 0 || mudos.length > 0) return AMARILLO;
  return VERDE;
}

/** c. Drive: sin sincronización = rojo; sincronización sin medir = amarillo. */
export function colorDrive({ implementada, medida, segundos, limiteSegundos = 120 }) {
  if (!implementada) return ROJO;
  if (!medida) return AMARILLO;
  return segundos <= limiteSegundos ? VERDE : AMARILLO;
}

/** d. Base de datos: escrituras que no vienen de Drive = rojo; datos guardados fuera de Drive = amarillo. */
export function colorDatos({ escriturasRemotas, peticionesEscritura, guardadoLocal }) {
  if (escriturasRemotas.length > 0 || peticionesEscritura.length > 0) return ROJO;
  if (guardadoLocal.length > 0) return AMARILLO;
  return VERDE;
}
