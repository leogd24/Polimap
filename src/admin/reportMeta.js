// src/admin/reportMeta.js — Responsable: Alexis
// Textos, íconos y colores de categorías y estados de los reportes.
// Las claves (banos, revision...) son las mismas de la base de datos y de
// docs/contrato-datos.md. Los colores salen SOLO de theme.js.
import { colors } from '../styles/theme.js';

/** Categorías: clave de la BD → nombre que ve el usuario + ícono Material. */
export const CATEGORIES = {
  basura: { label: 'Basura', icon: 'delete' },
  mobiliario: { label: 'Mobiliario dañado', icon: 'chair' },
  banos: { label: 'Baños en mal estado', icon: 'wc' },
  fuga: { label: 'Fuga de agua', icon: 'water_drop' },
  iluminacion: { label: 'Iluminación', icon: 'lightbulb' },
  riesgo: { label: 'Riesgo o desperfecto', icon: 'warning' },
  otro: { label: 'Otro', icon: 'more_horiz' },
};

/**
 * Estados en el orden en que avanza un reporte.
 * "Recibido" va en carmesí porque es lo que falta atender.
 */
export const STATES = [
  { key: 'recibido', label: 'Recibido', icon: 'mark_email_unread', bg: colors.crimsonTint, fg: colors.crimson },
  { key: 'revision', label: 'En revisión', icon: 'manage_search', bg: colors.goldTint, fg: colors.goldDark },
  { key: 'proceso', label: 'En proceso', icon: 'construction', bg: colors.blueTint, fg: colors.blueLight },
  { key: 'resuelto', label: 'Resuelto', icon: 'task_alt', bg: colors.blue, fg: colors.white },
];

export function stateInfo(key) {
  return STATES.find((s) => s.key === key) ?? STATES[0];
}

export function categoryInfo(key) {
  return CATEGORIES[key] ?? { label: key, icon: 'report' };
}

/** "2026-10-03T23:06:33" → "3 oct 2026, 23:06" */
export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Texto de ubicación: "Edificio 3 · Nombre" o la zona escrita. */
export function locationText(report, buildingNames) {
  if (report.edificioNumber) {
    const name = buildingNames[report.edificioNumber];
    const base = `Edificio ${report.edificioNumber}`;
    return name && name !== base ? `${base} · ${name}` : base;
  }
  return report.zona || 'Sin ubicación';
}
