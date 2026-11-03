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

## Bloque 5 · Item 5 · Modo diagrama a pantalla completa — 2026-11-02

### Qué se hizo
- **Al abrir un BPMN, toda la página es el diagrama** (item 5 del encargo). La vista BPMN
  pasa a ser una capa fija sobre el viewport (`position: fixed`, `z-index: 45`), así que la
  cabecera del shell, la marquesina y el pie quedan tapados y no hay scroll: el lienzo toma
  la pantalla completa. En móvil de 360 px el diagrama ya se ve sin desplazar (era el bug que
  había reportado Botardo).
- **Botón ⛶ «Pantalla completa»** en la barra del diagrama: alterna entre la vista partida
  (catálogo + diagrama) y la pantalla completa. En pantalla completa el botón dice «⛶ Dividir».
  Atajos: **P** alterna el modo y **Esc** sale (si la guía está abierta, Esc la cierra primero).
- **Botón «☰ Procesos»** en la cabecera de la vista: devuelve al catálogo (`#/bpmn`) sin perder
  el proceso abierto. «Volver al mapa» sigue llevando al mapa vivo (`#top`).
- **La guía por diagrama deja de dividir**: en pantalla completa se abre como una bandeja
  superpuesta sobre el diagrama (el lienzo no cambia de ancho). En la vista partida sigue
  siendo la tercera columna del item 4.
- **Atajos del mapa apagados dentro de la vista BPMN** (`src/app/rr-tree.mjs`): antes, `F`,
  `/`, `Supr` y `Ctrl/Cmd+Z` del mapa disparaban también con el diagrama abierto. Ahora la
  vista BPMN maneja sus propios atajos: **P** (pantalla completa), **F** (encuadrar),
  **Esc** y **Ctrl/Cmd+Z** (deshacer/rehacer del diagrama).
- **Motor BPMN**: `workspace.fit({ completo: true })` encuadra el diagrama entero cuando el
  lienzo es ancho. En móvil (lienzo angosto) no se encoge todo —quedaba ilegible—: se arranca
  en el primer paso, como el resto de la app.
- **Bugs reales encontrados por las pruebas de clic y corregidos**:
  1. La paleta de bpmn-js venía en vertical con entradas de 44 px: en móvil tapaba media
     pantalla (450 px de alto) y se comía los clics sobre las formas. Ahora es una franja
     horizontal arriba, deslizable con el dedo.
  2. En pantalla completa el informe de lint se comía hasta 186 px de alto en 360 px de ancho:
     el lienzo quedaba en 383 px. El informe ahora se limita a 92 px con scroll propio.
  3. La cabecera (marca RR + título + acciones) ocupaba 115 px en móvil: ahora es una sola
     fila con el título recortado con puntos suspensivos.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores fuera de la deuda documentada.
- `npm run verificar:pantalla`: **verde** — escritorio 1440×900, móvil 390×844 y móvil 360×740:
  catálogo visible en la vista partida; al abrir un BPMN la página pasa a pantalla completa
  (catálogo oculto, sin scroll, el diagrama no se sale de la pantalla, hay formas dibujadas a
  la vista); la guía se superpone sin dividir el lienzo; ⛶ divide y vuelve a unir; Esc sale y
  la tecla P vuelve a entrar; «Volver al mapa» regresa al mapa vivo. 0 errores de consola.
- `npm run verificar:bpmn-edicion`: **verde** en escritorio 1440 y móvil 390 (el clic sobre la
  forma ya no cae en la paleta).
- `npm run verificar:guia`: **verde** en escritorio 1440 y móvil 390 (el cambio de proceso ahora
  se hace con «☰ Procesos» + clic en la otra tarjeta, porque el catálogo se esconde en pantalla
  completa).
- `npm run audit:ux`: **verde** (3 viewports × 7 pasos, 0 errores de consola, sin desbordes
  horizontales).

### Medición del lienzo antes y después (de `npm run audit:ux`)
| Viewport | Antes | Ahora |
|---|---|---|
| Escritorio 1440×900 | 1150 × 471 px | **1440 × 653 px** |
| Tableta 768×1024 | 768 × 320 px | **768 × 825 px** |
| Móvil 360×740 | 360 × 320 px | **360 × 532 px** (sin scroll) |

