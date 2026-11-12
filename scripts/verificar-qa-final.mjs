// QA final del Atlas RR (cadena de pulido · bloque 3).
//
//   node scripts/verificar-qa-final.mjs            → agrega la evidencia existente
//   node scripts/verificar-qa-final.mjs --ejecutar  → corre antes las pruebas de navegador
//
// Reúne en un solo archivo (docs/fusion/QA-FINAL.json) el resultado de toda
// la cadena de pulido para que el PR se pueda revisar sin correr nada:
//
//   · lint de las 16 semillas BPMN (se corre de verdad: 0 errores y 0 avisos)
//   · npm run verificar:cierre   → 10 flujos × 3 anchos, con clics reales
//   · npm run verificar:tactil   → objetivos de 44 px y gestos con el dedo
//   · npm run verificar:pulido   → los tres arreglos del visor BPMN a 390 px
//   · npm run verificar:movil    → pulido de celular a 390 y 360 px
//   · capturas pulido-<flujo>-390.png de al menos 3 flujos (uno de ellos el
//     de «Gobierno documental»)
//   · la puerta de cierre del PR (docs/fusion/CIERRE.json)
//
// No inventa nada: solo lee la evidencia que dejaron las pruebas del repo.
// Si algo falta o no está en verde, el proceso sale con 1.

import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { validateXml } from '../src/bpmn/lint/run.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FUSION = resolve(RAIZ, 'docs/fusion');
const CAPTURAS = resolve(FUSION, 'capturas');
const EJECUTAR = process.argv.includes('--ejecutar');

const FLUJOS_PULIDO_REQUERIDOS = [
  'gobierno_como_se_gobierna_la_documentacion',
  'ventas_como_una_oportunidad_se_convierte_en_cliente',
  'finanzas_como_entra_y_se_sale_la_plata',
];

const fallos = [];
const checks = [];

function anotar(nombre, ok, detalle) {
  checks.push({ nombre, ok, detalle });
  if (!ok) fallos.push(`${nombre}: ${detalle}`);
  console.log(`${ok ? '✔' : '✘'} ${nombre} — ${detalle}`);
}

