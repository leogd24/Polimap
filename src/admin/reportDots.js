// src/admin/reportDots.js — Responsable: Alexis
// Reglas de los PUNTOS de reporte (mapa de reportes y esquema del edificio):
//
//   Color  = la prioridad más alta de los reportes SIN resolver de ese lugar
//            (rojo urgente · naranja media · ciano baja). Si todos están
//            resueltos, verde.
//   Tamaño = crece con el número de reportes y de "A mí también me pasa".
//   Late   = si hay un urgente sin resolver o 3 o más reportes juntos.
import { colors } from '../styles/theme.js';

export const DOT_KEYS = [
  { key: 'alta', label: 'Urgente', color: colors.crimson },
  { key: 'media', label: 'Media', color: colors.gold },
  { key: 'baja', label: 'Baja', color: colors.cyan },
  { key: 'resuelto', label: 'Resuelto', color: colors.green },
];

const ORDEN = { alta: 3, media: 2, baja: 1 };

/** Resumen de un grupo de reportes (los de un salón o un edificio). */
export function summarize(reports) {
  const abiertos = reports.filter((r) => r.estado !== 'resuelto');
  let key = 'resuelto';
  for (const r of abiertos) {
    const p = ORDEN[r.prioridad] ? r.prioridad : 'media';
    if (key === 'resuelto' || ORDEN[p] > ORDEN[key]) key = p;
  }
  const apoyos = reports.reduce((suma, r) => suma + (r.apoyos || 0), 0);
  const urgentes = abiertos.filter((r) => r.prioridad === 'alta').length;
  return {
    count: reports.length,
    pending: abiertos.length,
    urgent: urgentes,
    apoyos,
    key,
    color: DOT_KEYS.find((d) => d.key === key).color,
    // Peso: cada reporte cuenta 1 y cada alumno que se sumó, medio.
    weight: reports.length + apoyos * 0.5,
    loud: urgentes > 0 || abiertos.length >= 3,
  };
}

/** Radio del punto: crece con el peso, con un tope para que no tape todo. */
export function dotRadius(weight, base, step, max) {
  return Math.min(max, base + Math.max(0, weight - 1) * step);
}

/** Ordena: primero sin resolver y urgentes, luego los más nuevos. */
export function sortReports(list) {
  return [...list].sort(
    (a, b) =>
      (a.estado === 'resuelto') - (b.estado === 'resuelto') ||
      (ORDEN[b.prioridad] || 0) - (ORDEN[a.prioridad] || 0) ||
      String(b.createdAt).localeCompare(String(a.createdAt))
  );
}
