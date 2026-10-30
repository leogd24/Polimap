// src/lib/horario.js — Responsable: Alexis (pantalla de Horario de Leo)
// =====================================================================
// Toda la "inteligencia" de los horarios, sin nada de pantalla:
//   - qué clase hay AHORA y cuál sigue (con la hora de Zapopan);
//   - huecos libres entre clases;
//   - un color fijo por materia;
//   - salones libres a cierta hora;
//   - comparar dos grupos (horas libres en común);
//   - buscar maestros y saber dónde están a cierta hora (lo usa el asistente);
//   - el archivo de calendario (.ics) para el celular.
//
// Los datos vienen de src/data/schedules.js (PDF oficial 2026B, generados).
// =====================================================================
import { allSchedules, scheduleDays } from '../data/schedules.js';
import { leerSalon, textoEspacio } from '../data/buildingLayouts.js';
import { colors, alpha } from '../styles/theme.js';

export const ZONA = 'America/Mexico_City'; // Zapopan, Jalisco
export const DIAS = scheduleDays; // ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const DIAS_CORTOS = { Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb' };

// Ciclo escolar 2026B del bachillerato (SEMS). El inicio es oficial (10 de
// agosto de 2026); el fin es aproximado: ajústalo cuando salga el calendario.
export const CICLO = {
  nombre: '2026B',
  inicio: '2026-08-10',
  fin: '2026-12-11',
  // Días sin clases que se quitan del calendario del celular.
  sinClases: ['2026-09-16', '2026-11-16'],
};

// Un hueco cuenta como "libre" si dura al menos esto (minutos).
const HUECO_MINIMO = 30;

// ---------------------------------------------------------------------
// Horas y días
// ---------------------------------------------------------------------

/** "08:30" → 510 (minutos desde la medianoche) */
export function aMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 510 → "08:30" */
export function aHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "45 min", "1 h", "1 h 30 min" */
export function duracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Día y minuto en Zapopan (aunque el celular tenga otra zona horaria).
 * → { dia: 'Lunes'…'Domingo', indice: 0 (lunes)…6 (domingo), minuto, fecha: 'AAAA-MM-DD' }
 */
export function momento(fecha = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value])
  );
  const indice = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(partes.weekday);
  return {
    dia: [...DIAS, 'Domingo'][indice],
    indice,
    minuto: Number(partes.hour) * 60 + Number(partes.minute),
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
  };
}

// ---------------------------------------------------------------------
// Grupos y clases
// ---------------------------------------------------------------------

export function grupoPorCodigo(codigo) {
  return allSchedules.find((g) => g.code === codigo) ?? null;
}

/** Clases de un día, de la más temprana a la más tarde. */
export function clasesDelDia(grupo, dia) {
  return (grupo?.sessions ?? []).filter((s) => s.day === dia).sort((a, b) => aMinutos(a.start) - aMinutos(b.start));
}

/** Días que sí tienen clases (Sábado solo si hay). */
export function diasConClases(grupo) {
  return DIAS.filter((d) => d !== 'Sábado' || clasesDelDia(grupo, d).length);
}

/** Primera y última hora del grupo en toda la semana → [7, 14] (horas enteras). */
export function rangoHoras(grupo) {
  const s = grupo?.sessions ?? [];
  if (!s.length) return [7, 14];
  const ini = Math.min(...s.map((x) => aMinutos(x.start)));
  const fin = Math.max(...s.map((x) => aMinutos(x.end)));
  return [Math.floor(ini / 60), Math.ceil(fin / 60)];
}

/** Horas libres entre la primera y la última clase de un día. */
export function huecos(clases) {
  const lista = [];
  for (let i = 1; i < clases.length; i += 1) {
    const desde = aMinutos(clases[i - 1].end);
    const hasta = aMinutos(clases[i].start);
    if (hasta - desde >= HUECO_MINIMO) lista.push({ desde, hasta, minutos: hasta - desde });
  }
  return lista;
}

