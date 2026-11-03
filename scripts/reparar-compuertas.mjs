// Repara la deuda de modelado de las semillas BPMN del Atlas RR.
//
// 1. `no-gateway-join-fork`: una compuerta con dos o más entradas y dos o más
//    salidas abre y cierra al mismo tiempo. Se divide en dos: una que une
//    (join) y otra que reparte (fork). La del reparto conserva nombre, salidas
//    y posición.
// 2. `fake-join`: una tarea o un evento con varias entradas necesita una
//    compuerta paralela que las junte.
// 3. `superfluous-label`: un flujo con etiqueta que no sale de una compuerta de
//    decisión repite lo que el diagrama ya dice: se le quita la etiqueta.
//
// Uso: node scripts/reparar-compuertas.mjs [--simular]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = resolve(root, 'src/bpmn/seeds');
const soloSimular = process.argv.includes('--simular');

const compuertas = ['parallelGateway', 'exclusiveGateway', 'inclusiveGateway'];
const actividades = ['task', 'userTask', 'serviceTask', 'manualTask', 'sendTask', 'receiveTask', 'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'];

// ---------- cajas del diagrama ----------
function cajas(xml) {
  const lista = [];
  const re = /<bpmndi:BPMNShape id="([^"]+)" bpmnElement="([^"]+)"[^>]*>\s*<dc:Bounds x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"\/>/g;
  for (const match of xml.matchAll(re)) {
    // Los carriles y el participante son estructurales: la regla de lint no
    // los cuenta para solapes, así que tampoco cuentan aquí.
    if (/^part_/.test(match[2])) { lista.participante = { id: match[2], x: Number(match[3]), y: Number(match[4]), w: Number(match[5]), h: Number(match[6]) }; continue; }
    if (/^lane_/.test(match[2])) continue;
    lista.push({ id: match[2], shapeId: match[1], x: Number(match[3]), y: Number(match[4]), w: Number(match[5]), h: Number(match[6]) });
  }
  return lista;
}

// La regla de bpmnlint cuenta como solape hasta el contacto: aquí se pide un
// margen de dos píxeles para que dos formas ni se toquen.
const MARGEN = 2;
const seSolapan = (a, b) => {
  const ancho = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const alto = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ancho > -MARGEN && alto > -MARGEN;
};

/** Primer sitio libre (candidates) para una caja de 50×50. */
function buscarSitio(lista, candidatas, excepto, limite = null) {
  for (const sitio of candidatas) {
    const caja = { x: sitio.x, y: sitio.y, w: 50, h: 50 };
    // La forma nueva tiene que quedar dentro del participante del diagrama.
    if (limite && (caja.x < limite.x + 4 || caja.y < limite.y + 4
      || caja.x + caja.w > limite.x + limite.w - 4 || caja.y + caja.h > limite.y + limite.h - 4)) continue;
    const choque = lista.some((otra) => otra.id !== excepto && seSolapan(caja, otra));
    if (!choque) return { x: sitio.x, y: sitio.y };
  }
  // Si todo está ocupado, la compuerta se dibuja debajo del diagrama.
  const abajo = Math.max(...lista.map((otra) => otra.y + otra.h), 0) + 60;
  const izquierda = Math.min(...lista.map((otra) => otra.x), 0);
  return { x: izquierda, y: abajo };
}

/** Candidatas alrededor de una forma: a la izquierda, arriba, abajo y a la derecha. */
function candidatasAlrededor(forma) {
  const lista = [];
  for (const dx of [-90, -140, -190, -240]) {
    for (const dy of [0, 80, -80, 160, -160]) lista.push({ x: forma.x + dx, y: forma.y + dy });
  }
  lista.push({ x: forma.x, y: forma.y - 90 });
  lista.push({ x: forma.x, y: forma.y + forma.h + 40 });
  lista.push({ x: forma.x + forma.w + 40, y: forma.y });
  return lista;
}

/** Punto de la caja del join y punto del nodo, según la dirección. */
function anclas(join, nodo) {
  const centroJoin = { x: join.x + join.w / 2, y: join.y + join.h / 2 };
  const centroNodo = { x: nodo.x + nodo.w / 2, y: nodo.y + nodo.h / 2 };
  const dx = centroNodo.x - centroJoin.x;
  const dy = centroNodo.y - centroJoin.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const signo = Math.sign(dx) || 1;
    return {
      desde: { x: centroJoin.x + signo * join.w / 2, y: centroJoin.y },
      hasta: { x: centroNodo.x - signo * nodo.w / 2, y: centroNodo.y },
    };
  }
  const signo = Math.sign(dy) || 1;
  return {
    desde: { x: centroJoin.x, y: centroJoin.y + signo * join.h / 2 },
    hasta: { x: centroNodo.x, y: centroNodo.y - signo * nodo.h / 2 },
  };
}

