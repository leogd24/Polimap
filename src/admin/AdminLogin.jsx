// src/admin/AdminLogin.jsx — Responsable: Alexis
// Entrada al panel (admin.html). Solo para correos DESIGNADOS en la tabla
// "accesos": profesores @academicos.udg.mx (rol admin) y la cuenta maestra.
//
// Formas de entrar:
//   1. Correo + contraseña.
//   2. "Iniciar sesión con Google" (profesores con su cuenta @academicos).
//   3. "Crear o recuperar contraseña": llega un código al correo designado
//      y ahí mismo se escribe la contraseña nueva. Así se crea la primera vez.
//
// Props: session (getSession), hint (mensaje arriba), onLoggedIn(usuario)
import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { loginWithGoogle, loginWithPassword, loginDev } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import BrandStripe from '../components/BrandStripe.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import FilledButton from '../components/FilledButton.jsx';
import CodeLogin, { EmailInput, PasswordInput, LinkButton } from '../components/CodeLogin.jsx';

export default function AdminLogin({ session, hint, onLoggedIn }) {
  const [mode, setMode] = useState('password'); // 'password' | 'recover'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const academicos = session?.dominios?.academicos || 'academicos.udg.mx';

  async function handle(promise) {
    setLoading(true);
    setError('');
    try {
      onLoggedIn(await promise);
    } catch (err) {
      setError(err.fromApi ? err.message : 'No hay conexión con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function submit(event) {
    event?.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    handle(loginWithPassword(email.trim(), password));
  }

  return (
    <div
      className="app-scroll flex min-h-[100dvh] flex-col items-center justify-center px-5 py-8"
      style={{ backgroundColor: colors.blueDeep }}
    >
      <div className="flex flex-col items-center text-center">
        <PolimapLogo size={76} />
        <h1 className="m-0 mt-4 text-3xl" style={{ color: colors.white, fontWeight: 900 }}>
          Panel de administración
        </h1>
        <p className="m-0 mt-2 text-sm" style={{ color: alpha(colors.white, 0.8) }}>
          Solo para correos designados de la Escuela Politécnica
        </p>
      </div>

      <Card className="mt-7 w-full max-w-[420px]">
        <BrandStripe height={6} />
        <div className="p-6">
          {hint && (
            <div
              className="mb-4 flex items-start gap-2 p-3 text-sm"
              style={{ backgroundColor: colors.goldTint, color: colors.goldDark, borderRadius: 14 }}
            >
              <Icon name="info" size={20} color={colors.goldDark} />
              <span style={{ lineHeight: 1.35 }}>{hint}</span>
            </div>
          )}

          {mode === 'password' ? (
            <>
              <form onSubmit={submit} className="grid gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold" htmlFor="admin-email" style={{ color: colors.textSecondary }}>
                    Correo designado
                  </label>
                  <EmailInput id="admin-email" value={email} onChange={setEmail} placeholder={`nombre@${academicos}`} />
                </div>
                <PasswordInput
                  id="admin-pass"
                  label="Contraseña"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
                {/* Botón real de envío para que Enter funcione */}
                <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
                <FilledButton icon={loading ? 'hourglass_top' : 'login'} className="w-full" onClick={submit}>
                  {loading ? 'Entrando…' : 'Entrar al panel'}
                </FilledButton>
              </form>

              <div className="mt-1 text-center text-sm">
                <LinkButton
                  onClick={() => {
                    setError('');
                    setMode('recover');
                  }}
                >
                  ¿Primera vez u olvidaste tu contraseña? Créala aquí
                </LinkButton>
              </div>

              {session?.googleClientId && !session?.offline && (
                <>
                  <div className="my-4 flex items-center gap-3 text-xs font-bold" style={{ color: colors.textMuted }}>
                    <span className="h-px flex-1" style={{ backgroundColor: colors.border }} />o con tu cuenta @{academicos}
                    <span className="h-px flex-1" style={{ backgroundColor: colors.border }} />
                  </div>
                  <GoogleButton
                    clientId={session.googleClientId}
                    hostedDomain={academicos}
                    onCredential={(credential) => handle(loginWithGoogle(credential, 'panel'))}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <div className="mb-4 flex items-start gap-2 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
                <Icon name="key" size={20} color={colors.blue} />
                <span>
                  Te mandaremos un código a tu correo designado. Con él creas tu contraseña (o la cambias si la
                  olvidaste).
                </span>
              </div>
              <CodeLogin
                mode="clave"
                placeholder={`nombre@${academicos}`}
                initialEmail={email}
                onLoggedIn={onLoggedIn}
                onCancel={() => setMode('password')}
              />
            </>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 p-3 text-sm"
              style={{ backgroundColor: colors.crimsonTint, color: colors.crimsonDark, borderRadius: 14 }}
            >
              <Icon name="error" size={20} color={colors.crimsonDark} />
              <span style={{ lineHeight: 1.35 }}>{error}</span>
            </div>
          )}

          {/* Solo aparece en tu compu con 'modo_dev_login' => true */}
          {session?.modoDev && mode === 'password' && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: colors.border }}>
              <div className="mb-2 text-xs font-bold" style={{ color: colors.goldDark }}>
                MODO PRUEBA LOCAL
              </div>
              <FilledButton
                icon="science"
                className="w-full"
                background={colors.goldDark}
                onClick={() => email.trim() && handle(loginDev(email.trim(), 'panel'))}
              >
                Entrar sin contraseña (solo XAMPP)
              </FilledButton>
            </div>
          )}
        </div>
      </Card>

      <a href="/" className="mt-5 text-sm font-bold no-underline" style={{ color: colors.cyan }}>
        Ir a la app de alumnos
      </a>
    </div>
  );
}
