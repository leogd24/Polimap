// =====================================================================
// src/lib/campusRouting.js
// Cálculo de rutas a pie dentro del Poli (Marcos — Mapa)
//
// JavaScript puro (sin React ni Leaflet), para que también lo puedan usar
// el asistente o los reportes si algún día lo necesitan.
//
// Idea general (igual que Google Maps, en chiquito):
//   1. Los pasillos son una "red": nodos (puntos) unidos por tramos.
//   2. Tu ubicación se "pega" al pasillo más cercano.
//   3. Con el algoritmo de Dijkstra se busca el camino más corto hasta
//      la entrada del edificio.
//   4. Con los giros del camino se arman las indicaciones paso a paso.
// =====================================================================

// ---------------------------------------------------------------------
// 1. Medidas: convertir lat/lng a metros
// ---------------------------------------------------------------------
// En un campus de 300 m la Tierra se puede tratar como plana: 1 grado de
// latitud ≈ 111 320 m, y 1 grado de longitud ≈ eso por el coseno de la latitud.
const METROS_POR_GRADO = 111320;

function aMetros(lat, lng, latRef) {
  return {
    x: lng * METROS_POR_GRADO * Math.cos((latRef * Math.PI) / 180),
    y: lat * METROS_POR_GRADO,
  };
}

/** Distancia en metros entre dos puntos [lat, lng]. */
export function distancia(a, b) {
  const p = aMetros(a[0], a[1], a[0]);
  const q = aMetros(b[0], b[1], a[0]);
  return Math.hypot(q.x - p.x, q.y - p.y);
}

/** Rumbo en grados de a hacia b: 0 = norte, 90 = este, 180 = sur, 270 = oeste. */
function rumbo(a, b) {
  const p = aMetros(a[0], a[1], a[0]);
  const q = aMetros(b[0], b[1], a[0]);
  return ((Math.atan2(q.x - p.x, q.y - p.y) * 180) / Math.PI + 360) % 360;
}

/**
 * Punto del segmento a–b más cercano a p.
 * Regresa { punto: [lat, lng], t (0 = en a, 1 = en b), metros (qué tan lejos quedó p) }.
 */
function proyectar(p, a, b) {
  const P = aMetros(p[0], p[1], p[0]);
  const A = aMetros(a[0], a[1], p[0]);
  const B = aMetros(b[0], b[1], p[0]);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const punto = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { punto, t, metros: Math.hypot(A.x + dx * t - P.x, A.y + dy * t - P.y) };
}

/** Qué tan lejos (en metros) está p de una línea de varios puntos. */
export function distanciaALinea(p, puntos) {
  let minimo = Infinity;
  for (let i = 0; i < puntos.length - 1; i++) {
    minimo = Math.min(minimo, proyectar(p, puntos[i], puntos[i + 1]).metros);
  }
  return minimo;
}

// ---------------------------------------------------------------------
// 2. Armar la red a partir de src/data/campusPaths.js
// ---------------------------------------------------------------------
export function crearRed(pasillos) {
  const nodos = (pasillos?.nodos ?? []).map(([lat, lng]) => [Number(lat), Number(lng)]);
  const tramos = (pasillos?.tramos ?? [])
    .filter(([a, b]) => nodos[a] && nodos[b] && a !== b)
    .map(([a, b, tipo]) => ({ a, b, escaleras: tipo === 'escaleras', metros: distancia(nodos[a], nodos[b]) }));
  // vecinos[n] = lista de { hacia, tramo } para recorrer la red rápido.
  const vecinos = nodos.map(() => []);
  tramos.forEach((tramo) => {
    vecinos[tramo.a].push({ hacia: tramo.b, tramo });
    vecinos[tramo.b].push({ hacia: tramo.a, tramo });
  });
  return { nodos, tramos, vecinos, entradas: pasillos?.entradas ?? {}, provisional: !!pasillos?.provisional };
}

