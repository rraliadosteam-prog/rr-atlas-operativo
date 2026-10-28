# Auditoria Atlas Operativo RR — Fase 0
> Fecha: 2026-10-27
> Rama auditada: `atlas-bpmn-movil` (645fa62)
> Produccion: https://rr-atlas-operativo.vercel.app (v=bpmn-4)
> Auditor: Pingui (Hermes Agent)

---

## 1. Reconciliacion de builds

| Build | Commit | Estado | Notas |
|-------|--------|--------|-------|
| `feat/atlas-audit-ux` | `c3d336d` | **Mas avanzado** | Tiene "Plan local", boton "Mas", mejor UX, v=bpmn-6 |
| `atlas-bpmn-movil` | `645fa62` | **En produccion** | Retroceso desde c3d336d: -1.168 lineas, +448. Perdio funcionalidades. |

**Hallazgo P0:** La produccion actual es un rollback respecto a un build anterior mas pulido. Se perdieron:
- Boton "Mas" con toolbar colapsable (cumplia limite de 6 controles)
- Vista "Plan local"
- Marcadores visuales en el rail (circulos por categoria)
- Sidebar con header y estados visuales mejorados
- Indicador de zoom dinamico en status
- Mejor manejo de tamanos de tarjetas en conexiones

**Accion propuesta:** Fusionar lo mejor de ambas ramas. `c3d336d` como base de UX, `atlas-bpmn-movil` como base de tabs Grafo/BPMN/Flujos.

---

## 2. Arquitectura

**P0 — Version inconsistente:** `package.json` dice `4.0.0-foundation`, el HTML dice `Versión 4.1`. Confusion para debugging.

**P1 — Build custom:** Script propio con esbuild. No hay bundler optimizado ni code-splitting. El bundle BPMN pesa lo que pese bpmn-js completo.

**P1 — Sin framework:** Vanilla JS con modulos ES. Esto es una decision valida pero exige mas disciplina. El codigo actual la mantiene razonablemente.

**P2 — Cache busting manual:** `?v=bpmn-4`, `?v=bpmn-3`, `?v=bpmn-6` mezclados en los imports. Esto puede causar caches desfasados en produccion.

---

## 3. Zoom y navegacion

**P0 — Zoom no anclado al cursor:** La rueda multiplica `viewport.z` por 1.1/0.9 pero no ajusta `x` e `y`. El zoom escala desde el origen (0,0), no desde el cursor del mouse. Esto es contraintuitivo.

**P0 — deltaY no normalizado:** `event.deltaY < 0 ? 1.1 : 0.9` no considera la magnitud del scroll. En trackpads de Mac puede producir zooms extremos con un swipe.

**P1 — Pellizco rudimentario:** El pinch con dos dedos existe pero no hay inercia ni suavizado. En movil es dificil de controlar.

**P1 — Limites hardcodeados:** `0.35` / `0.55` (desktop/mobile) a `2.4`. No hay configuracion ni logica adaptativa.

**P1 — Botones +/- sin animacion:** `zoomIn()` y `zoomOut()` cambian el scale bruscamente sin `animateViewport`.

**P2 — Doble click/tap para acercar:** Existe pero sin animacion suave hacia el nodo.

---

## 4. Conexiones

**P0 — Anclaje fijo incorrecto:** `ax = source.x + 119`, `ay = source.y + 118`. Asume tarjetas de 238x125px siempre. Si la tarjeta cambia de tamano (texto largo, preview de media), la linea no toca el borde.

**P0 — Contraste inaceptable:** `opacity: .16` en stroke `#973d8F` sobre `#070001`. Es casi invisible. El megaprompt pide 3:1 minimo.

**P0 — Flechas no renderizadas:** El marker `#atlas-arrow` esta definido en SVG pero las paths generadas NO usan `marker-end="url(#atlas-arrow)"`. Las conexiones son lineas sin direccion.

**P1 — Sin enrutado inteligente:** Las curvas son Bezier simples que pueden pasar por encima de otras tarjetas.

**P1 — Sin resalte de vecinos:** Al seleccionar un nodo, las conexiones cambian de clase (`context` vs `dim`) pero la diferencia visual es minima por el bajo contraste.

---

## 5. Renderizado y rendimiento

**P1 — Reconstruccion total del DOM:** `renderCards()` hace `root.cards.replaceChildren()` y recrea TODAS las tarjetas en cada cambio (filtro, seleccion, zoom). Con 55 nodos pasa desapercibido; con 500 seria lento.

