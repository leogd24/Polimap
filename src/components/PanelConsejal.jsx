// src/components/PanelConsejal.jsx — Responsable: Alexis (Horario → Más)
// =====================================================================
// PANEL DE CONSEJAL (pantalla completa). Solo lo ven el consejal y el
// subconsejal que un admin designó para el grupo (panel → Usuarios y consejales).
//
//   Resumen    → tu dueto, números del grupo y accesos rápidos.
//   Avisos     → avisos SOLO para tu grupo (con encuesta opcional y
//                notificación a los celulares del grupo). Pasan por el
//                mismo filtro de palabras que los comentarios.
//   Fechas     → exámenes y entregas (CalendarioGrupo con editar).
//   Encuadres  → criterios y % de cada materia; el grupo los usa en Notas.
//   División   → dividir al grupo por semana (DivisionEditor).
//
// Props: codigo ('1AM TIN'), rol ('consejal' | 'subconsejal'), user, onClose()
// API: getGroupNotices, publishGroupNotice, deleteGroupNotice, saveGroupFraming
//      (+ getGroupCalendar a través de useCalendarioGrupo).
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BrandStripe from './BrandStripe.jsx';
import BottomSheet from './BottomSheet.jsx';
import FilledButton from './FilledButton.jsx';
import Snackbar from './Snackbar.jsx';
import UserAvatar from './UserAvatar.jsx';
import CalendarioGrupo from './CalendarioGrupo.jsx';
import DivisionEditor from './DivisionEditor.jsx';
import { TextField, TextArea, Switch } from './Inputs.jsx';
import useCalendarioGrupo from '../hooks/useCalendarioGrupo.js';
import useReloj from '../hooks/useReloj.js';
import { getGroupNotices, publishGroupNotice, deleteGroupNotice, saveGroupFraming } from '../lib/api.js';
import { estadoAhora, grupoPorCodigo, indicesDeMaterias, materiaBonita, momento } from '../lib/horario.js';
import { diasHasta } from '../lib/calendarioGrupo.js';

const PESTANAS = [
  { key: 'resumen', label: 'Resumen', icon: 'dashboard' },
  { key: 'avisos', label: 'Avisos', icon: 'campaign' },
  { key: 'fechas', label: 'Fechas', icon: 'event_note' },
  { key: 'encuadres', label: 'Encuadres', icon: 'rule' },
  { key: 'division', label: 'División', icon: 'diversity_3' },
];

const TIPOS = [
  { value: 'general', label: 'General', icon: 'campaign', fg: colors.cyanDark, bg: colors.cyanTint },
  { value: 'evento', label: 'Evento', icon: 'event', fg: colors.magentaDark, bg: colors.magentaTint },
  { value: 'urgente', label: 'Urgente', icon: 'warning', fg: colors.crimsonDark, bg: colors.crimsonTint },
];
const tipoDe = (t) => TIPOS.find((x) => x.value === t) ?? TIPOS[0];

/** "AAAA-MM-DD" de hoy + n días (hora local). */
const enDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};

