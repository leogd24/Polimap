// src/lib/clima.js — Responsable: Alexis
// "¿Llevo paraguas?" para Inicio: cruza el pronóstico por hora de Zapopan
// (getWeather() en api.js, Open-Meteo) con las horas en que el alumno está en
// el Poli (su horario). Sin grupo elegido se usa de 7:00 a 20:00.
//
//   consejoClima(clima, { fecha: '2026-10-27', minuto: 615, desde: 480, hasta: 840 })
//   → { icon, titulo: 'Lleva paraguas', texto: 'Hay 70 % de lluvia a las 15:00 y sales a las 14:00.', tono: 'lluvia' }
import { CLIMAS, climaDeCodigo } from './ambiente.js';
import { aHora } from './horario.js';

const UMBRAL = 50; // % de probabilidad para considerar que "llueve"

const hh = (min) => aHora(min).replace(/^0/, '');

export function consejoClima(clima, { fecha, minuto, desde = 7 * 60, hasta = 20 * 60 }) {
  if (!clima) return null;
  const actual = CLIMAS[climaDeCodigo(clima.codigo)];
  const base = { temperatura: clima.temperatura, cielo: actual.label, cieloIcon: actual.icon, icon: actual.icon };

  // Horas de hoy que faltan (desde la hora actual).
  const hoy = (clima.horas ?? [])
    .filter((h) => h.hora.startsWith(fecha))
    .map((h) => ({ ...h, minuto: Number(h.hora.slice(11, 13)) * 60 }))
    .filter((h) => h.minuto + 59 >= minuto);
  const lluvias = hoy.filter((h) => h.lluvia >= UMBRAL || climaDeCodigo(h.codigo) === 'lluvia' || climaDeCodigo(h.codigo) === 'tormenta');
  const max = hoy.reduce((m, h) => Math.max(m, h.lluvia), 0);

  if (!hoy.length) return { ...base, tono: 'normal', titulo: actual.label, texto: '' };

  // ¿Llueve ahorita?
  if (climaDeCodigo(clima.codigo) === 'lluvia' || climaDeCodigo(clima.codigo) === 'tormenta') {
    return { ...base, tono: 'lluvia', icon: 'umbrella', titulo: 'Está lloviendo', texto: 'Lleva paraguas y ve con cuidado en las escaleras.' };
  }
  if (!lluvias.length) {
    return {
      ...base,
      tono: 'normal',
      titulo: 'Sin lluvia hoy',
      texto: max >= 25 ? `Poca probabilidad de lluvia (hasta ${max} %).` : 'No hace falta paraguas.',
    };
  }

  const primera = lluvias[0];
  const durante = lluvias.find((h) => h.minuto + 60 > desde && h.minuto < hasta);
  if (durante) {
    const saliendo = minuto < hasta;
    return {
      ...base,
      tono: 'lluvia',
      icon: 'umbrella',
      titulo: 'Lleva paraguas',
      texto:
        `${durante.lluvia} % de lluvia a las ${hh(durante.minuto)}` +
        (saliendo && hasta > durante.minuto ? ` y sales a las ${hh(hasta)}.` : '.'),
    };
  }
  if (primera.minuto >= hasta && minuto < hasta) {
    return {
      ...base,
      tono: 'aviso',
      icon: 'umbrella',
      titulo: 'Sal a tiempo',
      texto: `Llueve a las ${hh(primera.minuto)} y sales a las ${hh(hasta)}: alcanzas a llegar, pero llévalo por si acaso.`,
    };
  }
  return { ...base, tono: 'aviso', icon: 'umbrella', titulo: 'Lluvia más tarde', texto: `${primera.lluvia} % de lluvia a las ${hh(primera.minuto)}.` };
}
