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

## Bloque 8 · Item D · QA final con clics reales — 2026-11-02

### Qué se hizo
- **`scripts/verificar-cierre.mjs` (nuevo, `npm run verificar:cierre`)**: QA de cierre con Chrome
  real (Playwright) sobre `dist/`. Prueba **8 flujos × 3 anchos (390, 768 y 1440 px) = 24
  pruebas**, con clics de verdad: mapa vivo (clic en un nodo y el editor abre), búsqueda («finanzas»
  filtra el mapa), catálogo BPMN, apertura de un diagrama (pantalla completa, con formas
  dibujadas), edición en el diagrama (modo Editar, clic en una forma, cambio de nombre y guardado),
  guía del diagrama (se abre con el aviso «Guía provisional»), botón de pantalla completa (⛶ divide y
  vuelve a unir) y pantalla dividida (el panel abre).
- Cada prueba deja su captura en **`docs/fusion/capturas/cierre-<flujo>-<ancho>.png`** (24
  capturas) y el resultado crudo en **`docs/fusion/PRUEBAS.json`**.
- **`docs/fusion/PRUEBAS.md`**: sección del item D con el conteo de pruebas, el resultado por flujo
  y ancho, el conteo de avisos de lint y las 24 capturas.

### Estado de los checks
- `npm run verificar:cierre`: **verde** — 24 de 24 pruebas, **0 errores de consola**.
- `npm run check`: **verde** — 223 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, **0 errores y 0 avisos**.

### Hallazgos / riesgos
- El clic sobre una forma del diagrama tiene que hacerse con coordenadas (centro de la forma):
  el grupo SVG nunca queda «estable» para el `click()` del locator porque el lienzo está escalado.
  No es un defecto de la app; queda anotado para que las pruebas futuras no se confundan.
- Los ocho flujos pasan con **cero errores de consola** en los tres anchos, incluido el modo
  Editar a 390 px (que antes no se probaba).

### Pendiente del bloque
- **Item 8 (cierre)**: falta conectar el store v5 a la app (vista Datos `#/datos` con export/import,
  diff, confirmar y «Restaurar base») y el mapeo de los carriles de los diagramas a los roles del
  modelo (`carriles` y matriz RACI).

## Bloque 9 · Item 8 (cierre) · La vista Datos ya está conectada al store v5 — 2026-11-02

### Qué se hizo
- **El store v5 ya es parte de la app**: la vista **Datos** (`#/datos`, botón «⛁ Datos» en la barra
  superior) es la pantalla que el mega prompt pide en §2.
  - **`src/app/datos-view.mjs` (nuevo)**: resume lo que hay en el Atlas (las once colecciones del
    esquema v5 con su conteo), exporta el modelo completo a un JSON versionado, **importa un JSON
    validando antes y pidiendo confirmación** (muestra el diff del archivo y un botón «Sobrescribir
    con el archivo»), restaura la base del repo con confirmación, muestra el **validador** y el
    **historial** de cambios, y lista las **fuentes y cortes** de todo lo que hay cargado.
  - **La base se carga desde el repo por `fetch`** (`src/data/base/*.json`), no como módulos JSON:
    así la app **no depende** de que el navegador soporte módulos JSON (si la base no carga, se cae
    solo la vista Datos y el resto del Atlas sigue vivo). La composición de la base vive en
    `src/data/base/componer.mjs`, que usan lo mismo las pruebas de Node y el navegador.
  - **`src/styles/datos.css` (nuevo)**: estilos con los tokens de B (nada de colores propios) y
    breakpoint de 900 px para que en tablet y celular los botones queden con 44 px de alto.
  - **`src/app/rr-tree.mjs`**: la ruta `#/datos` abre la vista y la esconde cuando se vuelve al
    mapa; los atajos del mapa quedan apagados mientras la vista Datos está abierta.
- **Pruebas**: `src/app/datos-view.test.mjs` (5 pruebas nuevas). `npm run check`: **228 tests pass,
  0 fail**. `npm run verificar:cierre`: **27 de 27** (9 flujos × 3 anchos), **0 errores de consola**.
