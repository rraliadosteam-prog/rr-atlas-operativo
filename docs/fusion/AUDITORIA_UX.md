# Auditoría UX/UI — Fusión Atlas RR (A → B)

- **Fecha:** 2026-11-02 · **Bloque:** 2 de 6 (item 2 del encargo)
- **Alcance:** shell de B (mapa vivo) + vista BPMN de A dentro del shell de B.
- **Cómo se midió:** `scripts/auditoria-ux-fusion.mjs` (Playwright headless + Chrome real, server estático sobre `dist/`).
  Se ejecuta con `npm run build && npm run audit:ux`.
  Datos crudos: `docs/fusion/AUDITORIA_UX.json`. Capturas: `docs/fusion/capturas/auditoria/`.
- **Viewports:** 1440×900 (escritorio), 768×1024 (tableta), 360×740 (móvil).
- **Proceso de referencia:** `Oportunidad a cliente` (`ventas_como_una_oportunidad_se_convierte_en_cliente`), 49 formas, 3 carriles.

> Todas las medidas están en píxeles CSS. Los tamaños de nodo del mapa se normalizan con el zoom del lienzo
> (la sonda divide por la escala del `transform` de `[data-canvas]`), porque el tamaño real de la tarjeta no cambia con el zoom.

> **Nota de honestidad:** la primera pasada de la auditoría reportó dos bugs que resultaron ser **falsos positivos de la
> propia sonda** (el inspector de elementos y la edición directa de etiquetas). Se detectaron al verificar con clics
> reales sobre las semillas reales (`t_*`, `e_*`, `g_*`, `part_*`, `lane_*`) y quedan corregidos en la sonda y en este
> informe. Ver §5.

---

## 1. Resumen ejecutivo

| Severidad | Pendientes | Resueltos en este bloque |
|---|---|---|
| 🔴 Crítico | 1 | 3 (diagrama bloqueado en tablet/móvil, botón «Editar» roto, enlace al hub a `localhost`) |
| 🟠 Alto | 4 | 1 (el recorrido «Siguiente» no avanzaba) |
| 🟡 Medio | 6 | 1 (contraste ilegible de «Volver al mapa») |
| 🟢 Bajo | 2 | — |

**Lo que funciona bien (verificado con clics reales):** el mapa vivo de 71 nodos renderiza sin scroll horizontal en los tres
anchos; la búsqueda filtra; el inspector lateral abre con el nodo seleccionado; el diagrama BPMN **abre y se recorre** en
escritorio y tablet (49 formas, 3 carriles, lint «0 errores · 16 avisos»); el clic en una tarea muestra su nombre y su tipo
en el inspector; el recorrido «Siguiente» avanza y marca el paso en fucsia; el doble clic **edita la etiqueta** de una tarea
y el cambio se aplica en el lienzo; los cuatro exportes (`.bpmn`, `.svg`, `.png`, JSON versionado) descargan archivos con
contenido real en los tres viewports; la vuelta del diagrama al mapa es limpia.

**Pendiente crítico:** en 360 px el lienzo es tan pequeño que el clic no alcanza a los elementos (el inspector no responde)
y el mapa vivo sigue sin ser navegable con el dedo.

---

## 2. Mediciones por viewport

### 2.1 Escritorio — 1440×900

| Elemento | Medida | Lectura |
|---|---|---|
| Barra superior | 81 px de alto | Correcto |
| Panel lateral (rail) | 255 px de ancho | Correcto |
| Buscador | 620 px de ancho | Correcto |
| Botón «◇ BPMN» | visible, 92 px | Correcto |
| Botón «Volver al hub RR» | **oculto** | Correcto (decisión de Rosas) |
| Nodo del mapa | 55×27 px a zoom 1 | Pequeño, pero el mapa se recorre con zoom |
| Minimapa | oculto por defecto | Correcto |
| Nodos visibles | 71 | Correcto |
| Scroll horizontal | 1440/1440 → **no hay** | Correcto |
| Vista BPMN | **1440×752 px** (antes 376) | Corregido: la vista toma toda la altura del shell |
| Catálogo BPMN | 290 px de catálogo, tarjeta 332×82 | Correcto |
| Toolbar BPMN | 61 px (una fila) | Correcto |
| Lienzo del diagrama | 1150×**591 px** (antes 147) | Corregido: el diagrama ya es legible |
| Exportes | `.bpmn` 15 525 B · `.svg` 38 636 B · `.png` 417 KB · JSON 80 471 B | Correcto |

