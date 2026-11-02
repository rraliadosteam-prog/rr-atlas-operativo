# Auditoría UX/UI — Fusión Atlas RR (A → B)

- **Fecha:** 2026-11-02 · **Bloque:** 2 de 6 (item 2 del encargo)
- **Alcance:** shell de B (mapa vivo) + vista BPMN de A dentro del shell de B.
- **Cómo se midió:** `scripts/auditoria-ux-fusion.mjs` (Playwright headless + Chrome real, server estático sobre `dist/`).
  Se ejecuta con `npm run build && node scripts/auditoria-ux-fusion.mjs`.
  Datos crudos: `docs/fusion/AUDITORIA_UX.json`. Capturas: `docs/fusion/capturas/auditoria/`.
- **Viewports:** 1440×900 (escritorio), 768×1024 (tableta), 360×740 (móvil).
- **Proceso de referencia:** `Oportunidad a cliente` (`ventas_como_una_oportunidad_se_convierte_en_cliente`), 49 formas, 3 carriles.

> Todas las medidas están en píxeles CSS. Los tamaños de nodo del mapa se normalizan con el zoom del lienzo
> (la sonda divide por la escala del `transform` de `[data-canvas]`), porque el tamaño real de la tarjeta no cambia con el zoom.

---

## 1. Resumen ejecutivo

| Severidad | Cantidad | Detalle |
|---|---|---|
| 🔴 Crítico | 4 | El diagrama BPMN no abre en tablet ni móvil; la barra superior se sale de pantalla en 768; el botón «Editar» estaba roto; el enlace al hub apuntaba a `localhost` |
| 🟠 Alto | 5 | El inspector de elemento no responde; el recorrido «Siguiente» no avanza; los nodos del mapa no son clicables en pantallas pequeñas; los objetivos táctiles del mapa quedan por debajo de 32 px; falta la edición directa de etiquetas |
| 🟡 Medio | 6 | Búsqueda sin estado vacío; toolbar de BPMN demasiado alta en móvil; topbar de 172 px en móvil; texto de estado a 9 px; sin tabbar ni gestos; accesibilidad incompleta en la vista BPMN |
| 🟢 Bajo | 2 | marquesina con desborde lateral (esperado por la animación); botón BPMN ausente en ≤760 px |

**Lo que ya funciona bien:** el mapa vivo de 71 nodos renderiza sin scroll horizontal en los tres anchos; la búsqueda filtra
y el inspector lateral abre con el nodo seleccionado; los cuatro exportes (`.bpmn`, `.svg`, `.png`, JSON versionado)
descargan archivos con contenido real en los tres viewports; el catálogo BPMN lista 16 procesos en 7 áreas; la vuelta
del diagrama al mapa es limpia (sin scroll residual).

**Correcciones ya aplicadas en este bloque** (ver §5): botón «Editar» roto, contraste del botón «Volver al mapa»,
enlace al hub apuntando a `localhost`, `hidden` que no ocultaba por `display:inline-flex`.

---

## 2. Mediciones por viewport

### 2.1 Escritorio — 1440×900

| Elemento | Medida | Lectura |
|---|---|---|
| Barra superior | 81 px de alto | Correcto |
| Panel lateral (rail) | 255 px de ancho | Correcto |
| Buscador | 620 px de ancho | Correcto |
| Botón «◇ BPMN» | visible, 92 px | Correcto |
| Nodo del mapa | 55×27 px a zoom 1 | Pequeño, pero el mapa se recorre con zoom |
| Minimapa | oculto por defecto | Correcto (se activa con el botón) |
| Nodos visibles | 71 | Correcto |
| Scroll horizontal | 1440/1440 → **no hay** | Correcto |
| Catálogo BPMN | vista 1440×376, catálogo 290 px, tarjeta 332×82 | La vista es demasiado baja: 376 px para 16 tarjetas |
| Toolbar BPMN | 61 px (una fila) | Correcto |
| **Lienzo del diagrama** | **1150×147 px** | 🔴 **El diagrama se dibuja en 147 px de alto**: un proceso de 49 formas queda ilegible y no se puede recorrer con el mouse |
| Exportes | `.bpmn` 15,5 KB · `.svg` 38,6 KB · `.png` 417 KB · JSON 80,5 KB | Correcto |

### 2.2 Tableta — 768×1024

| Elemento | Medida | Lectura |
|---|---|---|
| Barra superior | 96 px de alto | Correcto |
| `div.top-actions` | **left 512 → right 871** | 🔴 **103 px fuera de la pantalla**: «Guía» y «＋ Añadir nodo» quedan inalcanzables |
| Rail | 210 px | Correcto |
| Buscador | 246 px | Funciona |
| Nodo del mapa | **23×12 px** | 🟠 Por debajo del mínimo táctil de 32 px y del de 44 px recomendado |
| Catálogo BPMN | 768 px a una columna, tarjeta 744×60 | Correcto |
| Toolbar BPMN | 113 px (tres filas) | 🟡 Come el espacio del diagrama |
| **Abrir un proceso** | **falla: el lienzo no tiene altura y `djs-container svg` nunca aparece** | 🔴 El diagrama no se puede ver en tablet |
| Clic en un nodo del mapa | timeout (nodo fuera del área visible tras encuadrar) | 🟠 El mapa no se puede explorar a 768 |

