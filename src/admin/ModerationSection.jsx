// src/admin/ModerationSection.jsx — Responsable: Alexis
// =====================================================================
// Sección "Comentarios" del panel: cuidar que los comentarios de los
// avisos se mantengan en un ambiente institucional.
//
//   Por revisar  → reportados por alumnos u ocultos (3 reportes lo ocultan solo).
//                  "Está bien" lo vuelve a mostrar; "Ocultar" lo quita de la app.
//   Bloqueados   → lo que el filtro automático no dejó publicar en TODO lo
//                  público: comentarios, objetos perdidos, fechas y avisos de
//                  los consejales. Un admin lo verifica: "Bien bloqueado" o
//                  "Error del filtro" (este último no cuenta para la pausa automática).
//   Recientes    → los últimos comentarios publicados, por si hay que ocultar alguno.
//   Pausados     → cuentas que no pueden comentar (automático o por un admin).
//
// En cualquier comentario se puede "Pausar cuenta" 1, 7, 30 días o permanente
// (PausarDialog.jsx; la permanente solo la quita la cuenta maestra).
// API: getModeration, moderateComment, deleteComment, silenceUser, unsilenceUser, reviewBlocked.
// =====================================================================
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import EmptyState from '../components/EmptyState.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { SectionTitle, OutlineButton } from './ui.jsx';
import { getModeration, moderateComment, deleteComment, silenceUser, unsilenceUser, reviewBlocked } from '../lib/api.js';
import PausarDialog from './PausarDialog.jsx';
import { formatDate, timeAgo } from './reportMeta.js';

const TABS = [
  { key: 'revisar', label: 'Por revisar', icon: 'flag' },
  { key: 'bloqueados', label: 'Bloqueados por el filtro', icon: 'block' },
  { key: 'recientes', label: 'Recientes', icon: 'forum' },
  { key: 'silenciados', label: 'Pausados', icon: 'voice_over_off' },
];

const MOTIVO_FILTRO = {
  groseria: { label: 'Grosería', color: colors.crimsonDark, bg: colors.crimsonTint },
  amenaza: { label: 'Amenaza', color: colors.crimsonDark, bg: colors.crimsonTint },
  datos: { label: 'Datos personales', color: colors.goldDark, bg: colors.goldTint },
  enlace: { label: 'Enlace externo', color: colors.cyanDark, bg: colors.cyanTint },
};

// Dónde lo escribió (columna moderacion_log.origen).
const ORIGEN = {
  comentario: { label: 'Comentario', icon: 'chat_bubble' },
  perdido: { label: 'Objetos perdidos', icon: 'travel_explore' },
  fecha: { label: 'Fecha de grupo', icon: 'event_note' },
  aviso: { label: 'Aviso de consejal', icon: 'campaign' },
};

const MOTIVO_REPORTE = { ofensivo: 'ofensivo', acoso: 'acoso', spam: 'spam', datos: 'datos personales', otro: 'otro' };

