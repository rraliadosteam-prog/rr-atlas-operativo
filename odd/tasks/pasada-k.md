# Pasada K — RR Atlas Operativo

Repo: `~/rr-atlas-operativo` · Rama: `atlas-arbol-pro` · Ámbito: solo local, sin push/merge/deploy/Vercel/mensajes.
El árbol permanece en el Atlas existente; no se crea otro proyecto ni desarrollo paralelo.

## Specs

- S1: K1 — Las pestañas o enlaces a `/grafo/`, `/bpmn/` y `/flujos/` no deben dar 404: si la vista existe, enrutarla dentro de la app; si no existe, quitar el enlace. Agregar una prueba que recorra TODOS los enlaces internos del build servido y falle con cualquier 404 (RED antes, GREEN después).
- S2: K2 — El árbol queda como vista principal del Atlas actual; las demás secciones que ya funcionaban se mantienen funcionando. Nada de proyecto nuevo.
- S3: K3 — Verificar (con prueba o captura headless) que siguen los arreglos del J: el editor no tapa el árbol en móvil 390 px, el texto se lee con zoom bajo, los enlaces cruzados van ocultos o finos, la raíz dice 'Mapa interno' y el minimapa arranca cerrado. Si algo falla, arreglarlo.
- S4: K4 — Hacer un build LIMPIO para preview SIN el overlay `*.local.*` (sin nombres reales; NO usar `--local`). Buscar en el repo la lista de los 19 nombres históricos que ya usan las pruebas de privacidad (`scripts/build.test.mjs`, `docs/atlas-datos.md`, `docs/AUDITORIA_RR_ATLAS.md`) y correr `grep -ri` de cada uno sobre `dist/`: debe dar 0 coincidencias. Si no se encuentra la lista exacta de 19, declararlo en la entrega en vez de inventarla. Copiar SOLO ese `dist/` limpio a `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-k/preview-dist/` (`cp -a dist/. ...`).
- S5: Correr `npm test` y `npm run check`. Commit local.
- S6: Escribir `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-k/entrega-k.md` con: archivos tocados, resultado de K1-K4 punto por punto (RED/GREEN, enlaces revisados y su estado, conteo del grep por nombre sin escribir los nombres), resultados de pruebas, capturas tomadas y lo que no quedó. No escribir tokens ni datos personales.

## Tasks

- T1 — S1 — Integrar `/grafo/` en el build público y agregar test de enlaces internos sin 404.
- T2 — S2/S3 — Verificar headless los arreglos del Anexo J; corregir regresiones si fallan.
- T3 — S4/S5 — Build limpio, auditoría de nombres, copia del preview y `npm test`/`npm run check`.
- T4 — S6 — Commit local y redactar `entrega-k.md`.

## Log

- L1: Encargo Pasada K del RR Atlas Operativo (orden de Rosas vía Atlas, 31-oct). Trabajar solo en `~/rr-atlas-operativo`, rama `atlas-arbol-pro`, solo local. Leer `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/anexo-j/intento2/entrega-anexo-j.md` y `git log/diff` para ver qué dejó el Anexo J. Sin push, merge, Vercel, deploy ni mensajes a terceros. No crear otro proyecto ni desarrollo; el árbol se queda en este Atlas.
