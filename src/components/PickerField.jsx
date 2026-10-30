// src/components/PickerField.jsx — Responsable: Alexis (diseño con la paleta de Leo)
// =====================================================================
// Lista desplegable "bonita" para el formulario de Reportar.
// Reemplaza al <select> del navegador (que se ve distinto y muy simple
// en cada celular) por:
//   - un campo con ícono, el texto elegido y una descripción chiquita;
//   - al tocarlo, una HOJA que sube desde abajo (en computadora, una
//     ventana al centro) con opciones grandes: ícono de color, título,
//     descripción y palomita en la elegida;
//   - grupos con encabezado (ej. "3er piso").
//
// Props:
//   value, onChange(value | null)
//   placeholder, prefixIcon, title (título de la hoja), error
//   options: [{ value, label, description?, icon?, color?, badge? }]
//        badge: número chiquito en la esquina del ícono (ej. el del edificio)
//        o grupos: [{ label, icon?, options: [...] }]
//   clearable: muestra "Quitar selección" (para campos opcionales)
//
// Cómo probar: npm run dev → Reportar → toca "¿Qué ocurrió?".
// Funciona con teclado: Tab llega al campo, Enter lo abre, flechas
// para moverse, Enter elige y Esc cierra.
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';

/** Acepta lista simple o con grupos y regresa siempre grupos. */
function comoGrupos(options) {
  if (options.some((o) => o.options)) return options;
  return [{ label: null, options }];
}

