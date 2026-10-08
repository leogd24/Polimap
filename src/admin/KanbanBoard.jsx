// src/admin/KanbanBoard.jsx — Responsable: Alexis
// Tablero con 4 columnas: Recibido → En revisión → En proceso → Resuelto.
//
// Con mouse: arrastra una tarjeta a otra columna y cambia su estado
// (llama a onMove(folio, estado), que guarda con updateReport()).
// En celular: toca la tarjeta y cambia el estado en el detalle.
//
// Dentro de cada columna van primero los urgentes y luego los más nuevos.
// "Resuelto" solo muestra los 30 más recientes para no hacer la página eterna.
import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import ReportCard from './ReportCard.jsx';
import { STATES, locationText } from './reportMeta.js';

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
// Punto de color de cada columna (mismo semáforo que el mapa de calor).
const STATE_DOT = { recibido: colors.crimson, revision: colors.gold, proceso: colors.cyan, resuelto: colors.green };
const MAX_RESOLVED = 30;

export default function KanbanBoard({ reports, buildingNames, onOpen, onMove, newFolios }) {
  const [over, setOver] = useState(null); // columna sobre la que se arrastra

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATES.map((state) => {
        const items = reports
          .filter((r) => r.estado === state.key)
          .sort(
            (a, b) =>
              (PRIORITY_ORDER[a.prioridad] ?? 1) - (PRIORITY_ORDER[b.prioridad] ?? 1) ||
              (b.createdAt || '').localeCompare(a.createdAt || ''),
          );
        const shown = state.key === 'resuelto' ? items.slice(0, MAX_RESOLVED) : items;
        const isOver = over === state.key;

        return (
          <section
            key={state.key}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(state.key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const folio = event.dataTransfer.getData('text/plain');
              const report = reports.find((r) => r.folio === folio);
              if (report && report.estado !== state.key) onMove(folio, state.key);
            }}
            className="flex min-h-[420px] min-w-0 flex-col p-3"
            style={{
              backgroundColor: isOver ? alpha(colors.cyan, 0.12) : colors.blueTint,
              border: `2px dashed ${isOver ? colors.cyanDark : 'transparent'}`,
              borderRadius: 'var(--radius-card)',
            }}
            aria-label={`Columna ${state.label}`}
          >
            <header className="flex items-center gap-2 px-2 pb-3 pt-1">
              <span
                className="inline-block h-[11px] w-[11px] rounded-full"
                style={{ backgroundColor: STATE_DOT[state.key] }}
              />
              <span className="flex-1 text-sm font-black">{state.label}</span>
              <span className="text-sm font-black">{items.length}</span>
            </header>

            <div className="grid min-w-0 gap-2">
              {shown.map((report) => (
                <ReportCard
                  key={report.folio}
                  report={report}
                  location={locationText(report, buildingNames)}
                  onOpen={() => onOpen(report.folio)}
                  compact
                  draggable
                  isNew={newFolios.has(report.folio)}
                />
              ))}
              {items.length === 0 && (
                <p className="m-0 px-2 py-6 text-center text-xs" style={{ color: colors.textMuted }}>
                  Sin reportes aquí
                </p>
              )}
              {items.length > shown.length && (
                <p className="m-0 px-2 py-2 text-center text-xs" style={{ color: colors.textMuted }}>
                  +{items.length - shown.length} más (usa la vista de lista o los filtros)
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