### Hallazgos / riesgos
- La vista partida en móvil (catálogo arriba, diagrama abajo) sigue siendo incómoda: es el
  estado intermedio al que se vuelve con «☰ Procesos». El item 6 (pantalla dividida activable)
  debe reemplazar esa vista improvisada.
- El fallo «navegar» de la auditoría (clic en los nodos del mapa a 768 y 360 px) **ya existía
  antes de este bloque**: se comparó con el JSON de la auditoría anterior y es idéntico. Queda
  para el item 7 (responsive).
- La edición directa por doble clic sigue sin estar disponible en 360 px (limite de bpmn-js con
  `isMobile`); no es un cambio de este bloque.

### Pendiente del bloque
- Item 6: pantalla dividida opcional activable (diagrama + otro diagrama, o un esquema BPMN, o
  el Inicio con tarjetas de cliente/servicio).
- Item 7: responsive profundo de escritorio y móvil (gestos táctiles en el tablero, navegación
  móvil, animaciones con sentido) y el clic en los nodos del mapa a 768/360.
- Item 8: fase 2 (modelo de datos v5) y fases restantes del mega prompt.

### Capturas
- `docs/fusion/capturas/pantalla-bpmn-escritorio-1440-catalogo.png`
- `docs/fusion/capturas/pantalla-bpmn-escritorio-1440-completo.png`
- `docs/fusion/capturas/pantalla-bpmn-escritorio-1440-guia.png`
- `docs/fusion/capturas/pantalla-bpmn-movil-390-completo.png`
- `docs/fusion/capturas/pantalla-bpmn-movil-360-completo.png`
- `docs/fusion/capturas/pantalla-bpmn-movil-360-guia.png`

## Bloque 6 · Item 6 · Pantalla dividida opcional — 2026-11-02

### Qué se hizo
- **La pantalla se puede dividir** (item 6 del encargo): el diagrama se queda en un lado y al otro
  va uno de tres acompañantes. Botón **«▥ Dividir»** en la cabecera de la vista y en la barra del
  diagrama; el atajo **D** también lo alterna. Con el panel abierto el botón dice «▥ Unir».
  - **Otro diagrama**: un segundo visor bpmn-js (solo ver) con un selector de proceso por área.
    Es una instancia aparte: no toca el lienzo principal ni el informe de lint.
  - **Esquema**: el mapa de las áreas del Atlas con sus procesos (16 fichas en 7 áreas). Tocar una
    ficha abre ese proceso en el diagrama principal. El proceso abierto queda marcado.
  - **Inicio**: tarjetas de **cliente** (11) y de **servicio** (9) con nombre, estado y nota, más la
    fuente y el corte. Sin cifras, sin datos de personas y sin estados inventados: lo que no está
    confirmado aparece como «Sin confirmar».
- **Datos nuevos**: `src/data/inicio-tarjetas.mjs` (clientes y servicios con `fuente` y `corte`).
  Es la versión mínima que funciona antes del modelo v5; el item 8 lo reemplaza por
  `src/data/base/*.json`.
- **`src/bpmn/entry.mjs`**: `fit({ forzar: true })` encuadra el proceso entero aunque el lienzo sea
  angosto. El visor del panel de al lado lo usa para mostrar el diagrama completo, no el primer paso.
- **En escritorio** el diagrama queda en 950×653 px y el panel en 489×656 px. **En móvil (390 px)**
  el panel va debajo del diagrama (390×324 px el diagrama, 390×201 px el panel): no hay scroll
  horizontal ni vertical.
- La **guía del diagrama** (item 4), con la pantalla dividida, se superpone sobre el panel en vez de
  partir el lienzo en otra columna.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores fuera de la deuda documentada.
- `npm run verificar:dividido` (nuevo, `scripts/verificar-dividido.mjs`): **verde** — escritorio 1440×900
  y móvil 390×844 con clics reales: el panel abre, el diagrama principal sigue con sus 49 formas, el
  segundo diagrama dibuja 66 formas visibles, el esquema lista 16 procesos en 7 áreas y al tocar uno se
  abre en el diagrama principal, el Inicio muestra 20 tarjetas (11 clientes), «×» cierra el panel y la
  tecla D lo vuelve a abrir. 0 errores de consola.
