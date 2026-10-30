// src/lib/tema.js — Responsable: Alexis
// =====================================================================
// Apariencia y accesibilidad de la app (se guardan en el celular):
//   tema:       'auto' (como el celular) | 'claro' | 'oscuro'
//   letra:      'normal' | 'grande' | 'muy-grande'   (todo crece: textos y botones)
//   contraste:  'normal' | 'alto'
//   movimiento: 'normal' | 'reducido'                (sin animaciones)
//
// Se aplican como atributos en <html> (data-tema, data-letra…) y theme.css /
// global.css hacen el resto. index.html y admin.html aplican el tema ANTES de
// pintar para que no haya "parpadeo" blanco al abrir en modo oscuro.
//
// COMPARTIDO entre la app y el panel: los dos leen la misma llave
// (polimap.apariencia) del mismo dominio. Si cambias a oscuro en la app, el
// panel también queda en oscuro, y al revés; si los dos están abiertos en
// pestañas distintas, el otro cambia al instante (evento "storage").
// El panel usa las mismas opciones (tema, letra, contraste y movimiento).
//
//   const [prefs, cambiar] = useApariencia();
//   cambiar({ tema: 'oscuro' });
// =====================================================================
import { useEffect, useState } from 'react';

const LLAVE = 'polimap.apariencia';
export const INICIALES = { tema: 'auto', letra: 'normal', contraste: 'normal', movimiento: 'normal' };

// Color de la barra del navegador / del sistema según el tema.
const BARRA = { claro: '#14203A', oscuro: '#0B1220' };

export function leerApariencia() {
  try {
    return { ...INICIALES, ...JSON.parse(localStorage.getItem(LLAVE)) };
  } catch {
    return { ...INICIALES };
  }
}

const oscuroDelSistema = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
const sinMovimientoDelSistema = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Pone los atributos en <html>. panel: true = sin letra grande (el panel es de compu). */
export function aplicarApariencia(p = leerApariencia(), { panel = false } = {}) {
  const html = document.documentElement;
  const oscuro = p.tema === 'oscuro' || (p.tema === 'auto' && oscuroDelSistema());
  html.dataset.tema = oscuro ? 'oscuro' : 'claro';
  html.dataset.letra = panel ? 'normal' : p.letra;
  html.dataset.contraste = p.contraste;
  html.dataset.movimiento = p.movimiento === 'reducido' || sinMovimientoDelSistema() ? 'reducido' : 'normal';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? BARRA.oscuro : BARRA.claro);
}

/** Hook: preferencias + función para cambiarlas (y sigue al celular en "auto"). */
export function useApariencia({ panel = false } = {}) {
  const [prefs, setPrefs] = useState(leerApariencia);

  useEffect(() => {
    aplicarApariencia(prefs, { panel });
    if (prefs.tema !== 'auto' || typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const cambio = () => aplicarApariencia(prefs, { panel });
    mq.addEventListener?.('change', cambio);
    return () => mq.removeEventListener?.('change', cambio);
  }, [prefs, panel]);

  // Si la cambian en OTRA pestaña (la app o el panel), aquí también.
  useEffect(() => {
    const otraPestana = (e) => e.key === LLAVE && setPrefs(leerApariencia());
    window.addEventListener('storage', otraPestana);
    return () => window.removeEventListener('storage', otraPestana);
  }, []);

  function cambiar(cambios) {
    setPrefs((p) => {
      const nuevo = { ...p, ...cambios };
      try {
        localStorage.setItem(LLAVE, JSON.stringify(nuevo));
      } catch {
        // Sin almacenamiento: dura mientras la app esté abierta.
      }
      return nuevo;
    });
  }
  return [prefs, cambiar];
}

/** Botón día/noche: pasa a lo contrario de lo que se ve ahora. */
export function temaContrario() {
  return esOscuro() ? 'claro' : 'oscuro';
}

/** ¿Está en oscuro ahora mismo? (para el mapa, que elige sus mosaicos) */
export function esOscuro() {
  return document.documentElement.dataset.tema === 'oscuro';
}
