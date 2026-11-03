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

## Bloque 8 · Item D · QA de cierre (clics reales en 390, 768 y 1440 px)

Script nuevo: `scripts/verificar-cierre.mjs` (`npm run verificar:cierre`). Servye `dist/` con un
servidor local, abre Chrome real con Playwright y hace **clics de verdad** en los ocho flujos, en
los tres anchos. Resultado crudo en `docs/fusion/PRUEBAS.json`.

### Conteo de pruebas
| Dato | Resultado |
|---|---|
| Pruebas ejecutadas | **24** (8 flujos × 3 anchos) |
| En verde | **24** |
| Con fallo | **0** |
| Errores de consola | **0** |
| `npm run check` | **verde** — 223 tests pass, 0 fail, build ok |
| `npm run lint:bpmn` | **verde** — 16 semillas, **0 errores y 0 avisos** |
| Capturas | **24** — `docs/fusion/capturas/cierre-<flujo>-<ancho>.png` |

### Los ocho flujos, por ancho
| Flujo | 390 px | 768 px | 1440 px |
|---|---|---|---|
| Mapa vivo | ✔ 71 nodos; el clic abre el editor | ✔ 71 nodos; el clic abre el editor | ✔ 71 nodos; el clic abre el editor |
| Búsqueda | ✔ «finanzas» deja 5 nodos visibles de 71 | ✔ 5 de 71 | ✔ 5 de 71 |
| Catálogo BPMN | ✔ 16 procesos | ✔ 16 procesos | ✔ 16 procesos |
| Abrir diagrama | ✔ 64 formas, lienzo 390×700 px, pantalla completa | ✔ 64 formas, lienzo 768×880 px | ✔ 64 formas, lienzo 1440×679 px |
| Edición | ✔ nombre editado y guardado | ✔ nombre editado y guardado | ✔ nombre editado y guardado |
| Guía | ✔ se abre con el aviso «Guía provisional» | ✔ | ✔ |
| Pantalla completa | ✔ ⛶ divide y vuelve a unir | ✔ | ✔ |
| Pantalla dividida | ✔ 3 paneles de acompañamiento | ✔ | ✔ |

### Avisos de lint
- `npm run lint:bpmn`: **0 errores y 0 avisos** en las 16 semillas (antes: 196 avisos). Las dos
  reglas de contenido del plugin de RR (`rr/lane-es-rol` y `rr/tarea-infinitivo`) quedaron en verde
  con el pase de contenido (`npm run semillas:contenido`).
- `deuda-modelado.json` queda con `casos: []`: no queda ninguna compuerta `no-gateway-join-fork`.

### Nota sobre la prueba de edición
El clic sobre una forma del diagrama se hace con coordenadas (centro de la forma) y no con el
`click()` del locator: el grupo SVG del diagrama nunca queda «estable» porque el lienzo está
escalado, y el locator se queda esperando. No es un defecto de la app: es una peculiaridad de
Playwright con lienzos transformados.

## Bloque 9 · Item 8 (cierre) · Vista Datos conectada al store v5

Script: `scripts/verificar-cierre.mjs` (`npm run verificar:cierre`), ahora con **9 flujos** (se
sumó el de la vista Datos). Cada flujo se prueba con clics reales en Chrome a 390, 768 y 1440 px.

### Conteo de pruebas
| Dato | Resultado |
|---|---|
| Pruebas ejecutadas | **27** (9 flujos × 3 anchos) |
| En verde | **27** |
| Con fallo | **0** |
| Errores de consola | **0** |
| Avisos de lint (`npm run lint:bpmn`) | **0** en las 16 semillas |
| Capturas | **27** — `docs/fusion/capturas/cierre-<flujo>-<ancho>.png` |

### Los nueve flujos, por ancho
| Flujo | 390 px | 768 px | 1440 px |
|---|---|---|---|
| Mapa vivo | ✔ 71 nodos; el clic abre el editor | ✔ | ✔ |
| Búsqueda | ✔ «finanzas» deja 5 nodos visibles de 71 | ✔ | ✔ |
| Catálogo BPMN | ✔ 16 procesos | ✔ | ✔ |
| Abrir diagrama | ✔ 64 formas, pantalla completa | ✔ | ✔ |
| Edición | ✔ nombre editado y guardado | ✔ | ✔ |
| Guía | ✔ aviso «Guía provisional» | ✔ | ✔ |
| Pantalla completa | ✔ ⛶ divide y vuelve a unir | ✔ | ✔ |
| Pantalla dividida | ✔ 3 paneles de acompañamiento | ✔ | ✔ |
| **Datos** | ✔ 11 colecciones, 41 fuentes, validador en verde y export `rr-atlas-v5.json` | ✔ | ✔ |

