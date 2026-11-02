import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import Modeler from 'bpmn-js/lib/Modeler';
import { rrModdle } from './rr-moddle.mjs';
import { rrRendererModule } from './rr-renderer.mjs';
import { readRrTheme } from './rr-theme.mjs';
import { validateXml } from './lint/run.mjs';
import { findSensitive } from '../core/process-model.mjs';

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
    const next = Math.max(0.2, Math.min(4, start.zoom * (distance / start.distance)));
    canvas.zoom(next, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
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
  const narrow = () => container.clientWidth < 540;

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

  function nudgeLabels() {
    if (!viewer) return;
    const registry = viewer.get('elementRegistry');
    const shapes = registry.filter((element) => !element.labelTarget && !element.waypoints && element.width && element.type !== 'bpmn:Lane' && element.type !== 'bpmn:Participant');
    const labels = registry.filter((element) => element.labelTarget && element.width && !['bpmn:Lane', 'bpmn:Participant'].includes(element.labelTarget?.type));
    for (const label of labels) {
      for (let guard = 0; guard < 6; guard += 1) {
        const shape = shapes.find((item) => item.id !== label.labelTarget?.id && intersects(label, item));
        if (!shape) break;
        label.y = shape.y + shape.height + 8;
        const gfx = registry.getGraphics(label);
        gfx?.setAttribute('transform', `matrix(1 0 0 1 ${label.x} ${label.y})`);
      }
    }
  }

  function describeStep(elements = flowElements()) {
    const element = elements[stepIndex];
    return {
      index: elements.length ? stepIndex : 0,
      total: elements.length,
      name: element?.businessObject?.name || 'Inicio',
      lane: element ? laneOf(element) : '',
    };
  }

  function showStep(index) {
    const elements = flowElements();
    if (!viewer || !elements.length) return { index: 0, total: 0, name: 'Sin pasos', lane: '' };
    stepIndex = Math.max(0, Math.min(elements.length - 1, index));
    const canvas = viewer.get('canvas');
    if (narrow()) canvas.zoom(Math.max(canvas.zoom() || 1, 1.15));
    canvas.scrollToElement(elements[stepIndex], { top: 72, right: 28, bottom: 88, left: 28 });
    marcarPaso(elements[stepIndex]);
    nudgeLabels();
    return describeStep(elements);
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

  function frameInitial() {
    if (!viewer) return { index: 0, total: 0, name: '', lane: '' };
    if (!narrow()) {
      viewer.get('canvas').zoom('fit-viewport', 'auto');
      stepIndex = 0;
      nudgeLabels();
      if (container.clientWidth < 800) viewer.get('canvas').zoom(Math.max(0.2, viewer.get('canvas').zoom() * 0.9));
      return describeStep();
    }
    return showStep(0);
  }

  return {
    setDebt(value) { debt = value; },
    get modo() { return mode; },
    get cambiosPendientes() { return cambiosPendientes; },
    marcarGuardado() { cambiosPendientes = false; },
    async open(xml, options = {}) {
      fileName = options.fileName || '';
      await ensure(options.editable ? 'edit' : 'view');
      currentXml = xml;
      cambiosPendientes = Boolean(options.cambiosPendientes);
      const report = await validateXml(xml, { fileName, debt });
      if (report.importError) {
        onReport?.(report);
        return report;
      }
      await viewer.importXML(xml);
      const step = frameInitial();
      onReport?.({ ...report, step });
      return { ...report, step };
    },
    // `completo: true` encuadra el diagrama entero aunque el lienzo sea estrecho:
    // en pantalla completa el usuario debe ver la forma del proceso de una vez.
    // En móvil (lienzo angosto) no: encoger todo deja las tareas ilegibles y
    // es mejor arrancar en el primer paso, como hace el resto de la app.
    fit(opciones = {}) {
      if (opciones.completo && viewer && !narrow()) {
        viewer.get('canvas').zoom('fit-viewport', 'auto');
        stepIndex = 0;
        nudgeLabels();
        return describeStep();
      }
      return frameInitial();
    },
    recenter() { return showStep(stepIndex); },
    step(delta) { return showStep(stepIndex + delta); },
    zoom(factor) {
      const canvas = viewer?.get('canvas');
      if (!canvas) return;
      const floor = narrow() ? 0.55 : 0.2;
      canvas.zoom(Math.max(floor, Math.min(2.6, canvas.zoom() * factor)));
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
      if (narrow()) viewer.get('canvas').zoom(Math.max(viewer.get('canvas').zoom() || 1, 1.15));
      viewer.get('canvas').scrollToElement(element, { top: 72, right: 28, bottom: 88, left: 28 });
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
