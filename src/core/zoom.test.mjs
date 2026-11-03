import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANCHO_CONTENEDOR_ESTRECHO,
  ANCHO_ESTRECHO_PX,
  ANCHO_MOVIL_PX,
  MARGEN_ENCUADRE,
  PISO_LEGIBILIDAD_DIAGRAMA,
  PISO_LECTURA_ESTRECHA,
  PISO_LECTURA_MAPA_FONDO,
  PISO_LECTURA_MOVIL,
  PISO_ZOOM_MANUAL_MAPA,
  PISO_ZOOM_MANUAL_MOTOR,
  PISO_ZOOM_MANUAL_MOTOR_ES,
  ZOOM_MAXIMO,
  ZOOM_MAXIMO_MAPA,
  acotarZoom,
  aplicarPiso,
  aplicarTecho,
  esLienzoAngosto,
  esMovil,
  esPantallaEstrecha,
  esZoomLegible,
  pisoLecturaMapa,
  pisoLecturaMapaVigente,
  pisoLegibilidadDiagrama,
  pisoManualMapa,
  pisoManualMotor,
  zoomEncuadre,
  zoomManual,
} from './zoom.mjs';

const ANCHOS_VENTANA = [360, 390, 768, 900, 1440];
const ANCHOS_CONTENEDOR = [380, 539, 700];

test('El piso de legibilidad del diagrama es 1,15 (el valor que el motor ya usaba)', () => {
  assert.equal(PISO_LEGIBILIDAD_DIAGRAMA, 1.15);
  assert.equal(pisoLegibilidadDiagrama(), 1.15);
});

test('El piso de legibilidad manda sobre todos los pisos de encuadre', () => {
  const pisosDeEncuadre = [
    PISO_LECTURA_MOVIL,
    PISO_LECTURA_ESTRECHA,
    PISO_LECTURA_MAPA_FONDO,
    PISO_ZOOM_MANUAL_MAPA,
    PISO_ZOOM_MANUAL_MOTOR,
    PISO_ZOOM_MANUAL_MOTOR_ES,
  ];
  for (const piso of pisosDeEncuadre) {
    assert.ok(piso < PISO_LEGIBILIDAD_DIAGRAMA, `El piso ${piso} queda por debajo del de legibilidad`);
  }
});

test('Los anchos que deciden son los del diseño (900, 760 y 540 del contenedor)', () => {
  assert.equal(ANCHO_ESTRECHO_PX, 900);
  assert.equal(ANCHO_MOVIL_PX, 760);
  assert.equal(ANCHO_CONTENEDOR_ESTRECHO, 540);
  assert.equal(esPantallaEstrecha(900), true);
  assert.equal(esPantallaEstrecha(901), false);
  assert.equal(esMovil(760), true);
  assert.equal(esMovil(761), false);
  assert.equal(esLienzoAngosto(539), true);
  assert.equal(esLienzoAngosto(540), false);
});

test('Mapa: el zoom manual nunca queda por debajo del piso de lectura de esa pantalla', () => {
  for (const ancho of ANCHOS_VENTANA) {
    assert.ok(
      pisoManualMapa(ancho) >= pisoLecturaMapa(ancho),
      `A ${ancho} px: manual ${pisoManualMapa(ancho)} ≥ lectura ${pisoLecturaMapa(ancho)}`,
    );
  }
});

test('Mapa: al estrechar la pantalla el piso no baja (0,45 → 0,70, nunca al revés)', () => {
  const anchos = [...ANCHOS_VENTANA].sort((a, b) => b - a);
  for (let i = 1; i < anchos.length; i += 1) {
    const anchoAnterior = anchos[i - 1];
    const ancho = anchos[i];
    assert.ok(
      pisoLecturaMapa(ancho) >= pisoLecturaMapa(anchoAnterior),
      `De ${anchoAnterior} px a ${ancho} px el piso no baja: ${pisoLecturaMapa(ancho)} ≥ ${pisoLecturaMapa(anchoAnterior)}`,
    );
  }
  assert.equal(pisoLecturaMapa(1440), PISO_LECTURA_MAPA_FONDO);
  assert.equal(pisoLecturaMapa(900), PISO_LECTURA_ESTRECHA);
  assert.equal(pisoLecturaMapa(768), PISO_LECTURA_ESTRECHA);
  assert.equal(pisoLecturaMapa(390), PISO_LECTURA_MOVIL);
  assert.equal(pisoLecturaMapa(360), PISO_LECTURA_MOVIL);
});

