// src/lib/asistenteHorario.js — Responsable: Alexis (se conecta al asistente de Gabo)
// =====================================================================
// Preguntas del asistente que se contestan con los HORARIOS oficiales:
//
//   1. ¿Dónde está un maestro?
//        "¿dónde está el profe Cisneros?"            → ahora
//        "busco a García de la Cadena a las 12"       → hoy a las 12:00
//        "maestra Martha mañana a las 10"             → mañana 10:00
//        "¿qué clases tiene Velázquez Tornero el jueves?" → todo el jueves
//      Contesta en qué salón está (o su siguiente clase) y el botón
//      "Ver en el mapa" del edificio.
//
//   2. ¿Qué salones están libres? (ahora o a cierta hora)
//
// Uso (lo hace assistantBot.js antes de las preguntas frecuentes):
//   const r = respuestaHorario('donde esta cisneros ahora', { buildings });
//   if (r) return r;   // null = no era pregunta de horarios
// =====================================================================
import {
  DIAS,
  MAESTROS,
  aHora,
  aMinutos,
  buscarMaestros,
  dondeEsta,
  duracion,
  infoSalon,
  materiaBonita,
  momento,
  nombreBonito,
  salonesLibres,
  sinAcentos,
} from './horario.js';

const DIAS_SEMANA = [...DIAS, 'Domingo'];
const PALABRA_MAESTRO = /\b(profe|profes|profesor|profesora|maestro|maestra|maestros|miss|teacher|prof|mtro|mtra)\b/;
const PALABRA_BUSCAR = /\b(donde esta|donde anda|donde da|donde se encuentra|busco|buscar|encontrar|encuentro|localizar|que clase tiene|que clases tiene|horario de|en que salon)\b/;
const PALABRA_LIBRES = /\b(salon|salones|aula|aulas|lab|labs|laboratorio|laboratorios)\b.*\b(libre|libres|vacio|vacios|vacia|vacias|disponible|disponibles|desocupad\w*|sin clase)\b|\bdonde (puedo|podemos) estudiar\b/;

// ---------------------------------------------------------------------
// Día y hora de la pregunta
// ---------------------------------------------------------------------

/**
 * Lee el día y la hora de la pregunta.
 * → { dia, minuto (o null = todo el día), esAhora, texto: 'ahora (martes 10:15)' | 'el martes a las 10:00' }
 */
export function leerMomento(pregunta, fecha = new Date()) {
  const base = momento(fecha);
  const t = String(pregunta).toLowerCase();
  const n = sinAcentos(pregunta);

  // Día
  let indice = base.indice;
  let diaDicho = false;
  const nombre = DIAS_SEMANA.findIndex((d) => new RegExp(`\\b${sinAcentos(d)}\\b`).test(n));
  if (nombre >= 0) {
    indice = nombre;
    diaDicho = true;
  } else if (/\bpasado manana\b/.test(n)) {
    indice = (base.indice + 2) % 7;
    diaDicho = true;
  } else if (/\bmanana\b/.test(n) && !/\b(la|por la|en la|de la) manana\b/.test(n)) {
    indice = (base.indice + 1) % 7;
    diaDicho = true;
  }

  // Hora
  let minuto = null;
  const m =
    /(\d{1,2}):(\d{2})/.exec(t) ??
    /\ba las? (\d{1,2})(?:\s?y\s?(media|cuarto))?\b/.exec(n) ??
    /\b(\d{1,2})\s?(?:am|pm|a m|p m|hrs|hr|h)\b/.exec(n) ??
    /\b(\d{1,2}) de la (?:manana|tarde|noche)\b/.exec(n);
  if (m) {
    let h = Number(m[1]);
    let min = m[2] === 'media' ? 30 : m[2] === 'cuarto' ? 15 : Number(m[2]) || 0;
    const pm = /\b(pm|p m|de la tarde|de la noche)\b/.test(n);
    const am = /\b(am|a m|de la manana)\b/.test(n);
    if (pm && h < 12) h += 12;
    else if (!am && h >= 1 && h <= 6) h += 12; // "a las 3" en la escuela = 15:00
    if (h <= 23 && min <= 59) minuto = h * 60 + min;
  }
  const esAhora = minuto === null && (!diaDicho || indice === base.indice) && (/\b(ahora|ahorita|orita|en este momento|ya)\b/.test(n) || !diaDicho);
  if (esAhora) minuto = base.minuto;

  const dia = DIAS_SEMANA[indice];
  // "hoy", "mañana" o "el jueves" (para armar frases y sugerencias)
  const textoDia = indice === base.indice ? 'hoy' : indice === (base.indice + 1) % 7 ? 'mañana' : `el ${dia.toLowerCase()}`;
  let texto;
  if (esAhora) texto = `ahora (${dia.toLowerCase()} ${aHora(base.minuto)})`;
  else {
    texto = minuto === null ? textoDia : `${textoDia} a las ${aHora(minuto)}`;
  }
  return { dia, minuto, esAhora, texto, textoDia };
}

