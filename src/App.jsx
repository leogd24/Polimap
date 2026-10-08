import { useCallback, useEffect, useState } from 'react';
import SplashScreen from './pages/SplashScreen.jsx';
import MainShell from './pages/MainShell.jsx';
import LoginScreen from './pages/LoginScreen.jsx';
import { getSession, logout } from './lib/api.js';

// Si alguien ya eligió "Entrar como invitado", no le volvemos a preguntar
// cada vez que abre la app (se guarda solo en este celular).
const GUEST_KEY = 'polimap.invitado';

function readGuest() {
  try {
    return localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}
function saveGuest(on) {
  try {
    if (on) localStorage.setItem(GUEST_KEY, '1');
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Sin almacenamiento: solo se vuelve a preguntar la próxima vez.
  }
}

/// Equivalente de app.dart: arranca en el splash y pasa al shell.
///
/// Con el inicio de sesión (Alexis):
///   1. Mientras se ve el splash, pregunta a la API si ya hay sesión.
///   2. Con sesión → MainShell con el usuario (puede reportar).
///   3. Sin sesión → pantalla de bienvenida: Google, código por correo o
///      "Entrar como invitado". El invitado ve TODO menos Reportar.
///   4. Desde la pestaña Reportar, un invitado puede abrir el login (loginOpen).
///   5. Si la API responde 401 (sesión vencida), api.js manda el evento
///      'polimap:sesion-cerrada' y el usuario queda como invitado.
export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [session, setSession] = useState(null); // respuesta de getSession()
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(readGuest);
  const [loginOpen, setLoginOpen] = useState(false); // login abierto desde Reportar
  const [sessionError, setSessionError] = useState('');

  const loadSession = useCallback(() => {
    setSessionError('');
    getSession()
      .then((data) => {
        setSession(data);
        setUser(data.usuario);
      })
      .catch((error) => setSessionError(error.message));
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const onClosed = () => {
      setUser(null);
      loadSession();
    };
    window.addEventListener('polimap:sesion-cerrada', onClosed);
    return () => window.removeEventListener('polimap:sesion-cerrada', onClosed);
  }, [loadSession]);

  const finishSplash = useCallback(() => setSplashDone(true), []);

  function handleLoggedIn(newUser) {
    setUser(newUser);
    setLoginOpen(false);
  }

  function enterAsGuest() {
    saveGuest(true);
    setGuest(true);
    setLoginOpen(false);
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    saveGuest(false);
    setGuest(false);
    loadSession();
  }

  // El splash se queda hasta que termine su animación Y sepamos si hay sesión.
  if (!splashDone || (!session && !sessionError)) {
    return <SplashScreen onFinish={finishSplash} />;
  }

  // Bienvenida: primera vez que se abre la app (sin sesión y sin ser invitado).
  if (!user && !guest) {
    return <LoginScreen session={session ?? { offline: true }} onLoggedIn={handleLoggedIn} onGuest={enterAsGuest} />;
  }

  // Transición de 450 ms, como el PageRouteBuilder de Flutter.
  return (
    <div style={{ animation: 'polimap-fade 450ms ease' }}>
      <style>{'@keyframes polimap-fade { from { opacity: 0 } to { opacity: 1 } }'}</style>
      <MainShell user={user} onLogout={handleLogout} onRequestLogin={() => setLoginOpen(true)} />

      {/* Login encima de la app (desde Reportar o el botón "Entrar"):
          al terminar regresa a la misma pestaña. */}
      {loginOpen && !user && (
        <div className="app-scroll fixed inset-0 z-50">
          <LoginScreen
            session={session ?? { offline: true }}
            onLoggedIn={handleLoggedIn}
            onCancel={() => setLoginOpen(false)}
            reason="Para reportar entra con tu correo @alumnos.udg.mx"
          />
        </div>
      )}
    </div>
  );
}
