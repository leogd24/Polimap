// src/admin/PollEditor.jsx — Responsable: Alexis
// Encuesta rápida dentro del formulario de avisos (NoticesSection.jsx).
//   - Botón "Agregar encuesta" → pregunta, de 2 a 6 opciones, "varias
//     respuestas" y fecha de cierre opcional.
//   - Al editar un aviso que ya tiene votos, las opciones conservan su id
//     (y sus votos). Si cambias el texto de una opción, sus votos se quedan.
//   - "Quitar encuesta" manda poll: null y se borran la encuesta y sus votos.
//
// Props: value (poll o null), onChange(poll | null)
import { colors } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import { LineField, Switch } from '../components/Inputs.jsx';

const MAX = 6;

export function nuevaEncuesta() {
  return { question: '', multiple: false, closesAt: '', options: [{ text: '' }, { text: '' }] };
}

export default function PollEditor({ value, onChange }) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(nuevaEncuesta())}
        className="tappable flex h-10 items-center gap-2 border-0 bg-transparent px-0 text-sm font-black"
        style={{ color: colors.ink }}
      >
        <Icon name="add_circle" size={22} color={colors.ink} />
        Agregar una encuesta
      </button>
    );
  }
  const set = (cambios) => onChange({ ...value, ...cambios });
  const opciones = value.options ?? [];
  const setOpcion = (i, text) => set({ options: opciones.map((o, j) => (j === i ? { ...o, text } : o)) });
  const conVotos = opciones.some((o) => o.votes > 0);
  // Ícono de cada opción: círculo (una respuesta) o cuadro (varias), como Google Forms.
  const marca = value.multiple ? 'check_box_outline_blank' : 'radio_button_unchecked';

  return (
    <div className="flex flex-col gap-1">
      <LineField value={value.question ?? ''} onChange={(question) => set({ question })} placeholder="Pregunta (ej. ¿Qué día prefieren la feria?)" size="lg" maxLength={200} inputProps={{ 'aria-label': 'Pregunta de la encuesta' }} />
      <div className="mt-2 flex flex-col">
        {opciones.map((o, i) => (
          <div key={o.id ?? `n${i}`} className="flex items-center gap-3">
            <Icon name={marca} size={22} color={colors.textMuted} />
            <div className="min-w-0 flex-1">
              <LineField value={o.text} onChange={(t) => setOpcion(i, t)} placeholder={`Opción ${i + 1}`} maxLength={100} inputProps={{ 'aria-label': `Opción ${i + 1}` }} />
            </div>
            {o.votes > 0 && (
              <span className="shrink-0 text-xs font-bold" style={{ color: colors.textSecondary }}>
                {o.votes} {o.votes === 1 ? 'voto' : 'votos'}
              </span>
            )}
            <button
              type="button"
              disabled={opciones.length <= 2}
              onClick={() => set({ options: opciones.filter((_, j) => j !== i) })}
              aria-label={`Quitar opción ${i + 1}`}
              title="Quitar opción"
              className="tappable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent"
              style={{ opacity: opciones.length <= 2 ? 0.3 : 1 }}
            >
              <Icon name="close" size={20} color={colors.textSecondary} />
            </button>
          </div>
        ))}
        {opciones.length < MAX && (
          <button
            type="button"
            onClick={() => set({ options: [...opciones, { text: '' }] })}
            className="tappable flex h-11 items-center gap-3 border-0 bg-transparent px-0 text-left text-[0.9375rem]"
            style={{ color: colors.textSecondary }}
          >
            <Icon name={marca} size={22} color={colors.textMuted} />
            Agregar opción
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-sm" style={{ borderTop: `1px solid ${colors.border}` }}>
        <label className="flex cursor-pointer items-center gap-2 font-bold">
          <Switch value={Boolean(value.multiple)} onChange={(v) => set({ multiple: v })} label="Varias respuestas" />
          Varias respuestas
        </label>
        <label className="flex items-center gap-2 font-bold">
          <Icon name="schedule" size={20} color={colors.textSecondary} />
          Cierra
          <input
            type="datetime-local"
            value={(value.closesAt ?? '').slice(0, 16)}
            onChange={(e) => set({ closesAt: e.target.value })}
            className="h-9 px-2 text-sm"
            style={{ borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (!conVotos || window.confirm('Esta encuesta ya tiene votos. ¿Quitarla y borrar los votos?')) onChange(null);
          }}
          className="tappable ml-auto flex h-9 items-center gap-1 border-0 bg-transparent px-0 text-sm font-black"
          style={{ color: colors.crimsonDark }}
        >
          <Icon name="delete" size={18} color={colors.crimsonDark} />
          Quitar encuesta
        </button>
      </div>
      <p className="m-0 mt-1 text-xs" style={{ color: colors.textSecondary }}>
        Sin fecha de cierre, se vota mientras el aviso esté visible. Los alumnos ven los resultados después de votar.
      </p>
    </div>
  );
}

/** Resumen de resultados para la tarjeta del aviso en la lista. */
export function ResultadosEncuesta({ poll }) {
  const total = poll.options.reduce((s, o) => s + (o.votes ?? 0), 0);
  return (
    <div className="mt-2 p-3" style={{ borderRadius: 12, backgroundColor: colors.background }}>
      <div className="flex items-center gap-1 text-xs font-black">
        <Icon name="ballot" size={15} color={colors.ink} />
        <span className="min-w-0 flex-1 truncate">{poll.question}</span>
        <span style={{ color: colors.textSecondary }}>
          {poll.voters} {poll.voters === 1 ? 'votante' : 'votantes'}
          {poll.closed ? ' · cerrada' : ''}
        </span>
      </div>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        {poll.options.map((o) => {
          const pct = total ? Math.round(((o.votes ?? 0) / total) * 100) : 0;
          return (
            <li key={o.id} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate font-bold">{o.text}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.blueTint }}>
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors.cyanSolid }} />
              </span>
              <span className="w-14 shrink-0 text-right font-black tabular-nums">
                {o.votes ?? 0} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
