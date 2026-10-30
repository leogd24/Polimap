import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Réplica del `inputDecorationTheme` de Flutter: relleno blanco,
/// borde de 1 px y borde azul de 1.5 px al enfocar.
function fieldStyle(focused) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 'var(--radius-input)',
    border: focused ? `1.5px solid ${colors.ink}` : `1px solid ${colors.border}`,
    // Compensa el grosor extra del borde enfocado para que no salte el alto.
    padding: focused ? '0.5px' : '1px',
  };
}

/// inputProps (opcional): atributos extra del <input>, ej. { type: 'email', id: 'correo' }.
export function TextField({ value, onChange, placeholder, prefixIcon, suffix, filled = true, inputProps }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="campo flex items-center" style={fieldStyle(focused)}>
      {prefixIcon && (
        <span className="pl-3">
          <Icon name={prefixIcon} filled={filled} color={colors.textSecondary} />
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="min-w-0 flex-1 bg-transparent px-3 py-4 outline-none placeholder:text-[color:var(--color-text-muted)]"
        {...inputProps}
      />
      {suffix}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, minRows = 4, maxLength, error }) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <div className="campo" style={{ ...fieldStyle(focused), border: error ? `1.5px solid ${colors.crimson}` : fieldStyle(focused).border }}>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent px-4 py-4 outline-none placeholder:text-[color:var(--color-text-muted)]"
        />
      </div>
      <div className="flex items-start justify-between px-4 pt-1">
        <span className="text-xs" style={{ color: colors.crimson }}>
          {error || ''}
        </span>
        {maxLength && (
          <span className="shrink-0 pl-3 text-xs" style={{ color: colors.textSecondary }}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

/// Lista desplegable con diseño propio (ya no la del navegador, que se veía
/// distinta en cada celular y "tipo Google Forms").
///   - El campo se ve igual que los demás (ícono, texto, flechita).
///   - Al tocarlo se abre un menú flotante redondeado, con sombra, debajo del
///     campo (o arriba si no cabe). La opción elegida va con palomita.
///   - Teclado: Enter/Espacio/flechas abren; flechas se mueven; Enter elige; Esc cierra.
/// Props: value, onChange(value | null), placeholder, prefixIcon, disabled, error,
///   options: [{ value, label, icon?, description? }] o grupos [{ label, options: [...] }]
///   sinVacio: true = no muestra la opción vacía (el placeholder) en el menú.
export function SelectField({
  value,
  onChange,
  placeholder,
  prefixIcon,
  options,
  disabled = false,
  error,
  sinVacio = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  const [lugar, setLugar] = useState(null); // { left, top|bottom, width, maxHeight }
  const campoRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId();

  // Lista plana (con grupos) y la opción vacía al inicio.
  const grupos = options.some((o) => o.options) ? options : [{ label: null, options }];
  const planas = [...(sinVacio ? [] : [{ value: null, label: placeholder, vacia: true }]), ...grupos.flatMap((g) => g.options)];
  const elegida = planas.find((o) => !o.vacia && String(o.value) === String(value)) ?? null;

  // Dónde poner el menú: debajo del campo o arriba si no cabe.
  const medir = useCallback(() => {
    const r = campoRef.current?.getBoundingClientRect();
    if (!r) return;
    const abajo = window.innerHeight - r.bottom - 12;
    const arriba = r.top - 12;
    const alto = Math.min(340, planas.length * 46 + 16);
    const haciaArriba = abajo < Math.min(alto, 220) && arriba > abajo;
    setLugar({
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8)),
      width: Math.max(r.width, 220),
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      maxHeight: Math.max(160, Math.min(340, haciaArriba ? arriba : abajo)),
    });
  }, [planas.length]);

  useLayoutEffect(() => {
    if (!abierto) return undefined;
    medir();
    setActiva(Math.max(0, planas.findIndex((o) => (o.vacia ? value == null : String(o.value) === String(value)))));
    const cerrarFuera = (e) => {
      if (!menuRef.current?.contains(e.target) && !campoRef.current?.contains(e.target)) setAbierto(false);
    };
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    document.addEventListener('pointerdown', cerrarFuera);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
      document.removeEventListener('pointerdown', cerrarFuera);
    };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  // La opción resaltada siempre a la vista.
  useEffect(() => {
    if (abierto) menuRef.current?.querySelector(`[data-i="${activa}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activa]);

  function elegir(o) {
    onChange(o.vacia ? null : o.value);
    setAbierto(false);
    campoRef.current?.focus();
  }

  function teclas(e) {
    if (disabled) return;
    if (!abierto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setAbierto(true);
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setAbierto(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiva((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + planas.length) % planas.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (planas[activa]) elegir(planas[activa]);
    }
  }

  let indice = sinVacio ? -1 : 0;
  const opcion = (o, i) => {
    const sel = o.vacia ? value == null : String(o.value) === String(value);
    return (
      <div
        key={`${o.vacia ? 'vacia' : o.value}`}
        id={`${id}-${i}`}
        role="option"
        aria-selected={sel}
        data-i={i}
        onClick={() => elegir(o)}
        onPointerMove={() => setActiva(i)}
        className="flex cursor-pointer items-center gap-3 px-3 py-[10px] text-[0.875rem]"
        style={{
          borderRadius: 12,
          backgroundColor: i === activa ? alpha(colors.ink, 0.08) : 'transparent',
          color: o.vacia ? colors.textSecondary : colors.textPrimary,
          fontWeight: sel ? 800 : 500,
        }}
      >
        {o.icon && <Icon name={o.icon} size={20} color={sel ? colors.ink : colors.textSecondary} />}
        <span className="min-w-0 flex-1">
          <span className="block">{o.label}</span>
          {o.description && (
            <span className="block text-xs font-normal" style={{ color: colors.textSecondary }}>
              {o.description}
            </span>
          )}
        </span>
        {sel && <Icon name="check" size={20} color={colors.ink} />}
      </div>
    );
  };

  return (
    <div>
      <button
        ref={campoRef}
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={teclas}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-menu` : undefined}
        aria-activedescendant={abierto ? `${id}-${activa}` : undefined}
        aria-label={elegida ? undefined : placeholder}
        className="campo tappable flex w-full items-center text-left"
        style={{
          ...fieldStyle(abierto),
          border: error ? `1.5px solid ${colors.crimson}` : fieldStyle(abierto).border,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {prefixIcon && (
          <span className="pl-3">
            <Icon name={elegida?.icon ?? prefixIcon} filled={false} color={elegida ? colors.ink : colors.textSecondary} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate px-3 py-4 text-[0.875rem]" style={{ color: elegida ? colors.textPrimary : colors.textMuted, fontWeight: elegida ? 600 : 400 }}>
          {elegida ? elegida.label : placeholder}
        </span>
        <span className="pr-3 transition-transform" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }}>
          <Icon name="expand_more" color={colors.textSecondary} />
        </span>
      </button>
      {error && (
        <div className="px-4 pt-1 text-xs" style={{ color: colors.crimson }}>
          {error}
        </div>
      )}

      {abierto &&
        lugar &&
        createPortal(
          <div
            ref={menuRef}
            id={`${id}-menu`}
            role="listbox"
            aria-label={placeholder}
            className="menu-lista app-scroll fixed z-[80] overflow-y-auto p-[6px]"
            style={{
              left: lugar.left,
              top: lugar.top,
              bottom: lugar.bottom,
              width: lugar.width,
              maxHeight: lugar.maxHeight,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              boxShadow: '0 14px 40px rgba(0, 20, 50, 0.22), 0 2px 6px rgba(0, 20, 50, 0.08)',
            }}
          >
            <style>{`.menu-lista{animation:menu-aparece .14s ease-out both}@keyframes menu-aparece{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.menu-lista{animation:none}}`}</style>
            {!sinVacio && opcion(planas[0], 0)}
            {grupos.map((g, gi) => (
              <div key={g.label ?? gi} role="group" aria-label={g.label ?? undefined}>
                {g.label && (
                  <div className="px-3 pt-3 pb-1 text-[0.6875rem] font-black uppercase" style={{ color: colors.textSecondary, letterSpacing: 0.6 }}>
                    {g.label}
                  </div>
                )}
                {g.options.map((o) => {
                  indice += 1;
                  return opcion(o, indice);
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

/// Equivalente del `switchTheme`: pulgar blanco sobre pista dorada al activar.
export function Switch({ value, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="relative shrink-0 transition-colors"
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        backgroundColor: value ? colors.gold : colors.blueTint,
        border: `2px solid ${value ? colors.gold : colors.border}`,
      }}
    >
      <span
        className="absolute top-1/2 block transition-all"
        style={{
          width: value ? 24 : 16,
          height: value ? 24 : 16,
          borderRadius: '50%',
          backgroundColor: value ? colors.white : colors.textMuted,
          left: value ? 22 : 6,
          transform: 'translateY(-50%)',
        }}
      />
    </button>
  );
}

/// Campo "de línea", como en Google Forms: sin caja, solo una línea abajo
/// que se marca al pasar el mouse y se pone gruesa (color ink) al escribir.
///   size: 'xl' (títulos) | 'lg' | 'md'
///   multiline: true = área de texto que crece sola
export function LineField({ value, onChange, placeholder, size = 'md', multiline = false, maxLength, inputProps, className = '' }) {
  const [focused, setFocused] = useState(false);
  const tam = { xl: 'text-[1.625rem] font-bold', lg: 'text-[1.0625rem] font-bold', md: 'text-[0.9375rem]' }[size];
  const comun = {
    value: value ?? '',
    placeholder,
    maxLength,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    className: `campo-linea w-full border-0 bg-transparent px-0 py-2 outline-none ${tam} placeholder:font-normal placeholder:text-[color:var(--color-text-muted)]`,
    style: { color: colors.textPrimary },
    ...inputProps,
  };
  return (
    <div className={`campo relative ${className}`}>
      {multiline ? (
        <textarea
          {...comun}
          rows={1}
          onChange={(e) => {
            onChange(e.target.value);
            // Crece con el texto (como Google Forms).
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          style={{ ...comun.style, resize: 'none', overflow: 'hidden', minHeight: 40 }}
        />
      ) : (
        <input type="text" {...comun} onChange={(e) => onChange(e.target.value)} />
      )}
      {/* Línea de abajo: delgada normal, gruesa al escribir */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 block" style={{ height: 1, backgroundColor: colors.border }} />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 block transition-transform"
        style={{ height: 2, backgroundColor: colors.ink, transform: `scaleX(${focused ? 1 : 0})` }}
      />
    </div>
  );
}

/// Chip de opción (estilo Material 3): con borde; elegido = relleno suave y palomita.
export function ChoiceChip({ selected, onClick, icon, children, tone = colors.ink, tint = colors.blueTint }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className="tappable flex h-9 items-center gap-[6px] px-3 text-[0.8125rem] font-bold"
      style={{
        borderRadius: 10,
        border: `1px solid ${selected ? 'transparent' : colors.border}`,
        backgroundColor: selected ? tint : colors.surface,
        color: selected ? tone : colors.textPrimary,
      }}
    >
      <Icon name={selected ? 'check' : icon} size={18} color={selected ? tone : colors.textSecondary} />
      {children}
    </button>
  );
}