### 2.2 Tableta — 768×1024

| Elemento | Medida | Lectura |
|---|---|---|
| Barra superior | 96 px de alto | Correcto |
| `div.top-actions` | **left 512 → right 871** | 🔴 **103 px fuera de la pantalla**: «Guía» y «＋ Añadir nodo» quedan inalcanzables |
| Rail | 210 px | Correcto |
| Buscador | 246 px | Funciona |
| Nodo del mapa | **23×12 px** | 🟠 Por debajo del mínimo táctil de 32 px |
| Vista BPMN | 1440→**768×861 px** | Corregido |
| Catálogo BPMN | una columna, tarjeta 744×60 | Correcto |
| Toolbar BPMN | 113 px (tres filas) | 🟡 Come espacio del diagrama |
| **Abrir un proceso** | ✅ **ahora funciona** (antes: lienzo de 0 px) | Corregido |
| Clic en un nodo del mapa | timeout (nodo fuera del área visible tras encuadrar) | 🟠 El mapa no se puede explorar a 768 |

### 2.3 Móvil — 360×740

| Elemento | Medida | Lectura |
|---|---|---|
| Barra superior | 124 px (17 % del alto visible) | 🟡 Se come pantalla |
| Buscador | 336 px | Correcto |
| Botón «◇ BPMN» | **ancho 0 (oculto)** | 🟠 No hay forma de llegar al catálogo BPMN en móvil |
| Nodo del mapa | 189×95 px | Tamaño correcto, pero el clic falla |
| Botones del nodo (asa, colapsar) | 31×31 px | 🟠 Por debajo de 44 px |
| Texto de estado del nodo | 9 px | 🟡 Ilegible |
| Catálogo BPMN | tarjeta 336×82 | Correcto |
| Toolbar BPMN | **165 px (cinco filas)** | 🟠 22 % de la pantalla en botones; debería ser un menú «⋯» |
| Vista BPMN | 360×554 px | Correcto |
| **Abrir un proceso** | ✅ **ahora funciona** | Corregido |
| Clic en un elemento del diagrama | el inspector **no** aparece | 🟠 El lienzo es demasiado pequeño para apuntar con el dedo |
| Exportes | funcionan los cuatro | Correcto |
| Toast de confirmación | no visible tras exportar | 🟡 El usuario no confirma la acción |

---

## 3. Bugs pendientes

### 🔴 Crítico

1. **La barra superior se sale de pantalla en 768 px.**
   `div.top-actions` termina en `right: 871` con un viewport de 768: «Guía» y «＋ Añadir nodo» quedan fuera.
   Falta un breakpoint intermedio (768–1100 px) que compacte la barra.

### 🟠 Altos

2. **En 360 px el diagrama no responde al toque.** Con el lienzo de 554 px y el catálogo de 180 px, el clic no alcanza
   las formas: el inspector no aparece y el doble clic no abre la edición de etiquetas. Necesita un modo «pantalla
   completa» para el diagrama en móvil.
3. **Los nodos del mapa no son clicables en 768 y 360.** `page.click('.node-card')` expira: tras el encuadre el primer
   nodo queda fuera del área visible y el nodo de 23×12 px no es un objetivo táctil razonable.
4. **Objetivos táctiles por debajo del mínimo.** Nodo 23×12 px (768) y botones del nodo 31×31 px (360).
   Regla práctica: mínimo 32 px en escritorio, 44 px en táctil.
