// src/admin/HistoryList.jsx — Responsable: Alexis
// Línea de tiempo del historial de cambios (quién, qué y cuándo).
// La usan el detalle de un reporte y la sección "Historial de cambios".
import { colors } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import { historyInfo, formatDate } from './reportMeta.js';

export default function HistoryList({ items, showFolio = false, onOpenFolio }) {
  if (items.length === 0) {
    return (
      <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
        Sin cambios registrados.
      </p>
    );
  }
  return (
    <ol className="m-0 grid list-none gap-0 p-0">
      {items.map((h, index) => {
        const info = historyInfo(h);
        return (
          <li key={`${h.folio}-${h.fecha}-${index}`} className="flex gap-3">
            {/* Punto y línea vertical de la línea de tiempo */}
            <div className="flex flex-col items-center">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.blueTint }}
              >
                <Icon name={info.icon} size={16} color={colors.blue} />
              </span>
              {index < items.length - 1 && <span className="w-[2px] flex-1" style={{ backgroundColor: colors.border }} />}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="text-sm" style={{ lineHeight: 1.4 }}>
                {showFolio && (
                  <button
                    type="button"
                    onClick={() => onOpenFolio?.(h.folio)}
                    className="mr-1 border-0 bg-transparent p-0 font-black underline"
                    style={{ color: colors.blue, cursor: 'pointer' }}
                  >
                    {h.folio}
                  </button>
                )}
                {info.text}
              </div>
              <div className="mt-[2px] text-xs" style={{ color: colors.textMuted }}>
                {h.quien ? h.quien.nombre || h.quien.correo : h.accion === 'creado' ? 'Alumno (anónimo)' : 'Sistema'} ·{' '}
                {formatDate(h.fecha)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
