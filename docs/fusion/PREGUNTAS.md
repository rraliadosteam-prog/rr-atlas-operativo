# Preguntas pendientes — Fusión Atlas RR

Formato: `TODO(Rosas): ...`

- TODO(Rosas): Confirmar si el título final debe ser «RR Labs · Atlas de procesos» (B) o «RR Aliados · Atlas operativo» (A). El prompt dice conservar el shell de B, pero la navegación de A habla de «Atlas Operativo RR».
- TODO(Rosas): Confirmar tipografía oficial: ¿se mantiene Inter Tight + Lexend o el brand kit usa Neue Haas Grotesk / Graphie? (marcado como «sin confirmar»).
- TODO(Rosas): ¿Se conserva la vista "Mapa vivo" jerárquica de B como landing principal o se quiere la vista "Inicio" con tarjetas de A como entrada?
- TODO(Rosas): ¿Cuál es el hub RR al que apunta "Volver al hub RR"? En B está `http://localhost:8081/`; en producción necesita URL real.
- TODO(Rosas): Estado de los bots extra del árbol de B (Buen Puente, Media Manager, Gains, Becas y Exposición): ¿pertenecen a la flota vigente o quedan como "sin confirmar"?
- TODO(Rosas): Vigencia de la flota Hermes documentada en `20_Empresa/flota_ia.md` (corte 2026-09-26): ¿histórica o aún vigente parcialmente?
- TODO(Rosas): Confirmar lista canónica de clientes y estados: Wundeer, BOGA, Candilejas + 553, IMF Visions, Satiro_Sushi, Amsterdam, Zapatos/Shoes Colombia, Turismo Anheyca, Billares Charly Brown, Siraitia, Alma_y_Mente.
- TODO(Rosas): ¿Quién puede tener cuenta de cobro en RR? (colaborador vs contrato vs otros).
- TODO(Rosas): ¿Existen datos públicos de contacto personal del equipo (correo/teléfono) que sí se puedan mostrar, o se mantiene solo nombre + rol?
- TODO(Rosas): ¿Se incluyen cifras agregadas no financieras en "Mensaje ejecutivo diario" (por ejemplo, número de tareas bloqueadas) o se deja solo como flujo sin datos?
- TODO(Rosas): El prompt habla de 17 semillas BPMN, pero A trae 16 archivos en `src/bpmn/seeds/` (y `scripts/validate-bpmn.mjs` exige 16). ¿Falta una semilla por modelar o la cuenta del prompt está desactualizada?
- TODO(Rosas): Ninguna de las 16 semillas pasa el lint sin avisos (8 tienen la deuda documentada `no-gateway-join-fork`). ¿Se repara el modelado de esas compuertas (fase 5) o se acepta la deuda visible en la app?
- TODO(Rosas): En móvil (≤760px) el acceso a BPMN queda oculto hasta que exista la tabbar de la fase 6. ¿Se aprueba esa espera o el enlace debe quedar visible en la barra superior?