/** Nodo de la red más cercano a un punto (para edificios sin entrada marcada). */
export function nodoMasCercano(red, p) {
  let mejor = null;
  let mejorMetros = Infinity;
  red.nodos.forEach((n, i) => {
    if (!red.vecinos[i].length) return; // nodo suelto: no sirve
    const m = distancia(p, n);
    if (m < mejorMetros) {
      mejorMetros = m;
      mejor = i;
    }
  });
  return mejor;
}

// ---------------------------------------------------------------------
// 3. Calcular la ruta
// ---------------------------------------------------------------------
/**
 * Ruta a pie desde `origen` ([lat, lng], tu ubicación) hasta el nodo `destino`.
 *   accesible → true para NO usar tramos con escaleras.
 *   lugares   → [{ nombre, punto: [lat, lng] }] para decir "junto al Edificio 5".
 *
 * Regresa null si no hay forma de llegar, o:
 *   { puntos, metros, pasos, conEscaleras, nodos }
 *   puntos → la línea a dibujar (empieza en tu ubicación)
 *   pasos  → indicaciones [{ icono, texto, metros }]
 */
export function calcularRuta(red, origen, destino, opciones = {}) {
  // Edificio con varias puertas: se calcula a cada una y se queda la más corta.
  if (Array.isArray(destino)) {
    return destino
      .map((d) => calcularRuta(red, origen, d, opciones))
      .filter(Boolean)
      .reduce((mejor, r) => (!mejor || r.metros < mejor.metros ? r : mejor), null);
  }
  const { accesible = false, lugares = [], nombreDestino = 'tu destino' } = opciones;
  if (destino == null || !red.nodos[destino]) return null;
  const sirve = (tramo) => !(accesible && tramo.escaleras);

  // 3.1 Pegar tu ubicación al pasillo permitido más cercano.
  let pegado = null;
  let masCercanoDeTodos = Infinity; // contando también los de escaleras
  red.tramos.forEach((tramo) => {
    const pr = proyectar(origen, red.nodos[tramo.a], red.nodos[tramo.b]);
    masCercanoDeTodos = Math.min(masCercanoDeTodos, pr.metros);
    if (!sirve(tramo)) return;
    if (!pegado || pr.metros < pegado.metros) pegado = { ...pr, tramo };
  });
  if (!pegado) return null;
  // Ruta sin escaleras: si estás sobre unas escaleras (o solo se sale por ellas),
  // no vale "saltar" en línea recta a otro pasillo lejano.
  if (accesible && pegado.metros - masCercanoDeTodos > 8) return null;

  // 3.2 Dijkstra. El inicio es un nodo "virtual" (el punto pegado) que se
  //     conecta con los dos extremos del tramo donde quedaste.
  const total = red.nodos.length;
  const costo = new Array(total).fill(Infinity);
  const anterior = new Array(total).fill(null);
  const listo = new Array(total).fill(false);
  const { tramo, t } = pegado;
  costo[tramo.a] = tramo.metros * t;
  costo[tramo.b] = tramo.metros * (1 - t);
  anterior[tramo.a] = { desde: 'inicio', tramo };
  anterior[tramo.b] = { desde: 'inicio', tramo };

  // Con menos de 1000 nodos, buscar el menor "a mano" es suficientemente rápido.
  for (;;) {
    let u = -1;
    for (let i = 0; i < total; i++) if (!listo[i] && costo[i] < Infinity && (u < 0 || costo[i] < costo[u])) u = i;
    if (u < 0 || u === destino) break;
    listo[u] = true;
    for (const { hacia, tramo: tr } of red.vecinos[u]) {
      if (!sirve(tr)) continue;
      const nuevo = costo[u] + tr.metros;
      if (nuevo < costo[hacia]) {
        costo[hacia] = nuevo;
        anterior[hacia] = { desde: u, tramo: tr };
      }
    }
  }
  if (costo[destino] === Infinity) return null;

  // 3.3 Reconstruir el camino de atrás hacia adelante.
  const camino = []; // [{ nodo, escaleras (del tramo que llega a este nodo) }]
  for (let n = destino; n !== 'inicio'; n = anterior[n].desde) {
    camino.unshift({ nodo: n, escaleras: anterior[n].tramo.escaleras });
  }
  const puntos = [origen, pegado.punto, ...camino.map((c) => red.nodos[c.nodo])];
  const metros = pegado.metros + costo[destino];

  return {
    puntos,
    metros,
    nodos: camino.map((c) => c.nodo),
    conEscaleras: camino.some((c) => c.escaleras),
    pasos: armarPasos(red, pegado, camino, lugares, nombreDestino),
  };
}

