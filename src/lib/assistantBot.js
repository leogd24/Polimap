// src/lib/assistantBot.js — Responsable: Gabo
//
// "Cerebro" del asistente de POLIMAP. NO es inteligencia artificial:
// compara lo que escribe el alumno con las preguntas frecuentes
// (faqEntries / GET /api/faq.php), los edificios (campusBuildings /
// GET /api/edificios.php) y los salones de los horarios oficiales.
//
// Por eso SOLO puede contestar cosas del Poli: si la pregunta no se
// parece a nada de eso, responde que solo ayuda con temas del Poli.
//
// Uso (lo hace AssistantScreen.jsx):
//   const respuesta = answerQuestion('donde saco mi kardes', { faq, buildings });
//
// La respuesta siempre tiene esta forma:
//   {
//     text:        'texto de la burbuja del bot',
//     building:    { number, name } | null   → muestra "Ver en el mapa"
//     tab:         'horario' | 'reportar' | null → botón para ir a esa pestaña
//     suggestions: ['¿Dónde está Psicología?', ...] → botones de preguntas
//     kind:        'faq' | 'building' | 'room' | 'maestro' | 'libres' | 'smalltalk' | 'offtopic'
//   }

import { allSchedules } from '../data/schedules.js';
import { respuestaHorario } from './asistenteHorario.js';

// ---------------------------------------------------------------------
// PASO 1. Ajustes (aquí se calibra qué tan "estricto" es el bot)
// ---------------------------------------------------------------------

// Puntos mínimos para considerar que una pregunta frecuente sí aplica.
// Una palabra clave exacta vale 3, así que con una sola ya contesta.
const MIN_SCORE = 3;

// "¿O buscabas…?": se ofrece la segunda opción si tiene al menos
// este porcentaje de los puntos de la primera.
const SECOND_RATIO = 0.75;

// Preguntas que se muestran como botones al inicio y cuando no entiende.
export const STARTER_SUGGESTIONS = [
  '¿Dónde saco mi kardex?',
  '¿Dónde está Psicología?',
  '¿Dónde pido prestado un cable HDMI?',
  '¿Cómo encuentro mi salón?',
  '¿Dónde está el profe Cisneros ahora?',
  '¿Qué salones están libres?',
];

// Palabras que no aportan significado ("dónde", "el", "mi"...).
// Se ignoran al comparar, para que "¿dónde está la biblioteca?" y
// "biblioteca" den el mismo resultado.
const STOPWORDS = new Set(
  (
    'a al algo alguien como con cual cuales cuando de del donde el ella en es esa ese eso esta estan ' +
    'este esto hay la las le lo los me mi mis necesito o para pido por puedo que quien quiero saco se ' +
    'si sin su sus tengo te tu un una uno unos y ya hacer hago pedir saber oye porfa porfavor favor ' +
    'ayudame dime encuentro encontrar queda ir llego llegar ubicado ubicada'
  ).split(' ')
);

// ---------------------------------------------------------------------
// PASO 2. Funciones de texto
// ---------------------------------------------------------------------

/** "¿Dónde está PSICOLOGÍA?" → "donde esta psicologia" (sin acentos ni signos). */
export function normalize(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (á → a, ñ → n)
    .replace(/[^a-z0-9]+/g, ' ') // signos y guiones → espacio
    .trim();
}

/** Palabras con significado de un texto ya normalizado. */
function meaningfulWords(normalizado) {
  return normalizado.split(' ').filter((w) => w && !STOPWORDS.has(w));
}

/** Cuántas letras hay que cambiar para pasar de una palabra a otra (Levenshtein). */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3; // muy distintas: ni calculamos
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = temp;
    }
  }
  return prev[b.length];
}

/**
 * ¿La palabra del alumno "se parece" a la palabra clave?
 * Regresa 3 si es idéntica, 2 si tiene una falta de ortografía, 0 si no.
 * Las palabras cortas (menos de 5 letras) deben ser exactas, para que
 * "red" no se confunda con "sed".
 */
function wordSimilarity(palabra, clave) {
  if (palabra === clave) return 3;
  // Singular / plural: "constancia" ↔ "constancias", "balon" ↔ "balones"
  if (palabra + 's' === clave || clave + 's' === palabra) return 3;
  if (palabra + 'es' === clave || clave + 'es' === palabra) return 3;
  if (palabra.length < 5 || clave.length < 5) return 0;
  const tolerancia = clave.length >= 8 ? 2 : 1;
  return editDistance(palabra, clave) <= tolerancia ? 2 : 0;
}

// ---------------------------------------------------------------------
// PASO 3. Salones de los horarios oficiales (Aula E6-A05, Lab. E8-L07…)
// ---------------------------------------------------------------------