async function correr(comando, argumentos) {
  return new Promise((r) => {
    const hijo = spawn(comando, argumentos, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    hijo.on('close', (codigo) => r({ codigo, salida }));
  });
}

async function leerJson(nombre) {
  try {
    return JSON.parse(await readFile(resolve(FUSION, nombre), 'utf8'));
  } catch {
    return null;
  }
}

async function existe(ruta) {
  try {
    await stat(ruta);
    return true;
  } catch {
    return false;
  }
}

// ── 0. Si piden ejecución, primero corren las pruebas de navegador ────────
if (EJECUTAR) {
  const guiones = [
    ['npm', ['run', 'verificar:cierre']],
    ['npm', ['run', 'verificar:tactil']],
    ['npm', ['run', 'verificar:pulido']],
    ['npm', ['run', 'verificar:movil']],
  ];
  for (const [comando, argumentos] of guiones) {
    console.log(`\n· ${comando} ${argumentos.join(' ')}`);
    const { codigo } = await correr(comando, argumentos);
    if (codigo !== 0) {
      console.error(`FALLÓ: ${comando} ${argumentos.join(' ')} (código ${codigo})`);
      process.exit(1);
    }
  }
}

// ── 1. Lint de las 16 semillas: 0 errores y 0 avisos ──────────────────────
{
  const archivos = (await readdir(resolve(RAIZ, 'src/bpmn/seeds'))).filter((n) => n.endsWith('.bpmn')).sort();
  const deuda = JSON.parse(await readFile(resolve(RAIZ, 'src/bpmn/seeds/deuda-modelado.json'), 'utf8'));
  let errores = 0;
  let avisos = 0;
  let moddle = 0;
  for (const archivo of archivos) {
    const xml = await readFile(resolve(RAIZ, 'src/bpmn/seeds', archivo), 'utf8');
    const informe = await validateXml(xml, { fileName: archivo, debt: deuda });
    errores += informe.errors.length;
    avisos += informe.warnings.length;
    moddle += informe.moddleWarnings.length + (informe.importError ? 1 : 0);
  }
  anotar(
    'lint-semillas',
    archivos.length === 16 && errores === 0 && avisos === 0 && moddle === 0,
    `${archivos.length} semillas · ${errores} errores · ${avisos} avisos · ${moddle} avisos de moddle`,
  );
}

// ── 2. Evidencia de las pruebas de navegador ───────────────────────────────
{
  const cierre = await leerJson('PRUEBAS.json');
  anotar(
    'verificar-cierre',
    Boolean(cierre) && cierre.pasar === cierre.pruebas && cierre.fallar === 0 && cierre.erroresDeConsola === 0,
    cierre
      ? `${cierre.pasar}/${cierre.pruebas} en verde (${cierre.flujos.length} flujos × ${cierre.anchos.join(', ')} px) · ${cierre.erroresDeConsola} errores de consola`
      : 'falta docs/fusion/PRUEBAS.json (corre npm run verificar:cierre)',
  );
}
{
  const tactil = await leerJson('TACTIL.json');
  anotar(
    'verificar-tactil',
    Boolean(tactil) && tactil.pasar === tactil.pruebas && tactil.fallar === 0 && tactil.erroresDeConsola === 0,
    tactil
      ? `${tactil.pasar}/${tactil.pruebas} en verde (${tactil.anchos.join(', ')} px) · ${tactil.erroresDeConsola} errores de consola`
      : 'falta docs/fusion/TACTIL.json (corre npm run verificar:tactil)',
  );
}
{
  const pulido = await leerJson('PULIDO.json');
  anotar(
    'verificar-pulido',
    Boolean(pulido) && pulido.diagramas === pulido.conOk && (pulido.fallos?.length ?? 0) === 0,
    pulido
      ? `${pulido.conOk}/${pulido.diagramas} diagramas con los tres arreglos a ${pulido.ancho} px`
      : 'falta docs/fusion/PULIDO.json (corre npm run verificar:pulido)',
  );
}
{
  const movil = await leerJson('MOVIL.json');
  anotar(
    'verificar-movil',
    Boolean(movil) && movil.pasar === movil.pruebas && movil.fallar === 0,
    movil
      ? `${movil.pasar}/${movil.pruebas} en verde (${movil.anchos.join(', ')} px)`
      : 'falta docs/fusion/MOVIL.json (corre npm run verificar:movil)',
  );
}

// ── 3. Capturas a 390 px de al menos 3 flujos, uno «Gobierno documental» ───
{
  const faltantes = [];
  for (const flujo of FLUJOS_PULIDO_REQUERIDOS) {
    const archivo = resolve(CAPTURAS, `pulido-${flujo}-390.png`);
    if (!(await existe(archivo))) faltantes.push(`pulido-${flujo}-390.png`);
  }
  anotar(
    'capturas-390',
    faltantes.length === 0,
    faltantes.length === 0
      ? `${FLUJOS_PULIDO_REQUERIDOS.length} capturas pulido-<flujo>-390.png (incluida «Gobierno documental»)`
      : `faltan: ${faltantes.join(', ')}`,
  );
}

// ── 4. Puerta de cierre del PR ─────────────────────────────────────────────
{
  const cierreFinal = await leerJson('CIERRE.json');
  anotar(
    'puerta-cierre',
    Boolean(cierreFinal) && cierreFinal.ok === cierreFinal.total && cierreFinal.fallos === 0,
    cierreFinal ? `${cierreFinal.ok}/${cierreFinal.total} comprobaciones en verde` : 'falta docs/fusion/CIERRE.json',
  );
}

// ── 5. Salida ───────────────────────────────────────────────────────────────
const resumen = {
  generadoEn: new Date().toISOString(),
  modo: EJECUTAR ? 'ejecutar' : 'agregar',
  checks,
  totales: { checks: checks.length, enVerde: checks.filter((c) => c.ok).length, fallos: fallos.length },
  fallos,
};
await writeFile(resolve(FUSION, 'QA-FINAL.json'), `${JSON.stringify(resumen, null, 2)}\n`);

console.log(`\nQA final: ${resumen.totales.enVerde}/${resumen.totales.checks} comprobaciones en verde.`);
if (fallos.length > 0) {
  console.error(`Fallas: ${fallos.join(' · ')}`);
  process.exit(1);
}
console.log('Evidencia: docs/fusion/QA-FINAL.json');