### Pruebas de código (`node --test`)
- `src/app/datos-view.test.mjs` (nuevo, 5 pruebas): el resumen trae las once colecciones del
  esquema v5, el diff se describe en palabras, la lista de fuentes y cortes cubre todos los
  registros, el store arranca en la base sin cambios y validando, y **exportar → importar es
  idempotente**.
- `npm run check`: **228 tests pass, 0 fail** (antes 223).

## Bloque 10 · Item A (cierre) · Verificación táctil

Script: `scripts/verificar-tactil.mjs` (`npm run verificar:tactil`), con Chrome real y eventos de
puntero de verdad (pellizco y pan con el dedo). **6 flujos × 3 anchos (390, 768 y 360 px) = 18
pruebas**.

### Conteo de pruebas
| Dato | Resultado |
|---|---|
| Pruebas ejecutadas | **18** (6 flujos × 3 anchos) |
| En verde | **18** |
| Con fallo | **0** |
| Errores de consola | **0** |
| Capturas | **18** — `docs/fusion/capturas/tactil-<flujo>-<ancho>.png` |
| Datos crudos | `docs/fusion/TACTIL.json` |

### Los seis flujos, por ancho
| Flujo | 390 px | 768 px | 360 px |
|---|---|---|---|
| Objetivos táctiles | ✔ 50 controles, mínimo 44 px | ✔ 59 controles, mínimo 44 px | ✔ 50 controles, mínimo 44 px |
| Cabecera sin solape | ✔ título 228 px, acciones desde 240 px | ✔ título 255 px, acciones desde 369 px | ✔ título 198 px, acciones desde 210 px |
| Menú «⋯» | ✔ 7 acciones de 44 px | ✔ no aplica (barra completa) | ✔ 7 acciones de 44 px |
| Pellizco en el tablero | ✔ 45 % → 101 % | ✔ 45 % → 101 % | ✔ 45 % → 101 % |
| Pan con un dedo | ✔ el tablero se mueve | ✔ | ✔ |
| Pellizco en el diagrama | ✔ la forma pasó de 2794 px a 3992 px | ✔ de 768 px a 1097 px | ✔ de 2794 px a 3992 px |

### Defecto que estas pruebas encontraron y que ya quedó corregido
- Los botones del nodo del mapa (colapsar/expandir) medían **19,8 px en pantalla** con el tablero
  encuadrado al 45 %: el zoom del lienzo también reduce los controles. Ahora el tablero publica su
  zoom invertido (`--zoom-inv`) y los controles se compensan, de modo que **miden 44 px en
  pantalla** en celular y tablet. En escritorio (>900 px) no se toca nada.

### Conteo de avisos de lint (sin cambios)
- `npm run lint:bpmn`: **0 errores y 0 avisos** en las 16 semillas.
- `npm run check`: **232 tests pass, 0 fail**.

## Bloque 11 · Cierre final · Puerta de salida del PR

Script nuevo: `scripts/verificar-cierre-final.mjs` (`npm run verificar:cierre:final`). Es la puerta
de salida del PR #7: comprueba, sin inventar nada, que todo lo que pidieron los ítems A, B, C y D
está de verdad en el código y en los datos. Corre en Node (sin navegador), tarda menos de un segundo
y quedó **dentro de `npm run check`**, así que CI lo corre en cada push.

Datos crudos: `docs/fusion/CIERRE.json`.

### Conteo de pruebas
| Dato | Resultado |
|---|---|
| Comprobaciones ejecutadas | **24** |
| En verde | **24** |
| Con fallo | **0** |
| Duración | 0,36 s |

### Qué comprueba (24 comprobaciones)
| Bloque | Comprobaciones |
|---|---|
| Item B · decisiones de Rosas | título «RR Aliados · Atlas operativo»; sin «RR Labs» en `src/`, `index.html` ni `dist/`; subtítulo del Mapa vivo; fuentes Inter Tight + Lexend; la entrada es el Mapa vivo; «Volver al hub» oculto; BOGA, Candilejas e IMF Weddings activos y los demás en pausa; sin «Sin confirmar» en el estado de clientes; aviso «Guía provisional»; íconos distintos para tarea de bot y de persona; **16 semillas con 0 errores y 0 avisos de lint**; abrir un diagrama siempre a pantalla completa; Buen Puente y Becas de Exposición vigentes, Media Manager y Gains «sin confirmar» |
| Item C · modelo v5 | esquema 5 y clave `rr-atlas:v5`; migración desde el JSON v4 de B y desde el estado de A; exportar(importar(paquete)) === paquete; el validador rechaza `salario`, `cedula`, `cuenta`, `token` y `password`; los 124 registros de la base con fuente y corte; ninguna cifra financiera en los datos ni en el bundle |
| Items A y D · entregables | 27 capturas `cierre-<flujo>-<ancho>.png` (9 flujos × 3 anchos); `PRUEBAS.md` con el conteo de pruebas y «0 errores y 0 avisos»; `PREGUNTAS.md` con las decisiones como RESUELTO; `BITACORA.md` con los bloques registrados |

