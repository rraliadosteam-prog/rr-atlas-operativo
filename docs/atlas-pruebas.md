# Atlas: pruebas, build público y preview local

## Alcance

T3 recupera la ejecución de pruebas y deja separado el dato local del artefacto público. No cambia `src/app/rr-tree.mjs`, `src/data/rr-tree.mjs`, CSS, HTML, CI ni Vercel. El contrato de datos local detallado por el worker de datos está en `docs/atlas-datos.md`; este bloque solo valida que la raíz del JSON local sea un objeto.

## Razón histórica de 30 frente a 12

La comparación es reproducible con los árboles y rutas siguientes:

- En `origin/atlas-bpmn-movil`/`d3e7060`, el runner de `package.json` nombraba `src/core/atlas-state.test.mjs`, `src/core/process-model.test.mjs`, `src/ui/overlap.test.mjs`, `src/app/atlas-store.test.mjs` y `scripts/test-persistence.mjs`.
- En ese árbol, los conteos eran: `src/core/atlas-state.test.mjs` 8, `src/core/process-model.test.mjs` 8, `src/ui/overlap.test.mjs` 9 y `src/app/atlas-store.test.mjs` 4. `scripts/test-persistence.mjs`, ejecutado como archivo por `node --test`, aportaba 1 comprobación top-level: **30**.
- `src/core/process-model.mjs` y su suite llegaron en `3133e5f`; `src/ui/overlap.mjs` y su suite llegaron en `ba500f7`; `d3e7060` añadió las dos comprobaciones finales de solapes.
- La línea que llega a `e35484b` ya no contiene esas cuatro rutas. La diferencia de árboles `c3d336d..e35484b` las muestra como ausentes; no se ha supuesto un commit de borrado único donde el historial es divergente.
- Las dos ramas divergen desde `9e3ebe7`. El runner de `e35484b`, base heredada por el ciclo 1, ya ejecutaba únicamente `src/core/atlas-state.test.mjs` y `src/app/atlas-store.test.mjs`: 8 + 4 = **12**. No fue un borrado de 18 pruebas durante el ciclo 1: se continuó desde otra línea de historia, sin los módulos añadidos en la rama BPMN. `990d5cc` no modificó `package.json`; cambió `scripts/build.mjs` a los marcadores del shell `rr-tree`, pero dejó `scripts/test-persistence.mjs` comprobando `src/app/main.mjs` y las hojas antiguas. Por eso la prueba de persistence fallaba aunque el shell real ya usaba `src/app/rr-tree.mjs`.

La corrección no infiere cobertura perdida: vuelve a nombrar todas las suites con glob de `src` y `scripts`, y conserva explícitamente `scripts/test-persistence.mjs`.

## Recuperación y cambios

- Recuperados `src/core/process-model.mjs` y `src/core/process-model.test.mjs` (8 pruebas) sin dependencia de navegador.
- Recuperados `src/ui/overlap.mjs` y `src/ui/overlap.test.mjs` (9 pruebas).
- `scripts/test-persistence.mjs` ahora valida el shell real: `rr-tree.mjs`, `rr-tree.css`, `data-canvas`, `data-nodes` y `data-inspector`.
- Añadido `scripts/build.test.mjs` (4 pruebas): shell válido/inválido, exclusión de `.local.*`, stub público, preview local y rechazo de arrays.
- `src/data/local-overrides.mjs` queda siempre como `export default {};`.
- `scripts/build.mjs` conserva `validateShell` y `build`; `build(root, { local: true })` y `build({ root, local: true })` son opciones explícitas. El modo público nunca copia rutas cuyo segmento contenga `.local.`. El modo local lee solo `src/data/atlas.local.json`, valida objeto no-array y escribe el módulo generado únicamente bajo `dist`.
- `package.json` añade `preview:local`: `node scripts/build.mjs --local && python3 -m http.server 4175 --bind 127.0.0.1 --directory dist`.