// ---------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------

/** Nombre corto pero único: "CISNEROS ABUNDIZ" en vez del nombre completo. */
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);
function nombreCorto(maestro) {
  const w = maestro.nombre.split(' ');
  for (let k = 2; k <= w.length; k += 1) {
    if (PARTICULAS.has(w[k - 1])) continue; // no cortar en "GARCIA DE"
    const prefijo = w.slice(0, k).join(' ');
    if (MAESTROS.filter((m) => m.nombre.startsWith(`${prefijo} `) || m.nombre === prefijo).length === 1) return prefijo;
  }
  return maestro.nombre;
}

function lugar(sesion) {
  const i = infoSalon(sesion.room);
  return i.edificio ? `${sesion.room} (Edificio ${i.edificio}${/piso|planta/.test(i.ubicacion) ? `, ${i.ubicacion.replace(/^.*\(|\)$/g, '')}` : ''})` : sesion.room;
}

function edificioDe(sesion, buildings) {
  const n = sesion ? infoSalon(sesion.room).edificio : null;
  const b = n ? buildings.find((x) => Number(x.number) === n) : null;
  return b ? { number: b.number, name: b.name && !/^Edificio \d+$/.test(b.name) ? `Edificio ${b.number} · ${b.name}` : `Edificio ${b.number}` } : n ? { number: n, name: `Edificio ${n}` } : null;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Regresa la respuesta del asistente o null si la pregunta no es de horarios.
 * Misma forma que answerQuestion(): { text, building, tab, suggestions, kind }
 */
export function respuestaHorario(pregunta, { buildings = [], fecha = new Date() } = {}) {
  const n = sinAcentos(pregunta);
  if (!n) return null;

  // 2. Salones libres
  if (PALABRA_LIBRES.test(n)) return respuestaLibres(pregunta, fecha);

  // 1. Maestros
  const tienePalabra = PALABRA_MAESTRO.test(n);
  const resultados = buscarMaestros(pregunta);
  const mejor = resultados[0];
  if (!mejor) {
    // "¿dónde está el profe?" sin nombre → pedir el nombre
    if (tienePalabra && PALABRA_BUSCAR.test(n) && n.split(' ').length <= 6) {
      return {
        text: 'Dime el nombre o el apellido del maestro y a qué hora lo buscas. Por ejemplo: "¿Dónde está el profe Cisneros ahora?" o "maestra García de la Cadena el martes a las 12".',
        building: null,
        tab: null,
        suggestions: ['¿Dónde está el profe Cisneros ahora?', '¿Qué salones están libres?'],
        kind: 'maestro',
      };
    }
    return null;
  }
  // Sin "profe/maestro" en la pregunta se pide más seguridad (2 palabras del nombre),
  // para no confundir "¿dónde está la biblioteca?" con un apellido.
  // Con "profe/maestra": basta un apellido (aunque esté mal escrito).
  // Sin eso: TODAS las palabras deben ser del nombre y al menos una exacta.
  const seguro = tienePalabra ? mejor.puntos >= 0.8 : mejor.exactas >= 1 && mejor.coinciden === mejor.total;
  if (!seguro) return null;

  const cuando = leerMomento(pregunta, fecha);
  const empatados = resultados.filter((r) => r.puntos >= mejor.puntos - 0.01 && r.coinciden === mejor.coinciden);

  if (empatados.length > 1) {
    const opciones = empatados.slice(0, 6).map((r) => r.maestro);
    const extra = cuando.esAhora ? 'ahora' : cuando.texto.replace(/^hoy /, '');
    return {
      text: `Encontré ${plural(empatados.length, 'maestro', 'maestros')} con ese nombre${empatados.length > 6 ? ' (te muestro 6)' : ''}. ¿A cuál buscas?`,
      building: null,
      tab: null,
      suggestions: opciones.map((m) => `¿Dónde está ${nombreBonito(nombreCorto(m))} ${extra}?`),
      suggestionsTitle: 'Elige uno:',
      kind: 'maestro',
    };
  }

  return respuestaMaestro(mejor.maestro, cuando, buildings);
}

function respuestaMaestro(maestro, cuando, buildings) {
  const nombre = nombreBonito(maestro.nombre);
  const corto = nombreBonito(nombreCorto(maestro));
  const diasQueDa = DIAS.filter((d) => maestro.clases.some((c) => c.day === d));
  const sugerencias = [];

  // Fin de semana o día sin clases
  const delDia = maestro.clases.filter((c) => c.day === cuando.dia).sort((a, b) => aMinutos(a.start) - aMinutos(b.start));
  if (!delDia.length) {
    const proximoDia = diasQueDa.find((d) => DIAS.indexOf(d) > DIAS.indexOf(cuando.dia)) ?? diasQueDa[0];
    const primera = proximoDia ? maestro.clases.filter((c) => c.day === proximoDia).sort((a, b) => aMinutos(a.start) - aMinutos(b.start))[0] : null;
    if (proximoDia) sugerencias.push(`¿Dónde está ${corto} el ${proximoDia.toLowerCase()}?`);
    return {
      text:
        `${nombre} no tiene clases ${cuando.esAhora ? 'hoy' : cuando.texto.replace(/ a las .*/, '')}` +
        (cuando.dia === 'Sábado' || cuando.dia === 'Domingo' ? ' (es fin de semana).' : '.') +
        (diasQueDa.length ? ` Da clases los ${diasQueDa.map((d) => d.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : '') +
        (primera ? ` El ${proximoDia.toLowerCase()} empieza a las ${primera.start} en ${lugar(primera)}.` : ''),
      building: edificioDe(primera, buildings),
      tab: null,
      suggestions: sugerencias,
      kind: 'maestro',
    };
  }

  // Todo el día (dijo el día pero no la hora)
  if (cuando.minuto === null) {
    const lineas = delDia.map((c) => `• ${c.start}–${aHora(aMinutos(c.end))} ${materiaBonita(c.subject)} · ${c.grupo} · ${c.room}`);
    return {
      text: `${cuando.texto.charAt(0).toUpperCase()}${cuando.texto.slice(1)} ${nombre} tiene ${plural(delDia.length, 'clase', 'clases')}:\n${lineas.join('\n')}`,
      building: edificioDe(delDia[0], buildings),
      tab: null,
      suggestions: [`¿Dónde está ${corto} ahora?`],
      kind: 'maestro',
    };
  }

  const d = dondeEsta(maestro, cuando.dia, cuando.minuto);
  const Cuando = `${cuando.texto.charAt(0).toUpperCase()}${cuando.texto.slice(1)}`;

  if (d.actual.length) {
    const c = d.actual[0];
    const grupos = [...new Set(d.actual.map((x) => x.grupo))].join(' y ');
    // El asistente no recuerda la plática: cada sugerencia lleva el nombre y el día.
    if (d.siguiente) sugerencias.push(`¿Dónde está ${corto} ${cuando.textoDia} a las ${d.siguiente.start}?`);
    sugerencias.push(`¿Qué clases tiene ${corto} ${cuando.textoDia}?`);
    return {
      text:
        `${Cuando} ${nombre} está en ${lugar(c)}, dando ${materiaBonita(c.subject)} a ${grupos} hasta las ${aHora(aMinutos(c.end))}.` +
        (d.siguiente ? ` Después: ${d.siguiente.start} en ${d.siguiente.room}.` : ' Es su última clase del día.'),
      building: edificioDe(c, buildings),
      tab: null,
      suggestions: sugerencias,
      kind: 'maestro',
    };
  }

  let texto = `${Cuando} ${nombre} no está dando clase.`;
  let referencia = null;
  if (d.siguiente) {
    const faltan = aMinutos(d.siguiente.start) - cuando.minuto;
    texto += ` Su siguiente clase es a las ${d.siguiente.start}${cuando.esAhora ? ` (en ${duracion(faltan)})` : ''}: ${materiaBonita(d.siguiente.subject)} con ${d.siguiente.grupo} en ${lugar(d.siguiente)}.`;
    referencia = d.siguiente;
  } else if (d.anterior) {
    texto += ` Ya terminó: su última clase fue hasta las ${aHora(aMinutos(d.anterior.end))} en ${lugar(d.anterior)}.`;
    referencia = d.anterior;
  }
  if (d.anterior && d.siguiente) texto += ` Antes estuvo en ${d.anterior.room} hasta las ${aHora(aMinutos(d.anterior.end))}.`;
  if (d.siguiente && !cuando.esAhora) sugerencias.push(`¿Dónde está ${corto} ${cuando.textoDia} a las ${d.siguiente.start}?`);
  sugerencias.push(`¿Qué clases tiene ${corto} ${cuando.textoDia}?`);
  return { text: texto, building: edificioDe(referencia, buildings), tab: null, suggestions: sugerencias, kind: 'maestro' };
}

function respuestaLibres(pregunta, fecha) {
  const cuando = leerMomento(pregunta, fecha);
  if (cuando.dia === 'Sábado' || cuando.dia === 'Domingo' || cuando.minuto === null || cuando.minuto < 7 * 60 || cuando.minuto >= 20 * 60) {
    return {
      text: `${cuando.esAhora ? 'Ahorita' : 'A esa hora'} no hay clases (son de lunes a viernes, de 7:00 a 20:00). Pregúntame por un día y hora, por ejemplo: "salones libres el martes a las 11".`,
      building: null,
      tab: 'horario',
      suggestions: ['¿Qué salones están libres el lunes a las 10?'],
      kind: 'libres',
    };
  }
  const lista = salonesLibres(cuando.dia, cuando.minuto).filter((e) => e.edificio && e.libres.length);
  const total = lista.reduce((k, e) => k + e.libres.length, 0);
  const lineas = lista.map(
    (e) =>
      `• Edificio ${e.edificio}: ${e.libres
        .slice(0, 5)
        .map((l) => `${l.salon.replace(/^(Aula|Lab\.|Taller) E\d+-/, '')}${l.hasta ? ` (hasta ${aHora(l.hasta)})` : ''}`)
        .join(', ')}${e.libres.length > 5 ? '…' : ''}`
  );
  return {
    text: total
      ? `${cuando.texto.charAt(0).toUpperCase()}${cuando.texto.slice(1)} hay ${plural(total, 'salón libre', 'salones libres')} según los horarios:\n${lineas.join('\n')}\nEn Mi horario → Más puedes ver todos y tocarlos para ir al mapa.`
      : `${cuando.texto.charAt(0).toUpperCase()}${cuando.texto.slice(1)} todos los salones están ocupados según los horarios.`,
    building: null,
    tab: 'horario',
    suggestions: [],
    kind: 'libres',
  };
}
