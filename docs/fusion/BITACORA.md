# Bitácora de fusión Atlas RR (A → B)

Reglas de este archivo: una entrada por fase, en español de Colombia, sin secretos ni cifras financieras.

---

## Fase 0 · Preparación — 2026-11-02

### Qué se hizo
- Se confirmó que la rama de trabajo es `feat/atlas-fusion-bpmn` y su `merge-base` con `origin/main` es `b687305` (mismo HEAD que main), por tanto la rama parte de la base de producción.
- Se ejecutó `git fetch --all` sin errores.
- Se ejecutó `npm ci` (36 paquetes, 0 vulnerabilidades).
- Se leyeron los archivos de referencia de `main` (B) y `atlas-v4-rebuild` (A): `index.html`, `package.json`, `scripts/build.mjs`, `vercel.json`, `src/data/rr-tree.mjs`, `src/app/rr-tree.mjs`, `design/DESIGN.md`, `design/PRODUCT.md`, `AUDITORIA.md` y el listado de `docs/` de A.
- Se creó la carpeta `docs/fusion/` con `BITACORA.md`, `PREGUNTAS.md` y `PRUEBAS.md`.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, build ok.

### Hallazgos / riesgos
- `main` y `origin/main` están en `b687305`; la producción actual coincide con main.
- `atlas-v4-rebuild` (A) está en `58552dd` y tiene una arquitectura de build distinta: usa `esbuild` para hacer un bundle de `src/bpmn/entry.mjs` en `dist/src/bpmn/bpmn-bundle.mjs`. `main` (B) solo copia `src/` a `dist` y no hace bundle.
- El shell de B (`index.html`) carga `src/app/rr-tree.mjs` directamente; el shell de A carga `src/app/main.mjs` con navegación por pestañas.
- La fusión debe conservar el shell y estilos de B (`src/rr-estilo/tokens.css`, `componentes.css`, `src/styles/rr-tree.css`) y traer el motor BPMN de A (`src/bpmn/`).
- El build final deberá combinar ambos: copiar `src/` (como hace B) **y** generar el bundle BPMN (como hace A).
- A tiene 17 semillas BPMN en `src/bpmn/seeds/`; B las referencia indirectamente vía `PROCESS_TO_FLUJO` en `src/app/rr-tree.mjs` (rutas a archivos locales que en producción no existen).

### Preguntas pendientes para Rosas
- Ver `docs/fusion/PREGUNTAS.md`.

### Siguiente paso
- Fase 1: traer el motor BPMN de A, integrarlo en el build de B y reestilizar con tokens de B.

## Fase 1 · Motor BPMN sobre el shell de B — 2026-11-02