// ---------------------------------------------------------------------
// 4. Indicaciones paso a paso
// ---------------------------------------------------------------------
// Íconos de Material Symbols (los mismos que usa <Icon />).
function giro(delta) {
  const abs = Math.abs(delta);
  const lado = delta > 0 ? 'derecha' : 'izquierda';
  if (abs < 30) return null; // casi derecho: no se menciona
  if (abs < 60) return { icono: `turn_slight_${delta > 0 ? 'right' : 'left'}`, texto: `Sigue ligeramente a la ${lado}` };
  if (abs < 150) return { icono: `turn_${delta > 0 ? 'right' : 'left'}`, texto: `Gira a la ${lado}` };
  return { icono: 'u_turn_left', texto: 'Da la vuelta' };
}

function lugarCercano(punto, lugares) {
  let mejor = null;
  lugares.forEach((l) => {
    const m = distancia(punto, l.punto);
    if (m < 30 && (!mejor || m < mejor.m)) mejor = { m, nombre: l.nombre };
  });
  return mejor?.nombre ?? null;
}

function armarPasos(red, pegado, camino, lugares, nombreDestino) {
  // Tramos a recorrer (desde el punto pegado), juntando los que van casi derecho.
  const pts = [pegado.punto, ...camino.map((c) => red.nodos[c.nodo])];
  const pasos = [];
  let actual = { icono: 'straight', texto: 'Camina por el pasillo', metros: 0 };

  for (let i = 0; i < pts.length - 1; i++) {
    const metros = distancia(pts[i], pts[i + 1]);
    if (metros < 0.5) continue; // pedacito sin largo (quedaste justo en un nodo)
    const escaleras = !!camino[i]?.escaleras;

    // ¿Empieza un paso nuevo aquí? (por un giro, o porque empiezan/terminan escaleras)
    let g = null;
    if (i > 0) {
      const delta = ((rumbo(pts[i], pts[i + 1]) - rumbo(pts[i - 1], pts[i]) + 540) % 360) - 180;
      g = giro(delta);
    }
    const cambiaEscalera = escaleras !== !!actual.escaleras;
    if (actual.metros > 0 && (g || cambiaEscalera)) {
      pasos.push(actual);
      const lugar = lugarCercano(pts[i], lugares);
      const junto = lugar ? ` junto al ${lugar}` : '';
      if (escaleras) {
        // "Gira a la derecha y toma las escaleras" / "Toma las escaleras junto al Edificio 4"
        actual = g ? { icono: 'stairs', texto: `${g.texto}${junto} y toma las escaleras` } : { icono: 'stairs', texto: `Toma las escaleras${junto}` };
      } else {
        actual = g ? { ...g, texto: g.texto + junto } : { icono: 'straight', texto: `Sigue derecho por el pasillo${junto}` };
      }
      actual.metros = 0;
    } else if (actual.metros === 0 && escaleras) {
      actual = { icono: 'stairs', texto: 'Toma las escaleras', metros: 0 }; // el camino empieza con escaleras
    }
    actual.escaleras = escaleras;
    actual.metros += metros;
  }
  if (actual.metros > 0) pasos.push(actual);

  // El primer paso: si estás lejos del pasillo, primero hay que llegar a él.
  if (pegado.metros > 8) pasos.unshift({ icono: 'near_me', texto: 'Ve hacia el pasillo más cercano', metros: pegado.metros });
  pasos.push({ icono: 'flag', texto: `Llegas a la entrada de ${nombreDestino}`, metros: 0 });

  // Solo lo que necesita la pantalla (se quita la marca interna de escaleras).
  return pasos.map(({ icono, texto, metros }) => ({ icono, texto, metros }));
}
