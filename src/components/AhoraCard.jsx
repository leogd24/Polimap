// src/components/AhoraCard.jsx — Responsable: Alexis (pantalla de Horario)
// Tarjeta de arriba del horario: "¿qué me toca?"
//   - En clase: materia, salón, barra de avance y "faltan 25 min".
//   - Entre clases o antes de entrar: la siguiente y en cuánto empieza.
//   - Ya terminó / fin de semana: cuándo es la próxima clase.
// Tocar el salón abre la hoja con el salón y "Ver en el mapa".
//
// Props: estado (de estadoAhora()), onAbrirClase(clase)
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { aHora, aMinutos, duracion, materiaBonita } from '../lib/horario.js';

export default function AhoraCard({ estado, onAbrirClase }) {
  const { actual, siguiente } = estado;

  let etiqueta;
  let titulo;
  let clase;
  let detalle;
  if (actual) {
    etiqueta = 'Ahora';
    clase = actual.clase;
    titulo = materiaBonita(clase.subject);
    detalle = `Termina a las ${aHora(aMinutos(clase.end))} · faltan ${duracion(actual.faltan)}`;
  } else if (siguiente?.hoy) {
    etiqueta = estado.estado === 'antes' ? 'Hoy entras' : 'Sigue';
    clase = siguiente.clase;
    titulo = materiaBonita(clase.subject);
    detalle = siguiente.en <= 60 ? `Empieza en ${duracion(siguiente.en)} · a las ${clase.start}` : `A las ${clase.start} (en ${duracion(siguiente.en)})`;
  } else if (siguiente) {
    etiqueta = estado.estado === 'termino' ? 'Ya terminaste por hoy' : 'Sin clases hoy';
    clase = siguiente.clase;
    titulo = materiaBonita(clase.subject);
    detalle = `${siguiente.manana ? 'Mañana' : `El ${siguiente.dia.toLowerCase()}`} entras a las ${clase.start}`;
  } else {
    return null;
  }

  const enClase = Boolean(actual);

  return (
    <section
      className="relative overflow-hidden p-4"
      style={{
        borderRadius: 22,
        color: colors.white,
        background: enClase
          ? `linear-gradient(135deg, ${colors.blue}, ${colors.blueSteel})`
          : `linear-gradient(135deg, ${colors.blueSteel}, ${colors.blue})`,
      }}
      aria-live="polite"
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full" style={{ backgroundColor: alpha(colors.white, 0.06) }} />
      <div className="flex items-center gap-2 text-xs font-black uppercase" style={{ letterSpacing: 0.6, color: enClase ? colors.gold : alpha(colors.white, 0.75) }}>
        {enClase && <span className="ahora-punto h-2 w-2 rounded-full" style={{ backgroundColor: colors.gold }} />}
        {etiqueta}
      </div>
      <div className="mt-1 text-xl font-black leading-tight">{titulo}</div>
      <div className="mt-1 text-sm" style={{ color: alpha(colors.white, 0.85) }}>
        {detalle}
      </div>

      {enClase && (
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: alpha(colors.white, 0.18) }} role="progressbar" aria-valuenow={Math.round(actual.progreso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la clase">
          <div className="h-full rounded-full" style={{ width: `${Math.max(4, actual.progreso * 100)}%`, backgroundColor: colors.gold }} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAbrirClase(clase)}
          className="tappable flex h-10 items-center gap-1 border-0 px-3 text-sm font-black"
          style={{ borderRadius: 999, backgroundColor: colors.white, color: colors.blue }}
        >
          <Icon name="location_on" size={18} color={colors.crimson} />
          {clase.room}
        </button>
        {actual && siguiente?.hoy && (
          <span className="flex h-10 items-center gap-1 px-3 text-xs font-bold" style={{ borderRadius: 999, backgroundColor: alpha(colors.white, 0.14) }}>
            <Icon name="arrow_forward" size={16} color={colors.white} />
            Luego: {materiaBonita(siguiente.clase.subject)} · {siguiente.clase.start}
          </span>
        )}
      </div>
      <style>{`.ahora-punto{animation:ahora-punto 1.6s ease-in-out infinite}@keyframes ahora-punto{50%{opacity:.35}}@media (prefers-reduced-motion: reduce){.ahora-punto{animation:none}}`}</style>
    </section>
  );
}