- **QA de cierre actualizado**: `scripts/verificar-cierre.mjs` ahora incluye el flujo «datos» con
  clics reales (abrir la vista, leer el resumen, pasar el validador y descargar el JSON).

### Estado de los checks
- `npm run check`: **verde** — 228 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:cierre`: **verde** — 27 de 27, 0 errores de consola.

### Hallazgos / riesgos
- La base se baja por `fetch` y **de forma perezosa** (solo cuando se abre la vista Datos): si el
  servidor no sirve los `.json`, la vista avisa por toast y el resto de la app no se entera.
- La importación **reemplaza** los cambios locales del equipo: por eso la vista muestra el diff
  del archivo y pide confirmación antes de sobrescribir.
- El **mapeo de los carriles de los diagramas a los roles del modelo** (`carriles` y matriz RACI)
  sigue pendiente: los carriles quedaron con roles genéricos porque no hay fuente que diga qué
  cargo real está en cada carril. Queda como **TODO(Rosas)** en `docs/fusion/PREGUNTAS.md`.

### Pendiente del bloque
- Cerrar el **mapeo carril → rol** de los 16 diagramas (depende de la respuesta de Rosas sobre los
  nombres de los carriles).
- Revisar con Rosas las preguntas abiertas de `docs/fusion/PREGUNTAS.md`.

## Bloque 9 · Item 8 (cierre, 2ª parte) · Los carriles de los 16 diagramas ya están en el modelo — 2026-11-02

### Qué se hizo
- **`src/core/carriles.mjs` (nuevo)**: diccionario **carril → rol** del modelo v5, con la fuente de cada
  decisión escrita en el archivo. Solo se mapea lo que una fuente de RR respalda:
  «Dirección» → CEO (mega prompt §6.1 y §6.12), «Dirección Operativa» → Director Operativo (manual de
  roles), «Finanzas», «Finanzas · Ingresos» y «Finanzas · Egresos» → Bot Fin (Manual de los bots, corte
  2026-10-24: «CFO automático»), «Legal» → Abogado externo (manual de roles) y «Desarrollo» → Project
  Manager / Programador (manual de roles; ese rol sigue «sin confirmar»).
  **Lo que no tiene fuente queda pendiente, no inventado**: Comercial, Contenido, Soporte, Cliente,
  Bot, Solicitante, Equipo RR y los carriles con coletilla («Equipo RR · Donde se traba»).
- **`scripts/extraer-carriles.mjs` (nuevo, `npm run carriles:extraer`)**: lee los 16 diagramas de
  `src/bpmn/seeds/`, saca los nombres de carril y los deja en `src/data/base/procesos.json`:
  `carriles` (ids de rol), `carrilNombres` (lo que se lee en el diagrama) y `carrilPendientes`.
  El archivo se parchea por texto (una entidad por línea), así que el diff solo toca las 16 líneas
  que cambian. Trae `--simular` para ver el plan sin escribir.
- **Pruebas** (`src/core/carriles.test.mjs`, 4 pruebas): el diccionario solo apunta a roles que
  existen en la base; la normalización de nombres; la separación entre roles y pendientes; y que los
  16 procesos con semilla traen los carriles que se leen en el diagrama, sin carriles en los dos
  lados (mapeado y pendiente a la vez).

### Estado de los checks
- `npm run check`: **verde** — 232 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:cierre`: **verde** — 27 de 27 (9 flujos × 3 anchos), 0 errores de consola.

### Hallazgos / riesgos
- Los nombres de carril que se leen en el diagrama («Dirección», «Finanzas») no son los cargos del
  manual de roles: por eso el diagrama conserva su lectura y el modelo guarda el rol aparte. El
  cambio de los nombres de carril **depende de la respuesta de Rosas** (queda en `PREGUNTAS.md`).
- El mapeo es una decisión de lectura, no un dato de RR: por eso cada entrada del diccionario lleva
  la fuente que la respalda en el comentario del archivo.

### Pendiente del bloque
- Respuesta de Rosas sobre los nombres de los carriles y el mapa de los que quedaron pendientes.

## Bloque 10 · Item A (cierre) · Verificación táctil automática y objetivos de 44 px — 2026-11-02

