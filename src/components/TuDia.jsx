// src/components/TuDia.jsx — Responsable: Alexis (Inicio)
// =====================================================================
// "Tu día": línea del tiempo que mezcla, en orden de hora,
//   - tus clases (la de ahora en noche, con "ahora"),
//   - los exámenes y entregas de tu grupo (Horario → Fechas),
//   - los avisos urgentes de hoy.
// Si ya terminaste por hoy, muestra el siguiente día con clases ("Mañana").
//
// Props: grupo, estado (estadoAhora), m (momento), fechas (del grupo),
//        urgentes (avisos urgentes), onIrAHorario(), onIrAFechas(), onAbrirAviso(id)
// =====================================================================
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { aHora, aMinutos, clasesDelDia, infoSalon, masDias, materiaBonita } from '../lib/horario.js';
import { tipoFecha } from '../lib/calendarioGrupo.js';

const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MAX = 6;

/** Fecha (AAAA-MM-DD) del próximo día con ese nombre ("Lunes"). */
function fechaDe(nombreDia, desde) {
  for (let i = 1; i <= 7; i += 1) {
    const f = masDias(desde, i);
    if (NOMBRES[new Date(`${f}T12:00:00Z`).getUTCDay()] === nombreDia) return f;
  }
  return desde;
}

export default function TuDia({ grupo, estado, m, fechas = [], urgentes = [], onIrAHorario, onIrAFechas, onAbrirAviso }) {
  if (!grupo || !estado) return null;

  // ¿Hoy o el siguiente día con clases?
  const esHoy = ['clase', 'antes', 'hueco'].includes(estado.estado);
  const sig = estado.siguiente;
  const dia = esHoy ? m.dia : sig?.dia;
  if (!dia) return null;
  const fecha = esHoy ? m.fecha : fechaDe(dia, m.fecha);
  const titulo = esHoy ? 'Tu día' : sig.manana ? 'Mañana' : `El ${dia.toLowerCase()}`;

  // Renglones: clases + fechas del grupo + avisos urgentes (solo hoy).
  const items = [];
  clasesDelDia(grupo, dia)
    .filter((c) => !esHoy || aMinutos(c.end) > m.minuto)
    .forEach((c) => {
      const ahora = esHoy && aMinutos(c.start) <= m.minuto;
      items.push({
        key: `c-${c.start}-${c.subject}`,
        min: aMinutos(c.start),
        hora: c.start.replace(/^0/, ''),
        color: colors.magenta,
        titulo: materiaBonita(c.subject),
        sub: [infoSalon(c.room).ubicacion || c.room, ahora ? `ahora · hasta las ${aHora(aMinutos(c.end)).replace(/^0/, '')}` : ''].filter(Boolean).join(' · '),
        ahora,
        onClick: onIrAHorario,
      });
    });
  fechas
    .filter((f) => f.fecha === fecha)
    .forEach((f) => {
      const t = tipoFecha(f.tipo);
      items.push({
        key: `f-${f.id}`,
        min: f.hora ? aMinutos(f.hora) : -1,
        hora: f.hora ? f.hora.replace(/^0/, '') : esHoy ? 'Hoy' : '—',
        color: colors.crimson,
        icon: t.icon,
        titulo: `${t.label}: ${f.titulo}`,
        sub: f.materia ? materiaBonita(f.materia) : f.detalle || 'Fecha del grupo',
        resaltar: colors.crimsonTint,
        onClick: onIrAFechas,
      });
    });
  if (esHoy) {
    urgentes.forEach((n) =>
      items.push({
        key: `a-${n.id}`,
        min: -2,
        hora: 'Hoy',
        color: colors.crimson,
        icon: 'warning',
        titulo: n.title,
        sub: 'Aviso urgente',
        resaltar: colors.crimsonTint,
        onClick: () => onAbrirAviso?.(n.id),
      })
    );
  }
  items.sort((a, b) => a.min - b.min);
  const visibles = items.slice(0, MAX);

  return (
    <section aria-label={titulo}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 text-[1.0625rem] font-black" style={{ color: colors.textPrimary }}>
          {titulo}
        </h3>
        <button type="button" onClick={onIrAHorario} className="tappable border-0 bg-transparent p-0 text-[0.8125rem] font-bold" style={{ color: colors.cyanDark }}>
          Ver mi horario
        </button>
      </div>
      {visibles.length === 0 ? (
        <p className="m-0 text-sm" style={{ color: colors.textSecondary }}>
          Nada pendiente por hoy.
        </p>
      ) : (
        <ol className="m-0 list-none p-0">
          {visibles.map((it, i) => (
            <li key={it.key} className="flex gap-3">
              <span className="w-[42px] shrink-0 pt-[13px] text-right text-xs font-black tabular-nums" style={{ color: colors.textSecondary }}>
                {it.hora}
              </span>
              {/* Punto y línea */}
              <span className="flex w-3 shrink-0 flex-col items-center" aria-hidden>
                <span className="mt-[15px] h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: it.color, boxShadow: `0 0 0 3px ${alpha(it.color, 0.2)}` }} />
                {i < visibles.length - 1 && <span className="w-[2px] flex-1" style={{ backgroundColor: colors.border }} />}
              </span>
              <button
                type="button"
                onClick={it.onClick}
                className="tappable mb-2 flex min-w-0 flex-1 items-center gap-2 px-3 py-[10px] text-left"
                style={{
                  borderRadius: 16,
                  border: `1px solid ${it.ahora ? colors.blue : it.resaltar ? alpha(colors.crimson, 0.3) : colors.border}`,
                  backgroundColor: it.ahora ? colors.blue : it.resaltar ?? colors.surface,
                  color: it.ahora ? colors.white : colors.textPrimary,
                }}
              >
                {it.icon && <Icon name={it.icon} size={20} color={colors.crimsonDark} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black" style={{ color: it.resaltar && !it.ahora ? colors.crimsonDark : undefined }}>
                    {it.titulo}
                  </span>
                  <span className="block truncate text-xs" style={{ color: it.ahora ? alpha(colors.white, 0.85) : colors.textSecondary }}>
                    {it.sub}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {items.length > MAX && (
        <button type="button" onClick={onIrAHorario} className="tappable ml-[66px] border-0 bg-transparent p-0 text-xs font-bold" style={{ color: colors.textSecondary }}>
          y {items.length - MAX} más…
        </button>
      )}
    </section>
  );
}