### Qué se hizo
- **Hallazgo clave**: `origin/main` ya traía `src/bpmn/` **idéntico** a `atlas-v4-rebuild` (commit 58552dd) por el merge de `merge-main-1700`. El motor BPMN no faltaba: faltaba conectarlo al shell de B (rutas, estilos y build).
- Se corrigió un accidente del bloque anterior: el índice tenía 8 archivos de B sobrescritos por la versión de A (`src/ui/atlas-shell.mjs`, `atlas-nav.mjs`, `atlas-events.mjs`, `atlas-media.mjs`, `atlas-view.mjs`, `src/core/atlas-state.mjs` y sus pruebas). Se restauraron a la versión de B (`git restore --staged --worktree src/`); no se perdió trabajo de B.
- `scripts/build.mjs`: ahora empaqueta el motor BPMN con esbuild (`dist/src/bpmn/bpmn-bundle.mjs`) y copia los CSS oficiales de bpmn-js a `dist/src/bpmn/vendor` (la licencia de bpmn.io exige mantener el aviso «Powered by bpmn.io»). Si la raíz no tiene `src/bpmn/entry.mjs`, el paso se omite sin romper el build (así siguen verdes las pruebas de fixtures).
- `src/app/bpmn-view.mjs` (nuevo): vista BPMN con catálogo por áreas + lienzo bpmn-js, modos Ver/Editar, recorrido Anterior/Siguiente, zoom, encuadre, exportes `.bpmn`/SVG/PNG e informe de lint en vivo. Rutas `#/bpmn` y `#/bpmn/<procesoId>`.
- `src/app/rr-tree.mjs`: el router de hash ahora entiende `#/bpmn`; al volver al mapa se re-encaja el árbol.
- `index.html`: enlaces a los CSS de bpmn-js, botón «◇ BPMN» en la barra superior, botón «◇ Procesos BPMN» en el rail y la sección `<section class="bpmn-view">`.
- `src/styles/bpmn.css`: reescrito con los tokens de B (`--rr-fucsia`, `--rr-mostaza`, `--rr-orquidea`, `--rr-negro`, `--rr-crema`, `--font-titulo`, `--font-texto`). Se descartaron los nombres propios de A (`--rr-fuchsia`, `--rr-mustard`, `--rr-orchid`, `--rr-panel`).
- `src/bpmn/rr-theme.mjs`: ahora lee directamente las variables de B; ya no usa `--rr-bpmn-*` ni colores propios.
- `src/bpmn/seeds/index.json`: se enriqueció con `procesos[]` (id, archivo, título, área, estado, conteo de lint) conservando `files[]`. Se leen áreas del guion §6: Dirección, Comercial y captación, Entrega de servicios, Finanzas (flujos), Operación de bots e IA, Soporte, Legal y administrativo.
- `scripts/verificar-bpmn.mjs` (nuevo): prueba de navegador que abre `#/bpmn`, un proceso, la marca tipográfica y la vuelta al mapa, y deja capturas.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, build ok (bundle BPMN y vendor CSS incluidos).
- `npm run lint:bpmn`: **verde** — 16 semillas, moddle sin avisos, 0 errores fuera de la deuda documentada.
- `node scripts/verificar-bpmn.mjs`: **verde** — 16 tarjetas en 7 áreas; «Oportunidad a cliente» con 49 formas y 3 carriles; recorrido en «paso 1 de 11 · Llega alguien»; h1 Inter Tight y body Lexend; sin errores de consola.

### Hallazgos / riesgos
- El código gana sobre el prompt: hay **16** semillas, no 17 (`scripts/validate-bpmn.mjs` exige 16). Queda anotado en `PREGUNTAS.md`.
- Ninguna semilla pasa el lint sin avisos: 8 con la deuda conocida `no-gateway-join-fork` y el resto con avisos de bpmnlint. Por eso toda semilla nace `borrador` o `con-deuda` en el catálogo; ninguna se marca `válido`.
- En ≤760px el botón de BPMN se oculta (el shell móvil de B es alto y el enlace lo desbordaba, rompiendo la prueba de panel de proceso). El acceso móvil llegará con la tabbar de la fase 6; queda anotado en `PREGUNTAS.md`.
- El visor BPMN es un bundle aparte: en desarrollo sin build no existe `src/bpmn/bpmn-bundle.mjs` y la vista avisa que hay que compilar.

### Siguiente paso
- Fase 2: `core/model.mjs` con esquema v5 (migración desde el JSON v4 de B y desde el estado de A), `store.mjs` único, export/import con diff y confirmación, restaurar base e historial; pruebas de migración, export→import idempotente y rechazo de campos prohibidos.

## 2026-11-02 16:11:51 -0500 — Bloque 1 (Kimi) detenido por orden de Rosas; se reanuda con MiniMax (opencode-go/minimax-m3.1-flash).

## Bloque 1 · Item 1 · Test 6 de CI arreglado — 2026-11-02

