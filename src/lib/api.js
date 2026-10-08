// src/lib/api.js — Responsable: Alexis
//
// ÚNICO archivo que habla con el backend (PHP + MySQL).
// Las pantallas nunca usan fetch directo: importan estas funciones.
//
// Si la API no responde (no hay XAMPP corriendo, sin internet, etc.),
// cada función regresa los datos locales de src/data/ para que la app
// siga funcionando igual que antes.
//
// Uso en una pantalla:
//   import { getBuildings } from '../lib/api.js';
//   const [buildings, setBuildings] = useState(campusBuildings); // arranca con lo local
//   useEffect(() => { getBuildings().then(setBuildings); }, []);

import { campusBuildings } from '../data/campusBuildings.js';
import { faqEntries } from '../data/faqEntries.js';
import { colors } from '../styles/theme.js';

// En desarrollo, Vite manda /api a XAMPP (ver server.proxy en vite.config.js).
// Publicado, dist/ y api/ viven en el mismo servidor, así que /api funciona igual.
const API = '/api';

// Si la API tarda más que esto, usamos los datos locales.
const TIMEOUT_MS = 5000;
// Las que mandan correo (reporte nuevo, código de acceso) esperan a Gmail.
const MAIL_TIMEOUT_MS = 25000;

// Claves de localStorage (solo en este celular/navegador).
const LOCAL_REPORTS_KEY = 'polimap.reportes.locales';
// Copia del usuario con sesión, para poder abrir la app sin internet.
// (La sesión real es una cookie HttpOnly que JavaScript no puede leer.)
const USER_KEY = 'polimap.usuario';

// -----------------------------------------------------------------------
// Utilidades internas
// -----------------------------------------------------------------------

