// src/admin/DashboardSection.jsx — Responsable: Alexis
// Sección "Tablero" (la primera que se ve al entrar al panel).
//
// De arriba hacia abajo, igual que el diseño aprobado:
//   1. Encabezado: título, "Actualizado hace X s", buscador, Filtros (n) y Exportar Excel.
//   2. Cinco tarjetas de números (sin atender, en revisión, en proceso,
//      resueltos del mes y tiempo promedio de solución).
//   3. Mapa de calor del campus (últimos 30 días) + Reportes por categoría (mes actual).
//   4. Kanban por estado (arrastrar = cambiar estado) o vista de lista.
//
// Las tarjetas de números siempre cuentan TODOS los reportes; el mapa,
// las barras y el Kanban respetan el buscador y los filtros.
import { useMemo, useState } from 'react';
import { colors } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TextField } from '../components/Inputs.jsx';
import KanbanBoard from './KanbanBoard.jsx';
import ReportCard from './ReportCard.jsx';
import CampusHeatCard from './CampusHeatCard.jsx';
import { OutlineButton, FilterFields } from './ui.jsx';
import {
  CATEGORIES,
  applyFilters,
  activeFilterCount,
  downloadCsv,
  locationText,
  resolutionDays,
  formatDuration,
  localDay,
  timeAgo,
} from './reportMeta.js';

// Categorías que se pintan en rojo en la gráfica (las urgentes).
const URGENT_CATEGORIES = ['fuga', 'riesgo'];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

