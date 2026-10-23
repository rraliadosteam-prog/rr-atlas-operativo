# AUDITORIA — Atlas Operativo RR

Fecha: 2026-10-23
Rama de trabajo: `feat/atlas-reference-wave1`
Corte auditado: producción `https://rr-atlas-operativo.vercel.app/?v=c3d336d`
Commit auditado: `c3d336d`
Base local: `c3d336d feat(atlas): añade colaboración y exportación parcial`

## Alcance y límites

Esta auditoría se hizo sobre el código real de la rama y sobre el artefacto público servido por Vercel. No se cargó información real ni se modificó producción durante la auditoría. La implementación posterior queda en esta rama y debe terminar en preview y Pull Request.

Evidencia visual:

- Escritorio: `/home/deadkiss/.hermes/cache/scratch/atlas-audit-production/1440x900-mapa.png`
- Móvil: `/home/deadkiss/.hermes/cache/scratch/atlas-audit-production/390x844-mapa-sin-recorrido.png`
- Auditoría completa: `/home/deadkiss/.hermes/cache/atlas-audit-production.log`

Verificación de baseline:

- `npm run check`: 32 pruebas pasan.
- BPMN: 16 semillas, 0 errores fuera de la deuda documentada y 8 avisos conocidos de compuertas no-gateway-join-fork.
- `cargo test --workspace`: todas las suites pasan.
- `npm run audit:visual`: 0 solapes, 0 etiquetas sobre formas, 0 textos desbordados, 0 palabras partidas, 0 problemas de presión y sin overflow horizontal en 360, 390, 430, 768, 1024 y 1440 px.
- Producción responde HTTP 200 y sirve `src/app/main.mjs?v=bpmn-6`.

## P0 — bloquea producto profesional

### P0.1 — Sin P0 visual o funcional demostrado en el corte

El mapa, la navegación, los procesos BPMN, la validación, la importación y la exportación funcionan en el corte auditado. No se encontró un fallo que impida abrir la aplicación o abrir un BPMN.

Riesgo condicionado: si se cargan datos reales mientras el dominio siga público, los hallazgos P1 de seguridad pasan a ser P0 operativo.

## P1 — alta prioridad

### P1.1 — La primera cámara no comunica el mapa completo

Evidencia: captura `1440x900-mapa.png`.

- El pie declara 55 nodos y 37 conexiones.
- La primera vista deja solo una fracción de los nodos completamente legible.
- Hay tarjetas cortadas a la derecha y en la zona inferior.
- El encuadre inicial centra el primer nodo seleccionado, no una composición completa del contenido relevante.

Código: `src/ui/atlas-view.mjs:686-707`, `src/ui/atlas-view.mjs:494`.

Acción: implementar encuadre inicial inteligente por límites reales, margen de seguridad y memoria de última vista; mantener `Reencuadrar` como encuadre total filtrado.

### P1.2 — La barra inferior y el pie consumen demasiado lienzo

Evidencia: `1440x900-mapa.png`.

Cabecera, toolbar, barra de estado y pie reducen el área vertical efectiva del lienzo. La barra de estado queda sobre el contenido inferior y el pie repite información de marca y versión.

Código: `src/styles/layout.css:89-147`.

Acción: fusionar estado y pie en una barra compacta, conservar zoom y métricas, retirar repetición de marca y añadir modo enfoque con `\\`.

### P1.3 — Conexiones secundarias con contraste insuficiente

Evidencia: `1440x900-mapa.png`.

Las conexiones principales destacan, pero las líneas moradas secundarias se mezclan con el fondo y no tienen leyenda semántica clara.

Código: `src/styles/layout.css:110-113`, `src/ui/atlas-view.mjs:103-125`.

Acción: definir jerarquía de relaciones, contraste mínimo, routing que evite tarjetas, estados de selección y leyenda contextual.

### P1.4 — Seguridad del dominio público antes de datos reales

Evidencia: la respuesta HTTP pública solo expone `strict-transport-security` y `cache-control`; no se observan `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` ni `Permissions-Policy`.

Código/configuración: `vercel.json` solo define `buildCommand` y `outputDirectory`.

Acción: añadir encabezados de seguridad y mantener fixtures anónimos hasta contar con protección/autenticación y fuente privada.

### P1.5 — Visor multimedia permite cualquier HTTPS y un iframe amplio

Código: `src/core/atlas-state.mjs:76-115` acepta cualquier host HTTPS para assets; `src/ui/atlas-media.mjs:130-138` monta iframe con `allow-same-origin`, scripts, popups y permisos de portapapeles.

Acción: definir lista de dominios permitidos, reducir `allow`, mantener `sandbox` mínimo y verificar `referrerPolicy` por tipo de recurso.

### P1.6 — Persistencia solo local

Código: `src/app/main.mjs:19`, `src/core/atlas-state.mjs:287-314` y `src/data/demo-plan.mjs:27-30` usan `localStorage`.

