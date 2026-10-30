// src/hooks/useCalendarioGrupo.js — Responsable: Alexis
// Fechas, encuadres y consejales de un grupo (api/calendario.php).
//   const { datos, estado, recargar, cambiar } = useCalendarioGrupo('1AM TIN', user);
//   datos  = { fechas, encuadres, consejales, puedoPublicar, miRol, offline? } | null
//   estado = 'cargando' | 'listo' | 'error'
//   cambiar(fn) → actualiza los datos al instante (después de publicar o borrar)
// Se vuelve a pedir si cambia el grupo o la sesión (para saber si puedes publicar).
import { useCallback, useEffect, useState } from 'react';
import { getGroupCalendar } from '../lib/api.js';

export default function useCalendarioGrupo(codigo, user) {
  const [datos, setDatos] = useState(null);
  const [estado, setEstado] = useState('cargando');

  const recargar = useCallback(async () => {
    if (!codigo) return;
    setEstado((e) => (e === 'listo' ? 'listo' : 'cargando'));
    try {
      setDatos(await getGroupCalendar(codigo));
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [codigo]);

  useEffect(() => {
    setDatos(null);
    setEstado('cargando');
    recargar();
  }, [recargar, user?.id]);

  const cambiar = useCallback((fn) => setDatos((d) => (d ? fn(d) : d)), []);

  return { datos, estado, recargar, cambiar };
}
