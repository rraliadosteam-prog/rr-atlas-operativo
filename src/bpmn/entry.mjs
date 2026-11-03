import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import Modeler from 'bpmn-js/lib/Modeler';
import { rrModdle } from './rr-moddle.mjs';
import { rrRendererModule } from './rr-renderer.mjs';
import { readRrTheme } from './rr-theme.mjs';
import { validateXml } from './lint/run.mjs';
import { findSensitive } from '../core/process-model.mjs';
import {
  MARGEN_ENCUADRE,
  PISO_LEGIBILIDAD_DIAGRAMA,
  PISO_ZOOM_MANUAL_MOTOR,
  ZOOM_MAXIMO,
  acotarZoom,
  esLienzoAngosto,
  pisoManualMotor,
  zoomEncuadre,
  zoomManual,
} from '../core/zoom.mjs';

// Bloque 1B · ítem 3 del diseño v3.1: en este archivo **no hay ninguna
// constante de zoom escrita a mano**. Los pisos, el margen y el techo
// salen de `src/core/zoom.mjs`, que es la única fuente (bloque 1A).
//
// · El margen del encuadre del paso (P1.2): 24 px a cada lado.
const MARGEN_PASO = Object.freeze({ top: 24, right: 24, bottom: 24, left: 24 });
// · El margen con el que se centra un paso en el lienzo: el elemento **y su
//   etiqueta** tienen que verse enteros, con aire alrededor.
const MARGEN_PASO_VISTA = Object.freeze({ top: 24, right: 24, bottom: 24, left: 24 });
// · El margen mínimo (en píxeles) entre el elemento —y su etiqueta— y el
//   borde del lienzo: por debajo de esto el nombre queda pegado al borde.
const MARGEN_MINIMO_PX = 16;
// · El encuadre nunca baja de este zoom (el mínimo de siempre).
const ZOOM_ENCUADRE_MINIMO = 0.05;

/**
 * Normaliza las opciones de `fit()`.
 *
 * El contrato es **cerrado** (P1.2): `modo` es `'paso'` o `'todo'`; cualquier
 * otro valor es un error (`Error('modo inválido')`). `forzar: true` ignora
 * el piso de legibilidad: encuadra exactamente como se le pide.
 *
 * La llamada vieja `{ completo: true }` (el visor pequeño del panel
 * dividido) sigue valiendo y equivale a `{ modo: 'todo' }`.
 */
export function opcionesDeFit(opciones = {}) {
  const MODOS = ['paso', 'todo'];
  const op = opciones && typeof opciones === 'object' ? opciones : {};
  const forzar = op.forzar === true;
  const modo = op.modo === undefined || op.modo === null ? 'todo' : op.modo;
  if (!MODOS.includes(modo)) throw new Error('modo inválido');
  return { modo, forzar };
}

/**
 * El id del proceso abierto. Lo dice quien abre (la vista) y, si no, se
 * deduce del nombre del archivo: las semillas se llaman como su proceso
 * (`ventas_como_….bpmn` → `ventas_como_…`).
 */
export function idProcesoDe(options = {}) {
  const op = options && typeof options === 'object' ? options : {};
  const dado = typeof op.procesoId === 'string' ? op.procesoId.trim() : '';
  if (dado) return dado;
  const nombre = String(op.fileName || '').trim();
  if (!nombre) return '';
  return nombre.replace(/\.bpmn$/i, '');
}

/**
 * De dónde sale el diagrama abierto: 'semilla' (la semilla del repo),
 * 'local' (la copia guardada en este navegador) o 'sesion' (el XML que
 * venía en memoria). Si quien abre no lo dice, se supone 'semilla'.
 */
export function origenDe(options = {}) {
  const op = options && typeof options === 'object' ? options : {};
  const dado = typeof op.origen === 'string' ? op.origen.trim() : '';
  return dado || 'semilla';
}

function bindPinch(container, getCanvas) {
  const points = new Map();
  let start = null;
  const position = (event) => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  container.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    points.set(event.pointerId, position(event));
  });
  container.addEventListener('pointermove', (event) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, position(event));
    if (points.size < 2) return;
    event.preventDefault();
    const [a, b] = [...points.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const canvas = getCanvas();
    if (!canvas) return;
    if (!start) start = { distance, zoom: canvas.zoom() };
    // El pellizco usa las constantes del módulo de pisos: el piso manual
    // (que queda por debajo del de legibilidad) y el techo del diagrama.
    // El techo nunca hace bajar el zoom que ya había.
    const siguiente = acotarZoom(
      start.zoom * (distance / start.distance),
      PISO_ZOOM_MANUAL_MOTOR,
      Math.max(ZOOM_MAXIMO, start.zoom),
    );
    canvas.zoom(siguiente, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }, { passive: false });
  const end = (event) => {
    points.delete(event.pointerId);
    if (points.size < 2) start = null;
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
}

