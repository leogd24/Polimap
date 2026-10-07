// src/admin/StateChip.jsx — Responsable: Alexis
// Etiqueta de color con el estado de un reporte (Recibido, En revisión...).
import Icon from '../components/Icon.jsx';
import { stateInfo } from './reportMeta.js';

export default function StateChip({ estado }) {
  const s = stateInfo(estado);
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap px-3 py-1 text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.fg, borderRadius: 999 }}
    >
      <Icon name={s.icon} size={14} color={s.fg} />
      {s.label}
    </span>
  );
}
