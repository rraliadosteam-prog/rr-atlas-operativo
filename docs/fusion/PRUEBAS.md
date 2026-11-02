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

## Fases posteriores

Se irán agregando conforme avance la fusión.
