// =====================================================================
// src/data/campusPaths.js
// Pasillos del Poli: por dónde se puede CAMINAR (Marcos — Mapa)
//
// Con esto el botón "Cómo llegar" calcula la ruta más corta siguiendo los
// pasillos, como Google Maps, en lugar de una línea recta.
//
// ⚠️ NO lo escribas a mano: ábrelo con la herramienta de trazado
//    http://localhost:5173/?trazar  → pestaña Mapa
//    traza los pasillos, toca "Copiar" y pega TODO aquí, reemplazando este archivo.
//
// Cómo está armado:
//   nodos    → puntos [lat, lng] (esquinas, cruces y entradas). Su número es su lugar en la lista.
//   tramos   → pasillos que unen dos nodos: [desde, hasta]
//              Si el tramo tiene escaleras: [desde, hasta, 'escaleras']
//              (la ruta accesible los evita).
//   entradas → en qué nodo está la puerta de cada edificio: { numeroEdificio: nodo }
//              Si tiene dos puertas: { numeroEdificio: [nodo1, nodo2] } (va a la más cercana).
//   provisional → true mientras sea una red de prueba (dibujada sin medir).
// =====================================================================

export const PASILLOS = {
  // Red de PRUEBA dibujada con la foto aérea de Marcos:
  //   - Pasillo izquierdo: de la entrada principal hasta arriba del edificio 10.
  //   - Pasillo derecho: del pasillo entre el 2 y el 3 hasta arriba del 10.
  //   - Un pasillo entre cada par de edificios (y abajo del 1 y arriba del 10).
  // Las medidas son aproximadas; se afinan con ?trazar (o grabando caminando).
  provisional: true,
  nodos: [
    [20.745879, -103.380687], // 0: entrada principal (pin del Poli)
    [20.745964, -103.380674], // 1: lado izquierdo, abajo del edificio 1
    [20.745934, -103.380446], // 2: pasillo abajo del edificio 1
    [20.746178, -103.380647], // 3: lado izquierdo, entre el 1 y el 2
    [20.746147, -103.380418], // 4: pasillo entre el 1 y el 2
    [20.746398, -103.380607], // 5: lado izquierdo, entre el 2 y el 3
    [20.746363, -103.380380], // 6: pasillo entre el 2 y el 3
    [20.746327, -103.380152], // 7: lado derecho, entre el 2 y el 3
    [20.746589, -103.380568], // 8: lado izquierdo, entre el 3 y el 4
    [20.746552, -103.380340], // 9: pasillo entre el 3 y el 4
    [20.746514, -103.380113], // 10: lado derecho, entre el 3 y el 4
    [20.746789, -103.380528], // 11: lado izquierdo, entre el 4 y el 5
    [20.746752, -103.380301], // 12: pasillo entre el 4 y el 5
    [20.746715, -103.380073], // 13: lado derecho, entre el 4 y el 5
    [20.747004, -103.380537], // 14: lado izquierdo, entre el 5 y el 6
    [20.746978, -103.380308], // 15: pasillo entre el 5 y el 6
    [20.746952, -103.380080], // 16: lado derecho, entre el 5 y el 6
    [20.747225, -103.380561], // 17: lado izquierdo, entre el 6 y el 7
    [20.747198, -103.380333], // 18: pasillo entre el 6 y el 7
    [20.747172, -103.380104], // 19: lado derecho, entre el 6 y el 7
    [20.747433, -103.380544], // 20: lado izquierdo, entre el 7 y el 8
    [20.747399, -103.380317], // 21: pasillo entre el 7 y el 8
    [20.747365, -103.380089], // 22: lado derecho, entre el 7 y el 8
    [20.747645, -103.380523], // 23: lado izquierdo, entre el 8 y el 9
    [20.747613, -103.380295], // 24: pasillo entre el 8 y el 9
    [20.747582, -103.380067], // 25: lado derecho, entre el 8 y el 9
    [20.747877, -103.380492], // 26: lado izquierdo, entre el 9 y el 10
    [20.747843, -103.380265], // 27: pasillo entre el 9 y el 10
    [20.747809, -103.380037], // 28: lado derecho, entre el 9 y el 10
    [20.748110, -103.380457], // 29: lado izquierdo, arriba del edificio 10
    [20.748076, -103.380230], // 30: pasillo arriba del edificio 10
    [20.748042, -103.380002], // 31: lado derecho, arriba del edificio 10
    [20.748209, -103.380207], // 32: hacia las canchas
  ],
  tramos: [
    [0, 1, 'escaleras'], // escaleras al entrar, antes del edificio 1
    [1, 3, 'escaleras'], // escaleras entre el 1 y el 2
    [3, 5],
    [5, 8],
    [8, 11, 'escaleras'], // escaleras entre el 4 y el 5
    [11, 14],
    [14, 17],
    [17, 20, 'escaleras'], // escaleras entre el 7 y el 8
    [20, 23],
    [23, 26],
    [26, 29],
    [7, 10],
    [10, 13, 'escaleras'], // escaleras entre el 4 y el 5
    [13, 16],
    [16, 19],
    [19, 22, 'escaleras'], // escaleras entre el 7 y el 8
    [22, 25],
    [25, 28],
    [28, 31],
    [1, 2],
    [3, 4],
    [5, 6],
    [6, 7],
    [8, 9],
    [9, 10],
    [11, 12],
    [12, 13],
    [14, 15],
    [15, 16],
    [17, 18],
    [18, 19],
    [20, 21],
    [21, 22],
    [23, 24],
    [24, 25],
    [26, 27],
    [27, 28],
    [29, 30],
    [30, 31],
    [30, 32, 'escaleras'], // escaleras después del 10, antes de las canchas
  ],
  entradas: {
    1: 2, // puerta abajo
    2: [4, 6], // puerta abajo y arriba
    3: 6, // puerta abajo
    4: 9, // puerta abajo
    5: 12, // puerta abajo
    6: 15, // puerta abajo
    7: 18, // puerta abajo
    8: 24, // puerta arriba
    9: [24, 27], // puerta abajo y arriba
    10: 27, // puerta abajo
  },
};
