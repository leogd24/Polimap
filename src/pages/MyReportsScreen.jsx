// src/pages/MyReportsScreen.jsx — Responsable: Katia
// =====================================================================
// "Mis reportes": el alumno ve el seguimiento de lo que reportó.
// Se abre desde Reportar → botón "Mis reportes" (se apila sobre la app,
// igual que Objetos perdidos).
//
//   - Pestañas: "En curso" (recibido, en revisión, en proceso) y "Resueltos".
//   - Cada tarjeta: categoría, folio, estado, lugar, descripción, foto,
//     respuesta del equipo y una barra de 4 pasos con el avance.
//   - Al tocar una tarjeta se abre el detalle (hoja que sube desde abajo).
//   - También salen los reportes que apoyé ("A mí también me pasa")
//     y los que se guardaron en este celular sin internet.
//
// Props: onBack, onNewReport (regresa a Reportar), onShowOnMap(number)
// API: getReports() de src/lib/api.js → GET api/reportes.php (con sesión).
// Textos, íconos y colores de estados y categorías: src/admin/reportMeta.js
// (los mismos del panel, para que el alumno y el admin vean lo mismo).
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import Card from '../components/Card.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import FilledButton from '../components/FilledButton.jsx';
import StateChip from '../admin/StateChip.jsx';
import { STATES, categoryInfo, stateInfo, formatDate, locationWithRoom } from '../admin/reportMeta.js';
import { haceCorto } from '../lib/tiempo.js';
import { campusBuildings } from '../data/campusBuildings.js';
import { getReports } from '../lib/api.js';

// { 1: 'Atención a alumnos', 2: 'Edificio 2', … } para el texto de ubicación.
const buildingNames = Object.fromEntries(campusBuildings.map((b) => [b.number, b.name]));

const TABS = [
  { key: 'curso', label: 'En curso', icon: 'pending_actions' },
  { key: 'resueltos', label: 'Resueltos', icon: 'task_alt' },
];

/** Posición del estado en el camino: recibido 0 → resuelto 3. */
function stepIndex(estado) {
  return Math.max(0, STATES.findIndex((s) => s.key === estado));
}

/** "hace 3 h" / "el 26 de octubre" (para el pie de la tarjeta). */
function cuando(iso) {
  const t = haceCorto(iso);
  if (!t) return '';
  return t === 'ahora' ? 'justo ahora' : /^\d/.test(t) ? `hace ${t}` : `el ${t}`;
}

