// src/components/BottomSheet.jsx — Responsable: Alexis
// Hoja que sube desde abajo (en computadora, ventana al centro).
// Se cierra con el fondo oscuro, con la X o con Esc.
//
// Props: open, onClose, title, subtitle, icon, children, footer, ancho (px, compu)
//
// Ejemplo:
//   <BottomSheet open={abierta} onClose={() => setAbierta(false)} title="Aula E4-A05">…</BottomSheet>
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';

export default function BottomSheet({ open, onClose, title, subtitle, icon, iconColor = colors.ink, children, footer, ancho = 520 }) {
  const cerrar = useRef(null);
  const alCerrar = useRef(onClose);
  alCerrar.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const tecla = (e) => e.key === 'Escape' && alCerrar.current();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={onClose} className="absolute inset-0 border-0" style={{ backgroundColor: alpha(colors.blueDeep, 0.55) }} />
      <div
        className="bs-sube relative flex max-h-[88dvh] w-full flex-col overflow-hidden sm:rounded-[24px]"
        style={{ maxWidth: ancho, backgroundColor: colors.surface, borderRadius: '24px 24px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full sm:hidden" style={{ backgroundColor: colors.border }} />
        <header className="flex items-start gap-3 px-5 pb-3 pt-3">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ backgroundColor: alpha(iconColor, 0.12), borderRadius: 14 }}>
              <Icon name={icon} size={24} color={iconColor} />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-[2px]">
            <h2 className="m-0 text-lg font-black leading-tight" style={{ color: colors.textPrimary }}>
              {title}
            </h2>
            {subtitle && (
              <div className="mt-[2px] text-sm" style={{ color: colors.textSecondary }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            ref={cerrar}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tappable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0"
            style={{ backgroundColor: colors.background }}
          >
            <Icon name="close" size={22} color={colors.textSecondary} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <div className="px-5 pb-4 pt-2" style={{ borderTop: `1px solid ${colors.border}` }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`.bs-sube{animation:bs-sube .22s ease-out}@keyframes bs-sube{from{transform:translateY(24px);opacity:0}}@media (prefers-reduced-motion: reduce){.bs-sube{animation:none}}`}</style>
    </div>,
    document.body
  );
}