- `npm run verificar:pantalla`, `npm run verificar:guia`, `npm run verificar:bpmn-edicion` y
  `npm run audit:ux`: **verdes** (no se rompió nada de los items 3, 4 y 5).

### Hallazgos / riesgos
- El visor del panel de al lado es de solo lectura: no se edita desde ahí (a propósito, para no tener
  dos lienzos editables compitiendo por el mismo proceso).
- El esquema se arma con el catálogo de semillas (16 procesos, 7 áreas). Cuando el item 8 modele los
  procesos del guion §6 que faltan, el esquema crece automáticamente porque lee el mismo índice.
- Los estados de clientes y servicios son lectura del inventario; los que no tienen estado escrito en
  la fuente van como «Sin confirmar». Queda en `docs/fusion/PREGUNTAS.md` para que Rosas los ajuste.

### Pendiente del bloque
- Item 7: responsive profundo de escritorio y móvil (gestos táctiles en el tablero, navegación móvil,
  animaciones con sentido) y el clic en los nodos del mapa a 768/360 px.
- Item 8: fase 2 (modelo de datos v5) y fases restantes del mega prompt.

### Capturas
- `docs/fusion/capturas/dividido-escritorio-1440-diagrama.png`
- `docs/fusion/capturas/dividido-escritorio-1440-esquema.png`
- `docs/fusion/capturas/dividido-escritorio-1440-inicio.png`
- `docs/fusion/capturas/dividido-escritorio-1440-completo.png`
- `docs/fusion/capturas/dividido-movil-390-diagrama.png`
- `docs/fusion/capturas/dividido-movil-390-esquema.png`
- `docs/fusion/capturas/dividido-movil-390-inicio.png`
- `docs/fusion/capturas/dividido-movil-390-completo.png`

## Bloque 7 · Item 7 · Responsive y táctil — 2026-11-02

### Qué se hizo
- **El mapa ahora se puede usar con el dedo y con el mouse en tablet y celular.** El fallo de fondo era
  el encuadre: `fit()` metía el árbol completo en la pantalla, y en 768 px eso daba **9 % de zoom**
  (los nodos medían 23×12 px: ningún clic era posible) y en 360 px la raíz quedaba **fuera del lienzo**
  (tapada por la barra lateral). Ahora, en ventanas de hasta 900 px, el mapa baja como máximo al
  **45 % de zoom** y queda **anclado en la raíz del Atlas** (`nodoAncla()`: la selección actual o la
  raíz), de modo que el nodo se lee y se toca. En escritorio **no se toca nada**: el encuadre completo
  se conserva tal cual lo conoce Rosas.
- **Clic en los nodos del mapa a 768 y 360 px**: verificado con clic real de Playwright. Antes el paso
  «navegar» de la auditoría fallaba con `Timeout 30000ms exceeded` en las dos medidas; ahora el clic
  abre el editor del nodo (`rr-labs`) en las dos.
- **«Unir» ya no se monta sobre el título a 390 px**: la cabecera de la vista BPMN pasa a íconos en
  celular (`▥`, `☰`, `←`) con `aria-label` y `title`, y el título se recorta con puntos suspensivos
  (`.bpmn-view__identidad > div { min-width: 0 }` + `max-width: 100 %` en el título). Medido: el título
  termina en 228 px y las acciones empiezan en 240 px → **sin solape** (antes: 258 vs 240).
- **Controles del diagrama en un botón «⋯»**: en celular la barra se queda con lo esencial (pantalla
  completa, editar, anterior, siguiente, zoom, encuadrar, guía) y **deshacer, rehacer, guardar copia,
  restaurar semilla y exportar (.bpmn, SVG, PNG)** quedan en el menú **«⋯»**, que va fijo a la
  izquierda de la barra deslizable. Las siete acciones miden 44 px de alto. En escritorio la barra
  sigue igual que antes (el menú es solo de celular).
