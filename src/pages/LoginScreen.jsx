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
import Card from '../components/Card.jsx';
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
      className="app-scroll flex min-h-[100dvh] flex-col items-center justify-center px-5 py-8"
      style={{ backgroundColor: colors.blueDeep }}
    >
      <div className="flex flex-col items-center text-center">
        <PolimapLogo size={84} />
        <h1 className="m-0 mt-5 text-3xl" style={{ color: colors.white, fontWeight: 900, letterSpacing: 1 }}>
          POLIMAP
        </h1>
        <p className="m-0 mt-2 text-base" style={{ color: alpha(colors.white, 0.82) }}>
          Tu campus en la palma de tu mano
        </p>
      </div>

      <Card className="mt-7 w-full max-w-[400px]">
        <BrandStripe height={6} />
        <div className="flex flex-col items-center p-6 text-center">
          {mode === 'main' ? (
            <>
              <Icon name="school" size={38} color={colors.blue} />
              <p className="m-0 mt-2 font-bold" style={{ lineHeight: 1.4 }}>
                {reason || `Alumno: entra con tu correo @${dominio}`}
              </p>
              <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
                Con tu cuenta puedes enviar reportes y ver su seguimiento.
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
                    className="tappable flex min-h-[48px] w-full items-center justify-center gap-2 px-4 font-bold"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      border: `1.5px solid ${colors.border}`,
                      borderRadius: 999,
                    }}
                  >
                    <Icon name="mail" size={20} color={colors.blue} />
                    {hasGoogle ? '¿No funciona Google? Recibe un código' : 'Recibir un código en mi correo'}
                  </button>
                </>
              )}

              {loading && (
                <p className="m-0 mt-3 text-sm" style={{ color: colors.textSecondary }}>
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
                  <FilledButton
                    icon="login"
                    className="mt-3 w-full"
                    background={colors.goldDark}
                    onClick={() => devEmail.trim() && handle(loginDev(devEmail.trim(), 'app'))}
                  >
                    Entrar sin Google
                  </FilledButton>
                </form>
              )}
            </>
          ) : (
            <>
              <Icon name="mark_email_unread" size={38} color={colors.blue} />
              <p className="m-0 mb-4 mt-2 font-bold">Entra con un código en tu correo</p>
              <CodeLogin
                mode="app"
                placeholder={`tu.nombre@${dominio}`}
                onLoggedIn={onLoggedIn}
                onCancel={() => setMode('main')}
              />
            </>
          )}
        </div>
      </Card>

      {/* Invitado: familias y visitantes */}
      {onGuest && (
        <button
          type="button"
          onClick={onGuest}
          className="tappable mt-5 flex min-h-[52px] w-full max-w-[400px] items-center justify-center gap-2 px-5 font-extrabold"
          style={{
            backgroundColor: 'transparent',
            color: colors.white,
            border: `1.5px solid ${alpha(colors.white, 0.5)}`,
            borderRadius: 'var(--radius-button)',
          }}
        >
          <Icon name="family_restroom" color={colors.cyan} />
          Entrar como invitado
        </button>
      )}
      {onGuest && (
        <p className="m-0 mt-2 max-w-[400px] text-center text-xs" style={{ color: alpha(colors.white, 0.75), lineHeight: 1.5 }}>
          Para familias y visitantes: mapa, edificios, horarios, avisos y asistente. Para enviar reportes se necesita
          correo de alumno.
        </p>
      )}
      {onCancel && (
        <div className="mt-3">
          <LinkButtonOnDark onClick={onCancel}>Regresar sin iniciar sesión</LinkButtonOnDark>
        </div>
      )}

      <p className="m-0 mt-6 max-w-[400px] text-center text-xs" style={{ color: alpha(colors.white, 0.6), lineHeight: 1.5 }}>
        Solo usamos tu nombre y correo para identificar tus reportes. Si envías un reporte como anónimo, el equipo
        que lo atiende no ve quién lo mandó.
      </p>
    </div>
  );
}

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
