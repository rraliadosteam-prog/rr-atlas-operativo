# Atlas Operativo RR — Auditoría UX/UI y prompt maestro

> Para agentes: ejecutar las tareas en orden y verificar cada una en navegador real antes de avanzar.

**Objetivo:** Llevar el Atlas de una interfaz funcional pero densa a una herramienta operativa clara, navegable y profesional, conservando la identidad B.U.C.M., los datos, la compatibilidad JSON y el BPMN 2.0.

**Arquitectura:** Se conserva el frontend modular JavaScript que hoy despliega Vercel. El mapa, el estado local y el visor BPMN permanecen separados; la mejora se concentra primero en jerarquía de controles, navegación, zoom, panel de detalle, accesibilidad y verificación visual. Rust queda como arquitectura prevista y no se activa hasta demostrar paridad funcional.

**Tech Stack:** HTML semántico, módulos ES, CSS propio con tokens B.U.C.M., `bpmn-js`, `bpmn-moddle`, `bpmnlint`, `esbuild`, Playwright para auditoría visual y pruebas Node.

**Spec:** `/home/deadkiss/Descargas/Atlas Operativo RR — Auditoría UX UI y prompt maestro.md`, `docs/AUDITORIA_RR_ATLAS.md`, `design/PRODUCT.md` y `design/DESIGN.md`.

## Restricciones globales

- Conservar negro, magenta `#be076d`, amarillo `#ded116`, orquídea `#973d8f`, tipografía y logos de `src/brand`.
- Conservar los datos y la importación/exportación JSON; cualquier cambio de esquema debe versionarse y migrarse.
- Conservar BPMN 2.0, carriles, eventos, tareas, compuertas y flujos.
- Mantener `DESCONOCIDO` cuando la fuente no declara dueño, KPI, fecha o línea base.
- No publicar cambios ni alterar la protección de producción sin una instrucción humana separada.
- Verificar el CSS cargado antes de confiar en mediciones de layout.
- No declarar una mejora visual sin prueba de navegador en escritorio y móvil.

## Línea base medida

- Repositorio y producción ya comparten el código v4.1 en `main` `0d6072e`; la auditoría adjunta que señalaba un repo v3.0 quedó superada por la integración BPMN.
- Línea base JavaScript: `npm run check` pasa; 30 pruebas pasan y el validador reconoce 16 semillas BPMN con 0 errores fuera de la deuda documentada.
- Auditoría visual mecánica: 0 solapes, 0 etiquetas sobre formas, 0 textos desbordados, 0 palabras partidas, 0 problemas de presión y sin overflow horizontal en 360, 390, 430 y 1440 px.
- Medición DOM en navegador a 780 px: 55 tarjetas del mapa y 152 controles visibles porque el editor lateral y todas las tarjetas tienen peso de control; es un recuento de ruido bruto, no un objetivo final.
- Vista BPMN: 16 procesos cargados, 13 controles de barra visibles en el estado de diagrama y paneles con scroll anidado; la columna de navegación queda demasiado estrecha.
- Diagnóstico visual: la marca, la tarjeta seleccionada y el título del proceso compiten con la navegación y el pie; el lienzo BPMN no domina la lectura.

## Tesis espacial

- Ruta primaria del mapa: explorar -> enfocar -> seleccionar -> consultar/editar.
- Ruta primaria de procesos: elegir proceso -> leer diagrama -> validar -> abrir detalle si hace falta -> exportar.
- El lienzo es el protagonista; rail, lista y detalle son superficies colapsables.
- Siempre visibles: búsqueda, cambio de sección, zoom/reencuadre, una acción primaria y un menú Más.
- Acciones secundarias: deshacer, rehacer, dibujar, conectar, flujo y preferencias dentro de Más o Configuración.
- El detalle abre al seleccionar y se cierra sin perder el encuadre.
- El BPMN tiene zoom y navegación propios, separados del mapa.

## Review Focus