La suite histórica que comparaba `src/bpmn/rr-moddle.mjs` no pudo conservar esa importación: ese módulo fue retirado del árbol actual y está fuera de las superficies permitidas. Se sustituyó por una comprobación independiente de extracción de pasos BPMN. Si se exige paridad exacta del descriptor, queda pendiente restaurar ese módulo fuera de este encargo, sin tocarlo aquí.

## Datos locales y privacidad

Formato mínimo aceptado por el build:

```json
{
  "nodes": {
    "node-id-existente": {
      "title": "texto local"
    }
  }
}
```

El archivo es opcional, temporal y no se copia al `dist`. El build público produce el stub vacío aunque exista el archivo local. Las pruebas usan temporales aislados y los limpian en `finally`; no se creó ningún `atlas.local.json` en el repositorio. No se imprimieron ni guardaron nombres reales, tokens, credenciales o datos financieros.

## RED/GREEN y verificación

RED intencional, antes del cambio de build:

```text
node --test scripts/build.test.mjs
1 pass, 3 fail
```

Fallaba porque el build antiguo copiaba `.local.*`, no aceptaba la opción local y no rechazaba un array. Después del cambio:

```text
node --test src/core/process-model.test.mjs src/ui/overlap.test.mjs scripts/build.test.mjs
21 pass, 0 fail
node scripts/test-persistence.mjs
frontend shell regression: ok
npm test
49 pass, 0 fail
```

Conteo observado en el workspace compartido al final: `atlas-store` 4, `atlas-state` 8, `process-model` 8, `rr-tree` core 8, `rr-tree` data 7, `overlap` 9, `build` 4 y persistence 1. Los 15 tests de `rr-tree` son superficies de otros workers; los 12 previos se mantienen.

También se ejecutó `npm run build:legacy`: el stub público quedó presente y `find dist -name '*.local.*'` no encontró archivos. El smoke test de `npm run preview:local` respondió HTTP 200 en `127.0.0.1:4175` y el servidor fue detenido al terminar la comprobación.

Para la comparación diferencial se usó una copia base temporal del árbol `HEAD` y una copia candidata, con el mismo fixture local no versionado. Se compararon `stdout`, `stderr`, código de salida y `dist/index.html` del comando público `node scripts/build.mjs`: fueron iguales; la diferencia deliberada quedó limitada a artefactos de datos (`base`: archivos `.local.*`; candidata: solo `local-overrides.mjs`). No se dejó la copia temporal ni una referencia git en los tests.

## Cobertura y pendientes

- **S1:** T3 recupera las suites históricas de proceso, solapes y persistence; el runner descubre las suites actuales de `src` y `scripts`. El comportamiento del árbol está cubierto por las suites del worker del árbol, ejecutadas por el mismo runner.
- **S2:** build público seguro y stub vacío; los datos locales solo entran con `--local`. La integración conecta `createRRGraph()` con el overlay generado mediante `applyLocalData(graph, data)` y tiene una prueba de regresión de carga inicial.
- **S8:** preview local reproducible, sin push, deploy ni servidor permanente.
- **S11:** no se tocaron CI/Vercel ni se usaron secretos.
- **Pendiente:** decidir con el padre si se necesita restaurar el descriptor BPMN histórico fuera de las superficies de T3. También conviene que la integración final mantenga el patrón `.local.*` en `.gitignore` y conecte el wrapper local sin modificar el stub público.

## Key Learnings

1. Contar tests por archivo y por commit evita confundir una reducción del runner con una reducción real de cobertura.
2. Cuando cambia el shell, `validateShell` y su prueba deben cambiar juntos; una prueba de persistence stale puede fallar sin que falle la aplicación.
3. Un build público seguro debe excluir los archivos locales antes de copiar `src` y generar siempre un módulo stub determinista.
4. Las pruebas de archivos temporales deben aislar la raíz, limpiar en `finally` y comparar artefactos sin depender de una referencia git fija.
