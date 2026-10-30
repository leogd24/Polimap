// src/data/buildingLayouts.js — Responsable: Alexis (con datos de Marcos)
// =====================================================================
// ESQUEMA DE CADA EDIFICIO: qué salones hay en cada piso, de izquierda
// a derecha. Lo usan:
//   - el panel (src/admin/BuildingSchematic.jsx) para dibujar el edificio
//     y poner los puntos de reporte en su salón;
//   - Reportar (src/pages/ReportScreen.jsx) para elegir el salón.
//
// ¿De dónde salen los salones?
//   1. De los HORARIOS OFICIALES 2026B (src/data/schedules/): ahí viene
//      "Aula E4-A05", "Lab. E7-L05", "Taller E8-T01"... → edificio 4, aula A05.
//   2. De los espacios de campusBuildings.js (Biblioteca, Bodega, oficinas…)
//      para los edificios que no tienen clases (1, 2, 9, 10).
//
// Regla del Poli (la dio el equipo):
//   - El 3er piso tiene las aulas A01 a A04, de izquierda a derecha.
//   - El 2º piso sigue igual (A05 a A08) y luego el 1º.
//   - Los laboratorios y talleres son más anchos y se acomodan donde caben.
//
// ⚠️ ES PROVISIONAL. Si un edificio no está como en la vida real, NO cambies
// el código: escribe ese edificio a mano en AJUSTES (más abajo) y listo.
// =====================================================================
import { allSchedules } from './schedules.js';
import { campusBuildings } from './campusBuildings.js';

// ---------------------------------------------------------------------
// PASO 1. Tipos de espacio: nombre, ícono y qué tan ancho se dibuja
// (1 = un aula normal).
// ---------------------------------------------------------------------
export const TIPOS_ESPACIO = {
  aula: { nombre: 'Aula', icono: 'school', ancho: 1 },
  lab: { nombre: 'Laboratorio', icono: 'science', ancho: 1.5 },
  taller: { nombre: 'Taller', icono: 'construction', ancho: 2 },
  espacio: { nombre: 'Espacio', icono: 'meeting_room', ancho: 1.5 },
  banos: { nombre: 'Baños', icono: 'wc', ancho: 0.75 },
  escaleras: { nombre: 'Escaleras', icono: 'stairs', ancho: 0.6 },
};

// Pisos de cada edificio. Los que no aparecen aquí tienen 3.
const PISOS = { 2: 2, 9: 2, 10: 2 };

// ---------------------------------------------------------------------
// PASO 2. AJUSTES A MANO (aquí se corrige un edificio)
// ---------------------------------------------------------------------
// Ejemplo: el edificio 3 con los laboratorios en el 1er piso:
//
//   3: {
//     pisos: 3,
//     plantas: {
//       3: ['A01', 'A02', 'A03', 'A04'],
//       2: ['L01', { id: 'PRESTAMO', nombre: 'Préstamo de equipo', tipo: 'espacio' }],
//       1: ['BAN', 'L02'],
//     },
//   },
//
// - 'A01' → aula, 'L05' → laboratorio, 'T01' → taller (como en los horarios).
// - 'BAN' → baños, 'ESC' → escaleras.
// - Cualquier otro espacio va como { id, nombre, tipo, ancho? }.
// - Las escaleras se agregan solas A LA MITAD de cada piso, como en el Poli
//   (pon escaleras: false si el edificio no las lleva así, o escríbelas tú
//   con 'ESC' en el lugar que van).
const AJUSTES = {};

// ---------------------------------------------------------------------
// PASO 3. Leer los salones de los horarios
// ---------------------------------------------------------------------
// "Aula E4-A05" → { edificio: 4, id: 'A05', tipo: 'aula' }
const PATRON_SALON = /^(Aula|Lab\.?|Taller)\s+E(\d{1,2})-([ALT])(\d{1,2})$/i;