export default function MyReportsScreen({ onBack, onNewReport, onShowOnMap }) {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('cargando'); // cargando | listo | error
  const [tab, setTab] = useState('curso');
  const [selected, setSelected] = useState(null); // reporte abierto en el detalle

  // Pide la lista a la API. getReports() ya junta los del servidor
  // con los que se guardaron sin internet en este celular.
  const load = useCallback(async () => {
    setStatus('cargando');
    try {
      setReports(await getReports());
      setStatus('listo');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Separamos en "En curso" y "Resueltos" (los sin enviar cuentan como en curso).
  const groups = useMemo(
    () => ({
      curso: reports.filter((r) => r.estado !== 'resuelto'),
      resueltos: reports.filter((r) => r.estado === 'resuelto'),
    }),
    [reports]
  );
  const visible = groups[tab];

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Barra superior (mismo estilo que Objetos perdidos) */}
      <header
        className="flex shrink-0 items-center gap-2 px-2"
        style={{
          backgroundColor: colors.blue,
          color: colors.white,
          paddingTop: 'env(safe-area-inset-top)',
          minHeight: 'calc(60px + env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Regresar"
          className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent"
        >
          <Icon name="arrow_back" color={colors.white} />
        </button>
        <div className="min-w-0 flex-1 py-2">
          <h1 className="m-0 truncate text-lg font-extrabold">Mis reportes</h1>
          <div className="truncate text-[0.6875rem] font-medium">Lo que reportaste y lo que apoyaste</div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={status === 'cargando'}
          aria-label="Actualizar"
          title="Actualizar"
          className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent"
        >
          <Icon name="refresh" color={colors.white} />
        </button>
      </header>

      {/* Pestañas con el número de reportes de cada una */}
      <div
        className="flex shrink-0 gap-1 p-2"
        role="tablist"
        aria-label="Qué reportes ver"
        style={{ backgroundColor: colors.surface, borderBottom: `1px solid ${colors.border}` }}
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className="tappable flex min-h-[44px] flex-1 items-center justify-center gap-1 border-0 text-sm font-extrabold"
              style={{
                borderRadius: 12,
                backgroundColor: active ? colors.blue : 'transparent',
                color: active ? colors.white : colors.textSecondary,
              }}
            >
              <Icon name={t.icon} size={18} color={active ? colors.white : colors.textSecondary} />
              {t.label}
              {status === 'listo' && ` (${groups[t.key].length})`}
            </button>
          );
        })}
      </div>

      <div className="app-scroll flex-1 px-[18px] pb-10 pt-3">
        {status === 'cargando' && (
          <p className="mt-6 text-center text-sm" style={{ color: colors.textSecondary }}>
            Cargando tus reportes…
          </p>
        )}

        {status === 'error' && (
          <Empty icon="wifi_off" title="No se pudo cargar" text="Revisa tu internet e intenta otra vez.">
            <FilledButton icon="refresh" onClick={load} background={colors.blue} className="mt-4">
              Reintentar
            </FilledButton>
          </Empty>
        )}

        {status === 'listo' && visible.length === 0 && (
          tab === 'curso' ? (
            <Empty
              icon="inbox"
              title={reports.length ? 'Nada pendiente' : 'Aún no tienes reportes'}
              text={
                reports.length
                  ? 'Todos tus reportes ya se resolvieron. ¡Gracias por ayudar!'
                  : 'Cuando reportes algo del campus, aquí verás cómo va.'
              }
            >
              <FilledButton icon="add_alert" onClick={onNewReport} className="mt-4">
                Hacer un reporte
              </FilledButton>
            </Empty>
          ) : (
            <Empty icon="task_alt" title="Aún no hay resueltos" text="Cuando el equipo del Poli resuelva uno, aparecerá aquí." />
          )
        )}

        {status === 'listo' && (
          <div className="flex flex-col gap-3">
            {visible.map((r) => (
              <ReportCard key={r.folio} report={r} onOpen={() => setSelected(r)} />
            ))}
          </div>
        )}
      </div>

      <ReportDetail
        report={selected}
        onClose={() => setSelected(null)}
        onShowOnMap={onShowOnMap}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Tarjeta de la lista
// ---------------------------------------------------------------------
function ReportCard({ report, onOpen }) {
  const cat = categoryInfo(report.categoria);
  return (
    <button type="button" onClick={onOpen} className="tappable block w-full border-0 bg-transparent p-0 text-left">
      <Card>
        <div className="flex gap-3 p-4">
          {/* Ícono de la categoría (mismos colores que el panel) */}
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center"
            style={{ backgroundColor: cat.bg, borderRadius: 14 }}
          >
            <Icon name={cat.icon} size={24} color={cat.fg} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-extrabold">{cat.label}</div>
                <div className="text-xs font-bold" style={{ color: colors.textMuted }}>
                  {report.folio}
                </div>
              </div>
              {report.offline ? <OfflineChip /> : <StateChip estado={report.estado} />}
            </div>

            <div className="mt-1 flex items-center gap-1 text-sm" style={{ color: colors.textSecondary }}>
              <Icon name="location_on" size={16} color={colors.textSecondary} />
              <span className="truncate">{locationWithRoom(report, buildingNames)}</span>
            </div>

            <p className="m-0 mt-1 line-clamp-2 text-sm" style={{ lineHeight: 1.4 }}>
              {report.descripcion}
            </p>
          </div>

          {report.foto && (
            <img src={report.foto} alt="" loading="lazy" className="h-16 w-16 shrink-0 object-cover" style={{ borderRadius: 12 }} />
          )}
        </div>

        {/* Respuesta del equipo: es lo que más le importa al alumno */}
        {report.comentarioAdmin && (
          <div
            className="mx-4 mb-3 flex items-start gap-2 px-3 py-2 text-sm"
            style={{ backgroundColor: colors.blueTint, borderRadius: 12 }}
          >
            <Icon name="support_agent" size={18} color={colors.blue} />
            <span className="line-clamp-2" style={{ color: colors.textPrimary }}>
              <b>Equipo del Poli:</b> {report.comentarioAdmin}
            </span>
          </div>
        )}

        {/* Barra de avance de 4 pasos y pie con fecha */}
        <div className="px-4 pb-4">
          {!report.offline && <ProgressBar estado={report.estado} />}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: colors.textMuted }}>
            <span>Enviado {cuando(report.createdAt)}</span>
            {report.esMio === false && (
              <span className="flex items-center gap-1 font-bold" style={{ color: colors.cyanDark }}>
                <Icon name="group_add" size={14} color={colors.cyanDark} />
                Te sumaste
              </span>
            )}
            {report.apoyos > 0 && (
              <span>
                {report.apoyos + 1} personas lo reportaron
              </span>
            )}
          </div>
        </div>
      </Card>
    </button>
  );
}

/** 4 rayitas que se van llenando: recibido → revisión → proceso → resuelto. */
function ProgressBar({ estado }) {
  const step = stepIndex(estado);
  const color = stateInfo(estado).key === 'resuelto' ? colors.greenDark : colors.blue;
  return (
    <div className="flex gap-1" aria-label={`Avance: ${stateInfo(estado).label}`}>
      {STATES.map((s, i) => (
        <span
          key={s.key}
          className="h-[5px] flex-1 rounded-full"
          style={{ backgroundColor: i <= step ? color : colors.border }}
        />
      ))}
    </div>
  );
}

