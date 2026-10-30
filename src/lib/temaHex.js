// src/lib/temaHex.js — Responsable: Alexis
// Los colores de la app viven en src/styles/theme.css como variables CSS.
// El <canvas> (imagen del horario) y Excel NO entienden variables, necesitan
// el color en hexadecimal: aquí están copiados los del tema claro.
//
//   hex('blue')        → '#14203a'
//   mezclar(hex('cyan'), '#ffffff', 0.3) → ciano al 30 % sobre blanco
//
// Son los valores del tema CLARO de theme.css: si cambias theme.css,
// cambia también estos valores.
import { TONOS_VARS } from './horario.js';

const RESPALDO = {
  blue: '#14203a',
  crimson: '#e5233d',
  gold: '#f6921e',
  'blue-deep': '#0b1424',
  'blue-steel': '#33456b',
  'blue-tint': '#e8edf5',
  cyan: '#00aeef',
  'cyan-dark': '#006a96',
  'cyan-tint': '#e0f4fc',
  'crimson-dark': '#b71c30',
  'crimson-tint': '#fde7ea',
  'gold-deep': '#c46f0a',
  'gold-dark': '#a35700',
  'gold-tint': '#fef1e2',
  green: '#2fb344',
  'green-dark': '#1e7a2e',
  'green-tint': '#e3f6e6',
  magenta: '#e72582',
  'magenta-dark': '#b0155f',
  'magenta-tint': '#fce4f0',
  background: '#f3f5f9',
  surface: '#ffffff',
  border: '#dce3ed',
  'text-primary': '#14203a',
  'text-secondary': '#4e5a70',
  'text-muted': '#5f6b82',
  ink: '#14203a',
};

/**
 * Color en hex del tema CLARO. La imagen y el Excel siempre salen en claro
 * (para imprimir y verse igual en cualquier celular), aunque la app esté en
 * modo oscuro; por eso aquí NO se lee el color actual de la pantalla.
 */
export function hex(token) {
  return RESPALDO[token] ?? '#000000';
}

/** Mezcla dos colores hex: t = cuánto del primero (0–1). */
export function mezclar(a, b, t) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
}

/** Tono de una materia en hex: { fondo, color } (mismo orden que en la pantalla). */
export function tonoHex(indice) {
  const [a, b, mezcla] = TONOS_VARS[indice % TONOS_VARS.length];
  return mezcla ? { fondo: mezclar(hex(a), '#ffffff', mezcla), color: hex(b) } : { fondo: hex(a), color: hex(b) };
}