// ---------- lectura del modelo ----------
function flujosDe(xml) {
  return [...xml.matchAll(/<bpmn:sequenceFlow id="([^"]+)" sourceRef="([^"]+)" targetRef="([^"]+)"([^>]*)\/>/g)]
    .map((m) => ({ id: m[1], source: m[2], target: m[3], resto: m[4], texto: m[0] }));
}

function compuertasProblematicas(xml, flujos) {
  const halladas = [];
  const re = /<bpmn:(parallelGateway|exclusiveGateway|inclusiveGateway) id="([^"]+)"([^>]*)>([\s\S]*?)<\/bpmn:\1>/g;
  for (const match of xml.matchAll(re)) {
    const [, tipo, id, attrs] = match;
    const entrantes = flujos.filter((flujo) => flujo.target === id);
    const salientes = flujos.filter((flujo) => flujo.source === id);
    if (entrantes.length >= 2 && salientes.length >= 2) {
      halladas.push({ tipo, id, attrs, entrantes, salientes, bloque: match[0] });
    }
  }
  return halladas;
}

function actividadesSinJoin(xml, flujos) {
  const halladas = [];
  const re = new RegExp(`<bpmn:(${actividades.join('|')}) id="([^"]+)"([^>]*)>([\\s\\S]*?)</bpmn:\\1>`, 'g');
  for (const match of xml.matchAll(re)) {
    const [, tipo, id, attrs] = match;
    const entrantes = flujos.filter((flujo) => flujo.target === id);
    if (entrantes.length >= 2) halladas.push({ tipo, id, attrs, entrantes, bloque: match[0] });
  }
  return halladas;
}

function etiquetaSobrante(xml, flujos) {
  const tipos = new Map();
  const re = /<bpmn:(exclusiveGateway|inclusiveGateway|parallelGateway) id="([^"]+)"/g;
  for (const match of xml.matchAll(re)) tipos.set(match[2], match[1]);
  return flujos.filter((flujo) => / name="[^"]*"/.test(flujo.resto)
    && !['exclusiveGateway', 'inclusiveGateway'].includes(tipos.get(flujo.source)));
}

// ---------- helpers de escritura ----------
function anadirFlujo(salida, flujoXml) {
  const ultimo = [...salida.matchAll(/<bpmn:sequenceFlow id="([^"]+)"[^>]*\/>/g)].pop();
  return salida.replace(ultimo[0], `${ultimo[0]}\n    ${flujoXml}`);
}

function anadirAlCarril(salida, idOriginal, idNuevo) {
  const laneRe = new RegExp(`(<bpmn:lane id="([^"]+)"[^>]*>[\\s\\S]*?<bpmn:flowNodeRef>${idOriginal}</bpmn:flowNodeRef>)`);
  if (!laneRe.test(salida)) throw new Error(`No se encontró el carril de ${idOriginal}`);
  return salida.replace(laneRe, `$1\n        <bpmn:flowNodeRef>${idNuevo}</bpmn:flowNodeRef>`);
}

function moverEntradaDe(salida, idFlujo, idNuevo) {
  return salida.replace(
    new RegExp(`(<bpmn:sequenceFlow id="${idFlujo}" sourceRef="[^"]+" targetRef=")[^"]+(")`),
    `$1${idNuevo}$2`,
  );
}

function formaDe(salida, id) {
  const shapeRe = new RegExp(`<bpmndi:BPMNShape id="([^"]+)" bpmnElement="${id}"([^>]*)>\\s*<dc:Bounds x="(-?\\d+)" y="(-?\\d+)" width="(\\d+)" height="(\\d+)"/>([\\s\\S]*?)</bpmndi:BPMNShape>`);
  const shape = salida.match(shapeRe);
  if (!shape) throw new Error(`No se encontró la forma DI de ${id}`);
  return { texto: shape[0], shapeId: shape[1], attrs: shape[2], x: Number(shape[3]), y: Number(shape[4]), w: Number(shape[5]), h: Number(shape[6]), resto: shape[7] };
}

