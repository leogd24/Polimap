// src/lib/calificaciones.js — Responsable: Alexis
// =====================================================================
// Calculadora de promedio y faltas (Horario → Notas). Todo se guarda SOLO
// en el celular del alumno (localStorage), nunca en el servidor.
//
// Por cada materia del grupo:
//   criterios     el ENCUADRE: [{ id, nombre, porcentaje, cal }]
//                 (cal = calificación 0–100 que sacaste, o null si aún no)
//   asistenciaMin % mínimo de asistencia para el ordinario (80 por reglamento;
//                 cámbialo si tu encuadre dice otra cosa)
//   faltas        cuántas veces has faltado
//   sesiones      clases del semestre (null = se calculan con el horario)
//   origen        'grupo' si vino del encuadre que subió el consejal
//
// Reglas que usa (Reglamento General de Evaluación y Promoción de la UdeG;
// verifícalas con tu encuadre):
//   - Mínimo aprobatorio: 60.
//   - Ordinario: 80 % de asistencia. Extraordinario: 65 %.
// =====================================================================
import { CICLO, masDias } from './horario.js';

export const CAL_MINIMA = 60;
export const ASISTENCIA_ORDINARIO = 80;
export const ASISTENCIA_EXTRA = 65;
const CLAVE = 'polimap.calificaciones';

const DIA_SEMANA = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };

// ---------------------------------------------------------------------
// Guardar y leer (por grupo y materia)
// ---------------------------------------------------------------------

function leerTodo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) ?? {};
  } catch {
    return {};
  }
}

function guardarTodo(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo privado): solo dura mientras la app esté abierta.
  }
}

/** Las materias guardadas de un grupo: { [materia]: datos }. */
export function leerGrupo(grupo) {
  return leerTodo()[grupo] ?? {};
}

/** Guarda una materia y avisa a las pantallas abiertas. */
export function guardarMateria(grupo, materia, datos) {
  const todo = leerTodo();
  todo[grupo] = { ...(todo[grupo] ?? {}), [materia]: datos };
  guardarTodo(todo);
  window.dispatchEvent(new Event('polimap:calificaciones'));
}

let siguienteId = 1;
export const nuevoId = () => `c${Date.now().toString(36)}${siguienteId++}`;

/** Una materia sin datos: encuadre típico para empezar (el alumno lo cambia). */
export function materiaVacia() {
  return {
    criterios: [
      { id: nuevoId(), nombre: 'Exámenes', porcentaje: 40, cal: null },
      { id: nuevoId(), nombre: 'Tareas y actividades', porcentaje: 30, cal: null },
      { id: nuevoId(), nombre: 'Proyecto', porcentaje: 30, cal: null },
    ],
    asistenciaMin: ASISTENCIA_ORDINARIO,
    faltas: 0,
    sesiones: null,
    origen: 'propio',
    nuevo: true, // aún no la toca el alumno (no cuenta en el promedio general)
  };
}

/** Convierte el encuadre del grupo (API) al formato de la calculadora, conservando calificaciones con el mismo nombre. */
export function desdeEncuadre(encuadre, actual = null) {
  const previas = new Map((actual?.criterios ?? []).map((c) => [c.nombre.trim().toLowerCase(), c.cal]));
  return {
    ...(actual ?? materiaVacia()),
    criterios: encuadre.criterios.map((c) => ({ id: nuevoId(), nombre: c.nombre, porcentaje: c.porcentaje, cal: previas.get(c.nombre.trim().toLowerCase()) ?? null })),
    asistenciaMin: encuadre.asistenciaMin ?? ASISTENCIA_ORDINARIO,
    origen: 'grupo',
    encuadreDel: encuadre.actualizadoEn ?? null,
    nuevo: false,
  };
}

/** Suma una falta (botón "Falté" de la hoja de la clase). Regresa las faltas nuevas. */
export function sumarFalta(grupo, materia, cuantas = 1) {
  const actual = leerGrupo(grupo)[materia] ?? materiaVacia();
  const faltas = Math.max(0, (actual.faltas ?? 0) + cuantas);
  guardarMateria(grupo, materia, { ...actual, faltas, nuevo: false });
  return faltas;
}

// ---------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------

/**
 * Clases de una materia en el semestre: cada sesión del horario por cada
 * semana del ciclo (CICLO.inicio a CICLO.fin), sin los días sin clases.
 */
export function sesionesDelSemestre(grupo, materia, ciclo = CICLO) {
  const dias = (grupo?.sessions ?? []).filter((s) => s.subject === materia).map((s) => DIA_SEMANA[s.day]);
  if (!dias.length) return 0;
  const sinClases = new Set(ciclo.sinClases ?? []);
  let total = 0;
  for (let f = ciclo.inicio; f <= ciclo.fin; f = masDias(f, 1)) {
    if (sinClases.has(f)) continue;
    const d = new Date(`${f}T12:00:00Z`).getUTCDay();
    total += dias.filter((x) => x === d).length;
  }
  return total;
}

