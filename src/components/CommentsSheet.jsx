// src/components/CommentsSheet.jsx — Responsable: Alexis
// =====================================================================
// Hoja de COMENTARIOS de un aviso (sube desde abajo, como en Instagram).
//
//   - Comentarios con nombre y foto de la cuenta UdeG; los del equipo
//     llevan la etiqueta "POLIMAP".
//   - Responder (un nivel), Reportar (con motivo) y Borrar (los tuyos).
//   - Abajo, la caja para escribir. Si el filtro bloquea el comentario,
//     se explica por qué y el texto NO se borra, para poder corregirlo.
//   - Se actualiza sola cada 20 s mientras está abierta.
//
// Props: notice, user, onClose, onRequestLogin, onCountChange(n)
// API: getComments, postComment, reportComment, deleteComment (src/lib/api.js)
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import UserAvatar from './UserAvatar.jsx';
import PolimapLogo from './PolimapLogo.jsx';
import { getComments, postComment, reportComment, deleteComment } from '../lib/api.js';
import { haceCorto } from '../lib/tiempo.js';

const MOTIVOS = [
  { key: 'ofensivo', label: 'Ofensivo o grosero', icon: 'sentiment_very_dissatisfied' },
  { key: 'acoso', label: 'Acoso o burla a alguien', icon: 'person_off' },
  { key: 'spam', label: 'Spam o publicidad', icon: 'block' },
  { key: 'datos', label: 'Datos personales', icon: 'badge' },
  { key: 'otro', label: 'Otro motivo', icon: 'more_horiz' },
];