export function leerSalon(texto) {
  const m = PATRON_SALON.exec(String(texto ?? '').trim());
  if (!m) return null;
  const letra = m[3].toUpperCase();
  return {
    edificio: Number(m[2]),
    id: `${letra}${m[4].padStart(2, '0')}`,
    tipo: letra === 'A' ? 'aula' : letra === 'L' ? 'lab' : 'taller',
  };
}

/**
 * { 4: Map('A01' → { tipo, grupos: Set('1AM TIN', …), materias: Set(…) }), ... }
 * con todos los salones de los horarios y qué grupos y materias los usan.
 */
const SALONES_HORARIOS = (() => {
  const porEdificio = {};
  for (const grupo of allSchedules) {
    for (const sesion of grupo.sessions ?? []) {
      const salon = leerSalon(sesion.room);
      if (!salon) continue;
      porEdificio[salon.edificio] ??= new Map();
      const mapa = porEdificio[salon.edificio];
      if (!mapa.has(salon.id)) mapa.set(salon.id, { tipo: salon.tipo, grupos: new Set(), materias: new Set() });
      mapa.get(salon.id).grupos.add(grupo.code);
      mapa.get(salon.id).materias.add(sesion.subject);
    }
  }
  return porEdificio;
})();

// ---------------------------------------------------------------------
// PASO 4. Convertir un id ('A05', 'BAN', {…}) en un espacio completo
// ---------------------------------------------------------------------
function crearEspacio(entrada) {
  if (typeof entrada === 'object' && entrada) {
    const tipo = TIPOS_ESPACIO[entrada.tipo] ? entrada.tipo : 'espacio';
    return {
      id: String(entrada.id),
      nombre: entrada.nombre ?? entrada.id,
      corto: entrada.corto ?? entrada.nombre ?? entrada.id,
      tipo,
      ancho: entrada.ancho ?? TIPOS_ESPACIO[tipo].ancho,
    };
  }
  const id = String(entrada).toUpperCase();
  if (id === 'BAN') return { id, nombre: 'Baños', corto: 'Baños', tipo: 'banos', ancho: TIPOS_ESPACIO.banos.ancho };
  if (id === 'ESC') return { id, nombre: 'Escaleras', corto: 'Esc.', tipo: 'escaleras', ancho: TIPOS_ESPACIO.escaleras.ancho };
  const letra = id[0];
  const tipo = letra === 'L' ? 'lab' : letra === 'T' ? 'taller' : 'aula';
  return { id, nombre: `${TIPOS_ESPACIO[tipo].nombre} ${id}`, corto: id, tipo, ancho: TIPOS_ESPACIO[tipo].ancho };
}

// Nombre corto para que quepa en el dibujo: "Laboratorio de fermentación" → "Lab. fermentación"
function acortar(nombre) {
  return nombre
    .replace(/^Laboratorio de (sistemas de )?/i, 'Lab. ')
    .replace(/^Taller de /i, 'Taller ')
    .replace(/^Oficina del? (Departamento de )?/i, 'Of. ')
    .replace(/^Coordinación de /i, 'Coord. ')
    .replace(/ y control de calidad$/i, '')
    .replace(/ y Energías Alternas$/i, '');
}

// "Planta alta: auditorio" o "Segundo piso, lado derecho: préstamo" → { piso: 2, nombre }
function leerEspacioTexto(texto, pisos) {
  let piso = null;
  let nombre = texto;
  const partes = texto.split(':');
  if (partes.length > 1) {
    const donde = partes[0].toLowerCase();
    nombre = partes.slice(1).join(':').trim();
    if (/planta alta|segundo piso|2/.test(donde)) piso = 2;
    if (/tercer piso|3/.test(donde)) piso = 3;
    if (/planta baja|primer piso/.test(donde)) piso = 1;
  }
  nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return { piso: piso && piso <= pisos ? piso : null, nombre };
}

// ---------------------------------------------------------------------
// PASO 5. Armar el esquema automático de un edificio
// ---------------------------------------------------------------------
function anchoPiso(lista) {
  return lista.reduce((suma, e) => suma + e.ancho, 0);
}

