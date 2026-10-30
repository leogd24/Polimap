// src/lib/ambiente.js — Responsable: Alexis
// =====================================================================
// AMBIENTE DEL ESQUEMA: hora del día, sol, luna y clima del Poli.
// (Es solo un plus visual del esquema del edificio en el panel.)
//
//   - La hora es SIEMPRE la del Poli (Zapopan, Jalisco), aunque abras el panel desde
//     otro lugar.
//   - El amanecer y el atardecer se calculan aquí mismo con la fórmula
//     de la NOAA para las coordenadas del Poli: no necesita internet.
//   - El clima sale de Open-Meteo (gratis y sin llave), pedido desde
//     getWeather() en src/lib/api.js. Si no hay internet, se ve despejado.
//
// calcularAmbiente() regresa números de 0 a 1 que el dibujo usa para
// mezclar colores: luz del día, tono naranja del amanecer/atardecer,
// luces prendidas, estrellas, nubes, lluvia…
// =====================================================================

// Poli en Zapopan (centro del campus, el mismo de CampusMap.jsx)
const LAT = 20.7465;
const LNG = -103.3798;
// Zapopan usa la hora del centro de México (UTC-6, sin horario de verano desde 2022).
// Por eso la zona se llama "Mexico_City" aunque el Poli esté en Zapopan.
const ZONA = 'America/Mexico_City';

// ---------------------------------------------------------------------
// 1) Hora del Poli (Zapopan)
// ---------------------------------------------------------------------

/** { minutos (desde medianoche), diaDelAño, texto "17:42" } en hora del Poli. */
export function horaPoli(fecha = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value])
  );
  const h = Number(partes.hour) % 24;
  const m = Number(partes.minute);
  const inicioAño = Date.UTC(Number(partes.year), 0, 1);
  const hoy = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day));
  return {
    minutos: h * 60 + m,
    diaDelAño: Math.round((hoy - inicioAño) / 86400000) + 1,
    texto: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}

// ---------------------------------------------------------------------
// 2) Amanecer y atardecer (NOAA, precisión de ±2 minutos)
// ---------------------------------------------------------------------
const rad = (g) => (g * Math.PI) / 180;
const grados = (r) => (r * 180) / Math.PI;

/** { amanecer, atardecer } en minutos desde la medianoche, en el Poli (Zapopan). */
export function solDelDia(diaDelAño) {
  const g = ((2 * Math.PI) / 365) * (diaDelAño - 1);
  const ecuacion =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const declinacion =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const angulo = grados(
    Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(LAT)) * Math.cos(declinacion)) - Math.tan(rad(LAT)) * Math.tan(declinacion))
  );
  const utcAmanecer = 720 - 4 * (LNG + angulo) - ecuacion;
  const utcAtardecer = 720 - 4 * (LNG - angulo) - ecuacion;
  const desfase = -6 * 60; // UTC-6
  return { amanecer: utcAmanecer + desfase, atardecer: utcAtardecer + desfase };
}

// ---------------------------------------------------------------------
// 3) Clima: códigos WMO de Open-Meteo → algo que se pueda dibujar
// ---------------------------------------------------------------------
export const CLIMAS = {
  despejado: { label: 'Despejado', icon: 'clear_day', iconNoche: 'bedtime', nubes: 0, gris: 0, lluvia: 0, tormenta: false, niebla: 0 },
  nubes: { label: 'Algo nublado', icon: 'partly_cloudy_day', iconNoche: 'partly_cloudy_night', nubes: 0.45, gris: 0.1, lluvia: 0, tormenta: false, niebla: 0 },
  nublado: { label: 'Nublado', icon: 'cloud', nubes: 1, gris: 0.45, lluvia: 0, tormenta: false, niebla: 0 },
  niebla: { label: 'Niebla', icon: 'foggy', nubes: 0.6, gris: 0.35, lluvia: 0, tormenta: false, niebla: 0.55 },
  llovizna: { label: 'Llovizna', icon: 'rainy_light', nubes: 0.9, gris: 0.45, lluvia: 0.4, tormenta: false, niebla: 0.1 },
  lluvia: { label: 'Lluvia', icon: 'rainy', nubes: 1, gris: 0.6, lluvia: 1, tormenta: false, niebla: 0.15 },
  tormenta: { label: 'Tormenta', icon: 'thunderstorm', nubes: 1, gris: 0.75, lluvia: 1, tormenta: true, niebla: 0.15 },
};

/** Código WMO (0–99) → clave de CLIMAS. */
export function climaDeCodigo(codigo) {
  const c = Number(codigo);
  if (c === 0) return 'despejado';
  if (c === 1 || c === 2) return 'nubes';
  if (c === 3) return 'nublado';
  if (c === 45 || c === 48) return 'niebla';
  if (c >= 51 && c <= 57) return 'llovizna';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'lluvia';
  if (c >= 71 && c <= 77) return 'nublado'; // nieve: en Zapopan casi nunca; la dibujamos nublado
  if (c >= 85 && c <= 86) return 'nublado';
  if (c >= 95) return 'tormenta';
  return 'despejado';
}