### 2.3 Móvil — 360×740

| Elemento | Medida | Lectura |
|---|---|---|
| Barra superior | **172 px (23 % del alto visible)** | 🟡 Se Come la pantalla; el rail pasa a una columna |
| Buscador | 336 px | Correcto |
| Botón «◇ BPMN» | **ancho 0 (oculto)** | 🟠 No hay forma de llegar al catálogo BPMN en móvil |
| Nodo del mapa | 189×95 px | Correcto (tamaño real), pero el clic falla |
| Botones del nodo (asa, colapsar) | 31×31 px | 🟠 Por debajo de 44 px |
| Texto de estado del nodo | 9 px | 🟡 Ilegible |
| Catálogo BPMN | tarjeta 336×82 | Correcto |
| Toolbar BPMN | **165 px (cinco filas)** | 🟠 22 % de la pantalla en botones; debería ser un menú «⋯» |
| **Abrir un proceso** | **falla: mismo problema de altura del lienzo** | 🔴 |
| Clic en un nodo del mapa | timeout | 🟠 Sin exploración táctil |
| Exportes | funcionan los cuatro | Correcto |
| Toast de confirmación | no visible tras exportar | 🟡 El usuario no confirma la acción |

---

## 3. Bugs encontrados

### 🔴 Críticos

1. **El diagrama BPMN no se abre en tablet ni móvil.**
   El lienzo `.bpmn-canvas` mide **0 px de alto** por debajo de 900 px de ancho: el `svg` de bpmn-js nunca se monta y la
   vista queda en blanco. Causa: `.bpmn-view__body` no define altura mínima en el breakpoint de `src/styles/bpmn.css`.
   *Corrección propuesta:* `min-height` en `.bpmn-canvas-wrap` (por ejemplo `min(70vh, 720px)`) y el catálogo en
   `overflow:auto` con el diagrama en pantalla completa.
2. **La barra superior se sale de pantalla en 768 px.**
   `div.top-actions` termina en `right: 871` con un viewport de 768: «Guía» y «＋ Añadir nodo» quedan fuera. Falta un
   breakpoint intermedio (768–1100 px) que compacte la barra.
3. **El botón «Editar» del diagrama estaba roto.** *(corregido en este bloque)*
   `src/app/bpmn-view.mjs` buscaba `[data-bpmn-mode]`, atributo que **no existe** en `index.html` (el real es
   `data-bpmn-accion="modo"`). Al hacer clic se lanzaba `TypeError: Cannot set properties of null (setting 'textContent')`
   y el modo de edición **nunca** se activaba. La consola quedaba con un error por sesión.
4. **«Volver al hub RR» apuntaba a `http://localhost:8081/` y estaba visible.** *(corregido en este bloque)*
   En producción ese enlace está roto. Decisión de Rosas: el botón queda oculto hasta que exista la URL real.
   Además `hidden` no ocultaba nada porque `.button-hub` define `display:inline-flex` (hay que forzar `display:none`).

### 🟠 Altos

5. **El inspector de elemento del diagrama no aparece al hacer clic en una forma.**
   Tras el clic, `[data-bpmn-inspector]` sigue `hidden` y el título queda en «Elemento». El callback `onElement`
   de `src/bpmn/entry.mjs` no está llegando al visor (o el clic no llega a `selection.changed`).
6. **El recorrido «Siguiente» no avanza.** El rótulo se queda en «paso 1 de 11 · Llega alguien» tras pulsar «Siguiente»;
   `workspace.step(1)` no cambia el paso. Sin esto no se puede recorrer un proceso (requisito §8.7 del mega prompt).
7. **Los nodos del mapa no son clicables en 768 y 360.** `page.click('.node-card')` expira: tras el encuadre el primer
   nodo queda fuera del área visible y el nodo de 23×12 px no es un objetivo táctil razonable.
8. **Objetivos táctiles por debajo del mínimo.** Nodo 23×12 px (768) y botones del nodo 31×31 px (360).
   Regla práctica: mínimo 32 px en escritorio, 44 px en táctil.
9. **No hay edición directa de etiquetas.** El doble clic sobre una tarea no abre el editor de texto de bpmn-js
   (`.djs-direct-editing` no existe) y tampoco aparece el *context pad*. Sin esto, «editar el nombre de una tarea»
   —requisito del item 3 del encargo— no es posible.

### 🟡 Medios

10. **Búsqueda sin resultados: lienzo vacío sin explicación.** Escribir «ventas» deja 0 nodos y un lienzo vacío;
    solo con Enter aparece el aviso «No encontramos ese nodo». Falta un estado vacío visible mientras se escribe.