/** Inserta la compuerta de unión delante de un nodo y recompone sus aristas. */
function ponerJoinDelante(salida, nodo, idJoin, idFlujo, informe) {
  const entrantesIds = nodo.entrantes.map((flujo) => flujo.id);
  const cuerpoJoin = [
    ...entrantesIds.map((flujo) => `      <bpmn:incoming>${flujo}</bpmn:incoming>`),
    `      <bpmn:outgoing>${idFlujo}</bpmn:outgoing>`,
  ].join('\n');
  const bloqueJoin = `<bpmn:parallelGateway id="${idJoin}">\n${cuerpoJoin}\n    </bpmn:parallelGateway>`;
  // El nodo se queda con una sola entrada: la que viene del join.
  const nodoConUnaEntrada = nodo.bloque.replace(
    /(\s*<bpmn:incoming>[^<]*<\/bpmn:incoming>)+/,
    `\n      <bpmn:incoming>${idFlujo}</bpmn:incoming>`,
  );
  salida = salida.replace(nodo.bloque, `${nodoConUnaEntrada}\n    ${bloqueJoin}`);

  for (const flujo of nodo.entrantes) salida = moverEntradaDe(salida, flujo.id, idJoin);
  salida = anadirFlujo(salida, `<bpmn:sequenceFlow id="${idFlujo}" sourceRef="${idJoin}" targetRef="${nodo.id}"/>`);
  salida = anadirAlCarril(salida, nodo.id, idJoin);

  const forma = formaDe(salida, nodo.id);
  const candidatas = candidatasAlrededor(forma);
  const mapa = cajas(salida);
  const sitio = buscarSitio(mapa, candidatas, nodo.id, mapa.participante);
  const cajaJoin = { id: idJoin, x: sitio.x, y: sitio.y, w: 50, h: 50 };
  const nuevoShape = `<bpmndi:BPMNShape id="${forma.shapeId}_join_di" bpmnElement="${idJoin}" isMarkerVisible="true">\n`
    + `        <dc:Bounds x="${sitio.x}" y="${sitio.y}" width="50" height="50"/>\n`
    + `      </bpmndi:BPMNShape>`;
  salida = salida.replace(forma.texto, `${forma.texto}\n      ${nuevoShape}`);

  const { desde, hasta } = anclas(cajaJoin, { x: forma.x, y: forma.y, w: forma.w, h: forma.h });
  let aristaDibujada = false;
  for (const flujo of nodo.entrantes) {
    const edgeRe = new RegExp(`<bpmndi:BPMNEdge id="([^"]+)" bpmnElement="${flujo.id}"[^>]*>[\\s\\S]*?</bpmndi:BPMNEdge>`);
    const edge = salida.match(edgeRe);
    if (!edge) throw new Error(`No se encontró la arista DI de ${flujo.id}`);
    const waypoints = [...edge[0].matchAll(/<di:waypoint x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g)];
    const ultimo = waypoints[waypoints.length - 1];
    const nuevoEdge = edge[0].replace(ultimo[0], `<di:waypoint x="${desde.x}" y="${desde.y}"/>`);
    const edgeNuevo = `<bpmndi:BPMNEdge id="${idFlujo}_di" bpmnElement="${idFlujo}">\n`
      + `        <di:waypoint x="${desde.x}" y="${desde.y}"/>\n`
      + `        <di:waypoint x="${hasta.x}" y="${hasta.y}"/>\n`
      + `      </bpmndi:BPMNEdge>`;
    salida = salida.replace(edge[0], `${nuevoEdge}${aristaDibujada ? '' : `\n      ${edgeNuevo}`}`);
    aristaDibujada = true;
  }
  informe.push({ id: nodo.id, caso: 'fake-join', nuevo: idJoin });
  return salida;
}

