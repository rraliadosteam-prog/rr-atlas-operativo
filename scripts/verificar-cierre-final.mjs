// Verificación final de cierre del Atlas RR (cadena de cierre · bloque 5).
//
//   node scripts/verificar-cierre-final.mjs
//
// Esta es la puerta de salida del PR #7: comprueba, sin inventar nada, que
// todo lo que pidieron los ítems A, B, C y D está de verdad en el código y en
// los datos del repo. Es una comprobación estática (Node, sin navegador), para
// que cualquiera pueda correrla antes de aprobar el PR.
//
// Qué comprueba:
//
//   Item B · DECISIONES DE ROSAS (2-nov 19:22)
//     · título y subtítulo «RR Aliados · Atlas operativo» (sin «RR Labs»)
//     · fuentes Inter Tight (títulos) + Lexend (cuerpo)
//     · la entrada es el Mapa vivo
//     · «Volver al hub» oculto
//     · clientes: BOGA, Candilejas e IMF Weddings activos; los demás en pausa
//     · aviso visible «Guía provisional» en la guía de cada diagrama
//     · leyenda con íconos distintos para tarea de bot y tarea de persona
//     · las 16 semillas BPMN con 0 errores y 0 avisos de lint
//     · abrir un diagrama es siempre pantalla completa
//     · bots vigentes: Buen Puente y Becas de Exposición; Media Manager y
//       Gains «sin confirmar»
//
//   Item C · MODELO DE DATOS v5
//     · esquema 5, migración desde v4 y desde el estado de A
//     · export/import idempotente
//     · el validador rechaza los campos prohibidos (salario, cédula, cuenta,
//       token, password)
//     · cada registro de la base trae fuente y corte
//     · ninguna cifra financiera en los datos ni en el bundle
//
//   Items A y D · ENTREGABLES
//     · capturas por ancho (cierre-<flujo>-<ancho>.png) de los 9 flujos
//     · PRUEBAS.md, PREGUNTAS.md (con las decisiones resueltas) y BITACORA.md
//
// Salida: docs/fusion/CIERRE.json. Si algo falla, el proceso sale con 1.

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateXml } from '../src/bpmn/lint/run.mjs';
import { BASE } from '../src/data/base/index.mjs';
import { PENDIENTES } from '../src/data/pendientes.mjs';
import { botDefinitions, VIGENTE, SIN_CONFIRMAR } from '../src/data/rr-tree.mjs';
import { CLIENTES as CLIENTES_UI } from '../src/data/inicio-tarjetas.mjs';
import { AVISO_GUIA, SIMBOLOS } from '../src/bpmn/leyenda.mjs';
import {
  CAMPOS_PROHIBIDOS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  crearModelo,
  exportar,
  importar,
  migrarDesdeEstadoA,
  migrarDesdeV4,
  validar,
} from '../src/core/model.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resultados = [];
const fallos = [];

function check(id, nombre, ok, detalle) {
  resultados.push({ id, nombre, ok: Boolean(ok), detalle: String(detalle ?? '') });
  if (!ok) fallos.push(`${id}: ${nombre} — ${detalle}`);
}

async function leer(ruta) {
  return readFile(resolve(RAIZ, ruta), 'utf8');
}

async function existe(ruta) {
  try {
    await stat(resolve(RAIZ, ruta));
    return true;
  } catch {
    return false;
  }
}

