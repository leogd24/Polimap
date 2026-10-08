// src/admin/ReportDetail.jsx — Responsable: Alexis
// Ventana con el detalle de un reporte: foto grande, datos, quién lo envió
// (si no es anónimo), enlace al mapa, controles para cambiar estado y
// prioridad, comentario e historial de cambios.
//
// Al guardar llama a updateReport() de src/lib/api.js, que hace
// POST /api/reportes.php?_method=PATCH. La cookie de sesión dice qué
// administrador hizo el cambio (queda en el historial).
import { useEffect, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { updateReport, getReportHistory } from '../lib/api.js';
import Card, { Divider } from '../components/Card.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Icon from '../components/Icon.jsx';
import { TextArea } from '../components/Inputs.jsx';
import StateChip from './StateChip.jsx';
import HistoryList from './HistoryList.jsx';
import { PriorityChip } from './ui.jsx';
import { STATES, PRIORITIES, categoryInfo, formatDate, formatDuration, resolutionDays } from './reportMeta.js';

export default function ReportDetail({ report, location, onClose, onSaved, onError }) {
  const [estado, setEstado] = useState(report.estado);
  const [prioridad, setPrioridad] = useState(report.prioridad || 'media');
  const [comentario, setComentario] = useState(report.comentarioAdmin || '');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);

  // Historial de este reporte (se vuelve a pedir si cambia algo).
  useEffect(() => {
    getReportHistory(report.folio)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [report.folio, report.updatedAt]);

  // Cerrar con la tecla Esc.
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const category = categoryInfo(report.categoria);
  const changed =
    estado !== report.estado ||
    prioridad !== (report.prioridad || 'media') ||
    comentario !== (report.comentarioAdmin || '');
  const mapUrl =
    report.lat != null && report.lng != null
      ? `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=19/${report.lat}/${report.lng}`
      : null;

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    // Solo mandamos lo que cambió (así el historial queda limpio).
    const cambios = {};
    if (estado !== report.estado) cambios.estado = estado;
    if (prioridad !== (report.prioridad || 'media')) cambios.prioridad = prioridad;
    if (comentario !== (report.comentarioAdmin || '')) cambios.comentarioAdmin = comentario;
    try {
      const result = await updateReport(report.folio, cambios);
      onSaved(result);
      onClose();
    } catch (error) {
      onError(`No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    // Fondo oscuro: al tocarlo se cierra la ventana.
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6"
      style={{ backgroundColor: alpha('#000000', 0.45) }}
      onClick={onClose}
    >
      <div
        className="app-scroll max-h-[92vh] w-full max-w-[560px]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Reporte ${report.folio}`}
      >
        <Card style={{ borderRadius: 28 }}>
          {/* Encabezado */}
          <div className="flex items-center gap-3 p-5 pb-3">
            <div className="min-w-0 flex-1">
              <div className="text-xl font-black" style={{ color: colors.blue }}>
                {report.folio}
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm font-bold">
                <Icon name={category.icon} size={18} color={category.fg} />
                {category.label}
              </div>
            </div>
            <PriorityChip prioridad={report.prioridad} />
            <StateChip estado={report.estado} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0"
              style={{ backgroundColor: colors.background }}
            >
              <Icon name="close" color={colors.textSecondary} />
            </button>
          </div>

          {/* Foto */}
          {report.foto ? (
            <a href={report.foto} target="_blank" rel="noreferrer" className="block px-5">
              <img
                src={report.foto}
                alt={`Foto del reporte ${report.folio}`}
                className="max-h-[320px] w-full object-cover"
                style={{ borderRadius: 18 }}
              />
            </a>
          ) : (
            <div
              className="mx-5 flex items-center gap-2 p-4 text-sm"
              style={{ backgroundColor: colors.background, borderRadius: 18, color: colors.textMuted }}
            >
              <Icon name="no_photography" size={20} color={colors.textMuted} />
              Este reporte no trae foto.
            </div>
          )}

          {/* Datos */}
          <div className="p-5">
            <p className="m-0" style={{ lineHeight: 1.5 }}>
              {report.descripcion}
            </p>
            <div className="mt-4 grid gap-2 text-sm">
              <DataRow icon="location_on" label="Ubicación" value={location} />
              <DataRow
                icon="person"
                label="Enviado por"
                value={report.autor ? `${report.autor.nombre || ''} (${report.autor.correo})` : 'Anónimo'}
              />
              {report.apoyos > 0 && (
                <DataRow
                  icon="group"
                  label="A ellos también les pasa"
                  value={`${report.apoyos} ${report.apoyos === 1 ? 'alumno más' : 'alumnos más'}`}
                />
              )}
              <DataRow icon="schedule" label="Enviado" value={formatDate(report.createdAt)} />
              {report.resolvedAt && (
                <DataRow
                  icon="task_alt"
                  label="Resuelto"
                  value={`${formatDate(report.resolvedAt)} (en ${formatDuration(resolutionDays(report))})`}
                />
              )}
              {report.updatedAt && (
                <DataRow icon="update" label="Última actualización" value={formatDate(report.updatedAt)} />
              )}
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-bold"
                  style={{ color: colors.crimson }}
                >
                  <Icon name="map" size={18} color={colors.crimson} />
                  Ver ubicación GPS en el mapa
                </a>
              )}
            </div>
          </div>

          <Divider />

          {/* Cambiar estado */}
          <div className="p-5">
            <div className="text-sm font-black">Cambiar estado</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {STATES.map((s) => {
                const active = estado === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setEstado(s.key)}
                    aria-pressed={active}
                    className="tappable flex min-h-[48px] items-center gap-2 px-3 text-sm font-bold"
                    style={{
                      backgroundColor: active ? s.bg : colors.surface,
                      color: active ? s.fg : colors.textSecondary,
                      border: active ? `2px solid ${s.fg}` : `1px solid ${colors.border}`,
                      borderRadius: 14,
                    }}
                  >
                    <Icon name={s.icon} size={20} color={active ? s.fg : colors.textSecondary} />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-sm font-black">Prioridad</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const active = prioridad === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPrioridad(p.key)}
                    aria-pressed={active}
                    className="tappable flex min-h-[44px] items-center justify-center gap-1 px-2 text-sm font-bold"
                    style={{
                      backgroundColor: active ? p.bg : colors.surface,
                      color: active ? p.fg : colors.textSecondary,
                      border: active ? `2px solid ${p.fg}` : `1px solid ${colors.border}`,
                      borderRadius: 14,
                    }}
                  >
                    <Icon name={p.icon} size={18} color={active ? p.fg : colors.textSecondary} />
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-sm font-black">Comentario para el equipo</div>
            <div className="mt-2">
              <TextArea
                value={comentario}
                onChange={setComentario}
                placeholder="Ej. Ya se avisó a mantenimiento del edificio 3."
                minRows={3}
                maxLength={500}
              />
            </div>

            <FilledButton
              icon={saving ? 'hourglass_top' : 'save'}
              onClick={save}
              className="mt-3 w-full"
              style={{ opacity: changed && !saving ? 1 : 0.5 }}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </FilledButton>
          </div>

          <Divider />

          {/* Historial: quién cambió qué y cuándo */}
          <div className="p-5">
            <div className="mb-3 text-sm font-black">Historial</div>
            {history === null ? (
              <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
                Cargando…
              </p>
            ) : (
              <HistoryList items={history} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DataRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <span style={{ color: colors.textSecondary }}>{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
