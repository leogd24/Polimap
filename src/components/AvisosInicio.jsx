// src/components/AvisosInicio.jsx — Responsable: Alexis (sección de Avisos de Leo)
// =====================================================================
// Avisos en Inicio, diseño "Hoy primero" (compacto):
//   1. Filtros: Todos · Urgentes · Eventos · Encuestas · Con archivos
//      (solo salen los que tienen avisos).
//   2. URGENTES arriba como franja roja (se ven aunque no los abras).
//   3. Un DESTACADO grande: el fijado (o el primero con foto) con foto
//      16:9, título encima, me gusta / comentarios / votos y "Votar".
//   4. El resto en LISTA: miniatura, título, una línea y datos chiquitos.
//   5. Al tocar cualquiera se abre COMPLETO en una hoja (PostCard): fotos,
//      texto, encuesta, archivos, me gusta, comentarios y compartir.
//   Si la app se abrió desde una notificación (?aviso=12), esa hoja se abre sola.
//
// Props: notices, user, onLike(notice), onOpenComments(notice), onRequestLogin(),
//        onPollChange(id, poll), focusId, abrir ({ id, vez }: abrir uno desde fuera, ej. "Tu día")
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BottomSheet from './BottomSheet.jsx';
import PostCard, { TIPOS_AVISO } from './PostCard.jsx';
import { haceCorto } from '../lib/tiempo.js';

const FILTROS = [
  { key: 'todos', label: 'Todos', ok: () => true },
  { key: 'urgente', label: 'Urgentes', ok: (n) => n.type === 'urgente' },
  { key: 'evento', label: 'Eventos', ok: (n) => n.type === 'evento' },
  { key: 'encuesta', label: 'Encuestas', ok: (n) => Boolean(n.poll) },
  { key: 'archivos', label: 'Con archivos', ok: (n) => n.files?.length > 0 },
];

const tipoDe = (n) => TIPOS_AVISO[n.type] ?? TIPOS_AVISO.general;
// Fondo sólido (con letra blanca) de cada tipo, para la etiqueta sobre la foto.
const SOLIDO = { urgente: colors.crimsonSolid, evento: colors.magentaSolid, general: colors.cyanSolid };
const resumen = (t) => String(t || '').replace(/\s+/g, ' ').trim();
// Avisos que solo ven los consejales (api/audiencia.php).
const PARA_AUD = { consejales: 'Para consejales', solo_consejales: 'Solo consejales' };
/** "Para consejales" / "Para 1AM TIN" (avisos que publica el consejal del grupo) / null. */
const para = (n) => (n.audience === 'grupo' ? `Para ${n.group}` : PARA_AUD[n.audience] ?? null);

/** ¿Este aviso tiene una encuesta en la que aún puedes votar? */
const porVotar = (n) => n.poll && !n.poll.closed && !n.poll.myVotes?.length;

/** El aviso grande: el fijado (no urgente), o si no, el primero con foto. */
function elegirDestacado(lista) {
  const normales = lista.filter((n) => n.type !== 'urgente');
  return normales.find((n) => n.pinned) ?? normales.find((n) => n.photos?.length) ?? null;
}

