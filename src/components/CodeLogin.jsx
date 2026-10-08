// src/components/CodeLogin.jsx — Responsable: Alexis
// Entrar (o crear contraseña) con un código de 6 dígitos que llega al correo.
// Es el RESPALDO del botón de Google: si la UdeG bloquea Google o el
// celular no lo abre, igual se puede entrar.
//
// Paso a paso:
//   1. La persona escribe su correo → requestCode() → la API manda el código.
//   2. Escribe los 6 números (y, en modo 'clave', su contraseña nueva dos veces).
//   3. 'app'   → loginWithCode()   → entra a la app.
//      'clave' → createPassword()  → guarda la contraseña y entra al panel.
//
// Props:
//   mode         'app' | 'clave'
//   placeholder  ejemplo de correo
//   initialEmail correo ya escrito (opcional)
//   onLoggedIn   recibe el usuario
//   onCancel     regresar (opcional)
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import { requestCode, loginWithCode, createPassword } from '../lib/api.js';
import Icon from './Icon.jsx';
import FilledButton from './FilledButton.jsx';
import { TextField } from './Inputs.jsx';

export default function CodeLogin({ mode = 'app', placeholder = 'correo@alumnos.udg.mx', initialEmail = '', onLoggedIn, onCancel }) {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0); // segundos para poder pedir otro código

  // Cuenta regresiva de 60 s para "Mandar otro código".
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function run(task) {
    setLoading(true);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err.fromApi ? err.message : 'No hay conexión con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function send(event) {
    event?.preventDefault();
    if (loading || !email.trim()) return;
    run(async () => {
      const result = await requestCode(email.trim(), mode === 'clave' ? 'clave' : 'app');
      setSentTo(result.enviadoA);
      setDevCode(result.codigoDev || '');
      setStep('code');
      setWait(60);
    });
  }

  function confirm(event) {
    event?.preventDefault();
    if (loading) return;
    if (code.replace(/\D/g, '').length !== 6) {
      setError('Escribe los 6 números del código.');
      return;
    }
    if (mode === 'clave') {
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (password !== password2) {
        setError('Las dos contraseñas no son iguales.');
        return;
      }
    }
    run(async () => {
      const user =
        mode === 'clave'
          ? await createPassword(email.trim(), code, password)
          : await loginWithCode(email.trim(), code);
      onLoggedIn(user);
    });
  }

  return (
    <div className="w-full text-left">
      {step === 'email' ? (
        <form onSubmit={send}>
          <label className="mb-2 block text-sm font-bold" htmlFor="code-email">
            {mode === 'clave' ? 'Tu correo de administrador' : 'Tu correo institucional'}
          </label>
          <EmailInput id="code-email" value={email} onChange={setEmail} placeholder={placeholder} />
          <FilledButton icon={loading ? 'hourglass_top' : 'mail'} className="mt-3 w-full" onClick={send}>
            {loading ? 'Enviando…' : 'Mandarme un código'}
          </FilledButton>
        </form>
      ) : (
        <form onSubmit={confirm}>
          <div
            className="mb-3 flex items-start gap-2 p-3 text-sm"
            style={{ backgroundColor: colors.greenTint, color: colors.greenDark, borderRadius: 14 }}
          >
            <Icon name="mark_email_read" size={20} color={colors.greenDark} />
            <span style={{ lineHeight: 1.35 }}>
              Te mandamos un código a <b>{sentTo}</b>. Revisa también la carpeta de spam. Vence en 10 minutos.
            </span>
          </div>
          {devCode && (
            <p className="m-0 mb-3 text-xs font-bold" style={{ color: colors.goldDark }}>
              MODO PRUEBA LOCAL · tu código es {devCode}
            </p>
          )}

          <label className="mb-2 block text-sm font-bold" htmlFor="code-digits">
            Código de 6 números
          </label>
          <input
            id="code-digits"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="w-full px-4 py-4 text-center text-2xl font-black outline-none"
            style={{
              letterSpacing: 8,
              backgroundColor: colors.surface,
              border: `1.5px solid ${colors.border}`,
              borderRadius: 'var(--radius-input)',
              color: colors.textPrimary,
            }}
          />

          {mode === 'clave' && (
            <div className="mt-3 grid gap-2">
              <PasswordInput id="new-pass" label="Contraseña nueva (mínimo 8)" value={password} onChange={setPassword} />
              <PasswordInput id="new-pass-2" label="Repítela" value={password2} onChange={setPassword2} />
            </div>
          )}

          <FilledButton icon={loading ? 'hourglass_top' : 'login'} className="mt-3 w-full" onClick={confirm}>
            {loading ? 'Revisando…' : mode === 'clave' ? 'Guardar contraseña y entrar' : 'Entrar'}
          </FilledButton>

          <div className="mt-2 flex justify-between text-sm">
            <LinkButton onClick={() => setStep('email')}>Cambiar correo</LinkButton>
            <LinkButton onClick={send} disabled={wait > 0 || loading}>
              {wait > 0 ? `Otro código en ${wait} s` : 'Mandar otro código'}
            </LinkButton>
          </div>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 p-3 text-sm"
          style={{ backgroundColor: colors.crimsonTint, color: colors.crimsonDark, borderRadius: 14 }}
        >
          <Icon name="error" size={20} color={colors.crimsonDark} />
          <span style={{ lineHeight: 1.35 }}>{error}</span>
        </div>
      )}

      {onCancel && (
        <div className="mt-3 text-center">
          <LinkButton onClick={onCancel}>Regresar</LinkButton>
        </div>
      )}
    </div>
  );
}

// --- Piezas pequeñas (mismo estilo que Inputs.jsx) ---------------------------

export function EmailInput({ id, value, onChange, placeholder }) {
  return (
    <TextField
      value={value}
      onChange={(v) => onChange(v.replace(/\s/g, ''))}
      placeholder={placeholder}
      prefixIcon="mail"
      inputProps={{ id, type: 'email', autoComplete: 'email', inputMode: 'email' }}
    />
  );
}

export function PasswordInput({ id, label, value, onChange, autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-bold" htmlFor={id} style={{ color: colors.textSecondary }}>
        {label}
      </label>
      <TextField
        value={value}
        onChange={onChange}
        prefixIcon="key"
        inputProps={{ id, type: visible ? 'text' : 'password', autoComplete }}
        suffix={
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="flex h-11 w-11 items-center justify-center border-0 bg-transparent"
          >
            <Icon name={visible ? 'visibility_off' : 'visibility'} size={20} color={colors.textSecondary} />
          </button>
        }
      />
    </div>
  );
}

export function LinkButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[40px] border-0 bg-transparent px-1 font-bold"
      style={{ color: disabled ? colors.textMuted : colors.cyanDark, cursor: disabled ? 'default' : 'pointer' }}
    >
      {children}
    </button>
  );
}
