import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Equivalente de widgets/quick_action_card.dart
export default function QuickActionCard({ icon, title, color, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="tappable flex w-full items-center p-[14px] text-left"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-tile)',
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: alpha(color, 0.12) }}
      >
        <Icon name={icon} color={color} />
      </div>
      <span className="ml-[11px] font-extrabold" style={{ lineHeight: 1.15 }}>
        {title}
      </span>
    </button>
  );
}
