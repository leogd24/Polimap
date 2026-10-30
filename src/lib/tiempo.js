// src/lib/tiempo.js — Responsable: Alexis
// Textos de tiempo para avisos y comentarios, como en Instagram.

/** "ahora", "5 min", "3 h", "2 d", "4 sem" o la fecha si es más viejo. */
export function haceCorto(iso) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return '';
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d`;
  if (d < 35) return `${Math.round(d / 7)} sem`;
  return fechaLarga(iso);
}

/** "26 de octubre" (y el año si no es el actual). */
export function fechaLarga(iso) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  const opciones = { day: 'numeric', month: 'long' };
  if (f.getFullYear() !== new Date().getFullYear()) opciones.year = 'numeric';
  return f.toLocaleDateString('es-MX', opciones);
}
