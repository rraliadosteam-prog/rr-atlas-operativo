// Vista BPMN del Atlas: catálogo por áreas + lienzo bpmn-js sobre el shell de B.
// Rutas: #/bpmn (catálogo) y #/bpmn/<procesoId> (proceso abierto).
// El motor viene compilado por esbuild en src/bpmn/bpmn-bundle.mjs (ver scripts/build.mjs).
//
// Item 3 del encargo (BPMN editable en sitio): todo elemento (eventos, tareas,
// compuertas y carriles) se puede editar, crear y guardar; los colores son los de RR.
// Item 4 del encargo: panel por diagrama con qué busca, cómo se lee y la leyenda
// de símbolos y colores (src/bpmn/leyenda.mjs).
// Item 5 del encargo: modo diagrama a pantalla completa: al abrir un BPMN toda
// la página es el diagrama, sin división (y sin scroll en móvil de 360 px).

import { SIMBOLOS, COLORES, COMO_LEER, fichaDeProceso, FUENTE_GUIA, CORTE_GUIA } from '../bpmn/leyenda.mjs';
import { CLIENTES, SERVICIOS, ESTADOS as ESTADOS_INICIO } from '../data/inicio-tarjetas.mjs';

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
  'bpmn:Lane': 'Carril',
  'bpmn:Participant': 'Piscina',
};

// Paleta de colores RR: el valor sale de las variables CSS de B.
const COLOR_RR = [
  { id: '', label: 'Base RR (crema)', variable: '' },
  { id: 'fucsia', label: 'Fucsia · se traba', variable: '--rr-fucsia' },
  { id: 'mostaza', label: 'Mostaza · atención', variable: '--rr-mostaza' },
  { id: 'oruquidea', label: 'Orquídea · carril', variable: '--rr-orquidea' },
  { id: 'gris', label: 'Gris · dato', variable: '--rr-gris' },
];

const CLAVE_LOCAL = 'rr-atlas:bpmn:';

