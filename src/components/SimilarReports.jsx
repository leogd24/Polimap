// src/components/SimilarReports.jsx — Responsable: Alexis (apoya a Katia en Reportar)
// "A mí también me pasa".
//
// Cuando el alumno ya eligió QUÉ pasó y DÓNDE, buscamos si alguien ya lo
// reportó (mismo lugar y categoría, sin resolver, últimos 30 días).
// Si hay, se muestran aquí y el alumno puede sumarse con un toque en vez de
// mandar un reporte repetido. Con 5 apoyos el reporte sube a urgente.
//
// Props:
//   reports    lista de getSimilarReports()
//   onSupport  función async (folio) → se llama al tocar "A mí también me pasa"
//   busy       folio que se está enviando (para mostrar "Sumando…")
import { colors, alpha } from '../styles/theme.js';
import Card from './Card.jsx';
import Icon from './Icon.jsx';

const ESTADOS = {
  recibido: { label: 'Recibido', bg: colors.crimsonTint, fg: colors.crimsonDark },
  revision: { label: 'En revisión', bg: colors.goldTint, fg: colors.goldDark },
  proceso: { label: 'En proceso', bg: colors.cyanTint, fg: colors.cyanDark },
};

/** "hace 5 min", "hace 3 h", "hace 2 días" */
function hace(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return '';
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export default function SimilarReports({ reports, onSupport, busy }) {
  if (!reports.length) return null;

  return (
    <div
      className="mt-[18px] p-4"
      style={{
        backgroundColor: colors.magentaTint,
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${alpha(colors.magenta, 0.35)}`,
      }}
    >
      <div className="flex items-start gap-3">
        <Icon name="groups" color={colors.magentaDark} />
        <div className="min-w-0">
          <div className="font-black" style={{ color: colors.magentaDark }}>
            {reports.length === 1
              ? 'Alguien ya reportó algo parecido aquí'
              : `Ya hay ${reports.length} reportes parecidos aquí`}
          </div>
          <div className="mt-[2px] text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
            Si es lo mismo, súmate en vez de repetirlo: así se atiende más rápido.
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {reports.map((r) => {
          const estado = ESTADOS[r.estado] ?? ESTADOS.recibido;
          const personas = r.apoyos + 1; // el que lo envió + los que se sumaron
          return (
            <Card key={r.folio} className="p-3">
              <div className="flex gap-3">
                {r.foto ? (
                  <img src={r.foto} alt="" className="h-14 w-14 shrink-0 object-cover" style={{ borderRadius: 12 }} />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black">{r.folio}</span>
                    <span
                      className="px-2 py-[1px] text-[11px] font-bold"
                      style={{ backgroundColor: estado.bg, color: estado.fg, borderRadius: 6 }}
                    >
                      {estado.label}
                    </span>
                  </div>
                  <p className="m-0 mt-1 line-clamp-2 text-sm" style={{ lineHeight: 1.35 }}>
                    {r.descripcion}
                  </p>
                  <div className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                    {hace(r.createdAt)} · {personas} {personas === 1 ? 'persona lo reportó' : 'personas lo reportaron'}
                  </div>
                </div>
              </div>

              {r.esMio ? (
                <Status icon="person" text="Este reporte es tuyo" />
              ) : r.yaApoyo ? (
                <Status icon="check_circle" text="Ya te sumaste a este reporte" ok />
              ) : (
                <button
                  type="button"
                  onClick={() => onSupport(r.folio)}
                  disabled={Boolean(busy)}
                  className="tappable mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 border-0 px-4 text-sm font-extrabold"
                  style={{
                    backgroundColor: colors.magenta,
                    color: colors.white,
                    borderRadius: 'var(--radius-button)',
                    opacity: busy && busy !== r.folio ? 0.5 : 1,
                  }}
                >
                  <Icon name={busy === r.folio ? 'hourglass_top' : 'group_add'} size={20} color={colors.white} />
                  {busy === r.folio ? 'Sumando…' : 'A mí también me pasa'}
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <p className="m-0 mt-3 text-center text-xs" style={{ color: colors.textSecondary }}>
        ¿Es otro problema? Sigue llenando el formulario de abajo.
      </p>
    </div>
  );
}

function Status({ icon, text, ok = false }) {
  return (
    <div
      className="mt-3 flex items-center justify-center gap-2 text-sm font-bold"
      style={{ color: ok ? colors.greenDark : colors.textSecondary }}
    >
      <Icon name={icon} size={18} color={ok ? colors.greenDark : colors.textSecondary} />
      {text}
    </div>
  );
}
