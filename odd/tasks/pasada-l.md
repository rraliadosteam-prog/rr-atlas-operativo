# Pasada L — RR Atlas Operativo

Repo: `~/rr-atlas-operativo` · Rama: `atlas-arbol-pro` · Ámbito: solo local, sin push, sin merge, sin Vercel, sin deploy, sin mensajes personales en el código fuente.
Salida: `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/`.

## Specs

S1) Leer `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/anexo-j/intento2/entrega-anexo-j.md` y `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-k/entrega-k.md`; trabajar sobre la rama `atlas-arbol-pro` del repo `~/rr-atlas-operativo`; no publicar nada.
S2) L1 — AUDITORÍA de la producción actual (carcasa v3, rutas tipo `#flujo/<id>`): servir el respaldo `/home/deadkiss/rr-encargos/atlas-pro-20261030/respaldo-prod-20261030/carcasa-v3/` con `python3 -m http.server` en `127.0.0.1`; extraer de `shell.js`/`datos.js` la lista de TODAS las rutas `#flujo/...` y `#...`; abrir cada una headless a 390 px y 1440 px; reportar rotas o vacías, errores de consola, bugs ordenados por gravedad con pasos para reproducir; incluir una tabla de lo que tiene la carcasa v3 que falta en `atlas-arbol-pro` y viceversa. Archivo: `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/auditoria-prod.md`. NO copiar nombres reales ni contenido de documentos: solo ids de ruta.
S3) L2 — INTEGRACIÓN: el preview debe ser SUPERCONJUNTO. Llevar a `atlas-arbol-pro` todas las vistas y rutas `#flujo/...` de la carcasa v3 que funcionan, y dejar el árbol RR Labs como vista principal; los nodos de proceso del árbol enlazan a su `#flujo/...` cuando exista; todo editable con el editor. Ninguna ruta de la v3 puede romperse: agregar una prueba que recorra la lista de L1 y falle con cualquier ruta vacía o 404.
S4) L3 — PRIVACIDAD: `datos.js`/`datos.json` de la v3 traen el índice de Drive con nombres. NO se commitean: ponerlos en `.gitignore` como `*.local.*`. Si un flujo los necesita, cargarlos solo en el build del preview desde el archivo local, y anotar en `entrega-l.md` cuáles flujos dependen de ese archivo.
S5) L4 — Build final del preview en `dist/` y copiar `dist/.` a `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/preview-dist/`. Capturas headless 390 px y 1440 px de árbol general, un `#flujo/` y el panel de proceso en `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/` (nombres `390px-arbol-general.png`, `390px-flujo.png`, `390px-panel-proceso.png` y lo mismo con `1440px`). Correr `npm test` y `npm run check`, commit local, y escribir `/home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/entrega-l.md` (archivos tocados, resultado L1-L4, pruebas, lo que no quedó). Sin tokens ni datos personales.

## Tasks

- T1: Explorar respaldo carcasa v3 y definir lista de rutas hash extraíbles. → S2 (hecho en sesión anterior)
- T2: Implementar auditoría headless de la carcasa v3 y escribir `auditoria-prod.md`. → S2 (hecho en sesión anterior)
- T3: Diseñar integración de vistas `#flujo/<id>` en `atlas-arbol-pro` manteniendo el árbol como vista principal. → S3 (done)
- T4: Implementar render de flujos y enrutamiento por hash en el preview. → S3 (done)
- T5: Enlazar nodos de proceso del árbol a su `#flujo/<id>` cuando exista. → S3 (done)
- T6: Agregar prueba que recorra rutas de L1 y falle ante vacías/404. → S3 (done)
- T7: Aislar datos locales de v3 (`*.local.*`) y documentar dependencias. → S4 (done)
- T8: Build, capturas, tests, commit local y escribir `entrega-l.md`. → S5 (done)

## Log

L1 — Usuario: "PASADA L del RR Atlas Operativo (orden de Rosas via Atlas, 31-oct 14:01). Trabaja en ~/rr-atlas-operativo, rama atlas-arbol-pro, SOLO local: sin push, sin merge, sin Vercel, sin deploy, sin mensajes. Lee antes /home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/anexo-j/intento2/entrega-anexo-j.md y /home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-k/entrega-k.md (si existen) y git log. Salida en /home/deadkiss/rr-encargos/atlas-pro-20261030/ciclo2/pasada-l/. L1) AUDITORIA... L2) INTEGRACION... L3) PRIVACIDAD... L4) Build final..."
L2 — Continuación tras corte: se reanuda en L2-L4 sin rehacer L1. Se prioriza dist limpio y entrega si el tiempo no alcanza.