- **Barra superior compacta en tablet** (≤ 900 px): marca y logo más chicos, «Añadir nodo» queda en el
  ícono `＋` y todos los botones siguen con 44 px de alto.
- **Gestos táctiles del tablero**: pan con un dedo y **pellizco con dos dedos** (zoom alrededor del punto
  medio). En pantalla táctil el nodo no se arrastra: el dedo mueve o pellizca el mapa; con ratón el
  arrastre de nodos sigue igual. El diagrama BPMN ya tenía `touch-action: none` en el contenedor de
  bpmn-js, así que el pellizco funciona también allí.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores fuera de la deuda documentada.
- `npm run audit:ux`: se vuelve a correr al cierre de este bloque (resultado en la tabla de abajo).
- Pruebas de clic propias (Playwright, `/usr/bin/google-chrome`): clic en nodo del mapa **ok** a 768 y
  360; pellizco en el mapa **ok** (zoom 45 % → 113 % en 390 px, 20 % → 51 % en 1440); pan con un dedo
  **ok**; cabecera BPMN **sin solape** a 390, 360 y 768; menú «⋯» abierto y dentro de la pantalla con
  las 7 acciones de 44 px; 0 errores de consola.

### Cambios en las pruebas
- `src/app/rr-tree-view.test.mjs`: el zoom móvil mínimo baja de 60 % a **45 %** (J8 y P2) porque el
  encuadre completo en celular dejó de ser usable. Se añadió la comprobación nueva: **la raíz del Atlas
  queda dentro del lienzo y se puede tocar** (≥ 90×44 px). En 1440 px las reglas de encuadre completo
  siguen iguales.

### Hallazgos / riesgos
- En celular el mapa ya no muestra el árbol entero de un vistazo (se ve la rama anclada). Es el precio de
  que los nodos se puedan tocar; el minimapa y «Encuadrar mapa» siguen disponibles.
- En 360 px la barra del diagrama sigue siendo una fila deslizable: «Guía del diagrama» y «＋ Añadir»
  quedan fuera de la vista inicial. El menú «⋯» sí queda visible.
- El arrastre de nodos con el dedo se desactivó a propósito (el dedo mueve el mapa). Si Rosas quiere
  reordenar en móvil, se puede reactivar con un modo explícito.

### Pendiente del bloque
- Item 8: modelo de datos v5 (fase 2 del mega prompt) con migración, store, export/import idempotente
  y validador de campos prohibidos.
- Aplicar las DECISIONES DE ROSAS (item B): quitar «RR Labs» del Mapa vivo, estados de clientes,
  «Guía provisional», leyenda con íconos, reparar las 16 semillas a 0 avisos de lint, bots vigentes.
- QA final (item D): clics reales de todos los flujos a 390, 768 y 1440 px + capturas por ancho.

### Segunda parte del bloque 7 · Decisiones de Rosas aplicadas (item B, parte 1)

- **Clientes**: BOGA, Candilejas e IMF quedan **activos**; los demás, **en pausa**. Se quitó «Sin
  confirmar» del estado de clientes (`src/data/inicio-tarjetas.mjs`). Nota: en las fuentes de RR el
  nombre canónico es «IMF Visions» (Rosas escribió «IMF Weddings»); se dejó el nombre de la fuente y
  queda la pregunta en `docs/fusion/PREGUNTAS.md`.
- **Bots vigentes**: Buen Puente y Becas de Exposición quedan **Vigentes**; Media Manager y Gains
  quedan **Sin confirmar** (`src/data/rr-tree.mjs`, `botDefinitions`).
- **Título**: el Mapa vivo ya no dice «RR Labs»: la raíz se llama «RR Aliados» y la barra de la vista
  editorial dice «RR Aliados → Atlas operativo».
- **Guía provisional**: la guía de cada diagrama arranca con el aviso visible **«Guía provisional»**
  (`src/bpmn/leyenda.mjs` + `src/app/bpmn-view.mjs` + estilos).
- **Leyenda**: la guía separa **«Tarea de persona»** (ícono de persona) y **«Tarea de bot»** (ícono de
  bot, con antena y dos puntos), con glifos distintos.

### Segunda parte del bloque 7 · Semillas BPMN reparadas (item B, parte 2)