// Se calcula UNA sola vez: { 6: { aulas: ['E6-A01', ...], labs: [...], talleres: [...] } }
let roomsCache = null;

function roomsByBuilding() {
  if (roomsCache) return roomsCache;
  roomsCache = {};
  for (const grupo of allSchedules) {
    for (const sesion of grupo.sessions ?? []) {
      const match = /E(\d{1,2})-([ALT])(\d{1,2})/i.exec(sesion.room ?? '');
      if (!match) continue;
      const numero = Number(match[1]);
      const clave = `E${numero}-${match[2].toUpperCase()}${match[3].padStart(2, '0')}`;
      const tipo = { A: 'aulas', L: 'labs', T: 'talleres' }[match[2].toUpperCase()];
      roomsCache[numero] ??= { aulas: new Set(), labs: new Set(), talleres: new Set() };
      roomsCache[numero][tipo].add(clave);
    }
  }
  // Sets → arreglos ordenados
  for (const numero of Object.keys(roomsCache)) {
    for (const tipo of ['aulas', 'labs', 'talleres']) {
      roomsCache[numero][tipo] = [...roomsCache[numero][tipo]].sort();
    }
  }
  return roomsCache;
}

/** "Aulas E6-A01 a E6-A11" / "Laboratorios E8-L07, E8-L08 y E8-L09". */
function describeRooms(numero) {
  const salones = roomsByBuilding()[numero];
  if (!salones) return '';
  const lista = (claves) =>
    claves.length > 3 ? `${claves[0]} a ${claves[claves.length - 1]}` : joinWithY(claves);
  const partes = [];
  if (salones.aulas.length) partes.push(`aulas ${lista(salones.aulas)}`);
  if (salones.labs.length) partes.push(`laboratorios ${lista(salones.labs)}`);
  if (salones.talleres.length) partes.push(`talleres ${lista(salones.talleres)}`);
  return partes.length ? `Según los horarios 2026B tiene ${joinWithY(partes)}.` : '';
}

function joinWithY(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * Busca una clave de salón en el texto: "E6-A05", "e6 a5", "lab E8-L07".
 * Regresa { numero, clave, tipo } o null.
 */
function findRoomCode(normalizado) {
  const match = /(?:^| )e ?(\d{1,2}) ?([alt]) ?(\d{1,2})(?: |$)/.exec(normalizado);
  if (!match) return null;
  const numero = Number(match[1]);
  const letra = match[2].toUpperCase();
  return {
    numero,
    clave: `E${numero}-${letra}${match[3].padStart(2, '0')}`,
    tipo: { A: 'aulas', L: 'labs', T: 'talleres' }[letra],
    nombreTipo: { A: 'aula', L: 'laboratorio', T: 'taller' }[letra],
  };
}

/** "edificio 6", "edif 6", "el 6" no; solo formas claras. Regresa el número o null. */
function findBuildingNumber(normalizado) {
  const match = /(?:^| )(?:edificio|edif|edi|modulo) ?(\d{1,2})(?: |$)/.exec(normalizado);
  if (match) return Number(match[1]);
  // "E6" suelto (sin letra de salón después)
  const corto = /(?:^| )e ?(\d{1,2})(?: |$)/.exec(normalizado);
  return corto ? Number(corto[1]) : null;
}

// ---------------------------------------------------------------------
// PASO 4. Saludos y frases de cortesía
// ---------------------------------------------------------------------

const SMALLTALK = [
  {
    test: /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|que onda|que tal|hey|saludos)( .*)?$/,
    maxWords: 2, // "hola, ¿quién ganó el partido?" NO es solo un saludo
    text: '¡Hola! Soy el asistente de POLIMAP. Pregúntame por trámites, servicios, edificios o salones del Poli.',
  },
  {
    test: /(^| )(gracias|grax|thanks|muchas gracias|te pasaste|excelente|perfecto)( |$)/,
    text: '¡Con gusto! Si tienes otra duda del Poli, aquí sigo.',
  },
  {
    test: /^(adios|bye|nos vemos|hasta luego|chao|ciao)( .*)?$/,
    text: '¡Nos vemos! Que te vaya bien en el Poli.',
  },
  {
    test: /(que puedes hacer|que sabes|en que me ayudas|como funcionas|quien eres|ayuda|help)/,
    text:
      'Puedo decirte dónde hacer trámites (kardex, constancias, bajas…), dónde están los servicios (Psicología, biblioteca, préstamo de equipo…), qué hay en cada edificio y en qué edificio está tu salón. Solo contesto temas del Poli.',
  },
];

// ---------------------------------------------------------------------
// PASO 5. Puntuar preguntas frecuentes
// ---------------------------------------------------------------------

