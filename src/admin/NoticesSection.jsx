// src/admin/NoticesSection.jsx — Responsable: Alexis
// Sección "Avisos de la app": crear, editar y borrar los avisos que ven los
// alumnos en Inicio (sección de Leo). La app solo muestra los vigentes:
// los que tienen la fecha de hoy entre "desde" y "hasta".
//
// Notificaciones push: al publicar se puede marcar "Mandar notificación a los
// celulares" (viene marcado en los urgentes). Le llega a quien tocó "Activar"
// en Inicio de la app. Ver api/webpush.php y docs/notificaciones-push.md.
//
// Avisos como posts: fotos (hasta 5), "Fijar arriba" y "Permitir comentarios".
// Formulario: NoticeEditor.jsx (estilo Google Forms), con "¿Quién lo ve?":
// todos, consejales y subconsejales o solo consejales.
// En cada tarjeta se ven los me gusta, los comentarios y cuántos están
// reportados (botón "Revisar" → sección Comentarios).
//
// Encuestas rápidas (PollEditor.jsx): pregunta + 2 a 6 opciones; en la
// tarjeta del aviso se ven los resultados. Ver docs/encuestas-perdidos.md.
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import { getAllNotices, saveNotice, deleteNotice, getPushStatus, sendPushTest } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import FilledButton from '../components/FilledButton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SectionTitle, OutlineButton } from './ui.jsx';
import { localDay, formatDate } from './reportMeta.js';
import { ResultadosEncuesta } from './PollEditor.jsx';
import NoticeEditor, { AUDIENCIAS } from './NoticeEditor.jsx';

const TYPES = [
  { value: 'general', label: 'General', icon: 'campaign', bg: colors.cyanTint, fg: colors.cyanDark },
  { value: 'urgente', label: 'Urgente', icon: 'warning', bg: colors.crimsonTint, fg: colors.crimsonDark },
  { value: 'evento', label: 'Evento', icon: 'event', bg: colors.magentaTint, fg: colors.magentaDark },
];
const typeInfo = (value) => TYPES.find((t) => t.value === value) ?? TYPES[0];

function emptyNotice() {
  const today = new Date();
  const inTwoWeeks = new Date(today);
  inTwoWeeks.setDate(today.getDate() + 14);
  return {
    title: '',
    content: '',
    type: 'general',
    startDate: localDay(today),
    endDate: localDay(inTwoWeeks),
    notify: false, // se marca solo al elegir "Urgente"
    photos: [],
    files: [], // adjuntos: PDF, Word, Excel, PowerPoint
    pinned: false,
    allowComments: true,
    poll: null, // encuesta rápida (PollEditor.jsx)
    audience: 'todos', // todos | consejales | solo_consejales
  };
}

/** "Notificación enviada a 12 celulares." a partir de la respuesta de la API. */
function pushText(push) {
  if (!push) return '';
  if (push.error) return ` ${push.error}`;
  if (push.apagado) return ' Las notificaciones están apagadas en el servidor.';
  if (!push.suscritos) return ' Aún no hay celulares con notificaciones activadas.';
  const fallas = push.fallidas ? ` (${push.fallidas} no se pudieron entregar)` : '';
  return ` Notificación enviada a ${push.enviadas} ${push.enviadas === 1 ? 'celular' : 'celulares'}${fallas}.`;
}

