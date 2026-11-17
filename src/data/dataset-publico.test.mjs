// Pruebas del dataset público del Atlas.
// Criterio: el build de producción debe servir el mapa (nodos y procesos) y
// ningún `*.local.*` puede llegar al dist.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, assertNoLocalArtifacts, fillCounters } from '../../scripts/build.mjs';
import { buildFlujosPublicos, renderModule } from '../../scripts/generar-flujos-publicos.mjs';
import { datasetPublico, FALLBACK_STATUS } from './dataset-publico.mjs';
import { createRRGraph, processRows } from './rr-tree.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Patrones de datos que no deben aparecer en un dataset público.
const PATRONES_SENSIBLES = [
  { nombre: 'correo', regex: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/i },
  // 3-3-4 con separador o prefijo internacional; las fechas (2026-09-26) no cuentan.
  { nombre: 'teléfono', regex: /(?:\+\d[\d\s().-]{7,}\d|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b)/ },
  { nombre: 'cifra de dinero', regex: /(?:\$\s?\d|\b\d[\d.,]*\s?(?:millones|millón|pesos|cop|usd)\b)/i },
];

function textoDelDataset() {
  return JSON.stringify(datasetPublico);
}

test('el dataset público tiene el inventario completo: 7 líneas, 5 etapas, 49 procesos y 14 bots', () => {
  assert.equal(datasetPublico.lineas.length, 7);
  assert.equal(datasetPublico.etapas.length, 5);
  assert.equal(datasetPublico.procesos.length, 49);
  assert.equal(datasetPublico.bots.length, 14);
  assert.equal(datasetPublico.procesos.length, processRows.length);
  assert.equal(datasetPublico.version, '2026-11-16');
});

test('cada proceso del dataset público apunta a una línea y a una etapa que existen', () => {
  const lineas = new Set(datasetPublico.lineas.map((linea) => linea.id));
  const etapas = new Set(datasetPublico.etapas.map((etapa) => etapa[0]));
  const ids = new Set();
  for (const [id, , linea, etapa] of datasetPublico.procesos) {
    assert.ok(lineas.has(linea), `Proceso ${id} con línea desconocida: ${linea}`);
    assert.ok(etapas.has(etapa), `Proceso ${id} con etapa desconocida: ${etapa}`);
    assert.ok(!ids.has(id), `Proceso repetido: ${id}`);
    ids.add(id);
  }
});

test('el dataset público no trae correos, teléfonos ni cifras de dinero', () => {
  const texto = textoDelDataset();
  for (const { nombre, regex } of PATRONES_SENSIBLES) {
    const encontrado = texto.match(regex);
    assert.equal(encontrado, null, `El dataset público tiene un patrón de ${nombre}: ${encontrado?.[0]}`);
  }
});

test('el dataset público no usa nombres propios: los clientes son siempre el marcador CLIENTE_X', () => {
  const texto = textoDelDataset();
  // Cualquier mención a un cliente tiene que ser el marcador genérico, no un nombre.
  for (const match of texto.matchAll(/\bcliente\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]*)/g)) {
    assert.match(match[1], /^CLIENTE_[A-Z]$/, `Mención a cliente que no es marcador genérico: ${match[1]}`);
  }
  // Los dueños son roles o el estado por confirmar; nunca una persona.
  for (const [, , , , , , dueno] of datasetPublico.procesos) {
    assert.ok(
      dueno === FALLBACK_STATUS || /^[A-ZÁÉÍÓÚÑ][\p{L}\p{N}/ ·-]*$/u.test(dueno),
      `Dueño con forma de nombre propio: ${dueno}`,
    );
  }
});

test('los flujos públicos se derivan de las semillas BPMN públicas y son consistentes', async () => {
  const flujos = await buildFlujosPublicos();
  assert.equal(flujos.length, datasetPublico.flujos.length);
  assert.ok(flujos.length >= 15, 'Deben existir los flujos que el mapa enlaza');
  for (const flujo of flujos) {
    assert.ok(flujo.id && flujo.titulo, `Flujo sin id o título: ${flujo.id}`);
    const ids = new Set(flujo.nodos.map((nodo) => nodo.id));
    for (const conexion of flujo.conexiones) {
      assert.ok(ids.has(conexion.a), `Conexión desde un nodo inexistente: ${conexion.a}`);
      assert.ok(ids.has(conexion.b), `Conexión hacia un nodo inexistente: ${conexion.b}`);
    }
    assert.equal(flujo.nodos_total, flujo.nodos.length);
    for (const nodo of flujo.nodos) {
      assert.ok(['tarea', 'evento_inicio', 'evento_fin', 'decision'].includes(nodo.tipo), `Tipo desconocido: ${nodo.tipo}`);
    }
  }
});

