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

## Fases posteriores

Se irán agregando conforme avance la fusión.