export default function DashboardSection({
  reports,
  buildings,
  buildingNames,
  filters,
  onFiltersChange,
  onOpen,
  onMove,
  newFolios,
  loading,
  lastUpdate,
  onRefresh,
  onGoTo,
}) {
  const [view, setView] = useState('kanban'); // 'kanban' | 'lista'
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visible = useMemo(() => applyFilters(reports, filters, buildingNames), [reports, filters, buildingNames]);
  const kpis = useMemo(() => computeKpis(reports), [reports]);
  const extraFilters = activeFilterCount({ ...filters, search: '' });

  // Últimos 30 días para el mapa de calor.
  const last30 = useMemo(() => {
    const from = localDay(new Date(Date.now() - 30 * 86400000));
    return visible.filter((r) => (r.createdAt || '').slice(0, 10) >= from);
  }, [visible]);

  const now = new Date();

  return (
    <div>
      {/* 1) Encabezado ------------------------------------------------------ */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 mr-2 text-[28px] font-black leading-tight">Tablero de reportes</h1>
        <button
          type="button"
          onClick={onRefresh}
          title="Se actualiza solo cada 30 s. Toca para actualizar ahora."
          className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-sm"
          style={{ color: colors.textSecondary, cursor: 'pointer' }}
        >
          <span
            className="inline-block h-[9px] w-[9px] rounded-full"
            style={{ backgroundColor: loading ? colors.gold : colors.green }}
            aria-hidden="true"
          />
          {loading ? 'Actualizando…' : lastUpdate ? `Actualizado ${timeAgoSeconds(lastUpdate)}` : ''}
        </button>
        <div className="w-full min-w-[240px] flex-1 sm:w-auto">
          <TextField
            value={filters.search}
            onChange={(search) => onFiltersChange({ ...filters, search })}
            placeholder="Buscar folio, texto o edificio…"
            prefixIcon="search"
          />
        </div>
        <OutlineButton icon="tune" onClick={() => setFiltersOpen(!filtersOpen)} active={filtersOpen}>
          {extraFilters ? `Filtros (${extraFilters})` : 'Filtros'}
        </OutlineButton>
        <button
          type="button"
          onClick={() => downloadCsv(visible, buildingNames)}
          title="Descarga lo que ves con los filtros (se abre en Excel)"
          className="tappable flex min-h-[48px] items-center gap-2 border-0 px-5 text-sm font-extrabold"
          style={{ backgroundColor: colors.blue, color: colors.white, borderRadius: 'var(--radius-button)' }}
        >
          <Icon name="download" size={20} color={colors.white} />
          Exportar Excel
        </button>
      </div>
      {filtersOpen && (
        <div className="-mt-3 mb-5">
          <FilterFields filters={filters} onChange={onFiltersChange} buildings={buildings} />
        </div>
      )}

      {/* 2) Números ----------------------------------------------------------- */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="Sin atender"
          value={kpis.recibido}
          detail={`${kpis.urgentes} ${kpis.urgentes === 1 ? 'marcado urgente' : 'marcados urgentes'}`}
          accent={colors.crimson}
        />
        <Kpi label="En revisión" value={kpis.revision} detail={`+${kpis.revisionHoy} hoy`} accent={colors.gold} />
        <Kpi label="En proceso" value={kpis.proceso} detail="con mantenimiento" accent={colors.cyan} />
        <Kpi
          label="Resueltos (mes)"
          value={kpis.resueltosMes}
          detail={
            kpis.cambioMes == null
              ? `${kpis.resueltos} en total`
              : `${kpis.cambioMes >= 0 ? '+' : ''}${kpis.cambioMes}% vs. ${MONTHS_SHORT[(now.getMonth() + 11) % 12]}.`
          }
          accent={colors.green}
        />
        <Kpi
          wide
          label="Tiempo de solución"
          value={formatDuration(kpis.promedio)}
          detail={kpis.promedio == null ? 'aún no hay resueltos' : 'promedio · meta: 2 días'}
          accent={colors.magenta}
        />
      </div>

      {/* 3) Mapa de calor + categorías ---------------------------------------- */}
      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel
          title="Mapa de calor del campus"
          aside="últimos 30 días"
          action={onGoTo && { label: 'Ver mapa real', onClick: () => onGoTo('mapa') }}
        >
          <CampusHeatCard
            reports={last30}
            buildings={buildings}
            onSelectPlace={(edificio) => onFiltersChange({ ...filters, edificio })}
          />
        </Panel>
        <Panel title="Reportes por categoría" aside={`${MONTHS[now.getMonth()]} ${now.getFullYear()}`}>
          <CategoryBars reports={visible} month={localDay().slice(0, 7)} />
        </Panel>
      </div>

      {/* 4) Kanban o lista ---------------------------------------------------- */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="m-0 flex-1 text-xs" style={{ color: colors.textMuted }}>
          {loading
            ? 'Cargando…'
            : `${visible.length} de ${reports.length} reportes. Arrastra una tarjeta a otra columna para cambiar su estado.`}
        </p>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {!loading && visible.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon="inbox"
            title={reports.length === 0 ? 'Aún no hay reportes' : 'Sin resultados'}
            body={
              reports.length === 0
                ? 'Cuando un alumno envíe un reporte desde la app aparecerá aquí.'
                : 'Prueba con otro filtro o búsqueda.'
            }
          />
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          reports={visible}
          buildingNames={buildingNames}
          onOpen={onOpen}
          onMove={onMove}
          newFolios={newFolios}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((report) => (
            <ReportCard
              key={report.folio}
              report={report}
              location={locationText(report, buildingNames)}
              onOpen={() => onOpen(report.folio)}
              isNew={newFolios.has(report.folio)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas del tablero
// ---------------------------------------------------------------------------

/** Tarjeta de número con la línea de color arriba (como en el diseño). */
function Kpi({ label, value, detail, accent, wide = false }) {
  return (
    <div
      className={`flex min-w-0 flex-col px-5 pb-4 pt-4 ${wide ? 'col-span-2 md:col-span-1' : ''}`}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderTop: `5px solid ${accent}`,
        borderRadius: 'var(--radius-tile)',
      }}
    >
      <span className="truncate text-sm font-bold" style={{ color: colors.textSecondary }}>
        {label}
      </span>
      <span className="mt-1 text-[34px] font-black leading-tight">{value}</span>
      <span className="truncate text-xs" style={{ color: colors.textSecondary }}>
        {detail}
      </span>
    </div>
  );
}

/** Tarjeta blanca con título a la izquierda y un texto gris a la derecha. */
function Panel({ title, aside, action, children }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="m-0 flex-1 whitespace-nowrap text-base font-black">{title}</h2>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="border-0 bg-transparent p-0 text-xs font-bold"
            style={{ color: colors.cyanDark, cursor: 'pointer' }}
          >
            {action.label}
          </button>
        )}
        {aside && (
          <span className="text-xs font-bold" style={{ color: colors.textSecondary }}>
            {aside}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Barras horizontales por categoría (las urgentes en rojo). */
function CategoryBars({ reports, month }) {
  const counts = {};
  reports
    .filter((r) => (r.createdAt || '').startsWith(month))
    .forEach((r) => {
      counts[r.categoria] = (counts[r.categoria] || 0) + 1;
    });
  const items = Object.entries(counts)
    .map(([key, value]) => ({ key, value, label: shortCategory(key) }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...items.map((i) => i.value));

  if (items.length === 0) {
    return (
      <p className="m-0 py-8 text-center text-sm" style={{ color: colors.textMuted }}>
        Sin reportes este mes.
      </p>
    );
  }
  return (
    <div className="grid gap-[10px]">
      {items.map((item) => (
        <div
          key={item.key}
          className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3"
          title={`${CATEGORIES[item.key]?.label ?? item.key}: ${item.value}`}
        >
          <span className="truncate text-sm font-bold" style={{ color: colors.textSecondary }}>
            {item.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="block h-[18px]"
              style={{
                width: `${Math.max(4, (item.value / max) * 82)}%`,
                backgroundColor: URGENT_CATEGORIES.includes(item.key) ? colors.crimson : colors.cyan,
                borderRadius: 999,
              }}
            />
            <span className="text-sm font-black">{item.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Nombres cortos para que quepan en la gráfica. */
function shortCategory(key) {
  return (
    { banos: 'Baños', mobiliario: 'Mobiliario', fuga: 'Fuga de agua', riesgo: 'Riesgo' }[key] ??
    CATEGORIES[key]?.label ??
    key
  );
}

function ViewToggle({ value, onChange }) {
  const options = [
    { key: 'kanban', label: 'Tablero', icon: 'view_kanban' },
    { key: 'lista', label: 'Lista', icon: 'view_list' },
  ];
  return (
    <div
      className="flex p-[3px]"
      style={{ backgroundColor: colors.blueTint, borderRadius: 12 }}
      role="group"
      aria-label="Vista"
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className="flex min-h-[34px] items-center gap-1 border-0 px-3 text-xs font-bold"
            style={{
              backgroundColor: active ? colors.surface : 'transparent',
              color: active ? colors.textPrimary : colors.textSecondary,
              borderRadius: 9,
              cursor: 'pointer',
            }}
          >
            <Icon name={o.icon} size={16} color={active ? colors.textPrimary : colors.textSecondary} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "hace 12 s", "hace 3 min" para la última actualización. */
function timeAgoSeconds(date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'justo ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  return timeAgo(date.toISOString());
}

/** Números de las tarjetas de arriba (siempre sobre TODOS los reportes). */
function computeKpis(reports) {
  const today = localDay();
  const month = today.slice(0, 7);
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = localDay(prev).slice(0, 7);

  const count = (estado) => reports.filter((r) => r.estado === estado).length;
  const resolved = reports.filter((r) => r.estado === 'resuelto');
  const resolvedIn = (m) => resolved.filter((r) => (r.resolvedAt || r.updatedAt || '').startsWith(m)).length;
  const days = resolved.map(resolutionDays).filter((d) => d != null);
  const resueltosMes = resolvedIn(month);
  const resueltosAntes = resolvedIn(prevMonth);

  return {
    recibido: count('recibido'),
    revision: count('revision'),
    proceso: count('proceso'),
    resueltos: resolved.length,
    resueltosMes,
    cambioMes: resueltosAntes ? Math.round(((resueltosMes - resueltosAntes) / resueltosAntes) * 100) : null,
    urgentes: reports.filter((r) => r.estado === 'recibido' && r.prioridad === 'alta').length,
    revisionHoy: reports.filter((r) => r.estado === 'revision' && (r.updatedAt || r.createdAt || '').startsWith(today))
      .length,
    promedio: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
  };
}
