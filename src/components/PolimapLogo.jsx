import { colors, alpha } from '../styles/theme.js';

/// Logo oficial de POLIMAP (la P con el ajolote) sobre fondo noche.
///
/// Props (las mismas de antes, así ninguna pantalla cambia):
///   size: tamaño en px del cuadro (por defecto 48).
///   dark: se conserva por compatibilidad; ya no cambia nada.
///
/// El cuadro usa el color noche de la paleta (colors.blue) y un borde blanco
/// muy suave, para que se distinga igual sobre la barra noche que sobre
/// fondos claros (asistente, panel admin).
///
/// La imagen está en public/img/logo-polimap.png (256 px, fondo noche).
/// Si se cambia el logo, basta con reemplazar ese archivo y los de public/icons/.
export default function PolimapLogo({ size = 48 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: colors.blue,
        border: `1px solid ${alpha(colors.white, 0.18)}`,
        borderRadius: size * 0.28,
        boxShadow: `0 10px 24px ${alpha('#000000', 0.18)}`,
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
