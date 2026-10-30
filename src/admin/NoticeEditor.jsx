// src/admin/NoticeEditor.jsx — Responsable: Alexis
// =====================================================================
// Formulario para crear o editar un aviso, estilo Google Forms: limpio,
// sin cajas. Título grande con una línea abajo, texto que crece solo y
// las opciones en "chips".
//   - Tipo: General / Urgente / Evento
//   - ¿Quién lo ve?: Todos / Consejales y subconsejales / Solo consejales,
//     con "Ver a quién le llega" (la lista de los consejales designados en
//     Usuarios y consejales). Los avisos para consejales no los ve nadie más
//     y la notificación solo les llega a ellos (api/audiencia.php).
//   - Fechas, fotos, archivos, encuesta (PollEditor.jsx) y opciones.
//
// Props: value (el aviso en edición), onChange(fn | objeto), push (estado de
//        notificaciones o null), saving, onSave(), onCancel(), onMessage(texto)
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import { LineField, ChoiceChip, Switch } from '../components/Inputs.jsx';
import { getCouncilors } from '../lib/api.js';
import PhotoPicker from './PhotoPicker.jsx';
import FilePicker from './FilePicker.jsx';
import PollEditor from './PollEditor.jsx';

export const TIPOS_EDITOR = [
  { value: 'general', label: 'General', icon: 'campaign', tone: colors.cyanDark, tint: colors.cyanTint, barra: colors.cyan },
  { value: 'urgente', label: 'Urgente', icon: 'warning', tone: colors.crimsonDark, tint: colors.crimsonTint, barra: colors.crimson },
  { value: 'evento', label: 'Evento', icon: 'event', tone: colors.magentaDark, tint: colors.magentaTint, barra: colors.magenta },
];

export const AUDIENCIAS = [
  { value: 'todos', label: 'Todos', icon: 'public', texto: 'Alumnos, invitados y familias.' },
  { value: 'consejales', label: 'Consejales y subconsejales', icon: 'groups', texto: 'Solo el dueto de cada grupo.' },
  { value: 'solo_consejales', label: 'Solo consejales', icon: 'how_to_reg', texto: 'Solo el consejal titular de cada grupo.' },
];

