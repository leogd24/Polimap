// src/admin/ReportDetail.jsx — Responsable: Alexis
// Ventana con el detalle de un reporte: foto grande, datos, enlace al mapa
// y controles para cambiar el estado y dejar un comentario.
//
// Al guardar llama a updateReport() de src/lib/api.js, que hace
// POST /api/reportes.php?_method=PATCH con la clave de administrador.
import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { updateReport } from '../lib/api.js';
import Card, { Divider } from '../components/Card.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Icon from '../components/Icon.jsx';
import { TextArea } from '../components/Inputs.jsx';
import StateChip from './StateChip.jsx';
import { STATES, categoryInfo, formatDate } from './reportMeta.js';

export default function ReportDetail({ report, token, location, onClose, onSaved, onError }) {
  const [estado, setEstado] = useState(report.estado);
  const [comentario, setComentario] = useState(report.comentarioAdmin || '');
  const [saving, setSaving] = useState(false);

  const category = categoryInfo(report.categoria);
  const changed = estado !== report.estado || comentario !== (report.comentarioAdmin || '');
  const mapUrl =
    report.lat != null && report.lng != null
      ? `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=19/${report.lat}/${report.lng}`
      : null;

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    try {
      await updateReport(token, report.folio, estado, comentario);
      onSaved({ folio: report.folio, estado, comentarioAdmin: comentario || null });
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
                <Icon name={category.icon} size={18} color={colors.textSecondary} />
                {category.label}
              </div>
            </div>
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
              <DataRow icon="schedule" label="Enviado" value={formatDate(report.createdAt)} />
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
