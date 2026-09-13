import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Equivalente del `filledButtonTheme`: carmesí, texto blanco y radio 16.
export default function FilledButton({
  children,
  onClick,
  icon,
  background = colors.crimson,
  foreground = colors.white,
  className = '',
  style,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tappable flex items-center justify-center gap-2 px-5 py-[14px] text-[15px] font-extrabold ${className}`}
      style={{
        backgroundColor: background,
        color: foreground,
        borderRadius: 'var(--radius-button)',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={20} color={foreground} />}
      <span>{children}</span>
    </button>
  );
}