/** Llave única de una clase (para el modo consejal y React). */
export function llaveClase(s) {
  return `${s.day}|${s.start}|${s.subject}`;
}

/**
 * ¿Qué pasa AHORA con este grupo?
 * → { dia, minuto,
 *     actual:    { clase, progreso (0–1), faltan (min) } | null,
 *     siguiente: { clase, dia, hoy (bool), en (min, solo si es hoy) } | null,
 *     estado:    'clase' | 'hueco' | 'antes' | 'termino' | 'descanso' }
 */
export function estadoAhora(grupo, fecha = new Date()) {
  const ahora = momento(fecha);
  const hoy = ahora.dia === 'Domingo' ? [] : clasesDelDia(grupo, ahora.dia);
  const enCurso = hoy.find((c) => aMinutos(c.start) <= ahora.minuto && ahora.minuto < aMinutos(c.end));
  const proximaHoy = hoy.find((c) => aMinutos(c.start) > ahora.minuto);

  let actual = null;
  if (enCurso) {
    const ini = aMinutos(enCurso.start);
    const fin = aMinutos(enCurso.end);
    actual = { clase: enCurso, progreso: (ahora.minuto - ini) / (fin - ini), faltan: fin - ahora.minuto };
  }

  let siguiente = null;
  if (proximaHoy) {
    siguiente = { clase: proximaHoy, dia: ahora.dia, hoy: true, en: aMinutos(proximaHoy.start) - ahora.minuto };
  } else {
    // Buscar en los días que siguen (dando la vuelta a la semana).
    for (let paso = 1; paso <= 7 && !siguiente; paso += 1) {
      const dia = [...DIAS, 'Domingo'][(ahora.indice + paso) % 7];
      const primera = dia === 'Domingo' ? null : clasesDelDia(grupo, dia)[0];
      if (primera) siguiente = { clase: primera, dia, hoy: false, manana: paso === 1 };
    }
  }

  let estado = 'descanso'; // fin de semana o día sin clases
  if (actual) estado = 'clase';
  else if (hoy.length && proximaHoy && proximaHoy === hoy[0]) estado = 'antes';
  else if (hoy.length && proximaHoy) estado = 'hueco';
  else if (hoy.length) estado = 'termino';

  return { dia: ahora.dia, minuto: ahora.minuto, fecha: ahora.fecha, actual, siguiente, estado };
}

// ---------------------------------------------------------------------
// Colores por materia: la misma materia siempre del mismo color
// (dentro del grupo, en orden de aparición en la semana).
// ---------------------------------------------------------------------
const TONOS = [
  { fondo: colors.blueTint, color: colors.ink, texto: colors.ink },
  { fondo: colors.cyanTint, color: colors.cyan, texto: colors.cyanDark },
  { fondo: colors.crimsonTint, color: colors.crimson, texto: colors.crimsonDark },
  { fondo: colors.greenTint, color: colors.green, texto: colors.greenDark },
  { fondo: colors.goldTint, color: colors.gold, texto: colors.goldDark },
  { fondo: colors.magentaTint, color: colors.magenta, texto: colors.magentaDark },
  { fondo: alpha(colors.cyan, 0.3), color: colors.cyanDark, texto: colors.ink },
  { fondo: alpha(colors.gold, 0.32), color: colors.goldDeep, texto: colors.ink },
  { fondo: alpha(colors.green, 0.3), color: colors.greenDark, texto: colors.ink },
  { fondo: alpha(colors.magenta, 0.26), color: colors.magentaDark, texto: colors.ink },
  { fondo: alpha(colors.blueSteel, 0.24), color: colors.blueSteel, texto: colors.ink },
  { fondo: alpha(colors.crimson, 0.26), color: colors.crimsonDark, texto: colors.ink },
];
// Mismos tonos con nombre de variable (para dibujar la imagen y el Excel).
export const TONOS_VARS = [
  ['blue-tint', 'blue'],
  ['cyan-tint', 'cyan'],
  ['crimson-tint', 'crimson'],
  ['green-tint', 'green'],
  ['gold-tint', 'gold'],
  ['magenta-tint', 'magenta'],
  ['cyan', 'cyan-dark', 0.3],
  ['gold', 'gold-deep', 0.32],
  ['green', 'green-dark', 0.3],
  ['magenta', 'magenta-dark', 0.26],
  ['blue-steel', 'blue-steel', 0.24],
  ['crimson', 'crimson-dark', 0.26],
];