### Qué se hizo
- **Los ítems A, B, C y D ya estaban cerrados** en los bloques 7, 8 y 9 (responsive y táctil,
  decisiones de Rosas, modelo de datos v5 y QA final). Este bloque los **verificó con pruebas
  automáticas repetibles** y encontró un defecto real que en el bloque 7 se había medido a mano.
- **`scripts/verificar-tactil.mjs` (nuevo, `npm run verificar:tactil`)**: 18 pruebas con Chrome real
  (6 flujos × 3 anchos: 390, 768 y 360 px), con eventos de puntero de verdad:
  1. **objetivos** → todos los controles visibles miden 44 px de alto (y de ancho cuando el control
     es solo un ícono);
  2. **cabecera** → el título de la vista BPMN no se monta sobre las acciones (el «Unir» sobre el
     título a 390 px);
  3. **menu** → en celular los controles menos usados están en el botón «⋯» (deshacer, rehacer,
     guardar, restaurar, exportar) y caben en la pantalla;
  4. **pellizco-mapa** y **pan-mapa** → gestos de dos dedos y de un dedo en el tablero;
  5. **pellizco-diagrama** → pellizco con dos dedos en el lienzo de bpmn-js.
  Salidas: `docs/fusion/capturas/tactil-<flujo>-<ancho>.png` y `docs/fusion/TACTIL.json`.
- **Defecto real encontrado y corregido**: los botones del nodo del mapa (colapsar/expandir) medían
  **19,8 px en pantalla** cuando el tablero está encuadrado al 45 %: el zoom del lienzo también
  reduce los controles, así que el tamaño de 44 px del CSS se quedaba en el papel. Ahora el tablero
  publica su zoom invertido (`--zoom-inv`) y los controles se compensan con él
  (`src/app/rr-tree.mjs` + `src/styles/rr-tree.css`), de modo que **miden 44 px en pantalla** en
  celular y tablet. La marca RR de la barra superior también quedó con 44 px de alto.
  **En escritorio (>900 px) no se toca nada**: el look que le gusta a Rosas queda igual.
- El script también confirmó, con las mismas cifras, lo que el bloque 7 midió a mano: la cabecera
  sin solape (título 228 px, acciones desde 240 px a 390 px), el menú «⋯» con 7 acciones de 44 px,
  el pellizco del tablero (45 % → 101 %) y el pan con un dedo.