/** Puntos de una pregunta frecuente contra lo que escribió el alumno. */
function scoreEntry(entry, normalizado, palabras) {
  let puntos = 0;
  const claves = (entry.keywords ?? []).map(normalize).filter(Boolean);

  // Frases ("control escolar"): deben aparecer completas. Valen más.
  for (const clave of claves.filter((c) => c.includes(' '))) {
    if (` ${normalizado} `.includes(` ${clave} `)) puntos += 3 + clave.split(' ').length;
  }

  // Palabras sueltas: cada palabra del alumno suma UNA vez, con la palabra
  // clave que más se le parezca (así "prestan" no cuenta doble por
  // parecerse a "prestan" y a "prestar").
  const sueltas = claves.filter((c) => !c.includes(' '));
  for (const palabra of palabras) {
    let mejor = 0;
    for (const clave of sueltas) mejor = Math.max(mejor, wordSimilarity(palabra, clave));
    puntos += mejor;
  }

  // Bonus pequeño por palabras que también están en la pregunta escrita.
  const palabrasPregunta = new Set(meaningfulWords(normalize(entry.question)));
  for (const palabra of palabras) {
    if (palabrasPregunta.has(palabra)) puntos += 1;
  }
  return puntos;
}

// ---------------------------------------------------------------------
// PASO 6. Buscar en los edificios (servicios, espacios y trámites)
// ---------------------------------------------------------------------

// Espacios demasiado generales para contestar con ellos.
const GENERIC_SPACES = new Set(['aulas', 'laboratorios']);

/** ¿Algún servicio, espacio o trámite de un edificio coincide? */
function searchBuildings(buildings, palabras) {
  let mejor = null;
  for (const building of buildings) {
    const items = [
      ...(building.services ?? []).map((name) => ({ name })),
      ...(building.spaces ?? []).map((name) => ({ name })),
      ...(building.procedures ?? []),
    ];
    for (const item of items) {
      const nombre = normalize(item.name);
      if (!nombre || GENERIC_SPACES.has(nombre)) continue;
      const clave = meaningfulWords(nombre).filter((w) => w.length >= 4);
      if (!clave.length) continue;
      // Todas las palabras importantes del servicio deben estar en la pregunta.
      const coinciden = clave.filter((c) => palabras.some((p) => wordSimilarity(p, c) > 0));
      if (coinciden.length !== clave.length) continue;
      const puntos = clave.length * 3;
      if (!mejor || puntos > mejor.puntos) mejor = { puntos, building, item };
    }
  }
  return mejor;
}

/** "Edificio 1 · Atención a alumnos" o solo "Edificio 4". */
function buildingLabel(building) {
  const nombre = building.name ?? '';
  return nombre && !/^edificio \d+$/i.test(nombre)
    ? `Edificio ${building.number} · ${nombre}`
    : `Edificio ${building.number}`;
}

/** Respuesta completa sobre un edificio: resumen, espacios y salones. */
function describeBuilding(building) {
  const partes = [];
  const lugares = [...new Set([...(building.services ?? []), ...(building.spaces ?? [])])].filter(
    (s) => !GENERIC_SPACES.has(normalize(s))
  );
  if (building.description) partes.push(building.description);
  else if (building.summary) partes.push(`${building.summary}.`);
  if (lugares.length && !building.description) partes.push(`Aquí encuentras: ${joinWithY(lugares)}.`);
  const salones = describeRooms(building.number);
  if (salones) partes.push(salones);
  if (!partes.length) {
    partes.push('Todavía no tengo información de lo que hay en este edificio, pero puedo mostrarte dónde está.');
  }
  return partes.join(' ');
}

// ---------------------------------------------------------------------
// PASO 7. Función principal
// ---------------------------------------------------------------------

/**
 * Contesta una pregunta. Nunca lanza error.
 * @param {string} pregunta lo que escribió el alumno
 * @param {{ faq: object[], buildings: object[] }} datos
 */
export function answerQuestion(pregunta, datos = {}) {
  try {
    return answerInner(pregunta, datos);
  } catch (error) {
    // Si algún dato viene mal de la API, el chat no se rompe.
    console.warn('[asistente]', error);
    return offTopic('Tuve un problema para buscar tu respuesta. Intenta de nuevo con otras palabras.');
  }
}