export default function NoticeEditor({ value, onChange, push, saving, onSave, onCancel, onMessage }) {
  const set = (k) => (v) => onChange((n) => ({ ...n, [k]: v }));
  const tipo = TIPOS_EDITOR.find((t) => t.value === value.type) ?? TIPOS_EDITOR[0];
  const audiencia = value.audience ?? 'todos';
  const [consejales, setConsejales] = useState(null);
  const [verLista, setVerLista] = useState(false);

  // La lista de consejales solo se pide si el aviso es para ellos.
  useEffect(() => {
    if (audiencia === 'todos' || audiencia === 'grupo' || consejales) return;
    getCouncilors()
      .then((r) => setConsejales(r.consejales ?? []))
      .catch((e) => {
        setConsejales([]);
        onMessage?.(`No se pudo cargar la lista de consejales: ${e.message}`);
      });
  }, [audiencia]); // eslint-disable-line react-hooks/exhaustive-deps

  const destinatarios = useMemo(
    () => (consejales ?? []).filter((c) => audiencia === 'consejales' || (audiencia === 'solo_consejales' && c.rol === 'consejal')),
    [consejales, audiencia]
  );
  // Agrupados por grupo para la lista.
  const porGrupo = useMemo(() => {
    const m = new Map();
    destinatarios.forEach((c) => m.set(c.grupo, [...(m.get(c.grupo) ?? []), c]));
    return [...m.entries()];
  }, [destinatarios]);

  return (
    <section
      className="mb-5 overflow-hidden"
      aria-label={value.id ? 'Editar aviso' : 'Nuevo aviso'}
      style={{ borderRadius: 18, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: `0 6px 24px ${alpha(colors.blueDeep, 0.08)}` }}
    >
      {/* Franja de color del tipo, como el encabezado de Google Forms */}
      <div style={{ height: 8, backgroundColor: tipo.barra }} />

      <div className="px-5 pb-2 pt-4 sm:px-7">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
          {value.id ? 'Editar aviso' : 'Nuevo aviso'}
        </div>
        <LineField value={value.title} onChange={set('title')} placeholder="Título del aviso" size="xl" maxLength={150} inputProps={{ 'aria-label': 'Título' }} />
        <LineField
          value={value.content}
          onChange={set('content')}
          placeholder="Escribe el aviso (qué pasa, cuándo y dónde)…"
          multiline
          maxLength={2000}
          className="mt-3"
          inputProps={{ 'aria-label': 'Texto del aviso' }}
        />
        <div className="mt-1 text-right text-[11px]" style={{ color: colors.textMuted }}>
          {(value.content || '').length}/2000
        </div>
      </div>

      {/* Al elegir "Urgente" se marca solo "Mandar notificación" (si no lo habías cambiado tú). */}
      <Bloque titulo="Tipo">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de aviso">
          {TIPOS_EDITOR.map((t) => (
            <ChoiceChip
              key={t.value}
              selected={t.value === value.type}
              icon={t.icon}
              tone={t.tone}
              tint={t.tint}
              onClick={() => onChange((n) => ({ ...n, type: t.value, notify: n.notifyTocado ? n.notify : t.value === 'urgente' }))}
            >
              {t.label}
            </ChoiceChip>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="¿Quién lo ve?">
        {audiencia === 'grupo' ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
            <Icon name="groups" size={20} color={colors.magentaDark} />
            <span>
              Solo el grupo <b style={{ color: colors.textPrimary }}>{value.group}</b>. Lo publicó su consejal desde la app; puedes corregirlo o borrarlo.
            </span>
          </div>
        ) : (
        <>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quién ve el aviso">
          {AUDIENCIAS.map((a) => (
            <ChoiceChip key={a.value} selected={a.value === audiencia} icon={a.icon} onClick={() => set('audience')(a.value)}>
              {a.label}
            </ChoiceChip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: colors.textSecondary }}>
          <span>{AUDIENCIAS.find((a) => a.value === audiencia)?.texto}</span>
          {audiencia !== 'todos' && (
            <button type="button" onClick={() => setVerLista((v) => !v)} aria-expanded={verLista} className="tappable border-0 bg-transparent p-0 text-xs font-black" style={{ color: colors.ink }}>
              {consejales === null ? 'Cargando…' : `${verLista ? 'Ocultar' : 'Ver'} a quién le llega (${destinatarios.length})`}
            </button>
          )}
        </div>
        {audiencia !== 'todos' && verLista && (
          <div className="mt-2 max-h-[260px] overflow-y-auto" style={{ borderRadius: 12, border: `1px solid ${colors.border}` }}>
            {porGrupo.length === 0 ? (
              <p className="m-0 p-3 text-sm" style={{ color: colors.textSecondary }}>
                Aún no hay consejales designados. Desígnalos en “Usuarios y consejales”.
              </p>
            ) : (
              porGrupo.map(([g, lista], i) => (
                <div key={g} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" style={{ borderTop: i ? `1px solid ${colors.border}` : 'none' }}>
                  <b className="w-[84px] shrink-0">{g}</b>
                  {lista.map((c) => (
                    <span key={c.correo} className="inline-flex items-center gap-1">
                      <Icon name={c.rol === 'consejal' ? 'how_to_reg' : 'person'} size={16} color={c.rol === 'consejal' ? colors.magentaDark : colors.cyanDark} />
                      {c.nombre || c.correo}
                      <span className="text-xs" style={{ color: colors.textSecondary }}>
                        ({c.rol}){c.entro ? '' : ' · aún no entra'}
                      </span>
                    </span>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
        </>
        )}
      </Bloque>

      <Bloque titulo="Se ve en la app">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Fecha label="Desde" value={value.startDate} onChange={set('startDate')} />
          <Icon name="arrow_forward" size={18} color={colors.textMuted} />
          <Fecha label="Hasta" value={value.endDate} onChange={set('endDate')} />
        </div>
      </Bloque>

      <Bloque titulo="Fotos y archivos">
        <div className="grid gap-3">
          <PhotoPicker value={value.photos ?? []} onChange={(photos) => onChange((n) => ({ ...n, photos }))} onError={onMessage} />
          <FilePicker value={value.files ?? []} onChange={(files) => onChange((n) => ({ ...n, files }))} onError={onMessage} />
        </div>
      </Bloque>

      <Bloque titulo="Encuesta">
        <PollEditor value={value.poll ?? null} onChange={(poll) => onChange((n) => ({ ...n, poll }))} />
      </Bloque>

      <Bloque titulo="Opciones">
        <div className="flex flex-col">
          <Opcion icon="push_pin" titulo="Fijar arriba" texto="Sale primero en la app." value={Boolean(value.pinned)} onChange={set('pinned')} />
          <Opcion icon="forum" titulo="Permitir comentarios" texto="Con el filtro de groserías y reportes." value={value.allowComments !== false} onChange={set('allowComments')} />
          {push && (
            <Opcion
              icon="notifications_active"
              titulo="Mandar notificación"
              texto={audiencia === 'todos' ? `Les llega a ${push.suscritos} ${push.suscritos === 1 ? 'celular' : 'celulares'}. Úsalo para lo importante.` : 'Solo a los consejales que activaron los avisos.'}
              value={Boolean(value.notify)}
              onChange={(v) => onChange((n) => ({ ...n, notify: v, notifyTocado: true }))}
            />
          )}
        </div>
      </Bloque>

      {/* Pie: Cancelar y Publicar */}
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 sm:px-7" style={{ borderTop: `1px solid ${colors.border}` }}>
        <button type="button" onClick={onCancel} className="tappable h-10 border-0 bg-transparent px-4 text-sm font-black" style={{ color: colors.ink }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="tappable flex h-10 items-center gap-2 border-0 px-5 text-sm font-black"
          style={{ borderRadius: 999, backgroundColor: colors.ink, color: colors.surface, opacity: saving ? 0.6 : 1 }}
        >
          <Icon name={saving ? 'hourglass_top' : 'send'} size={18} color={colors.surface} />
          {value.id ? 'Guardar cambios' : 'Publicar'}
        </button>
      </div>
    </section>
  );
}

/** Bloque con su título chiquito y una línea arriba. */
function Bloque({ titulo, children }) {
  return (
    <div className="px-5 py-4 sm:px-7" style={{ borderTop: `1px solid ${colors.border}` }}>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}

/** Fecha con su etiqueta encima (estilo "outlined" de Google). */
function Fecha({ label, value, onChange }) {
  return (
    <label className="relative block">
      <span className="absolute -top-2 left-3 px-1 text-[11px] font-bold" style={{ backgroundColor: colors.surface, color: colors.textSecondary }}>
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 px-3 text-sm"
        style={{ borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
      />
    </label>
  );
}

/** Renglón con ícono, texto y un interruptor. */
function Opcion({ icon, titulo, texto, value, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2">
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <span className="min-w-0 flex-1 text-sm">
        <b>{titulo}</b>
        <span className="block text-xs" style={{ color: colors.textSecondary }}>
          {texto}
        </span>
      </span>
      <Switch value={value} onChange={onChange} label={titulo} />
    </label>
  );
}
