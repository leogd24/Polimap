// src/components/AccesosFlotantes.jsx
// Columna pequeña de botones redondos (Horario, Reportar) que flota a la
// derecha. La usan Inicio y el Mapa para que se vean iguales.
//
// Props: accesos [{ icon, label, color, onTap }], className, style
import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

export default function AccesosFlotantes({ accesos, className = '', style }) {
  if (!accesos?.length) return null;
  return (
    <nav
      aria-label="Accesos"
      className={`flex flex-col overflow-hidden ${className}`}
      style={{
        borderRadius: 22,
        backgroundColor: colors.surface,
        boxShadow: '0 3px 10px rgb(0 0 0 / .22)',
        ...style,
      }}
    >
      {accesos.map((a, i) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onTap}
          aria-label={a.label}
          title={a.label}
          className="tappable flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0"
          style={{ borderTop: i ? `1px solid ${colors.border}` : 'none', WebkitTapHighlightColor: 'transparent' }}
        >
          <Icon name={a.icon} size={22} color={a.color} />
        </button>
      ))}
    </nav>
  );
}