test('Diagrama: el piso manual nunca vuelve a quedar por encima del encuadre real', () => {
  for (const ancho of ANCHOS_CONTENEDOR) {
    assert.ok(pisoManualMotor(ancho) <= 0.25, `A ${ancho} px de contenedor: ${pisoManualMotor(ancho)} ≤ 0,25`);
  }
  assert.equal(pisoManualMotor(380), PISO_ZOOM_MANUAL_MOTOR);
  assert.equal(pisoManualMotor(539), PISO_ZOOM_MANUAL_MOTOR);
  assert.equal(pisoManualMotor(700), PISO_ZOOM_MANUAL_MOTOR_ES);
});

test('Diagrama: con el botón «−» el zoom baja (el caso que detecta el bug B2)', () => {
  // El encuadre real a 390 px deja el diagrama entre 0,12 y 0,25; se usa el
  // peor caso (0,14) y el factor del botón «−» (0,85).
  const zoomActual = 0.14;
  const factor = 0.85;
  const zoomNuevo = aplicarPiso(zoomActual * factor, pisoManualMotor(380));
  assert.ok(zoomNuevo < zoomActual, `«−» aleja: ${zoomNuevo} < ${zoomActual}`);
  // Con el piso viejo (0,55) el botón «−» agrandaba: 0,14 × 0,85 = 0,119.
  assert.ok(zoomActual * factor < 0.55, 'El piso viejo (0,55) queda por encima del zoom real y por eso «−» agrandaba');
});

test('Los techos y el margen del encuadre son los del diseño', () => {
  assert.equal(MARGEN_ENCUADRE, 0.94);
  assert.equal(ZOOM_MAXIMO, 2.6);
  assert.equal(ZOOM_MAXIMO_MAPA, 1.25);
});

test('aplicarPiso sube el zoom hasta el piso y no inventa un zoom inexistente', () => {
  assert.equal(aplicarPiso(0.12, PISO_LEGIBILIDAD_DIAGRAMA), PISO_LEGIBILIDAD_DIAGRAMA);
  assert.equal(aplicarPiso(1.4, PISO_LEGIBILIDAD_DIAGRAMA), 1.4);
  assert.equal(aplicarPiso(1.15, PISO_LEGIBILIDAD_DIAGRAMA), 1.15);
  assert.equal(aplicarPiso(undefined, PISO_LEGIBILIDAD_DIAGRAMA), undefined);
  assert.equal(aplicarPiso(null, PISO_LEGIBILIDAD_DIAGRAMA), null);
  assert.ok(Number.isNaN(aplicarPiso(Number.NaN, PISO_LEGIBILIDAD_DIAGRAMA)));
  assert.equal(aplicarPiso('1,5', PISO_LEGIBILIDAD_DIAGRAMA), '1,5');
});

test('aplicarTecho y acotarZoom respetan piso y techo', () => {
  assert.equal(aplicarTecho(4, ZOOM_MAXIMO), ZOOM_MAXIMO);
  assert.equal(aplicarTecho(1, ZOOM_MAXIMO), 1);
  assert.equal(acotarZoom(5, PISO_LEGIBILIDAD_DIAGRAMA, ZOOM_MAXIMO), ZOOM_MAXIMO);
  assert.equal(acotarZoom(0.1, PISO_LEGIBILIDAD_DIAGRAMA, ZOOM_MAXIMO), PISO_LEGIBILIDAD_DIAGRAMA);
  assert.equal(acotarZoom(1.2, PISO_LEGIBILIDAD_DIAGRAMA, ZOOM_MAXIMO), 1.2);
  assert.equal(acotarZoom(undefined, PISO_LEGIBILIDAD_DIAGRAMA, ZOOM_MAXIMO), undefined);
});

