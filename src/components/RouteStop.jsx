import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import MissingInfo from './MissingInfo.jsx';

/// Un edificio como parada dentro de la línea de recorrido del campus.
/// Equivalente de widgets/route_stop.dart
export default function RouteStop({ building, isFirst, isLast, onTap }) {
  return (
    <div className="flex items-stretch">
      <div className="flex w-[46px] shrink-0 flex-col items-center">
        <div
          style={{
            width: 3,
            height: 10,
            backgroundColor: isFirst ? 'transparent' : colors.border,
          }}
        />
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 46,
            height: 46,
            backgroundColor: building.color,
            boxShadow: `0 5px 12px ${alpha(building.color, 0.28)}`,
          }}
        >
          <span className="text-[17px] font-black" style={{ color: colors.white }}>
            {building.number}
          </span>
        </div>
        <div
          className="flex-1"
          style={{ width: 3, backgroundColor: isLast ? 'transparent' : colors.border }}
        />
      </div>

      <div className="min-w-0 flex-1 pb-4 pl-[14px]">
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
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold" style={{ color: building.color }}>
              Edificio {building.number}
            </div>
            <div className="mt-[2px] text-base font-black" style={{ lineHeight: 1.15 }}>
              {building.name}
            </div>
            <div className="mt-[5px]">
              {building.summary === '' ? (
                <MissingInfo />
              ) : (
                <div className="text-xs" style={{ color: colors.textSecondary, lineHeight: 1.3 }}>
                  {building.summary}
                </div>
              )}
            </div>
          </div>
          <Icon name="chevron_right" color={building.color} />
        </button>
      </div>
    </div>
  );
}
