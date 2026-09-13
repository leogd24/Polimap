import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Equivalente de widgets/building_card.dart
export default function BuildingCard({ building, onTap }) {
  const hasSummary = building.summary !== '';

  return (
    <button
      type="button"
      onClick={onTap}
      className="tappable flex h-full w-full flex-col p-[14px] text-left"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div className="flex w-full items-center justify-between">
        <div
          className="flex items-center justify-center"
          style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: alpha(building.color, 0.12) }}
        >
          <Icon name={building.icon} color={building.color} />
        </div>
        <div
          className="font-black"
          style={{
            padding: '5px 9px',
            borderRadius: 12,
            backgroundColor: colors.blueTint,
            color: colors.textPrimary,
          }}
        >
          {building.number}
        </div>
      </div>

      <div className="flex-1" />

      <div
        className="line-clamp-2 text-[17px] font-black"
        style={{ lineHeight: 1.12 }}
      >
        {building.name}
      </div>
      <div
        className="mt-[6px] line-clamp-2 text-xs"
        style={{
          lineHeight: 1.25,
          color: hasSummary ? colors.textSecondary : colors.textMuted,
          fontStyle: hasSummary ? 'normal' : 'italic',
        }}
      >
        {hasSummary ? building.summary : 'Sin información'}
      </div>

      <div className="mt-3 flex w-full items-center">
        <span className="text-xs font-extrabold" style={{ color: building.color }}>
          Ver detalles
        </span>
        <div className="flex-1" />
        <Icon name="arrow_forward" size={18} color={building.color} />
      </div>
    </button>
  );
}
