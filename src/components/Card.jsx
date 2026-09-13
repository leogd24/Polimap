import { colors } from '../styles/theme.js';

/// Equivalente del `cardTheme` de Flutter: superficie blanca, borde y radio 22.
export default function Card({ children, className = '', style }) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-card)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/// Equivalente del `dividerTheme`.
export function Divider({ indent = 0, endIndent = 0 }) {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginLeft: indent,
        marginRight: endIndent,
      }}
    />
  );
}