function answerInner(pregunta, { faq = [], buildings = [] }) {
  const normalizado = normalize(pregunta);
  const palabras = meaningfulWords(normalizado);
  const findBuilding = (n) => buildings.find((b) => Number(b.number) === Number(n)) ?? null;
  const mapTarget = (b) => (b ? { number: b.number, name: buildingLabel(b) } : null);

  if (!normalizado) return offTopic();

  // 7.1 ¿Empieza con un saludo? ("hola, ¿dónde está psicología?")
  // Primero se busca la pregunta; el saludo solo se contesta si no hay pregunta.
  const saludo = /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|que onda|que tal|hey)( |$)/.test(normalizado);
  const conSaludo = (respuesta) =>
    saludo && respuesta.kind !== 'offtopic' ? { ...respuesta, text: `¡Hola! ${respuesta.text}` } : respuesta;

  // 7.2 Clave de salón: "E6-A05", "lab e8 l07"
  const salon = findRoomCode(normalizado);
  if (salon) {
    const building = findBuilding(salon.numero);
    if (!building) return offTopic(`No conozco el edificio ${salon.numero}. El Poli tiene del 1 al 10.`);
    const existe = roomsByBuilding()[salon.numero]?.[salon.tipo]?.includes(salon.clave);
    return conSaludo({
      text: existe
        ? `El ${salon.nombreTipo} ${salon.clave} está en el edificio ${salon.numero}.`
        : `No encuentro el ${salon.nombreTipo} ${salon.clave} en los horarios 2026B, pero las claves "E${salon.numero}-…" son del edificio ${salon.numero}. Revisa que la clave esté bien escrita.`,
      building: mapTarget(building),
      tab: null,
      suggestions: [],
      kind: 'room',
    });
  }

  // 7.2b ¿Dónde está un maestro? / ¿Qué salones están libres? (horarios oficiales,
  // src/lib/asistenteHorario.js). null = no era de horarios y se sigue normal.
  const deHorario = respuestaHorario(pregunta, { buildings });
  if (deHorario) return conSaludo(deHorario);

  // 7.3 Preguntas frecuentes: la que tenga más puntos
  const ranking = faq
    .map((entry) => ({ entry, puntos: scoreEntry(entry, normalizado, palabras) }))
    .filter((r) => r.puntos >= MIN_SCORE)
    .sort((a, b) => b.puntos - a.puntos);

  // 7.4 ¿Preguntó por un edificio? ("¿qué hay en el edificio 9?")
  const numeroEdificio = findBuildingNumber(normalizado);
  if (numeroEdificio != null) {
    const building = findBuilding(numeroEdificio);
    if (!building) return offTopic(`No conozco el edificio ${numeroEdificio}. El Poli tiene del 1 al 10.`);
    // Si además preguntó algo concreto de ESE edificio, gana la pregunta frecuente.
    const concreta = ranking.find((r) => Number(r.entry.buildingNumber) === numeroEdificio && r.puntos >= MIN_SCORE + 1);
    if (!concreta) {
      return conSaludo({
        text: describeBuilding(building), // el nombre del edificio lo muestra la pantalla arriba
        building: mapTarget(building),
        tab: null,
        suggestions: [],
        kind: 'building',
      });
    }
  }

  if (ranking.length) {
    const [primera, segunda] = ranking;
    const entry = primera.entry;
    const building = entry.buildingNumber != null ? findBuilding(entry.buildingNumber) : null;
    const otra =
      segunda && segunda.puntos >= primera.puntos * SECOND_RATIO ? [segunda.entry.question] : [];
    return conSaludo({
      text: entry.answer, // el edificio lo muestra la pantalla con su botón
      building: mapTarget(building),
      tab: entry.category === 'horarios' ? 'horario' : /report/i.test(entry.question) ? 'reportar' : null,
      suggestions: otra,
      suggestionsTitle: otra.length ? '¿O buscabas…?' : null,
      kind: 'faq',
      entryId: entry.id ?? null,
    });
  }

  // 7.5 Último intento: servicios, espacios y trámites de los edificios
  const enEdificio = searchBuildings(buildings, palabras);
  if (enEdificio) {
    const { building, item } = enEdificio;
    const detalle = item.details ? ` ${item.details}` : '';
    return conSaludo({
      text: `${item.name}: está en el ${buildingLabel(building)}.${detalle}`,
      building: mapTarget(building),
      tab: null,
      suggestions: [],
      kind: 'building',
    });
  }

  // 7.6 Saludos, gracias, adiós, "¿qué puedes hacer?" (mensajes cortos)
  if (palabras.length <= 4) {
    const charla = SMALLTALK.find(
      (c) => c.test.test(normalizado) && palabras.length <= (c.maxWords ?? 4)
    );
    if (charla) {
      return { text: charla.text, building: null, tab: null, suggestions: STARTER_SUGGESTIONS, kind: 'smalltalk' };
    }
  }

  // 7.7 No es del Poli (o todavía no lo sabemos)
  return offTopic();
}

/** Respuesta cuando la pregunta no es del Poli o no la entendió. */
function offTopic(texto) {
  return {
    text:
      texto ??
      'Solo puedo ayudarte con temas del Poli: trámites, servicios, edificios y salones. Si tu duda es del Poli, intenta con otras palabras o prueba con alguna de estas:',
    building: null,
    tab: null,
    suggestions: STARTER_SUGGESTIONS,
    kind: 'offtopic',
  };
}