test('esZoomLegible solo afirma si el zoom se puede leer y llega al piso', () => {
  assert.equal(esZoomLegible(1.15), true);
  assert.equal(esZoomLegible(1.2), true);
  assert.equal(esZoomLegible(1.1499), false);
  assert.equal(esZoomLegible(0.45), false);
  assert.equal(esZoomLegible(null), false);
  assert.equal(esZoomLegible(undefined), false);
  assert.equal(esZoomLegible(Number.NaN), false);
  assert.equal(esZoomLegible('1,15'), false);
});

test('El piso vigente del mapa es el que la app garantiza hoy, no el móvil nuevo', () => {
  // El bloque 1C hace que `src/app/rr-tree.mjs` lea su encuadre del módulo;
  // hasta entonces el mapa vivo se limita al piso de pantalla estrecha.
  assert.equal(pisoLecturaMapaVigente(390), PISO_LECTURA_ESTRECHA);
  assert.equal(pisoLecturaMapaVigente(900), PISO_LECTURA_ESTRECHA);
  assert.equal(pisoLecturaMapaVigente(1440), PISO_LECTURA_MAPA_FONDO);
  assert.ok(pisoLecturaMapaVigente(390) <= pisoLecturaMapa(390), 'El piso vigente nunca es más alto que el declarado');
});

test('El encuadre nunca baja del piso de legibilidad (salvo que se fuerze)', () => {
  // El caso real de 390 px: el encuadre daba 0,12–0,25 y el diagrama abría
  // a 1:4–1:8, ilegible.
  assert.equal(zoomEncuadre(0.14), PISO_LEGIBILIDAD_DIAGRAMA);
  assert.equal(zoomEncuadre(0.94), PISO_LEGIBILIDAD_DIAGRAMA);
  assert.equal(zoomEncuadre(1.4), 1.4);
  // Con `forzar` el encuadre es el que se le pide (el visor pequeño del
  // panel dividido quiere ver el proceso entero, aunque sea diminuto).
  assert.equal(zoomEncuadre(0.14, { forzar: true }), 0.14);
  assert.equal(zoomEncuadre(0.94, { forzar: false }), PISO_LEGIBILIDAD_DIAGRAMA);
  // Un zoom que no es un número se devuelve tal cual.
  assert.equal(zoomEncuadre(undefined), undefined);
  assert.equal(zoomEncuadre(null), null);
  assert.ok(Number.isNaN(zoomEncuadre(Number.NaN)));
});

test('El botón «−» siempre aleja: el piso manual queda por debajo de 1,15', () => {
  const factor = 0.85;
  for (const ancho of ANCHOS_CONTENEDOR) {
    const nuevo = zoomManual(PISO_LEGIBILIDAD_DIAGRAMA, factor, ancho);
    assert.ok(nuevo < PISO_LEGIBILIDAD_DIAGRAMA, `A ${ancho} px: ${nuevo} < 1,15`);
    assert.ok(nuevo >= pisoManualMotor(ancho), `A ${ancho} px: ${nuevo} ≥ el piso manual`);
  }
  assert.ok(Math.abs(zoomManual(1.15, 0.85, 380) - 0.9775) < 1e-9);
  assert.ok(Math.abs(zoomManual(1.15, 1.2, 380) - 1.38) < 1e-9);
  // El piso manual nunca hace **subir** el zoom: «−» no agranda.
  assert.equal(zoomManual(0.1, 0.85, 380), 0.1);
  // El techo corta, pero nunca hace bajar el zoom que ya había.
  assert.equal(zoomManual(2, 2, 380), ZOOM_MAXIMO);
  assert.equal(zoomManual(3, 2, 380), 3);
  // Un factor que no es un número no cambia el zoom.
  assert.equal(zoomManual(1.15, undefined, 380), 1.15);
  assert.equal(zoomManual(undefined, 0.85, 380), undefined);
});
