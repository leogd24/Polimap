// src/lib/perdidos.js — Responsable: Alexis
// Datos compartidos de "Objetos perdidos" (app y panel).
// Los valores (`value`) son los mismos que acepta api/perdidos.php.
import { colors } from '../styles/theme.js';

export const CATEGORIAS_PERDIDO = [
  { value: 'electronica', label: 'Electrónicos', icon: 'devices', color: colors.cyan },
  { value: 'credencial', label: 'Credencial', icon: 'badge', color: colors.crimson },
  { value: 'llaves', label: 'Llaves', icon: 'key', color: colors.gold },
  { value: 'utiles', label: 'Útiles', icon: 'edit', color: colors.magenta },
  { value: 'ropa', label: 'Ropa', icon: 'checkroom', color: colors.green },
  { value: 'botella', label: 'Termo o botella', icon: 'water_bottle', color: colors.cyan },
  { value: 'dinero', label: 'Cartera o dinero', icon: 'account_balance_wallet', color: colors.gold },
  { value: 'otro', label: 'Otro', icon: 'category', color: colors.ink },
];

export const categoriaPerdido = (v) => CATEGORIAS_PERDIDO.find((c) => c.value === v) ?? CATEGORIAS_PERDIDO[CATEGORIAS_PERDIDO.length - 1];

export const MOTIVOS_PERDIDO = [
  { value: 'falso', label: 'No es real o es broma', icon: 'help' },
  { value: 'ofensivo', label: 'Ofensivo o inapropiado', icon: 'sentiment_very_dissatisfied' },
  { value: 'spam', label: 'Spam o venta', icon: 'block' },
  { value: 'datos', label: 'Expone datos personales', icon: 'privacy_tip' },
  { value: 'otro', label: 'Otra cosa', icon: 'flag' },
];

/** Estado de una publicación → etiqueta y colores (para "Míos" y el panel). */
export const ESTADOS_PERDIDO = {
  activo: { label: 'Publicado', fg: colors.greenDark, bg: colors.greenTint },
  resuelto: { label: 'Resuelto', fg: colors.cyanDark, bg: colors.cyanTint },
  oculto: { label: 'Oculto (en revisión)', fg: colors.crimsonDark, bg: colors.crimsonTint },
  vencido: { label: 'Venció', fg: colors.textSecondary, bg: colors.blueTint },
};

/** "Edificio 5 · Aula A05" */
export function lugarPerdido(item) {
  return [item.building ? `Edificio ${item.building}` : '', item.place].filter(Boolean).join(' · ');
}
