import { alpha } from '../styles/theme.js';

/// Logo oficial de POLIMAP (la P con el ajolote).
///
/// Props (las mismas de antes, así ninguna pantalla cambia):
///   size: tamaño en px del cuadro (por defecto 48).
///   dark: se conserva por compatibilidad. El logo siempre va sobre un
///         cuadro blanco para que sus colores se vean bien sobre el azul
///         de la barra superior y sobre fondos claros.
///
/// La imagen está en public/img/logo-polimap.png (256 px). Si se cambia
/// el logo, basta con reemplazar ese archivo y los de public/icons/.
export default function PolimapLogo({ size = 48 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: '#ffffff',
        borderRadius: size * 0.28,
        boxShadow: `0 10px 24px ${alpha('#000000', 0.12)}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/img/logo-polimap.png"
        alt="POLIMAP"
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
}
