/* atlas/bpmn.js — diagramas BPMN en SVG puro.
   Script clásico de navegador: sin módulos, sin imports, sin build.
   Expone: window.BPMN = { medir(flujo), dibujar(flujo) }. */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* constantes de geometría                                            */
  /* ------------------------------------------------------------------ */
  var COL = 300;      /* ancho de columna                                  */
  var X0 = 120;       /* x del borde izquierdo de la primera columna        */
  var BAND_H = 170;   /* alto base de una franja (carril)                   */
  var TOP = 100;      /* y de la primera franja                            */
  var MARGEN = 120;   /* margen derecho/inferior del mundo                  */
  var MIN_W = 900;
  var MIN_H = 520;
  var TINTA_FLECHA = '#7d6f76';

  /* alto de fila cuando un carril necesita apilar nodos */
  var FILA_MIN = 104;
  var FILA_PAD = 20;
  var BANDA_TOP = 34;   /* espacio bajo la etiqueta del carril */
  var BANDA_BOT = 16;

  var MEDIDAS = {
    evento_inicio: { w: 56, h: 56 },
    evento_fin: { w: 56, h: 56 },
    compuerta: { w: 72, h: 72 },
    tarea: { w: 190, h: 86 },
    dato: { w: 140, h: 86 }
  };

  /* ------------------------------------------------------------------ */
  /* utilidades                                                         */
  /* ------------------------------------------------------------------ */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(v) {
    var r = Math.round(v * 10) / 10;
    if (!isFinite(r)) r = 0;
    return String(r);
  }

  function dist(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function solapa(a, b, pad) {
    pad = pad || 0;
    return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad &&
      a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  }

  /* reparte puntos cada 'paso' px a lo largo de una polilínea */
  function densificar(pts, paso) {
    var salida = [pts[0].slice()];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var l = dist(a, b);
      var n = Math.max(1, Math.ceil(l / paso));
      for (var k = 1; k <= n; k++) {
        salida.push([
          a[0] + (b[0] - a[0]) * k / n,
          a[1] + (b[1] - a[1]) * k / n
        ]);
      }
    }
    return salida;
  }

  /* ancho aproximado de un texto, sin medirlo en el DOM */
  var ESTRECHAS = 'ilj|!.,;:\'`"()[]';
  var ANCHAS = 'mwMW';
  var MAYUS = 'ÁÉÍÓÚÑÜ';
  var MINUS = 'áéíóúñü';
  var MEDIAS = '—–-';

  function anchoTexto(texto, fs) {
    var t = String(texto == null ? '' : texto);
    var total = 0, i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charAt(i);
      var o = 0.56;
      if (c === ' ') o = 0.28;
      else if (ESTRECHAS.indexOf(c) >= 0) o = 0.3;
      else if (ANCHAS.indexOf(c) >= 0) o = 0.86;
      else if (MAYUS.indexOf(c) >= 0) o = 0.68;
      else if (MINUS.indexOf(c) >= 0) o = 0.55;
      else if (MEDIAS.indexOf(c) >= 0) o = 0.4;
      else if (c >= 'A' && c <= 'Z') o = 0.66;
      else if (c >= '0' && c <= '9') o = 0.57;
      else if ('¿?¡+×÷'.indexOf(c) >= 0) o = 0.62;
      total += o;
    }
    return total * fs;
  }

  /* corta un texto en líneas que quepan en maxW */
  function envolver(texto, maxW, fs, maxLineas) {
    var palabras = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim().split(' ');
    var lineas = [];
    var actual = '';
    var i, p, prueba, trozo, c;

    for (i = 0; i < palabras.length; i++) {
      p = palabras[i];
      if (!p) continue;
      if (anchoTexto(p, fs) > maxW) {           /* palabra más larga que la caja */
        if (actual) { lineas.push(actual); actual = ''; }
        trozo = '';
        for (c = 0; c < p.length; c++) {
          if (trozo && anchoTexto(trozo + p.charAt(c), fs) > maxW) {
            lineas.push(trozo);
            trozo = p.charAt(c);
          } else {
            trozo += p.charAt(c);
          }
        }
        actual = trozo;
        continue;
      }
      prueba = actual ? actual + ' ' + p : p;
      if (!actual || anchoTexto(prueba, fs) <= maxW) actual = prueba;
      else { lineas.push(actual); actual = p; }
    }
    if (actual) lineas.push(actual);

    if (lineas.length > maxLineas) {
      lineas = lineas.slice(0, maxLineas);
      var ultima = lineas[maxLineas - 1];
      while (ultima.length > 1 && anchoTexto(ultima + '…', fs) > maxW) {
        ultima = ultima.slice(0, -1).replace(/\s+$/, '');
      }
      lineas[maxLineas - 1] = ultima.replace(/[\s,;:.]+$/, '') + '…';
    }
    return lineas;
  }

  /* ------------------------------------------------------------------ */
  /* cálculo de la disposición                                          */
  /* ------------------------------------------------------------------ */
  function calcular(flujo) {
    flujo = flujo || {};
    var lista = Array.isArray(flujo.nodos) ? flujo.nodos : [];
    var carriles = Array.isArray(flujo.lanes) ? flujo.lanes.slice() : [];
    var idxCarril = Object.create(null);
    var i, j, k;

    for (i = 0; i < carriles.length; i++) {
      carriles[i] = String(carriles[i]);
      if (!(carriles[i] in idxCarril)) idxCarril[carriles[i]] = i;
    }

    var opts = (flujo && flujo.__bpmnOpts) || {};
    var forzadas = opts.posiciones || {};

    var nodos = [];
    for (i = 0; i < lista.length; i++) {
      var src = lista[i] || {};
      var tipo = MEDIDAS[src.tipo] ? src.tipo : 'tarea';
      var carril = src.carril == null ? '' : String(src.carril);
      if (!(carril in idxCarril)) {
        idxCarril[carril] = carriles.length;
        carriles.push(carril);
      }
      var med = MEDIDAS[tipo];
      var forz = forzadas[src.id == null ? 'n' + i : String(src.id)] || {};
      nodos.push({
        id: src.id == null ? 'n' + i : String(src.id),
        tipo: tipo,
        nombre: src.nombre == null ? '' : String(src.nombre),
        texto: src.texto == null ? '' : String(src.texto),
        sim: src.sim == null ? '' : String(src.sim),
        color: src.color ? String(src.color) : '',
        carril: carril,
        lane: idxCarril[carril],
        w: med.w,
        h: med.h,
        col: 0,
        fila: 0,
        fijo: forz.x != null && forz.y != null,
        cx: forz.x != null ? Number(forz.x) : 0,
        cy: forz.y != null ? Number(forz.y) : 0
      });
    }
    var n = nodos.length;

    var porId = Object.create(null);
    for (i = 0; i < n; i++) porId[nodos[i].id] = i;

    /* conexiones válidas (sin duplicados) */
    var crudas = Array.isArray(flujo.conexiones) ? flujo.conexiones : [];
    var conns = [];
    var vistos = Object.create(null);
    for (i = 0; i < crudas.length; i++) {
      var c = crudas[i] || {};
      var ia = porId[String(c.a)];
      var ib = porId[String(c.b)];
      if (ia === undefined || ib === undefined || ia === ib) continue;
      var clave = ia + '>' + ib;
      if (vistos[clave]) continue;
      vistos[clave] = true;
      conns.push({
        a: ia,
        b: ib,
        etiqueta: c.etiqueta == null ? '' : String(c.etiqueta),
        tipo: c.tipo == null ? '' : String(c.tipo)
      });
    }

    /* --- 1. aristas de retroceso (ciclos) ------------------------------- */
    var adj = [];
    for (i = 0; i < n; i++) adj.push([]);
    for (i = 0; i < conns.length; i++) adj[conns[i].a].push(conns[i].b);

    var marca = [];
    for (i = 0; i < n; i++) marca.push(0);
    var retro = Object.create(null);

    function dfs(v) {
      marca[v] = 1;
      var sal = adj[v];
      for (var s = 0; s < sal.length; s++) {
        var t = sal[s];
        if (marca[t] === 1) retro[v + '>' + t] = true;
        else if (marca[t] === 0) dfs(t);
      }
      marca[v] = 2;
    }
    var orden = [];
    for (i = 0; i < n; i++) if (nodos[i].tipo === 'evento_inicio') orden.push(i);
    for (i = 0; i < n; i++) orden.push(i);
    for (i = 0; i < n; i++) if (marca[orden[i]] === 0) dfs(orden[i]);

    /* --- 2. profundidad = camino más largo desde un evento de inicio ----- */
    var dag = [];
    for (i = 0; i < n; i++) dag.push([]);
    for (i = 0; i < conns.length; i++) {
      if (!retro[conns[i].a + '>' + conns[i].b]) dag[conns[i].a].push(conns[i].b);
    }

    var prof = [];
    for (i = 0; i < n; i++) prof.push(-1);
    for (i = 0; i < n; i++) if (nodos[i].tipo === 'evento_inicio') prof[i] = 0;
    var cambio = true, vueltas = 0;
    while (cambio && vueltas++ <= n + 2) {
      cambio = false;
      for (i = 0; i < n; i++) {
        if (prof[i] < 0) continue;
        for (j = 0; j < dag[i].length; j++) {
          var h = dag[i][j];
          if (prof[h] < prof[i] + 1) { prof[h] = prof[i] + 1; cambio = true; }
        }
      }
    }

    /* --- 3. nodos inalcanzables: después de los alcanzables de su carril - */
    var maxCarril = Object.create(null);
    for (i = 0; i < n; i++) {
      if (prof[i] < 0) continue;
      var lc = nodos[i].lane;
      if (maxCarril[lc] === undefined || prof[i] > maxCarril[lc]) maxCarril[lc] = prof[i];
    }
    var baseCarril = Object.create(null);
    var usados = Object.create(null);
    for (i = 0; i < carriles.length; i++) {
      baseCarril[i] = maxCarril[i] === undefined ? 0 : maxCarril[i] + 1;
      usados[i] = 0;
    }
    for (i = 0; i < n; i++) {
      if (prof[i] >= 0) continue;
      var lant = nodos[i].lane;
      prof[i] = baseCarril[lant] + usados[lant];
      usados[lant] += 1;
    }

    /* --- 4. franjas, filas y posiciones --------------------------------- */
    var porCarril = [];
    for (i = 0; i < carriles.length; i++) {
      porCarril.push({ grupos: Object.create(null), maxH: 56, maxCol: 0, filas: 1 });
    }
    for (i = 0; i < n; i++) {
      var nd = nodos[i];
      nd.col = prof[i];
      var cont = porCarril[nd.lane];
      if (!cont.grupos[nd.col]) cont.grupos[nd.col] = [];
      cont.grupos[nd.col].push(i);
      if (nd.h > cont.maxH) cont.maxH = nd.h;
      if (nd.col > cont.maxCol) cont.maxCol = nd.col;
    }
    for (i = 0; i < carriles.length; i++) {
      var gs = porCarril[i].grupos;
      for (var claveG in gs) {
        if (gs[claveG].length > porCarril[i].filas) porCarril[i].filas = gs[claveG].length;
      }
    }

    var bandas = [];
    var y = TOP;
    for (i = 0; i < carriles.length; i++) {
      var info = porCarril[i];
      var R = info.filas;
      var filaH = (R === 1) ? (BAND_H - BANDA_TOP - BANDA_BOT) : Math.max(info.maxH + FILA_PAD, FILA_MIN);
      var alto = (R === 1) ? BAND_H : (BANDA_TOP + R * filaH + BANDA_BOT);
      bandas.push({ i: i, y: y, h: alto, yFondo: y + alto, rowH: filaH, filas: R, texto: carriles[i] });
      y += alto;
    }

    for (i = 0; i < carriles.length; i++) {
      var banda = bandas[i];
      var grupos = porCarril[i].grupos;
      for (var colG in grupos) {
        var grupo = grupos[colG];
        var R2 = banda.filas;
        var inicio = (R2 - grupo.length) / 2;
        for (k = 0; k < grupo.length; k++) {
          var nodo = nodos[grupo[k]];
          if (nodo.fijo) continue;
          nodo.fila = inicio + k;
          nodo.cx = X0 + Number(colG) * COL + COL / 2;
          nodo.cy = banda.y + BANDA_TOP + (nodo.fila + 0.5) * banda.rowH;
        }
      }
    }

    /* --- 5. tamaño del mundo -------------------------------------------- */
    var derecha = 0, fondoReal = y;
    for (i = 0; i < n; i++) {
      var ndo = nodos[i];
      var borde = ndo.cx + ndo.w / 2;
      if (borde > derecha) derecha = borde;
      var bordeInf = ndo.cy + ndo.h / 2;
      if (bordeInf > fondoReal) fondoReal = bordeInf;
    }
    var ancho = Math.max(MIN_W, Math.ceil(derecha + MARGEN));
    var altoMundo = Math.max(MIN_H, Math.ceil(fondoReal + MARGEN));

    /* Ajustar por pasillos inferiores y rutas largas que excedan el alto base. */
    var Ltmp = {
      nodos: nodos,
      carriles: carriles,
      bandas: bandas,
      conns: conns,
      ancho: ancho,
      alto: altoMundo,
      fondoBandas: y
    };
    var rutasTmp = calcularRutas(Ltmp);
    for (var r = 0; r < rutasTmp.length; r++) {
      var muestras = rutasTmp[r].muestras;
      for (var m = 0; m < muestras.length; m++) {
        var bordeRuta = muestras[m][1] + MARGEN;
        if (bordeRuta > altoMundo) altoMundo = Math.ceil(bordeRuta);
      }
    }

    return {
      nodos: nodos,
      carriles: carriles,
      bandas: bandas,
      conns: conns,
      ancho: ancho,
      alto: altoMundo,
      fondoBandas: y
    };
  }

  /* ------------------------------------------------------------------ */
  /* trazados                                                           */
  /* ------------------------------------------------------------------ */
  function anclas(nd) {
    var abajo = nd.tipo === 'dato' ? nd.h / 2 - 7 : nd.h / 2;
    return {
      r: [nd.cx + nd.w / 2, nd.cy],
      l: [nd.cx - nd.w / 2, nd.cy],
      t: [nd.cx, nd.cy - nd.h / 2],
      b: [nd.cx, nd.cy + abajo]
    };
  }

  function muestrearCubica(p0, p1, p2, p3) {
    var m = [];
    for (var i = 0; i <= 32; i++) {
      var t = i / 32, mt = 1 - t;
      m.push([
        mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
      ]);
    }
    return m;
  }

  function cubica(p0, p1, p2, p3) {
    return {
      d: 'M' + num(p0[0]) + ',' + num(p0[1]) +
        'C' + num(p1[0]) + ',' + num(p1[1]) + ' ' +
        num(p2[0]) + ',' + num(p2[1]) + ' ' +
        num(p3[0]) + ',' + num(p3[1]),
      muestras: muestrearCubica(p0, p1, p2, p3)
    };
  }

  function recta(p0, p1) {
    return {
      d: 'M' + num(p0[0]) + ',' + num(p0[1]) + 'L' + num(p1[0]) + ',' + num(p1[1]),
      muestras: densificar([p0.slice(), p1.slice()], 12)
    };
  }

  /* polilínea con esquinas redondeadas */
  function traza(pts, radio) {
    var d = 'M' + num(pts[0][0]) + ',' + num(pts[0][1]);
    var muestras = [pts[0].slice()];
    var i, t, mt;
    for (i = 1; i < pts.length; i++) {
      var p = pts[i];
      if (i < pts.length - 1) {
        var prev = pts[i - 1], sig = pts[i + 1];
        var v1x = prev[0] - p[0], v1y = prev[1] - p[1];
        var v2x = sig[0] - p[0], v2y = sig[1] - p[1];
        var l1 = Math.sqrt(v1x * v1x + v1y * v1y);
        var l2 = Math.sqrt(v2x * v2x + v2y * v2y);
        var rr = Math.min(radio, l1 / 2, l2 / 2);
        if (rr > 1.5) {
          var ax = p[0] + v1x / l1 * rr, ay = p[1] + v1y / l1 * rr;
          var bx = p[0] + v2x / l2 * rr, by = p[1] + v2y / l2 * rr;
          d += 'L' + num(ax) + ',' + num(ay);
          d += 'Q' + num(p[0]) + ',' + num(p[1]) + ' ' + num(bx) + ',' + num(by);
          muestras.push([ax, ay]);
          for (t = 0.2; t < 1; t += 0.2) {
            mt = 1 - t;
            muestras.push([
              mt * mt * ax + 2 * mt * t * p[0] + t * t * bx,
              mt * mt * ay + 2 * mt * t * p[1] + t * t * by
            ]);
          }
          muestras.push([bx, by]);
          continue;
        }
      }
      d += 'L' + num(p[0]) + ',' + num(p[1]);
      muestras.push(p.slice());
    }
    return { d: d, muestras: densificar(muestras, 12) };
  }

  function puntoMedio(muestras) {
    if (!muestras.length) return [0, 0];
    var total = 0, i;
    var acumulado = [0];
    for (i = 1; i < muestras.length; i++) {
      total += dist(muestras[i - 1], muestras[i]);
      acumulado.push(total);
    }
    if (total === 0) return muestras[0].slice();
    var mitad = total / 2;
    for (i = 1; i < muestras.length; i++) {
      if (acumulado[i] >= mitad) {
        var tramo = acumulado[i] - acumulado[i - 1];
        var f = tramo === 0 ? 0 : (mitad - acumulado[i - 1]) / tramo;
        return [
          muestras[i - 1][0] + (muestras[i][0] - muestras[i - 1][0]) * f,
          muestras[i - 1][1] + (muestras[i][1] - muestras[i - 1][1]) * f
        ];
      }
    }
    return muestras[muestras.length - 1].slice();
  }

  /* ------------------------------------------------------------------ */
  /* rutas de las flechas                                               */
  /* ------------------------------------------------------------------ */
  /* ¿no hay otra figura encima de esta en su misma columna y carril? */
  function libreArriba(nodos, B) {
    for (var i = 0; i < nodos.length; i++) {
      var o = nodos[i];
      if (o === B) continue;
      if (o.lane === B.lane && o.col === B.col && o.cy < B.cy) return false;
    }
    return true;
  }

  /* ¿hay otra figura de ese carril entre las dos columnas? */
  function hayEntre(nodos, A, B) {
    for (var i = 0; i < nodos.length; i++) {
      var o = nodos[i];
      if (o.lane !== A.lane) continue;
      if (o.col > A.col && o.col < B.col) return true;
    }
    return false;
  }

  /* ¿hay alguna figura debajo de esta en su misma columna y carril? */
  function libreAbajo(nodos, A) {
    for (var i = 0; i < nodos.length; i++) {
      var o = nodos[i];
      if (o === A) continue;
      if (o.lane === A.lane && o.col === A.col && o.cy > A.cy) return false;
    }
    return true;
  }

  /* los eventos y las compuertas escriben su nombre debajo de la figura */
  function textoAbajo(A) {
    if (!A.nombre) return false;
    return A.tipo === 'compuerta' || A.tipo === 'evento_inicio' || A.tipo === 'evento_fin';
  }

  function calcularRutas(L) {
    var nodos = L.nodos, bandas = L.bandas;
    var iCorredor = 0;
    var usos = Object.create(null);
    var salida = [];

    for (var c = 0; c < L.conns.length; c++) {
      var con = L.conns[c];
      var A = nodos[con.a], B = nodos[con.b];
      var pa = anclas(A), pb = anclas(B);
      var la = A.lane, lb = B.lane;
      var adelante = B.col > A.col;
      var ruta = null;
      var gA, gB, k, yP;

      if (la === lb && adelante && hayEntre(nodos, A, B)) {
        /* mismo carril, pero hay una caja en medio: se pasa por el borde de
           la franja para no atravesarla */
        k = usos['b' + la] || 0;
        usos['b' + la] = k + 1;
        yP = (k % 2 === 0) ? bandas[la].yFondo - 14 : bandas[la].y + 22;
        gA = A.cx + 121;
        gB = B.cx - 121;
        ruta = traza([pa.r, [gA, A.cy], [gA, yP], [gB, yP], [gB, B.cy], pb.l], 14);
      } else if (la === lb && adelante) {
        /* mismo carril, hacia la derecha */
        if (Math.abs(A.cy - B.cy) < 1) {
          ruta = recta(pa.r, pb.l);
        } else {
          var dx = pb.l[0] - pa.r[0];
          var h1 = Math.max(30, dx * 0.45);
          ruta = cubica(pa.r, [pa.r[0] + h1, pa.r[1]], [pb.l[0] - h1, pb.l[1]], pb.l);
        }
      } else if (lb === la + 1 && adelante && !textoAbajo(A) &&
                 libreAbajo(nodos, A) && libreArriba(nodos, B)) {
        /* baja de carril: sale por abajo y entra por arriba */
        var dy = pb.t[1] - pa.b[1];
        var v1 = Math.max(26, Math.min(46, dy * 0.5));
        if (Math.abs(pb.t[0] - pa.b[0]) < 1) ruta = recta(pa.b, pb.t);
        else ruta = cubica(pa.b, [pa.b[0], pa.b[1] + v1], [pb.t[0], pb.t[1] - v1], pb.t);
      } else if ((lb === la + 1 || lb === la - 1) && adelante) {
        /* cambio con el carril vecino: pasillo paralelo al borde común, que
           queda siempre entre la franja de arriba y la de abajo */
        var borde = (lb > la) ? bandas[lb].y : bandas[la].y;
        k = usos['y' + borde] || 0;
        usos['y' + borde] = k + 1;
        yP = borde + 12 + 8 * (k % 2);
        gA = A.cx + 121;
        gB = B.cx - 121;
        ruta = traza([pa.r, [gA, A.cy], [gA, yP], [gB, yP], [gB, B.cy], pb.l], 14);
      } else {
        /* retroceso, o salto de dos o más carriles: pasillo exterior */
        var arriba = iCorredor < 5;
        if (arriba) yP = 34 + 14 * iCorredor;
        else yP = L.fondoBandas + 30 + 12 * (iCorredor - 5);
        iCorredor += 1;
        gA = A.cx + 121;
        gB = B.cx - 121;
        if (lb === 0 && arriba && libreArriba(nodos, B)) {
          /* el pasillo queda sobre todo: se entra por arriba, sin pisar el
             texto que va debajo de la figura */
          ruta = traza([pa.r, [gA, A.cy], [gA, yP], [B.cx, yP], pb.t], 16);
        } else {
          ruta = traza([pa.r, [gA, A.cy], [gA, yP], [gB, yP], [gB, B.cy], pb.l], 16);
        }
      }

      salida.push({
        con: con,
        d: ruta.d,
        muestras: ruta.muestras,
        medio: puntoMedio(ruta.muestras)
      });
    }
    return salida;
  }

  /* ------------------------------------------------------------------ */
  /* etiquetas de las flechas                                           */
  /* ------------------------------------------------------------------ */
  function cajaEtiqueta(et, maxW) {
    var lineas = envolver(et, maxW, 10, 3);
    var w = 0;
    for (var i = 0; i < lineas.length; i++) w = Math.max(w, anchoTexto(lineas[i], 10));
    return { lineas: lineas, w: Math.ceil(w) + 10, h: lineas.length * 11 + 5 };
  }

  /* busca, alrededor de la mitad del trazado, un hueco donde la etiqueta no
     tape ninguna figura ni otro texto */
  function ubicarEtiqueta(muestras, caja, obstaculos, anchoMundo) {
    var n = muestras.length;
    if (!n) return null;
    var acum = [0], total = 0, i;
    for (i = 1; i < n; i++) {
      total += dist(muestras[i - 1], muestras[i]);
      acum.push(total);
    }
    if (!total) return null;
    var mid = total / 2;
    var orden = [];
    for (i = 0; i < n; i++) {
      if (Math.abs(acum[i] - mid) <= total * 0.34) orden.push(i);
    }
    orden.sort(function (a, b) {
      return Math.abs(acum[a] - mid) - Math.abs(acum[b] - mid);
    });
    for (var q = 0; q < orden.length; q++) {
      var p = muestras[orden[q]];
      var r = { x: p[0] - caja.w / 2, y: p[1] - caja.h / 2, w: caja.w, h: caja.h };
      if (r.x < 6 || r.x + r.w > anchoMundo - 6) continue;
      var choca = false;
      for (i = 0; i < obstaculos.length; i++) {
        if (solapa(r, obstaculos[i], 3)) { choca = true; break; }
      }
      if (!choca) return [p[0], p[1]];
    }
    return null;
  }

  function dibujarEtiqueta(caja, pos) {
    var x = pos[0] - caja.w / 2, y = pos[1] - caja.h / 2;
    var salida = '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(caja.w) +
      '" height="' + num(caja.h) + '" rx="3" fill="#0b0004" fill-opacity="0.95"/>';
    for (var i = 0; i < caja.lineas.length; i++) {
      salida += texto(pos[0], y + 10.5 + i * 11, caja.lineas[i], 10, '#cfc4c8', null, null);
    }
    return salida;
  }

  /* ------------------------------------------------------------------ */
  /* dibujo de nodos                                                    */
  /* ------------------------------------------------------------------ */
  function texto(cx, y, contenido, fs, color, peso, extra) {
    if (contenido == null || contenido === '') return '';
    return '<text x="' + num(cx) + '" y="' + num(y) + '" font-size="' + fs +
      '" fill="' + color + '"' + (peso ? ' font-weight="' + peso + '"' : '') +
      (extra || '') + ' text-anchor="middle">' + esc(contenido) + '</text>';
  }

  function dibujarTarea(nd) {
    var x = nd.cx - nd.w / 2, y = nd.cy - nd.h / 2;
    var borde = nd.color || '#eb076d';
    var salida = '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + nd.w +
      '" height="' + nd.h + '" rx="12" fill="#0e0007" stroke="' + borde + '" stroke-width="1.4"/>';
    var lineas = envolver(nd.nombre, nd.w - 26, 12.5, 3);
    var altoNombre = lineas.length * 16;
    var totalT = altoNombre + 16;
    var arriba = nd.cy - totalT / 2;
    for (var i = 0; i < lineas.length; i++) {
      salida += texto(nd.cx, arriba + 11.5 + i * 16, lineas[i], 12.5, '#fffff3', null, null);
    }
    salida += texto(nd.cx, arriba + altoNombre + 11, nd.tipo, 10, '#b9aab0', null, ' letter-spacing="0.6"');
    return salida;
  }

  function dibujarEvento(nd) {
    var inicio = nd.tipo === 'evento_inicio';
    var borde = nd.color || (inicio ? '#ded116' : '#ded116');
    var relleno = inicio ? '#140f04' : '#141004';
    var grosor = inicio ? 1.6 : 4;
    var salida = '<circle cx="' + num(nd.cx) + '" cy="' + num(nd.cy) + '" r="28" fill="' +
      relleno + '" stroke="' + borde + '" stroke-width="' + grosor + '"/>';
    var lineas = envolver(nd.nombre, 190, 11, 2);
    for (var i = 0; i < lineas.length; i++) {
      salida += texto(nd.cx, nd.cy + 28 + 15 + i * 13, lineas[i], 11, '#fffff3', null, null);
    }
    return salida;
  }

  function dibujarCompuerta(nd) {
    var borde = nd.color || '#ded116';
    var r = 36;
    var puntos = num(nd.cx) + ',' + num(nd.cy - r) + ' ' +
      num(nd.cx + r) + ',' + num(nd.cy) + ' ' +
      num(nd.cx) + ',' + num(nd.cy + r) + ' ' +
      num(nd.cx - r) + ',' + num(nd.cy);
    var salida = '<polygon points="' + puntos + '" fill="#141004" stroke="' + borde +
      '" stroke-width="1.6"/>';
    var glifo = '◇';
    if (nd.sim === 'paralela') glifo = '+';
    else if (nd.sim === 'exclusiva') glifo = '×';
    else if (nd.sim === 'inclusiva') glifo = '○';
    salida += texto(nd.cx, nd.cy + 8, glifo, 22, borde, null, null);
    if (nd.nombre) {
      var lineas = envolver(nd.nombre, 196, 11, 2);
      for (var i = 0; i < lineas.length; i++) {
        salida += texto(nd.cx, nd.cy + r + 15 + i * 13, lineas[i], 11, '#ded115', null, null);
      }
    }
    return salida;
  }

  function dibujarDato(nd) {
    var x = nd.cx - nd.w / 2, y = nd.cy - nd.h / 2;
    var b = y + nd.h, w = nd.w;
    var borde = nd.color || '#b954ae';
    var d = 'M' + num(x) + ',' + num(y) +
      'H' + num(x + w) +
      'V' + num(b - 16) +
      'C' + num(x + w * 0.78) + ',' + num(b - 4) + ' ' +
      num(x + w * 0.63) + ',' + num(b - 4) + ' ' +
      num(x + w * 0.5) + ',' + num(b - 13) +
      'C' + num(x + w * 0.37) + ',' + num(b - 22) + ' ' +
      num(x + w * 0.2) + ',' + num(b - 24) + ' ' +
      num(x) + ',' + num(b - 12) + 'Z';
    var salida = '<path d="' + d + '" fill="#12000a" stroke="' + borde + '" stroke-width="1.4"/>';
    var lineas = envolver(nd.nombre, nd.w - 26, 12.5, 2);
    var altoNombre = lineas.length * 15;
    var totalT = altoNombre + 15;
    var arriba = nd.cy - 6 - totalT / 2;
    for (var i = 0; i < lineas.length; i++) {
      salida += texto(nd.cx, arriba + 11 + i * 15, lineas[i], 12.5, '#fffff3', null, null);
    }
    salida += texto(nd.cx, arriba + altoNombre + 10, nd.tipo, 10, '#b9aab0', null, ' letter-spacing="0.6"');
    return salida;
  }

  function dibujarNodo(nd) {
    if (nd.tipo === 'evento_inicio' || nd.tipo === 'evento_fin') return dibujarEvento(nd);
    if (nd.tipo === 'compuerta') return dibujarCompuerta(nd);
    if (nd.tipo === 'dato') return dibujarDato(nd);
    return dibujarTarea(nd);
  }

  /* ------------------------------------------------------------------ */
  /* API                                                                */
  /* ------------------------------------------------------------------ */
  function medir(flujo, opts) {
    if (flujo && opts) flujo.__bpmnOpts = opts;
    var L = calcular(flujo);
    return { ancho: L.ancho, alto: L.alto };
  }

  function posiciones(flujo, opts) {
    if (flujo && opts) flujo.__bpmnOpts = opts;
    var L = calcular(flujo);
    var out = Object.create(null);
    for (var i = 0; i < L.nodos.length; i++) {
      var nd = L.nodos[i];
      out[nd.id] = { x: nd.cx, y: nd.cy, w: nd.w, h: nd.h };
    }
    return out;
  }

  function dibujar(flujo, opts) {
    if (flujo && opts) flujo.__bpmnOpts = opts;
    var L = calcular(flujo);
    var ancho = L.ancho, alto = L.alto;
    var i;

    var defs = '<defs><marker id="bpmn-flecha" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="' + TINTA_FLECHA + '"/></marker></defs>';

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + num(ancho) + '" height="' +
      num(alto) + '" viewBox="0 0 ' + num(ancho) + ' ' + num(alto) +
      '" font-family="sans-serif">';

    svg += '<rect x="0" y="0" width="' + num(ancho) + '" height="' + num(alto) + '" fill="#070001"/>';
    svg += defs;

    /* carriles */
    var capaBandas = '';
    for (i = 0; i < L.bandas.length; i++) {
      var banda = L.bandas[i];
      var relleno = i % 2 === 0 ? '#0b0004' : '#0b0004';
      capaBandas += '<rect x="10" y="' + num(banda.y) + '" width="' + num(ancho - 20) +
        '" height="' + num(banda.h) + '" fill="' + relleno + '" stroke="#241019" stroke-width="1"/>';
      capaBandas += '<rect x="10" y="' + num(banda.y) + '" width="3" height="' + num(banda.h) +
        '" fill="#2a1020"/>';
      if (banda.texto) {
        capaBandas += '<text x="24" y="' + num(banda.y + 23) + '" font-size="11.5" fill="#9a8b91" ' +
          'font-weight="600" letter-spacing="0.3">' + esc(banda.texto) + '</text>';
      }
    }
    svg += capaBandas;

    /* obstáculos para ubicar las etiquetas de las flechas */
    var obstaculos = [];
    for (i = 0; i < L.nodos.length; i++) {
      var ndo = L.nodos[i];
      obstaculos.push({ x: ndo.cx - ndo.w / 2, y: ndo.cy - ndo.h / 2, w: ndo.w, h: ndo.h });
      if (textoAbajo(ndo)) {
        obstaculos.push({ x: ndo.cx - 100, y: ndo.cy + ndo.h / 2 - 4, w: 200, h: 36 });
      }
    }

    /* flechas debajo de las cajas */
    var rutas = calcularRutas(L);
    var capaFlechas = '';
    for (i = 0; i < rutas.length; i++) {
      capaFlechas += '<path d="' + rutas[i].d + '" fill="none" stroke="' + TINTA_FLECHA +
        '" stroke-width="1.5" marker-end="url(#bpmn-flecha)"/>';
    }
    svg += capaFlechas;

    /* nodos */
    for (i = 0; i < L.nodos.length; i++) {
      var nd = L.nodos[i];
      svg += '<g data-nodo="' + esc(nd.id) + '" class="bpmn-nodo">' + dibujarNodo(nd) + '</g>';
    }

    /* etiquetas de las flechas, encima de todo */
    var capaEtiquetas = '';
    for (i = 0; i < rutas.length; i++) {
      var et = rutas[i].con.etiqueta;
      if (!et) continue;
      var caja = null, pos = null;
      var anchos = [120, 98, 78];
      for (var a = 0; a < anchos.length; a++) {
        caja = cajaEtiqueta(et, anchos[a]);
        pos = ubicarEtiqueta(rutas[i].muestras, caja, obstaculos, ancho);
        if (pos) break;
      }
      if (!pos) {
        caja = cajaEtiqueta(et, anchos[anchos.length - 1]);
        pos = rutas[i].medio;
      }
      obstaculos.push({ x: pos[0] - caja.w / 2, y: pos[1] - caja.h / 2, w: caja.w, h: caja.h });
      capaEtiquetas += dibujarEtiqueta(caja, pos);
    }
    svg += capaEtiquetas;

    return svg + '</svg>';
  }

  global.BPMN = { medir: medir, dibujar: dibujar, posiciones: posiciones };
})(typeof window !== 'undefined' ? window : this);
