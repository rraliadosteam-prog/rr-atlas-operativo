// Vista Datos del Atlas: el store v5 conectado a la app.
// Ruta: #/datos
//
// Qué hace (mega prompt §2, vista «Datos»):
//   - Muestra la versión del esquema y el resumen de lo que hay en el Atlas.
//   - Exporta todo el modelo a un JSON versionado.
//   - Importa un JSON: valida, muestra el diff y pide confirmación antes de
//     sobrescribir.
//   - «Restaurar base» descarta los cambios locales (con confirmación).
//   - Muestra el historial de cambios y el resultado del validador.
//
// Nada de esto inventa datos: la base es la de `src/data/base/*.json` y cada
// registro lleva su fuente y su corte. El validador rechaza los campos
// prohibidos (salario, cédula, cuenta, token, password).

import { BASE } from '../data/base/index.mjs';
import { crearStore } from '../core/store.mjs';
import { COLECCIONES, SCHEMA_VERSION, diff, importar } from '../core/model.mjs';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);

export const TITULOS_COLECCION = Object.freeze({
  area: 'Áreas',
  rol: 'Roles',
  persona: 'Personas',
  lineaNegocio: 'Líneas de negocio',
  proyecto: 'Proyectos',
  cliente: 'Clientes',
  sistema: 'Sistemas',
  proceso: 'Procesos',
  paso: 'Pasos',
  fragmento: 'Fragmentos',
  tarea: 'Tareas del plan',
});

const TIPOS_DIFF = {
  nuevo: 'entra',
  cambiado: 'se toca',
  quitado: 'sale',
};

/** Conteo por colección de lo que hay materializado (base + cambios). */
export function resumenColecciones(entidades = {}) {
  return COLECCIONES.map((coleccion) => ({
    coleccion,
    titulo: TITULOS_COLECCION[coleccion] ?? coleccion,
    total: (entidades[coleccion] ?? []).length,
  }));
}

/** El diff del modelo como lista legible: qué entra, qué sale y qué se toca. */
export function describirDiff(cambios = []) {
  return cambios.map((cambio) => ({
    coleccion: cambio.coleccion,
    titulo: TITULOS_COLECCION[cambio.coleccion] ?? cambio.coleccion,
    id: cambio.id,
    tipo: cambio.tipo,
    etiqueta: TIPOS_DIFF[cambio.tipo] ?? cambio.tipo,
    campos: Array.isArray(cambio.campos) ? cambio.campos : [],
  }));
}

/** Fuentes y cortes que aparecen en el Atlas (para auditar de dónde sale todo). */
export function resumirFuentes(entidades = {}) {
  const mapa = new Map();
  for (const coleccion of COLECCIONES) {
    for (const registro of entidades[coleccion] ?? []) {
      const fuente = String(registro.fuente ?? '').trim() || 'sin confirmar';
      const corte = String(registro.corte ?? '').trim() || 'sin confirmar';
      const clave = `${fuente} · ${corte}`;
      const actual = mapa.get(clave) ?? { fuente, corte, registros: 0, colecciones: new Set() };
      actual.registros += 1;
      actual.colecciones.add(coleccion);
      mapa.set(clave, actual);
    }
  }
  return [...mapa.values()]
    .map((item) => ({ ...item, colecciones: [...item.colecciones] }))
    .sort((a, b) => b.registros - a.registros);
}

/** Texto corto de un cambio, para las listas de la vista. */
export function textoCambio(cambio) {
  const campos = cambio.campos?.length ? ` · ${cambio.campos.join(', ')}` : '';
  return `${cambio.etiqueta}: ${cambio.titulo} · ${cambio.id}${campos}`;
}

function almacenamientoSeguro() {
  try {
    const storage = window.localStorage;
    const sonda = '__rr_atlas_probe__';
    storage.setItem(sonda, '1');
    storage.removeItem(sonda);
    return storage;
  } catch {
    return null;
  }
}

