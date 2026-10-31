# Datos del árbol Atlas

El grafo público de procesos vive en `src/data/rr-tree.mjs` y tiene la forma:

```js
{
  nodes: [{ id, title, type, x, y, ...metadata }],
  edges: [{ source, target, kind, evidence? }]
}
```

Los nodos de cliente y proyecto del repositorio son siempre genéricos. También se anonimizó el fixture heredado `src/data/directus-graph.mjs` y el corpus documental público `public/grafo/grafo.json`: conserva índices y conexiones para el visor, pero elimina títulos privados, dueños, encabezados y rutas a notas personales. Esto no reescribe commits anteriores; cualquier purga del historial requiere una operación separada y autorizada.

Las aristas `kind: "cross"` solo se crean cuando una fuente respalda la relación y llevan `evidence.source` y `evidence.detail`.

## Archivo local opcional

Para una vista privada, crea `src/data/atlas.local.json` y ejecuta `npm run preview:local`. El build local carga el archivo si existe y genera el overlay solo dentro de `dist/`, ignorado por Git. El patrón `src/data/*.local.*` está ignorado por Git. Nunca uses `git add -f` para incluir ese archivo ni compartas el directorio `dist/` de una vista privada.

`npm run build:legacy` produce siempre una vista pública genérica: excluye todos los archivos `.local.*` y genera un overlay vacío, incluso cuando existe un archivo local. `src/data/local-overrides.mjs` es únicamente el stub público vacío; no lo edites con datos privados.

Formato recomendado, usando solo IDs que ya existan en el grafo:

```json
{
  "nodes": {
    "client-ropa": {
      "title": "Cliente privado de ejemplo",
      "desc": "Descripción privada de ejemplo",
      "owner": "Rol privado de ejemplo",
      "kpi": "KPI privado de ejemplo",
      "bpmnPath": "privado/proceso-ejemplo.bpmn"
    }
  }
}
```

También se acepta una lista:

```json
{
  "nodes": [
    { "id": "project-proyecto-tienda-generica", "title": "Proyecto privado de ejemplo" }
  ]
}
```

`applyLocalData(graph, data)` devuelve un grafo nuevo. Solo copia metadatos permitidos (`title`, `desc`, `owner`, `kpi`, `bpmnPath`, `status`, `notes`, `links`, `media` y campos equivalentes); ignora IDs desconocidos y no cambia `id`, `type`, `lineId`, `stage`, posiciones, nodos ni aristas. El archivo local no se solicita por `fetch`: si no existe, la vista pública continúa con el grafo genérico y no genera un 404.

No se incluyen aquí nombres de personas, clientes, proyectos reales, credenciales, precios ni datos financieros.
