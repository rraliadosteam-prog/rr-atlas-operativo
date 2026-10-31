# Editor del Atlas

## Controles

- **Arrastrar un nodo:** mueve una tarjeta. La instantánea se toma en `pointerdown` y el movimiento entra en undo/redo al soltar.
- **Manejador ◇:** arrastra desde el manejador de una tarjeta hasta otra para crear un enlace `cross` decorativo.
- **Doble clic:** edita el título en línea; `Enter` guarda y `Escape` cancela.
- **Shift + clic:** añade o quita nodos de la multiselección.
- **Supr/Backspace:** elimina la selección (la raíz no se puede borrar).
- **Ctrl/Cmd + Z:** deshacer. **Ctrl/Cmd + Shift + Z** o **Ctrl/Cmd + Y:** rehacer.
- **F:** encuadra los bounds reales visibles. **/**: enfoca la búsqueda.
- **Flechas:** mueve el foco entre nodos cuando una tarjeta tiene foco.
- **Rueda / botones + y −:** zoom. El pan y el zoom solo actualizan `transform`, no reconstruyen las tarjetas.

## Datos y seguridad

El mapa conserva la forma `{ nodes, edges }`. Los enlaces `kind: "hierarchy"` son los únicos que forman el árbol; `responsibility`, `project`, `client` y `cross` son relaciones decorativas y no crean multiparent. Bots, proyectos y clientes genéricos se ubican en una banda separada cuando se ordena.

Los exports e imports usan `schemaVersion: 1`. Un JSON inválido se rechaza antes de mutar el mapa y muestra un mensaje en español. El guardado local también se valida; si `localStorage` falta o falla, el estado conserva el cambio como **sin guardar** y se ofrece exportarlo. La clave `rr-atlas-arbol-v1` se migra a `rr-atlas-arbol-v2` sin borrar la anterior.

La jerarquía rechaza ciclos y múltiples padres. Búsquedas y filtros se resuelven sobre el grafo completo y expanden los ancestros del resultado, mientras la vista colapsada se refluye para evitar huecos. El archivo `.bpmn` no se inventa ni se abre como URL arbitraria: `bpmnPath` queda indicado como pendiente hasta integrar un visor `bpmn-js` real.

## Accesibilidad

Las tarjetas tienen foco, rol y `aria-label`; los manejadores y botones tienen etiquetas explícitas y objetivos táctiles de al menos 44 px en la interfaz. Hay foco visible, navegación por flechas que enfoca la tarjeta destino, contraste AA para los controles principales y `prefers-reduced-motion`. En móvil, Controles y filtros se abren desde un panel accesible; la leyenda y la Guía no se ocultan.
