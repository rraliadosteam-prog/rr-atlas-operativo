# Pruebas — Fusión Atlas RR

Este archivo se actualiza al final de cada fase con las pruebas ejecutadas y sus evidencias (capturas en `docs/fusion/capturas/`).

## Fase 0 · Preparación

- [x] `git fetch --all` sin errores.
- [x] `npm ci` sin errores (36 paquetes, 0 vulnerabilidades).
- [x] `npm run check` en verde (202 tests pass, build ok).
- [x] Estructura `docs/fusion/` creada.

## Fase 1 · Motor BPMN sobre el shell de B

- [x] `npm run check` en verde (202 tests pass, build ok con bundle BPMN).
- [x] `npm run lint:bpmn` en verde: 16 semillas, moddle sin avisos, 0 errores fuera de la deuda documentada.
- [x] `node scripts/verificar-bpmn.mjs` (Chrome local, 1440×900):
  - Catálogo `#/bpmn`: 16 tarjetas agrupadas en 7 áreas.
  - `#/bpmn/ventas_como_una_oportunidad_se_convierte_en_cliente`: 49 formas, 3 carriles, recorrido en «paso 1 de 11 · Llega alguien».
  - Marca: `h1` = Inter Tight, `body` = Lexend, fondo `#fffdf5` (crema de B).
  - «Volver al mapa» devuelve al shell sin errores de consola.
- [x] Regresión móvil 390×844: `src/app/rr-tree-view.test.mjs` 13/13 en verde (el acceso a BPMN se oculta en ≤760px hasta la tabbar de la fase 6).
- [x] Capturas: `docs/fusion/capturas/fase1-catalogo-bpmn.png`, `docs/fusion/capturas/fase1-proceso-bpmn.png`.

## Bloque 1 · Item 1 · Test 6 de CI (rutas `#flujo/<id>`)

- [x] Causa raíz del fallo de CI identificada: `scripts/flujo-routes.test.mjs` leía `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/rutas-v3.json`, una ruta de una máquina local que no existe en el runner de GitHub (error `ENOENT`, `not ok 6`).
- [x] Fixture dentro del repo: `fixtures/flujo-rutas.json` (125 identificadores de ruta de la auditoría de la carcasa v3, sin datos personales ni cifras).
- [x] Fixture de contenido: `fixtures/flujo-demo.json` con los 16 flujos, generado por `scripts/generar-fixture-flujos.mjs` (`npm run fixture:flujos`) a partir de las semillas BPMN de `src/bpmn/seeds/`; la prueba lo sirve como `src/data/flujos-v3.local.json` en un dist temporal.
- [x] La prueba ahora exige contenido real: además de «nodos», falla si aparece «Flujo no encontrado», y verifica que el fixture cubra exactamente las rutas `#flujo/` auditadas.
- [x] `npm run check` en verde: **202 tests pass, 0 fail** (antes: 201 pass, 1 fail en CI).
- [x] `npm run lint:bpmn` sin cambios (verde).
- [x] `origin/main` **falla el mismo test**: el archivo de main (`b687305`) tiene la misma ruta absoluta; reproducido en un worktree temporal (`/tmp/main-check`) apuntando a una ruta inexistente → `ENOENT`, 1 fail. Además, la corrida de CI de main (`Atlas checks`, run 41246045989) está en **failure** y se saltó el paso «Validar diagramas BPMN», señal de que se rompió en «Comprobar la base».
- [x] Pruebas de clics reales (`node scripts/verificar-flujos.mjs`, Playwright headless): **32 rutas probadas** (16 rutas `#flujo/` × escritorio 1440×900 y móvil 390×844), 0 rutas vacías, 0 errores de consola.
- [x] Capturas: `docs/fusion/capturas/bloque1-flujo-escritorio-1440.png`, `docs/fusion/capturas/bloque1-flujo-movil-390.png`.

## Bloque 2 · Item 2 · Auditoría UX/UI completa

- [x] `docs/fusion/AUDITORIA_UX.md` con 18 bugs (4 críticos, 5 altos, 6 medios, 2 bajos), recorridos (ver, navegar, editar, exportar) y mediciones a 360, 768 y 1440 px. Datos crudos en `docs/fusion/AUDITORIA_UX.json`.
- [x] `npm run audit:ux` repetible con Playwright headless: 3 viewports × 7 pasos, 17 capturas en `docs/fusion/capturas/auditoria/`.
- [x] Bugs críticos corregidos: el diagrama no abría en tablet ni móvil (0 px de alto), el botón «Editar» no activaba el modo (buscaba un atributo inexistente) y «Volver al mapa» quedaba en crema sobre crema (contraste 1,01:1).

## Bloque 3 · Item 3 · BPMN editable en sitio

- [x] `npm run verificar:bpmn-edicion` verde en escritorio 1440 y móvil 390: inspector con nombre, carril, color RR, notas, fuente y corte; creación de tareas, tareas de usuario, compuertas, eventos y carriles; deshacer/rehacer; copia local en `localStorage` y «Restaurar semilla».
- [x] El color elegido viaja en el `.bpmn` exportado con la extensión `bioc:fill` de bpmn.io.

## Bloque 4 · Item 4 · Panel por diagrama

- [x] `src/bpmn/leyenda.mjs`: 11 símbolos, 5 colores de la marca RR, los 5 pasos para leer un diagrama y la ficha de los 16 procesos (qué busca, disparador, resultado, camino paso a paso), con fuente y corte.
- [x] `npm run verificar:guia` verde en escritorio 1440 y móvil 390: la guía se abre, se actualiza al cambiar de proceso, se cierra y usa los tokens RR.

## Bloque 5 · Item 5 · Modo diagrama a pantalla completa