test('los flujos públicos no contienen datos sensibles', async () => {
  const flujos = await buildFlujosPublicos();
  const texto = JSON.stringify(flujos);
  for (const { nombre, regex } of PATRONES_SENSIBLES) {
    const encontrado = texto.match(regex);
    assert.equal(encontrado, null, `Los flujos públicos tienen un patrón de ${nombre}: ${encontrado?.[0]}`);
  }
});

test('el archivo generado de flujos está al día con las semillas', async () => {
  const actual = await readFile(resolve(root, 'src/data/flujos-publicos.mjs'), 'utf8');
  assert.equal(actual, renderModule(await buildFlujosPublicos()), 'Regenera con node scripts/generar-flujos-publicos.mjs');
});

test('el build de producción incluye el dataset público y sus contadores reales', async () => {
  const dist = resolve(root, 'dist-test-b6a');
  try {
    const { dist: salida } = await build({ root, dist });
    const html = await readFile(resolve(salida, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /\{\{/, 'No pueden quedar placeholders sin reemplazar');
    assert.match(html, /<strong data-node-count>120<\/strong>/);
    assert.match(html, /<strong data-process-count>49<\/strong>/);
    assert.doesNotMatch(html, /data-node-count>0</);
    await readFile(resolve(salida, 'src/data/dataset-publico.mjs'), 'utf8');
    await readFile(resolve(salida, 'src/data/flujos-publicos.mjs'), 'utf8');
  } finally {
    await rm(resolve(root, 'dist-test-b6a'), { recursive: true, force: true });
  }
});

test('el build de producción no deja ningún artefacto *.local.* en el dist', async () => {
  const dist = resolve(root, 'dist-test-b6a-local');
  try {
    const { dist: salida } = await build({ root, dist });
    assert.equal(await assertNoLocalArtifacts(salida), true);
    const overrides = await readFile(resolve(salida, 'src/data/local-overrides.mjs'), 'utf8');
    assert.equal(overrides.trim(), 'export default {};');
  } finally {
    await rm(resolve(root, 'dist-test-b6a-local'), { recursive: true, force: true });
  }
});

test('el visor de flujos cae al dataset público cuando no hay archivo local', async () => {
  const { loadFlujos, clearFlujoCache } = await import('../app/flujo-viewer.mjs');
  clearFlujoCache();
  const flujos = await loadFlujos();
  assert.ok(Array.isArray(flujos));
  assert.ok(flujos.length >= 15, `Sin flujos públicos: ${flujos.length}`);
  const ids = new Set(flujos.map((flujo) => flujo.id));
  for (const id of ['ventas_como_una_oportunidad_se_convierte_en_cliente', 'finanzas_la_quincena', 'soporte_como_se_resuelve_un_problema_de_un_cliente']) {
    assert.ok(ids.has(id), `El flujo enlazado ${id} no está en el dataset público`);
  }
});

test('el grafo público se construye con los 49 procesos y sin parches locales', () => {
  const graph = createRRGraph();
  const procesos = graph.nodes.filter((node) => node.type === 'process');
  assert.equal(procesos.length, 49);
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.edges.length > 0);
});

test('los contadores del shell se rellenan y fallan si falta un placeholder', () => {
  const html = '<strong data-node-count>{{NODOS_MAPA}}</strong><strong data-process-count>{{PROCESOS_INVENTARIADOS}}</strong>';
  assert.equal(
    fillCounters(html, { nodos: 120, procesos: 49 }),
    '<strong data-node-count>120</strong><strong data-process-count>49</strong>',
  );
  // Un shell con contador y sin placeholder es un error: volvería el "0" fijo.
  assert.throws(() => fillCounters('<strong data-node-count>0</strong>', { nodos: 1, procesos: 1 }), /NODOS_MAPA/);
  // Un shell sin contadores (fixture mínimo) sí es válido.
  assert.equal(fillCounters('<p>sin contadores</p>', { nodos: 1, procesos: 1 }), '<p>sin contadores</p>');
});
