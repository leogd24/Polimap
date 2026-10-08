// src/components/GoogleButton.jsx — Responsable: Alexis
// Botón oficial "Iniciar sesión con Google" (Google Identity Services).
//
// Paso a paso:
//   1. Carga UNA sola vez el script https://accounts.google.com/gsi/client.
//   2. Lo configura con el ID de cliente (viene de api/auth.php → config.php).
//   3. Dibuja el botón de Google dentro de un <div>.
//   4. Cuando la persona elige su cuenta, Google llama a onCredential con un
//      "ID token" (texto firmado). Ese token se manda a la API, que es la que
//      decide si el correo puede entrar (alumnos.udg.mx, academicos.udg.mx…).
//
// Props:
//   clientId      ID de cliente de Google (si está vacío no se dibuja nada)
//   onCredential  función que recibe el ID token
//   hostedDomain  sugerencia de dominio para el selector de cuentas (opcional)
//   text          'signin_with' | 'continue_with'
//
// El botón lo dibuja Google con sus colores: es la única excepción a
// "colores solo desde theme.js", porque Google exige que no se modifique.
import { useEffect, useRef, useState } from 'react';
import { colors } from '../styles/theme.js';

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

/** Carga el script de Google una sola vez para toda la app. */
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // permite reintentar
        reject(new Error('No se pudo cargar Google. Revisa tu conexión.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function GoogleButton({ clientId, onCredential, hostedDomain, text = 'signin_with' }) {
  const boxRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [error, setError] = useState('');

  // Siempre usamos la versión más nueva de onCredential sin volver a dibujar.
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !boxRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          hd: hostedDomain || undefined, // solo sugiere; la API es la que valida
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
        });
        // Ancho del botón: el de su contenedor (máximo 400 px que permite Google).
        const width = Math.min(400, Math.max(220, boxRef.current.offsetWidth || 320));
        window.google.accounts.id.renderButton(boxRef.current, {
          type: 'standard',
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'left',
          locale: 'es',
          width,
        });
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [clientId, hostedDomain, text]);

  if (!clientId) return null;

  return (
    <div className="w-full">
      <div ref={boxRef} className="flex min-h-[44px] w-full justify-center" />
      {error && (
        <p className="m-0 mt-2 text-center text-xs" style={{ color: colors.crimsonDark }}>
          {error}
        </p>
      )}
    </div>
  );
}
