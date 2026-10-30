// src/admin/PausarDialog.jsx — Responsable: Alexis
// =====================================================================
// Ventana para "Pausar cuenta" (sección Comentarios del panel). Reemplaza
// a las ventanitas del navegador (window.prompt).
//   - Cuánto tiempo: 1 día, 7 días, 30 días o Permanente.
//     Permanente: no vence y SOLO la cuenta maestra la puede quitar.
//   - Motivo rápido (chips) o escrito. Lo ven solo los admins (Historial).
//   - La pausa aplica a comentarios, objetos perdidos, fechas y avisos de grupo.
// Props: autor ({ id, nombre, correo, foto }), onConfirmar(dias, motivo), onCerrar()
//        dias: 1 | 7 | 30 | 0 (0 = permanente)
// =====================================================================
import { useEffect, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { TextField } from '../components/Inputs.jsx';

const DURACIONES = [
  { dias: 1, titulo: '1 día', texto: 'Un aviso', icon: 'hourglass_bottom' },
  { dias: 7, titulo: '7 días', texto: 'Una semana', icon: 'date_range' },
  { dias: 30, titulo: '30 días', texto: 'Un mes', icon: 'calendar_month' },
  { dias: 0, titulo: 'Permanente', texto: 'Solo la cuenta maestra la quita', icon: 'block', grave: true },
];
const MOTIVOS = ['Groserías', 'Acoso o burlas', 'Spam', 'Datos personales', 'Insiste después de bloqueos'];

export default function PausarDialog({ autor, onConfirmar, onCerrar }) {
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState('');

  // Esc cierra.
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const nombre = autor.nombre || autor.correo;
  const elegida = DURACIONES.find((d) => d.dias === dias);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" style={{ backgroundColor: alpha('#000000', 0.5) }} onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pausar a ${nombre}`}
        className="pausa-hoja w-full max-w-[480px] overflow-hidden"
        style={{ backgroundColor: colors.surface, borderRadius: '28px 28px 0 0', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`.pausa-hoja{animation:pausa-sube .2s ease-out both}@media (min-width:640px){.pausa-hoja{border-radius:28px!important}}@keyframes pausa-sube{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.pausa-hoja{animation:none}}`}</style>

        {/* Encabezado: a quién */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <UserAvatar user={autor} size={44} ring={colors.border} />
          <div className="min-w-0 flex-1">
            <div className="text-[0.6875rem] font-black uppercase" style={{ color: colors.crimsonDark, letterSpacing: 0.6 }}>
              Pausar cuenta
            </div>
            <div className="truncate text-base font-black" style={{ color: colors.textPrimary }}>
              {nombre}
            </div>
            {autor.nombre && (
              <div className="truncate text-xs" style={{ color: colors.textSecondary }}>
                {autor.correo}
              </div>
            )}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
            <Icon name="close" color={colors.textPrimary} />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <p className="m-0 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
            No podrá comentar ni publicar (objetos perdidos, fechas y avisos de grupo). Sí podrá usar el resto de la app.
          </p>

          {/* Duración */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cuánto tiempo">
            {DURACIONES.map((d) => {
              const sel = d.dias === dias;
              const tono = d.grave ? colors.crimsonDark : colors.ink;
              return (
                <button
                  key={d.dias}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setDias(d.dias)}
                  className="tappable flex items-center gap-3 p-3 text-left"
                  style={{
                    borderRadius: 16,
                    border: `${sel ? 2 : 1}px solid ${sel ? tono : colors.border}`,
                    backgroundColor: sel ? alpha(d.grave ? colors.crimson : colors.ink, 0.07) : colors.surface,
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ borderRadius: 11, backgroundColor: d.grave ? colors.crimsonTint : colors.blueTint }}>
                    <Icon name={d.icon} size={20} color={tono} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black" style={{ color: d.grave ? colors.crimsonDark : colors.textPrimary }}>
                      {d.titulo}
                    </span>
                    <span className="block text-[0.6875rem] leading-tight" style={{ color: colors.textSecondary }}>
                      {d.texto}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Motivo */}
          <div>
            <div className="mb-2 text-xs font-black" style={{ color: colors.textSecondary }}>
              Motivo (solo lo ven los admins)
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {MOTIVOS.map((m) => {
                const sel = motivo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivo(sel ? '' : m)}
                    aria-pressed={sel}
                    className="tappable flex h-8 items-center gap-1 px-3 text-xs font-bold"
                    style={{ borderRadius: 999, border: `1px solid ${sel ? 'transparent' : colors.border}`, backgroundColor: sel ? colors.blueTint : colors.surface, color: sel ? colors.ink : colors.textSecondary }}
                  >
                    {sel && <Icon name="check" size={14} color={colors.ink} />}
                    {m}
                  </button>
                );
              })}
            </div>
            <TextField value={motivo} onChange={setMotivo} placeholder="O escribe el motivo…" prefixIcon="edit_note" inputProps={{ maxLength: 120, 'aria-label': 'Motivo' }} />
          </div>

          {elegida?.grave && (
            <div className="flex items-start gap-2 p-3 text-xs" role="note" style={{ borderRadius: 14, backgroundColor: colors.crimsonTint, color: colors.crimsonDark, lineHeight: 1.45 }}>
              <Icon name="gpp_maybe" size={18} color={colors.crimsonDark} />
              <span>
                <b>Pausa permanente:</b> no vence sola y solo la cuenta maestra la puede quitar. Úsala para casos graves (acoso, amenazas).
              </span>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2 px-5 pt-1 pb-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onCerrar} className="tappable h-12 flex-1 text-sm font-black" style={{ borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(dias, motivo.trim())}
            className="tappable flex h-12 flex-[1.4] items-center justify-center gap-2 border-0 text-sm font-black"
            style={{ borderRadius: 14, backgroundColor: colors.crimsonSolid, color: colors.white }}
          >
            <Icon name="voice_over_off" size={18} color={colors.white} />
            {dias === 0 ? 'Pausar para siempre' : `Pausar ${elegida?.titulo}`}
          </button>
        </div>
      </div>
    </div>
  );
}
