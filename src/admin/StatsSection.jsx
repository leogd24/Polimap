// src/admin/StatsSection.jsx — Responsable: Alexis
// =====================================================================
// Sección "Estadísticas" del panel (sin librerías: SVG y divs).
//
//   0. Descargar en Excel (periodo y resueltos), ver ExportCard.jsx.
//   1. Tarjetas de resumen: reportes, sin resolver, resueltos, tiempo
//      promedio y apoyos ("A mí también me pasa"), con mini tendencia.
//   2. Estado (dona) · Reportes por semana: nuevos vs resueltos.
//   3. ¿Cuándo se reporta? (mapa de calor día × hora) · Por categoría.
//   4. Por edificio · Tiempo promedio de solución por categoría.
//
// Reglas de diseño (skill de visualización):
//   - Marcas delgadas, puntas redondeadas de 4 px, 2 px de aire entre
//     segmentos, cuadrícula de 1 px muy tenue, una sola escala por gráfica.
//   - Los colores de estado se revisaron con el validador de daltonismo
//     (rojo, naranja, azul oscuro y verde: pasan).
//   - El texto nunca va del color de la serie; cada gráfica trae leyenda
//     o etiquetas, tooltip al pasar el mouse y "Ver datos" (tabla).
// Respetan los mismos filtros que el tablero.
// =====================================================================
import { useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { SectionTitle, FilterBar } from './ui.jsx';
import ExportCard from './ExportCard.jsx';
import { STATES, CATEGORIES, applyFilters, resolutionDays, formatDuration, localDay } from './reportMeta.js';

const WEEKS = 10;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HORAS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 a 21:00

// Colores de estado SOLO para estas gráficas (validados: se distinguen
// también con daltonismo). Van siempre con su nombre y su número.
const STATE_COLORS = {
  recibido: colors.crimson,
  revision: colors.gold,
  proceso: colors.cyanDark,
  resuelto: colors.green,
};
// Una serie = un color.
const SERIE = colors.cyanDark;
const SERIE_RESUELTOS = colors.green;
const SERIE_NUEVOS = colors.cyan;

export default function StatsSection({ reports, buildings, buildingNames, filters, onFiltersChange, user, onMessage }) {
  const visible = useMemo(() => applyFilters(reports, filters, buildingNames), [reports, filters, buildingNames]);
  const stats = useMemo(() => computeStats(visible, buildingNames), [visible, buildingNames]);
  const [tip, setTip] = useState(null); // tooltip: { x, y, title, lines }

  // Lo que reciben las gráficas para mostrar el tooltip.
  const hover = {
    show: (event, title, lines = []) => setTip({ x: event.clientX, y: event.clientY, title, lines }),
    hide: () => setTip(null),
  };

  return (
    <div>
      <SectionTitle title="Estadísticas" subtitle={`Basadas en ${visible.length} reportes (con los filtros actuales).`} />
      <FilterBar filters={filters} onChange={onFiltersChange} buildings={buildings} />

      {/* 0) Descargar en Excel (antes estaba en el Tablero) */}
      <ExportCard reports={visible} filters={filters} buildingNames={buildingNames} user={user} onMessage={onMessage} />

      {/* 1) Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          icon="assignment"
          tone={colors.cyanDark}
          label="Reportes"
          value={visible.length}
          note={deltaText(stats.thisWeek, stats.lastWeek)}
          trend={stats.byWeek.map((w) => w.nuevos)}
        />
        <StatTile
          icon="pending_actions"
          tone={colors.crimson}
          label="Sin resolver"
          value={stats.pending}
          note={stats.urgent ? `${stats.urgent} urgente${stats.urgent === 1 ? '' : 's'}` : 'Ninguno urgente'}
        />
        <StatTile
          icon="task_alt"
          tone={colors.green}
          label="Resueltos"
          value={stats.resolved}
          note={visible.length ? `${Math.round((stats.resolved / visible.length) * 100)} % del total` : '—'}
          meter={visible.length ? stats.resolved / visible.length : 0}
        />
        <StatTile
          icon="timer"
          tone={colors.goldDark}
          label="Tiempo promedio"
          value={formatDuration(stats.avgDays)}
          note={stats.resolvedWithTime ? `de ${stats.resolvedWithTime} resueltos` : 'Aún sin resueltos'}
        />
        <StatTile
          icon="group_add"
          tone={colors.magenta}
          label="Apoyos"
          value={stats.apoyos}
          note="“A mí también me pasa”"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2) Estado + semanas */}
        <ChartCard
          title="Estado de los reportes"
          icon="donut_large"
          table={{
            headers: ['Estado', 'Reportes', '%'],
            rows: STATES.map((s) => [s.label, stats.byState[s.key], pct(stats.byState[s.key], visible.length)]),
          }}
        >
          <Donut counts={stats.byState} total={visible.length} hover={hover} />
        </ChartCard>

        <ChartCard
          title={`Reportes por semana (últimas ${WEEKS})`}
          icon="calendar_view_week"
          className="lg:col-span-2"
          table={{
            headers: ['Semana del', 'Nuevos', 'Resueltos'],
            rows: stats.byWeek.map((w) => [w.label, w.nuevos, w.resueltos]),
          }}
        >
          <WeekColumns weeks={stats.byWeek} hover={hover} />
        </ChartCard>

        {/* 3) Mapa de calor + categorías */}
        <ChartCard
          title="¿Cuándo se reporta más?"
          subtitle="Día de la semana y hora en que llegan los reportes"
          icon="schedule"
          className="lg:col-span-2"
          table={{
            headers: ['Día', 'Hora', 'Reportes'],
            rows: stats.heatRows,
          }}
        >
          <Heatmap grid={stats.heat} max={stats.heatMax} hover={hover} />
        </ChartCard>

        <ChartCard
          title="Por categoría"
          icon="category"
          table={{ headers: ['Categoría', 'Reportes'], rows: stats.byCategory.map((c) => [c.label, c.value]) }}
        >
          <Bars items={stats.byCategory} color={SERIE} hover={hover} unit="reportes" />
        </ChartCard>

        {/* 4) Edificios + tiempo */}
        <ChartCard
          title="Por edificio o zona"
          icon="apartment"
          className="lg:col-span-1"
          table={{ headers: ['Lugar', 'Reportes'], rows: stats.byPlace.map((c) => [c.label, c.value]) }}
        >
          <Bars items={stats.byPlace} color={SERIE} hover={hover} unit="reportes" />
        </ChartCard>

        <ChartCard
          title="Tiempo promedio de solución"
          subtitle="Por categoría, desde que llega hasta que se marca resuelto"
          icon="timer"
          className="lg:col-span-2"
          table={{
            headers: ['Categoría', 'Promedio', 'Resueltos'],
            rows: stats.timeByCategory.map((c) => [c.label, formatDuration(c.value), c.n]),
          }}
        >
          {stats.timeByCategory.length === 0 ? (
            <Empty icon="hourglass_empty" text="Todavía no hay reportes resueltos." />
          ) : (
            <Bars
              items={stats.timeByCategory}
              color={colors.goldDeep}
              format={formatDuration}
              hover={hover}
              average={stats.avgDays}
              extra={(i) => `${i.n} resuelto${i.n === 1 ? '' : 's'}`}
            />
          )}
        </ChartCard>
      </div>

      {/* Tooltip que sigue al mouse */}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 text-xs"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 220),
            top: tip.y + 14,
            backgroundColor: colors.blueDeep,
            color: colors.white,
            borderRadius: 10,
            boxShadow: `0 8px 20px ${alpha('#000000', 0.25)}`,
            maxWidth: 210,
          }}
        >
          <div className="font-black">{tip.title}</div>
          {tip.lines.map((l) => (
            <div key={l} style={{ color: alpha(colors.white, 0.8) }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------
function pct(n, total) {
  return total ? `${Math.round((n / total) * 100)} %` : '0 %';
}

function deltaText(actual, anterior) {
  if (!actual && !anterior) return 'Sin reportes esta semana';
  const d = actual - anterior;
  if (d === 0) return `${actual} esta semana (igual que la pasada)`;
  return `${actual} esta semana (${d > 0 ? '+' : '−'}${Math.abs(d)} vs la pasada)`;
}

function computeStats(reports, buildingNames) {
  const byState = Object.fromEntries(STATES.map((s) => [s.key, 0]));
  const cat = {};
  const place = {};
  const times = {};
  const heat = DIAS.map(() => HORAS.map(() => 0));
  let apoyos = 0;
  let urgent = 0;

  reports.forEach((r) => {
    byState[r.estado] = (byState[r.estado] || 0) + 1;
    cat[r.categoria] = (cat[r.categoria] || 0) + 1;
    apoyos += r.apoyos || 0;
    if (r.estado !== 'resuelto' && r.prioridad === 'alta') urgent += 1;

    // Lugar: "Edificio 3" (con su número en el cuadrito) o la zona.
    const key = r.edificioNumber ? `E${r.edificioNumber}` : r.zona || 'Sin ubicación';
    place[key] = (place[key] || 0) + 1;

    const d = resolutionDays(r);
    if (d != null) (times[r.categoria] ||= []).push(d);

    // Día y hora (la fecha viene en hora del Poli: "2026-10-24T10:35:00").
    const f = r.createdAt || '';
    const fecha = new Date(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
    const hora = Number(f.slice(11, 13));
    if (!Number.isNaN(fecha.getTime()) && !Number.isNaN(hora)) {
      const dia = (fecha.getDay() + 6) % 7; // lunes = 0
      const col = Math.min(HORAS.length - 1, Math.max(0, hora - HORAS[0]));
      heat[dia][col] += 1;
    }
  });

  // Semanas: lunes de cada semana, de la más vieja a la actual.
  const monday = startOfWeek(new Date());
  const byWeek = [];
  for (let i = WEEKS - 1; i >= 0; i -= 1) {
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const from = localDay(start);
    const to = localDay(end);
    const enRango = (iso) => {
      const day = (iso || '').slice(0, 10);
      return day >= from && day < to;
    };
    byWeek.push({
      label: start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      nuevos: reports.filter((r) => enRango(r.createdAt)).length,
      resueltos: reports.filter((r) => r.estado === 'resuelto' && enRango(r.resolvedAt)).length,
    });
  }

  const todos = Object.values(times).flat();
  const heatRows = [];
  heat.forEach((fila, d) =>
    fila.forEach((v, h) => v && heatRows.push([DIAS[d], `${HORAS[h]}:00`, v]))
  );

  return {
    byState,
    pending: reports.length - (byState.resuelto || 0),
    resolved: byState.resuelto || 0,
    urgent,
    apoyos,
    avgDays: todos.length ? todos.reduce((a, b) => a + b, 0) / todos.length : null,
    resolvedWithTime: todos.length,
    byWeek,
    thisWeek: byWeek[byWeek.length - 1].nuevos,
    lastWeek: byWeek[byWeek.length - 2].nuevos,
    heat,
    heatMax: Math.max(1, ...heat.flat()),
    heatRows,
    byCategory: Object.entries(cat)
      .map(([k, value]) => ({ key: k, label: CATEGORIES[k]?.label ?? k, value, icon: CATEGORIES[k]?.icon, tone: CATEGORIES[k]?.fg }))
      .sort((a, b) => b.value - a.value),
    byPlace: Object.entries(place)
      .map(([k, value]) => {
        const n = k.startsWith('E') && /^E\d+$/.test(k) ? Number(k.slice(1)) : null;
        const nombre = n ? buildingNames[n] : null;
        return {
          key: k,
          label: n ? `Edificio ${n}` : k,
          sub: n && nombre && nombre !== `Edificio ${n}` ? nombre : null,
          badge: n,
          icon: n ? null : 'park',
          value,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    timeByCategory: Object.entries(times)
      .map(([k, list]) => ({
        key: k,
        label: CATEGORIES[k]?.label ?? k,
        icon: CATEGORIES[k]?.icon,
        tone: CATEGORIES[k]?.fg,
        value: list.reduce((a, b) => a + b, 0) / list.length,
        n: list.length,
      }))
      .sort((a, b) => b.value - a.value),
  };
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d;
}

/** Números "bonitos" para el eje: 0, 2, 4, 6… */
function niceMax(max) {
  if (max <= 4) return 4;
  const paso = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * paso >= max) return m * paso;
  return 10 * paso;
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function ChartCard({ title, subtitle, icon, children, className = '', table }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <Card className={`flex flex-col p-5 ${className}`} style={{ borderRadius: 22 }}>
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ backgroundColor: colors.blueTint, borderRadius: 11 }}
        >
          <Icon name={icon} size={20} color={colors.ink} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-black leading-tight">{title}</h2>
          {subtitle && (
            <p className="m-0 mt-[2px] text-xs" style={{ color: colors.textMuted }}>
              {subtitle}
            </p>
          )}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setVerTabla((v) => !v)}
            className="tappable flex h-8 items-center gap-1 border-0 px-3 text-xs font-bold"
            style={{ backgroundColor: verTabla ? colors.blue : colors.background, color: verTabla ? colors.white : colors.textSecondary, borderRadius: 999 }}
            aria-pressed={verTabla}
          >
            <Icon name={verTabla ? 'bar_chart' : 'table_rows'} size={16} color={verTabla ? colors.white : colors.textSecondary} />
            {verTabla ? 'Gráfica' : 'Ver datos'}
          </button>
        )}
      </div>
      <div className="flex-1">{verTabla && table ? <DataTable {...table} /> : children}</div>
    </Card>
  );
}

function DataTable({ headers, rows }) {
  if (!rows.length) return <Empty icon="table_rows" text="Sin datos." />;
  return (
    <div className="app-scroll max-h-[280px] overflow-auto">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-2 text-xs font-black uppercase ${i ? 'text-right' : 'text-left'}`}
                style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, i) => (
                <td
                  key={i}
                  className={`py-2 ${i ? 'text-right font-bold' : ''}`}
                  style={{ borderBottom: `1px solid ${colors.border}`, fontVariantNumeric: 'tabular-nums' }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm" style={{ color: colors.textMuted }}>
      <Icon name={icon} size={34} color={colors.border} />
      {text}
    </div>
  );
}

/** Tarjeta de número: ícono, etiqueta, valor grande, nota y (opcional) tendencia o medidor. */
function StatTile({ icon, tone, label, value, note, trend, meter, className = '' }) {
  return (
    <Card className={`relative p-4 ${className}`} style={{ borderRadius: 20 }}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center" style={{ backgroundColor: alpha(tone, 0.12), borderRadius: 10 }}>
          <Icon name={icon} size={18} color={tone} />
        </span>
        <span className="text-xs font-bold" style={{ color: colors.textSecondary }}>
          {label}
        </span>
      </div>
      <div className="mt-2 text-[30px] font-black leading-none" style={{ color: colors.textPrimary }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: colors.textMuted }}>
        {note}
      </div>
      {trend && <Sparkline values={trend} color={tone} />}
      {meter != null && (
        <div className="mt-3 h-[6px] w-full" style={{ backgroundColor: alpha(tone, 0.15), borderRadius: 4 }}>
          <div className="h-[6px]" style={{ width: `${meter * 100}%`, backgroundColor: tone, borderRadius: 4 }} />
        </div>
      )}
    </Card>
  );
}

/** Mini tendencia (semanas): línea de 2 px, relleno muy tenue y punto en la última. */
function Sparkline({ values, color }) {
  const W = 120;
  const H = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - (v / max) * (H - 8)]);
  const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const [ux, uy] = pts[pts.length - 1];
  return (
    <svg viewBox={`-4 0 ${W + 8} ${H}`} className="absolute right-3 top-[50px] h-7 w-[84px]" aria-hidden="true">
      <path d={`${linea} L${W} ${H} L0 ${H} Z`} style={{ fill: color, opacity: 0.1 }} />
      <path d={linea} style={{ fill: 'none', stroke: color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      <circle cx={ux} cy={uy} r="3.5" style={{ fill: color, stroke: colors.surface, strokeWidth: 2 }} />
    </svg>
  );
}

/** Dona de estados: 2 px de aire entre segmentos, total al centro y leyenda con números. */
function Donut({ counts, total, hover }) {
  if (!total) return <Empty icon="donut_large" text="Sin reportes con estos filtros." />;
  const R = 62;
  const C = 2 * Math.PI * R;
  // 2 px de aire entre segmentos (solo si hay más de uno).
  const GAP = STATES.filter((s) => counts[s.key]).length > 1 ? 3 : 0;
  let acumulado = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col">
      <svg viewBox="0 0 160 160" className="h-[170px] w-[170px] shrink-0" role="img" aria-label="Reportes por estado">
        <circle cx="80" cy="80" r={R} style={{ fill: 'none', stroke: colors.background, strokeWidth: 20 }} />
        {STATES.filter((s) => counts[s.key]).map((s) => {
          const largo = (counts[s.key] / total) * C;
          const seg = (
            <circle
              key={s.key}
              cx="80"
              cy="80"
              r={R}
              transform="rotate(-90 80 80)"
              strokeDasharray={`${Math.max(0, largo - GAP)} ${C}`}
              strokeDashoffset={-acumulado}
              style={{ fill: 'none', stroke: STATE_COLORS[s.key], strokeWidth: 20, cursor: 'pointer' }}
              onMouseMove={(e) => hover.show(e, s.label, [`${counts[s.key]} reportes · ${pct(counts[s.key], total)}`])}
              onMouseLeave={hover.hide}
            />
          );
          acumulado += largo;
          return seg;
        })}
        <text x="80" y="78" textAnchor="middle" style={{ fill: colors.textPrimary, fontSize: 30, fontWeight: 900 }}>
          {total}
        </text>
        <text x="80" y="97" textAnchor="middle" style={{ fill: colors.textMuted, fontSize: 11, fontWeight: 700 }}>
          reportes
        </text>
      </svg>
      <ul className="m-0 grid w-full list-none gap-2 p-0">
        {STATES.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: STATE_COLORS[s.key] }} />
            <span className="flex-1" style={{ color: colors.textSecondary }}>
              {s.label}
            </span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{counts[s.key]}</b>
            <span className="w-10 text-right text-xs" style={{ color: colors.textMuted }}>
              {pct(counts[s.key], total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Columnas por semana: nuevos y resueltos lado a lado, una sola escala. */
function WeekColumns({ weeks, hover }) {
  const max = niceMax(Math.max(1, ...weeks.flatMap((w) => [w.nuevos, w.resueltos])));
  const ticks = [0, max / 2, max];
  const ALTO = 170;
  const pico = weeks.reduce((m, w, i) => (w.nuevos > weeks[m].nuevos ? i : m), 0);
  return (
    <div>
      {/* Leyenda (2 series) */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold" style={{ color: colors.textSecondary }}>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: SERIE_NUEVOS }} />
          Nuevos
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: SERIE_RESUELTOS }} />
          Resueltos
        </span>
      </div>
      <div className="flex gap-2">
        {/* Eje Y */}
        <div className="relative w-6 shrink-0 text-right text-[11px]" style={{ height: ALTO, color: colors.textMuted }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: ALTO - (t / max) * ALTO, fontVariantNumeric: 'tabular-nums' }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Cuadrícula (1 px, muy tenue) */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px" style={{ top: ALTO - (t / max) * ALTO, backgroundColor: colors.border }} />
          ))}
          <div className="relative flex items-end justify-between gap-1" style={{ height: ALTO }}>
            {weeks.map((w, i) => (
              <div
                key={w.label}
                className="flex h-full flex-1 items-end justify-center gap-[2px]"
                onMouseMove={(e) => hover.show(e, `Semana del ${w.label}`, [`Nuevos: ${w.nuevos}`, `Resueltos: ${w.resueltos}`])}
                onMouseLeave={hover.hide}
                style={{ cursor: 'default', backgroundColor: 'transparent' }}
              >
                {[
                  [w.nuevos, SERIE_NUEVOS],
                  [w.resueltos, SERIE_RESUELTOS],
                ].map(([v, c], k) => (
                  <div key={k} className="relative w-full max-w-[18px]" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 0 }}>
                    <div className="h-full w-full" style={{ backgroundColor: c, borderRadius: '4px 4px 0 0' }} />
                    {/* Etiqueta solo en la semana con más reportes y en la actual */}
                    {k === 0 && v > 0 && (i === pico || i === weeks.length - 1) && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-black" style={{ color: colors.textPrimary }}>
                        {v}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-1">
            {weeks.map((w, i) => (
              <span
                key={w.label}
                className={`flex-1 text-center text-[11px] ${i % 2 && i !== weeks.length - 1 ? 'hidden sm:block' : ''}`}
                style={{ color: i === weeks.length - 1 ? colors.textPrimary : colors.textMuted, fontWeight: i === weeks.length - 1 ? 800 : 400 }}
              >
                {i === weeks.length - 1 ? 'Esta semana' : w.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mapa de calor día × hora: un solo color, de claro (pocos) a oscuro (muchos). */
function Heatmap({ grid, max, hover }) {
  const total = grid.flat().reduce((a, b) => a + b, 0);
  if (!total) return <Empty icon="schedule" text="Sin reportes con estos filtros." />;
  const color = (v) => (v ? `color-mix(in srgb, ${colors.cyanDark} ${Math.round(18 + (v / max) * 82)}%, ${colors.surface})` : colors.background);
  return (
    <div>
      <div className="app-scroll overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `36px repeat(${HORAS.length}, minmax(0, 1fr))` }}>
            <span />
            {HORAS.map((h) => (
              <span key={h} className="text-center text-[10px]" style={{ color: colors.textMuted }}>
                {h % 3 === 0 ? `${h}h` : ''}
              </span>
            ))}
            {DIAS.map((d, di) => (
              <Fila key={d}>
                <span className="flex items-center text-[11px] font-bold" style={{ color: colors.textSecondary }}>
                  {d}
                </span>
                {grid[di].map((v, hi) => (
                  <span
                    key={hi}
                    className="aspect-[1.6] min-h-[20px]"
                    style={{ backgroundColor: color(v), borderRadius: 4, cursor: v ? 'pointer' : 'default' }}
                    onMouseMove={(e) =>
                      hover.show(e, `${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][di]} ${HORAS[hi]}:00–${HORAS[hi] + 1}:00`, [
                        `${v} reporte${v === 1 ? '' : 's'}`,
                      ])
                    }
                    onMouseLeave={hover.hide}
                  />
                ))}
              </Fila>
            ))}
          </div>
        </div>
      </div>
      {/* Escala */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px]" style={{ color: colors.textMuted }}>
        Menos
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="inline-block h-3 w-5" style={{ backgroundColor: t ? color(t * max) : colors.background, borderRadius: 3 }} />
        ))}
        Más
      </div>
    </div>
  );
}

// Una fila del mapa de calor (los hijos van directo en la cuadrícula).
function Fila({ children }) {
  return <>{children}</>;
}

/**
 * Barras horizontales de UNA serie (un solo color). La identidad la da el
 * ícono de la izquierda; el valor va al final de la barra.
 */
function Bars({ items, color, format = (v) => v, hover, unit = '', average = null, extra }) {
  if (items.length === 0) return <Empty icon="bar_chart" text="Sin datos con estos filtros." />;
  const max = Math.max(...items.map((i) => i.value), average ?? 0) || 1;
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.key ?? item.label}
          className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3"
          onMouseMove={(e) => hover.show(e, item.label, [`${format(item.value)}${unit ? ` ${unit}` : ''}`, ...(extra ? [extra(item)] : [])])}
          onMouseLeave={hover.hide}
        >
          {item.badge != null ? (
            <span
              className="flex h-8 w-8 items-center justify-center text-sm font-black"
              style={{ backgroundColor: colors.blue, color: colors.white, borderRadius: 10 }}
            >
              {item.badge}
            </span>
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center"
              style={{ backgroundColor: alpha(item.tone ?? colors.blue, 0.12), borderRadius: 10 }}
            >
              <Icon name={item.icon ?? 'label'} size={18} color={item.tone ?? colors.blue} />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-bold" style={{ color: colors.textPrimary }}>
                {item.label}
                {item.sub && (
                  <span className="font-normal" style={{ color: colors.textMuted }}>
                    {' '}
                    · {item.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-black" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {format(item.value)}
              </span>
            </div>
            <div className="relative mt-[6px] h-[8px] w-full" style={{ backgroundColor: colors.background, borderRadius: 4 }}>
              <div className="h-[8px]" style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, backgroundColor: color, borderRadius: '0 4px 4px 0' }} />
              {average != null && (
                <span
                  className="absolute -top-[3px] h-[14px] w-[2px]"
                  style={{ left: `${(average / max) * 100}%`, backgroundColor: colors.textSecondary }}
                  title={`Promedio general: ${format(average)}`}
                />
              )}
            </div>
          </div>
        </div>
      ))}
      {average != null && (
        <div className="flex items-center gap-2 text-xs" style={{ color: colors.textMuted }}>
          <span className="inline-block h-[12px] w-[2px]" style={{ backgroundColor: colors.textSecondary }} />
          Promedio general: {format(average)}
        </div>
      )}
    </div>
  );
}