function esquemaAutomatico(numero) {
  const pisos = PISOS[numero] ?? 3;
  const plantas = {};
  for (let p = 1; p <= pisos; p += 1) plantas[p] = [];

  const salones = SALONES_HORARIOS[numero] ?? new Map();
  const aulas = [...salones].filter(([, d]) => d.tipo === 'aula').map(([id]) => id).sort();
  const grandes = [...salones].filter(([, d]) => d.tipo !== 'aula').map(([id]) => id).sort();

  // Aulas: de 4 en 4 empezando por el piso de ARRIBA, de izquierda a derecha.
  aulas.forEach((id, i) => {
    const piso = Math.max(1, pisos - Math.floor(i / 4));
    plantas[piso].push(crearEspacio(id));
  });

  // Espacios con nombre de campusBuildings.js (biblioteca, oficinas, talleres…).
  // "Aulas" y "Laboratorios" sueltos no cuentan: esos ya vienen de los horarios.
  const edificio = campusBuildings.find((b) => b.number === numero);
  const sinPiso = [];
  (edificio?.spaces ?? [])
    .filter((texto) => !/^(aulas|laboratorios)$/i.test(texto.trim()))
    .forEach((texto, i) => {
      const { piso, nombre } = leerEspacioTexto(texto, pisos);
      const tipo = /^laboratorio/i.test(nombre) ? 'lab' : /^taller/i.test(nombre) ? 'taller' : 'espacio';
      const ancho = /biblioteca|auditorio/i.test(nombre) ? 3 : TIPOS_ESPACIO[tipo].ancho;
      const espacio = crearEspacio({ id: `S${String(i + 1).padStart(2, '0')}`, nombre, corto: acortar(nombre), tipo, ancho });
      if (piso) plantas[piso].push(espacio);
      else sinPiso.push(espacio);
    });

  // Laboratorios, talleres y espacios sin piso: van al piso con más lugar,
  // empezando por la planta baja.
  [...grandes.map(crearEspacio), ...sinPiso].forEach((espacio) => {
    let mejor = 1;
    for (let p = 1; p <= pisos; p += 1) {
      if (anchoPiso(plantas[p]) < anchoPiso(plantas[mejor])) mejor = p;
    }
    plantas[mejor].push(espacio);
  });

  // Baños en la planta baja, a la izquierda.
  plantas[1].unshift(crearEspacio('BAN'));
  return { pisos, plantas };
}

function esquemaDeAjuste(numero, ajuste) {
  const pisos = ajuste.pisos ?? PISOS[numero] ?? 3;
  const plantas = {};
  for (let p = 1; p <= pisos; p += 1) plantas[p] = (ajuste.plantas?.[p] ?? []).map(crearEspacio);
  return { pisos, plantas, escaleras: ajuste.escaleras };
}

/**
 * Dónde partir un piso para que las escaleras queden lo más al centro
 * posible SIN partir un salón: entre el salón que cruza la mitad y su vecino.
 */
function indiceMitad(lista) {
  const total = anchoPiso(lista);
  let mejor = 0;
  let mejorDistancia = Infinity;
  let acumulado = 0;
  for (let i = 0; i <= lista.length; i += 1) {
    const distancia = Math.abs(acumulado - total / 2);
    if (distancia < mejorDistancia) {
      mejor = i;
      mejorDistancia = distancia;
    }
    if (i < lista.length) acumulado += lista[i].ancho;
  }
  return mejor;
}

/**
 * Salones de los horarios: nombre igual que en el horario oficial
 * ("Aula E4-A05", "Laboratorio E7-L05") y qué grupos los usan.
 */