- **Qué se reparó** (script nuevo `scripts/reparar-compuertas.mjs`, con `--simular` para ver el plan):
  1. **8 compuertas que abrían y cerraban a la vez** (`no-gateway-join-fork`): cada una se dividió en
     dos — una compuerta que **une** (sin nombre, como manda el estándar) y la que **reparte**, que
     conserva su nombre, sus salidas nombradas y su lugar en el diagrama.
  2. **24 tareas y eventos con varias entradas** (`fake-join`): se les puso delante una compuerta
     paralela que las une, como pide el estándar.
  3. **25 etiquetas de sobra** (`superfluous-label`): se quitó la etiqueta de los flujos que no salen de
     una compuerta de decisión (el «sí/no» de las compuertas exclusivas se conserva).
- **Cómo se colocaron las compuertas nuevas**: el script busca un sitio libre alrededor del nodo, sin
  tocar ninguna otra forma y siempre dentro del participante; si no cabe, la dibuja debajo del
  diagrama. El script deja el plan en pantalla antes de escribir (`--simular`).
- **Resultado del lint**: antes **196 avisos** (19 `fake-join`, 25 `superfluous-label`, 43
  `rr/lane-es-rol`, 109 `rr/tarea-infinitivo`); ahora **0 errores** y **152 avisos**, todos de estilo
  de contenido del plugin de RR. Las **reglas estructurales de bpmnlint quedan en 0 avisos**.
  `src/bpmn/seeds/deuda-modelado.json` queda con `casos: []` (la deuda G2 está reparada) y deja
  anotados los dos avisos de contenido que faltan.
- **Comprobaciones**: `npm run check` verde (202 tests), `npm run lint:bpmn` verde,
  `npm run verificar:bpmn-edicion` verde (escritorio y móvil), `npm run verificar:pantalla` verde,
  `npm run verificar:guia` verde, `npm run verificar:dividido` verde.
- `src/bpmn/seeds/validacion-semillas.json` se regeneró con el estado real de las 16 semillas.

### Lo que queda del item B
- **0 avisos de lint en el sentido estricto**: faltan los dos avisos de contenido (`rr/lane-es-rol`,
  43 carriles que se llaman como una etapa; `rr/tarea-infinitivo`, 109 tareas que no están en
  infinitivo). Cambiarlos es reescribir el texto que la gente lee en el diagrama, así que queda como
  **TODO(Rosas)** en `docs/fusion/PREGUNTAS.md` (pase de contenido con el equipo), no como un cambio
  automático.

## Bloque 8 · Item B (cierre) · Semillas BPMN con 0 avisos de lint — 2026-11-02

### Qué se hizo
- **Las 16 semillas quedaron en 0 avisos de lint** (decisión de Rosas: «reparar las 16 semillas hasta
  0 avisos», incluido `no-gateway-join-fork`). Antes de este bloque quedaban **152 avisos** de las
  dos reglas de contenido del plugin de RR: `rr/lane-es-rol` (43 carriles escritos como etapa:
  «1 · Alianzas», «2 · Los primeros días») y `rr/tarea-infinitivo` (109 tareas en forma de frase:
  «2. Se anota», «3. Prototipo»).
- **`scripts/pase-contenido-semillas.mjs` (nuevo)**: pase de contenido **idempotente** que reescribe
  solo el atributo `name` de carriles y tareas (no toca documentación, flujos, formas ni colores).
  Trae las tablas de nombres y las aplica semilla por semilla; `--simular` muestra el plan sin
  escribir. Resultado: **153 nombres corregidos** (43 carriles + 110 tareas).
  - **Carriles → roles de RR** (regla «un carril es un rol»): los 43 carriles que se llamaban como
    una etapa ahora se llaman con el rol que hace ese trabajo: Comercial, Dirección, Dirección
    Operativa, Dirección · Caja, Finanzas, Finanzas · Ingresos, Finanzas · Egresos, Legal, Soporte,
    Soporte · Prioridad, Equipo RR, Equipo RR · Resolución, Cliente, Bot, Solicitante, Contenido,
    Desarrollo. Los carriles vacíos que son anotaciones («Lo que no está escrito», «Las reglas que no
    se rompen», «Donde se traba», «A quién se le pregunta») conservan su texto con el rol adelante.
  - **Tareas → infinitivo de 2 a 6 palabras**: «2. Se anota» → «2. Registrar el prospecto» (el verbo
    depende del proceso: prospecto, caso o movimiento), «3. Prototipo» → «3. Construir el prototipo»,
    «8. Deploy» → «8. Hacer el deploy», «Alta · se resuelve ya» → «Resolver de inmediato (prioridad
    alta)». Se conserva el número de paso y el texto de la tarea en lo que ya estaba bien escrito.