export default function CommentsSheet({ notice, user, onClose, onRequestLogin, onCountChange }) {
  const [data, setData] = useState(null); // respuesta de getComments
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [respondiendo, setRespondiendo] = useState(null); // { id, nombre }
  const [enviando, setEnviando] = useState(false);
  const [bloqueo, setBloqueo] = useState(''); // mensaje del filtro
  const [reportando, setReportando] = useState(null); // comentario a reportar
  const [aviso, setAviso] = useState(''); // mensajito temporal ("Gracias…")
  const [abiertas, setAbiertas] = useState({}); // respuestas desplegadas
  const lista = useRef(null);
  const caja = useRef(null);

  // Las funciones del padre van en refs para no recargar en cada render.
  const contar = useRef(onCountChange);
  contar.current = onCountChange;
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  const cargar = useCallback(async () => {
    try {
      const d = await getComments(notice.id);
      setData(d);
      contar.current?.(d.total);
      setError('');
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los comentarios');
    }
  }, [notice.id]);

  // Al abrir y cada 20 s.
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 20000);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => e.key === 'Escape' && cerrar.current();
    window.addEventListener('keydown', esc);
    return () => {
      clearInterval(id);
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', esc);
    };
  }, [cargar]);

  function mostrar(mensaje) {
    setAviso(mensaje);
    setTimeout(() => setAviso(''), 3000);
  }

  async function publicar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setBloqueo('');
    try {
      const r = await postComment(notice.id, t, respondiendo?.id ?? null);
      setTexto('');
      if (respondiendo) setAbiertas((a) => ({ ...a, [r.comment.parent]: true }));
      setRespondiendo(null);
      await cargar();
      // Baja hasta el comentario nuevo.
      setTimeout(() => lista.current?.querySelector(`[data-id="${r.comment.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    } catch (e) {
      // 422 = lo bloqueó el filtro; 403/429 = pausa o límite. El texto se queda para corregirlo.
      setBloqueo(e.message || 'No se pudo publicar');
    } finally {
      setEnviando(false);
    }
  }

  async function reportar(motivo) {
    const c = reportando;
    setReportando(null);
    try {
      const r = await reportComment(c.id, motivo);
      mostrar(r.mensaje || 'Gracias por avisar');
      cargar();
    } catch (e) {
      mostrar(e.message);
    }
  }

  async function borrar(c) {
    if (!window.confirm('¿Borrar este comentario?')) return;
    try {
      await deleteComment(c.id);
      mostrar('Comentario borrado');
      cargar();
    } catch (e) {
      mostrar(e.message);
    }
  }

  function responder(c, raiz) {
    setRespondiendo({ id: c.id, nombre: c.author.nombre });
    setAbiertas((a) => ({ ...a, [raiz.id]: true }));
    // Etiqueta a la persona, como Instagram.
    setTexto((t) => (t.startsWith('@') ? t : `@${c.author.nombre.split(' ')[0]} ${t}`));
    setTimeout(() => caja.current?.focus(), 30);
  }

  const comentarios = data?.comments ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      style={{ backgroundColor: alpha('#000000', 0.5) }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Comentarios de ${notice.title}`}
    >
      <style>{ESTILOS}</style>
      <div
        className="cs-hoja flex h-[88dvh] w-full max-w-[560px] flex-col"
        style={{ backgroundColor: colors.surface, borderRadius: '24px 24px 0 0' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="shrink-0 px-4 pt-2 pb-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="mx-auto mb-2 h-[5px] w-10 rounded-full sm:hidden" style={{ backgroundColor: colors.border }} />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-base font-black">Comentarios</div>
              <div className="truncate text-xs" style={{ color: colors.textMuted }}>
                {notice.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
              style={{ backgroundColor: colors.background }}
            >
              <Icon name="close" color={colors.textPrimary} />
            </button>
          </div>
          {/* Reglas, siempre visibles y cortitas */}
          <div
            className="mt-2 flex items-start gap-2 px-3 py-2 text-xs"
            style={{ backgroundColor: colors.cyanTint, color: colors.cyanDark, borderRadius: 12, lineHeight: 1.35 }}
          >
            <Icon name="shield_person" size={16} color={colors.cyanDark} />
            <span>
              Espacio de la comunidad del Poli: comenta con respeto. Se publica con tu nombre UdeG; las groserías,
              amenazas y datos personales se bloquean, y cualquiera puede reportar.
            </span>
          </div>
        </div>

        {/* Lista */}
        <div ref={lista} className="app-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!data && !error && (
            <div className="py-10 text-center text-sm" style={{ color: colors.textMuted }}>
              Cargando comentarios…
            </div>
          )}
          {error && (
            <div className="py-10 text-center text-sm" style={{ color: colors.crimsonDark }}>
              {error}
            </div>
          )}
          {data && comentarios.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center" style={{ color: colors.textMuted }}>
              <Icon name="forum" size={44} color={colors.border} />
              <div className="font-bold" style={{ color: colors.textSecondary }}>
                Todavía no hay comentarios
              </div>
              <div className="text-sm">{data.canComment ? '¿Tienes una duda? Pregunta aquí.' : ''}</div>
            </div>
          )}
          <ul className="m-0 grid list-none gap-4 p-0">
            {comentarios.map((c) => {
              const visibles = abiertas[c.id] || c.replies.length <= 1 ? c.replies : [];
              return (
                <li key={c.id}>
                  {c.removed ? (
                    <div className="flex items-center gap-3 text-sm italic" style={{ color: colors.textMuted }}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.background }}>
                        <Icon name="chat_bubble_outline" size={18} color={colors.textMuted} />
                      </span>
                      Comentario eliminado
                    </div>
                  ) : (
                    <Comentario
                      c={c}
                      user={user}
                      onReply={() => responder(c, c)}
                      onReport={() => setReportando(c)}
                      onDelete={() => borrar(c)}
                      puedeResponder={Boolean(data?.canComment)}
                    />
                  )}
                  {c.replies.length > 0 && (
                    <div className="mt-3 ml-12 grid gap-3">
                      {c.replies.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAbiertas((a) => ({ ...a, [c.id]: !a[c.id] }))}
                          className="flex items-center gap-2 border-0 bg-transparent p-0 text-xs font-bold"
                          style={{ color: colors.textMuted }}
                        >
                          <span className="inline-block h-px w-6" style={{ backgroundColor: colors.textMuted }} />
                          {abiertas[c.id] ? 'Ocultar respuestas' : `Ver ${c.replies.length} respuestas`}
                        </button>
                      )}
                      {visibles.map((r) => (
                        <Comentario
                          key={r.id}
                          c={r}
                          user={user}
                          small
                          onReply={() => responder(r, c)}
                          onReport={() => setReportando(r)}
                          onDelete={() => borrar(r)}
                          puedeResponder={Boolean(data?.canComment)}
                        />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {aviso && (
          <div className="mx-4 mb-2 px-3 py-2 text-center text-sm font-bold" style={{ backgroundColor: colors.blueDeep, color: colors.white, borderRadius: 12 }} role="status">
            {aviso}
          </div>
        )}

        {/* Caja para escribir */}
        <div
          className="shrink-0 px-3 pt-2"
          style={{ borderTop: `1px solid ${colors.border}`, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        >
          {!user ? (
            <button
              type="button"
              onClick={onRequestLogin}
              className="tappable my-1 flex min-h-[48px] w-full items-center justify-center gap-2 border-0 text-sm font-extrabold"
              style={{ backgroundColor: colors.blue, color: colors.white, borderRadius: 'var(--radius-button)' }}
            >
              <Icon name="login" size={20} color={colors.white} />
              Inicia sesión con tu correo @alumnos para comentar
            </button>
          ) : data && !data.allowComments ? (
            <Nota icon="comments_disabled" texto="Los comentarios de este aviso están cerrados." />
          ) : data?.paused ? (
            <Nota icon="hourglass_top" texto={data.paused} />
          ) : data && !data.canComment ? (
            <Nota icon="lock" texto="Solo las cuentas @alumnos.udg.mx pueden comentar." />
          ) : (
            <>
              {respondiendo && (
                <div className="mb-1 flex items-center justify-between px-2 text-xs" style={{ color: colors.textSecondary }}>
                  <span>
                    Respondiendo a <b>{respondiendo.nombre}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRespondiendo(null);
                      setTexto('');
                    }}
                    aria-label="Cancelar respuesta"
                    className="border-0 bg-transparent p-1"
                  >
                    <Icon name="close" size={16} color={colors.textSecondary} />
                  </button>
                </div>
              )}
              {bloqueo && (
                <div
                  className="mb-2 flex items-start gap-2 px-3 py-2 text-xs font-bold"
                  style={{ backgroundColor: colors.crimsonTint, color: colors.crimsonDark, borderRadius: 12, lineHeight: 1.35 }}
                  role="alert"
                >
                  <Icon name="block" size={16} color={colors.crimsonDark} />
                  {bloqueo}
                </div>
              )}
              <div className="flex items-end gap-2">
                <UserAvatar user={user} size={36} ring={colors.border} />
                <div
                  className="flex min-h-[44px] flex-1 items-end gap-1 px-3 py-[6px]"
                  style={{ border: `1px solid ${bloqueo ? colors.crimson : colors.border}`, borderRadius: 22 }}
                >
                  <textarea
                    ref={caja}
                    value={texto}
                    onChange={(e) => {
                      setTexto(e.target.value.slice(0, 500));
                      if (bloqueo) setBloqueo('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        publicar();
                      }
                    }}
                    rows={1}
                    placeholder={respondiendo ? 'Escribe tu respuesta…' : 'Agrega un comentario…'}
                    aria-label="Escribe un comentario"
                    className="max-h-[110px] min-h-[30px] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-[color:var(--color-text-muted)]"
                  />
                  <button
                    type="button"
                    onClick={publicar}
                    disabled={!texto.trim() || enviando}
                    className="mb-[3px] border-0 bg-transparent px-1 text-sm font-black"
                    style={{ color: texto.trim() ? colors.cyanDark : colors.textMuted }}
                  >
                    {enviando ? '…' : 'Publicar'}
                  </button>
                </div>
              </div>
              {texto.length > 400 && (
                <div className="mt-1 text-right text-[0.6875rem]" style={{ color: colors.textMuted }}>
                  {texto.length}/500
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reportar: elegir motivo */}
      {reportando && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          style={{ backgroundColor: alpha('#000000', 0.35) }}
          onClick={(e) => {
            e.stopPropagation();
            setReportando(null);
          }}
        >
          <div
            className="w-full max-w-[420px] p-5"
            style={{ backgroundColor: colors.surface, borderRadius: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-black">¿Por qué reportas este comentario?</div>
            <p className="m-0 mt-1 text-xs" style={{ color: colors.textMuted }}>
              Nadie sabrá que fuiste tú. Con 3 reportes se oculta mientras el equipo lo revisa.
            </p>
            <div className="mt-3 grid gap-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => reportar(m.key)}
                  className="tappable flex items-center gap-3 px-3 py-3 text-left text-sm font-bold"
                  style={{ backgroundColor: colors.background, borderRadius: 14, border: `1px solid ${colors.border}` }}
                >
                  <Icon name={m.icon} size={20} color={colors.crimsonDark} />
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setReportando(null)}
              className="mt-3 w-full border-0 bg-transparent py-2 text-sm font-bold"
              style={{ color: colors.textSecondary }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Un comentario (o respuesta). */
function Comentario({ c, user, small = false, onReply, onReport, onDelete, puedeResponder }) {
  const [menu, setMenu] = useState(false);
  return (
    <div data-id={c.id} className="flex gap-3">
      {c.author.admin ? (
        <span className="shrink-0">
          <PolimapLogo size={small ? 28 : 36} />
        </span>
      ) : (
        <UserAvatar user={c.author} size={small ? 28 : 36} ring={colors.surface} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug" style={{ color: colors.textPrimary }}>
          <span className="font-black">{c.author.nombre}</span>
          {c.author.admin && (
            <span
              className="ml-1 inline-flex translate-y-[-1px] items-center gap-[2px] px-[6px] py-[1px] align-middle text-[0.625rem] font-black"
              style={{ backgroundColor: colors.cyanTint, color: colors.cyanDark, borderRadius: 6 }}
            >
              <Icon name="verified" size={12} color={colors.cyanDark} />
              POLIMAP
            </span>
          )}{' '}
          <span className="whitespace-pre-line break-words">{resaltarMenciones(c.text)}</span>
        </div>
        <div className="mt-1 flex items-center gap-4 text-xs font-bold" style={{ color: colors.textMuted }}>
          <span className="font-normal">{haceCorto(c.createdAt)}</span>
          {puedeResponder && (
            <button type="button" onClick={onReply} className="border-0 bg-transparent p-0 font-bold" style={{ color: colors.textMuted }}>
              Responder
            </button>
          )}
          {user && (
            <span className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-label="Más opciones"
                className="flex border-0 bg-transparent p-0"
              >
                <Icon name="more_horiz" size={18} color={colors.textMuted} />
              </button>
              {menu && (
                <span
                  className="absolute left-0 top-6 z-10 grid w-[150px] overflow-hidden"
                  style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, boxShadow: `0 8px 20px ${alpha('#000000', 0.15)}` }}
                >
                  {!c.mine && (
                    <MenuItem
                      icon="flag"
                      label="Reportar"
                      onClick={() => {
                        setMenu(false);
                        onReport();
                      }}
                      danger
                    />
                  )}
                  {c.canDelete && (
                    <MenuItem
                      icon="delete"
                      label="Borrar"
                      onClick={() => {
                        setMenu(false);
                        onDelete();
                      }}
                      danger
                    />
                  )}
                  <MenuItem icon="close" label="Cancelar" onClick={() => setMenu(false)} />
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm font-bold"
      style={{ color: danger ? colors.crimsonDark : colors.textSecondary }}
    >
      <Icon name={icon} size={18} color={danger ? colors.crimsonDark : colors.textSecondary} />
      {label}
    </button>
  );
}

function Nota({ icon, texto }) {
  return (
    <div className="my-2 flex items-center justify-center gap-2 px-3 text-center text-sm" style={{ color: colors.textSecondary }}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      {texto}
    </div>
  );
}

/** "@Ana gracias" → "@Ana" en azul. */
function resaltarMenciones(texto) {
  return String(texto ?? '')
    .split(/(@[\p{L}]+)/u)
    .map((parte, i) =>
      parte.startsWith('@') ? (
        <span key={i} className="font-bold" style={{ color: colors.cyanDark }}>
          {parte}
        </span>
      ) : (
        parte
      )
    );
}

const ESTILOS = `
.cs-hoja { animation: cs-sube .26s cubic-bezier(.2,.8,.2,1) both; }
@media (min-width: 640px) { .cs-hoja { border-radius: 24px !important; height: min(80dvh, 760px) !important; } }
@keyframes cs-sube { from { transform: translateY(50px); opacity: .5; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .cs-hoja { animation: none; } }
`;
