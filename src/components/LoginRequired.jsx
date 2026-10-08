// src/components/LoginRequired.jsx — Responsable: Alexis
// Lo que ve un INVITADO en la pestaña Reportar: por qué se pide cuenta
// y el botón para iniciar sesión. Todo lo demás de la app sí lo puede usar.
//
// Props: onLogin (abre la pantalla de inicio de sesión)
import { colors } from '../styles/theme.js';
import Card from './Card.jsx';
import Icon from './Icon.jsx';
import FilledButton from './FilledButton.jsx';

const reasons = [
  { icon: 'verified_user', text: 'Solo quienes usan las instalaciones del Poli pueden reportar.' },
  { icon: 'track_changes', text: 'Ves el seguimiento de tus reportes en cualquier celular.' },
  { icon: 'visibility_off', text: 'Puedes enviarlos como anónimo: el equipo no verá tu nombre.' },
];

export default function LoginRequired({ onLogin }) {
  return (
    <div className="app-scroll flex-1 px-[18px] pt-6 pb-[30px]">
      <Card className="mx-auto max-w-[480px]">
        <div className="flex flex-col items-center p-6 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.crimsonTint }}
          >
            <Icon name="lock_person" size={34} color={colors.crimsonDark} />
          </span>
          <h2 className="m-0 mt-4 text-xl font-black">Inicia sesión para reportar</h2>
          <p className="m-0 mt-2" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
            Usa tu correo institucional <b>@alumnos.udg.mx</b>. Como invitado puedes seguir usando el mapa, los
            edificios, los horarios y el asistente.
          </p>

          <div className="mt-5 grid w-full gap-3 text-left">
            {reasons.map((r) => (
              <div key={r.icon} className="flex items-start gap-3">
                <Icon name={r.icon} size={22} color={colors.cyanDark} />
                <span className="text-sm" style={{ lineHeight: 1.4 }}>
                  {r.text}
                </span>
              </div>
            ))}
          </div>

          <FilledButton icon="login" onClick={onLogin} className="mt-6 w-full" style={{ height: 52 }}>
            Iniciar sesión
          </FilledButton>
        </div>
      </Card>
    </div>
  );
}
