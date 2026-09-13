import { useEffect } from 'react';
import { colors } from '../styles/theme.js';

/// Equivalente del `snackBarTheme`: fondo azul profundo y texto blanco.
export default function Snackbar({ message, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div
        className="w-full max-w-[420px] px-4 py-[14px]"
        style={{ backgroundColor: colors.blueDeep, color: colors.white, borderRadius: 6 }}
      >
        {message}
      </div>
    </div>
  );
}
