// src/lib/division.js — Responsable: Alexis
// =====================================================================
// "Modo consejal": dividir al grupo por semana.
//
// A veces las clases se dan solo a una mitad del grupo. Los consejales
// marcan cada clase de la semana como:
//   normal  → como el horario oficial
//   g1      → solo Grupo 1                 (azul)
//   g2      → solo Grupo 2                 (rojo)
//   mitad   → 30 min Grupo 1 y 30 min Grupo 2 (azul y rojo)
//   todos   → todo el grupo junto           (magenta)
//   sin     → no hay clase                  (tachada)
// y llevan la lista del grupo (código, nombre, correo y a qué grupo va).
//
// Se guarda en ESTE celular/compu (localStorage), por grupo:
//   polimap.consejal.<clave del grupo> = {
//     lista:   [{ codigo, nombre, correo, grupo: 1 | 2 | null }],
//     semanas: { 'AAAA-MM-DD (lunes)': { modos: { llaveClase: modo }, notas } }
//   }
// Para pasarlo a otra persona: "Descargar Excel".
// =====================================================================
import { colors } from '../styles/theme.js';

export const MODOS = {
  normal: { label: 'Normal', corto: 'Normal', texto: 'Como el horario oficial', icon: 'event', color: colors.textSecondary },
  g1: { label: 'Grupo 1', corto: 'G1', texto: 'Solo la mitad del Grupo 1', icon: 'looks_one', color: colors.cyanDark, token: 'cyan-dark' },
  g2: { label: 'Grupo 2', corto: 'G2', texto: 'Solo la mitad del Grupo 2', icon: 'looks_two', color: colors.crimsonDark, token: 'crimson-dark' },
  mitad: { label: 'Mitad y mitad', corto: 'Mitad', texto: '30 min Grupo 1 y 30 min Grupo 2', icon: 'splitscreen', color: colors.blueSteel },
  todos: { label: 'Todo el grupo', corto: 'Todos', texto: 'Las dos mitades juntas', icon: 'groups', color: colors.magentaDark, token: 'magenta-dark' },
  sin: { label: 'No hay clase', corto: 'Sin clase', texto: 'Se cancela esa clase', icon: 'event_busy', color: colors.textMuted },
};
export const ORDEN_MODOS = ['normal', 'g1', 'g2', 'mitad', 'todos', 'sin'];

const VACIO = { lista: [], semanas: {} };

function llave(codigoGrupo) {
  return `polimap.consejal.${codigoGrupo}`;
}

export function leerDivision(codigoGrupo) {
  try {
    const d = JSON.parse(localStorage.getItem(llave(codigoGrupo)));
    return d && Array.isArray(d.lista) && d.semanas ? d : JSON.parse(JSON.stringify(VACIO));
  } catch {
    return JSON.parse(JSON.stringify(VACIO));
  }
}

export function guardarDivision(codigoGrupo, datos) {
  try {
    localStorage.setItem(llave(codigoGrupo), JSON.stringify(datos));
    return true;
  } catch {
    return false; // modo privado o sin espacio
  }
}

/** Semana guardada (o vacía). */
export function semanaDe(datos, lunes) {
  return datos.semanas[lunes] ?? { modos: {}, notas: '' };
}

/**
 * Lee una lista pegada desde Excel, WhatsApp o un correo. Acepta columnas
 * separadas por tabulador, coma o punto y coma, en cualquier orden:
 * detecta el código (8–9 dígitos), el correo (@…) y el resto es el nombre.
 * Si hay una columna "1" / "2" (o "G1"/"Grupo 2"), es el grupo.
 */
export function leerListaPegada(texto) {
  const filas = [];
  for (const linea of String(texto).split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const celdas = linea.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim()).filter(Boolean);
    let codigo = '';
    let correo = '';
    let grupo = null;
    const resto = [];
    for (const c of celdas) {
      if (!codigo && /^\d{7,10}$/.test(c)) codigo = c;
      else if (!correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) correo = c.toLowerCase();
      else if (grupo === null && /^(g(rupo)?\s*)?[12]$/i.test(c)) grupo = Number(c.slice(-1));
      else resto.push(c);
    }
    const nombre = resto.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
    // Se salta el encabezado ("Código, Nombre, Correo").
    if (!codigo && !correo && /c[oó]digo|nombre|correo/i.test(nombre)) continue;
    if (nombre || codigo || correo) filas.push({ codigo, nombre, correo, grupo });
  }
  return filas;
}

/** Primera mitad de la lista (por apellido) → Grupo 1, la otra → Grupo 2. */
export function repartirMitades(lista) {
  const orden = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const corte = Math.ceil(orden.length / 2);
  return orden.map((a, i) => ({ ...a, grupo: i < corte ? 1 : 2 }));
}

/** ¿Parece correo institucional? (aviso suave, no bloquea) */
export function correoValido(correo) {
  return !correo || /^[^\s@]+@alumnos\.udg\.mx$/i.test(correo);
}
