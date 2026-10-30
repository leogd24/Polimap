// src/components/EncuestaAviso.jsx — Responsable: Alexis (dentro del PostCard de Avisos)
// =====================================================================
// Encuesta rápida de un aviso ("¿Qué día prefieren la feria?").
//   - Antes de votar: opciones como botones (radio o casillas si es múltiple).
//     Los resultados NO se ven hasta votar, para no votar "por la mayoría".
//   - Al votar: barras con el % de cada opción, tu opción con palomita,
//     "23 votos · cierra en 2 días" y "Cambiar mi voto".
//   - Cerrada: solo resultados (con la ganadora resaltada).
//   - Invitado: al tocar una opción se le pide iniciar sesión.
//
// Props:
//   avisoId, poll (ver votePoll en src/lib/api.js)
//   user                 null = invitado
//   onChange(poll)       la encuesta actualizada (para el feed)
//   onRequestLogin()     opcional
// =====================================================================
import { useEffect, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { votePoll } from '../lib/api.js';

/** "cierra en 2 días" / "cierra hoy a las 18:00" / "cerró el 12 de octubre". */
function textoCierre(poll) {
  if (!poll.closesAt) return poll.closed ? 'Cerrada' : '';
  const f = new Date(poll.closesAt);
  if (Number.isNaN(f.getTime())) return '';
  if (poll.closed) return `Cerró el ${f.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`;
  const horas = (f - Date.now()) / 3600000;
  const hora = f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (horas < 1) return 'Cierra en menos de una hora';
  if (f.toDateString() === new Date().toDateString()) return `Cierra hoy a las ${hora}`;
  const dias = Math.ceil(horas / 24);
  return dias === 1 ? `Cierra mañana a las ${hora}` : `Cierra en ${dias} días`;
}

export default function EncuestaAviso({ avisoId, poll: inicial, user, onChange, onRequestLogin }) {
  const [poll, setPoll] = useState(inicial);
  const [elegidas, setElegidas] = useState([]); // casillas marcadas (múltiple)
  const [cambiando, setCambiando] = useState(false); // "Cambiar mi voto"
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Si el feed trae una versión nueva (recargó), úsala.
  useEffect(() => setPoll(inicial), [inicial]);

  const yaVote = poll.myVotes.length > 0;
  // Se ven las barras si ya votaste (y no estás cambiando tu voto) o si ya cerró.
  const verResultados = poll.closed || (poll.showResults && !cambiando);
  const total = poll.options.reduce((s, o) => s + (o.votes ?? 0), 0);
  const max = Math.max(0, ...poll.options.map((o) => o.votes ?? 0));
  const cierre = textoCierre(poll);

  function avisar(t) {
    setMensaje(t);
    setTimeout(() => setMensaje(''), 3000);
  }

  async function votar(ids) {
    if (!user) {
      avisar('Inicia sesión para votar');
      onRequestLogin?.();
      return;
    }
    if (!ids.length || enviando) return;
    setEnviando(true);
    try {
      const r = await votePoll(avisoId, ids);
      setPoll(r.poll);
      onChange?.(r.poll);
      setCambiando(false);
      setElegidas([]);
    } catch (e) {
      avisar(e.message || 'No se pudo votar. Revisa tu internet.');
    } finally {
      setEnviando(false);
    }
  }

  function tocar(id) {
    if (poll.multiple) setElegidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    else votar([id]);
  }

  return (
    <section
      className="mt-3 p-3"
      style={{ borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.background }}
      aria-label={`Encuesta: ${poll.question}`}
    >
      <div className="flex items-start gap-2">
        <Icon name="ballot" size={20} color={colors.ink} />
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-black leading-snug" style={{ color: colors.textPrimary }}>
            {poll.question}
          </div>
          <div className="text-xs" style={{ color: colors.textSecondary }}>
            {poll.closed ? 'Encuesta cerrada' : poll.multiple ? 'Puedes elegir varias' : 'Elige una opción'}
          </div>
        </div>
      </div>

      {verResultados ? (
        // Resultados
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {poll.options.map((o) => {
            const pct = total ? Math.round(((o.votes ?? 0) / total) * 100) : 0;
            const mia = poll.myVotes.includes(o.id);
            const gana = poll.closed && max > 0 && o.votes === max;
            return (
              <li key={o.id} className="relative overflow-hidden" style={{ borderRadius: 12, border: `1px solid ${mia ? colors.ink : colors.border}`, backgroundColor: colors.surface }}>
                <span
                  aria-hidden
                  className="encuesta-barra absolute inset-y-0 left-0"
                  style={{ width: `${pct}%`, backgroundColor: alpha(gana ? colors.gold : colors.cyan, gana ? 0.35 : 0.22) }}
                />
                <span className="relative flex items-center gap-2 px-3 py-[10px] text-sm">
                  {mia && <Icon name="check_circle" size={18} filled color={colors.ink} />}
                  <span className={`min-w-0 flex-1 ${mia || gana ? 'font-black' : 'font-bold'}`} style={{ color: colors.textPrimary }}>
                    {o.text}
                  </span>
                  <span className="shrink-0 font-black tabular-nums" style={{ color: colors.textPrimary }}>
                    {pct}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        // Opciones para votar
        <div className="mt-3 flex flex-col gap-2" role={poll.multiple ? 'group' : 'radiogroup'} aria-label={poll.question}>
          {poll.options.map((o) => {
            const marcada = poll.multiple ? elegidas.includes(o.id) : poll.myVotes.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role={poll.multiple ? 'checkbox' : 'radio'}
                aria-checked={marcada}
                disabled={enviando || poll.closed}
                onClick={() => tocar(o.id)}
                className="tappable flex min-h-[44px] items-center gap-3 px-3 py-2 text-left text-sm font-bold"
                style={{
                  borderRadius: 12,
                  border: `1.5px solid ${marcada ? colors.ink : colors.border}`,
                  backgroundColor: marcada ? alpha(colors.cyan, 0.12) : colors.surface,
                  color: colors.textPrimary,
                }}
              >
                <Icon
                  name={poll.multiple ? (marcada ? 'check_box' : 'check_box_outline_blank') : marcada ? 'radio_button_checked' : 'radio_button_unchecked'}
                  size={20}
                  color={marcada ? colors.ink : colors.textMuted}
                />
                <span className="min-w-0 flex-1">{o.text}</span>
              </button>
            );
          })}
          {poll.multiple && (
            <button
              type="button"
              onClick={() => votar(elegidas)}
              disabled={!elegidas.length || enviando}
              className="tappable mt-1 min-h-[44px] border-0 px-4 text-sm font-extrabold"
              style={{
                borderRadius: 12,
                backgroundColor: elegidas.length ? colors.blue : colors.blueTint,
                color: elegidas.length ? colors.white : colors.textMuted,
              }}
            >
              {enviando ? 'Enviando…' : elegidas.length ? `Votar (${elegidas.length})` : 'Marca tus opciones'}
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: colors.textSecondary }}>
        <span>
          {poll.voters} {poll.voters === 1 ? 'voto' : 'votos'}
        </span>
        {cierre && <span>· {cierre}</span>}
        {!verResultados && !poll.closed && !yaVote && <span>· Verás los resultados al votar</span>}
        {yaVote && !poll.closed && !cambiando && (
          <button type="button" onClick={() => setCambiando(true)} className="ml-auto border-0 bg-transparent p-0 text-xs font-black underline" style={{ color: colors.ink }}>
            Cambiar mi voto
          </button>
        )}
        {cambiando && (
          <button type="button" onClick={() => setCambiando(false)} className="ml-auto border-0 bg-transparent p-0 text-xs font-black underline" style={{ color: colors.ink }}>
            Cancelar
          </button>
        )}
      </div>
      {mensaje && (
        <div className="mt-2 text-xs font-bold" role="status" style={{ color: colors.crimsonDark }}>
          {mensaje}
        </div>
      )}
      <style>{`.encuesta-barra{transition:width .6s ease}@media (prefers-reduced-motion: reduce){.encuesta-barra{transition:none}}`}</style>
    </section>
  );
}