function conHorario(numero, espacio) {
  const datos = SALONES_HORARIOS[numero]?.get(espacio.id);
  if (!/^[ALT]\d{2}$/.test(espacio.id)) return espacio;
  const codigo = `E${numero}-${espacio.id}`;
  return {
    ...espacio,
    codigo,
    nombre: `${TIPOS_ESPACIO[espacio.tipo].nombre} ${codigo}`,
    grupos: datos ? [...datos.grupos].sort() : [],
    materias: datos ? [...datos.materias] : [],
  };
}

/**
 * Posición de cada espacio en su piso, de 0 (izquierda) a 1 (derecha).
 * Las escaleras SIEMPRE quedan en el centro del edificio, a la misma altura
 * en todos los pisos; los salones de cada lado se reparten su mitad.
 * Regresa la lista con fx0 y fx1 (inicio y fin) en cada espacio.
 */
export const ANCHO_ESCALERAS = 0.08; // fracción del ancho del edificio
export function fraccionesPiso(lista) {
  const repartir = (items, desde, hasta) => {
    const total = anchoPiso(items) || 1;
    let x = desde;
    return items.map((e) => {
      const w = ((hasta - desde) * e.ancho) / total;
      const r = { ...e, fx0: x, fx1: x + w };
      x += w;
      return r;
    });
  };
  const k = lista.findIndex((e) => e.tipo === 'escaleras');
  if (k === -1) return repartir(lista, 0, 1);
  const a = 0.5 - ANCHO_ESCALERAS / 2;
  const b = 0.5 + ANCHO_ESCALERAS / 2;
  return [
    ...repartir(lista.slice(0, k), 0, a),
    { ...lista[k], fx0: a, fx1: b },
    ...repartir(lista.slice(k + 1), b, 1),
  ];
}

// ---------------------------------------------------------------------
// PASO 6. Lo que usan las pantallas
// ---------------------------------------------------------------------
const CACHE = {};

/**
 * Esquema de un edificio:
 *   { numero, pisos, plantas: { 3: [espacio…], 2: […], 1: […] }, espacios: [todos], provisional }
 * Cada espacio: { id, nombre, corto, tipo, ancho, piso }
 */
export function esquemaEdificio(numero) {
  const n = Number(numero);
  if (CACHE[n]) return CACHE[n];
  const ajuste = AJUSTES[n];
  const base = ajuste ? esquemaDeAjuste(n, ajuste) : esquemaAutomatico(n);

  // Escaleras a la MITAD de cada piso (así están en los edificios del Poli).
  if (base.escaleras !== false) {
    for (let p = 1; p <= base.pisos; p += 1) {
      const lista = base.plantas[p];
      if (!lista.some((e) => e.tipo === 'escaleras')) lista.splice(indiceMitad(lista), 0, crearEspacio('ESC'));
    }
  }

  const espacios = [];
  for (let p = base.pisos; p >= 1; p -= 1) {
    base.plantas[p] = base.plantas[p].map((e) => conHorario(n, { ...e, piso: p }));
    espacios.push(...base.plantas[p]);
  }
  CACHE[n] = { numero: n, pisos: base.pisos, plantas: base.plantas, espacios, provisional: !ajuste };
  return CACHE[n];
}

/** "3er piso", "2º piso", "Planta baja" */
export function nombrePiso(piso) {
  if (piso === 1) return 'Planta baja';
  if (piso === 2) return '2º piso';
  if (piso === 3) return '3er piso';
  return `${piso}º piso`;
}

/** Busca un espacio por id ('A05') dentro de un edificio. */
export function buscarEspacio(numero, id) {
  if (!numero || !id) return null;
  return esquemaEdificio(numero).espacios.find((e) => e.id === String(id).toUpperCase()) ?? null;
}

/** Texto para mostrar: "Aula A05 (3er piso)". Si no existe, regresa el id tal cual. */
export function textoEspacio(numero, id) {
  if (!id) return '';
  const e = buscarEspacio(numero, id);
  return e ? `${e.nombre} (${nombrePiso(e.piso).toLowerCase()})` : String(id);
}

