// src/lib/archivos.js — Responsable: Alexis
// Datos de los archivos adjuntos de los avisos (PDF, Word, Excel, PowerPoint):
// ícono, color y nombre de cada tipo, y el peso en texto ("1.2 MB").
import { colors } from '../styles/theme.js';

export const MAX_ARCHIVOS = 5;
export const MAX_MB_ARCHIVO = 10; // igual que api/avisos.php
export const EXTENSIONES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
// Para el <input type="file" accept="…">
export const ACEPTA = EXTENSIONES.map((e) => `.${e}`).join(',');

const TIPOS = {
  pdf: { label: 'PDF', icon: 'picture_as_pdf', color: colors.crimson, dark: colors.crimsonDark, tint: colors.crimsonTint, solido: colors.crimsonSolid },
  word: { label: 'Word', icon: 'description', color: colors.ink, dark: colors.ink, tint: colors.blueTint, solido: colors.blue },
  excel: { label: 'Excel', icon: 'table_chart', color: colors.green, dark: colors.greenDark, tint: colors.greenTint, solido: colors.greenSolid },
  ppt: { label: 'PowerPoint', icon: 'slideshow', color: colors.gold, dark: colors.goldDark, tint: colors.goldTint, solido: colors.goldSolid },
  otro: { label: 'Archivo', icon: 'draft', color: colors.textSecondary, dark: colors.textSecondary, tint: colors.background, solido: colors.blueSteel },
};
const POR_EXTENSION = { pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', ppt: 'ppt', pptx: 'ppt' };

/** "docx" → { label: 'Word', icon, color, dark, tint } */
export function tipoArchivo(ext = '') {
  return TIPOS[POR_EXTENSION[String(ext).toLowerCase()] ?? 'otro'];
}

/** Extensión a partir del nombre: "Convocatoria.PDF" → "pdf" */
export function extension(nombre = '') {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(nombre);
  return m ? m[1].toLowerCase() : '';
}

/** 3690 → "3.6 KB", 1234567 → "1.2 MB" */
export function pesoBonito(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * URL para DESCARGAR una foto de aviso con nombre entendible.
 * "/api/uploads/avisos/ab12….jpg" → "/api/avisos.php?descargar=ab12….jpg"
 */
export function urlDescargaFoto(url = '') {
  return `/api/avisos.php?descargar=${encodeURIComponent(url.split('/').pop())}`;
}
