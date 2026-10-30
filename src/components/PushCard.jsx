// src/components/PushCard.jsx — Responsable: Alexis (en la sección de Avisos de Leo)
// Franja "Avisos en tu celular": activa o desactiva las notificaciones push.
// Se muestra en Inicio, debajo de los avisos (compacta, diseño "Hoy primero"). Funciona igual para alumnos,
// invitados y familias (los avisos son públicos).
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { getPushState, enablePush, disablePush, syncPush } from '../lib/push.js';

// Texto e ícono de cada estado.
const ESTADOS = {
  off: {
    icon: 'notifications',
    title: 'Recibe los avisos en tu celular',
    body: 'Urgentes del Poli y exámenes de tu grupo.',
  },
  on: {
    icon: 'notifications_active',
    title: 'Avisos en tu celular activados',
    body: 'Urgentes del Poli y exámenes de tu grupo.',
  },
  denied: {
    icon: 'notifications_off',
    title: 'Notificaciones bloqueadas',
    body: 'Las bloqueaste en este navegador. Para activarlas: candado de la barra de direcciones → Notificaciones → Permitir.',
  },
  'ios-install': {
    icon: 'ios_share',
    title: 'Avisos en tu iPhone',
    body: 'Primero instala la app: en Safari toca Compartir → "Agregar a inicio" y abre POLIMAP desde ese ícono.',
  },
};

export default function PushCard() {
  const [state, setState] = useState(null); // null = revisando
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    getPushState().then((s) => {
      if (!vivo) return;
      setState(s);
      if (s === 'on') syncPush(); // por si inició sesión después de activarlas
    });
    // Si cambias de grupo en Horario, se vuelve a mandar la suscripción con el
    // grupo nuevo (para recibir las fechas de exámenes de ese grupo).
    const alCambiarGrupo = () => syncPush();
    window.addEventListener('polimap:horario', alCambiarGrupo);
    return () => {
      vivo = false;
      window.removeEventListener('polimap:horario', alCambiarGrupo);
    };
  }, []);

  // Navegador sin soporte (ej. alguno muy viejo): no se muestra nada.
  if (!state || state === 'unsupported') return null;

  const info = ESTADOS[state];
  const on = state === 'on';

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      setState(on ? await disablePush() : await enablePush());
    } catch (e) {
      setError(e.message || 'No se pudo activar. Intenta de nuevo.');
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  }

  const tinte = on ? colors.greenTint : state === 'off' ? colors.cyanTint : colors.goldTint;
  const tinta = on ? colors.greenDark : state === 'off' ? colors.cyanDark : colors.goldDark;
  return (
    <div className="flex items-center gap-3 px-3 py-[10px]" style={{ borderRadius: 16, backgroundColor: tinte }}>
      <Icon name={info.icon} size={22} color={tinta} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.8125rem] font-extrabold" style={{ color: tinta }}>
          {info.title}
        </div>
        <div className="text-xs" style={{ color: colors.textPrimary, lineHeight: 1.35 }}>
          {info.body}
        </div>
        {error && (
          <div className="mt-1 text-xs font-bold" style={{ color: colors.crimsonDark }} role="alert">
            {error}
          </div>
        )}
      </div>
      {(state === 'off' || on) && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="tappable h-9 shrink-0 px-3 text-[0.8125rem] font-extrabold"
          style={{
            borderRadius: 10,
            backgroundColor: on ? colors.surface : colors.cyanSolid,
            color: on ? colors.textSecondary : colors.white,
            border: on ? `1px solid ${colors.border}` : '0',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '…' : on ? 'Desactivar' : 'Activar'}
        </button>
      )}
    </div>
  );
}