/** Reporte guardado sin internet (folio POLI-LOCAL-…): aún no llega al servidor. */
function OfflineChip() {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap px-3 py-1 text-xs font-bold"
      style={{ backgroundColor: colors.goldTint, color: colors.goldDark, borderRadius: 999 }}
    >
      <Icon name="cloud_off" size={14} color={colors.goldDark} />
      Sin enviar
    </span>
  );
}

// ---------------------------------------------------------------------
// Detalle (hoja que sube desde abajo)
// ---------------------------------------------------------------------
function ReportDetail({ report, onClose, onShowOnMap }) {
  if (!report) return null;
  const cat = categoryInfo(report.categoria);
  const step = stepIndex(report.estado);

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={cat.label}
      subtitle={report.folio}
      icon={cat.icon}
      iconColor={cat.fg}
      footer={
        report.edificioNumber && onShowOnMap ? (
          <FilledButton icon="map" background={colors.blue} className="w-full" onClick={() => onShowOnMap(report.edificioNumber)}>
            Ver en el mapa
          </FilledButton>
        ) : null
      }
    >
      {/* BottomSheet ya pone el margen; aquí solo va el contenido */}
      <div>
        {report.foto && (
          <a href={report.foto} target="_blank" rel="noreferrer" className="block">
            <img
              src={report.foto}
              alt="Fotografía del reporte"
              className="block w-full object-cover"
              style={{ maxHeight: 260, borderRadius: 16 }}
            />
          </a>
        )}

        {report.offline ? (
          <div
            className="mt-4 flex items-start gap-2 p-3 text-sm"
            style={{ backgroundColor: colors.goldTint, color: colors.goldDark, borderRadius: 12 }}
          >
            <Icon name="cloud_off" size={20} color={colors.goldDark} />
            <span>
              Este reporte se guardó en tu celular porque no había internet y <b>aún no llega al equipo del Poli</b>.
              Vuelve a enviarlo desde Reportar cuando tengas conexión.
            </span>
          </div>
        ) : (
          // Línea de tiempo con los 4 estados
          <ol className="m-0 mt-4 list-none p-0">
            {STATES.map((s, i) => {
              const done = i <= step;
              const current = i === step;
              return (
                <li key={s.key} className="flex items-center gap-3 py-1">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: done ? s.bg : colors.background, border: `1px solid ${done ? s.fg : colors.border}` }}
                  >
                    <Icon name={s.icon} size={18} color={done ? s.fg : colors.textMuted} />
                  </span>
                  <span
                    className="text-sm"
                    style={{ fontWeight: current ? 800 : 500, color: done ? colors.textPrimary : colors.textMuted }}
                  >
                    {s.label}
                    {current && s.key === 'resuelto' && report.resolvedAt && ` · ${formatDate(report.resolvedAt)}`}
                    {current && s.key !== 'resuelto' && ' · estado actual'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {report.comentarioAdmin && (
          <div className="mt-4 p-3" style={{ backgroundColor: colors.blueTint, borderRadius: 12 }}>
            <div className="flex items-center gap-1 text-sm font-extrabold" style={{ color: colors.blue }}>
              <Icon name="support_agent" size={18} color={colors.blue} />
              Respuesta del equipo del Poli
            </div>
            <p className="m-0 mt-1 text-sm" style={{ lineHeight: 1.45 }}>
              {report.comentarioAdmin}
            </p>
          </div>
        )}

        <dl className="m-0 mt-4 grid gap-3 text-sm">
          <Row icon="location_on" label="Lugar" value={locationWithRoom(report, buildingNames)} />
          <Row icon="description" label="Descripción" value={report.descripcion} />
          <Row icon="schedule" label="Enviado" value={formatDate(report.createdAt)} />
          {report.updatedAt && report.updatedAt !== report.createdAt && (
            <Row icon="update" label="Última actualización" value={formatDate(report.updatedAt)} />
          )}
          {report.lat != null && <Row icon="my_location" label="Ubicación GPS" value="Incluida" />}
          {report.apoyos > 0 && (
            <Row icon="group" label="Personas que lo reportaron" value={String(report.apoyos + 1)} />
          )}
          {report.esMio === false ? (
            <Row icon="group_add" label="Tu participación" value="Te sumaste a este reporte (“a mí también me pasa”)" />
          ) : (
            !report.offline && (
              <Row
                icon={report.anonimo ? 'visibility_off' : 'visibility'}
                label="Privacidad"
                value={report.anonimo ? 'Anónimo: el equipo no ve tu nombre' : 'El equipo ve tu nombre'}
              />
            )
          )}
        </dl>
      </div>
    </BottomSheet>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <div className="min-w-0">
        <dt className="text-xs font-bold" style={{ color: colors.textMuted }}>
          {label}
        </dt>
        <dd className="m-0" style={{ lineHeight: 1.4 }}>
          {value}
        </dd>
      </div>
    </div>
  );
}

/** Mensaje centrado cuando no hay nada que mostrar. */
function Empty({ icon, title, text, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Icon name={icon} size={56} filled={false} color={colors.textMuted} />
      <h3 className="m-0 mt-3 text-lg font-black">{title}</h3>
      <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
        {text}
      </p>
      {children}
    </div>
  );
}