/** Redondeo a 1 decimal (85.25 → 85.3). */
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Todo lo que muestra la calculadora para una materia.
 *   suma          suma de porcentajes del encuadre (debe ser 100)
 *   evaluado      % del curso que ya tiene calificación
 *   puntos        puntos ganados sobre 100 (ej. 38.5)
 *   promedio      promedio en lo evaluado (0–100) o null
 *   maximo        lo más que puedes sacar si sacas 100 en lo que falta
 *   necesitas     promedio que necesitas en lo que falta para llegar a 60
 *                 (null si ya está todo evaluado)
 *   nota          'aprobado' | 'en-camino' | 'dificil' | 'imposible' | 'reprobado' | 'sin-datos'
 *   asistencia    { sesiones, faltas, porcentaje, maxFaltas, quedan, maxFaltasExtra, estado }
 *                 estado: 'bien' | 'cuidado' | 'limite' | 'extraordinario' | 'sin-derecho'
 */
export function calcular(m, sesionesAuto = 0) {
  const criterios = m?.criterios ?? [];
  const suma = criterios.reduce((s, c) => s + (Number(c.porcentaje) || 0), 0);
  const conCal = criterios.filter((c) => c.cal !== null && c.cal !== '' && !Number.isNaN(Number(c.cal)));
  const evaluado = conCal.reduce((s, c) => s + (Number(c.porcentaje) || 0), 0);
  const puntos = conCal.reduce((s, c) => s + (Number(c.cal) * (Number(c.porcentaje) || 0)) / 100, 0);
  const promedio = evaluado ? (puntos / evaluado) * 100 : null;
  const falta = Math.max(0, suma - evaluado);
  const maximo = puntos + falta;
  const necesitas = falta > 0 ? ((CAL_MINIMA - puntos) / falta) * 100 : null;

  let nota = 'sin-datos';
  if (evaluado > 0 || falta === 0) {
    if (falta === 0) nota = puntos >= CAL_MINIMA ? 'aprobado' : 'reprobado';
    else if (necesitas <= 0) nota = 'aprobado';
    else if (necesitas > 100) nota = 'imposible';
    else if (necesitas > 85) nota = 'dificil';
    else nota = 'en-camino';
  }

  // Asistencia
  const sesiones = Number(m?.sesiones) > 0 ? Number(m.sesiones) : sesionesAuto;
  const faltas = Math.max(0, Number(m?.faltas) || 0);
  const minimo = Number(m?.asistenciaMin) || ASISTENCIA_ORDINARIO;
  const maxFaltas = Math.floor(sesiones * (1 - minimo / 100) + 1e-9);
  const maxFaltasExtra = Math.floor(sesiones * (1 - ASISTENCIA_EXTRA / 100) + 1e-9);
  const quedan = maxFaltas - faltas;
  let estado = 'bien';
  if (faltas > maxFaltasExtra) estado = 'sin-derecho';
  else if (faltas > maxFaltas) estado = 'extraordinario';
  else if (quedan === 0) estado = 'limite';
  else if (quedan <= 2) estado = 'cuidado';

  return {
    suma,
    evaluado,
    puntos: r1(puntos),
    promedio: promedio === null ? null : r1(promedio),
    maximo: r1(maximo),
    necesitas: necesitas === null ? null : r1(Math.max(0, necesitas)),
    nota,
    asistencia: {
      sesiones,
      faltas,
      minimo,
      porcentaje: sesiones ? r1(((sesiones - faltas) / sesiones) * 100) : null,
      maxFaltas,
      quedan,
      maxFaltasExtra,
      estado,
    },
  };
}

/** Promedio general: promedio (en lo evaluado) de las materias que tienen calificaciones. */
export function promedioGeneral(resultados) {
  const con = resultados.filter((r) => r.promedio !== null);
  if (!con.length) return null;
  return r1(con.reduce((s, r) => s + r.promedio, 0) / con.length);
}

/** "Puedes faltar 3 veces más" y compañía. */
export function textoFaltas(a) {
  if (!a.sesiones) return 'Escribe cuántas clases tiene el semestre.';
  switch (a.estado) {
    case 'sin-derecho':
      return `Con ${a.faltas} faltas ya no tienes derecho a extraordinario (mínimo ${ASISTENCIA_EXTRA} %).`;
    case 'extraordinario':
      return `Pasaste el límite del ordinario: te queda el extraordinario (hasta ${a.maxFaltasExtra} faltas).`;
    case 'limite':
      return 'Estás en el límite: una falta más y pierdes el ordinario.';
    default:
      return `Puedes faltar ${a.quedan} ${a.quedan === 1 ? 'vez' : 'veces'} más (máximo ${a.maxFaltas} de ${a.sesiones} clases).`;
  }
}