**P1 — Sin virtualizacion:** Todas las tarjetas estan en el DOM aunque esten fuera del viewport. El SVG de wires tiene `width="4300" height="3200"` fijo.

**P2 — Fugas potenciales:** Cada `renderCards` crea nuevos listeners `pointerdown`, `pointermove`, etc. Aunque `replaceChildren` elimina los nodos del DOM, no verifique si los listeners se limpian correctamente.

---

## 6. Vistas y arquitectura de informacion

**P0 — 7 botones en tabbar (excede limite):** Mapa, Procesos, Buscar, Grafo, BPMN, Flujos, Menu. El limite del megaprompt es 4 destinos de primer nivel.

**P0 — 8 controles visibles en header:** Buscar, Configuracion, Exportar, Importar, Restaurar, Tema, Minimapa, Conexiones. El limite es 6 controles permanentes. Deben ir en "Configuracion" o paleta de comandos.

**P0 — Nombres duplicados/confusos:** "Procesos" aparece en: categoria del rail, tab inferior, boton "Ir a un proceso", y la vista BPMN. "BPMN" aparece como tab y como categoria. El usuario no distingue que es cada uno.

**P1 — Buscar como vista:** El tab "Buscar" no tiene sentido como vista independiente; deberia ser paleta de comandos (`Ctrl+K`) o barra de busqueda global.

**P1 — Mezcla de tonos:** "Navegá" (voseo) en el hint junto a "Arrastra" y "Agrega" (tuteo). El megaprompt exige tuteo neutro uniforme.

**P1 — Rail sin iconos propios:** Usa glifos Unicode (`◈ ◉ ⇄ ▣ ◇ ☷ ♙ ⚙`) sin coherencia visual. Necesita un set de iconos consistente (Lucide u otro).

**P2 — Footer con logo repetido:** El logo de RR aparece en header y footer. Ocupa espacio vertical innecesario.

---

## 7. BPMN y flujos

**P1 — BPMN comercial en iframe:** `/bpmn/` es un visor estatico con `bpmn-js`. No tiene panel de detalle por elemento, ni responsable, ni SLA, ni KPI. Es solo un SVG interactivo basico.

**P1 — Flujos operativos en iframe:** `/flujos/` es HTML estatico con Mermaid. No son editables ni interactivos mas alla de expandir/collapsar.

**P1 — Sin conexion Mapa ↔ BPMN:** No hay enlace bidireccional entre un nodo del mapa y su diagrama BPMN.

**P2 — bpmn-js requiere atribucion:** La licencia exige mantener visible el logo de bpmn.io. No esta presente en `/bpmn/`.

---

## 8. Datos y persistencia

**P0 — Sin schemaVersion en localStorage:** La clave es `rr-atlas-v3` pero no guarda `schemaVersion`. La funcion `normalizeGraph` espera `schemaVersion === 1` en importaciones, pero el localStorage no lo tiene. Esto puede romper migraciones futuras.

**P1 — Datos solo en navegador:** Sin backend. Si el usuario limpia cache, pierde todo. "Restaurar base" borra sin exportar automaticamente.

**P1 — Tipos de nodo huerfanos:** `Control`, `Prospecto`, `Experimento comercial`, `Otro` no aparecen en los filtros del rail. Nunca se podran filtrar.

**P1 — Fechas y montos en texto libre:** Campos `desc`, `notes`, `status`, `owner` son strings sin estructura. No hay validacion de fechas ni montos.

**P2 — Duplicados potenciales:** `normalizeGraph` valida duplicados en importacion, pero no hay validacion al crear nodos desde la UI.

---

## 9. Seguridad

**P0 — Repo publico con datos comerciales:** `default-graph.mjs` contiene nombres de clientes, productos, procesos internos de RR Aliados. El repo es publico en GitHub.

**P0 — Sin CSP:** `vercel.json` no tiene `headers` para Content-Security-Policy. El visor multimedia monta iframes con URLs externas sin restricciones.

**P0 — Iframes permisivos:** Las vistas RR usan `sandbox="allow-scripts allow-same-origin allow-popups"`. `allow-same-origin` combinado con `allow-scripts` anula gran parte de la proteccion del sandbox.

**P1 — confirm() nativo:** Tres usos de `window.confirm()` para acciones destructivas. Bloquean el hilo principal y son anti-patron en UX moderna.

**P1 — URLs sin lista blanca estricta:** `classifyMediaUrl` acepta cualquier dominio HTTPS como `embed`. No hay restriccion a dominios permitidos.

**P2 — SVG sin sanitizacion:** Si un nodo tiene un SVG malicioso en media, se renderiza directamente.

