// src/admin/reportMeta.js — Responsable: Alexis
// Textos, íconos y colores de categorías y estados de los reportes.
// Las claves (banos, revision...) son las mismas de la base de datos y de
// docs/contrato-datos.md. Los colores salen SOLO de theme.js.
import { colors } from '../styles/theme.js';

/** Categorías: clave de la BD → nombre, ícono Material y colores (Paleta Oficial del Poli). */
export const CATEGORIES = {
  basura: { label: 'Basura', icon: 'delete', bg: colors.greenTint, fg: colors.greenDark },
  mobiliario: { label: 'Mobiliario dañado', icon: 'chair', bg: colors.goldTint, fg: colors.goldDark },
  banos: { label: 'Baños en mal estado', icon: 'wc', bg: colors.cyanTint, fg: colors.cyanDark },
  fuga: { label: 'Fuga de agua', icon: 'water_drop', bg: colors.cyanTint, fg: colors.cyanDark },
  iluminacion: { label: 'Iluminación', icon: 'lightbulb', bg: colors.goldTint, fg: colors.goldDeep },
  riesgo: { label: 'Riesgo o desperfecto', icon: 'warning', bg: colors.crimsonTint, fg: colors.crimsonDark },
  otro: { label: 'Otro', icon: 'more_horiz', bg: colors.magentaTint, fg: colors.magentaDark },
};

/**
 * Estados en el orden en que avanza un reporte, como un semáforo:
 * rojo = nuevo (falta atender), naranja = en revisión, ciano = en proceso,
 * verde = resuelto. Todos con la Paleta Oficial del Politécnico.
 */
export const STATES = [
  { key: 'recibido', label: 'Recibido', icon: 'mark_email_unread', bg: colors.crimsonTint, fg: colors.crimsonDark },
  { key: 'revision', label: 'En revisión', icon: 'manage_search', bg: colors.goldTint, fg: colors.goldDark },
  { key: 'proceso', label: 'En proceso', icon: 'construction', bg: colors.cyanTint, fg: colors.cyanDark },
  { key: 'resuelto', label: 'Resuelto', icon: 'task_alt', bg: colors.greenDark, fg: colors.white },
];

export function stateInfo(key) {
  return STATES.find((s) => s.key === key) ?? STATES[0];
}

export function categoryInfo(key) {
  return CATEGORIES[key] ?? { label: key, icon: 'report', bg: colors.blueTint, fg: colors.blue };
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
