// Genera el fixture de flujos del repo (fixtures/flujo-demo.json) a partir de las
// semillas BPMN que ya viven en src/bpmn/seeds. Solo se toma estructura
// (carriles, nodos, conexiones y anotaciones); no hay datos personales,
// cifras ni rutas privadas: los nombres de tarea son los del propio diagrama.
//
// Uso: node scripts/generar-fixture-flujos.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BpmnModdle } from 'bpmn-moddle';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedsDir = resolve(root, 'src', 'bpmn', 'seeds');
const moddle = new BpmnModdle();

const TIPOS = {
  'bpmn:StartEvent': 'evento_inicio',
  'bpmn:EndEvent': 'evento_fin',
  'bpmn:IntermediateCatchEvent': 'evento_intermedio',
  'bpmn:IntermediateThrowEvent': 'evento_intermedio',
  'bpmn:BoundaryEvent': 'evento_intermedio',
  'bpmn:ExclusiveGateway': 'decision',
  'bpmn:ParallelGateway': 'decision',
  'bpmn:InclusiveGateway': 'decision',
  'bpmn:Task': 'tarea',
  'bpmn:UserTask': 'tarea',
  'bpmn:ServiceTask': 'tarea',
  'bpmn:SendTask': 'tarea',
  'bpmn:SubProcess': 'tarea',
};

function documentation(element) {
  const raw = element?.documentation;
  if (!raw) return [];
  const text = typeof raw === 'string' ? raw : (raw.$body ?? '');
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

async function flujoDesdeSemilla(id, archivo, area, titulo) {
  const xml = await readFile(resolve(seedsDir, archivo), 'utf8');
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const process = definitions.rootElements.find((el) => el.$type === 'bpmn:Process');
  if (!process) throw new Error(`La semilla ${archivo} no tiene proceso`);

  const lanes = process.laneSets?.[0]?.lanes ?? [];
  const carrilDe = new Map();
  for (const lane of lanes) {
    for (const ref of lane.flowNodeRef ?? []) {
      const refId = typeof ref === 'string' ? ref : ref.id;
      carrilDe.set(refId, lane.name || 'Sin carril');
    }
  }

  const flows = process.flowElements ?? [];
  const nodos = flows
    .filter((el) => el.$type !== 'bpmn:SequenceFlow')
    .map((el) => ({
      id: el.id,
      nombre: el.name || el.id,
      tipo: TIPOS[el.$type] ?? 'tarea',
      carril: carrilDe.get(el.id) ?? 'Sin carril',
    }));

  const conexiones = flows
    .filter((el) => el.$type === 'bpmn:SequenceFlow')
    .map((el) => ({ a: el.sourceRef?.id, b: el.targetRef?.id }))
    .filter((c) => c.a && c.b);

  const anotaciones = documentation(process).map((texto) => ({ texto }));

  return {
    id,
    titulo: titulo || process.name || id,
    produce: anotaciones[0]?.texto ?? '',
    area_nombre: area ?? 'Sin área',
    lanes: lanes.map((lane) => lane.name || 'Sin carril'),
    nodos,
    conexiones,
    anotaciones: anotaciones.slice(1),
    nodos_total: nodos.length,
  };
}

export async function generarFixture({ destino } = {}) {
  const indice = JSON.parse(await readFile(resolve(seedsDir, 'index.json'), 'utf8'));
  const procesos = indice.procesos ?? [];
  const flujos = [];
  for (const proceso of procesos) {
    flujos.push(await flujoDesdeSemilla(proceso.id, proceso.archivo, proceso.area, proceso.titulo));
  }
  const fixture = {
    fuente: 'Semillas BPMN del repo · src/bpmn/seeds',
    corte: indice.corte ?? '2026-11-02',
    nota: 'Fixture generado por scripts/generar-fixture-flujos.mjs. Sin datos personales ni cifras.',
    flujos,
  };
  const path = destino ?? resolve(root, 'fixtures', 'flujo-demo.json');
  await writeFile(path, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  return { path, total: flujos.length };
}

if (process.argv[1] && process.argv[1].endsWith('generar-fixture-flujos.mjs')) {
  const { path, total } = await generarFixture();
  console.log(`Fixture de flujos escrito en ${path} (${total} flujos)`);
}