/** fetch con tiempo límite; regresa el JSON o lanza error. */
// options.timeout: tiempo límite propio (las peticiones que mandan correo
// tardan más, porque el servidor espera a Gmail).
async function request(path, { timeout = TIMEOUT_MS, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // credentials: 'same-origin' → el navegador manda la cookie de sesión.
    const response = await fetch(`${API}/${path}`, {
      credentials: 'same-origin',
      ...options,
      signal: controller.signal,
    });
    // Si /api no existe, Vite o el hosting pueden regresar index.html: eso no es JSON.
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    if (!isJson) throw new Error('La API no respondió con JSON');
    const data = await response.json();
    if (!response.ok) {
      // 401 = la sesión se cerró o venció: App.jsx escucha este aviso y
      // regresa a la pantalla de inicio de sesión.
      if (response.status === 401 && !path.startsWith('auth.php')) {
        window.dispatchEvent(new CustomEvent('polimap:sesion-cerrada'));
      }
      const error = new Error(data.error || `Error ${response.status}`);
      error.status = response.status;
      error.fromApi = true; // la API sí respondió, pero rechazó los datos
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Lee un JSON de localStorage sin romper la app si está vacío o bloqueado. */
function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modo privado o almacenamiento lleno: no pasa nada, solo no se recuerda.
  }
}

function removeLocal(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/** POST con cuerpo JSON. metodo: 'PATCH' o 'DELETE' se manda como POST ?_method=… */
function sendJson(path, body, metodo = 'POST', timeout = TIMEOUT_MS) {
  const url = metodo === 'POST' ? path : `${path}${path.includes('?') ? '&' : '?'}_method=${metodo}`;
  return request(url, {
    timeout,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// -----------------------------------------------------------------------
// Sesión (App.jsx, LoginScreen.jsx y el panel)
//   - Sin sesión = invitado: ve todo menos "Reportar".
//   - Alumno: Google (principal) o código por correo (respaldo).
//   - Panel: Google o correo + contraseña (cuentas designadas en la BD).
// -----------------------------------------------------------------------

/**
 * ¿Hay sesión? Regresa:
 *   { usuario | null, googleClientId, dominios, codigoPorCorreo, modoDev, offline }
 * usuario = { id, correo, nombre, foto, tipo, permisos: { app, admin, maestro } }
 *
 * Sin internet regresa el último usuario guardado en este celular
 * (offline: true) para que la app siga abriendo el mapa y los horarios.
 */
export async function getSession() {
  try {
    const data = await request('auth.php');
    if (data.usuario) writeLocal(USER_KEY, data.usuario);
    else removeLocal(USER_KEY);
    return { ...data, offline: false };
  } catch (error) {
    if (error.fromApi) throw error;
    console.warn('[api] getSession: sin conexión, usando el último usuario.', error.message);
    return {
      usuario: readLocal(USER_KEY, null),
      googleClientId: '',
      dominios: {},
      codigoPorCorreo: false,
      modoDev: false,
      offline: true,
    };
  }
}

/**
 * Manda a la API el "ID token" que entrega el botón de Google.
 * destino: 'app' (alumnos) o 'panel' (administración).
 * Si el correo no tiene permiso, lanza el error con el mensaje de la API.
 */
export async function loginWithGoogle(credential, destino = 'app') {
  const data = await sendJson('auth.php', { accion: 'google', credential, destino });
  writeLocal(USER_KEY, data.usuario);
  return data.usuario;
}

/**
 * Respaldo de Google: manda un código de 6 dígitos al correo.
 *   destino 'app'   → para entrar a la app (alumnos)
 *   destino 'clave' → para crear o recuperar la contraseña del panel
 * Regresa { enviadoA: "ju•••@alumnos.udg.mx", minutos, codigoDev? }.
 * (codigoDev solo existe en tu compu con XAMPP y el correo apagado.)
 */
export async function requestCode(correo, destino = 'app') {
  return sendJson('auth.php', { accion: 'pedir_codigo', correo, destino }, 'POST', MAIL_TIMEOUT_MS);
}

/** Entra a la app con el código que llegó al correo. Regresa el usuario. */
export async function loginWithCode(correo, codigo) {
  const data = await sendJson('auth.php', { accion: 'verificar_codigo', correo, codigo });
  writeLocal(USER_KEY, data.usuario);
  return data.usuario;
}

/** Panel: entra con correo + contraseña (admins y cuenta maestra). */
export async function loginWithPassword(correo, clave) {
  const data = await sendJson('auth.php', { accion: 'entrar_clave', correo, clave });
  return data.usuario;
}

/** Panel: crea o recupera la contraseña con el código del correo, y entra. */
export async function createPassword(correo, codigo, clave) {
  const data = await sendJson('auth.php', { accion: 'crear_clave', correo, codigo, clave });
  return data.usuario;
}

/** Solo pruebas locales con XAMPP ('modo_dev_login' => true en config.php). */
export async function loginDev(correo, destino = 'app') {
  const data = await sendJson('auth.php', { accion: 'dev', correo, destino });
  writeLocal(USER_KEY, data.usuario);
  return data.usuario;
}

/** Cierra la sesión en este dispositivo. */
export async function logout() {
  removeLocal(USER_KEY);
  try {
    await sendJson('auth.php', { accion: 'salir' });
  } catch (error) {
    console.warn('[api] logout:', error.message);
  }
}

// -----------------------------------------------------------------------
// Edificios (Marcos, Gabo)
// -----------------------------------------------------------------------

/**
 * Lista de edificios con la misma forma que campusBuildings.js,
 * más lat, lng, entrance y photo.
 */
export async function getBuildings() {
  try {
    const data = await request('edificios.php');
    // La BD guarda la CLAVE del color ("blue"); la pantalla espera el valor de theme.js.
    return data.map((b) => ({ ...b, color: colors[b.color] ?? colors.blue }));
  } catch (error) {
    console.warn('[api] getBuildings: usando datos locales.', error.message);
    return campusBuildings;
  }
}

// -----------------------------------------------------------------------
// Preguntas frecuentes (Gabo)
// -----------------------------------------------------------------------

/** Preguntas: { id, question, answer, keywords[], category, buildingNumber, icon } */
export async function getFaq() {
  try {
    return await request('faq.php');
  } catch (error) {
    console.warn('[api] getFaq: usando datos locales.', error.message);
    return faqEntries;
  }
}

// -----------------------------------------------------------------------
// Avisos (Leo)
// -----------------------------------------------------------------------

/** Avisos vigentes: { id, title, content, type, startDate, endDate }. Sin API → []. */
export async function getNotices() {
  try {
    return await request('avisos.php');
  } catch (error) {
    console.warn('[api] getNotices: sin avisos.', error.message);
    return [];
  }
}

// -----------------------------------------------------------------------
// Reportes (Katia)
// -----------------------------------------------------------------------

/**
 * Envía un reporte. Recibe un FormData con los campos del contrato:
 *   categoria, descripcion, edificio_number | zona, anonimo, foto, lat, lng, precision_m
 * Regresa { ok, folio, estado, offline? }.
 *
 * - Si la API RECHAZA los datos (ej. descripción corta) → lanza el error
 *   para que la pantalla muestre el mensaje.
 * - Si la API NO RESPONDE → lo guarda en este celular con folio local
 *   (POLI-LOCAL-...) y regresa offline: true.
 */
export async function createReport(formData) {
  try {
    // La cookie de sesión dice quién lo envía: no hace falta mandar el correo.
    return await request('reportes.php', { method: 'POST', body: formData, timeout: MAIL_TIMEOUT_MS });
  } catch (error) {
    if (error.fromApi) throw error;

    console.warn('[api] createReport: sin conexión, guardado local.', error.message);
    const locales = readLocal(LOCAL_REPORTS_KEY, []);
    const folio = `POLI-LOCAL-${String(locales.length + 1).padStart(4, '0')}`;
    const edificio = formData.get('edificio_number');
    locales.unshift({
      folio,
      categoria: formData.get('categoria'),
      edificioNumber: edificio ? Number(edificio) : null,
      zona: formData.get('zona') || null,
      descripcion: formData.get('descripcion'),
      foto: null, // la foto no se guarda localmente (pesa demasiado)
      lat: formData.get('lat') ? Number(formData.get('lat')) : null,
      lng: formData.get('lng') ? Number(formData.get('lng')) : null,
      estado: 'recibido',
      comentarioAdmin: null,
      createdAt: new Date().toISOString().slice(0, 19),
      offline: true,
    });
    writeLocal(LOCAL_REPORTS_KEY, locales);
    return { ok: true, folio, estado: 'recibido', offline: true };
  }
}

/**
 * "Mis reportes": los de la cuenta con sesión (en cualquier celular donde
 * entre el alumno), más los guardados sin conexión en este dispositivo.
 */
export async function getReports() {
  const locales = readLocal(LOCAL_REPORTS_KEY, []);
  try {
    const remotos = await request('reportes.php');
    return [...locales, ...remotos];
  } catch (error) {
    console.warn('[api] getReports: solo reportes locales.', error.message);
    return locales;
  }
}

// -----------------------------------------------------------------------
// Panel de administración (admin.html)
// Estas funciones NO tienen respaldo local: si la API falla, lanzan el error
// para que el panel lo muestre. Necesitan sesión de un profesor autorizado
// (la cookie la pone loginWithGoogle(credential, 'panel')).
// Error 401 = no hay sesión; 403 = la cuenta no es administradora.
// -----------------------------------------------------------------------

/** Todos los reportes, del más nuevo al más viejo (incluye prioridad, autor y resolvedAt). */
export async function getAllReports() {
  return request('reportes.php?todos=1');
}

/**
 * Cambia un reporte. Manda solo lo que cambia:
 *   updateReport('POLI-2026-0001', { estado: 'proceso', prioridad: 'alta', comentarioAdmin: '...' })
 * estado: recibido | revision | proceso | resuelto · prioridad: baja | media | alta
 */
export async function updateReport(folio, cambios) {
  return sendJson('reportes.php', { folio, ...cambios }, 'PATCH');
}

/** Historial de cambios de un folio, o de todos con 'todos' (últimos 200). */
export async function getReportHistory(folio = 'todos') {
  return request(`reportes.php?historial=${encodeURIComponent(folio)}`);
}

/** Todos los avisos (también vencidos) con el campo vigente. */
export async function getAllNotices() {
  return request('avisos.php?todos=1');
}

/** Crea (sin id) o edita (con id) un aviso: { id?, title, content, type, startDate, endDate }. */
export async function saveNotice(aviso) {
  return aviso.id ? sendJson('avisos.php', aviso, 'PATCH') : sendJson('avisos.php', aviso);
}

export async function deleteNotice(id) {
  return sendJson('avisos.php', { id }, 'DELETE');
}

/** Lista de accesos (solo administrador maestro): { accesos, usuarios }. */
export async function getAccessList() {
  return request('accesos.php');
}

/** rol: 'admin' (profesor @academicos.udg.mx) o 'prueba' (cualquier correo, entra como alumno). */
export async function addAccess(correo, rol, nota = '') {
  return sendJson('accesos.php', { correo, rol, nota });
}

export async function removeAccess(id) {
  return sendJson('accesos.php', { id }, 'DELETE');
}
