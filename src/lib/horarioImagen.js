// src/lib/horarioImagen.js — Responsable: Alexis
// =====================================================================
// Dibuja el horario de la semana como IMAGEN (PNG), con el mismo acomodo
// que la hoja de la UdeG: horas a la izquierda, días arriba, cada clase con
// materia, maestro y "07-09hrs. Aula E4-A05".
//   - Normal: un color por materia.
//   - Consejal: colores de la división (Grupo 1, Grupo 2, mitad y mitad,
//     todo el grupo) y las clases canceladas tachadas con una X roja,
//     más la leyenda y los recordatorios.
// Sirve para "Descargar imagen" y "Compartir" (WhatsApp) sin sacar captura.
//
//   const blob = await imagenSemana({ grupo, colores, modos, semana, notas });
// =====================================================================
import { CICLO, aHora, aMinutos, clasesDelDia, diasConClases, llaveClase, maestrosDeClase, rangoHoras } from './horario.js';
import { hex, mezclar, tonoHex } from './temaHex.js';
import { MODOS } from './division.js';

const FUENTE = 'Arial, Helvetica, sans-serif';
const ANCHO = 1700;
const MARGEN = 40;
const COL_HORA = 170;
const ALTO_HORA = 118;

/** Colores de cada modo (hex) para el canvas y Excel. */
export function coloresModo(modo) {
  const blanco = '#ffffff';
  switch (modo) {
    case 'g1':
      return { fondo: hex('cyan-dark'), texto: blanco };
    case 'g2':
      return { fondo: hex('crimson-dark'), texto: blanco };
    case 'mitad':
      return { fondo: hex('cyan-dark'), fondo2: hex('crimson-dark'), texto: blanco };
    case 'todos':
      return { fondo: hex('magenta-dark'), texto: blanco };
    case 'sin':
      return { fondo: hex('background'), texto: hex('text-muted'), tachado: hex('crimson') };
    default:
      return { fondo: blanco, texto: hex('text-primary') };
  }
}

/** Parte un texto en renglones que quepan en `ancho`. */
function renglones(ctx, texto, ancho) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** "07-09hrs." como en la hoja de la UdeG. */
export function horasCortas(clase) {
  const h = (m) => {
    const t = aHora(m);
    return t.endsWith(':00') ? t.slice(0, 2) : t;
  };
  return `${h(aMinutos(clase.start))}-${h(aMinutos(clase.end))}hrs.`;
}

/**
 * Regresa un Blob PNG.
 * opciones: { grupo, colores (Map), modos (o null), semana ('Semana del…'), notas }
 */
