// src/hooks/useReloj.js — Responsable: Alexis
// Regresa la hora actual y se actualiza sola cada `cadaMs` (por defecto 30 s),
// para que "Ahora" y "faltan 12 min" se muevan sin recargar.
// También se actualiza al volver a la app (cuando la pestaña se vuelve visible).
import { useEffect, useState } from 'react';

export default function useReloj(cadaMs = 30000) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const tic = () => setAhora(new Date());
    const id = setInterval(tic, cadaMs);
    const visible = () => document.visibilityState === 'visible' && tic();
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [cadaMs]);
  return ahora;
}