export default function NoticesSection({ onMessage, onGoTo }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // aviso en el formulario (null = cerrado)
  const [saving, setSaving] = useState(false);
  const [push, setPush] = useState(null); // { activo, suscritos, misDispositivos }
  const [testing, setTesting] = useState(false);

  function load() {
    setLoading(true);
    getAllNotices()
      .then(setNotices)
      .catch((error) => onMessage(`No se pudieron cargar los avisos: ${error.message}`))
      .finally(() => setLoading(false));
    getPushStatus()
      .then(setPush)
      .catch(() => setPush(null)); // sin la migración todavía: no se muestra
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // La encuesta se manda solo con lo que la API necesita (id y texto de cada opción).
      const poll = editing.poll
        ? { ...editing.poll, options: editing.poll.options.map((o) => ({ id: o.id, text: o.text })).filter((o) => o.text.trim()) }
        : null;
      const result = await saveNotice({ ...editing, poll });
      onMessage((editing.id ? 'Aviso actualizado.' : 'Aviso publicado en la app.') + pushText(result.push));
      setEditing(null);
      load();
    } catch (error) {
      onMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function resend(notice) {
    if (!window.confirm(`¿Mandar otra vez "${notice.title}" como notificación a los celulares?`)) return;
    try {
      const result = await saveNotice({ ...notice, notify: true });
      onMessage(`Aviso reenviado.${pushText(result.push)}`);
      load();
    } catch (error) {
      onMessage(error.message);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await sendPushTest();
      onMessage(`Prueba enviada a ${r.enviadas} de tus ${r.suscritos} dispositivo(s). Revisa tu celular.`);
    } catch (error) {
      onMessage(error.message);
    } finally {
      setTesting(false);
    }
  }

  async function remove(notice) {
    if (!window.confirm(`¿Borrar el aviso "${notice.title}"? Ya no se verá en la app.`)) return;
    try {
      await deleteNotice(notice.id);
      onMessage('Aviso borrado.');
      load();
    } catch (error) {
      onMessage(error.message);
    }
  }

  const set = (key) => (value) => setEditing((n) => ({ ...n, [key]: value }));

  return (
    <div>
      <SectionTitle title="Avisos de la app" subtitle="Lo que ven los alumnos en la pantalla de Inicio.">
        <FilledButton icon="add" onClick={() => setEditing(emptyNotice())}>
          Nuevo aviso
        </FilledButton>
      </SectionTitle>

      {/* Notificaciones push: cuántos celulares las tienen activadas */}
      {push && (
        <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.cyanTint }}
          >
            <Icon name="notifications_active" color={colors.cyanDark} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-black">
              {push.suscritos} {push.suscritos === 1 ? 'celular tiene' : 'celulares tienen'} las notificaciones activadas
            </div>
            <div className="text-sm" style={{ color: colors.textSecondary }}>
              Se activan en la app: Inicio → “Avisos en tu celular”. Tus dispositivos: {push.misDispositivos}.
            </div>
          </div>
          <OutlineButton icon={testing ? 'hourglass_top' : 'send'} onClick={test}>
            Enviar prueba a mi celular
          </OutlineButton>
        </Card>
      )}

      {/* Formulario estilo Google Forms (NoticeEditor.jsx) */}
      {editing && (
        <NoticeEditor value={editing} onChange={(fn) => setEditing((n) => (typeof fn === 'function' ? fn(n) : fn))} push={push} saving={saving} onSave={save} onCancel={() => setEditing(null)} onMessage={onMessage} />
      )}

      {!loading && notices.length === 0 ? (
        <EmptyState icon="campaign" title="Sin avisos" body="Crea el primero con “Nuevo aviso”." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {notices.map((notice) => {
            const t = typeInfo(notice.type);
            return (
              <Card key={notice.id} className="flex gap-3 p-4" style={{ opacity: notice.vigente ? 1 : 0.6 }}>
                {notice.photos?.length ? (
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden" style={{ borderRadius: 14 }}>
                    <img src={notice.photos[0]} alt="" className="h-full w-full object-cover" />
                    {notice.photos.length > 1 && (
                      <span className="absolute bottom-1 right-1 flex items-center px-1 text-[10px] font-black" style={{ backgroundColor: colors.blueDeep, color: colors.white, borderRadius: 5 }}>
                        <Icon name="photo_library" size={11} color={colors.white} />
                        {notice.photos.length}
                      </span>
                    )}
                  </span>
                ) : (
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center"
                    style={{ backgroundColor: t.bg, borderRadius: 14 }}
                  >
                    <Icon name={t.icon} color={t.fg} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {notice.pinned && <Icon name="push_pin" size={16} color={colors.textSecondary} />}
                    <span className="font-black">{notice.title}</span>
                    <span
                      className="px-2 py-[2px] text-[11px] font-black"
                      style={{
                        backgroundColor: notice.vigente ? colors.greenTint : colors.blueTint,
                        color: notice.vigente ? colors.greenDark : colors.textSecondary,
                        borderRadius: 8,
                      }}
                    >
                      {notice.vigente ? 'VISIBLE EN LA APP' : 'NO VISIBLE'}
                    </span>
                    {notice.audience && notice.audience !== 'todos' && (
                      <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[11px] font-black" style={{ backgroundColor: colors.magentaTint, color: colors.magentaDark, borderRadius: 8 }}>
                        <Icon name={notice.audience === 'grupo' ? 'groups' : 'how_to_reg'} size={13} color={colors.magentaDark} />
                        {notice.audience === 'grupo' ? `SOLO ${notice.group} · DE SU CONSEJAL` : AUDIENCIAS.find((a) => a.value === notice.audience)?.label.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {notice.content && (
                    <p className="m-0 mt-1 line-clamp-3 text-sm" style={{ color: colors.textSecondary }}>
                      {notice.content}
                    </p>
                  )}
                  {notice.poll && <ResultadosEncuesta poll={notice.poll} />}
                  <div className="mt-2 text-xs" style={{ color: colors.textMuted }}>
                    {t.label} · del {notice.startDate} al {notice.endDate}
                    {notice.notifiedAt && (
                      <span className="ml-1 inline-flex items-center gap-[2px]" title="Se mandó como notificación">
                        · <Icon name="notifications_active" size={14} color={colors.cyanDark} /> notificado el {formatDate(notice.notifiedAt)}
                      </span>
                    )}
                  </div>
                  {/* Cómo le fue en la app */}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold" style={{ color: colors.textSecondary }}>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="favorite" size={15} color={colors.crimson} />
                      {notice.likes ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name={notice.allowComments ? 'mode_comment' : 'comments_disabled'} size={15} color={colors.textSecondary} />
                      {notice.allowComments ? notice.comments ?? 0 : 'cerrados'}
                    </span>
                    {notice.files?.length > 0 && (
                      <span className="inline-flex items-center gap-1" title={notice.files.map((f) => f.name).join('\n')}>
                        <Icon name="attach_file" size={15} color={colors.textSecondary} />
                        {notice.files.length} {notice.files.length === 1 ? 'archivo' : 'archivos'}
                      </span>
                    )}
                    {notice.flagged > 0 && (
                      <button
                        type="button"
                        onClick={() => onGoTo?.('comentarios')}
                        className="inline-flex items-center gap-1 border-0 px-2 py-[2px] text-xs font-black"
                        style={{ backgroundColor: colors.crimsonTint, color: colors.crimsonDark, borderRadius: 8 }}
                      >
                        <Icon name="flag" size={14} color={colors.crimsonDark} />
                        {notice.flagged} por revisar
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <IconAction icon="edit" label="Editar" onClick={() => setEditing({ ...notice, notify: false })} />
                  {push && notice.vigente && (
                    <IconAction icon="send" label="Mandar como notificación" onClick={() => resend(notice)} />
                  )}
                  <IconAction icon="delete" label="Borrar" onClick={() => remove(notice)} danger />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconAction({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0"
      style={{ backgroundColor: colors.background }}
    >
      <Icon name={icon} size={20} color={danger ? colors.crimsonDark : colors.textSecondary} />
    </button>
  );
}