- Un usuario nuevo debe encontrar crear nodo y abrir procesos sin instrucciones.
- El detalle no debe ocupar 340 px por defecto ni tapar el lienzo móvil.
- Un gesto de rueda o trackpad debe producir un zoom proporcional y anclado al puntero.
- Dos dedos deben hacer pinch-zoom en el mapa y en BPMN sin dejar el estado atascado.
- Las tarjetas deben ser HTML válido, enfocables con teclado y activar selección con Enter o Espacio.
- Los controles del BPMN no pueden quedar truncados en 390 px.
- Exportar, importar, restaurar, tema y minimapa deben seguir funcionando después de ocultar acciones.
- Una fuente o KPI ausente debe seguir apareciendo como `DESCONOCIDO`.

---

### Tarea 0: Línea base e higiene

**Archivos:**
- Modificar: `docs/superpowers/plans/2026-10-22-atlas-auditoria-ux-ui-master.md`
- Evidencia: `/home/deadkiss/.hermes/cache/scratch/atlas-baseline-audit/report.json`

- [x] Medir el árbol remoto, la versión desplegable, los controles visibles, los procesos y el CSS cargado.
- [x] Ejecutar `npm run check` y `npm run audit:visual` antes de editar.
- [x] Capturar el estado BPMN en navegador real.

### Tarea 1: Jerarquía de controles y divulgación progresiva

**Archivos:**
- Modificar: `index.html`
- Modificar: `src/app/main.mjs`
- Modificar: `src/ui/atlas-events.mjs`
- Modificar: `src/ui/atlas-nav.mjs`
- Modificar: `src/styles/layout.css`
- Modificar: `src/styles/components.css`
- Test: `scripts/audit-visual.mjs` y prueba de navegador manual

- [x] Reducir el toolbar permanente a zoom menos, zoom más, reencuadrar, Nuevo nodo y Más.
- [x] Mover deshacer, rehacer, dibujar, conectar, flujo y preferencias a superficies secundarias sin perder acceso por teclado.
- [x] Mantener una sola búsqueda operativa; el acceso inferior debe enfocar la búsqueda existente, no duplicar un campo.
- [x] Hacer que el panel de detalle esté cerrado por defecto en escritorio y abra al seleccionar.
- [x] Añadir encabezado de detalle y cierre explícito para escritorio y móvil.
- [x] Mantener `Restaurar base` detrás de confirmación fuerte y exportación previa.
- [x] Añadir estados aria para Más, Configuración, Detalle, menú lateral y paneles ocultos.

### Tarea 2: Navegación y zoom del mapa

**Archivos:**
- Modificar: `src/ui/atlas-view.mjs`
- Modificar: `src/ui/atlas-events.mjs`
- Modificar: `src/styles/tokens.css`
- Test: `src/ui/overlap.test.mjs` y prueba de navegador

- [x] Normalizar `deltaY` de rueda y anclar el zoom al puntero.
- [x] Anclar los botones de zoom al centro visible y animar 150-250 ms con reducción de movimiento.
- [x] Mantener pinch real y limpiar punteros en `pointercancel`, `blur` y `visibilitychange`; la prueba emulada queda en Tarea 6.
- [x] Implementar atajos `+`, `-`, `0`, `1`, `F` y flechas sin interferir con inputs.
- [x] Calcular `fit` con las cajas reales de los nodos visibles, no con valores fijos.
- [x] Enfocar la cámara al elegir una categoría y resaltar las conexiones del contexto seleccionado.
- [x] Mostrar un indicador textual de zoom en el estado, sin ocupar otra barra permanente.
- [x] Dibujar las conexiones usando el tamaño renderizado de las tarjetas cuando sea posible.

### Tarea 3: BPMN interactivo y legible

**Archivos:**
- Modificar: `index.html`
- Modificar: `src/ui/atlas-process-view.mjs`
- Modificar: `src/bpmn/entry.mjs`
- Modificar: `src/styles/layout.css`
- Modificar: `src/styles/components.css`
- Test: `src/core/process-model.test.mjs`, `scripts/validate-bpmn.mjs` y navegador real

