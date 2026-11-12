/**
 * Arma la base v5 del Atlas con los archivos crudos de `src/data/base/`.
 *
 * Vive aparte de `index.mjs` porque el navegador carga esos archivos por
 * `fetch` (no como módulos JSON) y Node los importa como módulos: las dos
 * caminos usan esta misma función, así que la base es idéntica en los dos.
 */

export const ARCHIVOS_BASE = Object.freeze([
  'empresa.json',
  'equipo.json',
  'clientes.json',
  'proyectos.json',
  'procesos.json',
]);

/** Une los cinco archivos crudos en las once colecciones del esquema v5. */
export function componerBase({ empresa, equipo, clientes, proyectos, procesos } = {}) {
  const empresa_ = empresa ?? {};
  const equipo_ = equipo ?? {};
  const clientes_ = clientes ?? {};
  const proyectos_ = proyectos ?? {};
  const procesos_ = procesos ?? {};
  return {
    area: empresa_.area ?? [],
    rol: equipo_.rol ?? [],
    persona: equipo_.persona ?? [],
    lineaNegocio: empresa_.lineaNegocio ?? [],
    cliente: clientes_.cliente ?? [],
    proyecto: proyectos_.proyecto ?? [],
    sistema: proyectos_.sistema ?? [],
    proceso: procesos_.proceso ?? [],
    paso: [],
    fragmento: [],
    tarea: [],
  };
}