### Estado de los checks
- `npm run check`: **verde** — 232 tests pass, 0 fail, build ok.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:tactil`: **verde** — 18 de 18, **0 errores de consola**.
- `npm run verificar:cierre`: **verde** — 27 de 27 (9 flujos × 3 anchos), 0 errores de consola.

### Hallazgos / riesgos
- La compensación del zoom hace que los botones del nodo se vean más grandes que la tarjeta cuando
  el mapa está muy alejado: es el precio de que el dedo los alcance, y solo aplica en ≤900 px.
- El tamaño del nodo (la tarjeta completa) sigue siendo el que marca el encuadre; los controles
  pequeños son los que se compensaron.

### Pendiente del bloque
- El **mapeo carril → rol** de los 16 diagramas sigue esperando la respuesta de Rosas sobre los
  nombres de los carriles (queda en `docs/fusion/PREGUNTAS.md`).

## Bloque 11 · Cierre final · Puerta de salida del PR (ítems A, B, C y D verificados) — 2026-11-02

### Qué se hizo
- Los cuatro ítems del bloque (A · responsive y táctil, B · decisiones de Rosas, C · modelo de datos
  v5, D · QA final) **ya estaban cerrados** en los bloques 7 a 10. Este bloque los **verificó de
  punta a punta** con una comprobación automática nueva y repetible.
- **`scripts/verificar-cierre-final.mjs` (nuevo, `npm run verificar:cierre:final`)**: 24
  comprobaciones estáticas (Node, sin navegador, 0,36 s) que miran el código y los datos, no la
  pantalla:
  - **Decisiones de Rosas (item B)**: el título y el subtítulo son «RR Aliados · Atlas operativo» y
    no queda «RR Labs» en `src/`, `index.html` ni `dist/`; las fuentes son Inter Tight y Lexend; la
    entrada es el Mapa vivo; «Volver al hub» está oculto; BOGA, Candilejas e IMF Weddings están
    activos y los demás clientes en pausa (ninguno «sin confirmar»); la guía de cada diagrama
    muestra «Guía provisional»; la leyenda tiene íconos distintos para tarea de bot y de persona;
    las **16 semillas pasan el lint con 0 errores y 0 avisos**; abrir un diagrama siempre lo deja a
    pantalla completa; Buen Puente y Becas de Exposición están vigentes y Media Manager y Gains
    «sin confirmar».
  - **Modelo v5 (item C)**: esquema 5 con la clave `rr-atlas:v5`; migración desde el JSON v4 de B y
    desde el estado de la rama A; `exportar(importar(paquete))` es idéntico al paquete; el validador
    rechaza `salario`, `cedula`, `cuenta`, `token` y `password`; los **124 registros** de la base
    traen fuente y corte; y no hay ninguna cifra financiera en los datos ni en el bundle.
  - **Entregables (items A y D)**: las 27 capturas `cierre-<flujo>-<ancho>.png` (9 flujos × 3
    anchos) existen; `PRUEBAS.md` trae el conteo de pruebas y «0 errores y 0 avisos»;
    `PREGUNTAS.md` registra las decisiones como RESUELTO; `BITACORA.md` tiene los bloques.
- **La puerta quedó dentro de `npm run check`**: `check` ahora es «sintaxis → pruebas → build →
  verificar:cierre:final», así que CI corre la comprobación en cada push y el PR no puede quedar
  en verde si alguien rompe una de las decisiones de Rosas o mete un campo prohibido.
- **Evidencia cruda**: `docs/fusion/CIERRE.json`.

### Estado de los checks
- `npm run check`: **verde** — 232 tests pass, 0 fail, build ok y **24/24** comprobaciones de
  cierre.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:cierre`: **verde** — 27 de 27 (9 flujos × 3 anchos), 0 errores de consola.
- `npm run verificar:tactil`: **verde** — 18 de 18 (6 flujos × 390, 768 y 360 px), 0 errores de
  consola.

### Hallazgos / riesgos
- La puerta comprueba **el código y los datos**, no el pixel: los clics reales siguen siendo los de
  `npm run verificar:cierre` (27) y `npm run verificar:tactil` (18), que se corrieron de nuevo en
  este bloque y volvieron a dar 0 errores de consola.
- La puerta lee `dist/` cuando existe: si el build no se ha hecho, dos comprobaciones (la de
  «RR Labs» en el bundle y la de cifras) miran solo `src/` y `index.html`; por eso va **al final**
  de `npm run check`, después del build.
- `npm run check` tarda un poco más que antes (el build es lo que pesa): la puerta en sí son
  0,36 s.

### Pendiente del bloque
- El **mapeo carril → rol** de los 16 diagramas sigue esperando la respuesta de Rosas sobre los
  nombres de los carriles (queda en `docs/fusion/PREGUNTAS.md`).
- El PR #7 sigue **en borrador** y sin fusionar: la decisión final es de Rosas.

### Cierre del bloque (2-nov, tarde)
- El PR #7 quedó **actualizado y en borrador**: el título ahora es «Fusión del Atlas RR (A → B): BPMN
  en el shell de RR, modelo v5 y QA de cierre» y el cuerpo cuenta las fases, las decisiones de Rosas
  aplicadas, las pruebas (232 tests, 27 de 27 de clics reales, 18 de 18 táctiles, 24 de 24 de la
  puerta de cierre) y lo que necesita Rosas. Sigue **sin fusionar y sin desplegar**.
- `gh pr edit` no funciona en este repo (error de la API de proyectos clásicos); el cuerpo se
  actualizó por la API REST (`gh api -X PATCH repos/.../pulls/7 -F body=@archivo`).

## Bloque 12 · Huecos «sin confirmar» visibles en la app (mega prompt §10) — 2026-11-02