- **`scripts/actualizar-estado-semillas.mjs` (nuevo)**: recalcula el estado real de las 16 semillas y
  lo deja escrito en `src/bpmn/seeds/index.json` (lint y estado por proceso) y en
  `src/bpmn/seeds/validacion-semillas.json` (errores, avisos y regla por regla). Corrección: el
  catálogo mostraba conteos viejos (p. ej. 1 error y 7 avisos) que ya no correspondían.
- **Insignias del Mapa vivo**: los 8 nodos que estaban en «BPMN con deuda» (CP-5, PL-1, IN-2, IN-3,
  IN-4, IN-5, IN-6, IN-12) son los que corresponde a las 8 semillas que tenían la deuda documentada.
  Como las 16 semillas ya pasan el lint, esos 8 nodos quedan en **«BPMN válido»**
  (`src/data/rr-tree.mjs`).
- **`fixtures/flujo-demo.json`** se regeneró (`npm run fixture:flujos`) porque se arma desde las
  semillas y el test de rutas exige que el fixture coincida con ellas.

### Estado de los checks
- `npm run check`: **verde** — 202 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — «16 semillas, moddle sin avisos, **0 errores**, 0 avisos».

### Hallazgos / riesgos
- Los nombres de los carriles son **roles genéricos de RR** (Comercial, Dirección, Finanzas, Soporte,
  Legal, Cliente, Bot, Equipo RR…), no el nombre del cargo del manual de roles: no hay fuente que
  diga qué persona o cargo está en cada carril. Queda como **TODO(Rosas)** en `docs/fusion/PREGUNTAS.md`.
- El texto de las tareas se reescribió sin cambiar el proceso: solo la forma verbal y el número de
  palabra. No se cambió ningún dato de RR (ni cifras, ni fuentes, ni cortes).
- Los avisos del plugin de RR son de estilo, no de estructura: el diagrama ya no tiene compuertas
  que abran y cierren a la vez, ni pasos con varias entradas, ni etiquetas de sobra.

### Pendiente del bloque
- **Item 8 (modelo de datos v5)**: esquema v5, migración desde v4, store, export/import idempotente
  y validador que rechace campos prohibidos, con pruebas `node --test`. No alcanzado en este bloque.
- **QA final (item D)**: clics reales de todos los flujos a 390, 768 y 1440 px, capturas por ancho en
  `docs/fusion/capturas/cierre-<flujo>-<ancho>.png` y resultado en `docs/fusion/PRUEBAS.md`.

## Bloque 8 · Item 8 (avance) · Modelo de datos v5 — 2026-11-02

### Qué se hizo
- **`src/core/model.mjs` (nuevo)**: esquema v5 del Atlas con las once entidades del mega prompt
  (área, rol, persona, línea de negocio, proyecto, cliente, sistema, proceso, paso, fragmento y
  tarea de plan). Toda entidad lleva `id`, `nombre`, `descripcion`, `fuente`, `corte`, `estado`,
  `etiquetas` y `actualizadoEn`. Funciones: `crearModelo`, `fusionar`, `validar`, `exportar`,
  `importar`, `diff`, `migrarDesdeV4` y `migrarDesdeEstadoA`.
  - **Migración desde el export v4** (el JSON versionado del mapa vivo de producción): cada nodo del
    mapa se vuelve entidad del esquema v5 según su tipo (proceso, rol/bot, línea, cliente, área,
    proyecto) y su `statusKey` se traduce a `estadoBpmn` (válido, borrador, con deuda, solo texto,
    no existe, en pausa).
  - **Migración desde el estado de la rama A** (`atlas-state` v1): sus nodos se vuelven procesos en
    borrador.
  - **Validador**: rechaza los campos prohibidos (salario, cédula, cuenta, cuenta bancaria, número de
    cuenta, token, password, clave, secret, contraseña) y exige `id`, `nombre`, `fuente` y `corte`
    en toda entidad. «cuenta de cobro» sí se admite: es un flujo de RR, no una cuenta bancaria.
  - **Export/import idempotente**: `exportar(importar(paquete))` devuelve el mismo paquete (se
    conserva el `exportadoEn`), y `importar` valida antes de tocar nada.