/** Opciones para el selector de Reportar, agrupadas por piso (sin escaleras). */
export function opcionesSalon(numero) {
  const esquema = esquemaEdificio(numero);
  const grupos = [];
  for (let p = esquema.pisos; p >= 1; p -= 1) {
    const opciones = esquema.plantas[p]
      .filter((e) => e.tipo !== 'escaleras')
      .map((e) => ({
        value: e.id,
        label: e.nombre, // "Aula E4-A05", igual que en el horario
        icon: TIPOS_ESPACIO[e.tipo].icono,
        tipo: e.tipo,
        description: describirEspacio(e),
      }));
    if (opciones.length) grupos.push({ piso: p, label: nombrePiso(p), opciones });
  }
  return grupos;
}

/** "Lo usan 3 grupos: 1AM TIN, 3BV TIN…" para que el alumno reconozca su salón. */
function describirEspacio(e) {
  if (e.tipo === 'banos') return 'Baños del edificio';
  if (!e.grupos?.length) return TIPOS_ESPACIO[e.tipo].nombre === 'Espacio' ? 'Espacio del edificio' : TIPOS_ESPACIO[e.tipo].nombre;
  const n = e.grupos.length;
  const ejemplo = e.grupos.slice(0, 3).join(', ') + (n > 3 ? '…' : '');
  return `${n} ${n === 1 ? 'grupo' : 'grupos'} en el horario 2026B: ${ejemplo}`;
}

// "aula 5", "salón A-05", "lab 7", "E4-A05" → 'A05' / 'L07'. Para reportes viejos
// que no traen el campo `aula` pero lo escribieron en la descripción.
const PATRON_PALABRA = /\b(?:E\s?(\d{1,2})\s?-\s?)?(aula|sal[oó]n|lab(?:oratorio)?\.?|taller)\s?-?\s?(\d{1,2})\b/i;
// Clave escrita tal cual: "A05", "A-05", "E4-A05" (mayúscula y 2 dígitos, para no confundir "a 5 minutos").
const PATRON_CLAVE = /\b(?:E\s?(\d{1,2})\s?-\s?)?([ALT])-?(\d{2})\b/;

/**
 * ¿En qué espacio del edificio va este reporte?
 *   1. El campo `aula` que eligió el alumno.
 *   2. Si no, lo que escribió en la descripción ("aula 5", "E4-A05").
 *   3. Si es de baños, los baños de la planta baja.
 * Regresa el id del espacio o null (se dibuja en la explanada, frente al edificio).
 */
export function espacioDeReporte(reporte) {
  const numero = reporte.edificioNumber;
  if (!numero) return null;
  if (reporte.aula && buscarEspacio(numero, reporte.aula)) return String(reporte.aula).toUpperCase();

  const texto = reporte.descripcion ?? '';
  const m = PATRON_PALABRA.exec(texto) ?? PATRON_CLAVE.exec(texto);
  if (m && (!m[1] || Number(m[1]) === numero)) {
    const palabra = m[2].toLowerCase();
    const letra = palabra.startsWith('l') ? 'L' : palabra.startsWith('t') ? 'T' : 'A';
    const id = `${letra}${m[3].padStart(2, '0')}`;
    if (buscarEspacio(numero, id)) return id;
  }
  if (reporte.categoria === 'banos' && buscarEspacio(numero, 'BAN')) return 'BAN';
  return null;
}

/**
 * Dónde queda un espacio dentro del edificio, para ponerlo en el mapa:
 *   fx    → 0 = extremo izquierdo, 1 = extremo derecho (centro del salón)
 *   piso / pisos
 * Si no existe, regresa null.
 */
export function posicionEspacio(numero, id) {
  const esquema = esquemaEdificio(numero);
  const e = buscarEspacio(numero, id);
  if (!e) return null;
  const pos = fraccionesPiso(esquema.plantas[e.piso]).find((x) => x.id === e.id);
  return { fx: (pos.fx0 + pos.fx1) / 2, piso: e.piso, pisos: esquema.pisos };
}