5. **No hay menú contextual (*context pad*) al seleccionar un elemento** (`contextPad: false` en los tres viewports):
   no se pueden crear tareas ni conectar elementos desde la interfaz.

### 🟡 Medios

6. **Búsqueda sin resultados: lienzo vacío sin explicación.** Escribir «ventas» deja 0 nodos y un lienzo vacío;
   solo con Enter aparece el aviso «No encontramos ese nodo». Falta un estado vacío visible mientras se escribe.
7. **Toolbar BPMN demasiado alta en móvil** (165 px, cinco filas de botones). Debería colapsar a «⋯» con un menú.
8. **Topbar de 124 px en 360×740.** El rail plegado podría ir en un cajón.
9. **Texto de estado del nodo a 9 px** (`.node-status`, «Responsable con fuente» / «Por confirmar con Rosas»).
10. **Sin tabbar ni gestos táctiles.** No hay barra inferior ni pinza/zoom táctil; el item 7 del encargo sigue abierto.
11. **Accesibilidad incompleta en la vista BPMN.** El lienzo no expone `role="application"` ni instrucciones de teclado,
    y no hay navegación por teclado entre elementos del diagrama.

### 🟢 Bajos

12. La marquesina (`rr-marquee__track`) sobresale por la izquierda: es el comportamiento esperado del bucle, no un bug.
13. El botón «◇ BPMN» se oculta por debajo de 760 px (CSS). Se deja así hasta que exista la tabbar móvil.

---

## 4. Recorridos con clics reales

### 4.1 Ver (abrir y recorrer un diagrama)

| Paso | 1440 | 768 | 360 |
|---|---|---|---|
| Abrir «Oportunidad a cliente» desde el catálogo | ✅ 49 formas, 3 carriles | ✅ | ✅ |
| Lectura del informe de lint | ✅ «0 errores de lint · 16 avisos» | ✅ | ✅ |
| Clic en una tarea → inspector con nombre y tipo | ✅ «Llega alguien · Evento de inicio · 0 entradas · 1 salidas» | ✅ | ❌ el lienzo es demasiado pequeño |
| «Siguiente» avanza el paso | ✅ «paso 1 de 11» → «paso 2 de 11 · 2. Se anota» | ✅ | ✅ |
| El paso actual se marca en el lienzo | ✅ contorno fucsia | ✅ | ✅ |
| «Volver al mapa» | ✅ vuelve limpio, sin scroll residual | ✅ | ✅ |

### 4.2 Navegar (mapa vivo)

| Paso | 1440 | 768 | 360 |
|---|---|---|---|
| Cargar el mapa | ✅ 71 nodos, sin scroll horizontal | ✅ 71 nodos | ✅ 71 nodos |
| Filtrar con el buscador | ✅ el contador baja de 71 a 0 con «ventas» | ✅ | ✅ |
| Aviso cuando no hay resultados | ❌ lienzo vacío sin mensaje (solo con Enter) | ❌ | ❌ |
| Clic en un nodo → inspector lateral | ✅ abre con el título «RR Labs» | ❌ timeout | ❌ timeout |
| Migas de pan | ✅ «RR Labs» | ✅ | ✅ |
| Clic en «BPMN» de la barra superior | ✅ | ✅ | ❌ botón oculto |
| Clic en «◇ Procesos BPMN» del rail | ✅ | ✅ | ✅ |

### 4.3 Editar

| Paso | 1440 | 768 | 360 |
|---|---|---|---|
| Alternar Ver → Editar | ✅ (tras corregir el bug del botón) | ✅ | ✅ |
| Aparece la paleta de bpmn-js | ✅ | ✅ | ✅ |
| Doble clic → editar la etiqueta | ✅ «2. Se anota» → «2. Se anota (editada)» | ✅ | ❌ no abre en 360 |
| Menú contextual (*context pad*) | ❌ | ❌ | ❌ |
| El cambio se refleja en el modelo v5 | ❌ (el modelo v5 es la fase 2) | ❌ | ❌ |
| Undo/redo dentro del diagrama | ❌ (solo existe en el mapa) | ❌ | ❌ |