### Qué se hizo
- Los ítems A, B, C y D **ya estaban cerrados** (bloques 7 a 11) y la puerta de cierre ya los
  comprobaba. Este bloque cerró el **último hueco que faltaba del mega prompt**: el §10 pide que
  los «sin confirmar» **se vean en la app**, y hasta ahora solo estaban en la documentación y
  como marca suelta en algunos registros de la base.
- **`src/data/pendientes.mjs` (nuevo)**: los **21 huecos** del Atlas RR con `id`, `titulo`,
  `detalle`, `tipo`, `fuente`, `corte` y `estado: «sin confirmar»». Cubren la lista mínima del §10:
  Project Manager y Camarógrafo por definir; SLA de soporte; quién cubre soporte; KPI de
  producción; método de la sesión de grabación; quién puede tener cuenta de cobro; obligaciones
  fiscales; precios y planes de SaaS Ropa/Resto/Creadores; estado de Buen Puente; vigencia de la
  flota Hermes; Media Manager y Gains; las personas de la tarjeta de talento de la rama A; los
  cargos reales de los carriles; la tipografía oficial del brand kit; la relación
  Zapatos/Shoes Colombia; los clientes en pausa; el nombre canónico de IMF; las rutas `/bpmn/`,
  `/flujos/` y `/grafo/` de A; las cifras de demostración de A; y las notas del vault vencidas.
  **Sin cifras financieras y sin datos personales.**
- **Vista Datos (`#/datos`)**: panel nuevo **«Lo que falta confirmar»**, agrupado por tipo, con el
  detalle de cada hueco y su fuente y su corte. Se pinta aunque la base no haya cargado.
- **Panel Inicio** de la pantalla dividida: grupo **«Sin confirmar»** con los 21 huecos.
- **Pruebas**: `src/data/pendientes.test.mjs` (6 pruebas: fuente y corte en todo hueco, estado
  «sin confirmar», ids sin repetir, cobertura de la lista mínima del §10, sin cifras financieras,
  agrupación legible).
- **Puerta de cierre**: `scripts/verificar-cierre-final.mjs` gana dos comprobaciones
  (`pendientes-visibles` y `pendientes-minimos`): 24 → **26**, y sigue dentro de `npm run check`.
- **QA de cierre**: `scripts/verificar-cierre.mjs` gana el flujo **«pendientes»** (abre la vista
  Datos y comprueba que la lista se ve con fuente y corte): 27 → **30** pruebas (10 flujos × 3
  anchos) y 3 capturas nuevas (`cierre-pendientes-390/768/1440.png`).