Impacto: cada navegador tiene una copia distinta; no existe colaboración, historial remoto ni autoría.

Acción: documentar la arquitectura compartida antes de construirla. No integrar DashWeb, Kotizador ni datos reales en esta ola.

### P1.7 — Inconsistencia de versión visible

Código: `package.json` declara `4.0.0-foundation`, mientras `index.html` y el pie muestran versión 4.1.

Acción: centralizar versión de build y preparar `CHANGELOG.md` y panel de Novedades.

### P1.8 — El BPMN conserva formato y validación, pero la interacción avanzada está incompleta

Lo que funciona: `bpmn-js`, XML BPMN 2.0, carriles, importación, validación, exportación BPMN/SVG/PNG y selección de elementos.

Código: `src/bpmn/entry.mjs:1-6,85-310`, `src/bpmn/lint/run.mjs`, `scripts/validate-bpmn.mjs`.

Faltan para producto de referencia: edición de conexiones y carriles con UX completa, comentarios anclados a elementos, comparación de versiones, búsqueda dentro del proceso, simulación con token y panel de datos estructurados por elemento.

Acción: mantener `NavigatedViewer`/`Modeler` y XML como verdad; construir por capas sin reemplazar BPMN por un dibujo propio.

## P2 — pulido y descubrimiento

### P2.1 — Rail con categorías de semántica mezclada

Código: `index.html:46-58`.

El rail mezcla ámbitos, tipos de entidad, Procesos BPMN y Plan local. Los nodos Control, Prospecto, Experimento comercial y Otro no tienen una navegación propia visible.

Acción: agrupar ámbitos, vistas y tipos; añadir conteos y modo solo iconos.

### P2.2 — Tarjetas sin jerarquía por zoom

Código: `src/ui/atlas-view.mjs:145-210` y `src/styles/components.css:25-47`.

Las tarjetas tienen un único nivel de detalle. El responsable, estado y notas no aparecen en el mapa aunque existen en el modelo.

Acción: tres niveles según zoom; mostrar estado, responsable e iniciales sin cargar la tarjeta.

### P2.3 — Selección y vecindad necesitan explicación más fuerte

Código: `src/ui/atlas-view.mjs:115-125` resalta conexiones por selección, pero no existe control de profundidad 1/2/3 ni modo enfoque de vecindad documentado en la interfaz.

Acción: añadir foco contextual, profundidad seleccionable y exportación del vecindario.

### P2.4 — Falta paleta de comandos y lista de atajos visible

Código: `src/ui/atlas-events.mjs:161-210` contiene atajos básicos, pero no existe `Ctrl/Cmd + K` ni panel `?`.

Acción: añadir paleta de comandos por divulgación progresiva, no más botones permanentes.

### P2.5 — Plan local no está explicado como vista de producto

El fixture local ya existe en `src/data/demo-plan.mjs`, pero necesita integración con una explicación más clara de qué es, qué no es y cuándo se sincronizará.

Acción: mantenerlo explícitamente local y de ejemplo; no mezclarlo con datos empresariales reales.

### P2.6 — Falta CHANGELOG y panel Novedades

El repositorio no contiene todavía `CHANGELOG.md` ni una superficie de novedades en la aplicación.

Acción: añadirlos en la primera ola de entrega.

### P2.7 — Rendimiento de 500 nodos no medido

La auditoría visual actual prueba 55 nodos y geometría responsive, pero no tiene una medición de 500 nodos ni fps de zoom/pan.

Acción: crear fixture sintético, medir tiempo de render, listeners, memoria y fotogramas antes de virtualizar.

### P2.8 — Axe/Lighthouse no ejecutados en este corte

No hay reporte de axe-core ni Lighthouse guardado en la evidencia de baseline.

Acción: incorporarlos a la ola de calidad y documentar cualquier limitación del entorno.

## Producto y datos

- El corte público contiene fixtures de ejemplo, no se cargó información real durante esta auditoría.
- `DESCONOCIDO` y `Por validar` siguen siendo estados válidos.
- No se fusionan nodos duplicados ni se inventan responsables, fechas, montos o KPI.
- El Plan local se conserva como fixture de trabajo local, inspirado en la estructura de Mesa RR, no como fuente oficial.

## Decisiones de implementación para esta rama

1. Trabajar en JavaScript modular actual; no iniciar Rust/WASM hasta documentar la frontera y esperar aprobación.
2. Ejecutar Ola 1: primera impresión, estructura, seguridad inmediata, encuadre, conexiones, rail y jerarquía de tarjetas.
3. Mantener BPMN 2.0 y la validación existente como contrato.
4. No desplegar producción desde esta rama. El resultado se verificará en local y, si queda verde, se publicará solo en un preview de Vercel para aprobación.
5. Crear `CHANGELOG.md`, pruebas de regresión y capturas por ola.