### 4.4 Exportar

| Paso | 1440 | 768 | 360 |
|---|---|---|---|
| Exportar `.bpmn` | ✅ 15 525 bytes | ✅ | ✅ |
| Exportar `.svg` | ✅ 38 636 bytes | ✅ | ✅ |
| Exportar `.png` | ✅ 417 KB | ✅ | ✅ |
| Exportar JSON del mapa | ✅ 80 471 bytes + aviso «JSON versionado exportado.» | ✅ | ✅ (sin toast visible) |
| Reimportar el `.bpmn` y comparar elementos | ⏳ pendiente (fase 2: modelo v5) | ⏳ | ⏳ |

---

## 5. Correcciones aplicadas en este bloque

| # | Archivo | Cambio | Efecto |
|---|---|---|---|
| 1 | `src/styles/rr-tree.css` | Regla global `[hidden] { display: none !important; }` | 🔴 **Causa raíz del diagrama bloqueado**: `.shell` es `display:grid`, así que el mapa seguía ocupando media pantalla con `hidden` y la vista BPMN recibía la mitad del alto (376 px en vez de 752). Ahora el diagrama abre en tablet y móvil |
| 2 | `src/styles/bpmn.css` | `.bpmn-canvas-wrap { min-height: 320px }` y breakpoint ≤900 px con `grid-template-rows: 180px minmax(320px, 1fr)` y `overflow:auto` | El lienzo nunca vuelve a quedar en 0 px de alto |
| 3 | `src/app/bpmn-view.mjs` | `$('[data-bpmn-mode]')` → `$('[data-bpmn-accion="modo"]')` | El botón «Editar» ya cambia a «Ver» y aparece la paleta de bpmn-js; desaparece el `TypeError` de la consola |
| 4 | `src/app/bpmn-view.mjs` | Nueva función `avanzar(delta)`: «Anterior»/«Siguiente» actualizan el rótulo del paso | El recorrido avanzaba por dentro pero la interfaz se quedaba en «paso 1 de 11» |
| 5 | `src/bpmn/entry.mjs` | `marcarPaso()`: la clase `rr-paso-actual` marca el paso del recorrido | El usuario sabe dónde está en el diagrama (contorno fucsia) |
| 6 | `src/styles/bpmn.css` | Estilo de `.rr-paso-actual` en fucsia RR | Colores RR visibles sobre el diagrama |
| 7 | `src/styles/bpmn.css` | Los botones de la vista BPMN pasan a tinta RR sobre crema | «Volver al mapa» pasa de 1,01:1 (ilegible) a negro sobre crema (≈15:1) |
| 8 | `index.html` + `src/styles/rr-tree.css` | «Volver al hub RR» queda oculto | Decisión de Rosas: el hub se oculta hasta que exista la URL real (antes apuntaba a `localhost:8081`) |
| 9 | `scripts/auditoria-ux-fusion.mjs` | (nuevo) sonda de layout, contraste, objetivos táctiles y 4 recorridos en 3 viewports | La auditoría es repetible en cada bloque |
| 10 | `scripts/auditoria-ux-fusion.mjs` | Selectores corregidos a los ids reales de las semillas (`t_*`, `e_*`, `g_*`, `part_*`, `lane_*`) | Se eliminaron los dos falsos positivos (inspector y edición directa) |

**Verificación tras los cambios:** `npm run check` en verde (202 tests, 0 fail); consola del navegador sin errores en los tres
viewports; el diagrama abre en 1440, 768 y 360; el inspector responde; «Siguiente» avanza; la edición directa aplica el cambio.

---

## 6. Recomendación de orden para el item 3 (BPMN editable en sitio)