### Qué se hizo
- **Causa raíz del fallo de CI**: `scripts/flujo-routes.test.mjs` (traído de `atlas-arbol-pro` en el merge de PR #6) leía la lista de rutas desde `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/rutas-v3.json`. Esa ruta existe solo en esta máquina; en el runner de GitHub el test 6 moría con `ENOENT`.
- **Fixture dentro del repo**:
  - `fixtures/flujo-rutas.json`: los 125 identificadores de ruta de la auditoría de la carcasa v3 (solo ids de ruta; sin nombres de personas, sin cifras, sin secretos), con `fuente` y `corte`.
  - `fixtures/flujo-demo.json`: los 16 flujos que las rutas `#flujo/` necesitan, generados desde las semillas BPMN del propio repo por `scripts/generar-fixture-flujos.mjs` (`npm run fixture:flujos`). Sin datos inventados: sale de `src/bpmn/seeds/` con `bpmn-moddle`.
  - `scripts/flujo-routes.test.mjs` ahora lee los fixtures del repo, sirve el de flujos en el dist temporal como `src/data/flujos-v3.local.json` (el visor sigue igual: en producción ese archivo es local y nunca se sube) y endurece las aserciones: exige que aparezca «nodos» y que **no** aparezca «Flujo no encontrado»; además comprueba que el fixture cubra exactamente las rutas `#flujo/` auditadas.
  - `scripts/verificar-flujos.mjs` (nuevo): prueba de clics reales con Playwright headless sobre las 16 rutas `#flujo/` en escritorio 1440×900 y móvil 390×844; guarda capturas y reporta errores de consola.
- `package.json`: nuevo script `fixture:flujos`.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail (en CI antes: 201 pass, 1 fail).
- `npm run lint:bpmn`: verde (sin cambios en las semillas).
- `node scripts/verificar-flujos.mjs`: **verde** — 32 combinaciones de ruta y viewport, 0 flujos vacíos, 0 errores de consola.

### ¿Falla `main` el mismo test?
**Sí, y queda registrado:**
- `origin/main` (`b687305`, merge de PR #6) tiene el mismo archivo con la misma ruta absoluta (`git show origin/main:scripts/flujo-routes.test.mjs` línea 13).
- Reproducción local: worktree temporal de `origin/main` con la ruta cambiada a una inexistente (equivalente al runner, donde `/home/deadkiss` no existe) → `ENOENT`, 1 fail, el mismo test.
- Evidencia en GitHub: la corrida «Atlas checks» de `main` (run `41246045989`, 31-oct) está en **failure** y se saltó el paso «Validar diagramas BPMN», o sea se rompió en «Comprobar la base» (mismo punto que el PR #7, run `41533696142`).

### Hallazgos / riesgos
- El visor `#flujo/` sigue dependiendo de `src/data/flujos-v3.local.json`, que es local y no se sube: en producción (build sin `--local`) esas rutas muestran «Flujo no encontrado». Queda como pendiente de producto (se puede resolver en la fase 2 haciendo que el visor caiga a las semillas BPMN del repo).
- Los fixtures se regeneran con `npm run fixture:flujos`; si cambian las semillas hay que volver a correrlo (la prueba falla si el fixture y las rutas no coinciden).

### Pendiente del bloque
- Item 2 del encargo: auditoría UX/UI completa (`docs/fusion/AUDITORIA_UX.md`) con recorridos ver/navegar/editar/exportar y mediciones a 360, 768 y 1440 px.

### Capturas
- `docs/fusion/capturas/bloque1-flujo-escritorio-1440.png`
- `docs/fusion/capturas/bloque1-flujo-movil-390.png`

## Bloque 2 · Item 2 · Auditoría UX/UI completa — 2026-11-02

### Qué se hizo
- **`scripts/auditoria-ux-fusion.mjs` (nuevo, `npm run audit:ux`)**: auditoría repetible con Playwright headless + Chrome
  real sobre `dist/`. Recorre el mapa vivo, el catálogo BPMN y un proceso (49 formas, 3 carriles) en **1440×900, 768×1024 y
  360×740**, mide overflow, contraste WCAG, objetivos táctiles y cajas, ejecuta los cuatro recorridos (ver, navegar, editar,
  exportar) y guarda 17 capturas en `docs/fusion/capturas/auditoria/`. Datos crudos en `docs/fusion/AUDITORIA_UX.json`.
- **`docs/fusion/AUDITORIA_UX.md` (nuevo)**: informe con 18 bugs clasificados (4 críticos, 5 altos, 6 medios, 2 bajos),
  tablas de medición por viewport y el resultado de cada recorrido por ancho.
- **Correcciones aplicadas de los bugs encontrados**:
  1. `src/app/bpmn-view.mjs`: el botón de modo buscaba `[data-bpmn-mode]`, atributo que **no existe** en `index.html`
     (el real es `data-bpmn-accion="modo"`). Al hacer clic en «Editar» se lanzaba `TypeError: Cannot set properties of null`
     y **el modo de edición nunca se activaba**. Ahora cambia a «Ver» y aparece la paleta de bpmn-js.
  2. `src/styles/bpmn.css`: los botones de la vista BPMN usan tinta RR sobre crema. «Volver al mapa» estaba en crema sobre
     crema (**contraste 1,01:1**, ilegible).
  3. `index.html` + `src/styles/rr-tree.css`: «Volver al hub RR» queda oculto (decisión de Rosas) y `hidden` gana sobre
     `display:inline-flex` (el enlace apuntaba a `http://localhost:8081/`, roto en producción).

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail, build ok.
- `npm run audit:ux`: **verde** — 3 viewports × 7 pasos, 0 errores de consola tras las correcciones.
- Sonda de verificación: hub `hidden: true`; «Volver al mapa» en `rgb(7,0,1)` sobre crema; modo = «Ver» con paleta visible.

### Hallazgos / riesgos
- 🔴 **El diagrama BPMN no abre en tablet ni en móvil**: `.bpmn-canvas` queda con 0 px de alto y el `svg` de bpmn-js nunca
  se monta. Bloquea los items 3, 5 y 7 del encargo.
- 🔴 En 768 px la barra superior se sale de la pantalla (`div.top-actions` termina en `right: 871`): «Guía» y «＋ Añadir
  nodo» quedan inalcanzables.
- 🟠 El inspector de elemento del diagrama no aparece al hacer clic en una forma y «Siguiente» no avanza el paso: hoy solo
  se puede *ver* el dibujo, no recorrerlo ni editarlo (requisitos §8.4–8.7 del mega prompt).
- 🟠 Los nodos del mapa no son clicables a 768/360 y quedan en 23×12 px; los botones del nodo en 31×31 px.
- 🟡 Una búsqueda sin resultados deja el lienzo vacío sin aviso; el toolbar BPMN mide 165 px en móvil; el topbar 172 px.

### Pendiente del bloque
- Item 3 del encargo: BPMN editable en sitio. Orden sugerido en `AUDITORIA_UX.md` §6: (1) altura del lienzo + diagrama a
  pantalla completa, (2) inspector y `step()`, (3) edición directa de etiquetas y colores RR, (4) guardado en el modelo v5.
- Decisiones abiertas para Rosas añadidas a `docs/fusion/PREGUNTAS.md` (5 preguntas nuevas).

### Capturas
- `docs/fusion/capturas/auditoria/` (17 capturas: mapa, navegar, catálogo, proceso, edición, export, vuelta al mapa en
  1440, 768 y 360).

### Ampliación del bloque 2 · item 3 (arranque) — 2026-11-02

Se siguió con el item 3 (BPMN editable en sitio) mientras se cerraba la auditoría, porque los bugs de la auditoría
bloqueaban el item 3. Todo queda commiteado y pusheado en la misma rama.

### Qué se hizo (arranque del item 3)
- **Causa raíz del diagrama bloqueado en tablet y móvil**: `[hidden]` no ocultaba `.shell` (`.shell { display: grid }`
  anulaba el `display:none` del navegador), así que el mapa seguía ocupando media pantalla y la vista BPMN recibía
  376 px de alto en vez de 752. Se añadió la regla global `[hidden] { display: none !important; }` en `src/styles/rr-tree.css`
  y `.bpmn-canvas-wrap { min-height: 320px }` + breakpoint ≤900 px en `src/styles/bpmn.css`.
  **El diagrama ahora abre en 1440, 768 y 360.**
- **Recorrido «Anterior»/«Siguiente»**: el diagrama avanzaba por dentro pero la interfaz se quedaba en «paso 1 de 11».
  Nueva función `avanzar(delta)` en `src/app/bpmn-view.mjs` que actualiza el rótulo con el paso actual.
- **Marca del paso actual**: `marcarPaso()` en `src/bpmn/entry.mjs` aplica la clase `rr-paso-actual` (contorno fucsia RR)
  al elemento por el que va el recorrido.
- **Auditoría corregida**: se detectaron dos falsos positivos de la sonda (el inspector de elementos y la edición directa
  de etiquetas no fallaban; los selectores `Activity_*` no existen en las semillas). Se corrigió la sonda con los ids reales
  (`t_*`, `e_*`, `g_*`, `part_*`, `lane_*`) y se reescribió `docs/fusion/AUDITORIA_UX.md` con los resultados reales:
  el inspector responde («Llega alguien · Evento de inicio») y el doble clic **edita la etiqueta**
  («2. Se anota» → «2. Se anota (editada)»).

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail.
- `npm run audit:ux`: **verde** — 3 viewports × 7 pasos, 0 errores de consola, diagrama abierto en los tres anchos,
  inspector y recorrido funcionando en 1440 y 768.

### Pendiente del item 3 (siguiente bloque)
- Conectar el diagrama con el modelo v5: que editar una etiqueta, un carril o un nombre escriba en el modelo y en el XML,
  con historial y deshacer/rehacer propios del diagrama (hoy el cambio vive solo en la sesión).
- Menú contextual (*context pad*) y paleta por área con los colores RR: crear tareas, compuertas y eventos desde la interfaz.
- Inspector editable del elemento (nombre, carril/rol, sistemas, entradas/salidas, notas, fuente y corte).
- Modo de diagrama a pantalla completa (item 5 del encargo): resuelve también el táctil en 360 px.

## Bloque 3 · Item 3 · BPMN editable en sitio — 2026-11-02 (cierre)

### Qué se hizo
- La edición en sitio quedó cerrada en el commit `9a76f5c`: inspector con nombre, carril, color RR, notas, fuente y corte;
  creación de tareas, tareas de usuario, compuertas, eventos y carriles desde «＋ Añadir»; deshacer/rehacer del propio
  diagrama; copia local en `localStorage` («Guardar copia») y «Restaurar semilla».
- El color elegido se guarda en el DI con la extensión `bioc:fill` (la de bpmn.io), no con un atributo propio: así el
  color viaja en el `.bpmn` exportado y `rr-renderer.mjs` solo respeta los colores de la marca RR.
- Se corrigió un detalle del bloque anterior: el nombre del paso nuevo se pone **antes** de crear la forma, para que la
  creación sea un solo comando (deshacer la quita completa y no deja el paso a medio hacer).
- Se cerró el «guardado»: `marcarGuardado()` baja la insignia de «Cambios sin guardar» a «Copia local».

### Estado de los checks
- `npm run check`: verde (202 tests, 0 fail, build ok).
- `npm run verificar:bpmn-edicion`: verde en escritorio 1440 y móvil 390 (inspector, edición de etiqueta, cambio de
  carril, color RR, agregar, deshacer/rehacer, guardar, recargar y restaurar).

## Bloque 4 · Item 4 · Panel por diagrama (qué busca y cómo se lee) — 2026-11-02

### Qué se hizo
- **`src/bpmn/leyenda.mjs` (nuevo)**: fuente única de la lectura de los diagramas.
  - `SIMBOLOS` (11): evento de inicio, evento de fin, tarea, tarea de usuario, tarea de servicio, compuerta, compuerta
    paralela, carril/piscina, flujo de secuencia, dato y «punto donde se traba». Cada uno con su glifo SVG y su explicación.
  - `COLORES` (5): crema RR (paso normal), fucsia (se traba), mostaza (atención/decisiones), orquídea (carriles) y gris
    (datos y flechas). Los colores salen de los tokens de B, no de valores propios.
  - `COMO_LEER`: los cinco pasos para leer cualquier diagrama (inicio → flechas → carriles → compuertas → fin).
  - `PROCESOS`: ficha de los 16 diagramas (qué busca, disparador, resultado, el camino paso a paso y «para mirar»),
    escrita desde el guion de procesos del mega prompt §6, con `FUENTE_GUIA` y `CORTE_GUIA` (2026-11-02).
- **Panel por diagrama** (`src/app/bpmn-view.mjs` + `index.html` + `src/styles/bpmn.css`):
  - Botón «Guía del diagrama» en la barra del proceso: abre un panel con *qué busca este diagrama*, *cómo empieza y qué
    entrega*, *el camino paso a paso*, *cómo se lee un diagrama*, *leyenda de símbolos* y *leyenda de colores*, más la
    fuente y el corte.
  - El panel se actualiza solo al cambiar de proceso y se cierra con «×» o con el mismo botón.
  - En escritorio el panel es una tercera columna (340 px); en vertical (≤900 px) baja debajo del diagrama y se trae a la
    vista al abrirlo.
- **Corrección de marca (decisión de Rosas ya resuelta)**: `<title>`, `meta description` y el encabezado ahora dicen
  «RR Aliados · Atlas operativo» (antes «RR Labs · Atlas de procesos»).
- **Bug real encontrado por las pruebas de clic**: el lienzo de bpmn-js crea SVG del tamaño del diagrama (más anchos que
  su columna) y quedaban **por encima** del panel: se comían los clics del botón de cerrar. Se resolvió con
  `position: relative; z-index: 10` en `.bpmn-guia` (el panel siempre gana) y con `scrollIntoView` al abrir en móvil.

### Estado de los checks
- `npm run check`: verde (202 tests, 0 fail, build ok).
- `npm run verificar:guia`: **verde** — escritorio 1440 y móvil 390: el título dice «RR Aliados · Atlas operativo», la
  guía se abre con 11 símbolos, 5 colores, el camino paso a paso y la fuente; se actualiza al cambiar de proceso, se
  cierra y no deja errores de consola.

### Hallazgos / riesgos
- El texto de la ficha de cada diagrama es lectura de proceso (guion §6), no dato verificado por el equipo: queda en
  `docs/fusion/PREGUNTAS.md` para que Rosas lo revise.
- En el mapa vivo sigue apareciendo «RR Labs → operación conectada» en el subtítulo de la barra; no se tocó para no
  romper el look que le gusta a Rosas (queda anotado aquí para el siguiente bloque).
- La leyenda es del motor BPMN genérico: no distingue todavía las tareas de bot de las de persona (el tema de RR las
  pinta igual). Se puede afinar en el item 5.

### Pendiente del bloque
- Item 5 del encargo: **modo diagrama a pantalla completa** (abrir un BPMN hace que toda la página sea el diagrama, sin
  división). En móvil 360 px el diagrama sigue pidiendo scroll y convive con el catálogo y el panel de inspector.
- Items 6 y 7 (pantalla dividida activable y responsive profundo con gestos táctiles).
- Item 8: fase 2 (modelo de datos v5) y fases restantes.

### Capturas
- `docs/fusion/capturas/guia-bpmn-escritorio-1440-panel.png`
- `docs/fusion/capturas/guia-bpmn-movil-390-panel.png`