export default function ModerationSection({ onMessage, onChanged, esMaestro = false }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('revisar');
  const [busy, setBusy] = useState(false);
  const [pausando, setPausando] = useState(null); // autor al que se va a pausar
  const [verRevisados, setVerRevisados] = useState(false);

  async function load() {
    try {
      const d = await getModeration();
      setData(d);
      onChanged?.(d.revisar.length);
    } catch (e) {
      onMessage(`No se pudo cargar la moderación: ${e.message}`);
    }
  }
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(promesa, mensaje) {
    if (busy) return;
    setBusy(true);
    try {
      await promesa();
      onMessage(mensaje);
      await load();
    } catch (e) {
      onMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  const pausar = (autor) => setPausando(autor);
  const confirmarPausa = (dias, motivo) => {
    const autor = pausando;
    setPausando(null);
    const quien = autor.nombre || autor.correo;
    hacer(() => silenceUser(autor.id, dias, motivo), dias === 0 ? `${quien} quedó en pausa permanente.` : `${quien} quedó en pausa ${dias} día${dias === 1 ? '' : 's'}.`);
  };

  const sinRevisar = (data?.bloqueados ?? []).filter((b) => !b.veredicto);
  const bloqueadosVisibles = verRevisados ? data?.bloqueados ?? [] : sinRevisar;

  const conteo = {
    revisar: data?.revisar.length ?? 0,
    bloqueados: sinRevisar.length,
    recientes: data?.recientes.length ?? 0,
    silenciados: data?.silenciados.length ?? 0,
  };

  return (
    <div>
      <SectionTitle
        title="Comentarios"
        subtitle="Los alumnos comentan los avisos con su cuenta UdeG. Aquí revisas lo reportado y lo que bloqueó el filtro."
      >
        <OutlineButton icon="refresh" onClick={load}>
          Actualizar
        </OutlineButton>
      </SectionTitle>

      {/* Cómo funciona (cortito) */}
      <Card className="mb-4 flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm" style={{ color: colors.textSecondary }}>
        <Regla icon="shield" texto="Filtro automático en comentarios, objetos perdidos, fechas y avisos de consejales: groserías, amenazas, teléfonos, correos y enlaces de fuera." />
        <Regla icon="flag" texto="3 reportes de alumnos = se oculta solo hasta que lo revises." />
        <Regla icon="hourglass_top" texto="3 bloqueos en 24 h = la cuenta se pausa 24 h sola (los que marques como error no cuentan)." />
      </Card>

      {/* Pestañas */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const activa = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="tappable flex h-10 items-center gap-2 px-4 text-sm font-bold"
              style={{
                borderRadius: 999,
                border: `1.5px solid ${activa ? colors.blue : colors.border}`,
                backgroundColor: activa ? colors.blue : colors.surface,
                color: activa ? colors.white : colors.textSecondary,
              }}
            >
              <Icon name={t.icon} size={18} color={activa ? colors.white : colors.textSecondary} />
              {t.label}
              <span
                className="px-[7px] text-xs font-black"
                style={{
                  borderRadius: 999,
                  backgroundColor: t.key === 'revisar' && conteo.revisar ? colors.crimson : activa ? colors.blueLight : colors.background,
                  color: t.key === 'revisar' && conteo.revisar ? colors.white : activa ? colors.white : colors.textSecondary,
                }}
              >
                {conteo[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {!data ? (
        <p style={{ color: colors.textMuted }}>Cargando…</p>
      ) : tab === 'revisar' ? (
        data.revisar.length === 0 ? (
          <EmptyState icon="verified_user" title="Todo en orden" body="No hay comentarios reportados ni ocultos." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.revisar.map((c) => (
              <ComentarioCard key={c.id} c={c}>
                <div className="flex flex-wrap gap-1">
                  <Chip
                    texto={c.estado === 'oculto' ? 'OCULTO' : 'VISIBLE'}
                    color={c.estado === 'oculto' ? colors.crimsonDark : colors.greenDark}
                    bg={c.estado === 'oculto' ? colors.crimsonTint : colors.greenTint}
                  />
                  {c.reportes > 0 && <Chip texto={`${c.reportes} reporte${c.reportes === 1 ? '' : 's'}`} color={colors.goldDark} bg={colors.goldTint} />}
                  {Object.entries(c.reportMotivos || {}).map(([m, n]) => (
                    <Chip key={m} texto={`${MOTIVO_REPORTE[m] ?? m} ×${n}`} color={colors.textSecondary} bg={colors.background} />
                  ))}
                </div>
                {c.motivo && (
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    {c.motivo}
                  </div>
                )}
                <Acciones>
                  <Boton icon="check" texto="Está bien" onClick={() => hacer(() => moderateComment(c.id, 'mostrar'), 'Comentario visible otra vez.')} />
                  {c.estado !== 'oculto' && (
                    <Boton icon="visibility_off" texto="Ocultar" onClick={() => hacer(() => moderateComment(c.id, 'ocultar'), 'Comentario oculto.')} danger />
                  )}
                  <Boton icon="delete" texto="Borrar" onClick={() => hacer(() => deleteComment(c.id), 'Comentario borrado.')} danger />
                  <Boton icon="voice_over_off" texto="Pausar cuenta" onClick={() => pausar(c.author)} />
                </Acciones>
              </ComentarioCard>
            ))}
          </div>
        )
      ) : tab === 'bloqueados' ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
            <span className="min-w-0 flex-1">Verifica lo que bloqueó el filtro por si acaso: si fue un error, no cuenta para la pausa automática.</span>
            <OutlineButton icon={verRevisados ? 'filter_alt_off' : 'history'} onClick={() => setVerRevisados((v) => !v)} active={verRevisados}>
              {verRevisados ? 'Solo sin revisar' : 'Ver también los revisados'}
            </OutlineButton>
          </div>
          {bloqueadosVisibles.length === 0 ? (
            <EmptyState icon="verified" title={sinRevisar.length === 0 && data.bloqueados.length ? 'Todo verificado' : 'Sin bloqueos'} body={data.bloqueados.length ? 'Ya revisaste todo lo que bloqueó el filtro.' : 'El filtro no ha tenido que bloquear nada.'} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {bloqueadosVisibles.map((b) => {
                const m = MOTIVO_FILTRO[b.motivo] ?? { label: b.motivo, color: colors.textSecondary, bg: colors.background };
                const o = ORIGEN[b.origen] ?? ORIGEN.comentario;
                return (
                  <Card key={b.id} className="grid gap-2 p-4" style={b.veredicto ? { opacity: 0.75 } : undefined}>
                    <div className="flex flex-wrap items-center gap-1">
                      <Chip texto={m.label} color={m.color} bg={m.bg} />
                      <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[11px] font-black" style={{ color: colors.textSecondary, backgroundColor: colors.background, borderRadius: 7 }}>
                        <Icon name={o.icon} size={13} color={colors.textSecondary} />
                        {o.label}
                      </span>
                      {b.veredicto && (
                        <Chip
                          texto={b.veredicto === 'error' ? 'ERROR DEL FILTRO' : 'BIEN BLOQUEADO'}
                          color={b.veredicto === 'error' ? colors.goldDark : colors.greenDark}
                          bg={b.veredicto === 'error' ? colors.goldTint : colors.greenTint}
                        />
                      )}
                      <span className="ml-auto text-xs" style={{ color: colors.textMuted }}>
                        {timeAgo(b.createdAt)}
                      </span>
                    </div>
                    <div className="break-words text-sm" style={{ color: colors.textPrimary }}>
                      “{b.text}”
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: colors.textMuted }}>
                      <UserAvatar user={b.author} size={22} ring={colors.border} />
                      <span className="min-w-0 truncate">
                        {b.author.nombre} · {b.author.correo}
                      </span>
                    </div>
                    {b.veredicto && b.revisadoPor && (
                      <div className="text-xs" style={{ color: colors.textMuted }}>
                        Revisó {b.revisadoPor} · {formatDate(b.revisadoEn)}
                      </div>
                    )}
                    <Acciones>
                      {b.veredicto ? (
                        <Boton icon="undo" texto="Volver a revisar" onClick={() => hacer(() => reviewBlocked(b.id, null), 'Regresó a "sin revisar".')} />
                      ) : (
                        <>
                          <Boton icon="verified" texto="Bien bloqueado" onClick={() => hacer(() => reviewBlocked(b.id, 'correcto'), 'Marcado como bien bloqueado.')} />
                          <Boton icon="report_off" texto="Error del filtro" onClick={() => hacer(() => reviewBlocked(b.id, 'error'), 'Marcado como error del filtro: no cuenta para la pausa.')} />
                        </>
                      )}
                      <Boton icon="voice_over_off" texto="Pausar cuenta" onClick={() => pausar(b.author)} danger />
                    </Acciones>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === 'recientes' ? (
        data.recientes.length === 0 ? (
          <EmptyState icon="forum" title="Sin comentarios" body="Todavía nadie ha comentado los avisos." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.recientes.map((c) => (
              <ComentarioCard key={c.id} c={c}>
                <Acciones>
                  <Boton icon="visibility_off" texto="Ocultar" onClick={() => hacer(() => moderateComment(c.id, 'ocultar'), 'Comentario oculto.')} danger />
                  <Boton icon="voice_over_off" texto="Pausar cuenta" onClick={() => pausar(c.author)} />
                </Acciones>
              </ComentarioCard>
            ))}
          </div>
        )
      ) : data.silenciados.length === 0 ? (
        <EmptyState icon="record_voice_over" title="Nadie en pausa" body="Todas las cuentas pueden comentar y publicar." />
      ) : (
        <Card className="p-0">
          <ul className="m-0 list-none p-0">
            {data.silenciados.map((s) => (
              <li key={s.usuario.id} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
                <UserAvatar user={s.usuario} size={34} ring={colors.border} />
                <div className="min-w-0 flex-1 text-sm">
                  <b>{s.usuario.nombre}</b> <span style={{ color: colors.textMuted }}>{s.usuario.correo}</span>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    {s.permanente ? <b style={{ color: colors.crimsonDark }}>PERMANENTE</b> : `Hasta el ${formatDate(s.hasta)}`}
                    {s.motivo ? ` · ${s.motivo}` : ''}
                    {s.por ? ` · por ${s.por}` : ''}
                  </div>
                </div>
                {s.permanente && !esMaestro ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: colors.textMuted }} title="Solo la cuenta maestra puede quitar una pausa permanente">
                    <Icon name="lock" size={16} color={colors.textMuted} />
                    Solo la cuenta maestra la quita
                  </span>
                ) : (
                  <Boton icon="record_voice_over" texto="Quitar pausa" onClick={() => hacer(() => unsilenceUser(s.usuario.id), 'Pausa quitada.')} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pausando && <PausarDialog autor={pausando} onConfirmar={confirmarPausa} onCerrar={() => setPausando(null)} />}
    </div>
  );
}

function ComentarioCard({ c, children }) {
  return (
    <Card className="grid gap-2 p-4">
      <div className="flex items-start gap-3">
        <UserAvatar user={c.author} size={36} ring={colors.border} />
        <div className="min-w-0 flex-1">
          <div className="text-sm">
            <b>{c.author.nombre}</b>{' '}
            <span className="text-xs" style={{ color: colors.textMuted }}>
              {c.author.correo} · {timeAgo(c.createdAt)}
            </span>
          </div>
          <div className="mt-1 whitespace-pre-line break-words text-sm" style={{ color: colors.textPrimary }}>
            {c.text}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: colors.textMuted }}>
            <Icon name="campaign" size={14} color={colors.textMuted} />
            En: {c.aviso.title}
          </div>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Acciones({ children }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>;
}

function Boton({ icon, texto, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable flex h-9 items-center gap-1 px-3 text-xs font-bold"
      style={{
        borderRadius: 10,
        border: `1px solid ${danger ? colors.crimsonTint : colors.border}`,
        backgroundColor: danger ? colors.crimsonTint : colors.surface,
        color: danger ? colors.crimsonDark : colors.textSecondary,
      }}
    >
      <Icon name={icon} size={16} color={danger ? colors.crimsonDark : colors.textSecondary} />
      {texto}
    </button>
  );
}

function Chip({ texto, color, bg }) {
  return (
    <span className="inline-flex shrink-0 items-center px-2 py-[2px] text-[11px] font-black" style={{ color, backgroundColor: bg, borderRadius: 7 }}>
      {texto}
    </span>
  );
}

function Regla({ icon, texto }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon name={icon} size={18} color={colors.cyanDark} />
      {texto}
    </span>
  );
}
