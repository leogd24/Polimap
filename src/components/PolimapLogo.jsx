import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Equivalente de widgets/polimap_logo.dart
export default function PolimapLogo({ size = 48, dark = false }) {
  const foreground = dark ? colors.blue : colors.white;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        backgroundColor: dark ? colors.white : colors.blue,
        borderRadius: size * 0.28,
        boxShadow: `0 10px 24px ${alpha('#000000', 0.12)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="map" size={size * 0.58} color={foreground} />
      <div
        style={{
          position: 'absolute',
          right: size * 0.12,
          top: size * 0.08,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: '50%',
          backgroundColor: colors.gold,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="location_on" size={size * 0.18} color={colors.white} />
      </div>
    </div>
  );
}
