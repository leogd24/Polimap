// src/admin/ReportCard.jsx — Responsable: Alexis
// Tarjeta de un reporte. Se usa en el tablero (Kanban) y en la vista de lista.
//   compact:   versión del Kanban (como el diseño aprobado):
//              miniatura · folio + URGENTE/MEDIA · "Fuga de agua · Edif. 3" · dato del estado
//   draggable: se puede arrastrar a otra columna (solo con mouse).
import { colors, alpha } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import StateChip from './StateChip.jsx';
import { categoryInfo, priorityInfo, timeAgo, formatDate, formatDuration, resolutionDays } from './reportMeta.js';

/** "Edif. 3" o el nombre de la zona: cabe en una línea del Kanban. */
function shortPlace(report) {
  return report.edificioNumber ? `Edif. ${report.edificioNumber}` : report.zona || 'Sin ubicación';
}

/** Tercera línea de la tarjeta: lo más útil según el estado. */
function stateDetail(report) {
  if (report.estado === 'resuelto') {
    const days = resolutionDays(report);
    return days == null ? 'resuelto' : `resuelto en ${formatDuration(days)}`;
  }
  if (report.comentarioAdmin) {
    return report.estado === 'proceso' ? '1 comentario' : report.comentarioAdmin;
  }
  return timeAgo(report.estado === 'recibido' ? report.createdAt : report.updatedAt || report.createdAt);
}

export default function ReportCard({ report, location, onOpen, compact = false, draggable = false, isNew = false }) {
  const category = categoryInfo(report.categoria);
  const thumb = compact ? 54 : 84;

  return (
    <button
      type="button"
      onClick={onOpen}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', report.folio);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className="tappable block w-full min-w-0 border-0 bg-transparent p-0 text-left"
      style={{ cursor: draggable ? 'grab' : 'pointer' }}
      aria-label={`Reporte ${report.folio}`}
    >
      <Card
        className={`flex h-full items-center gap-3 ${compact ? 'p-3' : 'p-3'}`}
        style={{ borderRadius: 16, ...(isNew ? { border: `2px solid ${colors.cyan}` } : {}) }}
      >
        {/* Miniatura: la foto o un cuadro de color con el ícono de la categoría */}
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden"
          style={{
            width: thumb,
            height: thumb,
            borderRadius: 12,
            background: report.foto
              ? colors.blueTint
              : `linear-gradient(135deg, ${alpha(colors.blueSteel, 0.45)}, ${colors.blueSteel})`,
          }}
        >
          {report.foto ? (
            <img src={report.foto} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Icon name={category.icon} size={compact ? 26 : 34} color={alpha(colors.white, 0.9)} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap text-[15px] font-black" style={{ color: colors.textPrimary }}>
              {report.folio}
            </span>
            <PriorityTag prioridad={report.prioridad} />
            {isNew && (
              <span
                className="px-2 py-[1px] text-[11px] font-black"
                style={{ backgroundColor: colors.cyanTint, color: colors.cyanDark, borderRadius: 6 }}
              >
                NUEVO
              </span>
            )}
            {!compact && (
              <span className="ml-auto">
                <StateChip estado={report.estado} />
              </span>
            )}
          </div>

          {compact ? (
            <>
              <div className="mt-[2px] truncate text-sm" style={{ color: colors.textSecondary }}>
                {category.label} · {shortPlace(report)}
              </div>
              <div
                className="truncate text-sm"
                style={{ color: colors.textSecondary }}
                title={formatDate(report.createdAt)}
              >
                {stateDetail(report)}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 flex items-center gap-1 text-sm font-bold">
                <Icon name={category.icon} size={16} color={category.fg} />
                <span className="truncate">{category.label}</span>
              </div>
              <p className="m-0 mt-1 line-clamp-2 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.35 }}>
                {report.descripcion}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: colors.textMuted }}>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Icon name="location_on" size={14} color={colors.textMuted} />
                  <span className="truncate">{location}</span>
                </span>
                <span className="inline-flex items-center gap-1" title={formatDate(report.createdAt)}>
                  <Icon name="schedule" size={14} color={colors.textMuted} />
                  {timeAgo(report.createdAt)}
                </span>
                {report.comentarioAdmin && (
                  <span className="inline-flex items-center gap-1" title={report.comentarioAdmin}>
                    <Icon name="chat" size={14} color={colors.textMuted} />1
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </button>
  );
}

/** URGENTE (rojo) o MEDIA (naranja). "Baja" no lleva etiqueta. */
function PriorityTag({ prioridad }) {
  if (prioridad !== 'alta' && prioridad !== 'media') return null;
  const p = priorityInfo(prioridad);
  return (
    <span
      className="px-2 py-[1px] text-[11px] font-black uppercase"
      style={{ backgroundColor: p.bg, color: p.fg, borderRadius: 6, letterSpacing: 0.4 }}
    >
      {p.label}
    </span>
  );
}