/** Map materia → índice de tono (0–11). */
export function indicesDeMaterias(grupo) {
  const mapa = new Map();
  for (const dia of DIAS) {
    for (const c of clasesDelDia(grupo, dia)) if (!mapa.has(c.subject)) mapa.set(c.subject, mapa.size % TONOS.length);
  }
  return mapa;
}

export function tonoDe(indice) {
  return TONOS[indice % TONOS.length];
}

// ---------------------------------------------------------------------
// Salones
// ---------------------------------------------------------------------

/** "Aula E4-A05" → { texto, edificio: 4, id: 'A05', tipo, ubicacion: 'Aula 5 (tercer piso)' } */
export function infoSalon(texto) {
  const s = leerSalon(texto);
  if (!s) return { texto, edificio: null, id: null, tipo: null, ubicacion: '' };
  return { texto, ...s, ubicacion: textoEspacio(s.edificio, s.id) };
}

/** Todos los salones de los horarios: ['Aula E2-A01', …] */
export const TODOS_LOS_SALONES = [...new Set(allSchedules.flatMap((g) => g.sessions.map((s) => s.room)))].sort();

/**
 * Salones libres un día a cierta hora, por edificio.
 * → [{ edificio, libres: [{ salon, hasta (min | null = ya no se usa hoy) }], ocupados: [{ salon, clase, grupo }] }]
 */
export function salonesLibres(dia, minuto) {
  const usos = new Map(); // salón → clases de ese día
  for (const g of allSchedules) {
    for (const s of g.sessions) {
      if (s.day !== dia) continue;
      if (!usos.has(s.room)) usos.set(s.room, []);
      usos.get(s.room).push({ ...s, grupo: g.code });
    }
  }
  const porEdificio = new Map();
  for (const salon of TODOS_LOS_SALONES) {
    const info = leerSalon(salon);
    const edificio = info?.edificio ?? 0;
    if (!porEdificio.has(edificio)) porEdificio.set(edificio, { edificio, libres: [], ocupados: [] });
    const lista = (usos.get(salon) ?? []).sort((a, b) => aMinutos(a.start) - aMinutos(b.start));
    const ocupado = lista.find((c) => aMinutos(c.start) <= minuto && minuto < aMinutos(c.end));
    if (ocupado) porEdificio.get(edificio).ocupados.push({ salon, clase: ocupado, grupo: ocupado.grupo });
    else {
      const proxima = lista.find((c) => aMinutos(c.start) > minuto);
      porEdificio.get(edificio).libres.push({ salon, hasta: proxima ? aMinutos(proxima.start) : null });
    }
  }
  return [...porEdificio.values()].sort((a, b) => a.edificio - b.edificio);
}

// ---------------------------------------------------------------------
// Comparar dos grupos
// ---------------------------------------------------------------------

/** Junta intervalos ocupados [{desde, hasta}] que se enciman. */
function unir(intervalos) {
  const orden = [...intervalos].sort((a, b) => a.desde - b.desde);
  const salida = [];
  for (const i of orden) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && i.desde <= ultimo.hasta) ultimo.hasta = Math.max(ultimo.hasta, i.hasta);
    else salida.push({ ...i });
  }
  return salida;
}

/**
 * Por día: horas libres de los DOS a la vez (mientras alguno está en la
 * escuela) y clases que tienen juntos (misma materia, hora y salón).
 * → [{ dia, libres: [{desde, hasta}], juntos: [clase] }]
 */