export async function imagenSemana({ grupo, colores, modos = null, semana = '', notas = '' }) {
  const consejal = Boolean(modos);
  const dias = diasConClases(grupo);
  const [ini, fin] = rangoHoras(grupo);
  const anchoDia = (ANCHO - MARGEN * 2 - COL_HORA) / dias.length;
  const altoEncabezado = 150;
  const altoLeyenda = consejal ? 64 : 0;
  const altoTabla = 52 + (fin - ini) * ALTO_HORA + 60;
  const altoNotas = consejal && notas.trim() ? 40 + Math.min(8, notas.split('\n').length + Math.ceil(notas.length / 120)) * 28 : 0;
  const ALTO = MARGEN + altoEncabezado + altoLeyenda + altoTabla + altoNotas + 70;

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  const C = {
    noche: hex('blue'),
    acero: hex('blue-steel'),
    naranja: hex('gold'),
    texto: hex('text-primary'),
    gris: hex('text-secondary'),
    grisClaro: hex('text-muted'),
    borde: hex('border'),
    fondo: hex('background'),
    rojo: hex('crimson'),
  };

  // Fondo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // --- Encabezado ---
  let y = MARGEN;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.noche;
  ctx.font = `bold 40px ${FUENTE}`;
  ctx.fillText('POLIMAP', MARGEN, y + 42);
  ctx.fillStyle = C.gris;
  ctx.font = `20px ${FUENTE}`;
  ctx.fillText('Escuela Politécnica "Ing. Jorge Matute Remus" · Universidad de Guadalajara', MARGEN, y + 76);
  ctx.fillStyle = C.naranja;
  ctx.font = `bold 20px ${FUENTE}`;
  ctx.fillText(consejal ? `HORARIO DE GRUPO ${CICLO.nombre} · CONSEJALES` : `HORARIO DE GRUPO · Cal. ${CICLO.nombre}`, MARGEN, y + 110);

  ctx.textAlign = 'right';
  ctx.fillStyle = C.noche;
  ctx.font = `bold 34px ${FUENTE}`;
  ctx.fillText(grupo.code, ANCHO - MARGEN, y + 40);
  ctx.font = `bold 18px ${FUENTE}`;
  const carrera = renglones(ctx, grupo.career, 760);
  carrera.slice(0, 2).forEach((l, i) => ctx.fillText(l, ANCHO - MARGEN, y + 70 + i * 24));
  if (semana) {
    ctx.fillStyle = C.rojo;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(semana.toUpperCase(), ANCHO - MARGEN, y + 128);
  }
  ctx.textAlign = 'left';
  y += altoEncabezado;

  // --- Leyenda (consejales) ---
  if (consejal) {
    let x = MARGEN;
    ctx.font = `bold 18px ${FUENTE}`;
    for (const m of ['g1', 'g2', 'mitad', 'todos', 'sin']) {
      const c = coloresModo(m);
      const etiqueta = m === 'mitad' ? 'MITAD Y MITAD (30 MIN C/U)' : MODOS[m].label.toUpperCase();
      const w = ctx.measureText(etiqueta).width + 64;
      pintarCaja(ctx, x, y, w, 44, c, 10);
      ctx.fillStyle = c.texto;
      ctx.fillText(etiqueta, x + 32, y + 29);
      x += w + 12;
    }
    y += altoLeyenda;
  }

  // --- Tabla ---
  const x0 = MARGEN;
  const anchoTabla = ANCHO - MARGEN * 2;
  // Encabezado de días
  ctx.fillStyle = C.acero;
  ctx.fillRect(x0, y, anchoTabla, 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.fillText('HORA', x0 + COL_HORA / 2, y + 34);
  dias.forEach((d, i) => ctx.fillText(d.toUpperCase(), x0 + COL_HORA + anchoDia * (i + 0.5), y + 34));
  y += 52;
  const yTabla = y;

  // Filas de horas
  for (let h = ini; h < fin; h += 1) {
    const yy = yTabla + (h - ini) * ALTO_HORA;
    ctx.fillStyle = (h - ini) % 2 ? '#ffffff' : mezclar(C.fondo, '#ffffff', 0.5);
    ctx.fillRect(x0 + COL_HORA, yy, anchoTabla - COL_HORA, ALTO_HORA);
    ctx.fillStyle = C.texto;
    ctx.font = `bold 21px ${FUENTE}`;
    ctx.fillText(`${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`, x0 + COL_HORA / 2, yy + ALTO_HORA / 2 + 8);
    ctx.strokeStyle = C.borde;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x0 + anchoTabla, yy);
    ctx.stroke();
  }
  // Líneas de columnas
  ctx.strokeStyle = C.borde;
  for (let i = 0; i <= dias.length; i += 1) {
    const xx = x0 + COL_HORA + anchoDia * i;
    ctx.beginPath();
    ctx.moveTo(xx, yTabla);
    ctx.lineTo(xx, yTabla + (fin - ini) * ALTO_HORA);
    ctx.stroke();
  }

  // Clases
  dias.forEach((d, i) => {
    for (const c of clasesDelDia(grupo, d)) {
      const top = yTabla + ((aMinutos(c.start) - ini * 60) / 60) * ALTO_HORA;
      const alto = ((aMinutos(c.end) - aMinutos(c.start)) / 60) * ALTO_HORA;
      const left = x0 + COL_HORA + anchoDia * i;
      const modo = consejal ? modos[llaveClase(c)] ?? 'normal' : null;
      let estilo;
      if (modo) estilo = coloresModo(modo);
      else {
        const t = tonoHex(colores.get(c.subject) ?? 0);
        estilo = { fondo: t.fondo, texto: C.texto, franja: t.color };
      }
      pintarCaja(ctx, left + 3, top + 3, anchoDia - 6, alto - 6, estilo, 8);
      textoClase(ctx, c, left + 3, top + 3, anchoDia - 6, alto - 6, estilo.texto);
    }
  });

  // Marco
  const altoGrid = (fin - ini) * ALTO_HORA;
  ctx.strokeStyle = C.noche;
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, yTabla - 52, anchoTabla, altoGrid + 52);
  y = yTabla + altoGrid;

  // Pie: horas, grupo, carrera y turno
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y, anchoTabla, 60);
  ctx.strokeRect(x0, y, anchoTabla, 60);
  ctx.fillStyle = C.texto;
  ctx.font = `bold 21px ${FUENTE}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${grupo.weeklyHours} HRS.`, x0 + 24, y + 38);
  ctx.fillText(grupo.group.toUpperCase(), x0 + COL_HORA + 30, y + 38);
  ctx.textAlign = 'center';
  ctx.fillText(renglones(ctx, grupo.career, anchoTabla * 0.5)[0], x0 + anchoTabla * 0.55, y + 38);
  ctx.textAlign = 'right';
  ctx.fillText(`TURNO ${grupo.shift.toUpperCase()}`, x0 + anchoTabla - 24, y + 38);
  ctx.textAlign = 'left';
  y += 60;

  // Recordatorios
  if (altoNotas) {
    y += 24;
    ctx.fillStyle = C.rojo;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText('RECORDATORIOS', x0, y + 16);
    ctx.fillStyle = C.texto;
    ctx.font = `20px ${FUENTE}`;
    const lineas = notas.split('\n').flatMap((p) => renglones(ctx, p, anchoTabla));
    lineas.slice(0, 8).forEach((l, i) => ctx.fillText(l, x0, y + 46 + i * 28));
    y += altoNotas;
  }

  ctx.fillStyle = C.grisClaro;
  ctx.font = `16px ${FUENTE}`;
  ctx.fillText(`Hecho con POLIMAP · horarios oficiales Cal. ${CICLO.nombre}. Verifica cambios con tu coordinación.`, x0, ALTO - 26);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function pintarCaja(ctx, x, y, w, h, estilo, radio) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radio);
  else ctx.rect(x, y, w, h);
  if (estilo.fondo2) {
    // Mitad y mitad: partido en diagonal.
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, estilo.fondo);
    g.addColorStop(0.5, estilo.fondo);
    g.addColorStop(0.5, estilo.fondo2);
    g.addColorStop(1, estilo.fondo2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = estilo.fondo;
  ctx.fill();
  ctx.clip();
  if (estilo.franja) {
    ctx.fillStyle = estilo.franja;
    ctx.fillRect(x, y, 7, h);
  }
  if (estilo.tachado) {
    ctx.strokeStyle = estilo.tachado;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Materia (negritas), maestro(s) y "07-09hrs. Aula E4-A05", centrados. */
function textoClase(ctx, c, x, y, w, h, color) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  const dentro = w - 20;
  ctx.font = `bold 19px ${FUENTE}`;
  const materia = renglones(ctx, c.subject, dentro).slice(0, 3);
  ctx.font = `15px ${FUENTE}`;
  let maestros = maestrosDeClase(c).flatMap((m) => renglones(ctx, m, dentro));
  const armar = (espacio) => [
    ...materia.map((t) => ({ t, f: `bold 19px ${FUENTE}`, a: 23 })),
    ...(espacio ? [{ t: '', f: '', a: 6 }] : []),
    ...maestros.map((t) => ({ t, f: `15px ${FUENTE}`, a: 19 })),
    { t: `${horasCortas(c)} ${c.room}`, f: `bold 16px ${FUENTE}`, a: 21 },
  ];
  // Si no cabe, primero se quita el espacio y luego renglones del maestro:
  // la hora y el salón SIEMPRE se ven.
  let lineas = armar(true);
  const alto = (ls) => ls.reduce((n, l) => n + l.a, 0) + 12;
  if (alto(lineas) > h) lineas = armar(false);
  while (alto(lineas) > h && maestros.length) {
    maestros = maestros.slice(0, -1);
    lineas = armar(false);
  }
  const total = alto(lineas) - 12;
  let yy = y + Math.max(8, (h - total) / 2) + 16;
  for (const l of lineas) {
    if (yy > y + h - 4) break;
    if (l.t) {
      ctx.font = l.f;
      ctx.fillText(l.t, x + w / 2, yy);
    }
    yy += l.a;
  }
  ctx.restore();
}