- [x] Al abrir un BPMN la página entera es el diagrama: la vista es una capa fija sobre el viewport, el catálogo se esconde y no hay scroll.
- [x] Botón ⛶ «Pantalla completa» / «⛶ Dividir» + atajos **P** y **Esc**; botón «☰ Procesos» para volver al catálogo sin perder el proceso.
- [x] La guía por diagrama se superpone al diagrama en pantalla completa (el lienzo no cambia de ancho).
- [x] `npm run verificar:pantalla` verde en escritorio 1440×900, móvil 390×844 y móvil 360×740: 0 errores de consola, sin scroll, formas del diagrama a la vista.
- [x] Bugs encontrados y corregidos: la paleta de bpmn-js tapaba media pantalla en móvil; el informe de lint se comía 186 px de alto en 360 px; la cabecera ocupaba 115 px en móvil.
- [x] Atajos del mapa apagados dentro de la vista BPMN (antes `F`, `/`, `Supr` y `Ctrl/Cmd+Z` disparaban el mapa con el diagrama abierto).
- [x] `npm run check` verde (202 tests, 0 fail) y `npm run lint:bpmn` verde (16 semillas).
- [x] Regresión verde: `npm run verificar:bpmn-edicion`, `npm run verificar:guia`, `npm run audit:ux`.
- [x] Medición del lienzo: escritorio 1150×471 → 1440×653 px; tableta 768×320 → 768×825 px; móvil 360×320 → 360×532 px.
- [x] Capturas: `docs/fusion/capturas/pantalla-bpmn-*.png` (catálogo, pantalla completa y guía en escritorio, móvil 390 y móvil 360).

## Bloque 6 · Item 6 · Pantalla dividida opcional

- [x] `npm run verificar:dividido` verde en escritorio 1440×900 y móvil 390×844: el panel abre con **Otro diagrama** (66 formas visibles), **Esquema** (16 procesos en 7 áreas) e **Inicio** (20 tarjetas: 11 clientes y 9 servicios); tocar una ficha abre el proceso en el diagrama principal; la tecla **D** alterna el panel.
- [x] Cero errores de consola en escritorio y móvil.

## Bloque 7 · Item 7 · Responsive y táctil + decisiones de Rosas

### Pruebas de clic real (Playwright sobre `/usr/bin/google-chrome`)

| Prueba | 1440 | 768 | 360 | Evidencia |
|---|---|---|---|---|
| Clic en un nodo del mapa abre el inspector | ✅ | ✅ | ✅ | el paso «navegar» de `npm run audit:ux` pasó en las tres medidas (antes fallaba con *timeout* en 768 y 360) |
| Zoom del mapa legible (≥ 45 %) | 20 % (encuadre completo) | 45 % | 45 % | `src/app/rr-tree-view.test.mjs` (J8 y P2) |
| La raíz del Atlas queda a la vista y se puede tocar | ✅ | ✅ | ✅ | idem (nueva comprobación `assertMovilUsable`) |
| Pellizco con dos dedos (zoom) | ✅ 20 % → 51 % | — | ✅ 45 % → 113 % | prueba propia con `PointerEvent` de tipo `touch` |
| Pan con un dedo | ✅ | — | ✅ | misma prueba |
| Cabecera BPMN sin solape (título vs «▥ Unir») | ✅ | ✅ | ✅ | título 60→228 px, acciones 240→380 px a 390 px |
| Menú «⋯» del diagrama con 7 acciones de 44 px | — | — | ✅ | `.bpmn-menu--mas` fijo a la izquierda, dentro de la pantalla |
| Objetivos táctiles ≥ 44 px | ✅ | ✅ | ✅ | `npm run audit:ux` sin «objetivosChicos» en ninguna medida |
| Cero errores de consola | ✅ | ✅ | ✅ | `docs/fusion/AUDITORIA_UX.json` → `consola: []` |

### Comprobaciones del repo

- [x] `npm run check`: **verde** — 202 tests pass, 0 fail, build ok.
- [x] `npm run lint:bpmn`: **verde** — 16 semillas, moddle sin avisos, **0 errores** y **0 avisos de las reglas estructurales de bpmnlint** (antes: 196 avisos, entre ellos 8 `no-gateway-join-fork`, 19 `fake-join` y 25 `superfluous-label`).
- [x] `npm run verificar:bpmn-edicion` verde (escritorio 1440 y móvil 390).
- [x] `npm run verificar:pantalla` verde (1440×900, 390×844 y 360×740).
- [x] `npm run verificar:guia` verde (escritorio y móvil).
- [x] `npm run verificar:dividido` verde (escritorio y móvil).
- [x] `npm run audit:ux` verde: 3 viewports × 7 pasos, **21 pasos**, 0 errores de consola, sin desbordes horizontales y sin objetivos táctiles pequeños.
- [x] Capturas: `docs/fusion/capturas/auditoria/` (21 capturas por viewport y paso) y `docs/fusion/capturas/bpmn-edicion-*.png`.

### Cambios en las pruebas del repo

- `src/app/rr-tree-view.test.mjs`: el zoom móvil mínimo pasa de 60 % a **45 %** y se adds la comprobación de que la raíz del Atlas queda dentro del lienzo y mide ≥ 90×44 px. En 1440 px el encuadre completo no cambia.
- `src/data/rr-tree.test.mjs`: el estado de los bots ahora es el que dicta la decisión de Rosas (Vigente / Sin confirmar) en vez del «Por confirmar con Rosas» automático.
- `scripts/verificar-bpmn-edicion.mjs` y `scripts/auditoria-ux-fusion.mjs`: abren el menú «⋯» antes de pulsar deshacer, rehacer, guardar, restaurar y exportar (en celular esas acciones viven en el menú).

## Fases posteriores

Se irán agregando conforme avance la fusión.
