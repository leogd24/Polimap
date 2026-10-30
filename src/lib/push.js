// src/lib/push.js — Responsable: Alexis
// =====================================================================
// Notificaciones push en el navegador (parte del celular).
//
//   getPushState()  → 'unsupported' | 'ios-install' | 'denied' | 'on' | 'off'
//   enablePush()    → pide permiso, se suscribe y lo guarda en la API
//   disablePush()   → se da de baja aquí y en la API
//   syncPush()      → si ya estaba activado, vuelve a mandar la suscripción
//                     (por si inició sesión después, o el servidor la perdió)
//
// La notificación la muestra public/sw.js (evento "push").
//
// Dónde funciona:
//   - Android (Chrome, Edge, Samsung, Firefox) y computadoras: sí.
//   - iPhone/iPad: solo con iOS 16.4+ y la app INSTALADA
//     (Safari → Compartir → "Agregar a inicio") y abierta desde ese ícono.
//   - Solo en HTTPS (polimap.ct.ws) o en localhost.
// =====================================================================
import { getPushKey, savePushSubscription, deletePushSubscription } from './api.js';

/** ¿Es iPhone/iPad? (los iPad nuevos dicen ser Mac, por eso lo del touch). */
function isIos() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** ¿Se abrió desde el ícono instalado? */
function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** "BHxk…" (base64url) → bytes, que es lo que pide pushManager.subscribe(). */
function keyToBytes(base64url) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * El service worker. En el hosting lo registra main.jsx; con `npm run dev`
 * no, así que aquí lo registramos para poder probar en localhost
 * (public/sw.js no guarda caché cuando corre en el puerto de Vite).
 */
async function getWorker() {
  let reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  // Esperar a que esté activo (máximo 10 s).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('El service worker no arrancó')), 10000)),
  ]);
}

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
}

export async function getPushState() {
  if (isIos() && !isInstalled()) return 'ios-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function enablePush() {
  if (!supported()) throw new Error('Este navegador no permite notificaciones.');

  // 1) Permiso: el navegador muestra su propio cuadro (solo si el usuario tocó un botón).
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('No se dio permiso. Puedes activarlo en el candado de la barra de direcciones (o en Ajustes).');
  }

  // 2) Suscribirse con la llave del servidor.
  const reg = await getWorker();
  const key = keyToBytes(await getPushKey());
  let sub;
  try {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch (error) {
    // Si ya había una suscripción con OTRA llave (servidor nuevo), se quita y se reintenta.
    const old = await reg.pushManager.getSubscription();
    if (!old) throw error;
    await old.unsubscribe();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }

  // 3) Guardarla en la API (api/push.php).
  await savePushSubscription(sub.toJSON());
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await deletePushSubscription(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}

/** Si ya estaba activado, re-envía la suscripción (silencioso). */
export async function syncPush() {
  try {
    if (!supported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await savePushSubscription(sub.toJSON());
  } catch {
    // Sin internet o sin API: se intentará la próxima vez.
  }
}
