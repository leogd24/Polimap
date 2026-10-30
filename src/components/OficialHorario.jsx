// src/components/OficialHorario.jsx — Responsable: Alexis (pantalla de Horario)
// Vista "Oficial": la hoja del horario tal cual viene en el PDF de la UdeG
// (convertida a imagen con scripts/generar_horarios_oficiales.py).
//   - Tocar la imagen la abre en grande, con acercar/alejar.
//   - "Descargar" guarda la imagen (para mandarla por WhatsApp, imprimir…).
// Después de verla una vez queda guardada en el celular (funciona sin internet).
//
// Props: grupo
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { CICLO, urlOficial } from '../lib/horario.js';

export default function OficialHorario({ grupo }) {
  const [grande, setGrande] = useState(false);
  const [error, setError] = useState(false);
  const url = urlOficial(grupo);
  const nombre = `Horario ${grupo.code} ${CICLO.nombre}.png`;

  useEffect(() => setError(false), [url]);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden" style={{ borderRadius: 18, border: `1px solid ${colors.border}`, backgroundColor: colors.white }}>
        {error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm" style={{ color: colors.textSecondary }}>
            <Icon name="cloud_off" size={40} color={colors.textMuted} />
            No se pudo cargar la hoja oficial. Revisa tu conexión e intenta de nuevo.
          </div>
        ) : (
          <button type="button" onClick={() => setGrande(true)} className="tappable block w-full border-0 bg-transparent p-0" aria-label="Ver la hoja oficial en grande">
            <img src={url} alt={`Horario oficial de ${grupo.code}, calendario ${CICLO.nombre}`} className="block h-auto w-full" onError={() => setError(true)} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setGrande(true)}
          className="tappable flex h-11 flex-1 items-center justify-center gap-2 border-0 px-4 text-sm font-black"
          style={{ borderRadius: 14, backgroundColor: colors.blue, color: colors.white }}
        >
          <Icon name="zoom_in" size={20} color={colors.white} />
          Ver en grande
        </button>
        <a
          href={url}
          download={nombre}
          className="tappable flex h-11 flex-1 items-center justify-center gap-2 px-4 text-sm font-black no-underline"
          style={{ borderRadius: 14, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
        >
          <Icon name="download" size={20} color={colors.textPrimary} />
          Descargar imagen
        </a>
      </div>
      <p className="m-0 text-center text-[0.6875rem]" style={{ color: colors.textMuted }}>
        Hoja oficial de la UdeG · Cal. {CICLO.nombre}. Si cambia algo, manda tu coordinación.
      </p>
      {grande && <VisorImagen url={url} titulo={`${grupo.code} · Horario oficial`} nombre={nombre} onClose={() => setGrande(false)} />}
    </div>
  );
}

const ZOOMS = [1, 1.5, 2, 3];

/** Imagen a pantalla completa con acercar/alejar (se mueve con el dedo). */
function VisorImagen({ url, titulo, nombre, onClose }) {
  const [zoom, setZoom] = useState(0);
  const cerrar = useRef(null);
  const alCerrar = useRef(onClose);
  alCerrar.current = onClose;
  // En celular la hoja se ve de lado: arranca más grande para poder leerla.
  const [base] = useState(() => (window.innerWidth < 640 ? 1.6 : 1));

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && alCerrar.current();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-[90] flex flex-col" style={{ backgroundColor: colors.blueDeep }}>
      <header className="flex items-center gap-1 px-2 py-2" style={{ color: colors.white, paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button ref={cerrar} type="button" onClick={onClose} aria-label="Cerrar" className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent">
          <Icon name="arrow_back" color={colors.white} />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-black">{titulo}</div>
        <button type="button" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent" style={{ opacity: zoom === 0 ? 0.35 : 1 }}>
          <Icon name="zoom_out" color={colors.white} />
        </button>
        <button type="button" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent" style={{ opacity: zoom === ZOOMS.length - 1 ? 0.35 : 1 }}>
          <Icon name="zoom_in" color={colors.white} />
        </button>
        <a href={url} download={nombre} className="tappable ml-1 flex h-10 items-center gap-1 px-3 text-sm font-black no-underline" style={{ borderRadius: 999, backgroundColor: colors.gold, color: colors.blueDeep }}>
          <Icon name="download" size={20} color={colors.blueDeep} />
          <span className="hidden sm:inline">Descargar</span>
        </a>
      </header>
      <div className="flex-1 overflow-auto p-3" style={{ overscrollBehavior: 'contain' }}>
        <img src={url} alt={titulo} className="mx-auto block max-w-none" style={{ width: `${base * ZOOMS[zoom] * 100}%`, borderRadius: 6, boxShadow: `0 8px 30px ${alpha(colors.blueDeep, 0.6)}` }} />
      </div>
    </div>,
    document.body
  );
}