- [x] Hacer que la barra BPMN tenga una acción primaria clara y un menú secundario coherente.
- [x] Dar más espacio al lienzo; la lista y el panel de metadatos deben colapsarse sin perder contexto.
- [x] Mantener zoom, pan, pinch, reencuadre y recorrido independientes del mapa general.
- [x] Verificar selección de elementos BPMN y enfocar el elemento correspondiente desde la validación.
- [x] Añadir búsqueda dentro del proceso si el flujo actual no la expone.
- [x] Mantener modo lectura por defecto y edición explícita, con exportaciones BPMN, SVG y PNG.
- [x] Preservar carriles, símbolos, validación en vivo y `DESCONOCIDO`.

### Tarea 4: HTML válido, foco y edición segura

**Archivos:**
- Modificar: `src/ui/atlas-view.mjs`
- Modificar: `src/ui/atlas-events.mjs`
- Modificar: `src/ui/atlas-process-view.mjs`
- Modificar: `index.html`
- Modificar: `src/styles/components.css`
- Test: navegador con teclado y diálogos

- [x] Renderizar las tarjetas como elementos semánticos enfocables, no como botones que contienen encabezados y párrafos.
- [x] Activar selección con Enter y Espacio, anunciar selección y cambios con `aria-live`.
- [x] Mantener foco al abrir/cerrar detalle, configuración, visor multimedia y diálogo BPMN.
- [x] Sustituir confirmaciones destructivas nativas por un diálogo propio reutilizable con cancelar, confirmar y exportar antes de restaurar.
- [x] Evitar pérdida silenciosa de texto al cambiar de nodo; marcar edición pendiente o guardar automáticamente por evento.

### Tarea 5: Datos, seguridad y fuente compartida

**Archivos:**
- Documentar: `docs/superpowers/plans/2026-10-22-atlas-auditoria-ux-ui-master.md`
- Pendiente de decisión humana: protección de Vercel, fuente autenticada y retiro de datos reales del repo público.

- [ ] Inventariar nodos duplicados y categorías fuera del rail.
- [ ] Separar fechas, montos, responsables y estados de las descripciones libres.
- [ ] Definir la fuente compartida autenticada sin cambiarla por intuición.
- [ ] No publicar esta fase hasta que Dirección decida sobre datos reales y acceso público.

### Tarea 6: Verificación final y entrega

**Archivos:**
- Modificar: `docs/superpowers/plans/2026-10-22-atlas-auditoria-ux-ui-master.md`
- Ejecutar: `npm run check`
- Ejecutar: `CHROME_PATH=/usr/bin/google-chrome ATLAS_AUDIT_URL=http://127.0.0.1:<puerto>/ npm run audit:visual`
- Ejecutar: `cargo test --workspace`

- [x] Verificar CSS cargado antes de cada medición.
- [x] Verificar 360x800, 390x844, 430x932, 768x900, 1024x768 y 1440x900.
- [x] Verificar búsqueda, filtros, selección, detalle, configuración, minimapa, deshacer, exportación e importación.
- [ ] Verificar mapa y BPMN con teclado, puntero, rueda y pinch emulado.
- [x] Confirmar `scrollWidth <= innerWidth` y ningún control truncado; la navegación visual queda sin hallazgos mecánicos.
- [x] Documentar evidencia, pendientes de seguridad y el commit que se proponga promover.

## Evidencia de la ronda aplicada

- `npm run check`: 30 pruebas pasan; build modular correcto; 16 semillas BPMN válidas; 0 errores fuera de la deuda de modelado conocida.
- `npm run audit:visual`: 360x800, 390x844, 430x932, 768x900, 1024x768 y 1440x900; 0 solapes, 0 etiquetas sobre formas, 0 textos desbordados, 0 palabras partidas, 0 problemas de presión y `scrollWidth` igual al ancho de viewport.
- Navegador real: tarjetas semánticas y enfocables; detalle cerrado por defecto y abre al seleccionar; confirmación propia para restaurar; selección de elemento BPMN reflejada en metadatos; rail global oculto en procesos con retorno visible a Mapa.
- Pendiente humano: Tarea 5 sobre fuente autenticada, datos reales y protección de producción; queda también una pasada específica de pinch emulado como verificación de interacción física.