export default function PanelConsejal({ codigo, rol, user, onClose }) {
  const grupo = useMemo(() => grupoPorCodigo(codigo), [codigo]);
  const [pestana, setPestana] = useState('resumen');
  const [mensaje, setMensaje] = useState('');
  const [avisos, setAvisos] = useState(null); // { avisos, suscritos } | null
  const [errorAvisos, setErrorAvisos] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [division, setDivision] = useState(false);
  const cal = useCalendarioGrupo(codigo, user);
  const ahora = useReloj(60000);
  const hoy = momento(ahora).fecha;

  function cargarAvisos() {
    getGroupNotices(codigo)
      .then((r) => {
        setAvisos(r);
        setErrorAvisos('');
      })
      .catch((e) => setErrorAvisos(e.message || 'No se pudieron cargar los avisos.'));
  }
  useEffect(cargarAvisos, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sin scroll de fondo mientras el panel está abierto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  if (!grupo) return null;
  const colores = indicesDeMaterias(grupo);
  const estado = estadoAhora(grupo, ahora);
  const fechas = cal.datos?.fechas ?? [];
  const proximas = fechas.filter((f) => f.fecha >= hoy && diasHasta(f.fecha, hoy) <= 14);
  const activos = (avisos?.avisos ?? []).filter((a) => a.vigente);
  const dueto = cal.datos?.consejales ?? [];

  async function borrarAviso(a) {
    if (!window.confirm(`¿Borrar "${a.title}"? El grupo ya no lo verá.`)) return;
    try {
      await deleteGroupNotice(a.id);
      setAvisos((x) => ({ ...x, avisos: x.avisos.filter((y) => y.id !== a.id) }));
      setMensaje('Aviso borrado.');
    } catch (e) {
      setMensaje(e.message);
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Panel de consejal ${codigo}`} className="fixed inset-0 z-[55] flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Encabezado */}
      <header style={{ background: `linear-gradient(135deg, ${colors.blueDeep}, ${colors.blue})`, color: colors.white }}>
        <div className="mx-auto flex w-full max-w-[860px] items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
          <button type="button" onClick={onClose} aria-label="Cerrar el panel" className="tappable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0" style={{ backgroundColor: alpha(colors.white, 0.14) }}>
            <Icon name="arrow_back" color={colors.white} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[0.6875rem] font-black uppercase" style={{ color: colors.gold, letterSpacing: 0.8 }}>
              Panel de {rol === 'subconsejal' ? 'subconsejal' : 'consejal'}
            </div>
            <h2 className="m-0 truncate text-xl font-black leading-tight">{codigo}</h2>
            <div className="truncate text-xs" style={{ color: alpha(colors.white, 0.8) }}>
              {grupo.group} · {grupo.shift}
            </div>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ borderRadius: 14, backgroundColor: colors.magentaSolid }}>
            <Icon name="how_to_reg" color={colors.white} />
          </span>
        </div>
        <BrandStripe height={4} />
      </header>

      {/* Pestañas */}
      <nav className="panel-tabs shrink-0 overflow-x-auto px-3 pt-3" aria-label="Secciones del panel">
        <div className="mx-auto flex w-full max-w-[860px] gap-1 p-1" role="tablist" style={{ backgroundColor: alpha(colors.ink, 0.08), borderRadius: 16 }}>
          {PESTANAS.map((p) => {
            const activa = p.key === pestana;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setPestana(p.key)}
                className="tappable flex min-h-[50px] min-w-[64px] flex-1 flex-col items-center justify-center gap-[2px] border-0 px-1 text-[0.6875rem] font-black"
                style={{ borderRadius: 12, backgroundColor: activa ? colors.surface : 'transparent', color: activa ? colors.ink : colors.textSecondary, boxShadow: activa ? `0 1px 4px ${alpha(colors.blue, 0.15)}` : 'none' }}
              >
                <Icon name={p.icon} size={18} color={activa ? colors.magentaDark : colors.textSecondary} />
                {p.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Contenido */}
      <main className="app-scroll flex-1 overflow-y-auto px-4 pt-3 pb-10">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3">
          {pestana === 'resumen' && (
            <>
              <section className="grid grid-cols-3 gap-2">
                <Numero icon="event_upcoming" color={colors.crimsonDark} valor={proximas.length} texto="fechas en 2 semanas" onClick={() => setPestana('fechas')} />
                <Numero icon="campaign" color={colors.cyanDark} valor={activos.length} texto={activos.length === 1 ? 'aviso visible' : 'avisos visibles'} onClick={() => setPestana('avisos')} />
                <Numero icon="notifications_active" color={colors.goldDark} valor={avisos?.suscritos ?? '–'} texto="celulares con avisos" />
              </section>

              <Tarjeta icon="group" color={colors.magentaDark} titulo="Tu dueto" texto="El consejal y el subconsejal publican lo mismo para el grupo.">
                <div className="flex flex-col gap-2">
                  {dueto.length === 0 ? (
                    <span className="text-sm" style={{ color: colors.textSecondary }}>
                      Cargando…
                    </span>
                  ) : (
                    dueto.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <UserAvatar user={c} size={34} ring={colors.border} />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{c.nombre}</span>
                        <span className="px-2 py-[2px] text-[0.6875rem] font-black" style={{ borderRadius: 8, backgroundColor: c.rol === 'consejal' ? colors.magentaTint : colors.cyanTint, color: c.rol === 'consejal' ? colors.magentaDark : colors.cyanDark }}>
                          {c.rol === 'subconsejal' ? 'SUBCONSEJAL' : 'CONSEJAL'}
                        </span>
                      </div>
                    ))
                  )}
                  {dueto.length === 1 && (
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                      Aún falta {dueto[0].rol === 'consejal' ? 'el subconsejal' : 'el consejal'}. Pídelo a la coordinación.
                    </span>
                  )}
                </div>
              </Tarjeta>

              <Tarjeta icon="bolt" color={colors.goldDark} titulo="Acciones rápidas">
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                  <Accion icon="campaign" onClick={() => { setPestana('avisos'); setNuevo(true); }}>
                    Nuevo aviso
                  </Accion>
                  <Accion icon="edit_calendar" onClick={() => setPestana('fechas')}>
                    Nueva fecha
                  </Accion>
                  <Accion icon="diversity_3" onClick={() => setDivision(true)}>
                    Dividir el grupo
                  </Accion>
                </div>
              </Tarjeta>

              <div className="flex items-start gap-2 p-3 text-xs" style={{ borderRadius: 14, backgroundColor: alpha(colors.ink, 0.05), color: colors.textSecondary, lineHeight: 1.45 }}>
                <Icon name="shield" size={18} color={colors.cyanDark} />
                <span>
                  Todo lo que publicas lleva tu nombre y pasa por el mismo filtro de palabras que los comentarios. Los admins del Poli pueden verlo, corregirlo o
                  borrarlo.
                </span>
              </div>
            </>
          )}

          {pestana === 'avisos' && (
            <>
              <button
                type="button"
                onClick={() => setNuevo(true)}
                className="tappable flex min-h-[50px] items-center justify-center gap-2 border-0 text-sm font-black"
                style={{ borderRadius: 14, backgroundColor: colors.cyanSolid, color: colors.white }}
              >
                <Icon name="add" size={20} color={colors.white} />
                Nuevo aviso para {codigo}
              </button>
              {errorAvisos && <Vacio icon="wifi_off" titulo="No se pudieron cargar" texto={errorAvisos} />}
              {!avisos && !errorAvisos && <p className="m-0 py-6 text-center text-sm" style={{ color: colors.textSecondary }}>Cargando avisos…</p>}
              {avisos && avisos.avisos.length === 0 && (
                <Vacio icon="campaign" titulo="Aún no publicas avisos" texto={`Solo los verá ${codigo} (en Inicio) y les llegará una notificación si la activaron.`} />
              )}
              {avisos?.avisos.map((a) => (
                <AvisoGrupo key={a.id} a={a} onBorrar={() => borrarAviso(a)} />
              ))}
            </>
          )}

          {pestana === 'fechas' && <CalendarioGrupo grupo={grupo} cal={cal} hoy={hoy} user={user} onMensaje={setMensaje} editar />}

          {pestana === 'encuadres' && <Encuadres grupo={grupo} cal={cal} onMensaje={setMensaje} />}

          {pestana === 'division' && (
            <Tarjeta icon="diversity_3" color={colors.magentaDark} titulo="Dividir el grupo por semana" texto="Grupo 1, Grupo 2, mitad y mitad… Lleva la lista del grupo y descárgalo en Excel o como imagen para compartirlo.">
              <button
                type="button"
                onClick={() => setDivision(true)}
                className="tappable flex h-12 w-full items-center justify-center gap-2 border-0 text-sm font-black"
                style={{ borderRadius: 14, backgroundColor: colors.magentaSolid, color: colors.white }}
              >
                <Icon name="edit_calendar" size={20} color={colors.white} />
                Dividir el grupo de esta semana
              </button>
              <p className="m-0 mt-2 text-xs" style={{ color: colors.textSecondary }}>
                La división se guarda en este celular.
              </p>
            </Tarjeta>
          )}
        </div>
      </main>

      {nuevo && (
        <NuevoAviso
          codigo={codigo}
          onClose={() => setNuevo(false)}
          onPublicado={(aviso, push) => {
            setNuevo(false);
            setAvisos((x) => ({ ...(x ?? { suscritos: 0 }), avisos: [{ ...aviso, vigente: true, por: user?.nombre }, ...(x?.avisos ?? [])] }));
            setMensaje(`Aviso publicado para ${codigo}.${textoPush(push)}`);
          }}
        />
      )}
      {division && <DivisionEditor grupo={grupo} colores={colores} estado={estado} onClose={() => setDivision(false)} onMensaje={setMensaje} />}
      {mensaje && <Snackbar message={mensaje} onDismiss={() => setMensaje('')} />}
      <style>{`.panel-tabs{scrollbar-width:none}.panel-tabs::-webkit-scrollbar{display:none}`}</style>
    </div>,
    document.body
  );
}

function textoPush(push) {
  if (!push || push.error || push.apagado) return '';
  if (!push.suscritos) return ' Nadie del grupo tiene las notificaciones activadas todavía.';
  return ` Se avisó a ${push.enviadas} ${push.enviadas === 1 ? 'celular' : 'celulares'}.`;
}

// ---------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------
function Tarjeta({ icon, color, titulo, texto, children }) {
  return (
    <section className="p-4" style={{ borderRadius: 20, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ backgroundColor: alpha(color, 0.12), borderRadius: 12 }}>
          <Icon name={icon} size={22} color={color} />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-black">{titulo}</h3>
          {texto && (
            <p className="m-0 mt-[2px] text-xs" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
              {texto}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Numero({ icon, color, valor, texto, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`${onClick ? 'tappable ' : ''}flex flex-col items-start gap-1 p-3 text-left`}
      style={{ borderRadius: 18, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <Icon name={icon} size={20} color={color} />
      <span className="text-2xl font-black leading-none" style={{ color: colors.textPrimary }}>
        {valor}
      </span>
      <span className="text-[0.6875rem] font-bold leading-tight" style={{ color: colors.textSecondary }}>
        {texto}
      </span>
    </Tag>
  );
}

function Accion({ icon, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="tappable flex h-12 items-center justify-center gap-2 text-sm font-black" style={{ borderRadius: 14, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}>
      <Icon name={icon} size={20} color={colors.magentaDark} />
      {children}
    </button>
  );
}

function Vacio({ icon, titulo, texto }) {
  return (
    <div className="flex flex-col items-center px-4 py-7 text-center" style={{ borderRadius: 20, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
      <Icon name={icon} size={44} color={colors.textMuted} />
      <h3 className="m-0 mt-2 text-base font-black">{titulo}</h3>
      <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
        {texto}
      </p>
    </div>
  );
}

/** Un aviso del grupo, con sus números y la encuesta (resultados). */
function AvisoGrupo({ a, onBorrar }) {
  const t = tipoDe(a.type);
  const totalVotos = a.poll ? a.poll.options.reduce((n, o) => n + (o.votes ?? 0), 0) : 0;
  return (
    <article className="overflow-hidden" style={{ borderRadius: 20, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, opacity: a.vigente ? 1 : 0.7 }}>
      <div style={{ height: 4, backgroundColor: t.fg }} />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[0.6875rem] font-black" style={{ borderRadius: 8, backgroundColor: t.bg, color: t.fg }}>
            <Icon name={t.icon} size={13} color={t.fg} />
            {t.label}
          </span>
          <span className="px-2 py-[2px] text-[0.6875rem] font-black" style={{ borderRadius: 8, backgroundColor: a.vigente ? colors.greenTint : colors.blueTint, color: a.vigente ? colors.greenDark : colors.textSecondary }}>
            {a.vigente ? `VISIBLE HASTA EL ${a.endDate.split('-').reverse().slice(0, 2).join('/')}` : 'YA NO SE VE'}
          </span>
          <button type="button" onClick={onBorrar} aria-label={`Borrar ${a.title}`} title="Borrar" className="tappable ml-auto flex h-9 w-9 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
            <Icon name="delete" size={18} color={colors.crimsonDark} />
          </button>
        </div>
        <h4 className="m-0 mt-2 text-[1rem] font-black leading-snug">{a.title}</h4>
        {a.content && (
          <p className="m-0 mt-1 whitespace-pre-line text-sm" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
            {a.content}
          </p>
        )}
        {a.poll && (
          <div className="mt-3 grid gap-2 p-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
            <div className="text-sm font-black">{a.poll.question}</div>
            {a.poll.options.map((o) => {
              const pct = totalVotos ? Math.round(((o.votes ?? 0) / totalVotos) * 100) : 0;
              return (
                <div key={o.id} className="relative overflow-hidden px-3 py-2 text-sm" style={{ borderRadius: 10, backgroundColor: colors.surface }}>
                  <span aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, backgroundColor: alpha(colors.cyan, 0.18) }} />
                  <span className="relative flex justify-between gap-2">
                    <span>{o.text}</span>
                    <b>{o.votes ?? 0}</b>
                  </span>
                </div>
              );
            })}
            <div className="text-xs" style={{ color: colors.textSecondary }}>
              {a.poll.voters} {a.poll.voters === 1 ? 'persona votó' : 'personas votaron'}
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: colors.textSecondary }}>
          <span className="inline-flex items-center gap-1">
            <Icon name="favorite" size={15} color={colors.crimsonDark} />
            {a.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="chat_bubble" size={15} color={colors.textSecondary} />
            {a.comments}
          </span>
          {a.notifiedAt && (
            <span className="inline-flex items-center gap-1">
              <Icon name="notifications_active" size={15} color={colors.goldDark} />
              Notificado
            </span>
          )}
          {a.por && <span className="ml-auto">Publicó {a.por}</span>}
        </div>
      </div>
    </article>
  );
}

/** Hoja para escribir un aviso del grupo. */
function NuevoAviso({ codigo, onClose, onPublicado }) {
  const [f, setF] = useState({ type: 'general', title: '', content: '', endDate: enDias(7), allowComments: true, notify: true });
  const [conEncuesta, setConEncuesta] = useState(false);
  const [encuesta, setEncuesta] = useState({ question: '', multiple: false, options: ['', ''] });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function publicar() {
    if (f.title.trim().length < 3) {
      setError('Escribe el título (al menos 3 letras).');
      return;
    }
    const opciones = encuesta.options.map((o) => o.trim()).filter(Boolean);
    if (conEncuesta && (encuesta.question.trim().length < 3 || opciones.length < 2)) {
      setError('La encuesta necesita una pregunta y al menos 2 opciones.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const r = await publishGroupNotice(codigo, {
        ...f,
        title: f.title.trim(),
        content: f.content.trim(),
        poll: conEncuesta ? { question: encuesta.question.trim(), multiple: encuesta.multiple, options: opciones.map((text) => ({ text })) } : null,
      });
      onPublicado(r.aviso, r.push);
    } catch (e) {
      setError(e.message || 'No se pudo publicar. Revisa tu internet.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Nuevo aviso"
      subtitle={`Solo lo verá ${codigo}`}
      icon="campaign"
      footer={
        <FilledButton icon={enviando ? 'hourglass_top' : 'send'} onClick={publicar} className="w-full" style={{ opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Publicando…' : 'Publicar para el grupo'}
        </FilledButton>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de aviso">
          {TIPOS.map((t) => {
            const activo = f.type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => set('type')(t.value)}
                className="tappable flex min-h-[40px] items-center gap-1 px-3 text-sm font-bold"
                style={{ borderRadius: 999, border: `1.5px solid ${activo ? t.fg : colors.border}`, backgroundColor: activo ? t.bg : colors.surface, color: activo ? t.fg : colors.textPrimary }}
              >
                <Icon name={t.icon} size={18} color={activo ? t.fg : colors.textSecondary} />
                {t.label}
              </button>
            );
          })}
        </div>
        <TextField value={f.title} onChange={set('title')} placeholder="Título (ej. Traer bata el jueves)" prefixIcon="title" inputProps={{ maxLength: 150, 'aria-label': 'Título' }} />
        <TextArea value={f.content} onChange={set('content')} placeholder="Escribe el aviso para tu grupo…" minRows={4} maxLength={1000} />
        <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: colors.textSecondary }}>
          Se ve en Inicio hasta el
          <input
            type="date"
            value={f.endDate}
            min={enDias(0)}
            max={enDias(60)}
            onChange={(e) => set('endDate')(e.target.value)}
            className="h-12 px-3 text-sm"
            style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
          />
        </label>

        {/* Encuesta rápida */}
        <Opcion icon="ballot" titulo="Agregar encuesta" texto="Ej. ¿Qué día hacemos el repaso?" valor={conEncuesta} onChange={setConEncuesta} />
        {conEncuesta && (
          <div className="flex flex-col gap-2 p-3" style={{ borderRadius: 14, border: `1px solid ${colors.border}` }}>
            <TextField value={encuesta.question} onChange={(v) => setEncuesta((e) => ({ ...e, question: v }))} placeholder="Pregunta" prefixIcon="help" inputProps={{ maxLength: 200, 'aria-label': 'Pregunta de la encuesta' }} />
            {encuesta.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TextField
                    value={o}
                    onChange={(v) => setEncuesta((e) => ({ ...e, options: e.options.map((x, j) => (j === i ? v : x)) }))}
                    placeholder={`Opción ${i + 1}`}
                    prefixIcon="radio_button_unchecked"
                    inputProps={{ maxLength: 100, 'aria-label': `Opción ${i + 1}` }}
                  />
                </div>
                {encuesta.options.length > 2 && (
                  <button type="button" onClick={() => setEncuesta((e) => ({ ...e, options: e.options.filter((_, j) => j !== i) }))} aria-label={`Quitar opción ${i + 1}`} className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
                    <Icon name="close" size={18} color={colors.textSecondary} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              {encuesta.options.length < 6 && (
                <button type="button" onClick={() => setEncuesta((e) => ({ ...e, options: [...e.options, ''] }))} className="tappable flex h-9 items-center gap-1 border-0 bg-transparent px-1 text-sm font-black" style={{ color: colors.ink }}>
                  <Icon name="add" size={18} color={colors.ink} />
                  Agregar opción
                </button>
              )}
              <label className="ml-auto flex items-center gap-2 text-xs font-bold" style={{ color: colors.textSecondary }}>
                Varias respuestas
                <Switch value={encuesta.multiple} onChange={(v) => setEncuesta((e) => ({ ...e, multiple: v }))} label="Permitir varias respuestas" />
              </label>
            </div>
          </div>
        )}

        <Opcion icon="chat_bubble" titulo="Permitir comentarios" texto="Con el mismo filtro que los demás comentarios." valor={f.allowComments} onChange={set('allowComments')} />
        <Opcion icon="notifications_active" titulo="Avisar al grupo" texto={`Notificación a quien eligió ${codigo} y activó los avisos.`} valor={f.notify} onChange={set('notify')} />
        {error && (
          <div className="flex items-start gap-2 p-3 text-sm font-bold" role="alert" style={{ borderRadius: 12, backgroundColor: colors.crimsonTint, color: colors.crimsonDark }}>
            <Icon name="error" size={18} color={colors.crimsonDark} />
            {error}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function Opcion({ icon, titulo, texto, valor, onChange }) {
  return (
    <div className="flex items-center gap-3 p-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <span className="min-w-0 flex-1 text-sm">
        <b>{titulo}</b>
        <span className="block text-xs" style={{ color: colors.textSecondary }}>
          {texto}
        </span>
      </span>
      <Switch value={valor} onChange={onChange} label={titulo} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Encuadres: criterios y % de cada materia (el grupo los usa en Notas)
// ---------------------------------------------------------------------
function Encuadres({ grupo, cal, onMensaje }) {
  const [editando, setEditando] = useState(null); // materia
  const materias = [...new Set(grupo.sessions.map((s) => s.subject))].sort();
  const porMateria = Object.fromEntries((cal.datos?.encuadres ?? []).map((e) => [e.materia, e]));

  return (
    <>
      <p className="m-0 px-1 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
        Escribe cómo evalúa cada maestro (ej. Exámenes 40 %, Tareas 30 %…). El grupo lo usa en <b>Horario → Notas</b> para calcular su promedio y sus faltas.
      </p>
      {materias.map((m) => {
        const e = porMateria[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => setEditando(m)}
            className="tappable flex items-center gap-3 p-3 text-left"
            style={{ borderRadius: 18, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ borderRadius: 12, backgroundColor: e ? colors.greenTint : colors.blueTint }}>
              <Icon name={e ? 'task_alt' : 'rule'} size={22} color={e ? colors.greenDark : colors.textSecondary} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black">{materiaBonita(m)}</span>
              <span className="block truncate text-xs" style={{ color: colors.textSecondary }}>
                {e ? e.criterios.map((c) => `${c.nombre} ${c.porcentaje}%`).join(' · ') : 'Sin encuadre todavía'}
              </span>
            </span>
            <Icon name="chevron_right" color={colors.textSecondary} />
          </button>
        );
      })}
      {editando && (
        <EditorEncuadre
          grupo={grupo}
          materia={editando}
          inicial={porMateria[editando]}
          onClose={() => setEditando(null)}
          onGuardado={(encuadre, borrado) => {
            setEditando(null);
            cal.cambiar((d) => ({ ...d, encuadres: [...d.encuadres.filter((x) => x.materia !== editando), ...(borrado ? [] : [encuadre])] }));
            onMensaje(borrado ? 'Encuadre borrado.' : 'Encuadre guardado: el grupo ya lo puede usar en Notas.');
          }}
        />
      )}
    </>
  );
}

function EditorEncuadre({ grupo, materia, inicial, onClose, onGuardado }) {
  const [criterios, setCriterios] = useState(() =>
    inicial?.criterios?.length ? inicial.criterios.map((c) => ({ ...c, porcentaje: String(c.porcentaje) })) : [{ nombre: 'Exámenes', porcentaje: '50' }, { nombre: 'Tareas', porcentaje: '30' }, { nombre: 'Participación', porcentaje: '20' }]
  );
  const [asistencia, setAsistencia] = useState(String(inicial?.asistenciaMin ?? 80));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const suma = criterios.reduce((n, c) => n + (Number(c.porcentaje) || 0), 0);

  async function guardar(borrar = false) {
    setEnviando(true);
    setError('');
    try {
      const lista = borrar ? [] : criterios.filter((c) => c.nombre.trim()).map((c) => ({ nombre: c.nombre.trim(), porcentaje: Number(c.porcentaje) || 0 }));
      const r = await saveGroupFraming(grupo.code, materia, lista, Number(asistencia) || 80);
      onGuardado(r.encuadre, Boolean(r.borrado));
    } catch (e) {
      setError(e.message || 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={materiaBonita(materia)}
      subtitle={`Encuadre para ${grupo.code}`}
      icon="rule"
      footer={
        <div className="flex gap-2">
          {inicial && (
            <button type="button" onClick={() => window.confirm('¿Borrar el encuadre de esta materia?') && guardar(true)} className="tappable h-12 px-4 text-sm font-black" style={{ borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.crimsonDark }}>
              Borrar
            </button>
          )}
          <FilledButton icon={enviando ? 'hourglass_top' : 'save'} onClick={() => guardar(false)} className="flex-1" style={{ opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Guardando…' : 'Guardar encuadre'}
          </FilledButton>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {criterios.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TextField value={c.nombre} onChange={(v) => setCriterios((l) => l.map((x, j) => (j === i ? { ...x, nombre: v } : x)))} placeholder="Criterio (ej. Exámenes)" prefixIcon="label" inputProps={{ maxLength: 40, 'aria-label': `Criterio ${i + 1}` }} />
            </div>
            <div className="w-[96px] shrink-0">
              <TextField
                value={c.porcentaje}
                onChange={(v) => setCriterios((l) => l.map((x, j) => (j === i ? { ...x, porcentaje: v.replace(/[^\d]/g, '').slice(0, 3) } : x)))}
                placeholder="%"
                suffix={<span className="pr-3 text-sm font-bold" style={{ color: colors.textSecondary }}>%</span>}
                inputProps={{ inputMode: 'numeric', 'aria-label': `Porcentaje de ${c.nombre || `criterio ${i + 1}`}` }}
              />
            </div>
            {criterios.length > 1 && (
              <button type="button" onClick={() => setCriterios((l) => l.filter((_, j) => j !== i))} aria-label={`Quitar ${c.nombre || `criterio ${i + 1}`}`} className="tappable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
                <Icon name="close" size={18} color={colors.textSecondary} />
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          {criterios.length < 12 && (
            <button type="button" onClick={() => setCriterios((l) => [...l, { nombre: '', porcentaje: '' }])} className="tappable flex h-9 items-center gap-1 border-0 bg-transparent px-1 text-sm font-black" style={{ color: colors.ink }}>
              <Icon name="add" size={18} color={colors.ink} />
              Agregar criterio
            </button>
          )}
          <span className="ml-auto px-2 py-1 text-xs font-black" style={{ borderRadius: 8, backgroundColor: suma === 100 ? colors.greenTint : colors.goldTint, color: suma === 100 ? colors.greenDark : colors.goldDark }}>
            Suma {suma} %{suma === 100 ? ' ✓' : ' (debe ser 100)'}
          </span>
        </div>
        <label className="mt-2 flex items-center gap-3 text-sm font-bold">
          <span className="min-w-0 flex-1">
            Asistencia mínima para el ordinario
            <span className="block text-xs font-normal" style={{ color: colors.textSecondary }}>
              Normalmente 80 %.
            </span>
          </span>
          <span className="block w-[96px] shrink-0">
            <TextField value={asistencia} onChange={(v) => setAsistencia(v.replace(/[^\d]/g, '').slice(0, 3))} suffix={<span className="pr-3 text-sm font-bold" style={{ color: colors.textSecondary }}>%</span>} inputProps={{ inputMode: 'numeric', 'aria-label': 'Asistencia mínima' }} />
          </span>
        </label>
        {error && (
          <div className="text-sm font-bold" role="alert" style={{ color: colors.crimsonDark }}>
            {error}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
