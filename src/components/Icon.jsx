/// Ícono Material, la misma familia que usa Flutter.
/// `filled` reproduce los `Icons.*_rounded`; sin él, los `Icons.*_outlined`.
export default function Icon({ name, size = 24, filled = true, weight = 400, color, style, className = '' }) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        width: size,
        height: size,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
