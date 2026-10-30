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
// Última copia de lo que llega de la API, para abrir la app sin internet.
const COPIA_EDIFICIOS = 'polimap.copia.edificios';
const COPIA_FAQ = 'polimap.copia.faq';
const COPIA_AVISOS = 'polimap.copia.avisos';

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
      error.data = data; // datos extra (ej. 409 "ocupado" al designar consejal)
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
  removeLocal(COPIA_AVISOS); // algunos avisos son solo para consejales
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
    writeLocal(COPIA_EDIFICIOS, data);
    // La BD guarda la CLAVE del color ("blue"); la pantalla espera el valor de theme.js.
    return data.map((b) => ({ ...b, color: colors[b.color] ?? colors.blue }));
  } catch (error) {
    // Sin internet: la última copia de la API; si no hay, los datos de src/data/.
    const copia = readLocal(COPIA_EDIFICIOS, null);
    console.warn('[api] getBuildings: usando datos guardados.', error.message);
    return Array.isArray(copia) ? copia.map((b) => ({ ...b, color: colors[b.color] ?? colors.blue })) : campusBuildings;
  }
}

// -----------------------------------------------------------------------
// Preguntas frecuentes (Gabo)
// -----------------------------------------------------------------------

/** Preguntas: { id, question, answer, keywords[], category, buildingNumber, icon } */
export async function getFaq() {
  try {
    const data = await request('faq.php');
    writeLocal(COPIA_FAQ, data);
    return data;
  } catch (error) {
    const copia = readLocal(COPIA_FAQ, null);
    console.warn('[api] getFaq: usando datos guardados.', error.message);
    return Array.isArray(copia) ? copia : faqEntries;
  }
}

// -----------------------------------------------------------------------
// Avisos (Leo)
// -----------------------------------------------------------------------

/**
 * Avisos vigentes (como posts): { id, title, content, type, startDate, endDate,
 * photos[], pinned, allowComments, likes, liked, comments, createdAt }. Sin API → los últimos guardados.
 */
