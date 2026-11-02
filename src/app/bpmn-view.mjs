// Vista BPMN del Atlas: catálogo por áreas + lienzo bpmn-js sobre el shell de B.
// Rutas: #/bpmn (catálogo) y #/bpmn/<procesoId> (proceso abierto).
// El motor viene compilado por esbuild en src/bpmn/bpmn-bundle.mjs (ver scripts/build.mjs).

const $ = (selector, scope = document) => scope.querySelector(selector);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);

const ESTADOS = {
  valido: { label: 'Válido', tone: 'ok' },
  borrador: { label: 'Borrador', tone: 'warn' },
  'con-deuda': { label: 'Con deuda', tone: 'bad' },
};

const TIPO = {
  'bpmn:StartEvent': 'Evento de inicio',
  'bpmn:EndEvent': 'Evento de fin',
  'bpmn:IntermediateCatchEvent': 'Evento intermedio',
  'bpmn:Task': 'Tarea',
  'bpmn:UserTask': 'Tarea de usuario',
  'bpmn:ServiceTask': 'Tarea de servicio',
  'bpmn:ExclusiveGateway': 'Compuerta exclusiva',
  'bpmn:ParallelGateway': 'Compuerta paralela',
  'bpmn:InclusiveGateway': 'Compuerta inclusiva',
  'bpmn:SubProcess': 'Subproceso',
};