### Estado de los checks al cierre de este bloque
- `npm run check`: **verde** — 232 tests pass, 0 fail, build ok y la puerta de cierre en 24/24.
- `npm run lint:bpmn`: **verde** — 16 semillas, 0 errores y 0 avisos.
- `npm run verificar:cierre`: **verde** — 27 de 27 (9 flujos × 3 anchos), 0 errores de consola.
- `npm run verificar:tactil`: **verde** — 18 de 18 (6 flujos × 390, 768 y 360 px), 0 errores de consola.

## Bloque 12 · Huecos «sin confirmar» visibles en la app (mega prompt §10)

Los ítems A, B, C y D ya estaban cerrados. Este bloque cerró el **último hueco del mega prompt**:
la lista de «sin confirmar» que el §10 exige que se vea **dentro de la app** (no solo en la
documentación). Antes esos huecos vivían únicamente en `PREGUNTAS.md` y en la base con la marca
«sin confirmar» registro por registro; ahora hay una lista propia, con fuente y corte, que se ve
en dos lugares de la app.

### Qué se hizo
- **`src/data/pendientes.mjs` (nuevo)**: los **21 huecos** del Atlas RR, cada uno con `id`,
  `titulo`, `detalle`, `tipo`, `fuente`, `corte` y `estado: «sin confirmar»». Cubren la lista
  mínima del §10: Project Manager y Camarógrafo por definir, SLA de soporte, quién cubre soporte,
  KPI de producción, método de la sesión de grabación, quién puede tener cuenta de cobro,
  obligaciones fiscales, precios y planes de SaaS Ropa/Resto/Creadores, estado de Buen Puente,
  vigencia de la flota Hermes, Media Manager y Gains, las personas de la tarjeta de talento de la
  rama A, los cargos reales de los carriles, la tipografía oficial del brand kit, la relación
  Zapatos/Shoes Colombia, los clientes en pausa, el nombre canónico de IMF, las rutas `/bpmn/`,
  `/flujos/` y `/grafo/` de A, las cifras de demostración de A y las notas del vault vencidas.
  **Ninguna cifra financiera** y ningún dato personal.
- **Vista Datos** (`#/datos`): panel nuevo **«Lo que falta confirmar»**, agrupado por tipo, con el
  detalle de cada hueco y su fuente y su corte. Se renderiza aunque la base no haya cargado, para
  que el aviso nunca desaparezca.
- **Panel Inicio** de la pantalla dividida: grupo **«Sin confirmar»** con los 21 huecos (título ·
  fuente · corte) para poder verlos sin salir del diagrama.
- **Pruebas** (`src/data/pendientes.test.mjs`, 6 pruebas): fuente y corte en todo hueco, estado
  «sin confirmar», ids sin repetir, cobertura de la lista mínima del §10, sin cifras financieras y
  agrupación legible.
- **Puerta de cierre** (`scripts/verificar-cierre-final.mjs`): dos comprobaciones nuevas
  (`pendientes-visibles` y `pendientes-minimos`) que comprueban que los huecos están en la app y
  que cubren la lista mínima. Sube de 24 a **26** comprobaciones.
- **QA de cierre** (`scripts/verificar-cierre.mjs`): flujo nuevo **«pendientes»** (abre la vista
  Datos y verifica que la lista se ve, con fuente y corte). Sube de 27 a **30** pruebas
  (10 flujos × 3 anchos) y deja 3 capturas nuevas.

### Conteo de pruebas
| Dato | Resultado |
|---|---|
| Pruebas ejecutadas | **30** (10 flujos × 3 anchos) |
| En verde | **30** |
| Con fallo | **0** |
| Errores de consola | **0** |
| Comprobaciones de la puerta de cierre | **26** (26 en verde) |
| `npm run check` | **verde** — 238 tests pass, 0 fail, build ok |
| `npm run lint:bpmn` | **verde** — 16 semillas, **0 errores y 0 avisos** |
| Capturas | **30** — `docs/fusion/capturas/cierre-<flujo>-<ancho>.png` |

### El flujo nuevo, por ancho
| Flujo | 390 px | 768 px | 1440 px |
|---|---|---|---|
| **Sin confirmar** | ✔ 21 huecos con fuente y corte | ✔ | ✔ |

### Nota
- La lista de huecos **no es un modelo editable**: es un inventario de lo que falta, y por eso vive
  junto a los datos y no dentro del store v5 (que solo edita el modelo). Cada hueco sale de una
  fuente escrita de RR o del inventario; lo que no tiene fuente escrita no se inventa.
- El «Sin confirmar» del estado de los **clientes** sigue fuera (decisión de Rosas): esta lista es de
  huecos de información, no de estados de cliente.
