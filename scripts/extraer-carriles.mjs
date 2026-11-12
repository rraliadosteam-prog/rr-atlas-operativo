// Extrae los carriles de los diagramas BPMN y los deja en el modelo v5.
//
//   node scripts/extraer-carriles.mjs [--simular]
//
// Qué hace:
//   1. Lee los 16 diagramas de `src/bpmn/seeds/` y saca los nombres de carril.
//   2. Mapea cada carril a un rol del modelo (`src/core/carriles.mjs`).
//   3. Escribe en `src/data/base/procesos.json`, para cada proceso con
//      semilla: `carriles` (ids de rol), `carrilNombres` (lo que se lee en el
//      diagrama) y `carrilPendientes` (los que no tienen rol con fuente).
//
// No inventa datos: lo que no tiene fuente se queda como pendiente.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BpmnModdle } from 'bpmn-moddle';
import { carrilesDelProceso } from '../src/core/carriles.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEMILLAS = resolve(RAIZ, 'src/bpmn/seeds');
const PROCESOS = resolve(RAIZ, 'src/data/base/procesos.json');
const simulating = process.argv.includes('--simular');

const moddle = new BpmnModdle();

async function carrilesDelArchivo(ruta) {
  const xml = readFileSync(ruta, 'utf8');
  const { rootElement } = await moddle.fromXML(xml);
  const nombres = [];
  for (const proceso of rootElement.rootElements.filter((elemento) => elemento.$type === 'bpmn:Process')) {
    for (const laneSet of proceso.laneSets ?? []) {
      for (const lane of laneSet.laneValues ?? laneSet.lanes ?? []) {
        if (lane.name) nombres.push(lane.name);
      }
    }
  }
  return nombres;
}

const { readdir } = await import('node:fs/promises');
const archivos = (await readdir(SEMILLAS)).filter((archivo) => archivo.endsWith('.bpmn')).sort();

const porSemilla = new Map();
for (const archivo of archivos) {
  const nombres = await carrilesDelArchivo(resolve(SEMILLAS, archivo));
  porSemilla.set(archivo, nombres);
}

// El archivo se parchea por texto (una entidad por línea) para no reformatear
// todo el JSON del repo: el diff queda con solo las líneas que cambian.
const texto = readFileSync(PROCESOS, 'utf8');
const lineas = texto.split('\n');
const cambios = [];

for (let indice = 0; indice < lineas.length; indice += 1) {
  const linea = lineas[indice];
  const semilla = linea.match(/"semilla":\s*"([^"]+\.bpmn)"/)?.[1];
  if (!semilla) continue;
  const nombres = porSemilla.get(semilla);
  if (!nombres) {
    console.warn(`  (aviso) la línea ${indice + 1} apunta a una semilla que no está: ${semilla}`);
    continue;
  }
  const { nombres: lista, roles, pendientes } = carrilesDelProceso(nombres);
  const campos = `"carriles": ${JSON.stringify(roles)}, "carrilNombres": ${JSON.stringify(lista)}, "carrilPendientes": ${JSON.stringify(pendientes)}`;
  if (linea.includes('"carrilNombres"')) {
    lineas[indice] = linea.replace(/"carriles":\s*\[[^\]]*\], "carrilNombres":\s*\[[^\]]*\], "carrilPendientes":\s*\[[^\]]*\]/, campos);
  } else {
    lineas[indice] = linea.replace(/"carriles":\s*\[\]/, campos);
  }
  cambios.push({ id: semilla, carriles: lista, roles, pendientes });
}

if (simulating) {
  console.log(`Plan: ${cambios.length} proceso(s) con carriles.`);
  for (const cambio of cambios) {
    console.log(`  · ${cambio.id}: ${cambio.carriles.join(' / ')} → roles [${cambio.roles.join(', ') || 'ninguno'}]`);
  }
} else {
  writeFileSync(PROCESOS, lineas.join('\n'), 'utf8');
  console.log(`Carriles actualizados en ${cambios.length} proceso(s) con semilla.`);
}

const sinRol = cambios.filter((cambio) => cambio.pendientes.length);
console.log(`Carriles sin rol confirmado (para ${docs('PREGUNTAS.md')}): ${sinRol.length} proceso(s).`);

function docs(nombre) {
  return `docs/fusion/${nombre}`;
}
