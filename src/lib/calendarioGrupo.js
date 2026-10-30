// src/lib/calendarioGrupo.js — Responsable: Alexis
// Ayudas para las fechas del grupo (exámenes y entregas): tipos con color,
// "en 3 días", agrupar por semana y el archivo .ics de UNA fecha.
// Lo usan CalendarioGrupo.jsx (Horario → Fechas) y SaludoInicio.jsx (Inicio).
import { colors } from '../styles/theme.js';
import { lunesDe, masDias, materiaBonita } from './horario.js';

export const TIPOS_FECHA = {
  examen: { label: 'Examen', icon: 'quiz', fg: colors.crimsonDark, bg: colors.crimsonTint, solid: colors.crimsonSolid },
  entrega: { label: 'Entrega', icon: 'assignment_turned_in', fg: colors.cyanDark, bg: colors.cyanTint, solid: colors.cyanSolid },
  exposicion: { label: 'Exposición', icon: 'co_present', fg: colors.magentaDark, bg: colors.magentaTint, solid: colors.magentaSolid },
  practica: { label: 'Práctica', icon: 'science', fg: colors.greenDark, bg: colors.greenTint, solid: colors.greenSolid },
  otro: { label: 'Otra fecha', icon: 'event', fg: colors.ink, bg: colors.blueTint, solid: colors.blue },
};
export const tipoFecha = (t) => TIPOS_FECHA[t] ?? TIPOS_FECHA.otro;

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-11-05' → Date al mediodía (sin brincos de zona horaria). */
const aFecha = (ymd) => new Date(`${ymd}T12:00:00`);

/** Días que faltan de hoy (AAAA-MM-DD) a la fecha: 0 = hoy, -1 = ayer. */
export function diasHasta(ymd, hoy) {
  return Math.round((aFecha(ymd) - aFecha(hoy)) / 86400000);
}

/** "hoy", "mañana", "en 3 días", "pasado mañana", "hace 2 días" */
export function textoFaltan(ymd, hoy) {
  const d = diasHasta(ymd, hoy);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === 2) return 'pasado mañana';
  if (d > 0) return `en ${d} días`;
  if (d === -1) return 'ayer';
  return `hace ${-d} días`;
}

/** { dia: '5', mes: 'nov', semana: 'jue' } para el bloque de fecha. */
export function partesFecha(ymd) {
  const f = aFecha(ymd);
  return { dia: String(f.getDate()), mes: MESES_CORTOS[f.getMonth()], semana: DIAS_CORTOS[f.getDay()] };
}

/** "jueves 5 de noviembre" */
export function fechaLarga(ymd) {
  const f = aFecha(ymd);
  return `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

/**
 * Agrupa las fechas (ya ordenadas) para la lista:
 *   [{ titulo: 'Esta semana', items }, { titulo: 'La próxima semana', … }, { titulo: 'Diciembre', … }]
 * Las que ya pasaron van aparte en `pasadas`.
 */
export function agruparFechas(fechas, hoy) {
  const lunes = lunesDe(hoy);
  const lunesSig = masDias(lunes, 7);
  const lunesDesp = masDias(lunes, 14);
  const pasadas = [];
  const grupos = [];
  for (const f of fechas) {
    if (f.fecha < hoy) {
      pasadas.push(f);
      continue;
    }
    let titulo;
    if (f.fecha < lunesSig) titulo = 'Esta semana';
    else if (f.fecha < lunesDesp) titulo = 'La próxima semana';
    else {
      const m = aFecha(f.fecha).getMonth();
      titulo = MESES[m].charAt(0).toUpperCase() + MESES[m].slice(1);
    }
    let g = grupos[grupos.length - 1];
    if (!g || g.titulo !== titulo) {
      g = { titulo, items: [] };
      grupos.push(g);
    }
    g.items.push(f);
  }
  return { grupos, pasadas: pasadas.reverse() };
}

/** Lo próximo que importa (de hoy a `dias` días): para Inicio. */
export function proximasImportantes(fechas, hoy, dias = 3) {
  return fechas.filter((f) => {
    const d = diasHasta(f.fecha, hoy);
    return d >= 0 && d <= dias;
  });
}

/** Para Inicio: "Examen de Física y sus aplicaciones" o, sin materia, "Entrega · Reporte de práctica 2". */
export function nombreFecha(f) {
  const t = tipoFecha(f.tipo).label;
  return f.materia ? `${t} de ${materiaBonita(f.materia)}` : `${t} · ${f.titulo}`;
}

// ---------------------------------------------------------------------
// .ics de una sola fecha (para "Agregar a mi calendario")
// ---------------------------------------------------------------------
const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * Evento del calendario del celular. Con hora: dura 1 h y avisa 1 día antes
 * y 1 h antes. Sin hora: todo el día y avisa un día antes a las 18:00.
 */
export function icsDeFecha(f, grupo) {
  const ymd = f.fecha.replace(/-/g, '');
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//POLIMAP//Fechas del grupo//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:polimap-fecha-${f.id}@polimap`,
    `DTSTAMP:${ahora}`,
  ];
  if (f.hora) {
    const [h, m] = f.hora.split(':').map(Number);
    const fin = `${String(Math.min(h + 1, 23)).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    lineas.push(`DTSTART;TZID=America/Mexico_City:${ymd}T${f.hora.replace(':', '')}00`, `DTEND;TZID=America/Mexico_City:${ymd}T${fin}`);
  } else {
    const sig = masDias(f.fecha, 1).replace(/-/g, '');
    lineas.push(`DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${sig}`);
  }
  lineas.push(
    `SUMMARY:${esc(`${tipoFecha(f.tipo).label}: ${f.titulo}`)}`,
    `DESCRIPTION:${esc([f.materia ? materiaBonita(f.materia) : '', f.detalle, `Grupo ${grupo} · POLIMAP`].filter(Boolean).join('\n'))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(f.titulo)}`,
    f.hora ? 'TRIGGER:-P1D' : 'TRIGGER:-PT6H',
    'END:VALARM'
  );
  if (f.hora) lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(f.titulo)}`, 'TRIGGER:-PT1H', 'END:VALARM');
  lineas.push('END:VEVENT', 'END:VCALENDAR');
  return lineas.join('\r\n') + '\r\n';
}