11. **Toolbar BPMN demasiado alta en móvil** (165 px, cinco filas de botones). Debería colapsar a «⋯» con un menú.
12. **Topbar de 172 px en 360×740** (23 % de la pantalla). El rail plegado podría ir en un cajón.
13. **Texto de estado del nodo a 9 px** (`.node-status`, «Responsable con fuente» / «Por confirmar con Rosas»).
14. **Sin tabbar ni gestos táctiles.** No hay barra inferior ni pinza/zoom táctil; el item 7 del encargo sigue abierto.
15. **Accesibilidad incompleta en la vista BPMN.** El lienzo no expone `role="application"` ni instrucciones de teclado,
    y no hay navegación por teclado entre elementos del diagrama.
16. **La vista del catálogo BPMN mide 376 px de alto en 1440** para 16 procesos: obliga a desplazar la página entera.

### 🟢 Bajos

17. La marquesina (`rr-marquee__track`) sobresale por la izquierda: es el comportamiento esperado del bucle, no un bug.
18. El botón «◇ BPMN» se oculta por debajo de 760 px (CSS). Se deja así hasta que exista la tabbar móvil.

---

## 4. Recorridos con clics reales

### 4.1 Ver (abrir y recorrer un diagrama)

| Paso | 1440 | 768 | 360 |
|---|---|---|---|
| Abrir «Oportunidad a cliente» desde el catálogo | ✅ 49 formas, 3 carriles | ❌ el lienzo no tiene altura | ❌ el lienzo no tiene altura |
| Lectura del informe de lint | ✅ «0 errores de lint · 16 avisos» | ❌ | ❌ |
| Clic en una tarea → inspector con nombre y carril | ❌ no aparece | ❌ | ❌ |
| «Siguiente» avanza el paso | ❌ se queda en «paso 1 de 11» | ❌ | ❌ |
| «Volver al mapa» | ✅ vuelve limpio, sin scroll residual | ✅ | ✅ |

**Lectura:** el recorrido de lectura solo funciona hasta el primer clic. Es el punto que más bloquea el item 3
(«BPMN editable en sitio») y el requisito §8.4–8.7 de las pruebas.

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
| Alternar Ver → Editar | ✅ *(funciona tras corregir el bug del botón)* | ✅ | ✅ |
| Aparece la paleta de bpmn-js | ✅ | ✅ | ✅ |
| Menú contextual (*context pad*) al seleccionar | ❌ | ❌ | ❌ |
| Doble clic → editar la etiqueta | ❌ | ❌ | ❌ |
| El cambio se refleja en el modelo | ❌ (no hay modelo v5 todavía) | ❌ | ❌ |
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
| 1 | `src/app/bpmn-view.mjs` | `$('[data-bpmn-mode]')` → `$('[data-bpmn-accion="modo"]')` | El botón «Editar» ya cambia a «Ver» y la paleta de bpmn-js aparece; desaparece el `TypeError` de la consola |
| 2 | `src/styles/bpmn.css` | Los botones de la vista BPMN pasan a tinta RR sobre crema | «Volver al mapa» pasa de 1,01:1 (ilegible) a texto negro sobre crema (≈15:1) |
| 3 | `index.html` | `hidden` en el enlace «Volver al hub RR» | Se aplica la decisión de Rosas: el hub se oculta hasta que exista la URL real |
| 4 | `src/styles/rr-tree.css` | `.button[hidden] { display: none; }` | `hidden` gana sobre `display:inline-flex`; el enlace al hub deja de verse |
| 5 | `scripts/auditoria-ux-fusion.mjs` | (nuevo) sonda de layout, contraste, objetivos táctiles y 4 recorridos en 3 viewports | La auditoría es repetible en cada bloque |

**Verificación tras los cambios:** `npm run check` en verde; la consola del navegador queda sin errores en los tres
viewports; la paleta de edición aparece; el contraste bajo que reportaba el botón «Volver al mapa» desaparece.

---

## 6. Recomendación de orden para el item 3 (BPMN editable en sitio)

1. **Dar altura al lienzo** y poner el diagrama a pantalla completa (item 5 del encargo) — desbloquea tablet y móvil.
2. **Conectar `selection.changed` con el inspector** (bug 5) y **arreglar `step()`** (bug 6): sin eso no hay ni lectura
   ni edición, solo un dibujo.
3. **Editor de etiqueta** con doble clic + *context pad* + paleta por área con los colores RR (bug 9).
4. **Guardado en el modelo v5** (fase 2) con deshacer/rehacer propio del diagrama.

---

## 7. Capturas

`docs/fusion/capturas/auditoria/` (17 capturas: 7 en escritorio, 5 en tablet, 5 en móvil; en tablet y móvil no se capturan
los pasos que fallan antes de llegar a la captura):

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
  en ≤760 px y el diagrama no cabe en tablet (bugs 1 y 18).
- `TODO(Rosas):` la barra superior en 768 px: ¿compactar los botones o mover «Añadir nodo» al rail?
- `TODO(Rosas):` el nodo del mapa a 23×12 px en tablet, ¿se amplía el tamaño mínimo de tarjeta o se deja así porque
  el mapa se recorre con zoom?

Se anotan también en `docs/fusion/PREGUNTAS.md`.