function reparacionesDeArchivo(xml) {
  let salida = xml;
  const informe = [];
  let flujos = flujosDe(salida);

  // 1 · compuertas que abren y cierran a la vez.
  for (const compuerta of compuertasProblematicas(salida, flujos)) {
    const id = compuerta.id;
    const idJoin = `${id}_join`;
    const idFlujo = `sf_${id}_join`;
    if (salida.includes(`id="${idJoin}"`)) throw new Error(`El id ${idJoin} ya existe`);

    const entrantesIds = compuerta.entrantes.map((flujo) => flujo.id);
    const salientesIds = compuerta.salientes.map((flujo) => flujo.id);
    const cuerpoFork = [
      `      <bpmn:incoming>${idFlujo}</bpmn:incoming>`,
      ...salientesIds.map((flujo) => `      <bpmn:outgoing>${flujo}</bpmn:outgoing>`),
    ].join('\n');
    const bloqueFork = `<bpmn:${compuerta.tipo} id="${id}"${compuerta.attrs}>\n${cuerpoFork}\n    </bpmn:${compuerta.tipo}>`;
    const cuerpoJoin = [
      ...entrantesIds.map((flujo) => `      <bpmn:incoming>${flujo}</bpmn:incoming>`),
      `      <bpmn:outgoing>${idFlujo}</bpmn:outgoing>`,
    ].join('\n');
    const bloqueJoin = `<bpmn:${compuerta.tipo} id="${idJoin}">\n${cuerpoJoin}\n    </bpmn:${compuerta.tipo}>`;
    salida = salida.replace(compuerta.bloque, `${bloqueFork}\n    ${bloqueJoin}`);

    for (const flujo of compuerta.entrantes) salida = moverEntradaDe(salida, flujo.id, idJoin);
    salida = anadirFlujo(salida, `<bpmn:sequenceFlow id="${idFlujo}" sourceRef="${idJoin}" targetRef="${id}"/>`);
    salida = anadirAlCarril(salida, id, idJoin);

    // DI: el join se coloca a la izquierda de la compuerta que reparte.
    const forma = formaDe(salida, id);
    const candidatas = candidatasAlrededor(forma);
    const mapa = cajas(salida);
    const sitio = buscarSitio(mapa, candidatas, id, mapa.participante);
    const nuevoShape = `<bpmndi:BPMNShape id="${forma.shapeId}_join_di" bpmnElement="${idJoin}" isMarkerVisible="true">\n`
      + `        <dc:Bounds x="${sitio.x}" y="${sitio.y}" width="50" height="50"/>\n`
      + `      </bpmndi:BPMNShape>`;
    salida = salida.replace(forma.texto, `${forma.texto}\n      ${nuevoShape}`);

    const { desde, hasta } = anclas(
      { id: idJoin, x: sitio.x, y: sitio.y, w: 50, h: 50 },
      { x: forma.x, y: forma.y, w: forma.w, h: forma.h },
    );
    let aristaDibujada = false;
    for (const flujo of compuerta.entrantes) {
      const edgeRe = new RegExp(`<bpmndi:BPMNEdge id="([^"]+)" bpmnElement="${flujo.id}"[^>]*>[\\s\\S]*?</bpmndi:BPMNEdge>`);
      const edge = salida.match(edgeRe);
      if (!edge) throw new Error(`No se encontró la arista DI de ${flujo.id}`);
      const waypoints = [...edge[0].matchAll(/<di:waypoint x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g)];
      const ultimo = waypoints[waypoints.length - 1];
      const nuevoEdge = edge[0].replace(ultimo[0], `<di:waypoint x="${desde.x}" y="${desde.y}"/>`);
      const edgeNuevo = `<bpmndi:BPMNEdge id="${idFlujo}_di" bpmnElement="${idFlujo}">\n`
        + `        <di:waypoint x="${desde.x}" y="${desde.y}"/>\n`
        + `        <di:waypoint x="${hasta.x}" y="${hasta.y}"/>\n`
        + `      </bpmndi:BPMNEdge>`;
      salida = salida.replace(edge[0], `${nuevoEdge}${aristaDibujada ? '' : `\n      ${edgeNuevo}`}`);
      aristaDibujada = true;
    }
    informe.push({ id, caso: 'no-gateway-join-fork', nuevo: idJoin });
  }

  // 2 · tareas y eventos con varias entradas.
  flujos = flujosDe(salida);
  for (const nodo of actividadesSinJoin(salida, flujos)) {
    const idJoin = `${nodo.id}_join`;
    if (salida.includes(`id="${idJoin}"`)) continue;
    salida = ponerJoinDelante(salida, nodo, idJoin, `sf_${nodo.id}_join`, informe);
  }

  // 3 · etiquetas de sobra.
  flujos = flujosDe(salida);
  for (const flujo of etiquetaSobrante(salida, flujos)) {
    salida = salida.replace(flujo.texto, flujo.texto.replace(/ name="[^"]*"/, ''));
    informe.push({ id: flujo.id, caso: 'superfluous-label', nuevo: null });
  }

  return { salida, informe };
}

const archivos = (await readdir(seedDir)).filter((name) => name.endsWith('.bpmn')).sort();
let total = 0;
for (const archivo of archivos) {
  const ruta = resolve(seedDir, archivo);
  const xml = await readFile(ruta, 'utf8');
  const { salida, informe } = reparacionesDeArchivo(xml);
  if (!informe.length) continue;
  total += informe.length;
  console.log(`${archivo}: ${informe.map((item) => (item.nuevo ? `${item.id} → ${item.nuevo}` : `${item.id} (${item.caso})`)).join(', ')}`);
  if (!soloSimular) await writeFile(ruta, salida, 'utf8');
}
console.log(`${soloSimular ? 'Simulación' : 'Reparación'}: ${total} arreglos en ${archivos.length} semillas.`);