### Estado de los checks
- `npm run check`: **verde** — 238 tests pass, 0 fail, build ok y puerta de cierre 26/26.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:cierre`: **verde** — 30 de 30 (10 flujos × 3 anchos), 0 errores de consola.
- `npm run verificar:tactil`: **verde** — 18 de 18 (6 flujos × 390, 768 y 360 px), 0 errores de consola.

### Hallazgos / riesgos
- La lista de huecos **no entra al store v5**: es un inventario de lo que falta, no una entidad
  editable del modelo. Por eso vive en `src/data/pendientes.mjs` y no en `src/data/base/*.json`.
- El «Sin confirmar» que decidió Rosas quitar del **estado de los clientes** sigue fuera: esta
  lista es de huecos de información, no de estados de cliente.
- Cada hueco apunta a una fuente escrita de RR o al inventario; lo que no tiene fuente escrita no
  se inventa: queda «sin confirmar» con su corte.

### Pendiente del bloque
- El **mapeo carril → rol** de los 16 diagramas sigue esperando la respuesta de Rosas sobre los
  nombres de los carriles (queda en `docs/fusion/PREGUNTAS.md`).
- El PR #7 sigue **en borrador** y sin fusionar: la decisión final es de Rosas.

## Bloque 12 · Parte 2 · Mapeo carril → rol (avance) — 2026-11-02

### Qué se hizo
- El único pendiente que quedaba del bloque 11 era el **mapeo carril → rol** de los 16 diagramas.
  Se avanzó **dos carriles más** que sí tienen fuente en RR, y el resto se dejó pendiente (no se
  inventa):
  - **«Comercial» → Bot Captación**: el mega prompt §6.2.1 pone el carril de «Oportunidad a
    cliente» como «Comercial/Captación» y el Manual de los bots (corte 2026-10-24) describe a
    Captación como el de estrategia y reparto de leads. En el manual de roles **no hay** un cargo
    humano de ventas, así que el único rol con fuente es el bot.
  - **«Contenido» → Director Creativo**: el mega prompt §6.3.4 lista el carril de «Producción de
    una pieza de contenido» como «Dir. Creativo, Consultora, Editor, Camarógrafo (por definir),
    cliente», y el manual de roles (corte 2026-09-26) pone contenido crudo y liderazgo de
    grabación en el Director Creativo.
- `src/data/base/procesos.json` se regeneró con `npm run carriles:extraer`: el diff toca **solo 6
  líneas** (los 6 procesos que tienen carril «Comercial» o «Contenido»).
- **Lo que sigue pendiente** (sin fuente): «Soporte», «Soporte · Prioridad», «Cliente», «Bot»,
  «Solicitante» y «Equipo RR» con sus coletillas. No hay cargo humano de soporte, ni rol externo
  para el cliente, ni un «solicitante» en el manual de roles: se quedan como «sin confirmar» y la
  pregunta sigue abierta en `docs/fusion/PREGUNTAS.md`.

### Estado de los checks
- `npm run check`: **verde** — 238 tests pass, 0 fail, build ok y puerta de cierre 26/26.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:cierre`: **verde** — 30 de 30, 0 errores de consola.
- `npm run verificar:tactil`: **verde** — 18 de 18, 0 errores de consola.
- `npm run audit:ux`: **verde** — 3 viewports × 7 pasos, 0 errores de consola.

## Bloque 1 · Cadena de pulido · Visor BPMN a 390 px + unificación de IMF — 2026-11-02 (21:33)

### Qué se hizo
- **Decisiones de Rosas aplicadas y registradas** en `docs/fusion/PREGUNTAS.md` como **RESUELTO**:
  (1) «IMF Weddings» e «IMF Visions» son **el mismo cliente** → un solo nombre, sin duplicados;
  (2) **Wundeer sigue en pausa**; (3) los **carriles sin rol** (Soporte, Soporte · Prioridad,
  Cliente, Bot, Solicitante, Equipo RR y sus coletillas) **se quedan «sin confirmar» y no se
  tocan**.
- **(a) El diagrama abre encuadrado** (`src/bpmn/entry.mjs`): `fit-viewport` con centrado en
  cualquier pantalla, también en celular. Antes, con un lienzo angosto, el visor arrancaba en
  `showStep(0)`: pegado a la izquierda, mostrando solo el evento de inicio. Ahora el diagrama
  completo se ve de una vez, con un 6 % de aire alrededor (para que el borde del pool no quede
  pegado al marco). El recorrido «Anterior/Siguiente» sigue haciendo zoom al paso.
- **(b) El título del pool no lo tacha ninguna línea** (`src/bpmn/rr-renderer.mjs`): se eliminó el
  `unrotateLaneLabel` que tumbaba el título de la piscina y el nombre de los carriles en horizontal
  (cruzando el borde y la línea de la banda) y se respetó el dibujo vertical nativo de bpmn-js.
  Como el motor ancla el texto por la línea base, con mayúsculas acentuadas («CÓMO…») la caja se
  subía y rozaba el borde: `centrarTitulosEnBanda()` (en `entry.mjs`) recentra la tinta dentro de
  la banda de 30 unidades.
- **(c) La etiqueta «entra» no se monta sobre el ícono del evento de inicio**
  (`src/bpmn/rr-renderer.mjs`): la palabra se pone al lado libre de la forma, arriba cuando el
  nombre del evento está abajo (que es lo habitual en las 16 semillas) y abajo si no.
- **Unificación de IMF en los datos y en la interfaz**: `src/data/base/clientes.json`,
  `src/data/inicio-tarjetas.mjs` y `src/data/ecosystem-catalog.mjs` quedan con un solo nombre,
  «IMF Weddings». En `src/data/pendientes.mjs` el hueco «Nombre canónico de IMF» se cierra (queda
  como RESUELTO en PREGUNTAS) y se abre el hueco real que queda: el alcance del prototipo de bodas
  y su responsable. Se actualizó `src/data/pendientes.test.mjs`, que dependía del nombre anterior.
- **Prueba nueva**: `scripts/verificar-pulido.mjs` (`npm run verificar:pulido`) revisa los tres
  arreglos en los **16 diagramas a 390 px** con Chrome real y deja la evidencia en
  `docs/fusion/PULIDO.json` y tres capturas `pulido-<flujo>-390.png`.
- **Puerta de cierre**: `scripts/verificar-cierre-final.mjs` gana la comprobación
  `imf-unificado` (un solo nombre y sin duplicados): 26 → **27**.

### Estado de los checks
- `npm run check`: **verde** — 238 tests pass, 0 fail, build ok y puerta de cierre **27/27**.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:pulido`: **verde** — 16 de 16 diagramas con los tres arreglos bien a 390 px,
  0 errores de consola. La misma prueba en escritorio (`node scripts/verificar-pulido.mjs 1440`)
  también da **16 de 16**.
- `npm run verificar:cierre`: **verde** — 30 de 30 (10 flujos × 3 anchos), 0 errores de consola.
- `npm run verificar:tactil`: **verde** — 18 de 18 (6 flujos × 390, 768 y 360 px), 0 errores de consola.

### Hallazgos / riesgos
- En el celular el diagrama encuadrado se ve **pequeño** (escala 1:4 a 1:8 según el proceso): es
  lo que pide «zoom fit al contenido». Para leerlo hay que pellizcar (ya funciona) o usar los
  botones de zoom de la barra y la tecla `F` para volver a encuadrar.
- La palabra «entra» del evento de inicio se decide con la posición de la etiqueta del evento en el
  DI: si el nombre está abajo, la palabra va arriba; si no, abajo.
- No se tocó ningún carril de los diagramas: los que no tienen rol siguen «sin confirmar».

### Pendiente del bloque
- El **mapeo carril → rol** de los 16 diagramas sigue esperando la respuesta de Rosas (queda en
  `docs/fusion/PREGUNTAS.md`).
- El PR #7 sigue **en borrador** y sin fusionar: la decisión final es de Rosas.

### Evidencia
- `docs/fusion/PULIDO.json` (16 diagramas a 390 px, los tres arreglos y 0 errores de consola) y
  `docs/fusion/PULIDO-1440.json` (la misma comprobación en escritorio).
- `docs/fusion/capturas/pulido-gobierno_como_se_gobierna_la_documentacion-390.png`,
  `pulido-ventas_como_una_oportunidad_se_convierte_en_cliente-390.png`,
  `pulido-finanzas_como_entra_y_se_sale_la_plata-390.png`.
- `docs/fusion/CIERRE.json` (27/27) y `docs/fusion/PRUEBAS.md`.

---

## Bloque 2 · Pulido UX en celular (390 y 360 px) — 2026-11-02

Alcance: **solo arreglos de bajo riesgo** (textos cortados, solapes, espaciados y objetivos
táctiles ≥ 44 px). Sin rediseños y sin cambios de lógica: ni rutas, ni datos, ni atajos, ni
estados. El PR #7 sigue **en borrador** y sin fusionar.

### Qué se hizo
- **Prueba nueva `scripts/verificar-movil.mjs` (`npm run verificar:movil` — aún no está en
  `package.json`)**: recorre con Chrome real cinco superficies del Atlas a **390 px y 360 px**
  (mapa vivo, hoja del inspector, catálogo BPMN, diagrama BPMN y vista de datos) y mide cuatro
  cosas: (1) que todo control visible mida 44 px de alto (y de ancho si es solo ícono),
  (2) que ningún texto quede cortado sin señal, (3) que dos controles no se pisen y (4) que
  nada quede fuera de pantalla o tapado por otra capa. Deja la evidencia en
  `docs/fusion/MOVIL.json` y en las capturas `movil-<superficie>-<ancho>.png`.
- **La barra de controles del catálogo BPMN ya no se apila en tres filas** (`src/styles/bpmn.css`,
  regla nueva en `@media (max-width: 760px)`): antes ocupaba **165 px** de alto y empujaba el
  lienzo fuera de la pantalla; ahora es **una sola fila que se desliza con el dedo** (57 px),
  igual que en pantalla completa. El diagrama pasó de verse cortado (~155 px visibles) a
  **265 px completos** a 390 px y **240 px** a 360 px.
- **El catálogo BPMN no se desliza de lado**: el nombre del archivo de la semilla
  (`ventas_como_una_oportunidad_se_convierte_en_cliente`) era una palabra larga que estiraba la
  tarjeta y hacía el catálogo 448 px de ancho dentro de 390 px. Con `overflow-wrap: anywhere` y
  `min-width: 0` el catálogo vuelve a medir exactamente el ancho de la pantalla.
- **Espaciado vertical en el celular**: el catálogo baja de 180 px a 160 px, el lienzo mínimo
  pasa de 320 px a 240 px y la línea de ayuda del catálogo («Elige un proceso…») se oculta en
  ≤ 760 px porque repetía lo que ya dicen las tarjetas. A 390 px la vista completa **ya no
  tiene scroll vertical** (antes sobraban 171 px); a 360 px quedan 45 px de scroll.
- **Decisiones de Rosas (2-nov 21:33) verificadas y sin tocar**: «IMF Weddings» e «IMF Visions»
  siguen unificados en un solo cliente (datos e interfaz), **Wundeer sigue en pausa** y los
  **carriles sin rol** (Soporte, Soporte · Prioridad, Cliente, Bot, Solicitante, Equipo RR y sus
  coletillas) **continúan «sin confirmar»**. Ya estaban registradas como RESUELTO en
  `docs/fusion/PREGUNTAS.md`; en este bloque no se tocaron ni datos ni diagramas.

### Estado de los checks
- `npm run check`: **verde** — 238 tests pass, 0 fail, build ok y puerta de cierre **27/27**.
- `npm run verificar:movil`: **verde** — **10 de 10** (5 superficies × 390 y 360 px), 0 errores de
  consola, 0 controles por debajo de 44 px, 0 textos cortados, 0 solapes y 0 desbordes.
- `npm run verificar:pulido`: **verde** — 16 de 16 diagramas con los tres arreglos del bloque 1.
- `npm run verificar:tactil`: **verde** — 18 de 18 (6 flujos × 390, 768 y 360 px).

### Hallazgos / riesgos
- En 360 px (740 px de alto) la vista BPMN completa deja **45 px de scroll vertical**: el alto
  de la cabecera del shell (148 px) más la de la vista BPMN (142 px) se come la pantalla. Con una
  barra de navegación inferior fija (la tabbar de la fase 6) el espacio útil baja más: puede
  volver a hacer falta scroll. Queda anotado como pregunta abierta, no se rediseñó nada.
- Los nodos del tablero infinito miden menos de 44 px en pantalla cuando el mapa está alejado
  (efecto del zoom). Es el comportamiento ya aceptado del item A: los controles de cada nodo se
  compensan con `--zoom-inv` y el tablero se puede pellizcar. La prueba lo excluye a propósito.
- La prueba `verificar-movil.mjs` mide el **elemento que está realmente arriba** en cada punto
  (`elementFromPoint`), así que una vista a pantalla completa (el diagrama BPMN tapa el shell) no
  se reporta como un error de tapado.

### Pendiente del bloque
- La **tabbar** de la fase 6 (navegación inferior en el celular) sigue sin existir: en el
  celular se entra al BPMN con el botón «◇ BPMN» de la barra superior, que ya es visible.
- El **mapeo carril → rol** de los 16 diagramas sigue esperando la respuesta de Rosas (queda en
  `docs/fusion/PREGUNTAS.md`).
- El PR #7 sigue **en borrador** y sin fusionar: la decisión final es de Rosas.

### Evidencia
- `docs/fusion/MOVIL.json` (10 pruebas: táctil, cortes, solapes y desbordes a 390 y 360 px).
- `docs/fusion/capturas/movil-mapa-390.png`, `movil-hoja-390.png`, `movil-catalogo-390.png`,
  `movil-diagrama-390.png`, `movil-datos-390.png` y las mismas a 360 px.
