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
