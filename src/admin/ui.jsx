// src/admin/ui.jsx — Responsable: Alexis
// Piezas pequeñas que comparten las secciones del panel:
// etiqueta de prioridad, tarjeta de número (KPI), título de sección,
// barra de filtros y campo de fecha.
import { useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import { TextField, SelectField } from '../components/Inputs.jsx';
import { CATEGORIES, PRIORITIES, priorityInfo, activeFilterCount, EMPTY_FILTERS } from './reportMeta.js';

/** Etiqueta de prioridad (solo se muestra "Urgente" y "Baja"; "Media" es lo normal). */
export function PriorityChip({ prioridad, showMedium = false }) {
  if (prioridad === 'media' && !showMedium) return null;
  const p = priorityInfo(prioridad);
  return (
    <span
      className="inline-flex items-center gap-[2px] whitespace-nowrap px-2 py-[2px] text-[11px] font-black uppercase"
      style={{ backgroundColor: p.bg, color: p.fg, borderRadius: 8, letterSpacing: 0.3 }}
    >
      <Icon name={p.icon} size={13} color={p.fg} />
      {p.label}
    </span>
  );
}

/** Título de cada sección del panel con acciones a la derecha. */
export function SectionTitle({ title, subtitle, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-2xl font-black">{title}</h1>
        {subtitle && (
          <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Tarjeta con un número grande. accent = color de la línea de arriba. */
export function KpiCard({ label, value, detail, accent, icon, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col items-start p-4 text-left ${onClick ? 'tappable' : ''}`}
      style={{
        backgroundColor: colors.surface,
        border: active ? `2px solid ${colors.blue}` : `1px solid ${colors.border}`,
        borderTop: `5px solid ${accent}`,
        borderRadius: 'var(--radius-tile)',
        color: colors.textPrimary,
      }}
    >
      <span className="flex items-center gap-1 text-xs font-bold" style={{ color: colors.textSecondary }}>
        {icon && <Icon name={icon} size={16} color={colors.textSecondary} />}
        {label}
      </span>
      <span className="mt-1 text-3xl font-black leading-none">{value}</span>
      {detail && (
        <span className="mt-2 text-xs" style={{ color: colors.textMuted }}>
          {detail}
        </span>
      )}
    </Tag>
  );
}

/** Botón secundario (blanco con borde) del panel. */
export function OutlineButton({ icon, children, onClick, active = false, badge, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="tappable relative flex min-h-[48px] items-center gap-2 px-4 text-sm font-bold"
      style={{
        backgroundColor: active ? colors.blue : colors.surface,
        color: active ? colors.white : colors.textPrimary,
        border: `1px solid ${active ? colors.blue : colors.border}`,
        borderRadius: 'var(--radius-button)',
      }}
    >
      {icon && <Icon name={icon} size={20} color={active ? colors.white : colors.textSecondary} />}
      {children}
      {badge ? (
        <span
          className="ml-1 px-2 text-xs font-black"
          style={{ backgroundColor: colors.crimson, color: colors.white, borderRadius: 999 }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Campo de fecha con el mismo estilo que Inputs.jsx. */
export function DateField({ value, onChange, label }) {
  const [focused, setFocused] = useState(false);
  return (
    <label
      className="flex items-center"
      style={{
        backgroundColor: colors.surface,
        borderRadius: 'var(--radius-input)',
        border: focused ? `1.5px solid ${colors.blue}` : `1px solid ${colors.border}`,
        padding: focused ? '0.5px' : '1px',
      }}
    >
      <span className="pl-3 text-xs font-bold" style={{ color: colors.textSecondary }}>
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="min-w-0 flex-1 bg-transparent px-3 py-[14px] text-[13px] outline-none"
        style={{ color: value ? colors.textPrimary : colors.textMuted }}
      />
    </label>
  );
}

/**
 * Barra de filtros compartida (tablero, mapa y estadísticas).
 * Siempre visible: búsqueda. Al tocar "Filtros": categoría, edificio,
 * prioridad y rango de fechas.
 */
export function FilterBar({ filters, onChange, buildings, children }) {
  const [open, setOpen] = useState(activeFilterCount({ ...filters, search: '' }) > 0);
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const extra = activeFilterCount({ ...filters, search: '' });

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <TextField
            value={filters.search}
            onChange={set('search')}
            placeholder="Buscar folio, texto, edificio o alumno…"
            prefixIcon="search"
          />
        </div>
        <OutlineButton icon="tune" onClick={() => setOpen(!open)} active={open} badge={extra || null}>
          Filtros
        </OutlineButton>
        {children}
      </div>

      {open && <FilterFields filters={filters} onChange={onChange} buildings={buildings} />}
    </div>
  );
}

/**
 * Campos de filtro (categoría, lugar, prioridad, fechas) sin el buscador.
 * Los usa FilterBar y el encabezado del Tablero (botón "Filtros").
 */
export function FilterFields({ filters, onChange, buildings }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const extra = activeFilterCount({ ...filters, search: '' });
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <SelectField
        value={filters.categoria}
        onChange={set('categoria')}
        placeholder="Todas las categorías"
        prefixIcon="category"
        options={Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label }))}
      />
      <SelectField
        value={filters.edificio}
        onChange={set('edificio')}
        placeholder="Todos los lugares"
        prefixIcon="apartment"
        options={[
          ...buildings.map((b) => ({ value: String(b.number), label: `Edificio ${b.number}` })),
          { value: 'zona', label: 'Fuera de edificios (zonas)' },
        ]}
      />
      <SelectField
        value={filters.prioridad}
        onChange={set('prioridad')}
        placeholder="Cualquier prioridad"
        prefixIcon="flag"
        options={PRIORITIES.map((p) => ({ value: p.key, label: p.label }))}
      />
      <DateField label="Desde" value={filters.desde} onChange={set('desde')} />
      <DateField label="Hasta" value={filters.hasta} onChange={set('hasta')} />
      {extra > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS, search: filters.search })}
          className="tappable flex items-center gap-1 justify-self-start border-0 bg-transparent px-1 py-2 text-sm font-bold"
          style={{ color: colors.crimsonDark }}
        >
          <Icon name="filter_alt_off" size={18} color={colors.crimsonDark} />
          Quitar filtros
        </button>
      )}
    </div>
  );
}