- **`src/core/store.mjs` (nuevo)**: estado único con **diff sobre la base** (no copia la base),
  historial con tope de 100 instantáneas, persistencia en `localStorage` (`rr-atlas:v5`),
  `restaurarBase()`, `exportar()`, `importar()` (devuelve el diff para pedir confirmación) y
  `validar()`.
- **`src/data/base/*.json` (nuevo)**: la base versionada de RR con el contenido que hay en el repo y
  en `~/rr-encargos/2026-11-02_atlas-cierre/inventario.md`:
  - `empresa.json`: qué es RR, sede, constitución, tagline, posicionamiento, forma de trabajo,
    capacidades, principios, **8 áreas** y **8 líneas de negocio**.
  - `equipo.json`: **24 roles** (7 humanos, 14 bots, 2 externos) y **7 personas** (5 activos, 2
    históricos). PM y Camarógrafo quedan «sin confirmar». Bots: los 11 del Manual (vigentes) más
    Buen Puente y Becas de Exposición (vigentes, decisión de Rosas) y Media Manager y Gains
    («sin confirmar»).
  - `clientes.json`: 11 clientes. **Activos: BOGA, Candilejas + 553 e IMF Weddings**; los demás en
    pausa (decisión de Rosas del 2-nov). Sin «Sin confirmar» en el estado.
  - `proyectos.json`: 10 proyectos o productos y 12 sistemas o herramientas. **Notion no aparece.**
  - `procesos.json`: **45 procesos** del guion §6 con objetivo, disparador, resultado y `estadoBpmn`
    (los 16 con semilla en «válido»; el resto «borrador» o «no existe»).
- **Scripts nuevos**: `npm run semillas:contenido` (pase de contenido de las semillas, con
  `--simular`) y `npm run semillas:estado` (recalcula el estado real de las 16 semillas y lo escribe
  en el catálogo y en el reporte).

### Estado de los checks
- `npm run check`: **verde** — 223 tests pass (antes 202), 0 fail, build ok.
  - 15 pruebas nuevas de `src/core/model.test.mjs` y `src/core/store.test.mjs`: migración desde v4,
    migración desde el estado de A, **export→import idempotente**, rechazo de los campos
    prohibidos (salario, cédula, cuenta, token, password), diff, persistencia en `localStorage`,
    restaurar base y tope del historial.
  - 6 pruebas nuevas de `src/data/base/base.test.mjs`: la base pasa el validador, trae las once
    colecciones, **toda entidad tiene fuente y corte**, **no hay cifras financieras** y los 16
    procesos con semilla están en estado «válido».
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.

### Hallazgos / riesgos
- Los carriles de los diagramas quedaron con roles genéricos (Comercial, Dirección, Finanzas…); el
  mapeo de **carril → rolId del modelo** (para el campo `carriles` y la matriz RACI) queda
  pendiente: no hay fuente que diga qué cargo del manual de roles está en cada carril.
- La base se carga en el repo pero **la vista Datos (`#/datos`) todavía no está conectada al store**:
  el store, el export/import y el restaurador existen y están probados, pero falta la pantalla.

### Pendiente del bloque
- Conectar el store a la app: vista Datos (`#/datos`) con export/import, diff, confirmar y
  «Restaurar base», e historial de cambios.
- **QA final (item D)**: clics reales de todos los flujos a 390, 768 y 1440 px, capturas por ancho en
  `docs/fusion/capturas/cierre-<flujo>-<ancho>.png` y resultado en `docs/fusion/PRUEBAS.md`.