export function compararGrupos(a, b) {
  return DIAS.map((dia) => {
    const ca = clasesDelDia(a, dia);
    const cb = clasesDelDia(b, dia);
    if (!ca.length || !cb.length) return { dia, libres: [], juntos: [], soloUno: ca.length || cb.length ? (ca.length ? 'a' : 'b') : null };
    const todas = [...ca, ...cb].map((c) => ({ desde: aMinutos(c.start), hasta: aMinutos(c.end) }));
    const inicio = Math.min(...todas.map((t) => t.desde));
    const fin = Math.max(...todas.map((t) => t.hasta));
    const ocupado = unir(todas);
    const libres = [];
    let cursor = inicio;
    for (const o of ocupado) {
      if (o.desde - cursor >= HUECO_MINIMO) libres.push({ desde: cursor, hasta: o.desde });
      cursor = Math.max(cursor, o.hasta);
    }
    if (fin - cursor >= HUECO_MINIMO) libres.push({ desde: cursor, hasta: fin });
    const juntos = ca.filter((x) => cb.some((y) => y.start === x.start && y.room === x.room && y.subject === x.subject));
    return { dia, libres, juntos, soloUno: null };
  }).filter((d) => d.dia !== 'Sábado' || d.libres.length || d.juntos.length);
}

// ---------------------------------------------------------------------
// Maestros (para el asistente)
// ---------------------------------------------------------------------

/** "García de la Cadena" → "garcia de la cadena" */
export function sinAcentos(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// En el PDF, cuando una clase tiene 2 o más maestros (inglés, tutoría…), los
// nombres vienen pegados: "LEPE VALLARTA BRENDA GABRIELA FLORES MANRIQUEZ MARIA
// DEL REFUGIO". Se separan buscando nombres que también aparecen solos.
const NOMBRES_SOLOS = new Set(allSchedules.flatMap((g) => g.sessions.map((s) => s.teacher.trim())));

function partirNombres(nombre) {
  const w = nombre.split(' ');
  for (let i = 2; i <= w.length - 2; i += 1) {
    const a = w.slice(0, i).join(' ');
    const b = w.slice(i).join(' ');
    if (!NOMBRES_SOLOS.has(a)) continue;
    if (NOMBRES_SOLOS.has(b)) return [a, b];
    const resto = partirNombres(b);
    if (resto.length > 1) return [a, ...resto];
  }
  return [nombre];
}

/** Maestros de una clase: ['LEPE VALLARTA BRENDA GABRIELA', 'FLORES MANRIQUEZ …'] */
export function maestrosDeClase(sesion) {
  const nombre = String(sesion?.teacher ?? '').trim();
  return nombre ? [...new Set(partirNombres(nombre))] : [];
}

/** Lista de maestros con sus clases: [{ nombre, palabras, clases: [{...sesion, grupo}] }] */
export const MAESTROS = (() => {
  const mapa = new Map();
  for (const g of allSchedules) {
    for (const s of g.sessions) {
      for (const nombre of maestrosDeClase(s)) {
        if (!mapa.has(nombre)) mapa.set(nombre, { nombre, palabras: sinAcentos(nombre).split(' '), clases: [] });
        mapa.get(nombre).clases.push({ ...s, grupo: g.code, carrera: g.career });
      }
    }
  }
  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
})();

// Palabras que no son parte de un nombre.
const NO_NOMBRE = new Set(
  (
    'a al ahora ahorita busco buscar busca clase clases con cual de del donde da dando el en esta este estara ' +
    'hoy la las lo los manana maestro maestra maestros miss mi momento para por prof profe profesor profesora ' +
    'que salon se teacher tiene toca un una y ya lunes martes miercoles jueves viernes sabado tarde noche ' +
    'am pm hrs hr horas hora sus su ver encuentro encontrar quiero saber dime oye esa ese ' +
    'doctor doctora dr dra ing ingeniero ingeniera lic licenciado licenciada mtro mtra'
  ).split(' ')
);

function parecida(a, b) {
  if (a === b) return 1;
  if (a.length >= 4 && b.startsWith(a)) return 0.9; // "cisner" → "cisneros"
  if (a.length >= 5 && b.length >= 5) {
    // una letra de diferencia ("gonzales" / "gonzalez")
    let dif = Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length) && dif <= 1; i += 1) if (a[i] !== b[i]) dif += 1;
    if (dif <= 1) return 0.8;
  }
  return 0;
}

