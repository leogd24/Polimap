import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Marca un dato que todavía no ha sido confirmado por el plantel.
/// Equivalente de widgets/missing_info.dart
export default function MissingInfo() {
  return (
    <div className="flex items-center" style={{ color: colors.textMuted }}>
      <Icon name="info" size={16} filled={false} />
      <span className="ml-[6px] italic">Sin información</span>
    </div>
  );
}