export default function PickerField({
  value,
  onChange,
  placeholder,
  prefixIcon,
  title,
  options,
  error,
  clearable = false,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // opción resaltada con el teclado
  const [teclado, setTeclado] = useState(false); // true solo si se usan las flechas
  const listRef = useRef(null);
  const buttonRef = useRef(null);

  const grupos = useMemo(() => comoGrupos(options), [options]);
  const todas = useMemo(() => grupos.flatMap((g) => g.options), [grupos]);
  const elegida = todas.find((o) => o.value === value) ?? null;
  const visibles = todas;

  // Al abrir: resalta la elegida y la deja a la vista.
  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, todas.findIndex((o) => o.value === value)));
    setTeclado(false);
    const t = setTimeout(() => {
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
    }, 30);
    // Sin scroll de fondo mientras está abierta.
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = antes;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function cerrar() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function elegir(v) {
    onChange(v);
    cerrar();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cerrar();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const paso = event.key === 'ArrowDown' ? 1 : -1;
      const siguiente = (active + paso + visibles.length) % Math.max(1, visibles.length);
      setActive(siguiente);
      setTeclado(true);
      listRef.current?.querySelector(`[data-index="${siguiente}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && visibles[active]) {
      event.preventDefault();
      elegir(visibles[active].value);
    }
  }

  let indice = -1; // índice corrido entre todos los grupos (para el teclado)

  return (
    <div>
      {/* ------------------------- Campo ------------------------- */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="tappable flex w-full items-center gap-3 px-3 py-[10px] text-left"
        style={{
          backgroundColor: colors.surface,
          borderRadius: 'var(--radius-input)',
          border: error ? `1.5px solid ${colors.crimson}` : `1px solid ${elegida ? alpha(colors.ink, 0.35) : colors.border}`,
          minHeight: 58,
        }}
      >
        <Tile icon={elegida?.icon ?? prefixIcon} color={elegida?.color ?? colors.textSecondary} badge={elegida?.badge} muted={!elegida} />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[0.875rem] font-bold"
            style={{ color: elegida ? colors.textPrimary : colors.textMuted }}
          >
            {elegida ? elegida.label : placeholder}
          </span>
          {elegida?.description && (
            <span className="block truncate text-xs" style={{ color: colors.textSecondary }}>
              {elegida.description}
            </span>
          )}
        </span>
        <Icon name="expand_more" color={colors.textSecondary} />
      </button>
      {error && (
        <div className="px-4 pt-1 text-xs" style={{ color: colors.crimson }}>
          {error}
        </div>
      )}

      {/* ------------------------- Hoja ------------------------- */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          style={{ backgroundColor: alpha('#000000', 0.45) }}
          onClick={cerrar}
          onKeyDown={onKeyDown}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? placeholder}
            className="pk-hoja flex max-h-[82dvh] w-full max-w-[520px] flex-col"
            style={{ backgroundColor: colors.background, borderRadius: '28px 28px 0 0' }}
            onClick={(event) => event.stopPropagation()}
          >
            <style>{ESTILOS}</style>
            {/* Encabezado */}
            <div className="px-5 pt-3 pb-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <div className="mx-auto mb-3 h-[5px] w-10 rounded-full sm:hidden" style={{ backgroundColor: colors.border }} />
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-lg font-black" style={{ color: colors.textPrimary }}>
                  {title ?? placeholder}
                </span>
                <button
                  type="button"
                  onClick={cerrar}
                  aria-label="Cerrar"
                  className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Icon name="close" color={colors.textPrimary} />
                </button>
              </div>
            </div>

            {/* Opciones */}
            <div
              ref={listRef}
              role="listbox"
              tabIndex={0}
              autoFocus
              aria-activedescendant={visibles[active] ? `pk-${String(visibles[active].value)}` : undefined}
              className="app-scroll flex-1 overflow-y-auto px-4 pt-2 pb-5 outline-none"
              style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            >
              {grupos.map((g, gi) => (
                <div key={g.label ?? gi} role="group" aria-label={g.label ?? undefined}>
                  {g.label && (
                    <div
                      className="flex items-center gap-2 px-1 pt-4 pb-2 text-xs font-black uppercase"
                      style={{ color: colors.textSecondary, backgroundColor: colors.background, letterSpacing: 0.6 }}
                    >
                      {g.icon && <Icon name={g.icon} size={16} color={colors.textMuted} />}
                      {g.label}
                      <span className="h-px flex-1" style={{ backgroundColor: colors.border }} />
                    </div>
                  )}
                  <div className="grid gap-2">
                    {g.options.map((o) => {
                      indice += 1;
                      const i = indice;
                      const sel = o.value === value;
                      // Resaltado del teclado: solo cuando se usan las flechas (con el mouse
                      // o el dedo NO se pinta, para no confundirlo con la opción elegida).
                      const resaltada = teclado && i === active;
                      return (
                        <button
                          key={o.value}
                          id={`pk-${String(o.value)}`}
                          type="button"
                          role="option"
                          aria-selected={sel}
                          data-index={i}
                          onClick={() => elegir(o.value)}
                          className="pk-opcion tappable flex w-full items-center gap-3 px-3 py-[10px] text-left"
                          style={{
                            backgroundColor: sel ? alpha(colors.ink, 0.08) : colors.surface,
                            borderRadius: 18,
                            border: `${sel ? 2 : 1}px solid ${sel ? colors.ink : colors.border}`,
                            boxShadow: resaltada ? `0 0 0 3px ${alpha(colors.cyan, 0.45)}` : sel ? `0 4px 14px ${alpha(colors.blue, 0.12)}` : 'none',
                          }}
                        >
                          <Tile icon={o.icon} color={o.color ?? colors.ink} badge={o.badge} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.875rem] font-extrabold" style={{ color: colors.textPrimary }}>
                              {o.label}
                            </span>
                            {o.description && (
                              <span className="block text-xs" style={{ color: colors.textSecondary, lineHeight: 1.35 }}>
                                {o.description}
                              </span>
                            )}
                          </span>
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: sel ? colors.ink : 'transparent',
                              border: sel ? 'none' : `2px solid ${colors.border}`,
                            }}
                          >
                            {sel && <Icon name="check" size={16} color={colors.surface} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {clearable && value != null && (
                <button
                  type="button"
                  onClick={() => elegir(null)}
                  className="tappable mt-4 flex w-full items-center justify-center gap-2 border-0 py-3 text-sm font-bold"
                  style={{ backgroundColor: 'transparent', color: colors.crimsonDark }}
                >
                  <Icon name="backspace" size={18} color={colors.crimsonDark} />
                  Quitar selección
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cuadrito de color con el ícono. Si trae `badge` (ej. el número del
 * edificio), el cuadrito va lleno del color y el número en una bolita
 * en la esquina. muted: gris, para cuando todavía no se elige nada.
 */
function Tile({ icon, color, badge, muted = false }) {
  const lleno = badge != null;
  return (
    <span
      className="relative flex h-10 w-10 shrink-0 items-center justify-center"
      style={{ borderRadius: 13, backgroundColor: lleno ? color : alpha(color, muted ? 0.08 : 0.13) }}
    >
      {icon && <Icon name={icon} size={22} color={lleno ? colors.white : color} />}
      {lleno && (
        <span
          className="absolute -right-[6px] -top-[6px] flex h-[20px] min-w-[20px] items-center justify-center px-1 text-[0.6875rem] font-black"
          style={{
            borderRadius: 999,
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            border: `2px solid ${color}`,
          }}
        >
          {badge}
        </span>
      )}
    </span>
  );
}

// Animación: la hoja sube desde abajo (en computadora aparece al centro).
const ESTILOS = `
.pk-hoja { animation: pk-sube .24s cubic-bezier(.2,.8,.2,1) both; }
@media (min-width: 640px) { .pk-hoja { border-radius: 28px !important; animation-name: pk-aparece; } }
@keyframes pk-sube { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
@keyframes pk-aparece { from { transform: scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }
.pk-opcion:active { transform: scale(.985); }
/* Con mouse: solo un borde un poco más oscuro (la elegida es la del borde azul y la palomita) */
@media (hover: hover) { .pk-opcion[aria-selected="false"]:hover { border-color: var(--color-text-muted) !important; } }
@media (prefers-reduced-motion: reduce) { .pk-hoja { animation: none; } }
`;