async function archivosConExtension(dir, extensiones) {
  const encontrados = [];
  const pendientes = [resolve(RAIZ, dir)];
  while (pendientes.length) {
    const actual = pendientes.pop();
    let entradas;
    try {
      entradas = await readdir(actual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      const completo = join(actual, entrada.name);
      if (entrada.isDirectory()) {
        pendientes.push(completo);
      } else if (extensiones.some((ext) => entrada.name.endsWith(ext))) {
        encontrados.push(completo);
      }
    }
  }
  return encontrados.sort();
}

// ─────────────────────────────────────────────────────────────
// Item B · decisiones de Rosas
// ─────────────────────────────────────────────────────────────

const indexHtml = await leer('index.html');
const rrTree = await leer('src/data/rr-tree.mjs');
const bpmnView = await leer('src/app/bpmn-view.mjs');
const tokensCss = await leer('src/rr-estilo/tokens.css');

const tituloPagina = indexHtml.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '';
check(
  'titulo-pagina',
  'El título de la página es «RR Aliados · Atlas operativo»',
  tituloPagina === 'RR Aliados · Atlas operativo',
  `title = «${tituloPagina}»`,
);

// «RR Labs» no puede quedar en ninguna parte visible de la app.
const fuentes = [
  ['index.html', indexHtml],
  ['src/data/rr-tree.mjs', rrTree],
  ['src/app/bpmn-view.mjs', bpmnView],
];
for (const archivo of await archivosConExtension('src', ['.mjs', '.css', '.html'])) {
  fuentes.push([relative(RAIZ, archivo), await readFile(archivo, 'utf8')]);
}
if (await existe('dist/index.html')) {
  fuentes.push(['dist/index.html', await leer('dist/index.html')]);
}
const conRrLabs = fuentes.filter(([, texto]) => /RR Labs/i.test(texto)).map(([ruta]) => ruta);
check(
  'sin-rr-labs',
  'No queda «RR Labs» en la app (título, mapa vivo ni bundle)',
  conRrLabs.length === 0,
  conRrLabs.length ? `aparece en: ${conRrLabs.join(', ')}` : 'no aparece en src/, index.html ni dist/',
);

const raizArbol = rrTree.match(/title:\s*'RR Aliados'/)?.[0] ?? '';
const subtituloMapa = indexHtml.includes('RR Aliados <span>→</span> Atlas operativo');
check(
  'subtitulo-mapa',
  'El Mapa vivo se titula «RR Aliados» y la barra dice «RR Aliados → Atlas operativo»',
  Boolean(raizArbol) && subtituloMapa,
  `raíz del árbol: ${raizArbol || 'no encontrada'}; barra: ${subtituloMapa ? 'sí' : 'no'}`,
);

const fuenteTitulo = /--font-titulo:\s*'Inter Tight'/.test(tokensCss);
const fuenteTexto = /--font-texto:\s*'Lexend'/.test(tokensCss);
check(
  'fuentes',
  'Las fuentes son Inter Tight (títulos) y Lexend (cuerpo)',
  fuenteTitulo && fuenteTexto,
  `--font-titulo Inter Tight: ${fuenteTitulo ? 'sí' : 'no'}; --font-texto Lexend: ${fuenteTexto ? 'sí' : 'no'}`,
);

const entradaMapa = !/#\/inicio/.test(await leer('src/app/rr-tree.mjs'))
  && /data-canvas/.test(indexHtml)
  && /data-nodes/.test(indexHtml);
check(
  'entrada-mapa',
  'La entrada de la app es el Mapa vivo (no la vista Inicio)',
  entradaMapa,
  entradaMapa ? 'el shell abre con el mapa y no hay ruta #/inicio' : 'hay una ruta #/inicio o falta el lienzo del mapa',
);

const enlaceHub = indexHtml.match(/<a[^>]*data-hub-link[^>]*>/)?.[0] ?? '';
check(
  'hub-oculto',
  '«Volver al hub» está oculto (falta la URL real del hub)',
  Boolean(enlaceHub) && /\shidden(\s|>|=)/.test(enlaceHub),
  enlaceHub ? `enlace: ${enlaceHub.replace(/\s+/g, ' ').slice(0, 90)}…` : 'no se encontró el enlace del hub',
);

const clientesBase = BASE.cliente ?? [];
const porNombre = new Map(clientesBase.map((cliente) => [cliente.nombreCanonico ?? cliente.nombre, cliente]));
const activosEsperados = ['BOGA', 'Candilejas + 553', 'IMF Weddings'];
const activosOk = activosEsperados.every((nombre) => porNombre.get(nombre)?.estado === 'activo');
const otrosPausados = clientesBase
  .filter((cliente) => !activosEsperados.includes(cliente.nombreCanonico ?? cliente.nombre))
  .every((cliente) => cliente.estado === 'pausado');
check(
  'clientes-activos',
  'BOGA, Candilejas e IMF Weddings están activos',
  activosOk,
  activosEsperados.map((nombre) => `${nombre}: ${porNombre.get(nombre)?.estado ?? 'no está'}`).join(' · '),
);
check(
  'clientes-pausa',
  'Los demás clientes están en pausa y ninguno quedó «sin confirmar»',
  otrosPausados && !clientesBase.some((cliente) => cliente.estado === 'sin confirmar'),
  `${clientesBase.filter((cliente) => cliente.estado === 'pausado').length} en pausa, ${clientesBase.filter((cliente) => cliente.estado === 'sin confirmar').length} sin confirmar`,
);
const estadosUi = [...new Set(CLIENTES_UI.map((cliente) => cliente.estado))];
check(
  'clientes-en-la-app',
  'El panel de Inicio no muestra «Sin confirmar» en los clientes',
  !estadosUi.includes('sin confirmar'),
  `estados en la interfaz: ${estadosUi.join(', ')}`,
);

// Decisión de Rosas (2026-11-02 21:33): «IMF Weddings» e «IMF Visions» son el
// mismo cliente. En los datos y en la interfaz hay un solo nombre y sin
// duplicados.
const nombresClientes = clientesBase.map((cliente) => cliente.nombreCanonico ?? cliente.nombre);
const nombresUi = CLIENTES_UI.map((cliente) => cliente.nombre);
const repetidos = (lista) => lista.filter((nombre, indice) => lista.indexOf(nombre) !== indice);
const duplicados = [...repetidos(nombresClientes), ...repetidos(nombresUi)];
const sinIduplicado = !duplicados.length
  && !nombresClientes.some((nombre) => /imf visions/i.test(nombre))
  && !nombresUi.some((nombre) => /imf visions/i.test(nombre));
check(
  'imf-unificado',
  '«IMF Weddings» es el único nombre del cliente IMF (sin duplicados)',
  sinIduplicado,
  `datos: ${nombresClientes.filter((n) => /imf/i.test(n)).join(', ') || '—'} · interfaz: ${nombresUi.filter((n) => /imf/i.test(n)).join(', ') || '—'}${duplicados.length ? ` · duplicados: ${duplicados.join(', ')}` : ''}`,
);

const guiaUsaAviso = bpmnView.includes('AVISO_GUIA');
check(
  'guia-provisional',
  'La guía de cada diagrama muestra el aviso «Guía provisional»',
  AVISO_GUIA === 'Guía provisional' && guiaUsaAviso,
  `constante: «${AVISO_GUIA}»; la vista la usa: ${guiaUsaAviso ? 'sí' : 'no'}`,
);

const glifoPersona = SIMBOLOS.find((simbolo) => simbolo.id === 'tarea-persona')?.glifo ?? '';
const glifoBot = SIMBOLOS.find((simbolo) => simbolo.id === 'tarea-bot')?.glifo ?? '';
check(
  'leyenda-bot-persona',
  'La leyenda separa «Tarea de persona» y «Tarea de bot» con íconos distintos',
  Boolean(glifoPersona) && Boolean(glifoBot) && glifoPersona !== glifoBot,
  `ícono de persona: ${glifoPersona ? 'sí' : 'no'}; ícono de bot: ${glifoBot ? 'sí' : 'no'}`,
);

// Las 16 semillas, una por una, con el mismo validador que usa `npm run lint:bpmn`.
const semillaDir = resolve(RAIZ, 'src/bpmn/seeds');
const archivosSemilla = (await readdir(semillaDir)).filter((archivo) => archivo.endsWith('.bpmn')).sort();
const deuda = JSON.parse(await readFile(resolve(semillaDir, 'deuda-modelado.json'), 'utf8'));
let erroresLint = 0;
let avisosLint = 0;
let moddle = 0;
for (const archivo of archivosSemilla) {
  const xml = await readFile(resolve(semillaDir, archivo), 'utf8');
  const reporte = await validateXml(xml, { fileName: archivo, debt: deuda });
  erroresLint += reporte.errors.length;
  avisosLint += reporte.warnings.length;
  moddle += reporte.moddleWarnings.length + (reporte.importError ? 1 : 0);
}
check(
  'semillas-lint',
  'Las 16 semillas BPMN pasan el lint con 0 errores y 0 avisos',
  archivosSemilla.length === 16 && erroresLint === 0 && avisosLint === 0 && moddle === 0,
  `${archivosSemilla.length} semillas · ${erroresLint} errores · ${avisosLint} avisos · ${moddle} avisos de moddle`,
);

const pantallaCompleta = bpmnView.includes('aplicarCompleto(Boolean(procesoId))');
check(
  'pantalla-completa',
  'Abrir un diagrama siempre lo deja a pantalla completa',
  pantallaCompleta,
  pantallaCompleta
    ? 'al abrir un proceso se aplica el modo completo'
    : 'no se encontró la llamada que aplica el modo completo al abrir',
);

const bots = new Map(botDefinitions.map((bot) => [bot.id, bot.estado]));
const botsOk = bots.get('bot-bot-buen-puente') === VIGENTE
  && bots.get('bot-becas-y-exposicion') === VIGENTE
  && bots.get('bot-media-manager') === SIN_CONFIRMAR
  && bots.get('bot-gains') === SIN_CONFIRMAR;
check(
  'bots-vigentes',
  'Buen Puente y Becas de Exposición vigentes; Media Manager y Gains «sin confirmar»',
  botsOk,
  `Buen Puente: ${bots.get('bot-bot-buen-puente')} · Becas: ${bots.get('bot-becas-y-exposicion')} · Media Manager: ${bots.get('bot-media-manager')} · Gains: ${bots.get('bot-gains')}`,
);

// ─────────────────────────────────────────────────────────────
// Item C · modelo de datos v5
// ─────────────────────────────────────────────────────────────

check(
  'esquema-v5',
  'El modelo es el esquema 5 y se guarda en localStorage con su clave',
  SCHEMA_VERSION === 5 && STORAGE_KEY === 'rr-atlas:v5',
  `schemaVersion ${SCHEMA_VERSION} · ${STORAGE_KEY}`,
);

const migracionV4 = migrarDesdeV4({
  schemaVersion: 4,
  nodes: [{ id: 'nodo-1', title: 'Nodo de prueba', type: 'Proceso', desc: 'Prueba de migración' }],
});
const migracionA = migrarDesdeEstadoA({
  nodes: [{ id: 'proceso-1', label: 'Proceso de prueba' }],
});
check(
  'migraciones',
  'Hay migración desde el JSON v4 de B y desde el estado de la rama A',
  migracionV4?.schemaVersion === 5 && migracionA?.schemaVersion === 5,
  `v4 → esquema ${migracionV4?.schemaVersion}; estado de A → esquema ${migracionA?.schemaVersion}`,
);

const modelo = crearModelo(BASE);
const paquete = exportar(modelo, { exportadoEn: '2026-11-02T00:00:00.000Z' });
const reexportado = exportar(importar(paquete), { exportadoEn: paquete.exportadoEn });
check(
  'export-import-idempotente',
  'Exportar e importar es idempotente (exportar(importar(paquete)) === paquete)',
  JSON.stringify(reexportado) === JSON.stringify(paquete),
  `paquete con ${Object.keys(paquete.base).length} colecciones · ${paquete.base.cliente.length} clientes`,
);

const modeloConProhibido = crearModelo(BASE);
modeloConProhibido.base.persona[0] = {
  ...modeloConProhibido.base.persona[0],
  salario: '3.000.000',
};
const reporteProhibido = validar(modeloConProhibido);
const tieneProhibido = reporteProhibido.errores.some((error) => error.codigo === 'CAMPO_PROHIBIDO');
const prohibidosCubiertos = ['salario', 'cedula', 'cuenta', 'token', 'password'].every((campo) => CAMPOS_PROHIBIDOS.includes(campo));
check(
  'validador-rechaza-prohibidos',
  'El validador rechaza los campos prohibidos (salario, cédula, cuenta, token, password)',
  tieneProhibido && prohibidosCubiertos,
  tieneProhibido
    ? `rechazado: ${reporteProhibido.errores.filter((error) => error.codigo === 'CAMPO_PROHIBIDO').map((error) => error.ruta).join(', ')}`
    : 'el validador NO rechazó el campo prohibido',
);

let registros = 0;
const sinFuente = [];
const corteInvalido = [];
for (const [coleccion, items] of Object.entries(BASE)) {
  for (const item of items) {
    registros += 1;
    if (!String(item.fuente ?? '').trim()) sinFuente.push(`${coleccion}:${item.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.corte ?? '').trim())) corteInvalido.push(`${coleccion}:${item.id}`);
  }
}
check(
  'base-fuentes',
  'Cada registro de la base trae su fuente y su corte',
  sinFuente.length === 0 && corteInvalido.length === 0,
  `${registros} registros · ${sinFuente.length} sin fuente · ${corteInvalido.length} con corte mal escrito`,
);

// Ninguna cifra financiera en los datos ni en el bundle.
const patronesDinero = [
  /\$\s?\d/,
  /\bCOP\s?\d/i,
  /\d[\d.,]*\s*millones?\b/i,
  /\b(runway|presupuesto|saldo|factura vencida|cartera vencida)\b[^.\n]{0,20}\d/i,
];
const dondeBuscar = [
  ...(await archivosConExtension('src/data/base', ['.json'])),
  ...(await existe('dist/index.html') ? [resolve(RAIZ, 'dist/index.html')] : []),
];
const conDinero = [];
for (const archivo of dondeBuscar) {
  const texto = await readFile(archivo, 'utf8');
  for (const patron of patronesDinero) {
    const coincidencia = texto.match(patron);
    if (coincidencia) conDinero.push(`${relative(RAIZ, archivo)}: «${coincidencia[0].trim()}»`);
  }
}
check(
  'sin-cifras-financieras',
  'No hay ninguna cifra financiera en los datos ni en el bundle',
  conDinero.length === 0,
  conDinero.length ? conDinero.join(' · ') : 'los datos solo hablan de flujos, sin montos',
);

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Item C · huecos «sin confirmar» visibles en la app (mega prompt §10)
// ─────────────────────────────────────────────────────────────

const pendientesView = await leer('src/app/datos-view.mjs');
const huecosSinFuente = PENDIENTES.filter((hueco) => !String(hueco.fuente ?? '').trim() || !String(hueco.corte ?? '').trim());
const huecosEnApp = pendientesView.includes('data-datos-pendientes')
  && bpmnView.includes('PENDIENTES')
  && indexHtml.includes('data-datos-pendientes');
check(
  'pendientes-visibles',
  'Los huecos «sin confirmar» se ven en la app (vista Datos e Inicio), con fuente y corte',
  PENDIENTES.length >= 15 && huecosSinFuente.length === 0 && huecosEnApp,
  `${PENDIENTES.length} huecos · ${huecosSinFuente.length} sin fuente o corte · la app los muestra: ${huecosEnApp ? 'sí' : 'no'}`,
);

const huecosMinimos = [
  'project manager',
  'camarógrafo',
  'sla de soporte',
  'kpi de producción',
  'sesión de grabación',
  'quién cubre soporte',
  'cuenta de cobro',
  'precios y planes',
  'buen puente',
  'flota hermes',
  'media manager',
  'martín',
  'isabela',
  'tipografía oficial',
  'zapatos',
  'turismo anheyca',
  'satiro_sushi',
  'imf visions',
  'amsterdam',
  'billares charly brown',
];
const textoHuecos = PENDIENTES.map((hueco) => `${hueco.titulo} ${hueco.detalle}`).join(' ').toLowerCase();
const huecosFaltantes = huecosMinimos.filter((frase) => !textoHuecos.includes(frase));
check(
  'pendientes-minimos',
  'La lista de huecos cubre la lista mínima del mega prompt §10',
  huecosFaltantes.length === 0,
  huecosFaltantes.length ? `faltan: ${huecosFaltantes.join(', ')}` : `${huecosMinimos.length} huecos mínimos presentes`,
);

// ─────────────────────────────────────────────────────────────
// Items A y D · entregables
// ─────────────────────────────────────────────────────────────

const FLUJOS = ['mapa', 'busqueda', 'catalogo', 'bpmn', 'edicion', 'guia', 'pantalla', 'dividido', 'datos', 'pendientes'];
const ANCHOS = ['390', '768', '1440'];
const faltanCapturas = [];
for (const flujo of FLUJOS) {
  for (const ancho of ANCHOS) {
    const ruta = `docs/fusion/capturas/cierre-${flujo}-${ancho}.png`;
    if (!(await existe(ruta))) faltanCapturas.push(ruta);
  }
}
check(
  'capturas-por-ancho',
  'Hay una captura por flujo y por ancho (390, 768 y 1440 px)',
  faltanCapturas.length === 0,
  faltanCapturas.length
    ? `faltan: ${faltanCapturas.join(', ')}`
    : `${FLUJOS.length} flujos × ${ANCHOS.length} anchos = ${FLUJOS.length * ANCHOS.length} capturas`,
);

// Bloque 3 · QA final: la evidencia reunida por `npm run verificar:qa-final`
// tiene que estar en verde y las capturas a 390 px de los tres flujos
// (uno de ellos «Gobierno documental») tienen que existir.
const qaFinal = (await existe('docs/fusion/QA-FINAL.json'))
  ? JSON.parse(await leer('docs/fusion/QA-FINAL.json'))
  : null;
const flujosPulido = [
  'gobierno_como_se_gobierna_la_documentacion',
  'ventas_como_una_oportunidad_se_convierte_en_cliente',
  'finanzas_como_entra_y_se_sale_la_plata',
];
const faltanPulido = [];
for (const flujo of flujosPulido) {
  const ruta = `docs/fusion/capturas/pulido-${flujo}-390.png`;
  if (!(await existe(ruta))) faltanPulido.push(ruta);
}
check(
  'qa-final',
  'El QA final está en verde y hay capturas a 390 px de los tres flujos (uno es «Gobierno documental»)',
  Boolean(qaFinal)
    && qaFinal.totales?.fallos === 0
    && qaFinal.totales?.enVerde === qaFinal.totales?.checks
    && qaFinal.totales?.checks > 0
    && faltanPulido.length === 0,
  qaFinal
    ? `${qaFinal.totales?.enVerde}/${qaFinal.totales?.checks} comprobaciones en verde · ${flujosPulido.length} capturas a 390 px${faltanPulido.length ? ` · faltan: ${faltanPulido.join(', ')}` : ''}`
    : 'falta docs/fusion/QA-FINAL.json (corre npm run verificar:qa-final)',
);

const pruebasMd = (await existe('docs/fusion/PRUEBAS.md')) ? await leer('docs/fusion/PRUEBAS.md') : '';
const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pruebasNormalizadas = normalizar(pruebasMd);
const palabrasFlujo = {
  mapa: 'mapa vivo',
  busqueda: 'busqueda',
  catalogo: 'catalogo bpmn',
  bpmn: 'abrir diagrama',
  edicion: 'edicion',
  guia: 'guia',
  pantalla: 'pantalla completa',
  dividido: 'pantalla dividida',
  datos: 'datos',
  pendientes: 'sin confirmar',
};
const flujosFaltantes = Object.entries(palabrasFlujo)
  .filter(([, palabra]) => !pruebasNormalizadas.includes(palabra))
  .map(([flujo]) => flujo);
const tieneConteo = /\b30\b/.test(pruebasMd) && /0 errores y 0 avisos/.test(pruebasNormalizadas);
check(
  'pruebas-doc',
  'PRUEBAS.md tiene el conteo de pruebas y los avisos de lint',
  Boolean(pruebasMd) && flujosFaltantes.length === 0 && tieneConteo,
  flujosFaltantes.length
    ? `faltan los flujos: ${flujosFaltantes.join(', ')}`
    : `los ${FLUJOS.length} flujos, el conteo de pruebas y «0 errores y 0 avisos» de lint están documentados`,
);

const preguntasMd = (await existe('docs/fusion/PREGUNTAS.md')) ? await leer('docs/fusion/PREGUNTAS.md') : '';
const resueltos = (preguntasMd.match(/RESUELTO:/g) ?? []).length;
check(
  'preguntas-resuelto',
  'PREGUNTAS.md registra las decisiones de Rosas como RESUELTO',
  resueltos >= 11,
  `${resueltos} decisiones marcadas como RESUELTO`,
);

const bitacoraMd = (await existe('docs/fusion/BITACORA.md')) ? await leer('docs/fusion/BITACORA.md') : '';
const bloques = (bitacoraMd.match(/^## Bloque/gm) ?? []).length;
check(
  'bitacora',
  'BITACORA.md cuenta lo hecho, lo que falta y la evidencia de cada bloque',
  bloques >= 10,
  `${bloques} bloques registrados`,
);

// ─────────────────────────────────────────────────────────────
// Salida
// ─────────────────────────────────────────────────────────────

const resumen = {
  generadoEn: new Date().toISOString(),
  total: resultados.length,
  ok: resultados.filter((resultado) => resultado.ok).length,
  fallos: fallos.length,
  resultados,
};

await writeFile(resolve(RAIZ, 'docs/fusion/CIERRE.json'), `${JSON.stringify(resumen, null, 2)}\n`, 'utf8');

for (const resultado of resultados) {
  console.log(`${resultado.ok ? '✔' : '✘'} ${resultado.id.padEnd(28)} ${resultado.nombre} — ${resultado.detalle}`);
}
console.log('');
console.log(`Cierre: ${resumen.ok}/${resumen.total} comprobaciones en verde.`);
if (fallos.length) {
  console.error(`FALLAN ${fallos.length}:`);
  for (const fallo of fallos) console.error(`  - ${fallo}`);
  process.exit(1);
}