export function createDatosView({ root, shell, notify } = {}) {
  const store = crearStore({ base: BASE, storage: almacenamientoSeguro() });
  store.cargar();

  const resumen = $('[data-datos-resumen]', root);
  const listaDiff = $('[data-datos-diff]', root);
  const confirmacion = $('[data-datos-confirmacion]', root);
  const cuerpoConfirmacion = $('[data-datos-confirmacion-cuerpo]', root);
  const validacion = $('[data-datos-validacion]', root);
  const historial = $('[data-datos-historial]', root);
  const fuentes = $('[data-datos-fuentes]', root);
  const version = $('[data-datos-version]', root);
  const entradaArchivo = $('[data-datos-archivo]', root);

  let visible = false;
  let paquetePendiente = null;

  const avisar = (mensaje) => {
    if (typeof notify === 'function') notify(mensaje);
  };

  function renderResumen(entidades) {
    if (!resumen) return;
    const filas = resumenColecciones(entidades);
    resumen.innerHTML = filas
      .map((fila) => `<li class="datos__item"><span class="datos__etiqueta">${esc(fila.titulo)}</span><strong class="datos__cifra">${fila.total}</strong></li>`)
      .join('');
  }

  function renderDiff(cambios) {
    if (!listaDiff) return;
    const descritos = describirDiff(cambios);
    if (!descritos.length) {
      listaDiff.innerHTML = '<p class="datos__vacio">No hay cambios locales: el Atlas está en la base del repo.</p>';
      return;
    }
    listaDiff.innerHTML = `<ul class="datos__lista">${descritos
      .map((cambio) => `<li class="datos__linea"><span class="datos__tipo" data-tipo="${esc(cambio.tipo)}">${esc(cambio.etiqueta)}</span> ${esc(textoCambio(cambio))}</li>`)
      .join('')}</ul>`;
  }

  function renderValidacion(reporte) {
    if (!validacion) return;
    if (reporte.ok) {
      validacion.innerHTML = '<p class="datos__ok">El modelo pasa el validador: sin campos prohibidos y con fuente y corte en toda entidad.</p>';
      return;
    }
    validacion.innerHTML = `<p class="datos__mal">El modelo tiene ${reporte.errores.length} problema(s):</p><ul class="datos__lista">${reporte.errores
      .map((error) => `<li class="datos__linea">${esc(error.ruta)} · ${esc(error.mensaje)}</li>`)
      .join('')}</ul>`;
  }

  function renderHistorial(cuantos) {
    if (!historial) return;
    if (!cuantos?.length) {
      historial.innerHTML = '<p class="datos__vacio">Todavía no hay instantáneas en el historial.</p>';
      return;
    }
    historial.innerHTML = `<ul class="datos__lista">${[...cuantos]
      .reverse()
      .slice(0, 20)
      .map((entrada) => `<li class="datos__linea"><span class="datos__tipo">${esc(entrada.motivo ?? 'cambio')}</span> ${esc(entrada.en ?? '')}</li>`)
      .join('')}</ul>`;
  }

  function renderFuentes(entidades) {
    if (!fuentes) return;
    const resumenFuentes = resumirFuentes(entidades);
    fuentes.innerHTML = `<ul class="datos__lista">${resumenFuentes
      .map((item) => `<li class="datos__linea"><strong>${esc(item.fuente)}</strong> · corte ${esc(item.corte)} · ${item.registros} registro(s)</li>`)
      .join('')}</ul>`;
  }

  function render() {
    const estado = store.estado();
    if (version) version.textContent = `Esquema v${SCHEMA_VERSION}`;
    renderResumen(estado.entidades);
    renderDiff(estado.diff);
    renderValidacion(store.validar());
    renderHistorial(estado.historial);
    renderFuentes(estado.entidades);
  }

  store.suscribir(() => render());

  function descargar(nombre, contenido) {
    const blob = new Blob([contenido], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function exportar() {
    const paquete = store.exportar();
    descargar(`rr-atlas-v${SCHEMA_VERSION}.json`, `${JSON.stringify(paquete, null, 2)}\n`);
    avisar('Se exportó el modelo completo del Atlas.');
  }

  function mostrarConfirmacion(paquete, diffPaquete) {
    if (!confirmacion) return;
    const descritos = describirDiff(diffPaquete);
    const resumen = descritos.length
      ? descritos.map((cambio) => `<li class="datos__linea">${esc(textoCambio(cambio))}</li>`).join('')
      : '<li class="datos__linea">El archivo no trae cambios sobre la base.</li>';
    if (cuerpoConfirmacion) {
      cuerpoConfirmacion.innerHTML = `<p>El archivo trae <strong>${descritos.length}</strong> cambio(s) sobre la base. Importarlo reemplaza los cambios locales actuales.</p><ul class="datos__lista">${resumen}</ul>`;
    }
    confirmacion.hidden = false;
    confirmacion.scrollIntoView({ block: 'nearest' });
  }

  async function importarArchivo(archivo) {
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const paquete = JSON.parse(texto);
      const modeloImportado = importar(paquete);
      paquetePendiente = paquete;
      mostrarConfirmacion(paquete, diff(modeloImportado));
    } catch (error) {
      paquetePendiente = null;
      if (confirmacion) confirmacion.hidden = true;
      avisar(`No se pudo leer el archivo: ${error?.message ?? 'formato no válido'}.`);
    }
  }

  function confirmarImportacion() {
    if (!paquetePendiente) return;
    try {
      const resumen = store.importar(paquetePendiente);
      paquetePendiente = null;
      if (confirmacion) confirmacion.hidden = true;
      avisar(`Importación lista: ${resumen.length} cambio(s) sobre la base.`);
    } catch (error) {
      avisar(`No se pudo importar: ${error?.message ?? 'el archivo no es válido'}.`);
    }
  }

  function cancelarImportacion() {
    paquetePendiente = null;
    if (confirmacion) confirmacion.hidden = true;
  }

  function restaurarBase() {
    const respuesta = window.confirm('¿Restaurar la base del repo? Se pierden los cambios locales de este equipo.');
    if (!respuesta) return;
    store.restaurarBase();
    avisar('Se restauró la base del repo.');
  }

  function validarAhora() {
    const reporte = store.validar();
    renderValidacion(reporte);
    avisar(reporte.ok ? 'El modelo pasa el validador.' : `El modelo tiene ${reporte.errores.length} problema(s).`);
  }

  function enlazarAcciones() {
    const acciones = {
      exportar: exportar,
      importar: () => entradaArchivo?.click(),
      restaurar: restaurarBase,
      validar: validarAhora,
      confirmar: confirmarImportacion,
      cancelar: cancelarImportacion,
    };
    for (const boton of $$('[data-datos-accion]', root)) {
      const accion = acciones[boton.dataset.datosAccion];
      if (!accion) continue;
      boton.addEventListener('click', accion);
    }
    entradaArchivo?.addEventListener('change', (evento) => {
      const archivo = evento.target.files?.[0];
      importarArchivo(archivo);
      evento.target.value = '';
    });
  }

  function mostrar() {
    visible = true;
    root.hidden = false;
    if (shell) shell.hidden = true;
    render();
  }

  function ocultar() {
    visible = false;
    root.hidden = true;
    if (shell) shell.hidden = false;
  }

  enlazarAcciones();
  render();

  return {
    mostrar,
    ocultar,
    store,
    get visible() { return visible; },
  };
}
