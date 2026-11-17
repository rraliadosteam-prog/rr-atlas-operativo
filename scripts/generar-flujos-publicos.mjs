// Genera `src/data/flujos-publicos.mjs` a partir de las semillas BPMN públicas
// (`src/bpmn/seeds/*.bpmn`). Las semillas ya vienen saneadas: clientes
// genéricos (CLIENTE_A), cifras como [CIFRA] y sin correos ni teléfonos.
//
// El archivo generado se versiona en el repo para que el build de producción
// sirva los flujos sin depender de ningún `*.local.*`.
//
// Uso: node scripts/generar-flujos-publicos.mjs [--check]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SEEDS_DIR = resolve(ROOT, 'src', 'bpmn', 'seeds');
export const OUTPUT = resolve(ROOT, 'src', 'data', 'flujos-publicos.mjs');

const AREAS = {
  alianzas: 'Alianzas',
  clientes: 'Clientes',
  desarrollo: 'Desarrollo',
  finanzas: 'Finanzas',
  gobierno: 'Gobierno documental',
  ia: 'IA',
  legal: 'Legal',
  produccion: 'Producción',
  soporte: 'Soporte',
  ventas: 'Ventas',
};

const TIPOS = {
  startEvent: 'evento_inicio',
  endEvent: 'evento_fin',
  exclusiveGateway: 'decision',
  parallelGateway: 'decision',
  task: 'tarea',
  userTask: 'tarea',
  serviceTask: 'tarea',
  intermediateCatchEvent: 'evento_inicio',
  intermediateThrowEvent: 'evento_fin',
  subProcess: 'tarea',
};

const attr = (fragment, name) => {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : '';
};

const decode = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const clean = (text) => decode(String(text ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function parseSeed(fileName, xml) {
  const id = fileName.replace(/\.bpmn$/, '');
  const processName = attr(xml.match(/<bpmn:process\b[^>]*>/)?.[0] ?? '', 'name');
  const titulo = processName ? clean(processName) : id.split('_').join(' ');

  // Un carril puede venir con contenido (`<bpmn:lane>...</bpmn:lane>`) o vacío
  // (`<bpmn:lane .../>`); hay que contar los dos.
  const lanes = [];
  const laneBlocks = xml.matchAll(/<bpmn:lane\b([^>]*?)(?:\/>|>([\s\S]*?)<\/bpmn:lane>)/g);
  for (const match of laneBlocks) {
    const nombre = clean(attr(match[1], 'name'));
    const refs = [...(match[2] ?? '').matchAll(/<bpmn:flowNodeRef>([^<]+)<\/bpmn:flowNodeRef>/g)].map((r) => r[1].trim());
    lanes.push({ nombre, refs });
  }

  const nodos = [];
  const nodesRegex = /<bpmn:(startEvent|endEvent|task|userTask|serviceTask|exclusiveGateway|parallelGateway|intermediateCatchEvent|intermediateThrowEvent|subProcess)\b([^>]*)>/g;
  for (const match of xml.matchAll(nodesRegex)) {
    const tipo = match[1];
    const nodeId = attr(match[2], 'id');
    if (!nodeId) continue;
    const carril = lanes.find((lane) => lane.refs.includes(nodeId))?.nombre ?? 'Sin carril';
    nodos.push({
      id: nodeId,
      nombre: clean(attr(match[2], 'name')) || nodeId,
      tipo: TIPOS[tipo] ?? 'tarea',
      carril,
    });
  }

  const conexiones = [];
  for (const match of xml.matchAll(/<bpmn:sequenceFlow\b([^>]*)>/g)) {
    const source = attr(match[1], 'sourceRef');
    const target = attr(match[1], 'targetRef');
    if (source && target) conexiones.push({ a: source, b: target });
  }

  // Las anotaciones de las semillas son notas editoriales (a veces con cifras
  // de negocio). No van en el dataset público: la estructura del flujo basta.

  const area = AREAS[id.split('_')[0]] ?? 'Procesos';
  return {
    id,
    titulo,
    area_nombre: area,
    produce: `Resultado documentado en la semilla BPMN pública de ${area}.`,
    lanes: lanes.map((lane) => lane.nombre),
    nodos,
    conexiones,
    nodos_total: nodos.length,
    fuente: `src/bpmn/seeds/${fileName}`,
  };
}

export async function buildFlujosPublicos() {
  const files = (await readdir(SEEDS_DIR)).filter((name) => name.endsWith('.bpmn')).sort();
  const flujos = [];
  for (const fileName of files) {
    flujos.push(parseSeed(fileName, await readFile(resolve(SEEDS_DIR, fileName), 'utf8')));
  }
  return flujos;
}

export function renderModule(flujos) {
  return `// Archivo GENERADO por scripts/generar-flujos-publicos.mjs desde las semillas
// BPMN públicas de src/bpmn/seeds/. No editar a mano: regenerar con
// \`node scripts/generar-flujos-publicos.mjs\`.
//
// Contiene solo información pública: roles genéricos, clientes genéricos y
// textos ya saneados (sin correos, teléfonos, nombres de terceros ni cifras).
export const VERSION_DATASET_PUBLICO = '2026-11-16';

export const flujosPublicos = ${JSON.stringify(flujos, null, 2)};

export default flujosPublicos;
`;
}

export async function writeModule() {
  const flujos = await buildFlujosPublicos();
  const content = renderModule(flujos);
  await writeFile(OUTPUT, content, 'utf8');
  return { OUTPUT, flujos };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const flujos = await buildFlujosPublicos();
  const content = renderModule(flujos);
  if (check) {
    const current = await readFile(OUTPUT, 'utf8').catch(() => '');
    if (current !== content) {
      console.error('src/data/flujos-publicos.mjs está desactualizado: corre node scripts/generar-flujos-publicos.mjs');
      process.exit(1);
    }
    console.log(`Dataset público al día: ${flujos.length} flujos.`);
  } else {
    await writeFile(OUTPUT, content, 'utf8');
    console.log(`Dataset público escrito: ${flujos.length} flujos en ${OUTPUT}`);
  }
}
