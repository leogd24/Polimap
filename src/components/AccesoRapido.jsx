// src/components/AccesoRapido.jsx — Responsable: Alexis (Inicio, diseño "Hoy primero")
// Botón redondo con ícono y texto abajo, para la cuadrícula de 4 columnas de
// Inicio (caben 8 accesos en dos renglones).
//
// Props: icon, label, fg (color del ícono, versión -Dark para que se lea),
//        bg (tinte de fondo), onTap
import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

export default function AccesoRapido({ icon, label, fg = colors.ink, bg = colors.blueTint, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="tappable flex min-w-0 flex-col items-center gap-[6px] border-0 bg-transparent p-0 text-center"
    >
      <span className="flex h-[54px] w-[54px] items-center justify-center" style={{ borderRadius: 18, backgroundColor: bg }}>
        <Icon name={icon} size={26} color={fg} />
      </span>
      <span className="w-full text-[0.75rem] font-bold leading-tight" style={{ color: colors.textPrimary }}>
        {label}
      </span>
    </button>
  );
}
