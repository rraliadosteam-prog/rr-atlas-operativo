#!/usr/bin/env node
// Refresca el estado real de las 16 semillas en el catálogo y en el reporte.
//
//   - src/bpmn/seeds/index.json           -> lint.errors / lint.warnings + estado
//   - src/bpmn/seeds/validacion-semillas.json -> lint_E / lint_W / lint_reglas
//
// Uso: node scripts/actualizar-estado-semillas.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateXml } from '../src/bpmn/lint/run.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = resolve(root, 'src/bpmn/seeds');
const debt = JSON.parse(await readFile(resolve(seedDir, 'deuda-modelado.json'), 'utf8'));

const archivos = (await readdir(seedDir)).filter((name) => name.endsWith('.bpmn')).sort();
const porArchivo = {};

for (const archivo of archivos) {
  const xml = await readFile(resolve(seedDir, archivo), 'utf8');
  const report = await validateXml(xml, { fileName: archivo, debt });
  const reglas = {};
  for (const issue of [...report.errors, ...report.warnings]) {
    (reglas[issue.rule] ||= []).push(issue.id);
  }
  porArchivo[archivo] = {
    errores: report.errors.length,
    avisos: report.warnings.length,
    reglas,
  };
}

// --- index.json -------------------------------------------------------------
const indexPath = resolve(seedDir, 'index.json');
const index = JSON.parse(await readFile(indexPath, 'utf8'));
for (const proceso of index.procesos || []) {
  const estado = porArchivo[proceso.archivo];
  if (!estado) continue;
  proceso.lint = { errores: estado.errores, avisos: estado.avisos };
  proceso.estado = estado.errores === 0 && estado.avisos === 0 ? 'valido' : 'con-deuda';
}
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

// --- validacion-semillas.json ----------------------------------------------
const validacionPath = resolve(seedDir, 'validacion-semillas.json');
const validacion = JSON.parse(await readFile(validacionPath, 'utf8'));
for (const item of validacion) {
  const estado = porArchivo[item.archivo];
  if (!estado) continue;
  item.lint_E = estado.errores;
  item.lint_W = estado.avisos;
  item.lint_reglas = estado.reglas;
}
await writeFile(validacionPath, `${JSON.stringify(validacion, null, 1)}\n`, 'utf8');

const totales = Object.values(porArchivo).reduce(
  (suma, item) => ({ errores: suma.errores + item.errores, avisos: suma.avisos + item.avisos }),
  { errores: 0, avisos: 0 },
);
console.log(
  `Semillas actualizadas: ${archivos.length} archivos, ${totales.errores} errores, ${totales.avisos} avisos.`,
);
