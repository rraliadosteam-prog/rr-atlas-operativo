# RR Atlas — capa de colaboración, dibujo y exportación

> Para agentes: ejecutar una fase a la vez, mantener el mapa y BPMN sin datos reales, y verificar cada cambio en navegador real.

**Objetivo:** Convertir el Atlas en una superficie local-first para organizar mapas, dibujar anotaciones, dejar comentarios y exportar fragmentos reutilizables, tomando de Mesa RR la separación entre inicio, plan y calendario y de interior.dev la profundidad material, sin reemplazar el frontend existente.

**Arquitectura:** El esquema JSON v1 se amplía con migración compatible: comentarios y tamaño opcional viven en cada nodo, mientras que las exportaciones parciales se derivan del snapshot actual y nunca mutan la fuente. La interfaz conserva JavaScript modular, almacenamiento local y BPMN separado; los fixtures siguen siendo anónimos y explícitamente de ejemplo.

**Referencias:** `https://mesa-rr.vercel.app/`, `/home/deadkiss/.hermes/reference-repos/interior` (MIT, commit `3148008`), `docs/superpowers/plans/2026-10-22-atlas-auditoria-ux-ui-master.md`.

## Restricciones

- No introducir información real de RR, clientes, personas, montos ni credenciales.
- No romper las validaciones BPMN, BPMN 2.0, importación/exportación JSON ni el almacenamiento local existente.
- No copiar el frontend de interior.dev; adaptar únicamente patrones de materiales, profundidad, iconografía y microinteracciones permitidos por su licencia MIT.
- Cualquier fragmento exportado debe conservar `schemaVersion`, nodos, conexiones y un manifiesto de origen.
- La publicación de producción usa el build real de Vercel: `npm run build` hacia `dist`.

## Fases

### Fase 0: Preservación y contrato

- Confirmar que `src/bpmn/lint/`, `scripts/validate-bpmn.mjs` y las semillas siguen presentes.
- Añadir pruebas de migración de comentarios, dimensiones y exportación parcial.

### Fase 1: Dibujo y comentarios

- Añadir a cada nodo `width`, `height` y `comments` opcionales con límites y defaults seguros.
- Cambiar Dibujar para permitir arrastre de tamaño, vista previa y creación de una nota/comentario sin `prompt()` nativo.
- Añadir editor de comentarios: crear, editar, borrar y conservar fecha local sin datos personales.

### Fase 2: Exportación por fragmentos

- Añadir exportación de la vista filtrada y del vecindario del nodo seleccionado.
- Exportar JSON compatible y SVG autocontenido para revisión; incluir manifiesto de alcance.
- Mantener la exportación completa actual y diferenciar claramente `mapa completo`, `vista` y `vecindario`.

### Fase 3: Organización de producto

- Añadir una superficie local de Plan con tareas de ejemplo, estados, nota y criterio de terminado.
- Separar Inicio, Mapa, Procesos y Plan sin duplicar la búsqueda ni introducir datos reales.
- Usar tarjetas, filas seleccionadas y estados de Mesa RR como patrón de interacción, no como fuente de datos.

### Fase 4: Assets y material visual

- Incorporar un archivo local de patrones material `bezel`, `panel`, `well`, `cap` y `row` adaptado al brand RR.
- Añadir iconos inline consistentes para dibujo, comentarios, exportación y plan; no depender de una red externa.
- Verificar contraste, foco, mobile y `prefers-reduced-motion`.

### Fase 5: Verificación y publicación

- `npm run check`.
- `cargo test --workspace`.
- `npm run audit:visual` en 360, 390, 430, 768, 1024 y 1440.
- Prueba manual: crear nota, cambiar tamaño, comentar, exportar vista, importar el fragmento y comprobar validación BPMN.
- Verificar despliegue Vercel `target: production`, alias público y marcadores del nuevo build.