1. **Conectar el diagrama con el modelo v5** (fase 2): cada cambio de etiqueta, nombre o carril debe escribir en el
   modelo y en el XML, con historial y deshacer/rehacer propios del diagrama. Hoy el cambio vive solo en la sesión.
2. **Menú contextual y paleta por área** con los colores RR (bug 5): crear tareas, compuertas y eventos desde la interfaz.
3. **Inspector editable del elemento**: nombre, carril/rol, sistemas, entradas/salidas, notas, fuente y corte.
4. **Modo pantalla completa del diagrama** (item 5 del encargo): resuelve de paso el táctil en 360 px (bugs 2 y 3).

---

## 7. Capturas

`docs/fusion/capturas/auditoria/` (17 capturas: 7 en escritorio, 5 en tablet, 5 en móvil):

- `01-mapa-vivo` — mapa vivo con el rail y la barra superior.
- `02-navegar-inspector` — nodo seleccionado con el inspector lateral abierto.
- `03-bpmn-catalogo` — catálogo BPMN por áreas.
- `04-bpmn-proceso-ver` — proceso abierto en modo Ver.
- `05-bpmn-editar` — modo Editar con la paleta de bpmn-js.
- `06-exportar` — resultado de la exportación.
- `07-volver-al-mapa` — regreso al mapa desde el diagrama.

---

## 8. Pendiente para decisión de Rosas

- `TODO(Rosas):` ¿el catálogo BPMN debe existir en móvil o el diagrama se deja solo en escritorio? Hoy el botón se oculta
  en ≤760 px y en 360 px el lienzo es demasiado pequeño para apuntar con el dedo (bugs 2 y 13).
- `TODO(Rosas):` la barra superior en 768 px: ¿compactar los botones o mover «Añadir nodo» al rail?
- `TODO(Rosas):` el nodo del mapa a 23×12 px en tablet, ¿se amplía el tamaño mínimo de tarjeta o se deja así porque
  el mapa se recorre con zoom?

Se anotan también en `docs/fusion/PREGUNTAS.md`.
---

## 9. Estado tras el item 5 (diagrama a pantalla completa) — 2026-11-02

El item 5 del encargo (modo diagrama a pantalla completa) cierra varios de los bugs de esta
auditoría. Mediciones tomadas con `npm run audit:ux` antes y después:

| Viewport | Lienzo antes | Lienzo ahora | Scroll |
|---|---|---|---|
| Escritorio 1440×900 | 1150 × 471 px | **1440 × 653 px** | no |
| Tableta 768×1024 | 768 × 320 px | **768 × 825 px** | no |
| Móvil 360×740 | 360 × 320 px | **360 × 532 px** | no |

- **Bug 2 (🟠) cerrado**: en 360 px el diagrama ya ocupa la pantalla sin scroll y el toque
  llega a las formas (la paleta de bpmn-js pasó de una columna vertical de 450 px que tapaba
  media pantalla a una franja horizontal deslizable de 44 px).
- **Bug 7 (🟡) cerrado en móvil**: la barra de controles es una sola fila deslizable (antes
  cinco filas y 165 px de alto).
- **Bug 5 (🟠) parcial**: el *context pad* de bpmn-js sigue sin usarse en la interfaz (bug 5
  abierto); la creación de elementos se hace con «＋ Añadir» (item 3, ya entregado).
- **Bug 3 (🟠) sigue abierto**: los nodos del mapa no son clicables a 768 y 360 px. Se comparó
  el JSON de la auditoría con el del bloque anterior y el fallo es idéntico: es un problema
  del mapa, no del diagrama. Queda para el item 7 (responsive).
- **Bug 1 (🔴) sigue abierto**: la barra superior se sale de pantalla a 768 px. No se tocó
  porque el item 5 deja el diagrama por encima de esa barra en pantalla completa, pero la
  vista partida sigue mostrando el shell.

Evidencia: `npm run verificar:pantalla` (escritorio 1440, móvil 390 y móvil 360) y las capturas
`docs/fusion/capturas/pantalla-bpmn-*.png`.