// ---------------------------------------------------------------------
// 4) Para la vista previa del panel (exposición): forzar hora o clima
// ---------------------------------------------------------------------
export const MOMENTOS = [
  { key: 'auto', label: 'Ahora', icon: 'schedule' },
  { key: 'amanecer', label: 'Amanecer', icon: 'wb_twilight' },
  { key: 'dia', label: 'Día', icon: 'light_mode' },
  { key: 'tarde', label: 'Tarde', icon: 'wb_sunny' },
  { key: 'noche', label: 'Noche', icon: 'dark_mode' },
];

function minutosDeMomento(momento, sol, real) {
  if (momento === 'amanecer') return sol.amanecer + 5;
  if (momento === 'dia') return 13 * 60;
  if (momento === 'tarde') return sol.atardecer - 35;
  if (momento === 'noche') return 20 * 60 + 30; // todavía hay clases: salones prendidos
  return real;
}

// ---------------------------------------------------------------------
// 5) Todo junto
// ---------------------------------------------------------------------
const limitar = (v) => Math.max(0, Math.min(1, v));
/** Curva suave 0 → 1 (para que nada cambie de golpe). */
const suave = (v) => {
  const t = limitar(v);
  return t * t * (3 - 2 * t);
};

/**
 * Ambiente del dibujo.
 *   fecha   → Date (normalmente ahora)
 *   clima   → clave de CLIMAS (o null = despejado)
 *   momento → 'auto' | 'amanecer' | 'dia' | 'tarde' | 'noche'
 *
 * Regresa:
 *   luz       0 noche … 1 pleno día
 *   calido    0 … 1 tono naranja (amanecer / atardecer)
 *   luces     0 … 1 focos de los salones y del poste
 *   estrellas 0 … 1
 *   sol, luna { x: 0…1 (izquierda→derecha), alto: 0…1 } o null si no se ven
 *   fase      'noche' | 'amanecer' | 'dia' | 'tarde' | 'atardecer'
 *   + todo lo del clima (nubes, gris, lluvia, tormenta, niebla)
 */
export function calcularAmbiente({ fecha = new Date(), clima = null, momento = 'auto' } = {}) {
  const hora = horaPoli(fecha);
  const sol = solDelDia(hora.diaDelAño);
  const m = minutosDeMomento(momento, sol, hora.minutos);
  const c = CLIMAS[clima] ?? CLIMAS.despejado;

  // Luz: sube 40 min antes del amanecer y baja hasta 40 min después del atardecer.
  const subida = suave((m - (sol.amanecer - 40)) / 80);
  const bajada = suave((sol.atardecer + 40 - m) / 80);
  let luz = Math.min(subida, bajada);
  // Tono cálido: alrededor del amanecer y del atardecer (≈ 1 h).
  const cercania = Math.min(Math.abs(m - sol.amanecer), Math.abs(m - sol.atardecer));
  let calido = limitar(1 - cercania / 75) * (1 - c.gris * 0.8);
  // Con nubes pesadas hay menos luz.
  luz *= 1 - c.gris * 0.35;

  // Sol: recorre el cielo de izquierda (amanecer) a derecha (atardecer).
  const p = (m - sol.amanecer) / (sol.atardecer - sol.amanecer);
  const solVisible = p > -0.03 && p < 1.03 && c.gris < 0.55;
  // Luna: de noche, de izquierda a derecha también.
  const largoNoche = 1440 - (sol.atardecer - sol.amanecer);
  const pn = (((m - sol.atardecer + 1440) % 1440) / largoNoche);
  const lunaVisible = pn > 0 && pn < 1 && c.gris < 0.55;

  let fase = 'noche';
  if (luz > 0.05) fase = m < (sol.amanecer + sol.atardecer) / 2 ? (calido > 0.35 ? 'amanecer' : 'dia') : calido > 0.35 ? 'atardecer' : 'tarde';
  if (fase === 'dia' && m > 12 * 60 + 30) fase = 'tarde';

  return {
    ...c,
    clima: CLIMAS[clima] ? clima : 'despejado',
    hora: momento === 'auto' ? hora.texto : textoMinutos(m),
    amanecer: textoMinutos(sol.amanecer),
    atardecer: textoMinutos(sol.atardecer),
    luz,
    calido,
    // Focos: se prenden cuando ya casi no hay luz (o con tormenta).
    luces: limitar((0.55 - luz) / 0.35 + (c.tormenta ? 0.4 : 0)),
    estrellas: limitar(1 - luz * 2.2) * (1 - c.nubes * 0.85),
    sol: solVisible ? { x: limitar(p), alto: Math.sin(Math.PI * limitar(p)) } : null,
    luna: lunaVisible ? { x: pn, alto: Math.sin(Math.PI * pn) } : null,
    fase,
    // ¿Hay clases? (6:30 a 22:00). Fuera de ese horario casi todo está apagado.
    ocupado: m >= 390 && m <= 1320,
    icono: luz < 0.3 && c.iconNoche ? c.iconNoche : c.icon,
  };
}

function textoMinutos(min) {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