function colorDe(id) {
  if (!id) return '';
  const opcion = COLOR_RR.find((item) => item.id === id);
  if (!opcion?.variable) return '';
  const estilos = getComputedStyle(document.body);
  return (estilos.getPropertyValue(opcion.variable) || '').trim();
}

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
  const formulario = $('[data-bpmn-form]', root);
  const pista = $('[data-bpmn-pista]', root);
  const insignia = $('[data-bpmn-insignia]', root);
  const guia = $('[data-bpmn-guia]', root);
  const guiaTitulo = $('[data-bpmn-guia-titulo]', root);
  const guiaCuerpo = $('[data-bpmn-guia-cuerpo]', root);
  const botonGuia = $('[data-bpmn-accion="guia"]', root);
  const botonPantalla = $('[data-bpmn-accion="pantalla"]', root);
  // Item 6: pantalla dividida opcional. Hay dos botones «▥ Dividir»
  // (cabecera y barra del diagrama): se actualizan juntos.
  const botonesDividir = [...root.querySelectorAll('[data-bpmn-accion="dividir"]')];
  const panelSplit = $('[data-bpmn-split]', root);
  const lienzoSplit = $('[data-bpmn-split-canvas]', root);
  const vacioSplit = $('[data-bpmn-split-vacio]', root);
  const selectorSplit = $('[data-bpmn-split-proceso]', root);
  const esquemaSplit = $('[data-bpmn-esquema]', root);
  const inicioSplit = $('[data-bpmn-inicio]', root);
  const pestanasSplit = [...root.querySelectorAll('[data-bpmn-panel]')];
  // El botón de modo vive en index.html como data-bpmn-accion="modo";
  // el atributo data-bpmn-mode no existe y dejaba el botón sin referencia.
  const botonModo = $('[data-bpmn-accion="modo"]', root);
  const buscador = $('[data-bpmn-search]', root);
  const campos = {
    nombre: $('[data-bpmn-campo="nombre"]', root),
    carril: $('[data-bpmn-campo="carril"]', root),
    color: $('[data-bpmn-campo="color"]', root),
    notas: $('[data-bpmn-campo="notas"]', root),
    fuente: $('[data-bpmn-campo="fuente"]', root),
    corte: $('[data-bpmn-campo="corte"]', root),
  };

  let catalogo = [];
  let actual = null;
  let workspace = null;
  let editando = false;
  let xmlActual = '';
  let origen = 'semilla';
  let seleccion = null;
  let filtro = '';
  let visible = false;
  let guiaAbierta = false;
  let completo = false;
  // Item 6: estado de la pantalla dividida.
  let dividido = false;
  let panelActivo = 'diagrama';
  let secundario = null;
  let procesoSecundario = '';

  const avisar = (mensaje) => {
    if (typeof notify === 'function') notify(mensaje);
  };

  const almacenamiento = (() => {
    try {
      const storage = window.localStorage;
      const probe = '__rr_atlas_bpmn_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch {
      return null;
    }
  })();

  const leerGuardado = (id) => {
    if (!almacenamiento || !id) return '';
    try {
      return almacenamiento.getItem(CLAVE_LOCAL + id) || '';
    } catch {
      return '';
    }
  };

  const escribirGuardado = (id, xml) => {
    if (!almacenamiento || !id) return false;
    try {
      almacenamiento.setItem(CLAVE_LOCAL + id, xml);
      return true;
    } catch {
      return false;
    }
  };

  const borrarGuardado = (id) => {
    if (!almacenamiento || !id) return;
    try {
      almacenamiento.removeItem(CLAVE_LOCAL + id);
    } catch {
      /* sin almacenamiento no hay copia local */
    }
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

  // Panel por diagrama (item 4 del encargo): qué busca el diagrama, cómo se lee
  // y la leyenda de símbolos y colores de la marca RR.
  function pintarGuia() {
    if (!guiaCuerpo) return;
    const ficha = actual ? fichaDeProceso(actual.id) : null;
    const partes = [];
    if (ficha) {
      partes.push(
        '<section class="bpmn-guia__bloque"><h3>Qué busca este diagrama</h3>'
        + `<p>${esc(ficha.objetivo)}</p></section>`,
      );
      partes.push(
        '<section class="bpmn-guia__bloque"><h3>Cómo empieza y qué entrega</h3>'
        + `<dl class="bpmn-guia__datos"><dt>Disparador</dt><dd>${esc(ficha.disparador)}</dd>`
        + `<dt>Resultado</dt><dd>${esc(ficha.resultado)}</dd></dl></section>`,
      );
      if (ficha.pasos?.length) {
        partes.push(
          '<section class="bpmn-guia__bloque"><h3>El camino, paso a paso</h3>'
          + `<ol class="bpmn-guia__pasos">${ficha.pasos.map((paso) => `<li>${esc(paso)}</li>`).join('')}</ol></section>`,
        );
      }
      if (ficha.ojo) {
        partes.push(`<p class="bpmn-guia__ojo"><strong>Para mirar:</strong> ${esc(ficha.ojo)}</p>`);
      }
    }
    partes.push(
      '<section class="bpmn-guia__bloque"><h3>Cómo se lee un diagrama</h3>'
      + `<ol class="bpmn-guia__pasos">${COMO_LEER.map((linea) => `<li>${esc(linea)}</li>`).join('')}</ol></section>`,
    );
    partes.push(
      '<section class="bpmn-guia__bloque"><h3>Leyenda de símbolos</h3><ul class="bpmn-guia__simbolos">'
      + SIMBOLOS.map((simbolo) => (
        '<li>'
        + `<span class="bpmn-guia__glifo" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false">${simbolo.glifo}</svg></span>`
        + `<span class="bpmn-guia__leyenda__texto"><strong>${esc(simbolo.nombre)}</strong><span>${esc(simbolo.descripcion)}</span></span>`
        + '</li>'
      )).join('')
      + '</ul></section>',
    );
    partes.push(
      '<section class="bpmn-guia__bloque"><h3>Leyenda de colores</h3><ul class="bpmn-guia__colores">'
      + COLORES.map((color) => (
        '<li>'
        + `<span class="bpmn-guia__muestra" style="--rr-guia-color: var(${esc(color.variable)})" aria-hidden="true"></span>`
        + `<span class="bpmn-guia__leyenda__texto"><strong>${esc(color.nombre)}</strong><span>${esc(color.uso)}</span></span>`
        + '</li>'
      )).join('')
      + '</ul></section>',
    );
    partes.push(`<p class="bpmn-guia__fuente"><strong>Fuente:</strong> ${esc(FUENTE_GUIA)}<br><strong>Corte:</strong> ${esc(CORTE_GUIA)}</p>`);
    guiaCuerpo.innerHTML = partes.join('');
    if (guiaTitulo) guiaTitulo.textContent = actual ? actual.titulo : 'Qué busca este diagrama';
  }

  function alternarGuia(forzar) {
    guiaAbierta = typeof forzar === 'boolean' ? forzar : !guiaAbierta;
    if (guia) guia.hidden = !guiaAbierta;
    root.classList.toggle('is-guia', guiaAbierta);
    if (botonGuia) {
      botonGuia.setAttribute('aria-pressed', String(guiaAbierta));
      botonGuia.textContent = guiaAbierta ? 'Cerrar guía' : 'Guía del diagrama';
    }
    if (guiaAbierta) {
      pintarGuia();
      // En vertical la guía queda debajo del diagrama: se trae a la vista
      // para que no parezca que no se abrió.
      if (window.matchMedia?.('(max-width: 900px)').matches) {
        guia?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }

  // Item 5 del encargo: modo diagrama a pantalla completa.
  // Al abrir un BPMN la página entera es el diagrama: el catálogo desaparece y
  // el lienzo toma el viewport (en móvil de 360 px ya no hay que hacer scroll).
  function encuadrar() {
    if (!workspace || !actual) return;
    const paso = workspace.fit?.({ completo: completo });
    if (paso?.total) {
      estado.textContent = `${actual.area} · paso ${paso.index + 1} de ${paso.total} · ${paso.name}`;
      if (paso.lane) estado.textContent += ` · ${paso.lane}`;
    }
  }

  function aplicarCompleto(valor) {
    completo = Boolean(valor);
    root.classList.toggle('is-completo', completo);
    document.body.classList.toggle('is-bpmn-completo', completo);
    if (botonPantalla) {
      botonPantalla.setAttribute('aria-pressed', String(completo));
      botonPantalla.textContent = completo ? '⛶ Dividir' : '⛶ Pantalla completa';
      botonPantalla.title = completo
        ? 'Ver el catálogo junto al diagrama'
        : 'Abrir el diagrama a pantalla completa';
    }
    // El lienzo cambia de tamaño: se vuelve a encuadrar el diagrama entero.
    requestAnimationFrame(() => requestAnimationFrame(() => encuadrar()));
  }

  // ---------------------------------------------------------------------
  // Item 6: pantalla dividida opcional.
  // El diagrama se queda en un lado y al otro va uno de tres acompañantes:
  // otro diagrama, el esquema de áreas y procesos, o el Inicio con las
  // tarjetas de cliente y servicio.
  // ---------------------------------------------------------------------

  function pintarProcesosSecundarios() {
    if (!selectorSplit) return;
    const porArea = new Map();
    for (const proceso of catalogo) {
      const grupo = porArea.get(proceso.area) ?? [];
      grupo.push(proceso);
      porArea.set(proceso.area, grupo);
    }
    const partes = [];
    for (const [area, procesos] of porArea) {
      partes.push(`<optgroup label="${esc(area)}">`);
      for (const proceso of procesos) {
        const marca = proceso.id === procesoSecundario ? ' selected' : '';
        partes.push(`<option value="${esc(proceso.id)}"${marca}>${esc(proceso.titulo)}</option>`);
      }
      partes.push('</optgroup>');
    }
    selectorSplit.innerHTML = partes.join('');
  }

  // El segundo diagrama es un visor aparte (solo ver): no toca el lienzo
  // principal ni el informe de lint.
  async function abrirSecundario(procesoId) {
    if (!procesoId || !lienzoSplit) return;
    const proceso = catalogo.find((item) => item.id === procesoId);
    if (!proceso) return;
    procesoSecundario = procesoId;
    pintarProcesosSecundarios();
    if (vacioSplit) vacioSplit.hidden = true;
    try {
      const modulo = await import('/src/bpmn/bpmn-bundle.mjs');
      if (!secundario) {
        secundario = modulo.createBpmnWorkspace({
          container: lienzoSplit,
          onReport: () => {},
          onElement: () => {},
          onChange: () => {},
        });
      }
      const respuesta = await fetch(`/src/bpmn/seeds/${proceso.archivo}`, { cache: 'no-cache' });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const semilla = await respuesta.text();
      const guardado = leerGuardado(proceso.id);
      await secundario.open(guardado || semilla, { fileName: proceso.archivo, editable: false });
      // El visor de al lado muestra el proceso entero, aunque sea pequeño.
      requestAnimationFrame(() => secundario?.fit?.({ completo: true, forzar: true }));
    } catch (error) {
      if (vacioSplit) {
        vacioSplit.hidden = false;
        vacioSplit.textContent = `No se pudo abrir este proceso: ${error.message}`;
      }
    }
  }

  // El esquema: un mapa de las áreas del Atlas con sus procesos.
  function pintarEsquema() {
    if (!esquemaSplit) return;
    const porArea = new Map();
    for (const proceso of catalogo) {
      const grupo = porArea.get(proceso.area) ?? [];
      grupo.push(proceso);
      porArea.set(proceso.area, grupo);
    }
    const partes = [
      '<p class="bpmn-esquema__intro">Cada columna es un área del Atlas. Toca un proceso para abrirlo en el diagrama.</p>',
      '<div class="bpmn-esquema__areas">',
    ];
    for (const [area, procesos] of porArea) {
      const chips = procesos.map((proceso) => {
        const activo = actual && actual.id === proceso.id ? ' is-active' : '';
        const estado = ESTADOS[proceso.estado] ?? { label: proceso.estado ?? 'Sin estado', tone: 'info' };
        return `<button type="button" class="bpmn-esquema__chip${activo}" data-bpmn-esquema-proceso="${esc(proceso.id)}">`
          + `<span class="bpmn-esquema__chip-titulo">${esc(proceso.titulo)}</span>`
          + `<span class="bpmn-badge bpmn-badge--${estado.tone}">${esc(estado.label)}</span>`
          + '</button>';
      }).join('');
      partes.push(`<section class="bpmn-esquema__area"><h3>${esc(area)}<span>${procesos.length}</span></h3>${chips}</section>`);
    }
    partes.push('</div>');
    esquemaSplit.innerHTML = partes.join('');
  }

  // El Inicio del Atlas: tarjetas de cliente y de servicio (solo nombre,
  // estado y nota; con su fuente y su corte). Nunca cifras ni datos personales.
  function pintarInicio() {
    if (!inicioSplit) return;
    const tarjeta = (item) => {
      const estado = ESTADOS_INICIO[item.estado] ?? { label: item.estado ?? 'Sin estado', tone: 'info' };
      return `<article class="bpmn-tarjeta" title="Fuente: ${esc(item.fuente)} · corte ${esc(item.corte)}">`
        + `<strong class="bpmn-tarjeta__nombre">${esc(item.nombre)}</strong>`
        + `<span class="bpmn-badge bpmn-badge--${estado.tone}">${esc(estado.label)}</span>`
        + `<span class="bpmn-tarjeta__nota">${esc(item.nota)}</span>`
        + `<span class="bpmn-tarjeta__fuente">${esc(item.fuente)} · ${esc(item.corte)}</span>`
        + '</article>';
    };
    inicioSplit.innerHTML = [
      '<section class="bpmn-inicio__grupo"><h3>Clientes</h3><div class="bpmn-inicio__tarjetas">',
      CLIENTES.map(tarjeta).join(''),
      '</div></section>',
      '<section class="bpmn-inicio__grupo"><h3>Servicios</h3><div class="bpmn-inicio__tarjetas">',
      SERVICIOS.map(tarjeta).join(''),
      '</div></section>',
      '<p class="bpmn-inicio__nota">Los estados salen del inventario de RR; lo que no está confirmado aparece como «Sin confirmar». Sin cifras ni datos de personas.</p>',
    ].join('');
  }

  function activarPanel(nombre, { recargar = true } = {}) {
    panelActivo = nombre;
    for (const pestana of pestanasSplit) {
      pestana.setAttribute('aria-selected', String(pestana.dataset.bpmnPanel === nombre));
    }
    for (const pane of root.querySelectorAll('[data-bpmn-pane]')) {
      pane.hidden = pane.dataset.bpmnPane !== nombre;
    }
    if (nombre === 'esquema') pintarEsquema();
    if (nombre === 'inicio') pintarInicio();
    if (nombre === 'diagrama') {
      // El lienzo del visor cambia de tamaño al mostrarse: se vuelve a abrir
      // para que el diagrama quede bien encuadrado.
      if (recargar) abrirSecundario(procesoSecundario);
      else requestAnimationFrame(() => secundario?.fit?.({ completo: true, forzar: true }));
    }
  }

  function aplicarDividido(valor) {
    dividido = Boolean(valor);
    root.classList.toggle('is-dividido', dividido);
    document.body.classList.toggle('is-bpmn-dividido', dividido);
    if (panelSplit) panelSplit.hidden = !dividido;
    for (const boton of botonesDividir) {
      boton.setAttribute('aria-pressed', String(dividido));
      boton.textContent = dividido ? '▥ Unir' : '▥ Dividir';
      boton.title = dividido
        ? 'Volver a un solo diagrama en la pantalla'
        : 'Dividir la pantalla: diagrama y panel al lado';
    }
    if (dividido) {
      pintarProcesosSecundarios();
      const otro = catalogo.find((item) => !actual || item.id !== actual.id) || catalogo[0];
      activarPanel(panelActivo, { recargar: false });
      if (procesoSecundario) abrirSecundario(procesoSecundario);
      else if (otro) abrirSecundario(otro.id);
    }
    // El lienzo principal cambia de ancho: se vuelve a encuadrar.
    requestAnimationFrame(() => requestAnimationFrame(() => encuadrar()));
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

  // Insignia de estado de la copia local: semilla, copia guardada o cambios sin guardar.
  function pintarInsignia() {
    if (!insignia) return;
    let texto = 'Semilla';
    let tono = 'info';
    if (origen === 'local') {
      texto = 'Copia local';
      tono = 'ok';
    }
    if (workspace?.cambiosPendientes) {
      texto = 'Cambios sin guardar';
      tono = 'warn';
    }
    insignia.textContent = texto;
    insignia.className = `bpmn-badge bpmn-badge--${tono}`;
  }

  function pintarCarriles(carriles, elegido = '') {
    if (!campos.carril) return;
    const opciones = ['<option value="">Sin carril</option>'];
    for (const carril of carriles || []) {
      const marca = carril.id === elegido ? ' selected' : '';
      opciones.push(`<option value="${esc(carril.id)}"${marca}>${esc(carril.name)}</option>`);
    }
    campos.carril.innerHTML = opciones.join('');
  }

  function pintarColores(elegido = '') {
    if (!campos.color) return;
    const opciones = COLOR_RR.map((item) => {
      const valor = colorDe(item.id);
      const marca = valor && valor.toLowerCase() === String(elegido || '').toLowerCase() ? ' selected' : '';
      const muestra = valor ? ` style="--rr-muestra:${valor}"` : '';
      return `<option value="${esc(valor)}"${marca}${muestra}>${esc(item.label)}</option>`;
    });
    campos.color.innerHTML = opciones.join('');
  }

  function mostrarElemento(elemento) {
    if (!inspector) return;
    if (!elemento) {
      inspector.hidden = true;
      seleccion = null;
      return;
    }
    seleccion = elemento;
    inspector.hidden = false;
    inspectorTitulo.textContent = elemento.name || 'Sin nombre';
    const tipo = TIPO[elemento.type] ?? elemento.type ?? 'Elemento';
    inspectorMeta.textContent = `${tipo} · ${elemento.incoming ?? 0} entradas · ${elemento.outgoing ?? 0} salidas`;
    const separacion = separarNotas(elemento.documentation || '');
    if (campos.nombre) campos.nombre.value = elemento.name || '';
    if (campos.notas) campos.notas.value = separacion.notas;
    if (campos.fuente) campos.fuente.value = separacion.fuente;
    if (campos.corte) campos.corte.value = separacion.corte;
    pintarColores(elemento.color || '');
    pintarCarriles(workspace?.carriles?.() || [], elemento.laneId || '');
    const editable = Boolean(workspace && workspace.modo === 'edit');
    if (formulario) formulario.hidden = false;
    if (pista) {
      pista.textContent = editable
        ? 'Los cambios se guardan en este navegador con «Guardar».'
        : 'Activa «Editar» para modificar este elemento.';
    }
    if (formulario) {
      for (const control of formulario.querySelectorAll('input, textarea, select, button')) {
        if (control.dataset.bpmnAccion === 'modo') continue;
        control.disabled = !editable;
      }
    }
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
      onChange: () => {
        pintarInsignia();
        if (seleccion) {
          const refreshed = workspace.elemento(seleccion.id);
          if (refreshed) mostrarElemento(refreshed);
        }
      },
    });
    // Gancho de depuración: permite auditar el diagrama desde la consola.
    window.__rrAtlasBpmn = workspace;
    return workspace;
  }

  async function abrir(procesoId, { editable = false, xml = '' } = {}) {
    const proceso = catalogo.find((item) => item.id === procesoId);
    if (!proceso) {
      avisar('Ese proceso no está en el catálogo.');
      return;
    }
    actual = proceso;
    titulo.textContent = proceso.titulo;
    estado.textContent = `${proceso.area} · ${proceso.archivo}`;
    pintarCatalogo();
    repintarEsquema();
    vacio.hidden = true;
    try {
      let contenido = xml;
      if (!contenido) {
        const respuesta = await fetch(`/src/bpmn/seeds/${proceso.archivo}`, { cache: 'no-cache' });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const semilla = await respuesta.text();
        const guardado = leerGuardado(proceso.id);
        contenido = guardado || semilla;
        origen = guardado ? 'local' : 'semilla';
      } else {
        origen = 'sesion';
      }
      xmlActual = contenido;
      const motor = await crearWorkspace();
      const reporte = await motor.open(xmlActual, {
        fileName: proceso.archivo,
        editable,
        cambiosPendientes: origen !== 'semilla',
      });
      pintarInforme(reporte);
      pintarInsignia();
      if (completo) encuadrar();
      if (reporte?.step) {
        estado.textContent = `${proceso.area} · paso ${reporte.step.index + 1} de ${reporte.step.total} · ${reporte.step.name}`;
      }
      if (seleccion) {
        const refreshed = motor.elemento(seleccion.id);
        if (refreshed) mostrarElemento(refreshed);
      }
      if (guiaAbierta) pintarGuia();
    } catch (error) {
      vacio.hidden = false;
      vacio.innerHTML = `<strong>No se pudo abrir el proceso</strong><span>${esc(error.message)}</span>`;
      avisar(`No se pudo abrir ${proceso.titulo}.`);
    }
  }

  // El recorrido por el flujo actualiza el rótulo con el paso actual:
  // antes el diagrama avanzaba pero la interfaz se quedaba en «paso 1 de 11».
  function avanzar(delta) {
    if (!workspace || !actual) {
      avisar('Elige un proceso del catálogo primero.');
      return;
    }
    const paso = workspace.step(delta);
    if (!paso) return;
    estado.textContent = `${actual.area} · paso ${paso.index + 1} de ${paso.total} · ${paso.name}`;
    if (paso.lane) estado.textContent += ` · ${paso.lane}`;
  }

  async function alternarModo() {
    if (!actual) {
      avisar('Elige un proceso del catálogo primero.');
      return;
    }
    // Antes de cambiar de modo se conserva el XML vivo para no perder lo editado.
    let xml = '';
    try {
      xml = await workspace?.xml?.() || '';
    } catch {
      xml = xmlActual;
    }
    editando = !editando;
    botonModo.textContent = editando ? 'Ver' : 'Editar';
    botonModo.setAttribute('aria-pressed', String(editando));
    if (editando) avisar('Modo edición: cambia lo que quieras y guarda la copia en este navegador.');
    await abrir(actual.id, { editable: editando, xml });
    if (seleccion) {
      const refreshed = workspace?.elemento(seleccion.id);
      if (refreshed) mostrarElemento(refreshed);
    }
  }

  function refrescarSeleccion() {
    if (!seleccion || !workspace) return;
    const refreshed = workspace.elemento(seleccion.id);
    if (refreshed) mostrarElemento(refreshed);
  }

  function aplicarFormulario() {
    if (!workspace || !seleccion) {
      avisar('Primero haz clic en un elemento del diagrama.');
      return;
    }
    if (workspace.modo !== 'edit') {
      avisar('Activa «Editar» para modificar el diagrama.');
      return;
    }
    try {
      const colorValor = campos.color?.value || '';
      const colorId = COLOR_RR.find((item) => colorDe(item.id).toLowerCase() === colorValor.toLowerCase())?.id ?? '';
      const actualizado = workspace.actualizar(seleccion.id, {
        nombre: campos.nombre?.value ?? '',
        notas: campos.notas?.value ?? '',
        fuente: campos.fuente?.value ?? '',
        corte: campos.corte?.value ?? '',
        color: colorValor,
        carrilId: campos.carril?.value ?? '',
      });
      if (actualizado) mostrarElemento(actualizado);
      pintarInsignia();
      avisar('Cambio aplicado al diagrama.');
    } catch (error) {
      avisar(error.message);
    }
  }

  function agregar(tipo) {
    if (!workspace || !actual) {
      avisar('Elige un proceso del catálogo primero.');
      return;
    }
    if (workspace.modo !== 'edit') {
      avisar('Activa «Editar» para agregar elementos.');
      return;
    }
    try {
      const creado = workspace.crear(tipo, { carrilId: seleccion?.laneId || '' });
      if (creado) {
        mostrarElemento(creado);
        workspace.focus?.(creado.id);
      }
      pintarInsignia();
      avisar('Elemento agregado al diagrama.');
    } catch (error) {
      avisar(error.message);
    }
  }

  function eliminarSeleccion() {
    if (!workspace || !seleccion) {
      avisar('Primero haz clic en un elemento del diagrama.');
      return;
    }
    try {
      workspace.eliminar(seleccion.id);
      seleccion = null;
      if (inspector) inspector.hidden = true;
      pintarInsignia();
      avisar('Elemento eliminado del diagrama.');
    } catch (error) {
      avisar(error.message);
    }
  }

  async function guardar() {
    if (!workspace || !actual) {
      avisar('Elige un proceso del catálogo primero.');
      return;
    }
    try {
      const xml = await workspace.xml();
      if (!escribirGuardado(actual.id, xml)) {
        avisar('Este navegador no dejó guardar la copia local.');
        return;
      }
      origen = 'local';
      workspace.marcarGuardado?.();
      pintarInsignia();
      avisar('Copia guardada en este navegador.');
    } catch (error) {
      avisar(error.message);
    }
  }

  async function restaurarSemilla() {
    if (!actual) return;
    borrarGuardado(actual.id);
    origen = 'semilla';
    await abrir(actual.id, { editable: editando });
    avisar('Se restauró la semilla del proceso.');
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
    const pestana = event.target.closest('[data-bpmn-panel]');
    if (pestana) {
      activarPanel(pestana.dataset.bpmnPanel);
      return;
    }
    const chip = event.target.closest('[data-bpmn-esquema-proceso]');
    if (chip) {
      // Desde el esquema se abre el proceso en el diagrama principal.
      location.hash = `#/bpmn/${chip.dataset.bpmnEsquemaProceso}`;
      return;
    }
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
    if (tipo === 'anterior') avanzar(-1);
    if (tipo === 'siguiente') avanzar(1);
    if (tipo === 'acercar') workspace?.zoom(1.2);
    if (tipo === 'alejar') workspace?.zoom(0.85);
    if (tipo === 'encuadrar') workspace?.fit();
    if (tipo === 'guia') alternarGuia();
    if (tipo === 'cerrar-guia') alternarGuia(false);
    if (tipo === 'pantalla') {
      aplicarCompleto(!completo);
      avisar(completo ? 'Diagrama a pantalla completa.' : 'Catálogo y diagrama a la vez.');
    }
    if (tipo === 'dividir') {
      aplicarDividido(!dividido);
      avisar(dividido
        ? 'Pantalla dividida: el diagrama queda con el panel al lado.'
        : 'Vuelve el diagrama a ocupar toda la pantalla.');
      return;
    }
    if (tipo === 'cerrar-split') {
      aplicarDividido(false);
      avisar('Se cerró el panel dividido.');
      return;
    }
    if (tipo === 'bpmn') exportar('xml');
    if (tipo === 'svg') exportar('svg');
    if (tipo === 'png') exportar('png');
    if (tipo === 'aplicar') aplicarFormulario();
    if (tipo === 'eliminar') eliminarSeleccion();
    if (tipo === 'deshacer') {
      if (workspace?.deshacer?.()) {
        refrescarSeleccion();
        pintarInsignia();
        avisar('Se deshizo el último cambio.');
      }
    }
    if (tipo === 'rehacer') {
      if (workspace?.rehacer?.()) {
        refrescarSeleccion();
        pintarInsignia();
        avisar('Se rehizo el cambio.');
      }
    }
    if (tipo === 'guardar') guardar();
    if (tipo === 'restaurar') restaurarSemilla();
    if (tipo === 'agregar-tarea') agregar('tarea');
    if (tipo === 'agregar-tarea-usuario') agregar('tarea-usuario');
    if (tipo === 'agregar-compuerta') agregar('compuerta');
    if (tipo === 'agregar-evento') agregar('evento');
    if (tipo === 'agregar-evento-fin') agregar('evento-fin');
    if (tipo === 'agregar-carril') agregar('carril');
  }

  root.addEventListener('click', alClic);
  buscador?.addEventListener('input', (event) => {
    filtro = event.target.value ?? '';
    pintarCatalogo();
  });
  selectorSplit?.addEventListener('change', (event) => {
    abrirSecundario(event.target.value);
  });

  // Al cambiar de proceso, el esquema se repinta para marcar el nuevo actual.
  const repintarEsquema = () => {
    if (dividido && panelActivo === 'esquema') pintarEsquema();
  };

  // El visor del segundo diagrama no se redimensiona solo: al cambiar el
  // tamaño de la ventana hay que volver a encajarlo.
  let temporizadorResize = 0;
  window.addEventListener('resize', () => {
    if (!dividido) return;
    window.clearTimeout(temporizadorResize);
    temporizadorResize = window.setTimeout(() => {
      secundario?.fit?.({ completo: true, forzar: true });
    }, 250);
  });

  // Atajos de la vista BPMN: P alterna la pantalla completa, F encuadra,
  // Esc cierra la guía o sale de la pantalla completa y Ctrl/Cmd+Z deshace
  // (el mismo atajo que el mapa, pero del diagrama).
  document.addEventListener('keydown', (event) => {
    if (!visible) return;
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    const modifier = event.metaKey || event.ctrlKey;
    const tecla = event.key.toLowerCase();
    if (!modifier && tecla === 'p') {
      event.preventDefault();
      aplicarCompleto(!completo);
      avisar(completo ? 'Diagrama a pantalla completa.' : 'Catálogo y diagrama a la vez.');
      return;
    }
    if (!modifier && tecla === 'f' && workspace) {
      event.preventDefault();
      encuadrar();
      return;
    }
    if (!modifier && tecla === 'd') {
      event.preventDefault();
      aplicarDividido(!dividido);
      avisar(dividido
        ? 'Pantalla dividida: el diagrama queda con el panel al lado.'
        : 'Vuelve el diagrama a ocupar toda la pantalla.');
      return;
    }
    if (!modifier && event.key === 'Escape') {
      if (guiaAbierta) {
        event.preventDefault();
        alternarGuia(false);
        return;
      }
      if (completo) {
        event.preventDefault();
        aplicarCompleto(false);
        avisar('Catálogo y diagrama a la vez.');
        return;
      }
    }
    if (!workspace) return;
    if (!modifier || tecla !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) {
      if (workspace.rehacer?.()) {
        refrescarSeleccion();
        pintarInsignia();
      }
    } else if (workspace.deshacer?.()) {
      refrescarSeleccion();
      pintarInsignia();
    }
  });

  async function mostrar(procesoId = '') {
    root.hidden = false;
    visible = true;
    if (shell) shell.hidden = true;
    document.body.classList.add('is-bpmn-view');
    // Abrir un BPMN = diagrama a pantalla completa; el catálogo es la vista
    // partida (se vuelve con «☰ Procesos» o con el botón ⛶).
    aplicarCompleto(Boolean(procesoId));
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
    document.body.classList.remove('is-bpmn-completo');
    document.body.classList.remove('is-bpmn-dividido');
    root.classList.remove('is-completo');
    if (dividido) aplicarDividido(false);
    // El mapa vuelve a encajar cuando el shell recupera su tamaño.
    window.dispatchEvent(new Event('resize'));
  }

  return {
    mostrar,
    ocultar,
    get activo() { return Boolean(actual); },
    get visible() { return visible; },
    get completo() { return completo; },
    get dividido() { return dividido; },
  };
}