export default function AvisosInicio({ notices, user, onLike, onOpenComments, onRequestLogin, onPollChange, focusId = null, abrir = null }) {
  const [filtro, setFiltro] = useState('todos');
  const [abiertoId, setAbiertoId] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const yaAbri = useRef(false);

  // Desde una notificación: abre ese aviso una sola vez.
  useEffect(() => {
    if (!focusId || yaAbri.current || !notices.some((n) => n.id === focusId)) return;
    yaAbri.current = true;
    setAbiertoId(focusId);
  }, [focusId, notices]);

  // Pedido desde fuera (ej. tocar un aviso urgente en "Tu día").
  useEffect(() => {
    if (abrir?.id) setAbiertoId(abrir.id);
  }, [abrir]);

  const abierto = notices.find((n) => n.id === abiertoId) ?? null; // siempre la versión más nueva (likes, votos)
  const visibles = FILTROS.filter((f) => f.key === 'todos' || notices.some(f.ok));
  const f = FILTROS.find((x) => x.key === filtro) ?? FILTROS[0];
  const lista = notices.filter(f.ok);

  // Con "Todos": urgentes arriba, un destacado y el resto en lista.
  const urgentes = filtro === 'todos' ? lista.filter((n) => n.type === 'urgente') : [];
  const destacado = filtro === 'todos' ? elegirDestacado(lista) : null;
  const resto = lista.filter((n) => !urgentes.includes(n) && n !== destacado);
  const LIMITE = 6;
  const filas = verTodos ? resto : resto.slice(0, LIMITE);

  if (!notices.length) {
    return (
      <div className="flex items-center gap-3 p-4 text-sm" style={{ borderRadius: 16, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
        <Icon name="campaign" color={colors.textMuted} />
        Aún no hay avisos. Aquí verás lo que publique el Poli.
      </div>
    );
  }

  return (
    <div>
      {/* Filtros */}
      {visibles.length > 2 && (
        <div className="avisos-filtros -mx-[18px] mb-3 flex gap-2 overflow-x-auto px-[18px]" role="group" aria-label="Filtrar avisos">
          {visibles.map((x) => {
            const on = x.key === filtro;
            return (
              <button
                key={x.key}
                type="button"
                aria-pressed={on}
                onClick={() => setFiltro(x.key)}
                className="tappable h-9 shrink-0 whitespace-nowrap px-3 text-[0.8125rem] font-bold"
                style={{ borderRadius: 999, border: `1px solid ${on ? colors.ink : colors.border}`, backgroundColor: on ? colors.ink : colors.surface, color: on ? colors.surface : colors.textPrimary }}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {urgentes.map((n) => (
          <Urgente key={n.id} n={n} onAbrir={() => setAbiertoId(n.id)} />
        ))}
        {destacado && <Destacado n={destacado} onAbrir={() => setAbiertoId(destacado.id)} />}
        {filas.map((n) => (
          <Fila key={n.id} n={n} onAbrir={() => setAbiertoId(n.id)} />
        ))}
        {lista.length === 0 && (
          <p className="m-0 py-4 text-center text-sm" style={{ color: colors.textSecondary }}>
            No hay avisos de este tipo.
          </p>
        )}
        {!verTodos && resto.length > LIMITE && (
          <button
            type="button"
            onClick={() => setVerTodos(true)}
            className="tappable h-11 text-sm font-black"
            style={{ borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.ink }}
          >
            Ver {resto.length - LIMITE} avisos más
          </button>
        )}
      </div>

      {/* El aviso completo */}
      <BottomSheet
        open={Boolean(abierto)}
        onClose={() => setAbiertoId(null)}
        title="Avisos del Poli"
        subtitle={abierto ? [tipoDe(abierto).label, para(abierto), haceCorto(abierto.createdAt || abierto.startDate)].filter(Boolean).join(' · ') : ''}
        icon={abierto ? tipoDe(abierto).icon : 'campaign'}
        iconColor={abierto ? tipoDe(abierto).dark : colors.ink}
        ancho={560}
      >
        {abierto && (
          <div className="-mx-5">
            <PostCard
              notice={abierto}
              user={user}
              enHoja
              onLike={onLike}
              onOpenComments={(n) => {
                // La hoja de comentarios va encima: primero se cierra esta.
                setAbiertoId(null);
                onOpenComments(n);
              }}
              onRequestLogin={onRequestLogin}
              onPollChange={onPollChange}
              highlight={false}
            />
          </div>
        )}
      </BottomSheet>
      <style>{`.avisos-filtros{scrollbar-width:none}.avisos-filtros::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

/** Aviso urgente: tarjeta roja suave con el ícono en blanco (estilo Google). */
function Urgente({ n, onAbrir }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="tappable flex w-full items-center gap-3 border-0 p-3 text-left"
      style={{ borderRadius: 20, backgroundColor: colors.crimsonTint }}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center" style={{ borderRadius: 16, backgroundColor: colors.surface }}>
        <Icon name="warning" size={28} filled color={colors.crimsonDark} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-black leading-snug" style={{ color: colors.crimsonDark }}>
          {n.title}
        </span>
        <span className="line-clamp-2 text-[0.8125rem]" style={{ color: colors.textPrimary }}>
          {resumen(n.content) || 'Toca para ver el aviso'}
        </span>
        <span className="mt-[2px] block text-[0.6875rem] font-bold" style={{ color: colors.crimsonDark }}>
          Urgente · {haceCorto(n.createdAt || n.startDate)}
        </span>
      </span>
    </button>
  );
}

/** Aviso destacado estilo Google Discover: foto arriba, fuente, título y acciones. */
function Destacado({ n, onAbrir }) {
  const t = tipoDe(n);
  const foto = n.photos?.[0];
  return (
    <article className="overflow-hidden" style={{ borderRadius: 24, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
      <button type="button" onClick={onAbrir} className="tappable block w-full border-0 bg-transparent p-0 text-left" aria-label={`Abrir aviso: ${n.title}`}>
        <span
          className="relative block aspect-[16/9] w-full"
          style={
            foto
              ? { backgroundImage: `url("${foto}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: colors.blueTint }
              : { background: `linear-gradient(135deg, ${colors.blue}, color-mix(in srgb, ${t.color} 55%, ${colors.blue}))` }
          }
        >
          {!foto && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Icon name={t.icon} size={56} color={alpha(colors.white, 0.85)} />
            </span>
          )}
          {n.photos?.length > 1 && (
            <span className="absolute right-3 top-3">
              <Chip icon="photo_library" fondo={alpha(colors.blueDeep, 0.7)}>
                {n.photos.length}
              </Chip>
            </span>
          )}
        </span>
        <span className="block px-4 pb-2 pt-3">
          {/* Fuente: tipo · Avisos del Poli · hace cuánto */}
          <span className="flex flex-wrap items-center gap-2 text-xs font-semibold" style={{ color: colors.textSecondary }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: t.tint }}>
              <Icon name={t.icon} size={13} color={t.dark} />
            </span>
            <span style={{ color: t.dark }}>{t.label}</span>· Avisos del Poli · {haceCorto(n.createdAt || n.startDate)}
            {n.pinned && <Icon name="push_pin" size={14} color={colors.textSecondary} />}
            {para(n) && (
              <span className="inline-flex items-center gap-[2px] font-bold" style={{ color: colors.magentaDark }}>
                <Icon name={n.audience === 'grupo' ? 'groups' : 'how_to_reg'} size={14} color={colors.magentaDark} />
                {para(n)}
              </span>
            )}
          </span>
          <span className="mt-2 block text-[1.0625rem] font-bold leading-snug" style={{ color: colors.textPrimary }}>
            {n.title}
          </span>
          {resumen(n.content) && (
            <span className="mt-1 line-clamp-2 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
              {resumen(n.content)}
            </span>
          )}
        </span>
      </button>
      <div className="flex items-center gap-5 px-4 pb-3 pt-1 text-[0.8125rem] font-semibold" style={{ color: colors.textSecondary }}>
        <Dato icon="favorite" filled={n.liked} color={n.liked ? colors.crimson : colors.textSecondary} label={`${n.likes} me gusta`}>
          {n.likes}
        </Dato>
        <Dato icon="mode_comment" label={`${n.comments} comentarios`}>
          {n.comments}
        </Dato>
        {n.poll && (
          <button type="button" onClick={onAbrir} className="tappable inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[0.8125rem] font-bold" style={{ color: porVotar(n) ? colors.cyanDark : colors.textSecondary }}>
            <Icon name="ballot" size={18} color="currentColor" />
            {porVotar(n) ? 'Votar' : `${n.poll.voters} ${n.poll.voters === 1 ? 'voto' : 'votos'}`}
          </button>
        )}
        <button type="button" onClick={onAbrir} aria-label="Abrir aviso" className="tappable ml-auto flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent">
          <Icon name="chevron_right" size={22} color={colors.textSecondary} />
        </button>
      </div>
    </article>
  );
}

/** Aviso compacto: miniatura, título y datos (estilo Google). */
function Fila({ n, onAbrir }) {
  const t = tipoDe(n);
  const foto = n.photos?.[0];
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="tappable flex w-full items-center gap-3 p-3 text-left"
      style={{ borderRadius: 20, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center"
        style={foto ? { borderRadius: 16, backgroundImage: `url("${foto}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { borderRadius: 16, backgroundColor: t.tint }}
      >
        {!foto && <Icon name={t.icon} size={28} color={t.dark} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[0.9375rem] font-bold leading-snug" style={{ color: colors.textPrimary }}>
          {n.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: colors.textSecondary }}>
          <span className="font-bold" style={{ color: t.dark }}>
            {t.label}
          </span>
          {para(n) && (
            <span className="inline-flex items-center gap-[2px] font-bold" style={{ color: colors.magentaDark }}>
              <Icon name={n.audience === 'grupo' ? 'groups' : 'how_to_reg'} size={13} color="currentColor" />
              {para(n)}
            </span>
          )}
          <span>· {haceCorto(n.createdAt || n.startDate)}</span>
          {n.poll && <span style={porVotar(n) ? { color: colors.cyanDark, fontWeight: 700 } : undefined}>· {porVotar(n) ? 'Vota' : 'Encuesta'}</span>}
          {n.files?.length > 0 && <span>· {n.files.length === 1 ? '1 archivo' : `${n.files.length} archivos`}</span>}
          {n.comments > 0 && <span>· {n.comments} {n.comments === 1 ? 'comentario' : 'comentarios'}</span>}
        </span>
      </span>
    </button>
  );
}

function Chip({ icon, fondo, children }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-[3px] text-[0.6875rem] font-black" style={{ borderRadius: 8, backgroundColor: fondo, color: colors.white }}>
      <Icon name={icon} size={13} color={colors.white} />
      {children}
    </span>
  );
}

function Dato({ icon, filled = false, color = colors.textSecondary, label, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} size={17} filled={filled} color={color} />
      <span aria-hidden="true">{children}</span>
      <span className="solo-lector">{label}</span>
    </span>
  );
}
