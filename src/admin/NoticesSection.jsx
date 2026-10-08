// src/admin/NoticesSection.jsx — Responsable: Alexis
// Sección "Avisos de la app": crear, editar y borrar los avisos que ven los
// alumnos en Inicio (sección de Leo). La app solo muestra los vigentes:
// los que tienen la fecha de hoy entre "desde" y "hasta".
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import { getAllNotices, saveNotice, deleteNotice } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import FilledButton from '../components/FilledButton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TextField, TextArea, SelectField } from '../components/Inputs.jsx';
import { SectionTitle, DateField, OutlineButton } from './ui.jsx';
import { localDay } from './reportMeta.js';

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
  return { title: '', content: '', type: 'general', startDate: localDay(today), endDate: localDay(inTwoWeeks) };
}

export default function NoticesSection({ onMessage }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // aviso en el formulario (null = cerrado)
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    getAllNotices()
      .then(setNotices)
      .catch((error) => onMessage(`No se pudieron cargar los avisos: ${error.message}`))
      .finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await saveNotice(editing);
      onMessage(editing.id ? 'Aviso actualizado.' : 'Aviso publicado en la app.');
      setEditing(null);
      load();
    } catch (error) {
      onMessage(error.message);
    } finally {
      setSaving(false);
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

      {editing && (
        <Card className="mb-5 p-5" style={{ border: `2px solid ${colors.blue}` }}>
          <h2 className="m-0 mb-4 text-lg font-black">{editing.id ? 'Editar aviso' : 'Nuevo aviso'}</h2>
          <div className="grid gap-3">
            <TextField value={editing.title} onChange={set('title')} placeholder="Título (ej. Corte de agua en el edificio 3)" prefixIcon="title" />
            <TextArea value={editing.content} onChange={set('content')} placeholder="Detalle del aviso" minRows={3} maxLength={2000} />
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                value={editing.type}
                onChange={(v) => set('type')(v ?? 'general')}
                placeholder="Tipo"
                prefixIcon="label"
                options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
              <DateField label="Desde" value={editing.startDate} onChange={set('startDate')} />
              <DateField label="Hasta" value={editing.endDate} onChange={set('endDate')} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <OutlineButton icon="close" onClick={() => setEditing(null)}>
                Cancelar
              </OutlineButton>
              <FilledButton icon={saving ? 'hourglass_top' : 'publish'} onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>
                {editing.id ? 'Guardar cambios' : 'Publicar aviso'}
              </FilledButton>
            </div>
          </div>
        </Card>
      )}

      {!loading && notices.length === 0 ? (
        <EmptyState icon="campaign" title="Sin avisos" body="Crea el primero con “Nuevo aviso”." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {notices.map((notice) => {
            const t = typeInfo(notice.type);
            return (
              <Card key={notice.id} className="flex gap-3 p-4" style={{ opacity: notice.vigente ? 1 : 0.6 }}>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: t.bg }}
                >
                  <Icon name={t.icon} color={t.fg} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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
                  </div>
                  {notice.content && (
                    <p className="m-0 mt-1 line-clamp-3 text-sm" style={{ color: colors.textSecondary }}>
                      {notice.content}
                    </p>
                  )}
                  <div className="mt-2 text-xs" style={{ color: colors.textMuted }}>
                    {t.label} · del {notice.startDate} al {notice.endDate}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <IconAction icon="edit" label="Editar" onClick={() => setEditing({ ...notice })} />
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