export async function getNotices() {
  try {
    // El grupo elegido en Horario: así también llegan los avisos de ese grupo (de sus consejales).
    const grupo = readLocal('polimap.horario', {})?.grupo ?? null;
    const data = await request(grupo ? `avisos.php?grupo=${encodeURIComponent(grupo)}` : 'avisos.php');
    writeLocal(COPIA_AVISOS, data);
    return data;
  } catch (error) {
    // Sin internet: los últimos avisos que se vieron en este celular.
    console.warn('[api] getNotices: usando los últimos guardados.', error.message);
    const copia = readLocal(COPIA_AVISOS, null);
    return Array.isArray(copia) ? copia : [];
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
// "A mí también me pasa" (Reportar)
// -----------------------------------------------------------------------

/**
 * Reportes SIN resolver del mismo lugar y categoría (últimos 30 días).
 * lugar: 'Edificio 3' o el nombre de la zona ('Explanada').
 * Regresa [{ folio, descripcion, foto, estado, createdAt, apoyos, yaApoyo, esMio }].
 * Sin conexión regresa [] (el alumno sigue reportando normal).
 */
export async function getSimilarReports(categoria, lugar) {
  const params = new URLSearchParams({ similares: '1', categoria });
  if (lugar.startsWith('Edificio ')) params.set('edificio_number', lugar.replace('Edificio ', ''));
  else params.set('zona', lugar);
  try {
    return await request(`reportes.php?${params}`);
  } catch (error) {
    console.warn('[api] getSimilarReports:', error.message);
    return [];
  }
}

/** Se suma a un reporte existente. Regresa { folio, apoyos, prioridad, yaEstaba }. */
export async function supportReport(folio) {
  return sendJson('reportes.php?accion=apoyar', { folio });
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

/**
 * Crea (sin id) o edita (con id) un aviso: { id?, title, content, type, startDate, endDate, notify? }.
 * notify: true → además lo manda como notificación a los celulares (tarda más).
 * Regresa { ok, id, push: { enviadas, fallidas, suscritos } | { error } | null }.
 */
export async function saveNotice(aviso) {
  const timeout = aviso.notify ? MAIL_TIMEOUT_MS : TIMEOUT_MS;
  return aviso.id ? sendJson('avisos.php', aviso, 'PATCH', timeout) : sendJson('avisos.php', aviso, 'POST', timeout);
}

export async function deleteNotice(id) {
  return sendJson('avisos.php', { id }, 'DELETE');
}

/** Lista de accesos (solo administrador maestro): { accesos, usuarios }. */
export async function getAccessList() {
  return request('accesos.php');
}

/**
 * rol: 'admin' (profesor @academicos.udg.mx) o 'prueba' (cualquier correo, entra como alumno).
 * invitar: true → le manda un correo con los pasos para entrar (solo admins).
 */
export async function addAccess(correo, rol, nota = '', invitar = false) {
  return sendJson('accesos.php', { correo, rol, nota, invitar }, 'POST', invitar ? MAIL_TIMEOUT_MS : TIMEOUT_MS);
}

/** Personas que han entrado: { total, items, hayMas }. tipo: alumno | admin | maestro | prueba | academico */
export async function getPeople({ q = '', tipo = '', pagina = 0 } = {}) {
  const p = new URLSearchParams({ personas: '1', q, tipo, pagina: String(pagina) });
  return request(`accesos.php?${p}`);
}

export async function updateAccessNote(id, nota) {
  return sendJson('accesos.php', { accion: 'nota', id, nota });
}

/** Borra la contraseña del panel de esa cuenta y cierra sus sesiones. */
export async function resetAccessPassword(id) {
  return sendJson('accesos.php', { accion: 'reset_clave', id });
}

export async function unlockAccess(id) {
  return sendJson('accesos.php', { accion: 'desbloquear', id });
}

/** Correo con los pasos para entrar al panel. */
export async function inviteAccess(id) {
  return sendJson('accesos.php', { accion: 'invitar', id }, 'POST', MAIL_TIMEOUT_MS);
}

/**
 * Historial de cambios del panel (reportes + avisos + comentarios + accesos + entradas).
 * filtros: { tipo, quien, desde, hasta, q, pagina }. Ver api/historial.php.
 */
export async function getPanelHistory(filtros = {}) {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => v !== '' && v != null && p.set(k, String(v)));
  return request(`historial.php?${p}`);
}

export async function removeAccess(id) {
  return sendJson('accesos.php', { id }, 'DELETE');
}

// -----------------------------------------------------------------------
// Notificaciones push (avisos al celular). La parte del navegador está en
// src/lib/push.js; aquí solo las llamadas a api/push.php.
// -----------------------------------------------------------------------

/** Llave pública VAPID del servidor (base64url). */
export async function getPushKey() {
  return (await request('push.php?clave=1')).publicKey;
}

/** Guarda la suscripción de este celular: subscription.toJSON() del navegador. */
export async function savePushSubscription(subscription) {
  // También va el grupo de Horario: así le llegan las fechas de exámenes de SU grupo.
  const grupo = readLocal('polimap.horario', {})?.grupo ?? null;
  return sendJson('push.php', { accion: 'suscribir', subscription, grupo });
}

export async function deletePushSubscription(endpoint) {
  return sendJson('push.php', { accion: 'cancelar', endpoint });
}

/** Panel: { activo, suscritos, misDispositivos }. */
export async function getPushStatus() {
  return request('push.php?estado=1');
}

/** Panel: manda una notificación de prueba a los celulares de quien la pide. */
export async function sendPushTest() {
  return sendJson('push.php', { accion: 'probar' }, 'POST', MAIL_TIMEOUT_MS);
}

// -----------------------------------------------------------------------
// Clima del Poli (solo para el ambiente del esquema del panel).
// Open-Meteo es gratis, no pide llave y deja llamarlo desde el navegador.
// Se guarda 15 minutos en este navegador para no pedirlo a cada rato.
// Regresa { codigo, temperatura, nubes } o null si no hay internet.
// -----------------------------------------------------------------------
const WEATHER_KEY = 'polimap.clima.v2'; // v2: con pronóstico por hora
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=20.7465&longitude=-103.3798' +
  '&current=weather_code,temperature_2m,cloud_cover' +
  '&hourly=precipitation_probability,weather_code,temperature_2m&forecast_days=2' +
  '&timezone=America%2FMexico_City';

export async function getWeather() {
  const guardado = readLocal(WEATHER_KEY, null);
  if (guardado && Date.now() - guardado.cuando < 15 * 60 * 1000) return guardado.datos;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const { current, hourly } = await response.json();
    const datos = {
      codigo: current.weather_code,
      temperatura: Math.round(current.temperature_2m),
      nubes: current.cloud_cover,
      // Pronóstico por hora (hoy y mañana) para "¿llevo paraguas?" de Inicio:
      // [{ hora: '2026-10-27T15:00', lluvia: 70 (%), codigo, temperatura }]
      horas: (hourly?.time ?? []).map((hora, i) => ({
        hora,
        lluvia: hourly.precipitation_probability?.[i] ?? 0,
        codigo: hourly.weather_code?.[i] ?? 0,
        temperatura: Math.round(hourly.temperature_2m?.[i] ?? 0),
      })),
    };
    writeLocal(WEATHER_KEY, { cuando: Date.now(), datos });
    return datos;
  } catch (error) {
    console.warn('[api] getWeather: sin clima.', error.message);
    return guardado?.datos ?? null; // el último que tengamos, aunque sea viejo
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------
// Avisos como posts: me gusta, fotos y comentarios (Alexis)
// Ver api/avisos.php, api/comentarios.php y docs/avisos-comentarios.md.
// -----------------------------------------------------------------------

/** Un aviso por id (aunque ya no esté vigente, para los enlaces ?aviso=12). */
export async function getNotice(id) {
  return request(`avisos.php?id=${encodeURIComponent(id)}`);
}

/** Me gusta / ya no me gusta. Regresa { liked, likes }. Pide sesión. */
export async function likeNotice(id) {
  return sendJson('avisos.php', { accion: 'like', id });
}

/** Panel: sube UNA foto (ya comprimida). Regresa { archivo, url }. */
export async function uploadNoticePhoto(file) {
  const data = new FormData();
  data.append('foto', file, file.name || 'foto.jpg');
  return request('avisos.php?accion=foto', { method: 'POST', body: data, timeout: MAIL_TIMEOUT_MS });
}

/**
 * Panel: sube UN archivo adjunto (PDF, Word, Excel o PowerPoint, hasta 10 MB).
 * Regresa { archivo, name, ext, size, url, download }.
 * Tiempo de espera largo: en datos móviles un PDF de 10 MB tarda.
 */
export async function uploadNoticeFile(file) {
  const data = new FormData();
  data.append('archivo', file, file.name);
  return request('avisos.php?accion=archivo', { method: 'POST', body: data, timeout: 120000 });
}

/** Comentarios visibles de un aviso: { comments, total, allowComments, canComment, paused }. */
export async function getComments(avisoId) {
  return request(`comentarios.php?aviso=${encodeURIComponent(avisoId)}`);
}

/**
 * Publica un comentario (padre = id del comentario al que responde).
 * Si el filtro lo bloquea, lanza un Error con el mensaje (error.status = 422).
 */
export async function postComment(avisoId, texto, padre = null) {
  return sendJson('comentarios.php', { accion: 'comentar', aviso: avisoId, texto, padre });
}

/** motivo: ofensivo | acoso | spam | datos | otro */
export async function reportComment(id, motivo) {
  return sendJson('comentarios.php', { accion: 'reportar', id, motivo });
}

export async function deleteComment(id) {
  return sendJson('comentarios.php', { accion: 'borrar', id });
}

/** Panel: { revisar, recientes, bloqueados, silenciados }. */
export async function getModeration() {
  return request('comentarios.php?moderacion=1');
}

/** Panel: accion = 'ocultar' | 'mostrar'. */
export async function moderateComment(id, accion, motivo = '') {
  return sendJson('comentarios.php', { accion, id, motivo });
}

/** Panel: pausa los comentarios de una cuenta (dias = 1, 7 o 30). */
export async function silenceUser(usuario, dias, motivo = '') {
  return sendJson('comentarios.php', { accion: 'silenciar', usuario, dias, motivo });
}

export async function unsilenceUser(usuario) {
  return sendJson('comentarios.php', { accion: 'quitar_silencio', usuario });
}

/** Confirmar lo que bloqueó el filtro: veredicto 'correcto' | 'error' | null (volver a "sin revisar"). */
export async function reviewBlocked(id, veredicto) {
  return sendJson('comentarios.php', { accion: 'revisar_bloqueo', id, veredicto });
}

// -----------------------------------------------------------------------
// Encuestas en avisos (Alexis). Ver api/avisos.php y docs/encuestas-perdidos.md.
//   aviso.poll = { question, multiple, closesAt, closed, voters, myVotes,
//                  showResults, options: [{ id, text, votes | null }] }
//   (votes llega en null hasta que votas o cierra: así nadie vota "por la mayoría")
// -----------------------------------------------------------------------

/** Vota (o cambia tu voto). opciones = [ids]. Regresa { poll }. Pide sesión. */
export async function votePoll(avisoId, opciones) {
  return sendJson('avisos.php', { accion: 'votar', id: avisoId, opciones });
}

// -----------------------------------------------------------------------
// Objetos perdidos y encontrados (Alexis). Ver api/perdidos.php.
//   item = { id, type: 'perdido'|'encontrado', title, description, category,
//            building, place, handover, date, photo, status, createdAt,
//            expiresAt, mine, author, contact, reports }
// -----------------------------------------------------------------------

/** Lista pública. filtros = { tipo, categoria, q, pagina }. Regresa { items, hayMas }. */
export async function getLostItems({ tipo = 'todos', categoria = '', q = '', pagina = 0 } = {}) {
  const p = new URLSearchParams({ tipo, categoria, q, pagina: String(pagina) });
  return request(`perdidos.php?${p}`);
}

/** Mis publicaciones (con su estado: activo, resuelto, oculto, vencido). */
export async function getMyLostItems() {
  return request('perdidos.php?mios=1');
}

/** Sube la foto (ya comprimida con compressImage). Regresa { archivo, url }. */
export async function uploadLostPhoto(file) {
  const data = new FormData();
  data.append('foto', file, file.name || 'foto.jpg');
  return request('perdidos.php?accion=foto', { method: 'POST', body: data, timeout: MAIL_TIMEOUT_MS });
}

/** Publica. datos = { tipo, titulo, descripcion, categoria, edificio, lugar, entrega, fecha, foto, mostrarCorreo } */
export async function publishLostItem(datos) {
  return sendJson('perdidos.php', { accion: 'publicar', ...datos });
}

/** "Ya lo encontré" / "Ya se entregó". */
export async function resolveLostItem(id) {
  return sendJson('perdidos.php', { accion: 'resolver', id });
}

/** motivo: falso | ofensivo | spam | datos | otro */
export async function reportLostItem(id, motivo) {
  return sendJson('perdidos.php', { accion: 'reportar', id, motivo });
}

export async function deleteLostItem(id) {
  return sendJson('perdidos.php', { id }, 'DELETE');
}

/** Panel: todo (también lo oculto), con número de reportes. */
export async function getLostPanel() {
  return request('perdidos.php?panel=1');
}

/** Panel: estado = 'activo' (volver a mostrar) | 'oculto'. */
export async function moderateLostItem(id, estado) {
  return sendJson('perdidos.php', { accion: 'moderar', id, estado });
}

// -----------------------------------------------------------------------
// Calendario del grupo (exámenes y entregas), consejales y encuadres (Alexis).
// Ver api/calendario.php y docs/calendario-calificaciones.md.
//   fecha    = { id, grupo, tipo, materia, titulo, detalle, fecha, hora, por, creadoEn, editadoEn }
//   encuadre = { materia, criterios: [{ nombre, porcentaje }], asistenciaMin, actualizadoEn, por }
// -----------------------------------------------------------------------

/**
 * Calendario de un grupo: { fechas, encuadres, consejales, puedoPublicar, miRol, offline? }.
 * Sin internet regresa lo último que se descargó en este celular (offline: true).
 */
export async function getGroupCalendar(grupo) {
  const key = `polimap.calendario.${grupo}`;
  try {
    const data = await request(`calendario.php?grupo=${encodeURIComponent(grupo)}`);
    writeLocal(key, data);
    return data;
  } catch (error) {
    if (error.fromApi) throw error;
    const guardado = readLocal(key, null);
    if (guardado) return { ...guardado, offline: true, puedoPublicar: false };
    throw error;
  }
}

/** Grupos donde soy consejal o subconsejal: { grupos: [{ grupo, rol }] }. */
export async function getMyCouncilGroups() {
  return request('calendario.php?mios=1');
}

// -----------------------------------------------------------------------
// Avisos del grupo (panel de consejal). Ver api/avisos.php.
//   aviso = { title, content, type, endDate, allowComments, poll?, notify }
// -----------------------------------------------------------------------

/** { avisos: [...], suscritos } — avisos del grupo, también vencidos. */
export async function getGroupNotices(grupo) {
  return request(`avisos.php?grupo_panel=${encodeURIComponent(grupo)}`);
}

/** Publica un aviso solo para el grupo. Regresa { ok, id, aviso, push }. */
export async function publishGroupNotice(grupo, aviso) {
  return sendJson('avisos.php', { accion: 'grupo_publicar', grupo, ...aviso }, 'POST', MAIL_TIMEOUT_MS);
}

export async function deleteGroupNotice(id) {
  return sendJson('avisos.php', { accion: 'grupo_borrar', id });
}

/** Crea (sin id) o edita una fecha. datos = { id?, grupo, tipo, materia, titulo, detalle, fecha, hora, notificar } */
export async function saveGroupDate(datos) {
  return sendJson('calendario.php', { accion: 'fecha', ...datos }, 'POST', MAIL_TIMEOUT_MS);
}

export async function deleteGroupDate(id) {
  return sendJson('calendario.php', { accion: 'borrar', id });
}

/** Consejal: sube el encuadre de una materia (criterios vacío = quitarlo). */
export async function saveGroupFraming(grupo, materia, criterios, asistenciaMin = 80) {
  return sendJson('calendario.php', { accion: 'encuadre', grupo, materia, criterios, asistenciaMin });
}

/** Panel: { consejales: [{ grupo, correo, rol, nombre, foto, entro }] }. */
export async function getCouncilors() {
  return request('calendario.php?consejales=1');
}

/**
 * Panel: rol = 'consejal' | 'subconsejal' (cada grupo tiene un dueto: uno de cada).
 * Si el lugar ya está ocupado lanza un error con status 409 y error.data.ocupado;
 * para reemplazar a esa persona se vuelve a llamar con reemplazar = true.
 */
export async function assignCouncilor(grupo, correo, rol = 'consejal', reemplazar = false) {
  return sendJson('calendario.php', { accion: 'asignar', grupo, correo, rol, reemplazar });
}

export async function removeCouncilor(grupo, correo) {
  return sendJson('calendario.php', { accion: 'quitar', grupo, correo });
}
