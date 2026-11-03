/**
 * Estado único del Atlas (v5).
 *
 * El store no copia la base: guarda un **diff** sobre `src/data/base/*.json`
 * (la base versionada en el repo, que solo cambia por PR) más el historial de
 * cambios (tope 100 instantáneas). La persistencia local va a
 * `localStorage` con la clave `rr-atlas:v5`.
 */

import {
  COLECCIONES,
  LIMITE_HISTORIAL,
  ModeloError,
  SCHEMA_VERSION,
  STORAGE_KEY,
  crearModelo,
  diff,
  exportar,
  fusionar,
  importar,
  validar,
} from './model.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Memoria local para pruebas (y para el caso de navegador sin localStorage). */
export function crearMemoria(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => { datos.set(clave, String(valor)); },
    removeItem: (clave) => { datos.delete(clave); },
    get claves() { return [...datos.keys()]; },
  };
}

export function crearStore({ base = {}, storage = null, limiteHistorial = LIMITE_HISTORIAL } = {}) {
  const listeners = new Set();
  const modelo = crearModelo(base);
  const historial = [];
  let exportadoEn = '';

  function materializado() {
    return fusionar({ ...modelo, exportadoEn }).entidades;
  }

  function estado() {
    return {
      schemaVersion: SCHEMA_VERSION,
      entidades: materializado(),
      cambios: clone(modelo.cambios),
      diff: diff(modelo),
      historial: clone(historial),
      exportadoEn,
    };
  }

  function emitir(motivo) {
    const instantanea = estado();
    for (const listener of listeners) listener({ ...instantanea, motivo });
  }

  function persistir() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        exportadoEn,
        cambios: modelo.cambios,
        historial: historial.slice(-limiteHistorial),
      }));
    } catch {
      // Si el almacenamiento falla, la vista avisa; la base sigue siendo usable.
    }
  }

  function cargar() {
    if (!storage) return false;
    try {
      const crudo = storage.getItem(STORAGE_KEY);
      if (!crudo) return false;
      const guardado = JSON.parse(crudo);
      if (guardado?.schemaVersion !== SCHEMA_VERSION) return false;
      exportadoEn = String(guardado.exportadoEn ?? '');
      for (const coleccion of COLECCIONES) {
        const cambios = guardado.cambios?.[coleccion];
        if (!cambios || typeof cambios !== 'object') continue;
        modelo.cambios[coleccion] = clone(cambios);
      }
      if (Array.isArray(guardado.historial)) {
        historial.push(...guardado.historial.slice(-limiteHistorial));
      }
      return true;
    } catch {
      return false;
    }
  }

  function registrar(motivo) {
    historial.push({ motivo, cambios: clone(modelo.cambios), en: new Date().toISOString() });
    if (historial.length > limiteHistorial) historial.splice(0, historial.length - limiteHistorial);
    persistir();
    emitir(motivo);
  }

  return {
    estado,

    suscribir(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Aplica (o reemplaza) una entidad de una colección. */
    aplicar(coleccion, id, campos) {
      if (!COLECCIONES.includes(coleccion)) {
        throw new ModeloError('COLECCION', `La colección «${coleccion}» no existe en el esquema v5.`);
      }
      if (!id || typeof id !== 'string') {
        throw new ModeloError('ID', 'La entidad necesita un id.');
      }
      const anterior = modelo.base[coleccion].find((registro) => registro.id === id);
      const registro = {
        ...(anterior ?? { id, nombre: '', descripcion: '', fuente: 'sin confirmar', corte: 'sin confirmar', estado: 'sin confirmar', etiquetas: [], actualizadoEn: '', coleccion }),
        ...campos,
        id,
        coleccion,
        actualizadoEn: new Date().toISOString(),
      };
      modelo.cambios[coleccion][id] = registro;
      registrar('aplicar');
      return registro;
    },

    /** Quita una entidad (se guarda como null en el diff). */
    quitar(coleccion, id) {
      if (!COLECCIONES.includes(coleccion)) {
        throw new ModeloError('COLECCION', `La colección «${coleccion}» no existe en el esquema v5.`);
      }
      modelo.cambios[coleccion][id] = null;
      registrar('quitar');
    },

    /** Descarta los cambios locales y vuelve a la base del repo. */
    restaurarBase() {
      for (const coleccion of COLECCIONES) modelo.cambios[coleccion] = {};
      historial.length = 0;
      exportadoEn = '';
      persistir();
      emitir('restaurar-base');
    },

    /** Exporta el paquete versionado completo. */
    exportar() {
      return exportar({ ...modelo, exportadoEn });
    },

    /**
     * Importa un paquete. Valida antes de tocar nada y devuelve el diff
     * para que la vista pida confirmación. Es idempotente.
     */
    importar(paquete) {
      const modeloImportado = importar(paquete);
      const resumen = diff(modeloImportado);
      for (const coleccion of COLECCIONES) {
        modelo.cambios[coleccion] = clone(modeloImportado.cambios[coleccion] ?? {});
      }
      exportadoEn = modeloImportado.exportadoEn;
      registrar('importar');
      return resumen;
    },

    /** Valida el estado actual sin tocarlo. */
    validar() {
      return validar({ ...modelo, exportadoEn });
    },

    cargar,
    persistir,
  };
}
