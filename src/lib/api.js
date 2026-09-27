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

// Claves de localStorage (solo en este celular/navegador).
const LOCAL_REPORTS_KEY = 'polimap.reportes.locales';
const MY_FOLIOS_KEY = 'polimap.misFolios';

// -----------------------------------------------------------------------
// Utilidades internas
// -----------------------------------------------------------------------

/** fetch con tiempo límite; regresa el JSON o lanza error. */
async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/${path}`, { ...options, signal: controller.signal });
    // Si /api no existe, Vite o el hosting pueden regresar index.html: eso no es JSON.
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    if (!isJson) throw new Error('La API no respondió con JSON');
    const data = await response.json();
    if (!response.ok) {
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

/** Guarda el folio en "Mis reportes" de este dispositivo. */
function rememberFolio(folio) {
  const folios = readLocal(MY_FOLIOS_KEY, []);
  if (!folios.includes(folio)) writeLocal(MY_FOLIOS_KEY, [folio, ...folios]);
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
    const result = await request('reportes.php', { method: 'POST', body: formData });
    rememberFolio(result.folio);
    return result;
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
 * "Mis reportes": los enviados desde este dispositivo.
 * Junta los que están en el servidor (por folio) con los guardados sin conexión.
 */
export async function getReports() {
  const locales = readLocal(LOCAL_REPORTS_KEY, []);
  const folios = readLocal(MY_FOLIOS_KEY, []);
  if (folios.length === 0) return locales;

  try {
    const remotos = await request(`reportes.php?folios=${encodeURIComponent(folios.join(','))}`);
    return [...locales, ...remotos];
  } catch (error) {
    console.warn('[api] getReports: solo reportes locales.', error.message);
    return locales;
  }
}