/**
 * Busca maestros por nombre (sin acentos, con errores pequeños).
 * → [{ maestro, puntos, coinciden }] ordenados (el mejor primero).
 */
export function buscarMaestros(texto) {
  const palabras = sinAcentos(texto)
    .split(' ')
    .filter((p) => p.length >= 3 && !NO_NOMBRE.has(p) && !/^\d/.test(p));
  if (!palabras.length) return [];
  const resultados = [];
  for (const m of MAESTROS) {
    let puntos = 0;
    let coinciden = 0;
    let exactas = 0; // palabras iguales o el inicio del apellido (no solo "parecidas")
    for (const p of palabras) {
      const mejor = Math.max(...m.palabras.map((w) => parecida(p, w)));
      if (mejor) {
        puntos += mejor;
        coinciden += 1;
        if (mejor >= 0.9) exactas += 1;
      }
    }
    if (coinciden) resultados.push({ maestro: m, puntos, coinciden, exactas, total: palabras.length });
  }
  return resultados.sort((a, b) => b.puntos - a.puntos || a.maestro.nombre.localeCompare(b.maestro.nombre));
}

/**
 * ¿Dónde está un maestro un día a cierto minuto?
 * → { actual: [clase] (puede dar clase a 2 grupos juntos), anterior, siguiente, delDia: [clase] }
 */
export function dondeEsta(maestro, dia, minuto) {
  const delDia = maestro.clases.filter((c) => c.day === dia).sort((a, b) => aMinutos(a.start) - aMinutos(b.start));
  const actual = delDia.filter((c) => aMinutos(c.start) <= minuto && minuto < aMinutos(c.end));
  const anterior = [...delDia].reverse().find((c) => aMinutos(c.end) <= minuto) ?? null;
  const siguiente = delDia.find((c) => aMinutos(c.start) > minuto) ?? null;
  return { actual, anterior, siguiente, delDia };
}

