// src/pages/LoginScreen.jsx — Responsable: Alexis
// Pantalla de bienvenida e inicio de sesión de la app (alumnos).
//
// Tres caminos:
//   1. "Iniciar sesión con Google" con tu correo @alumnos.udg.mx  (principal)
//   2. "Recibir un código en mi correo"                          (si Google falla)
//   3. "Entrar como invitado": familias y visitantes ven el mapa, edificios,
//      horarios, avisos y el asistente. Lo único que NO pueden es reportar.
//
// Props:
//   session    respuesta de getSession(): googleClientId, dominios, codigoPorCorreo, modoDev, offline
//   onLoggedIn recibe el usuario cuando la API dice que sí
//   onGuest    entrar como invitado
//   reason     texto opcional arriba de los botones (ej. "Para reportar…")
//   onCancel   si viene, muestra "Regresar" (cuando se abre desde Reportar)
import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { loginWithGoogle, loginDev } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import BrandStripe from '../components/BrandStripe.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import FilledButton from '../components/FilledButton.jsx';
import CodeLogin, { EmailInput } from '../components/CodeLogin.jsx';

export default function LoginScreen({ session, onLoggedIn, onGuest, reason, onCancel }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('main'); // 'main' | 'code'
  const [devEmail, setDevEmail] = useState('');

  const dominio = session?.dominios?.alumnos || 'alumnos.udg.mx';
  const hasGoogle = Boolean(session?.googleClientId);
  const hasCode = Boolean(session?.codigoPorCorreo);

  async function handle(promise) {
    setLoading(true);
    setError('');
    try {
      onLoggedIn(await promise);
    } catch (err) {
      // La API manda el motivo en español (correo no autorizado, token vencido…).
      setError(err.fromApi ? err.message : 'No hay conexión con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="app-scroll flex min-h-[100dvh] items-center justify-center px-4 py-8"
      style={{
        // Noche del Poli con dos luces de color (magenta arriba, ciano abajo).
        background: `radial-gradient(520px circle at 0% 0%, ${alpha(colors.magenta, 0.28)}, transparent 62%), radial-gradient(560px circle at 100% 100%, ${alpha(colors.cyan, 0.24)}, transparent 62%), ${colors.blueDeep}`,
      }}
    >
      <div className="grid w-full max-w-[940px] items-center gap-8 lg:grid-cols-[1fr_420px]">
        {/* Bienvenida */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <PolimapLogo size={80} />
          <h1 className="m-0 mt-4 text-[2rem] lg:text-[2.75rem]" style={{ color: colors.white, fontWeight: 900, letterSpacing: 1, lineHeight: 1.05 }}>
            POLIMAP
          </h1>
          <p className="m-0 mt-2 text-base lg:text-lg" style={{ color: alpha(colors.white, 0.85) }}>
            Tu campus en la palma de tu mano
          </p>
          <ul className="m-0 mt-5 flex max-w-[420px] list-none flex-wrap justify-center gap-2 p-0 lg:justify-start">
            {VENTAJAS.map((v) => (
              <li key={v.texto} className="flex h-9 items-center gap-[6px] px-3 text-[0.8125rem] font-bold" style={{ borderRadius: 999, backgroundColor: alpha(colors.white, 0.1), color: colors.white, border: `1px solid ${alpha(colors.white, 0.14)}` }}>
                <Icon name={v.icon} size={18} color={v.color} />
                {v.texto}
              </li>
            ))}
          </ul>
        </div>

        {/* Tarjeta de entrada */}
        <div className="w-full">
          <div className="overflow-hidden" style={{ backgroundColor: colors.surface, borderRadius: 28, boxShadow: '0 24px 60px rgba(0, 10, 30, 0.45)' }}>
            <BrandStripe height={6} />
            <div className="flex flex-col p-6">
              {mode === 'main' ? (
                <>
                  <h2 className="m-0 text-[1.375rem] font-black" style={{ color: colors.textPrimary }}>
                    {onCancel ? 'Inicia sesión' : 'Entra a POLIMAP'}
                  </h2>
                  <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
                    {reason || (
                      <>
                        Alumnos con su correo <b style={{ color: colors.textPrimary }}>@{dominio}</b>: reportar, comentar, votar y publicar objetos perdidos.
                      </>
                    )}
                  </p>

                  <div className="mt-5 w-full">
                    {session?.offline ? (
                      <Notice icon="wifi_off" text="Sin internet no se puede iniciar sesión, pero puedes entrar como invitado." />
                    ) : hasGoogle ? (
                      <GoogleButton
                        clientId={session.googleClientId}
                        hostedDomain={dominio}
                        onCredential={(credential) => handle(loginWithGoogle(credential, 'app'))}
                      />
                    ) : (
                      !hasCode && <Notice icon="settings" text="Falta configurar google_client_id en api/config.php (ver docs/login.md)." />
                    )}
                  </div>

                  {/* Respaldo: código por correo */}
                  {!session?.offline && hasCode && (
                    <>
                      {hasGoogle && <OrDivider />}
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setMode('code');
                        }}
                        className="tappable flex min-h-[48px] w-full items-center justify-center gap-2 px-4 text-sm font-bold"
                        style={{ backgroundColor: 'transparent', color: colors.textPrimary, border: `1.5px solid ${colors.border}`, borderRadius: 999 }}
                      >
                        <Icon name="mail" size={20} color={colors.ink} />
                        Recibir un código en mi correo
                      </button>
                    </>
                  )}

                  {loading && (
                    <p className="m-0 mt-3 text-center text-sm" style={{ color: colors.textSecondary }}>
                      Verificando tu cuenta…
                    </p>
                  )}
                  {error && <ErrorBox text={error} />}

                  {/* Solo aparece en tu compu con 'modo_dev_login' => true */}
                  {session?.modoDev && (
                    <form
                      className="mt-5 w-full border-t pt-4 text-left"
                      style={{ borderColor: colors.border }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (devEmail.trim()) handle(loginDev(devEmail.trim(), 'app'));
                      }}
                    >
                      <div className="mb-2 text-xs font-bold" style={{ color: colors.goldDark }}>
                        MODO PRUEBA LOCAL (sin Google ni correo)
                      </div>
                      <EmailInput value={devEmail} onChange={setDevEmail} placeholder={`correo@${dominio}`} />
                      <FilledButton icon="login" className="mt-3 w-full" background={colors.goldSolid} onClick={() => devEmail.trim() && handle(loginDev(devEmail.trim(), 'app'))}>
                        Entrar sin Google
                      </FilledButton>
                    </form>
                  )}

                  {/* Invitado: familias y visitantes */}
                  {onGuest && (
                    <button
                      type="button"
                      onClick={onGuest}
                      className="tappable mt-5 flex w-full items-center gap-3 p-3 text-left"
                      style={{ borderRadius: 18, backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ borderRadius: 14, backgroundColor: colors.cyanTint }}>
                        <Icon name="family_restroom" color={colors.cyanDark} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black" style={{ color: colors.textPrimary }}>
                          Entrar como invitado
                        </span>
                        <span className="block text-xs" style={{ color: colors.textSecondary, lineHeight: 1.35 }}>
                          Familias y visitantes: mapa, edificios, horarios, avisos y asistente.
                        </span>
                      </span>
                      <Icon name="arrow_forward" color={colors.textSecondary} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center" style={{ borderRadius: 16, backgroundColor: colors.blueTint }}>
                    <Icon name="mark_email_unread" size={26} color={colors.ink} />
                  </span>
                  <h2 className="m-0 mt-3 mb-4 text-[1.25rem] font-black" style={{ color: colors.textPrimary }}>
                    Entra con un código en tu correo
                  </h2>
                  <CodeLogin mode="app" placeholder={`tu.nombre@${dominio}`} onLoggedIn={onLoggedIn} onCancel={() => setMode('main')} />
                </>
              )}
            </div>
          </div>

          {onCancel && (
            <div className="mt-3 text-center">
              <LinkButtonOnDark onClick={onCancel}>Regresar sin iniciar sesión</LinkButtonOnDark>
            </div>
          )}

          <p className="m-0 mt-4 text-center text-xs" style={{ color: alpha(colors.white, 0.7), lineHeight: 1.5 }}>
            Solo usamos tu nombre y correo para identificar lo que publicas. Si envías un reporte como anónimo, el equipo que lo atiende no ve quién lo mandó.{' '}
            <a href="/privacidad.html" className="font-bold underline" style={{ color: colors.cyan }}>
              Aviso de privacidad
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Lo que se puede hacer en POLIMAP (chips de la bienvenida).
const VENTAJAS = [
  { icon: 'map', texto: 'Mapa del campus', color: colors.green },
  { icon: 'calendar_month', texto: 'Tu horario y fechas', color: colors.magentaLight },
  { icon: 'campaign', texto: 'Avisos del Poli', color: colors.cyan },
  { icon: 'add_alert', texto: 'Reportes', color: colors.crimsonLight },
];

function OrDivider() {
  return (
    <div className="my-4 flex w-full items-center gap-3 text-xs font-bold" style={{ color: colors.textMuted }}>
      <span className="h-px flex-1" style={{ backgroundColor: colors.border }} />o
      <span className="h-px flex-1" style={{ backgroundColor: colors.border }} />
    </div>
  );
}

function Notice({ icon, text }) {
  return (
    <div
      className="flex items-start gap-2 p-3 text-left text-sm"
      style={{ backgroundColor: colors.goldTint, color: colors.goldDark, borderRadius: 14 }}
    >
      <Icon name={icon} size={20} color={colors.goldDark} />
      <span style={{ lineHeight: 1.35 }}>{text}</span>
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div
      role="alert"
      className="mt-4 flex w-full items-start gap-2 p-3 text-left text-sm"
      style={{ backgroundColor: colors.crimsonTint, color: colors.crimsonDark, borderRadius: 14 }}
    >
      <Icon name="error" size={20} color={colors.crimsonDark} />
      <span style={{ lineHeight: 1.35 }}>{text}</span>
    </div>
  );
}

function LinkButtonOnDark({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] border-0 bg-transparent px-2 font-bold"
      style={{ color: colors.cyan }}
    >
      {children}
    </button>
  );
}