async function rasterize(svg, { logoUrl, footer, background }) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const logo = logoUrl ? await loadImage(logoUrl).catch(() => null) : null;
    const width = image.naturalWidth || 1200;
    const height = (image.naturalHeight || 800) + 72;
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height - 72);
    if (logo) context.drawImage(logo, 16, height - 60, 48, 36);
    context.fillStyle = background === '#070001' ? '#fffff3' : '#070001';
    context.font = '14px Arial, sans-serif';
    context.fillText(footer, 76, height - 36);
    return await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolveImage, reject) => {
    const image = new Image();
    image.onload = () => resolveImage(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen'));
    image.src = url;
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const NOMBRE_POR_TIPO = {
  'bpmn:Task': 'Tarea nueva',
  'bpmn:UserTask': 'Tarea de usuario',
  'bpmn:ServiceTask': 'Tarea de servicio',
  'bpmn:ExclusiveGateway': '¿Se cumple?',
  'bpmn:ParallelGateway': '¿En paralelo?',
  'bpmn:StartEvent': 'Inicio',
  'bpmn:EndEvent': 'Fin',
  'bpmn:Lane': 'Carril nuevo',
};

const TIPOS_NUEVOS = {
  tarea: 'bpmn:Task',
  'tarea-usuario': 'bpmn:UserTask',
  'tarea-servicio': 'bpmn:ServiceTask',
  compuerta: 'bpmn:ExclusiveGateway',
  evento: 'bpmn:StartEvent',
  'evento-fin': 'bpmn:EndEvent',
  carril: 'bpmn:Lane',
};

export function createBpmnWorkspace({ container, onReport, onElement, onChange }) {
  let viewer = null;
  let mode = 'view';
  let currentXml = '';
  let debt = null;
  let fileName = '';
  let pinchBound = false;
  let cambiosPendientes = false;
  // Bloque 1B: el motor **reporta** su estado, no lo inventa.
  let procesoId = '';
  let origen = '';
  let modoLectura = 'todo';

  async function ensure(nextMode) {
    if (viewer && mode === nextMode) return;
    viewer?.destroy();
    const theme = readRrTheme();
    const Ctor = nextMode === 'edit' ? Modeler : NavigatedViewer;
    viewer = new Ctor({
      container,
      additionalModules: [rrRendererModule],
      moddleExtensions: { rr: rrModdle },
      bpmnRenderer: {
        defaultFillColor: theme.fill,
        defaultStrokeColor: theme.stroke,
      },
    });
    mode = nextMode;
    viewer.on('element.click', ({ element }) => {
      const business = element.businessObject || {};
      onElement?.({
        id: element.id,
        type: element.type,
        name: business.name || 'Sin nombre',
        documentation: (business.documentation || []).map((item) => item.text || '').join(' ').trim(),
        incoming: element.incoming?.length || 0,
        outgoing: element.outgoing?.length || 0,
        laneId: carrilDe(element)?.id || '',
        laneName: carrilDe(element)?.businessObject?.name || '',
        color: colorDe(element),
      });
    });
    if (!pinchBound) {
      bindPinch(container, () => viewer?.get('canvas'));
      pinchBound = true;
    }
    if (nextMode === 'edit') {
      viewer.on('commandStack.changed', async () => {
        cambiosPendientes = true;
        try {
          const saved = await viewer.saveXML({ format: true });
          currentXml = saved.xml;
          onReport?.(await validateXml(currentXml, { fileName, debt }));
        } catch {
          onReport?.({ ok: false, importError: 'No se pudo guardar el diagrama', moddleWarnings: [], issues: [], errors: [], warnings: [], debt: [] });
        }
        onChange?.({ cambios: cambiosPendientes, puedeDeshacer: puedeDeshacer(), puedeRehacer: puedeRehacer() });
      });
    }
  }

  function restyle() {
    if (!viewer) return;
    const registry = viewer.get('elementRegistry');
    const graphics = viewer.get('graphicsFactory');
    registry.forEach((element) => {
      const gfx = registry.getGraphics(element);
      if (!gfx) return;
      graphics.update(element.waypoints ? 'connection' : 'shape', element, gfx);
    });
  }

  let stepIndex = 0;
  // El motor **reporta** el ancho de su lienzo; el piso lo decide el módulo
  // de pisos (`esLienzoAngosto`), no este archivo (ítem 3.5).
  const anchoContenedor = () => container.clientWidth || 0;
  const narrow = () => esLienzoAngosto(anchoContenedor());

  function flowElements() {
    if (!viewer) return [];
    const registry = viewer.get('elementRegistry');
    const elements = registry.filter((element) => !element.labelTarget && !element.waypoints && /Event$|Task$|Gateway$/.test(element.type || ''));
    const start = elements.find((element) => element.type === 'bpmn:StartEvent') || elements[0];
    if (!start) return elements;
    const known = new Set(elements.map((element) => element.id));
    const next = new Map();
    registry.filter((element) => element.waypoints).forEach((flow) => {
      const source = flow.source?.id;
      const target = flow.target?.id;
      if (!source || !target || !known.has(target)) return;
      const list = next.get(source) || [];
      list.push(target);
      next.set(source, list);
    });
    const ordered = [];
    const seen = new Set();
    const queue = [start.id];
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id) || !known.has(id)) continue;
      seen.add(id);
      ordered.push(registry.get(id));
      for (const target of next.get(id) || []) queue.push(target);
    }
    for (const element of elements) if (!seen.has(element.id)) ordered.push(element);
    return ordered;
  }

  function laneOf(element) {
    const lanes = viewer.get('elementRegistry').filter((item) => item.type === 'bpmn:Lane');
    const lane = lanes.find((item) => element.x >= item.x && element.x <= item.x + item.width && element.y >= item.y && element.y <= item.y + item.height);
    return lane?.businessObject?.name || '';
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  /**
   * La etiqueta externa de un elemento (la que lleva su nombre). bpmn-js la
   * crea con el id `<id del elemento>_label` y la deja colgada de la forma.
   */
  function etiquetaDe(elemento) {
    if (!elemento) return null;
    if (elemento.label) return elemento.label;
    const registro = viewer?.get('elementRegistry');
    return registro?.get(`${elemento.id}_label`) || null;
  }

  /**
   * La caja del elemento **y de su etiqueta**, en unidades del diagrama.
   * El nombre del evento de inicio («Llega un documento») vive en una
   * etiqueta aparte: si solo se encuadra la forma, la etiqueta se sale del
   * lienzo por un lado (a 390 px salía cortada: «…ga un documento»).
   */
  function cajaConEtiqueta(elemento) {
    if (!elemento) return null;
    const partes = [elemento, etiquetaDe(elemento)]
      .filter(Boolean)
      .map((parte) => ({
        x: Number(parte.x) || 0,
        y: Number(parte.y) || 0,
        width: Number(parte.width) || 0,
        height: Number(parte.height) || 0,
      }));
    if (!partes.length) return null;
    const izquierda = Math.min(...partes.map((parte) => parte.x));
    const arriba = Math.min(...partes.map((parte) => parte.y));
    const derecha = Math.max(...partes.map((parte) => parte.x + parte.width));
    const abajo = Math.max(...partes.map((parte) => parte.y + parte.height));
    return { x: izquierda, y: arriba, width: derecha - izquierda, height: abajo - arriba };
  }

  /**
   * Desplaza la vista para que el elemento **y su etiqueta** se vean
   * enteros dentro del lienzo, con un margen (en píxeles) por cada lado.
   *
   * `scrollToElement` de bpmn-js solo mira la forma: la etiqueta externa
   * queda colgando fuera del lienzo. Aquí se calcula la caja de las dos y
   * se centra (o se alinea al borde, si no caben).
   */
  function centrarEnLienzo(elemento, margenPx = MARGEN_MINIMO_PX) {
    const canvas = viewer?.get('canvas');
    if (!canvas || !elemento) return;
    const caja = cajaConEtiqueta(elemento);
    const tamano = canvas.getSize?.();
    if (!caja || !tamano?.width || !tamano?.height) {
      canvas.scrollToElement(elemento, MARGEN_PASO_VISTA);
      return;
    }
    const zoom = canvas.zoom() || 1;
    const vista = canvas.viewbox();
    const margen = margenPx / zoom;
    const ancho = vista.width - 2 * margen;
    const alto = vista.height - 2 * margen;
    const x = caja.width <= ancho ? caja.x - (ancho - caja.width) / 2 : caja.x - margen;
    const y = caja.height <= alto ? caja.y - (alto - caja.height) / 2 : caja.y - margen;
    canvas.scroll({ dx: (vista.x - x) * zoom, dy: (vista.y - y) * zoom });
  }

  // Bloque 1B (P1.3): las etiquetas que se montan sobre otra forma se
  // separan **en el gfx**, no en el modelo. Escribir en `label.y` movía el
  // DI y bpmn-js guardaba esa posición: la copia exportada se iba alejando
  // de la semilla en cada paso. Aquí el modelo no se toca.
  function nudgeLabels() {
    if (!viewer) return;
    const registry = viewer.get('elementRegistry');
    const shapes = registry.filter((element) => !element.labelTarget && !element.waypoints && element.width && element.type !== 'bpmn:Lane' && element.type !== 'bpmn:Participant');
    const labels = registry.filter((element) => element.labelTarget && element.width && !['bpmn:Lane', 'bpmn:Participant'].includes(element.labelTarget?.type));
    for (const label of labels) {
      let y = label.y;
      for (let guard = 0; guard < 6; guard += 1) {
        const caja = { x: label.x, y, width: label.width, height: label.height };
        const shape = shapes.find((item) => item.id !== label.labelTarget?.id && intersects(caja, item));
        if (!shape) break;
        y = shape.y + shape.height + 8;
      }
      if (y === label.y) continue;
      const gfx = registry.getGraphics(label);
      gfx?.setAttribute('transform', `matrix(1 0 0 1 ${label.x} ${y})`);
    }
  }

  // La nota del paso sale de la documentación del elemento (el XML es la
  // verdad del diagrama): se separan las líneas «Fuente:» y «Corte:» y lo
  // que queda es la nota. Si no hay nota, la nota es una cadena vacía:
  // no se inventa texto.
  function notaDe(element) {
    if (!element) return '';
    const { notas } = separarNotas(documentacionDe(element));
    return notas || '';
  }

  // El paso, con el contrato público de P1.2:
  // { indice, total, idElemento, nombre, carril, nota }.
  function describirPaso(elements = flowElements()) {
    const element = elements[stepIndex];
    return {
      indice: elements.length ? stepIndex : 0,
      total: elements.length,
      idElemento: element?.id || '',
      nombre: element?.businessObject?.name || '',
      carril: element ? laneOf(element) : '',
      nota: notaDe(element),
    };
  }

  // Un diagrama sin pasos (o sin visor) no inventa un paso: devuelve el
  // descriptor vacío.
  function pasoVacio() {
    return { indice: 0, total: 0, idElemento: '', nombre: '', carril: '', nota: '' };
  }

  /**
   * El paso en el que está el diagrama ahora mismo.
   * @returns {{indice: number, total: number, idElemento: string, nombre: string, carril: string, nota: string}}
   */
  function pasoActual() {
    if (!viewer) return pasoVacio();
    return describirPaso();
  }

  /**
   * Va a un paso: por su **id** de elemento o por su **índice**.
   * Si el destino no existe, el diagrama se queda donde está y se devuelve
   * el paso actual (no se inventa un paso).
   * @param {string|number} idOIndice
   * @returns {{indice: number, total: number, idElemento: string, nombre: string, carril: string, nota: string}}
   */
  function irAPaso(idOIndice) {
    const elements = flowElements();
    if (!viewer || !elements.length) return pasoVacio();
    let indice = -1;
    if (typeof idOIndice === 'number' && Number.isFinite(idOIndice)) {
      indice = Math.trunc(idOIndice);
    } else if (typeof idOIndice === 'string' && idOIndice.trim()) {
      indice = elements.findIndex((element) => element.id === idOIndice.trim());
    }
    if (indice < 0 || indice >= elements.length) return pasoActual();
    return showStep(indice);
  }

  function showStep(index) {
    const elements = flowElements();
    if (!viewer || !elements.length) return pasoVacio();
    stepIndex = Math.max(0, Math.min(elements.length - 1, index));
    const canvas = viewer.get('canvas');
    if (narrow()) canvas.zoom(Math.max(canvas.zoom() || 1, PISO_LEGIBILIDAD_DIAGRAMA));
    centrarEnLienzo(elements[stepIndex], MARGEN_PASO_VISTA.top);
    marcarPaso(elements[stepIndex]);
    nudgeLabels();
    modoLectura = 'paso';
    return describirPaso(elements);
  }

  // Marca visual del paso actual del recorrido (borrador RR).
  function marcarPaso(element) {
    const registry = viewer.get('elementRegistry');
    for (const item of registry.getAll()) {
      if (item.labelTarget) continue;
      const gfx = registry.getGraphics(item);
      if (!gfx) continue;
      gfx.classList?.toggle('rr-paso-actual', item === element);
    }
  }

  // ---------- Edición (modo Editar) ----------
  function registro() {
    return viewer?.get('elementRegistry');
  }

  function esNodo(element) {
    if (!element || element.labelTarget || element.waypoints) return false;
    return /Event$|Task$|Gateway$/.test(element.type || '') || element.type === 'bpmn:Lane' || element.type === 'bpmn:Participant';
  }

  function documentacionDe(element) {
    const doc = element?.businessObject?.documentation;
    if (!doc) return '';
    const lista = Array.isArray(doc) ? doc : [doc];
    return lista.map((item) => item?.text || '').join('\n').trim();
  }

  // Las notas, la fuente y el corte viven en la documentación del elemento:
  // el XML es la verdad del diagrama y así sobreviven al export.
  function separarNotas(texto) {
    const notas = [];
    let fuente = '';
    let corte = '';
    for (const linea of String(texto || '').split('\n')) {
      const limpio = linea.trim();
      if (/^fuente\s*:/i.test(limpio)) {
        fuente = limpio.replace(/^fuente\s*:\s*/i, '');
        continue;
      }
      if (/^corte\s*:/i.test(limpio)) {
        corte = limpio.replace(/^corte\s*:\s*/i, '');
        continue;
      }
      notas.push(linea);
    }
    return { notas: notas.join('\n').trim(), fuente, corte };
  }

  function componerNotas({ notas, fuente, corte }, actual) {
    const previo = separarNotas(actual);
    const textoNotas = notas === undefined ? previo.notas : String(notas || '').trim();
    const nuevaFuente = fuente === undefined ? previo.fuente : String(fuente || '').trim();
    const nuevoCorte = corte === undefined ? previo.corte : String(corte || '').trim();
    const partes = [];
    if (textoNotas) partes.push(textoNotas);
    if (nuevaFuente) partes.push(`Fuente: ${nuevaFuente}`);
    if (nuevoCorte) partes.push(`Corte: ${nuevoCorte}`);
    return partes.join('\n');
  }

  // El color elegido por la persona se guarda en el DI con la extension de
  // color de bpmn.io (bioc:fill): asi viaja en el XML y lo pinta bpmn-js.
  function colorDe(element) {
    // En bpmn-js el DI vive en el elemento del diagrama (element.di).
    const di = element?.di || element?.businessObject?.di;
    const fill = di?.get?.('bioc:fill') || di?.$attrs?.['bioc:fill'] || '';
    return fill ? String(fill).trim().toLowerCase() : '';
  }

  function carrilDe(element) {
    if (element?.parent?.type === 'bpmn:Lane') return element.parent;
    const lanes = registro()?.filter((item) => item.type === 'bpmn:Lane') || [];
    return lanes.find((lane) => element.x >= lane.x && element.x <= lane.x + lane.width && element.y >= lane.y && element.y <= lane.y + lane.height) || null;
  }

  function elementoDe(id) {
    return registro()?.get(id) || null;
  }

  function exigeEdicion() {
    if (mode !== 'edit') throw new Error('Activa «Editar» para modificar el diagrama.');
  }

  function actualizar(id, cambios = {}) {
    exigeEdicion();
    const element = elementoDe(id);
    if (!element) throw new Error('El elemento ya no está en el diagrama.');
    const modeling = viewer.get('modeling');
    const moddle = viewer.get('moddle');
    if (cambios.nombre !== undefined) {
      modeling.updateProperties(element, { name: String(cambios.nombre || '').trim() });
    }
    if (cambios.notas !== undefined || cambios.fuente !== undefined || cambios.corte !== undefined) {
      const texto = componerNotas(cambios, documentacionDe(element));
      const doc = moddle.create('bpmn:Documentation', { text: texto });
      modeling.updateProperties(element, { documentation: [doc] });
    }
    if (cambios.color !== undefined) {
      const color = String(cambios.color || '').trim();
      modeling.updateProperties(element, { di: { 'bioc:fill': color || undefined } });
    }
    if (cambios.carrilId !== undefined) {
      const lane = cambios.carrilId ? elementoDe(cambios.carrilId) : null;
      if (lane && lane.type === 'bpmn:Lane' && element.parent !== lane) {
        const delta = { x: 0, y: (lane.y + (lane.height - element.height) / 2) - element.y };
        modeling.moveElements([element], delta, lane);
      }
    }
    return describeElement(element);
  }

  function describeElement(element) {
    const lane = carrilDe(element);
    return {
      id: element.id,
      type: element.type,
      name: element.businessObject?.name || '',
      documentation: documentacionDe(element),
      laneId: lane?.id || '',
      laneName: lane?.businessObject?.name || '',
      color: colorDe(element),
      parentId: element.parent?.id || '',
      incoming: element.incoming?.length || 0,
      outgoing: element.outgoing?.length || 0,
    };
  }

  function crear(tipo, { carrilId = '', nombre = '' } = {}) {
    exigeEdicion();
    const bpmnFactory = viewer.get('bpmnFactory');
    const elementFactory = viewer.get('elementFactory');
    const modeling = viewer.get('modeling');
    const canvas = viewer.get('canvas');
    const tipoBpmn = TIPOS_NUEVOS[tipo] || tipo;
    const businessObject = bpmnFactory.create(tipoBpmn);
    // El nombre va antes de crear la forma: asi la creacion es un solo comando
    // (deshacer la quita completa, sin dejar el paso a medio hacer).
    businessObject.name = nombre || NOMBRE_POR_TIPO[tipoBpmn] || 'Paso nuevo';
    const shape = elementFactory.createShape({ type: tipoBpmn, businessObject });
    const vista = canvas.viewbox();
    const centro = { x: vista.x + vista.width / 2, y: vista.y + vista.height / 2 };
    if (tipoBpmn === 'bpmn:Lane') {
      const laneSet = registro()?.find((item) => item.type === 'bpmn:LaneSet');
      if (!laneSet) throw new Error('Este proceso no tiene carriles: no se puede crear uno nuevo.');
      const posicion = { x: laneSet.x + 20, y: laneSet.y + laneSet.height + 10 };
      const nuevo = modeling.createLane(shape, posicion, laneSet, null);
      modeling.updateProperties(nuevo, { name: nombre || 'Carril nuevo' });
      return describeElement(nuevo);
    }
    const lane = carrilId ? elementoDe(carrilId) : null;
    const padre = lane?.type === 'bpmn:Lane' ? lane : registro()?.find((item) => item.type === 'bpmn:Participant') || null;
    const nuevo = modeling.createShape(shape, { x: centro.x, y: centro.y }, padre);
    return describeElement(nuevo);
  }

  function eliminar(id) {
    exigeEdicion();
    const element = elementoDe(id);
    if (!element) throw new Error('El elemento ya no está en el diagrama.');
    viewer.get('modeling').removeElements([element]);
    return true;
  }

  function conectar(origenId, destinoId) {
    exigeEdicion();
    const source = elementoDe(origenId);
    const target = elementoDe(destinoId);
    if (!source || !target) throw new Error('Selecciona dos elementos del diagrama.');
    viewer.get('modeling').connect(source, target);
    return true;
  }

  function pila() {
    return viewer?.get('commandStack') || null;
  }

  function puedeDeshacer() {
    return Boolean(pila()?.canUndo?.());
  }

  function puedeRehacer() {
    return Boolean(pila()?.canRedo?.());
  }

  function deshacer() {
    if (!puedeDeshacer()) return false;
    pila().undo();
    return true;
  }

  function rehacer() {
    if (!puedeRehacer()) return false;
    pila().redo();
    return true;
  }

  // Bloque 1 (b): el título del pool y el nombre de los carriles van verticales
  // dentro de su banda. El motor los ancla por la línea base, y con mayúsculas
  // acentuadas («CÓMO…») la caja de texto se sube y rozaba el borde de la
  // piscina. Aquí se recentra la tinta dentro de la banda de 30 unidades.
  function centrarTitulosEnBanda() {
    if (!viewer) return;
    const registry = viewer.get('elementRegistry');
    for (const element of registry.getAll()) {
      if (element.type !== 'bpmn:Lane' && element.type !== 'bpmn:Participant') continue;
      const gfx = registry.getGraphics(element);
      const texto = gfx?.querySelector?.('text.rr-banda-vertical');
      if (!texto) continue;
      let caja = null;
      try {
        caja = texto.getBBox();
      } catch {
        caja = null;
      }
      if (!caja?.height) continue;
      const delta = (30 - caja.height) / 2 - caja.y;
      if (Math.abs(delta) < 0.5) continue;
      texto.querySelectorAll('tspan').forEach((span) => {
        const y = Number(span.getAttribute('y'));
        if (!Number.isFinite(y)) return;
        span.setAttribute('y', String(y + delta));
      });
    }
  }

  function frameInitial() {
    if (!viewer) return pasoVacio();
    return encuadrarContenido();
  }

  // El zoom más grande con el que el paso todavía cabe en el lienzo (con el
  // margen de 24 px). Si el paso es más grande que el lienzo, este valor
  // queda por debajo del piso de legibilidad: ese es el caso «paso-ajustado».
  function zoomQueQuepa(elemento, canvas) {
    const size = canvas.getSize?.();
    if (!size?.width || !size?.height) return ZOOM_MAXIMO;
    const ancho = Number(elemento.width) || 0;
    const alto = Number(elemento.height) || 0;
    if (!ancho || !alto) return ZOOM_MAXIMO;
    const porAncho = (size.width - 2 * MARGEN_PASO.left) / ancho;
    const porAlto = (size.height - 2 * MARGEN_PASO.top) / alto;
    return Math.max(ZOOM_ENCUADRE_MINIMO, Math.min(porAncho, porAlto));
  }

  // Bloque 1 (a): el diagrama abre encuadrado al contenido y centrado, en
  // cualquier pantalla. Antes, en un lienzo angosto (celular), arrancaba
  // pegado a la izquierda mostrando solo el evento de inicio.
  //
  // Bloque 1B (ítem 3): el encuadre tiene además un **piso de
  // legibilidad** (1,15). Por eso abría a 1:4–1:8 y nadie leía nada. Con el
  // piso puesto, el diagrama puede no caber entero: entonces la vista se
  // desplaza al primer paso (o al evento de inicio), que es por donde se
  // empieza a leer.
  function encuadrarContenido({ forzar = false } = {}) {
    if (!viewer) return pasoVacio();
    const canvas = viewer.get('canvas');
    // El lienzo puede haber cambiado de tamaño desde el último encuadre
    // (la banda de lectura aparece o desaparece) y el motor guarda en
    // memoria la caja interior de lo que se ve. Sin refrescarla, el
    // encuadre centra una caja vieja y el diagrama queda torcido: se
    // recalcula antes de encuadrar.
    canvas.resized?.();
    canvas.zoom('fit-viewport', 'auto');
    // Un poco de aire alrededor: el borde del pool no queda pegado al marco.
    const conMargen = Math.max(ZOOM_ENCUADRE_MINIMO, (canvas.zoom() || 0) * MARGEN_ENCUADRE);
    // El piso de legibilidad (1,15) solo aplica en lienzo angosto: en un
    // lienzo amplio el diagrama entero cabe con margen y el escritorio
    // abre en «ver el todo» (a 1,15 solo se veía una esquina).
    const zoom = zoomEncuadre(conMargen, { forzar, anchoContenedor: anchoContenedor() });
    canvas.zoom(zoom);
    stepIndex = 0;
    // Si el piso subió el zoom, el diagrama ya no cabe entero: se deja a la
    // vista el primer paso (o el evento de inicio).
    if (zoom > conMargen) desplazarAlPrimerPaso();
    nudgeLabels();
    modoLectura = 'todo';
    return describirPaso();
  }

  // La vista se deja en el primer paso (o en el evento de inicio), que es
  // el punto por el que se empieza a leer el diagrama. La etiqueta del
  // evento («Llega un documento») también tiene que verse entera.
  function desplazarAlPrimerPaso() {
    const elements = flowElements();
    const inicio = elements.find((element) => element.type === 'bpmn:StartEvent');
    const destino = inicio || elements[0];
    if (!destino) return;
    centrarEnLienzo(destino, MARGEN_MINIMO_PX);
  }

  // Modo «paso» (P1.2): se encuadra el **paso actual**, no el diagrama
  // entero. El piso de legibilidad (1,15) manda, salvo que se fuerce. Si
  // el paso es más grande que el lienzo, se encuadra al zoom que sí cabe y
  // el modo queda «paso-ajustado».
  function encuadrarPaso({ forzar = false } = {}) {
    if (!viewer) return pasoVacio();
    const elements = flowElements();
    if (!elements.length) return pasoVacio();
    const canvas = viewer.get('canvas');
    const elemento = elements[Math.min(stepIndex, elements.length - 1)];
    stepIndex = elements.indexOf(elemento);
    let zoom = canvas.zoom() || 1;
    let ajustado = false;
    if (!forzar) {
      zoom = Math.max(zoom, PISO_LEGIBILIDAD_DIAGRAMA);
      const cabe = zoomQueQuepa(elemento, canvas);
      if (cabe < zoom) {
        zoom = cabe;
        ajustado = true;
      }
    }
    canvas.zoom(zoom);
    centrarEnLienzo(elemento, MARGEN_PASO.left);
    marcarPaso(elemento);
    nudgeLabels();
    modoLectura = ajustado ? 'paso-ajustado' : 'paso';
    return describirPaso(elements);
  }

  return {
    setDebt(value) { debt = value; },
    get modo() { return mode; },
    get cambiosPendientes() { return cambiosPendientes; },
    marcarGuardado() { cambiosPendientes = false; },
    async open(xml, options = {}) {
      fileName = options.fileName || '';
      procesoId = idProcesoDe(options);
      origen = origenDe(options);
      await ensure(options.editable ? 'edit' : 'view');
      currentXml = xml;
      cambiosPendientes = Boolean(options.cambiosPendientes);
      const report = await validateXml(xml, { fileName, debt });
      if (report.importError) {
        onReport?.(report);
        return report;
      }
      await viewer.importXML(xml);
      centrarTitulosEnBanda();
      const step = frameInitial();
      onReport?.({ ...report, step });
      return { ...report, step };
    },
    // `fit` **obedece** su argumento (P1.2): `{ modo: 'paso' | 'todo',
    // forzar }`. Un `modo` distinto de los dos lanza `Error('modo inválido')`
    // (el contrato es cerrado). `forzar: true` ignora el piso de
    // legibilidad: encuadra exactamente como se le pide (es lo que necesita
    // el visor pequeño del panel dividido).
    // La llamada vieja `{ completo: true }` sigue valiendo: equivale a
    // `{ modo: 'todo' }`.
    fit(opciones = {}) {
      const { modo, forzar } = opcionesDeFit(opciones);
      if (!viewer) return pasoVacio();
      return modo === 'paso' ? encuadrarPaso({ forzar }) : encuadrarContenido({ forzar });
    },
    recenter() { return showStep(stepIndex); },
    step(delta) { return showStep(stepIndex + delta); },
    // El zoom manual: el factor se aplica al zoom actual y el resultado se
    // acota con el piso manual (que queda **por debajo** del piso de
    // legibilidad: por eso «−» siempre aleja) y con el techo del diagrama.
    zoom(factor) {
      const canvas = viewer?.get('canvas');
      if (!canvas) return;
      const actual = canvas.zoom();
      if (!Number.isFinite(actual)) return;
      canvas.zoom(zoomManual(actual, factor, anchoContenedor()));
    },
    // ---- API de paso (P1.2) ----
    pasoActual,
    irAPaso,
    // El estado del lienzo, para el gancho de depuración y para la puerta
    // de 390 px (`scripts/piso-390.mjs` lee `estado().zoom`).
    // · `modo` es el modo de **lectura** del diagrama: 'todo', 'paso' o
    //   'paso-ajustado'. El modo de edición es `workspace.modo`.
    estado() {
      const canvas = viewer?.get('canvas');
      const zoom = canvas?.zoom?.();
      return {
        zoom: Number.isFinite(zoom) ? zoom : null,
        anchoContenedor: anchoContenedor(),
        proceso: procesoId,
        paso: pasoActual(),
        modo: modoLectura,
        origen,
      };
    },
    focus(id) {
      if (!viewer || !id) return;
      const elements = flowElements();
      const index = elements.findIndex((element) => element.id === id);
      if (index >= 0) {
        showStep(index);
        return;
      }
      const element = viewer.get('elementRegistry').get(id);
      if (!element) return;
      if (narrow()) viewer.get('canvas').zoom(Math.max(viewer.get('canvas').zoom() || 1, PISO_LEGIBILIDAD_DIAGRAMA));
      centrarEnLienzo(element, MARGEN_PASO_VISTA.top);
      try { viewer.get('selection').select(element); } catch { /* el visor no selecciona */ }
    },
    restyle,
    // ---- API de edición (modo Editar) ----
    elementos() {
      if (!viewer) return [];
      return registro().filter(esNodo).map(describeElement);
    },
    carriles() {
      if (!viewer) return [];
      return registro().filter((item) => item.type === 'bpmn:Lane').map((lane) => ({
        id: lane.id,
        name: lane.businessObject?.name || 'Carril',
      }));
    },
    elemento(id) {
      const element = elementoDe(id);
      return element ? describeElement(element) : null;
    },
    depurar(id) {
      const element = elementoDe(id);
      if (!element) return null;
      const di = element.di || element.businessObject?.di;
      return {
        color: colorDe(element),
        diFill: di?.get?.('bioc:fill') ?? null,
        attrs: di?.$attrs ? { ...di.$attrs } : null,
        tieneDi: Boolean(di),
      };
    },
    actualizar,
    crear,
    eliminar,
    conectar,
    deshacer,
    rehacer,
    puedeDeshacer,
    puedeRehacer,
    async xml() {
      if (viewer && mode === 'edit') {
        const saved = await viewer.saveXML({ format: true });
        currentXml = saved.xml;
      }
      return currentXml;
    },
    async exportXml(filename) {
      const xml = await this.xml();
      const hits = findSensitive(xml);
      if (hits.length) throw new Error(`Exportación detenida: hay ${hits.join(', ')}.`);
      download(new Blob([xml], { type: 'application/bpmn+xml' }), filename);
    },
    async exportSvg(filename) {
      const { svg } = await viewer.saveSVG();
      download(new Blob([svg], { type: 'image/svg+xml' }), filename);
    },
    async exportPng(filename, { logoUrl, footer }) {
      const { svg } = await viewer.saveSVG();
      const light = document.body.classList.contains('atlas-theme-light');
      const blob = await rasterize(svg, {
        logoUrl,
        footer,
        background: light ? '#fffff3' : '#070001',
      });
      if (!blob) throw new Error('No se pudo crear el PNG');
      download(blob, filename);
    },
    destroy() {
      viewer?.destroy();
      viewer = null;
    },
  };
}