export function createBpmnView({ root, shell, notify }) {
  const lista = $('[data-bpmn-catalog]', root);
  const lienzo = $('[data-bpmn-canvas]', root);
  const vacio = $('[data-bpmn-empty]', root);
  const titulo = $('[data-bpmn-title]', root);
  const estado = $('[data-bpmn-status]', root);
  const informe = $('[data-bpmn-report]', root);
  const inspector = $('[data-bpmn-inspector]', root);
  const inspectorTitulo = $('[data-bpmn-element-title]', root);
  const inspectorMeta = $('[data-bpmn-element-meta]', root);
  const botonModo = $('[data-bpmn-mode]', root);
  const buscador = $('[data-bpmn-search]', root);

  let catalogo = [];
  let actual = null;
  let workspace = null;
  let editando = false;
  let xmlActual = '';
  let filtro = '';
  let visible = false;

  const avisar = (mensaje) => {
    if (typeof notify === 'function') notify(mensaje);
  };

  async function cargarCatalogo() {
    const respuesta = await fetch('/src/bpmn/seeds/index.json', { cache: 'no-cache' });
    if (!respuesta.ok) throw new Error(`No se pudo leer el catálogo (HTTP ${respuesta.status})`);
    const datos = await respuesta.json();
    catalogo = Array.isArray(datos.procesos) ? datos.procesos : [];
    return catalogo;
  }

  function pintarCatalogo() {
    if (!lista) return;
    const texto = filtro.trim().toLowerCase();
    const visibles = texto
      ? catalogo.filter((proceso) => `${proceso.titulo} ${proceso.area} ${proceso.archivo}`.toLowerCase().includes(texto))
      : catalogo;
    const porArea = new Map();
    for (const proceso of visibles) {
      const grupo = porArea.get(proceso.area) ?? [];
      grupo.push(proceso);
      porArea.set(proceso.area, grupo);
    }
    if (!visibles.length) {
      lista.innerHTML = '<p class="bpmn-empty"><strong>Ningún proceso coincide</strong><span>Prueba con otra palabra.</span></p>';
      return;
    }
    const partes = [];
    for (const [area, procesos] of porArea) {
      partes.push(`<section class="bpmn-area"><h3 class="bpmn-area__title"><span>${esc(area)}</span><span class="bpmn-area__count">${procesos.length}</span></h3><ul class="bpmn-list">`);
      for (const proceso of procesos) {
        const estadoProceso = ESTADOS[proceso.estado] ?? { label: proceso.estado ?? 'Sin estado', tone: 'info' };
        const activo = actual && actual.id === proceso.id ? ' is-active' : '';
        partes.push(
          `<li><button type="button" class="bpmn-card${activo}" data-bpmn-open="${esc(proceso.id)}">`
          + `<span class="bpmn-card__title">${esc(proceso.titulo)}</span>`
          + `<span class="bpmn-card__meta"><span class="bpmn-badge bpmn-badge--${estadoProceso.tone}">${esc(estadoProceso.label)}</span>`
          + `<span class="bpmn-card__file">${esc(proceso.archivo)}</span></span></button></li>`,
        );
      }
      partes.push('</ul></section>');
    }
    lista.innerHTML = partes.join('');
  }

  function pintarInforme(reporte) {
    if (!informe) return;
    const errores = reporte?.errors ?? [];
    const avisos = reporte?.warnings ?? [];
    const deuda = reporte?.debt ?? [];
    if (reporte?.importError) {
      informe.innerHTML = `<strong class="bpmn-report__issue">No se pudo abrir el diagrama</strong><span>${esc(reporte.importError)}</span>`;
      return;
    }
    const partes = [`<span><strong>${errores.length}</strong> errores de lint</span>`, `<span><strong>${avisos.length}</strong> avisos</span>`];
    if (deuda.length) partes.push(`<span class="bpmn-report__warn"><strong>${deuda.length}</strong> deudas de modelado conocidas</span>`);
    for (const issue of [...errores, ...avisos].slice(0, 6)) {
      partes.push(`<span class="${errores.includes(issue) ? 'bpmn-report__issue' : 'bpmn-report__warn'}">${esc(issue.message ?? issue.rule ?? '')}</span>`);
    }
    informe.innerHTML = partes.join('');
  }

  function mostrarElemento(elemento) {
    if (!inspector) return;
    if (!elemento) {
      inspector.hidden = true;
      return;
    }
    inspector.hidden = false;
    inspectorTitulo.textContent = elemento.name || 'Sin nombre';
    inspectorMeta.textContent = `${TIPO[elemento.type] ?? elemento.type ?? 'Elemento'} · ${elemento.incoming ?? 0} entradas · ${elemento.outgoing ?? 0} salidas`;
  }

  async function crearWorkspace() {
    if (workspace) return workspace;
    let modulo;
    try {
      modulo = await import('/src/bpmn/bpmn-bundle.mjs');
    } catch (error) {
      throw new Error('El visor BPMN no está compilado. Ejecuta «npm run build» y vuelve a cargar la página.');
    }
    workspace = modulo.createBpmnWorkspace({
      container: lienzo,
      onReport: pintarInforme,
      onElement: mostrarElemento,
    });
    return workspace;
  }

  async function abrir(procesoId, { editable = false } = {}) {
    const proceso = catalogo.find((item) => item.id === procesoId);
    if (!proceso) {
      avisar('Ese proceso no está en el catálogo.');
      return;
    }
    actual = proceso;
    titulo.textContent = proceso.titulo;
    estado.textContent = `${proceso.area} · ${proceso.archivo}`;
    pintarCatalogo();
    vacio.hidden = true;
    try {
      const respuesta = await fetch(`/src/bpmn/seeds/${proceso.archivo}`, { cache: 'no-cache' });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      xmlActual = await respuesta.text();
      const motor = await crearWorkspace();
      const reporte = await motor.open(xmlActual, { fileName: proceso.archivo, editable });
      pintarInforme(reporte);
      if (reporte?.step) {
        estado.textContent = `${proceso.area} · paso ${reporte.step.index + 1} de ${reporte.step.total} · ${reporte.step.name}`;
      }
    } catch (error) {
      vacio.hidden = false;
      vacio.innerHTML = `<strong>No se pudo abrir el proceso</strong><span>${esc(error.message)}</span>`;
      avisar(`No se pudo abrir ${proceso.titulo}.`);
    }
  }

  async function alternarModo() {
    if (!actual) {
      avisar('Elige un proceso del catálogo primero.');
      return;
    }
    editando = !editando;
    botonModo.textContent = editando ? 'Ver' : 'Editar';
    botonModo.setAttribute('aria-pressed', String(editando));
    if (editando) avisar('Modo edición: los cambios viven solo en esta sesión hasta exportarlos.');
    await abrir(actual.id, { editable: editando });
  }

  async function exportar(tipo) {
    if (!workspace || !actual) {
      avisar('Elige un proceso del catálogo primero.');
      return;
    }
    try {
      if (tipo === 'xml') await workspace.exportXml(`${actual.id}.bpmn`);
      if (tipo === 'svg') await workspace.exportSvg(`${actual.id}.svg`);
      if (tipo === 'png') await workspace.exportPng(`${actual.id}.png`, { footer: 'RR Aliados · Atlas operativo' });
      avisar('Archivo exportado.');
    } catch (error) {
      avisar(error.message);
    }
  }

  function alClic(event) {
    const boton = event.target.closest('[data-bpmn-open]');
    if (boton) {
      const id = boton.dataset.bpmnOpen;
      location.hash = `#/bpmn/${id}`;
      return;
    }
    const accion = event.target.closest('[data-bpmn-accion]');
    if (!accion) return;
    const tipo = accion.dataset.bpmnAccion;
    if (tipo === 'modo') alternarModo();
    if (tipo === 'anterior') workspace?.step(-1);
    if (tipo === 'siguiente') workspace?.step(1);
    if (tipo === 'acercar') workspace?.zoom(1.2);
    if (tipo === 'alejar') workspace?.zoom(0.85);
    if (tipo === 'encuadrar') workspace?.fit();
    if (tipo === 'bpmn') exportar('xml');
    if (tipo === 'svg') exportar('svg');
    if (tipo === 'png') exportar('png');
  }

  root.addEventListener('click', alClic);
  buscador?.addEventListener('input', (event) => {
    filtro = event.target.value ?? '';
    pintarCatalogo();
  });

  async function mostrar(procesoId = '') {
    root.hidden = false;
    visible = true;
    if (shell) shell.hidden = true;
    document.body.classList.add('is-bpmn-view');
    if (!catalogo.length) {
      try {
        await cargarCatalogo();
      } catch (error) {
        vacio.hidden = false;
        vacio.innerHTML = `<strong>No se pudo cargar el catálogo</strong><span>${esc(error.message)}</span>`;
        return;
      }
    }
    pintarCatalogo();
    if (procesoId) await abrir(procesoId, { editable: editando });
    else {
      titulo.textContent = 'Catálogo BPMN';
      estado.textContent = 'Elige un proceso para abrirlo en el lienzo.';
      vacio.hidden = false;
      vacio.innerHTML = '<strong>Selecciona un proceso</strong><span>Las semillas viven en src/bpmn/seeds.</span>';
    }
  }

  function ocultar() {
    if (!visible) return;
    visible = false;
    root.hidden = true;
    if (shell) shell.hidden = false;
    document.body.classList.remove('is-bpmn-view');
    // El mapa vuelve a encajar cuando el shell recupera su tamaño.
    window.dispatchEvent(new Event('resize'));
  }

  return { mostrar, ocultar, get activo() { return Boolean(actual); } };
}