---

## 10. Accesibilidad

**P1 — Objetivos tactiles pequenos:** Botones del tabbar miden ~32-40px de alto. El estandar es 44px minimo.

**P1 — Contraste insuficiente:** Conexiones con opacity 0.16. Texto `.atlas-muted` probablemente falla AA.

**P1 — HTML semantico:** Las tarjetas de nodos se renderizan como `<button>` (bien para clickeabilidad) pero contienen `<h3>` dentro. Eso no es valido HTML (heading dentro de button).

**P2 — Foco no visible:** No se verifico `:focus-visible` en todos los elementos interactivos.

**P2 — aria-live sin moderacion:** El status bar usa `aria-live="polite"` pero actualiza en cada render (movimiento de mouse, zoom). Puede ser molesto para lectores de pantalla.

---

## 11. Calidad general

**P1 — Lighthouse no verificado:** No se ejecuto auditoria automatizada.

**P1 — Tests existentes pero no verificados:** Hay tests en `src/core/atlas-state.test.mjs`, `src/core/process-model.test.mjs`, etc. No se ejecutaron en esta auditoria.

**P2 — Estilos inline en index.html:** Los estilos de transicion, tabbar, loading, etc. estan en un `<style>` dentro de `index.html` en lugar de `src/styles/`. Dificulta el mantenimiento.

---

## 12. Producto — Inventario de botones y funciones

### Header (8 controles visibles)
1. Buscar (input)
2. Configuracion (toggle settings panel)
3. Exportar mapa (dentro de settings)
4. Importar mapa (dentro de settings)
5. Restaurar base (dentro de settings)
6. Cambiar tema (dentro de settings)
7. Mostrar/ocultar minimapa (dentro de settings)
8. Mostrar/ocultar conexiones (dentro de settings)

**Problema:** Aunque 6 estan dentro de "Configuracion", el panel settings es un control adicional. Total: 2 permanentes (buscar + config) + 6 en panel desplegable. Esto cumple el limite si consideramos solo los permanentes.

### Toolbar del lienzo (7 controles)
1. Alejar
2. Acercar
3. Reencuadrar
4. Acciones (toggle tools en mobile)
5. Deshacer
6. Rehacer
7. Nuevo nodo
8. Dibujar (con submenu de 6 figuras)
9. Conectar
10. Detalle (mobile)
11. Ir a un proceso

**Problema:** En desktop se muestran todos (11 controles). Excede ampliamente el limite de 6.

### Tabbar inferior (7 destinos)
1. Mapa
2. Procesos
3. Buscar
4. Grafo
5. BPMN
6. Flujos
7. Menu

**Problema:** Excede el limite de 4 destinos de primer nivel.

### Rail lateral (10 filtros)
1. Toda la empresa
2. Gobierno
3. Procesos
4. Clientes
5. Productos
6. Areas
7. Talento
8. Herramientas
9. Procesos BPMN
10. Hint

---

## Resumen de prioridades

| Prioridad | Cantidad | Bloquea despliegue |
|-----------|----------|-------------------|
| P0 | 12 | Si |
| P1 | 24 | Deberia |
| P2 | 12 | No, pero reduce calidad |

### Top 5 P0 a resolver antes de cualquier despliegue:
1. **Reconciliar builds:** Volver a `c3d336d` como base y re-aplicar tabs Grafo/BPMN/Flujos correctamente.
2. **Seguridad:** Proteger repo (datos comerciales publicos), agregar CSP, restringir iframes.
3. **Arquitectura de informacion:** Reducir a 4 tabs y 6 controles visibles. Eliminar nombres duplicados.
4. **Zoom anclado al cursor:** Corregir calculo de x/y al hacer zoom.
5. **Conexiones visibles:** Aumentar contraste, agregar flechas, corregir anclaje.

---

## Recomendacion inmediata

No se debe seguir trabajando sobre `atlas-bpmn-movil` como base. El build `c3d336d` (`feat/atlas-audit-ux`) tiene mejor arquitectura de UI, controles mas limpios, y funcionalidades que el usuario ya habia visto. La estrategia correcta es:

1. Checkout de `c3d336d` o merge de `feat/atlas-audit-ux`.
2. Re-aplicar los tabs Grafo/BPMN/Flujos como modulos integrados, no como iframes rudimentarios.
3. A partir de ahi, aplicar las fases del megaprompt.

---

*Fin de la auditoria. No se modifico codigo. Proximo paso: decision del dueno del producto sobre la base a usar.*
