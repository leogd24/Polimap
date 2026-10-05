// Puente entre la paleta de theme.css (Paleta Oficial del Politécnico) y el código JS.
// blue = noche, crimson = Rojo Central, gold = Naranja (ver theme.css).
// No repite valores: cada token apunta a la variable CSS, de modo que
// theme.css sigue siendo el único lugar donde vive un color.
export const colors = {
  blue: 'var(--color-blue)',
  crimson: 'var(--color-crimson)',
  gold: 'var(--color-gold)',
  blueDeep: 'var(--color-blue-deep)',
  blueSteel: 'var(--color-blue-steel)',
  blueLight: 'var(--color-blue-light)',
  blueTint: 'var(--color-blue-tint)',
  crimsonDark: 'var(--color-crimson-dark)',
  crimsonTint: 'var(--color-crimson-tint)',
  goldDeep: 'var(--color-gold-deep)',
  goldDark: 'var(--color-gold-dark)',
  goldTint: 'var(--color-gold-tint)',
  crimsonLight: 'var(--color-crimson-light)',
  // Paleta Oficial del Politécnico (nuevos)
  cyan: 'var(--color-cyan)',
  cyanDark: 'var(--color-cyan-dark)',
  cyanTint: 'var(--color-cyan-tint)',
  green: 'var(--color-green)',
  greenDark: 'var(--color-green-dark)',
  greenTint: 'var(--color-green-tint)',
  magenta: 'var(--color-magenta)',
  magentaDark: 'var(--color-magenta-dark)',
  magentaLight: 'var(--color-magenta-light)',
  magentaTint: 'var(--color-magenta-tint)',
  background: 'var(--color-background)',
  surface: 'var(--color-surface)',
  border: 'var(--color-border)',
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  white: '#ffffff',
};

/// Equivalente de `color.withValues(alpha: x)` de Flutter.
export function alpha(color, value) {
  return `color-mix(in srgb, ${color} ${value * 100}%, transparent)`;
}
