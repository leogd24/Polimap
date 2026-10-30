// src/admin/ExportCard.jsx — Responsable: Alexis
// =====================================================================
// Tarjeta "Descargar en Excel" (arriba de Estadísticas).
// Antes era un botón suelto en el Tablero; aquí se puede elegir:
//   - Periodo: todo, últimos 7 días, últimos 30 días o este mes.
//   - Si se incluyen los reportes ya resueltos.
// Siempre respeta los filtros del panel (búsqueda, edificio, categoría…).
// Antes de descargar dice cuántos reportes van y qué hojas trae el archivo.
// El archivo lo arma excelExport.js (sin librerías).
// =====================================================================
import { useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { downloadExcel, excelFileName } from './excelExport.js';
import { describeFilters, localDay } from './reportMeta.js';

const PERIODOS = [
  { key: 'todo', label: 'Todo', icon: 'all_inclusive' },
  { key: '7', label: 'Últimos 7 días', icon: 'date_range' },
  { key: '30', label: 'Últimos 30 días', icon: 'calendar_month' },
  { key: 'mes', label: 'Este mes', icon: 'today' },
];

// Lo que trae el archivo (se muestra como "chips").
const HOJAS = [
  { icon: 'dashboard', label: 'Resumen con gráficas' },
  { icon: 'table_rows', label: 'Lista de reportes' },
  { icon: 'schedule', label: 'Horarios y salones' },
  { icon: 'info', label: 'Notas' },
];

/** Primer día que entra en el periodo ("2026-10-01"), o null para "todo". */
function desdeDe(periodo) {
  const hoy = new Date();
  if (periodo === '7' || periodo === '30') {
    const d = new Date(hoy);
    d.setDate(d.getDate() - Number(periodo) + 1);
    return localDay(d);
  }
  if (periodo === 'mes') return localDay(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  return null;
}

export default function ExportCard({ reports, filters, buildingNames, user, onMessage }) {
  const [periodo, setPeriodo] = useState('todo');
  const [conResueltos, setConResueltos] = useState(true);
  const [ultimo, setUltimo] = useState(null); // nombre del último archivo descargado
  const [busy, setBusy] = useState(false);

  // Reportes que van en el archivo.
  const elegidos = useMemo(() => {
    const desde = desdeDe(periodo);
    return reports.filter(
      (r) => (!desde || (r.createdAt || '').slice(0, 10) >= desde) && (conResueltos || r.estado !== 'resuelto')
    );
  }, [reports, periodo, conResueltos]);

  const filtrosTexto = describeFilters(filters, buildingNames);
  const periodoTexto = PERIODOS.find((p) => p.key === periodo).label;

  function descargar() {
    if (busy || !elegidos.length) return;
    setBusy(true);
    // setTimeout: deja que se pinte "Generando…" antes de armar el archivo.
    setTimeout(() => {
      try {
        const nombre = downloadExcel(elegidos, buildingNames, {
          filtros: [filtrosTexto, conResueltos ? '' : 'sin resueltos'].filter(Boolean).join(' · '),
          periodo: periodoTexto,
          autor: user?.correo,
        });
        setUltimo(nombre);
        onMessage?.(`Descargado ${nombre} (${elegidos.length} reportes).`);
      } catch (error) {
        onMessage?.(`No se pudo generar el Excel: ${error.message}`);
      } finally {
        setBusy(false);
      }
    }, 30);
  }

  return (
    <Card className="mb-4 p-0" style={{ borderRadius: 22 }}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Opciones */}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center"
              style={{ backgroundColor: alpha(colors.green, 0.14), borderRadius: 13 }}
            >
              <Icon name="table_view" color={colors.greenDark} />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-black leading-tight">Descargar en Excel</h2>
              <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
                Para la junta o para mantenimiento. Usa los filtros de arriba{filtrosTexto ? ` (${filtrosTexto})` : ''} y
                el periodo que elijas.
              </p>
            </div>
          </div>

          <div className="mt-4 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.5 }}>
            Periodo
          </div>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Periodo">
            {PERIODOS.map((p) => {
              const activo = p.key === periodo;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setPeriodo(p.key)}
                  className="tappable flex h-9 items-center gap-1 px-3 text-sm font-bold"
                  style={{
                    borderRadius: 999,
                    border: `1.5px solid ${activo ? colors.blue : colors.border}`,
                    backgroundColor: activo ? colors.blue : colors.surface,
                    color: activo ? colors.white : colors.textSecondary,
                  }}
                >
                  <Icon name={p.icon} size={17} color={activo ? colors.white : colors.textSecondary} />
                  {p.label}
                </button>
              );
            })}
          </div>

          <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm font-bold" style={{ color: colors.textSecondary }}>
            <input
              type="checkbox"
              checked={conResueltos}
              onChange={(e) => setConResueltos(e.target.checked)}
              className="h-4 w-4"
              style={{ accentColor: 'var(--color-blue)' }}
            />
            Incluir reportes ya resueltos
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            {HOJAS.map((h) => (
              <span
                key={h.label}
                className="inline-flex items-center gap-1 px-[10px] py-[5px] text-xs font-bold"
                style={{ backgroundColor: colors.background, color: colors.textSecondary, borderRadius: 8 }}
              >
                <Icon name={h.icon} size={15} color={colors.textMuted} />
                {h.label}
              </span>
            ))}
          </div>
        </div>

        {/* Resumen y botón */}
        <div
          className="ex-lado flex flex-col justify-center gap-3 p-5"
          style={{ backgroundColor: colors.blue, color: colors.white, borderRadius: '0 0 22px 22px' }}
        >
          <style>{'@media (min-width: 1024px) { .ex-lado { border-radius: 0 22px 22px 0 !important; } }'}</style>
          <div className="text-xs font-bold uppercase" style={{ color: alpha(colors.white, 0.7), letterSpacing: 0.5 }}>
            Se van a exportar
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] font-black leading-none">{elegidos.length}</span>
            <span className="text-sm" style={{ color: alpha(colors.white, 0.8) }}>
              {elegidos.length === 1 ? 'reporte' : 'reportes'}
            </span>
          </div>
          <div className="text-xs" style={{ color: alpha(colors.white, 0.7) }}>
            {periodoTexto}
            {conResueltos ? '' : ' · sin resueltos'}
          </div>
          <button
            type="button"
            onClick={descargar}
            disabled={busy || !elegidos.length}
            className="tappable mt-1 flex min-h-[50px] items-center justify-center gap-2 border-0 px-5 text-sm font-extrabold"
            style={{
              backgroundColor: colors.greenSolid, // verde sólido: el texto blanco se lee bien (también en modo noche)
              color: colors.white,
              borderRadius: 'var(--radius-button)',
              opacity: busy || !elegidos.length ? 0.6 : 1,
            }}
          >
            <Icon name={busy ? 'hourglass_top' : 'download'} size={20} color={colors.white} />
            {busy ? 'Generando…' : elegidos.length ? 'Descargar Excel' : 'No hay reportes'}
          </button>
          <div className="text-[11px]" style={{ color: alpha(colors.white, 0.65) }}>
            {ultimo ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="check_circle" size={14} color={colors.green} /> Listo: {ultimo}
              </span>
            ) : (
              `Se guarda como ${excelFileName()}`
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
