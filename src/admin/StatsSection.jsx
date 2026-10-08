// src/admin/StatsSection.jsx — Responsable: Alexis
// Sección "Estadísticas": gráficas sencillas hechas con divs (sin librerías).
//   1. Estado de todos los reportes (barra apilada con etiquetas).
//   2. Reportes por semana (últimas 8 semanas).
//   3. Por categoría.        4. Por lugar.
//   5. Tiempo promedio de solución por categoría.
// Respetan los mismos filtros que el tablero. Pasa el mouse por una barra
// para ver el número exacto.
import { useMemo } from 'react';
import { colors } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { SectionTitle, FilterBar } from './ui.jsx';
import {
  STATES,
  CATEGORIES,
  applyFilters,
  locationText,
  resolutionDays,
  formatDuration,
  localDay,
} from './reportMeta.js';

const WEEKS = 8;

export default function StatsSection({ reports, buildings, buildingNames, filters, onFiltersChange }) {
  const visible = useMemo(() => applyFilters(reports, filters, buildingNames), [reports, filters, buildingNames]);
  const stats = useMemo(() => computeStats(visible, buildingNames), [visible, buildingNames]);

  return (
    <div>
      <SectionTitle title="Estadísticas" subtitle={`Basadas en ${visible.length} reportes (con los filtros actuales).`} />
      <FilterBar filters={filters} onChange={onFiltersChange} buildings={buildings} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Estado de los reportes" icon="donut_large" className="lg:col-span-2">
          <StatusBar counts={stats.byState} total={visible.length} />
        </ChartCard>

        <ChartCard title={`Reportes por semana (últimas ${WEEKS})`} icon="calendar_view_week" className="lg:col-span-2">
          <Columns items={stats.byWeek} color={colors.cyan} />
        </ChartCard>

        <ChartCard title="Por categoría" icon="category">
          <Bars items={stats.byCategory} color={colors.cyan} />
        </ChartCard>

        <ChartCard title="Por lugar" icon="apartment">
          <Bars items={stats.byPlace} color={colors.crimson} />
        </ChartCard>

        <ChartCard title="Tiempo promedio de solución por categoría" icon="timer" className="lg:col-span-2">
          {stats.timeByCategory.length === 0 ? (
            <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
              Todavía no hay reportes resueltos.
            </p>
          ) : (
            <Bars items={stats.timeByCategory} color={colors.magenta} format={formatDuration} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function computeStats(reports, buildingNames) {
  const byState = Object.fromEntries(STATES.map((s) => [s.key, 0]));
  const cat = {};
  const place = {};
  const times = {};
  reports.forEach((r) => {
    byState[r.estado] = (byState[r.estado] || 0) + 1;
    cat[r.categoria] = (cat[r.categoria] || 0) + 1;
    const p = locationText(r, buildingNames);
    place[p] = (place[p] || 0) + 1;
    const d = resolutionDays(r);
    if (d != null) (times[r.categoria] ||= []).push(d);
  });

  // Semanas: lunes de cada semana, de la más vieja a la actual.
  const monday = startOfWeek(new Date());
  const weeks = [];
  for (let i = WEEKS - 1; i >= 0; i -= 1) {
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const from = localDay(start);
    const to = localDay(end);
    weeks.push({
      label: start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      value: reports.filter((r) => {
        const day = (r.createdAt || '').slice(0, 10);
        return day >= from && day < to;
      }).length,
    });
  }

  const sortDesc = (obj, label) =>
    Object.entries(obj)
      .map(([key, value]) => ({ label: label(key), value }))
      .sort((a, b) => b.value - a.value);

  return {
    byState,
    byWeek: weeks,
    byCategory: sortDesc(cat, (k) => CATEGORIES[k]?.label ?? k),
    byPlace: sortDesc(place, (k) => k).slice(0, 10),
    timeByCategory: Object.entries(times)
      .map(([k, list]) => ({ label: CATEGORIES[k]?.label ?? k, value: list.reduce((a, b) => a + b, 0) / list.length }))
      .sort((a, b) => b.value - a.value),
  };
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d;
}

// ---------------------------------------------------------------------------
// Gráficas
// ---------------------------------------------------------------------------

function ChartCard({ title, icon, children, className = '' }) {
  return (
    <Card className={`p-5 ${className}`}>
      <h2 className="m-0 mb-4 flex items-center gap-2 text-base font-black">
        <Icon name={icon} size={20} color={colors.blue} />
        {title}
      </h2>
      {children}
    </Card>
  );
}

/** Barras horizontales: una sola serie, un solo color, número al final. */
function Bars({ items, color, format = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return (
      <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
        Sin datos.
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(90px,38%)_1fr_auto] items-center gap-3" title={`${item.label}: ${format(item.value)}`}>
          <span className="truncate text-sm font-bold" style={{ color: colors.textSecondary }}>
            {item.label}
          </span>
          <div className="h-[14px]" style={{ backgroundColor: colors.background, borderRadius: 4 }}>
            <div
              className="h-[14px]"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, backgroundColor: color, borderRadius: 4 }}
            />
          </div>
          <span className="min-w-[36px] text-right text-sm font-black">{format(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Columnas verticales (semanas). */
function Columns({ items, color }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-[180px] items-end gap-2 border-b pb-0" style={{ borderColor: colors.border }}>
      {items.map((item) => (
        <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end" title={`Semana del ${item.label}: ${item.value}`}>
          <span className="mb-1 text-xs font-black">{item.value || ''}</span>
          <div
            className="w-full max-w-[56px]"
            style={{
              height: `${(item.value / max) * 130}px`,
              minHeight: item.value ? 4 : 0,
              backgroundColor: color,
              borderRadius: '4px 4px 0 0',
            }}
          />
          <span className="mt-1 whitespace-nowrap pb-1 text-[11px]" style={{ color: colors.textMuted }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barra 100 % apilada por estado, con leyenda y números (no solo color). */
function StatusBar({ counts, total }) {
  if (!total) {
    return (
      <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
        Sin datos.
      </p>
    );
  }
  return (
    <div>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden" style={{ borderRadius: 6 }}>
        {STATES.filter((s) => counts[s.key]).map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${counts[s.key]}`}
            style={{ width: `${(counts[s.key] / total) * 100}%`, backgroundColor: s.key === 'resuelto' ? colors.green : s.fg }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {STATES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <Icon name={s.icon} size={18} color={s.key === 'resuelto' ? colors.greenDark : s.fg} />
            <span style={{ color: colors.textSecondary }}>{s.label}</span>
            <b>{counts[s.key]}</b>
            <span style={{ color: colors.textMuted }}>({Math.round((counts[s.key] / total) * 100)} %)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
