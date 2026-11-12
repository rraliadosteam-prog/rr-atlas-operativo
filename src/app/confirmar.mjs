// ─────────────────────────────────────────────────────────────────────────
// Un solo <dialog> de confirmación para toda la app (P1.6 · ítem 8a).
//
// Antes había tres `window.confirm` nativos (borrar un nodo, restaurar el
// mapa original y restaurar la base del repo). Bloquean el hilo, rompen el
// tono de la app —que ya usa `<dialog>` propios— y no se pueden estilar con
// los tokens de marca. Aquí hay **un** diálogo (`<dialog data-confirmar>` en
// `index.html`) y **una** función:
//
//   const ok = await confirmar({ titulo, cuerpo, aceptar, cancelar });
//
// Reglas:
//   · Aceptar → `true`.
//   · Cancelar o Escape → `false` (no se hace nada).
//   · Si el shell no trae el diálogo se responde `false`: el patrón nunca
//     vuelve a caer en `window.confirm`.
//
// El módulo no toca el DOM al importarse: el diálogo se busca en la llamada,
// para que las pruebas de Node lo puedan importar sin navegador.
// ─────────────────────────────────────────────────────────────────────────

const SELECTOR_DIALOGO = '[data-confirmar]';

/** El `<dialog data-confirmar>` del shell, o `null` si no está. */
export function dialogoConfirmacion() {
  const doc = globalThis.document;
  if (!doc || typeof doc.querySelector !== 'function') return null;
  return doc.querySelector(SELECTOR_DIALOGO);
}

/**
 * Pide una confirmación al usuario con el diálogo de la app.
 *
 * @param {object} opciones
 * @param {string} [opciones.titulo] Título del diálogo.
 * @param {string} [opciones.cuerpo] Texto de la pregunta.
 * @param {string} [opciones.aceptar]Etiqueta del botón que confirma.
 * @param {string} [opciones.cancelar] Etiqueta del botón que cancela.
 * @returns {Promise<boolean>} `true` si acepta; `false` si cancela, pulsa Escape o no hay diálogo.
 */
export function confirmar({ titulo, cuerpo, aceptar, cancelar } = {}) {
  const dialogo = dialogoConfirmacion();
  if (!dialogo) return Promise.resolve(false);

  const elementos = {
    titulo: dialogo.querySelector('[data-confirmar-titulo]'),
    cuerpo: dialogo.querySelector('[data-confirmar-cuerpo]'),
    aceptar: dialogo.querySelector('[data-confirmar-aceptar]'),
    cancelar: dialogo.querySelector('[data-confirmar-cancelar]'),
  };

  // Solo se pisa el texto si el llamador lo trae: si no, manda el HTML.
  if (titulo !== undefined && elementos.titulo) elementos.titulo.textContent = titulo;
  if (cuerpo !== undefined && elementos.cuerpo) elementos.cuerpo.textContent = cuerpo;
  if (aceptar !== undefined && elementos.aceptar) elementos.aceptar.textContent = aceptar;
  if (cancelar !== undefined && elementos.cancelar) elementos.cancelar.textContent = cancelar;

  return new Promise((resolve) => {
    // Escape cierra el diálogo: la respuesta se resuelve con `respuesta`,
    // que solo pasa a `true` si se pulsó el botón de aceptar.
    let respuesta = false;

    const alAceptar = () => {
      respuesta = true;
      dialogo.close();
    };
    const alCancelar = () => {
      respuesta = false;
      dialogo.close();
    };
    const alCerrar = () => {
      elementos.aceptar?.removeEventListener('click', alAceptar);
      elementos.cancelar?.removeEventListener('click', alCancelar);
      dialogo.removeEventListener('close', alCerrar);
      resolve(respuesta);
    };

    // Si ya había un diálogo abierto (dos confirmaciones encadenadas), se
    // cierra primero: su promesa queda en `false` y este puede abrirse.
    if (dialogo.open) dialogo.close();

    elementos.aceptar?.addEventListener('click', alAceptar);
    elementos.cancelar?.addEventListener('click', alCancelar);
    dialogo.addEventListener('close', alCerrar);

    try {
      dialogo.showModal();
    } catch {
      elementos.aceptar?.removeEventListener('click', alAceptar);
      elementos.cancelar?.removeEventListener('click', alCancelar);
      dialogo.removeEventListener('close', alCerrar);
      resolve(false);
    }
  });
}