/** "GARCIA DE LA CADENA GONZALEZ MARTHA PATRICIA" → "Garcia de la Cadena Gonzalez Martha Patricia" */
export function nombreBonito(nombre) {
  return String(nombre)
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && ['de', 'del', 'la', 'las', 'los', 'y'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** "VIDA Y FUNCION CELULAR" → "Vida y funcion celular" */
export function materiaBonita(materia) {
  const t = String(materia).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------------------------------------------------------------
// Semana (para el modo consejal)
// ---------------------------------------------------------------------

/** Lunes de la semana de una fecha 'AAAA-MM-DD' (si es sábado o domingo, el lunes siguiente). */
export function lunesDe(fechaIso) {
  // Se trabaja en UTC a mediodía para que la zona del celular no mueva la fecha.
  const d = new Date(`${fechaIso}T12:00:00Z`);
  const dia = d.getUTCDay(); // 0 domingo
  const ajuste = dia === 0 ? 1 : dia === 6 ? 2 : 1 - dia;
  d.setUTCDate(d.getUTCDate() + ajuste);
  return d.toISOString().slice(0, 10);
}

/** Suma días a 'AAAA-MM-DD'. */
export function masDias(fechaIso, dias) {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-09-07' → 'Semana del 7 al 11 de septiembre' (o 'del 28 de septiembre al 2 de octubre') */
export function textoSemana(lunes, conSabado = false) {
  const fin = masDias(lunes, conSabado ? 5 : 4);
  const [, m1, d1] = lunes.split('-').map(Number);
  const [, m2, d2] = fin.split('-').map(Number);
  return m1 === m2
    ? `Semana del ${d1} al ${d2} de ${MESES[m1 - 1]}`
    : `Semana del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

// ---------------------------------------------------------------------
// Calendario del celular (.ics) con recordatorio antes de cada clase
// ---------------------------------------------------------------------

function escIcs(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Corta líneas a 75 caracteres (regla del formato iCalendar). */
function doblar(linea) {
  const partes = [];
  let resto = linea;
  while (resto.length > 74) {
    partes.push(resto.slice(0, 74));
    resto = ` ${resto.slice(74)}`;
  }
  partes.push(resto);
  return partes.join('\r\n');
}

/**
 * Archivo .ics con todas las clases del grupo, repetidas cada semana hasta
 * el fin del ciclo, con aviso `aviso` minutos antes (0 = sin aviso).
 */
export function generarIcs(grupo, { aviso = 10, hoy = momento().fecha } = {}) {
  // Desde el lunes de esta semana (o el inicio del ciclo si aún no empieza).
  const desde = hoy > CICLO.inicio ? lunesDe(hoy) : lunesDe(CICLO.inicio);
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  // UNTIL va en UTC: 23:59:59 de Zapopan (UTC−6) = 05:59:59 del día siguiente.
  const hasta = `${masDias(CICLO.fin, 1).replace(/-/g, '')}T055959Z`;
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//POLIMAP//Horario ${CICLO.nombre}//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Horario ${grupo.code} (POLIMAP)`,
    `X-WR-TIMEZONE:${ZONA}`,
    'BEGIN:VTIMEZONE',
    `TZID:${ZONA}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  grupo.sessions.forEach((s, i) => {
    // Primera fecha de ese día de la semana ("desde" siempre es lunes).
    const indiceDia = DIAS.indexOf(s.day); // 0 = lunes
    const f = masDias(desde, indiceDia).replace(/-/g, '');
    const salon = infoSalon(s.room);
    const excluir = CICLO.sinClases.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === (indiceDia + 1) % 7);
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${CICLO.nombre}-${sinAcentos(grupo.code).replace(/ /g, '')}-${i}@polimap`,
      `DTSTAMP:${sello}`,
      `DTSTART;TZID=${ZONA}:${f}T${s.start.replace(':', '')}00`,
      `DTEND;TZID=${ZONA}:${f}T${s.end.replace(':', '')}00`,
      `RRULE:FREQ=WEEKLY;UNTIL=${hasta}`,
      ...excluir.map((d) => `EXDATE;TZID=${ZONA}:${d.replace(/-/g, '')}T${s.start.replace(':', '')}00`),
      doblar(`SUMMARY:${escIcs(materiaBonita(s.subject))}`),
      doblar(`LOCATION:${escIcs(salon.edificio ? `${s.room} · Edificio ${salon.edificio}` : s.room)}`),
      doblar(`DESCRIPTION:${escIcs(`${nombreBonito(s.teacher)}\nGrupo ${grupo.code} · ${grupo.group}\nEscuela Politécnica (POLIMAP)`)}`)
    );
    if (aviso > 0) {
      lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', doblar(`DESCRIPTION:${escIcs(`${materiaBonita(s.subject)} en ${s.room}`)}`), `TRIGGER:-PT${aviso}M`, 'END:VALARM');
    }
    lineas.push('END:VEVENT');
  });
  lineas.push('END:VCALENDAR');
  return `${lineas.join('\r\n')}\r\n`;
}

/** Descarga un texto o Blob como archivo. */
export function descargarArchivo(contenido, nombre, tipo = 'application/octet-stream') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Imagen oficial (PDF de la UdeG convertido a PNG): '/horarios/2026B/1AM-TIN.png' */
export function urlOficial(grupo) {
  return `/horarios/${CICLO.nombre}/${grupo.code.replace(/\s+/g, '-')}.png`;
}
