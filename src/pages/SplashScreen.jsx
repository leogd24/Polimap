import { useEffect, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import PolimapLogo from '../components/PolimapLogo.jsx';

/// Equivalente de screens/splash_screen.dart:
/// animación de 900 ms y salto al shell a los 1800 ms.
export default function SplashScreen({ onFinish }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(onFinish, 1800);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <div
      className="flex h-[100dvh] items-center justify-center"
      style={{ backgroundColor: colors.blueDeep }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          opacity: shown ? 1 : 0,
          transform: `scale(${shown ? 1 : 0.6})`,
          // easeOutBack: el logo rebasa un poco su tamaño y regresa, como en Flutter.
          transition:
            'opacity 900ms cubic-bezier(0, 0, 0.58, 1), transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <PolimapLogo size={104} dark />
        <h1
          className="mt-6 mb-0 text-4xl"
          style={{ color: colors.white, fontWeight: 900, letterSpacing: 3 }}
        >
          POLIMAP
        </h1>
        <p className="mt-2 mb-0 text-base" style={{ color: alpha(colors.white, 0.82) }}>
          Tu campus en la palma de tu mano
        </p>
      </div>
    </div>
  );
}
