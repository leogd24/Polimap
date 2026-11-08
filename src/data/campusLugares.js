// =====================================================================
// src/data/campusLugares.js
// Lugares del Poli que NO son edificios (Marcos — Mapa)
//
// Salen en el mapa con su propio ícono y se puede usar "Cómo llegar".
// No tienen ficha (no son de campusBuildings.js).
//
// Para AGREGAR un lugar:
//   1. Copia uno de abajo y cambia sus datos.
//   2. `id` es una palabra sin espacios (por ejemplo 'biblioteca').
//   3. En src/data/campusPaths.js → entradas, pon en qué punto del pasillo
//      está su entrada:  biblioteca: 12,  (con ?trazar → Entrada también se puede).
//
// Campos:
//   id       → identificador único (se usa en campusPaths.js → entradas)
//   name     → nombre que se ve en el mapa
//   summary  → qué es (sale debajo del nombre)
//   icono    → ícono de Material Symbols (https://fonts.google.com/icons)
//   coords   → [lat, lng] donde va el marcador
//   destino  → cómo se dice en las indicaciones: "Llegas a ___"
// =====================================================================

export const LUGARES_EXTRA = [
  {
    id: 'cafeteria',
    name: 'Cafetería',
    summary: 'Cafetería del Poli',
    description: 'El edificio gris a la derecha del edificio 6. Abre todos los días.',
    icono: 'local_cafe',
    coords: [20.747047, -103.38],
    destino: 'la cafetería',
  },
  {
    id: 'cancha1',
    name: 'Cancha 1',
    summary: 'Cancha (lado izquierdo)',
    description: 'Pasando el edificio 10, al subir por las escaleras o la rampa. Es la de la izquierda.',
    icono: 'sports_basketball',
    coords: [20.748406, -103.38031],
    destino: 'la cancha 1',
  },
  {
    id: 'cancha2',
    name: 'Cancha 2',
    summary: 'Cancha (lado derecho)',
    description: 'Pasando el edificio 10, al subir por las escaleras o la rampa. Es la de la derecha.',
    icono: 'sports_soccer',
    coords: [20.748367, -103.380044],
    destino: 'la cancha 2',
  },
];
