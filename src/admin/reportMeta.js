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

// ---------------------------------------------------------------------------
// Panel v2: prioridad, tiempos, filtros y exportar
// ---------------------------------------------------------------------------

/** Prioridades. Fuga y riesgo entran solas en "alta" (lo decide la API). */
export const PRIORITIES = [
  { key: 'alta', label: 'Urgente', icon: 'priority_high', bg: colors.crimsonTint, fg: colors.crimsonDark },
  { key: 'media', label: 'Media', icon: 'drag_handle', bg: colors.goldTint, fg: colors.goldDark },
  { key: 'baja', label: 'Baja', icon: 'south', bg: colors.blueTint, fg: colors.textSecondary },
];

export function priorityInfo(key) {
  return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[1];
}

/** "hace 5 min", "hace 3 h", "hace 2 d" para las tarjetas. */
export function timeAgo(iso) {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/** Duración legible: 0.25 d → "6 h", 1.8 d → "1.8 d". */
export function formatDuration(days) {
  if (days == null || Number.isNaN(days)) return '—';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} h`;
  return `${days.toFixed(1)} d`;
}

/** Días entre creado y resuelto (null si no está resuelto). */
export function resolutionDays(report) {
  if (!report.resolvedAt) return null;
  return (new Date(report.resolvedAt) - new Date(report.createdAt)) / 86400000;
}

/** Filtros vacíos (el tablero, el mapa y las estadísticas usan los mismos). */
export const EMPTY_FILTERS = {
  search: '',
  categoria: null,
  edificio: null,
  prioridad: null,
  desde: '',
  hasta: '',
};

/** Aplica los filtros a la lista de reportes. */
export function applyFilters(reports, filters, buildingNames) {
  const text = filters.search.trim().toLowerCase();
  return reports.filter((r) => {
    if (filters.categoria && r.categoria !== filters.categoria) return false;
    if (filters.prioridad && r.prioridad !== filters.prioridad) return false;
    if (filters.edificio) {
      if (filters.edificio === 'zona' ? r.edificioNumber : String(r.edificioNumber) !== filters.edificio) return false;
    }
    const day = (r.createdAt || '').slice(0, 10);
    if (filters.desde && day < filters.desde) return false;
    if (filters.hasta && day > filters.hasta) return false;
    if (!text) return true;
    return [r.folio, r.descripcion, r.zona, r.comentarioAdmin, r.autor?.nombre, r.autor?.correo, locationText(r, buildingNames)]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(text));
  });
}

export function activeFilterCount(filters) {
  return Object.entries(filters).filter(([, v]) => v).length;
}

/**
 * Descarga los reportes como CSV (Excel lo abre directo).
 * Lleva BOM para que Excel respete los acentos.
 */
export function downloadCsv(reports, buildingNames) {
  const header = [
    'Folio', 'Fecha', 'Categoría', 'Ubicación', 'Descripción', 'Estado', 'Prioridad',
    'Comentario', 'Resuelto', 'Días para resolver', 'Enviado por', 'Latitud', 'Longitud',
  ];
  const rows = reports.map((r) => [
    r.folio,
    (r.createdAt || '').replace('T', ' '),
    categoryInfo(r.categoria).label,
    locationText(r, buildingNames),
    r.descripcion,
    stateInfo(r.estado).label,
    priorityInfo(r.prioridad).label,
    r.comentarioAdmin || '',
    (r.resolvedAt || '').replace('T', ' '),
    resolutionDays(r)?.toFixed(1) ?? '',
    r.autor ? `${r.autor.nombre} <${r.autor.correo}>` : 'Anónimo',
    r.lat ?? '',
    r.lng ?? '',
  ]);
  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `polimap-reportes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fecha local de hoy "AAAA-MM-DD" (no la de Londres, como toISOString). */
export function localDay(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}

/** Texto e ícono de una línea del historial: { accion, antes, despues }. */
export function historyInfo(h) {
  switch (h.accion) {
    case 'creado':
      return { icon: 'add_circle', text: 'Envió el reporte' };
    case 'estado':
      return { icon: 'swap_horiz', text: `Cambió el estado: ${stateInfo(h.antes).label} → ${stateInfo(h.despues).label}` };
    case 'prioridad':
      return { icon: 'flag', text: `Cambió la prioridad: ${priorityInfo(h.antes).label} → ${priorityInfo(h.despues).label}` };
    case 'comentario':
      return { icon: 'chat', text: h.despues ? `Comentó: “${h.despues}”` : 'Borró el comentario' };
    default:
      return { icon: 'history', text: h.accion };
  }
}
