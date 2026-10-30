// src/components/CalendarioGrupo.jsx — Responsable: Alexis (Horario → Fechas)
// =====================================================================
// Exámenes y entregas del grupo.
//   - Lo que viene, agrupado: Esta semana / La próxima semana / Noviembre…
//     con "mañana", "en 3 días" y la hora.
//   - "Agregar a mi calendario" (archivo .ics con recordatorio).
//   - En Horario → Fechas es de SOLO LECTURA para todos.
//   - El CONSEJAL y el SUBCONSEJAL del grupo (los designa un admin en el panel)
//     agregan, editan y borran desde su Panel de consejal (editar = true).
//     Al publicar, a todo el grupo le llega una notificación (si activó
//     "Avisos en tu celular" en Inicio).
//   - Abajo, quién publica en el grupo. Sin internet muestra lo último guardado.
//
// Props: grupo (objeto de horario), cal (useCalendarioGrupo), hoy ('AAAA-MM-DD'),
//        user, onMensaje(texto), editar (solo en el Panel de consejal)
// =====================================================================
import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BottomSheet from './BottomSheet.jsx';
import PickerField from './PickerField.jsx';
import FilledButton from './FilledButton.jsx';
import UserAvatar from './UserAvatar.jsx';
import { TextField, TextArea, Switch } from './Inputs.jsx';
import { saveGroupDate, deleteGroupDate } from '../lib/api.js';
import { TIPOS_FECHA, tipoFecha, agruparFechas, textoFaltan, partesFecha, fechaLarga, icsDeFecha } from '../lib/calendarioGrupo.js';
import { descargarArchivo, materiaBonita } from '../lib/horario.js';

export default function CalendarioGrupo({ grupo, cal, hoy, user, onMensaje, editar = false }) {
  const { datos, estado, recargar, cambiar } = cal;
  const [editando, setEditando] = useState(null); // {} = nueva, { id, … } = editar
  const [verPasadas, setVerPasadas] = useState(false);
  const puede = editar && Boolean(datos?.puedoPublicar);

  if (estado === 'cargando' && !datos) {
    return <p className="m-0 py-8 text-center text-sm" style={{ color: colors.textSecondary }}>Cargando fechas…</p>;
  }
  if (estado === 'error' && !datos) {
    return (
      <Aviso icon="wifi_off" titulo="No se pudieron cargar las fechas" texto="Revisa tu internet e intenta otra vez.">
        <button type="button" onClick={recargar} className="tappable mt-3 h-10 border-0 px-4 text-sm font-black" style={{ borderRadius: 12, backgroundColor: colors.blue, color: colors.white }}>
          Reintentar
        </button>
      </Aviso>
    );
  }

  const fechas = datos?.fechas ?? [];
  const { grupos, pasadas } = agruparFechas(fechas, hoy);

  async function borrar(f) {
    if (!window.confirm(`¿Borrar "${f.titulo}"? El grupo ya no la verá.`)) return;
    try {
      await deleteGroupDate(f.id);
      cambiar((d) => ({ ...d, fechas: d.fechas.filter((x) => x.id !== f.id) }));
      onMensaje('Fecha borrada.');
    } catch (e) {
      onMensaje(e.message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {datos?.offline && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold" style={{ borderRadius: 12, backgroundColor: colors.goldTint, color: colors.goldDark }}>
          <Icon name="cloud_off" size={16} color={colors.goldDark} />
          Sin internet: son las fechas que se guardaron la última vez.
        </div>
      )}

      {puede && (
        <button
          type="button"
          onClick={() => setEditando({})}
          className="tappable flex min-h-[48px] items-center justify-center gap-2 border-0 text-sm font-black"
          style={{ borderRadius: 14, backgroundColor: colors.crimsonSolid, color: colors.white }}
        >
          <Icon name="add" size={20} color={colors.white} />
          Agregar fecha para {grupo.code}
        </button>
      )}

      {grupos.length === 0 ? (
        <Aviso
          icon="event_available"
          titulo="Sin exámenes ni entregas próximas"
          texto={puede ? 'Agrega la primera: a tu grupo le llegará una notificación.' : 'Cuando tu consejal publique una fecha aparecerá aquí y te llegará una notificación (actívalas en Inicio).'}
        />
      ) : (
        grupos.map((g) => (
          <section key={g.titulo} aria-label={g.titulo}>
            <h3 className="m-0 mb-2 px-1 text-xs font-black uppercase" style={{ color: colors.textSecondary, letterSpacing: 0.5 }}>
              {g.titulo}
            </h3>
            <div className="flex flex-col gap-2">
              {g.items.map((f) => (
                <TarjetaFecha key={f.id} f={f} hoy={hoy} grupo={grupo} puede={puede} onEditar={() => setEditando(f)} onBorrar={() => borrar(f)} />
              ))}
            </div>
          </section>
        ))
      )}

      {pasadas.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerPasadas((v) => !v)} aria-expanded={verPasadas} className="tappable flex items-center gap-1 border-0 bg-transparent px-1 text-xs font-black" style={{ color: colors.textSecondary }}>
            <Icon name={verPasadas ? 'expand_less' : 'expand_more'} size={18} color={colors.textSecondary} />
            Ya pasaron ({pasadas.length})
          </button>
          {verPasadas && (
            <div className="mt-2 flex flex-col gap-2 opacity-80">
              {pasadas.map((f) => (
                <TarjetaFecha key={f.id} f={f} hoy={hoy} grupo={grupo} puede={puede} onEditar={() => setEditando(f)} onBorrar={() => borrar(f)} />
              ))}
            </div>
          )}
        </div>
      )}

      {!editar && <Consejales datos={datos} user={user} grupo={grupo} />}

      {editando && (
        <FormularioFecha
          grupo={grupo}
          inicial={editando}
          hoy={hoy}
          onClose={() => setEditando(null)}
          onGuardada={(f, push) => {
            setEditando(null);
            cambiar((d) => {
              const otras = d.fechas.filter((x) => x.id !== f.id);
              const lista = [...otras, f].sort((a, b) => (a.fecha + (a.hora ?? '99:99')).localeCompare(b.fecha + (b.hora ?? '99:99')));
              return { ...d, fechas: lista };
            });
            onMensaje(`${editando.id ? 'Fecha actualizada' : 'Fecha publicada'}.${textoPush(push)}`);
          }}
        />
      )}
    </div>
  );
}

/** " Se avisó a 12 celulares." */
function textoPush(push) {
  if (!push) return '';
  if (push.error || push.apagado) return '';
  if (!push.suscritos) return ' Nadie del grupo tiene las notificaciones activadas todavía.';
  return ` Se avisó a ${push.enviadas} ${push.enviadas === 1 ? 'celular' : 'celulares'} del grupo.`;
}

function Aviso({ icon, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center" style={{ borderRadius: 20, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
      <Icon name={icon} size={44} color={colors.textMuted} />
      <h3 className="m-0 mt-2 text-base font-black">{titulo}</h3>
      <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
        {texto}
      </p>
      {children}
    </div>
  );
}

function TarjetaFecha({ f, hoy, grupo, puede, onEditar, onBorrar }) {
  const t = tipoFecha(f.tipo);
  const p = partesFecha(f.fecha);
  const faltan = textoFaltan(f.fecha, hoy);
  const pronto = f.fecha >= hoy && (faltan === 'hoy' || faltan === 'mañana');
  return (
    <article
      className="flex gap-3 p-3"
      aria-label={`${t.label}: ${f.titulo}, ${fechaLarga(f.fecha)}`}
      style={{ borderRadius: 18, backgroundColor: colors.surface, border: `1px solid ${pronto ? t.fg : colors.border}`, boxShadow: pronto ? `inset 4px 0 0 ${t.solid}` : 'none' }}
    >
      {/* Bloque de fecha */}
      <div className="flex w-[52px] shrink-0 flex-col items-center justify-center py-1" style={{ borderRadius: 14, backgroundColor: t.bg, color: t.fg }}>
        <span className="text-[0.6875rem] font-black uppercase">{p.semana}</span>
        <span className="text-xl font-black leading-none">{p.dia}</span>
        <span className="text-[0.6875rem] font-black uppercase">{p.mes}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[0.6875rem] font-black" style={{ borderRadius: 8, backgroundColor: t.bg, color: t.fg }}>
            <Icon name={t.icon} size={14} color={t.fg} />
            {t.label}
          </span>
          <span className="text-xs font-black" style={{ color: pronto ? t.fg : colors.textSecondary }}>
            {faltan.charAt(0).toUpperCase() + faltan.slice(1)}
            {f.hora ? ` · ${f.hora}` : ''}
          </span>
        </div>
        <h4 className="m-0 mt-1 text-[0.9375rem] font-black leading-snug">{f.titulo}</h4>
        {f.materia && (
          <div className="text-xs font-bold" style={{ color: colors.textSecondary }}>
            {materiaBonita(f.materia)}
          </div>
        )}
        {f.detalle && (
          <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
            {f.detalle}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => descargarArchivo(icsDeFecha(f, grupo.code), `${t.label} - ${f.titulo}.ics`.replace(/[\\/:*?"<>|]+/g, ' '), 'text/calendar')}
            className="tappable flex h-9 items-center gap-1 px-3 text-xs font-black"
            style={{ borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
          >
            <Icon name="event_upcoming" size={16} color={colors.textSecondary} />
            A mi calendario
          </button>
          {puede && (
            <>
              <button type="button" onClick={onEditar} aria-label={`Editar ${f.titulo}`} title="Editar" className="tappable flex h-9 w-9 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
                <Icon name="edit" size={18} color={colors.textSecondary} />
              </button>
              <button type="button" onClick={onBorrar} aria-label={`Borrar ${f.titulo}`} title="Borrar" className="tappable flex h-9 w-9 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
                <Icon name="delete" size={18} color={colors.crimsonDark} />
              </button>
            </>
          )}
          {f.por && (
            <span className="ml-auto text-[0.6875rem]" style={{ color: colors.textSecondary }}>
              Publicó {f.por}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function Consejales({ datos, user, grupo }) {
  const lista = datos?.consejales ?? [];
  return (
    <section className="flex items-start gap-3 p-3" style={{ borderRadius: 16, backgroundColor: alpha(colors.ink, 0.05) }}>
      <Icon name="how_to_reg" size={22} color={colors.ink} />
      <div className="min-w-0 flex-1 text-xs" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
        {!user ? (
          'Las fechas las publican los consejales del grupo. Inicia sesión para ver quiénes son.'
        ) : lista.length ? (
          <>
            <b style={{ color: colors.textPrimary }}>Publican en {grupo.code}:</b>
            <span className="mt-1 flex flex-wrap gap-2">
              {lista.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 font-bold" style={{ color: colors.textPrimary }}>
                  <UserAvatar user={c} size={22} />
                  {c.nombre}
                  <span style={{ color: colors.textSecondary }}>({c.rol === 'subconsejal' ? 'subconsejal' : 'consejal'})</span>
                </span>
              ))}
            </span>
          </>
        ) : (
          `${grupo.code} aún no tiene consejal en POLIMAP. Pide a la coordinación que lo designe en el panel.`
        )}
        {datos?.miRol && (
          <div className="mt-1 font-black" style={{ color: colors.greenDark }}>
            Eres {datos.miRol === 'subconsejal' ? 'subconsejal' : 'consejal'}: publica fechas, avisos y encuadres desde Horario → Más → Panel de consejal.
          </div>
        )}
      </div>
    </section>
  );
}

/** Hoja para crear o editar una fecha (solo consejales). */
function FormularioFecha({ grupo, inicial, hoy, onClose, onGuardada }) {
  const materias = [...new Set(grupo.sessions.map((s) => s.subject))].sort();
  const [f, setF] = useState({
    tipo: inicial.tipo ?? 'examen',
    materia: inicial.materia || null,
    titulo: inicial.titulo ?? '',
    detalle: inicial.detalle ?? '',
    fecha: inicial.fecha ?? hoy,
    hora: inicial.hora ?? '',
    notificar: !inicial.id, // al crear se avisa; al editar, solo si lo pides
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    if (f.titulo.trim().length < 3) {
      setError('Escribe el título (ej. Primer parcial).');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const r = await saveGroupDate({ ...f, id: inicial.id, grupo: grupo.code, materia: f.materia ?? '', hora: f.hora || null });
      onGuardada(r.fecha, r.push);
    } catch (e) {
      setError(e.message || 'No se pudo guardar. Revisa tu internet.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={inicial.id ? 'Editar fecha' : 'Nueva fecha'}
      subtitle={`La verá todo ${grupo.code}`}
      icon="edit_calendar"
      footer={
        <FilledButton icon={enviando ? 'hourglass_top' : 'send'} onClick={guardar} className="w-full" style={{ opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Guardando…' : inicial.id ? 'Guardar cambios' : 'Publicar'}
        </FilledButton>
      }
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
          {Object.entries(TIPOS_FECHA).map(([k, t]) => {
            const activo = f.tipo === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => set('tipo')(k)}
                className="tappable flex min-h-[40px] items-center gap-1 px-3 text-sm font-bold"
                style={{ borderRadius: 999, border: `1.5px solid ${activo ? t.fg : colors.border}`, backgroundColor: activo ? t.bg : colors.surface, color: activo ? t.fg : colors.textPrimary }}
              >
                <Icon name={t.icon} size={18} color={activo ? t.fg : colors.textSecondary} />
                {t.label}
              </button>
            );
          })}
        </div>
        <PickerField
          value={f.materia}
          onChange={set('materia')}
          placeholder="Materia (opcional)"
          prefixIcon="menu_book"
          title="Materia"
          clearable
          options={materias.map((m) => ({ value: m, label: materiaBonita(m) }))}
        />
        <TextField value={f.titulo} onChange={set('titulo')} placeholder="Título (ej. Primer parcial)" prefixIcon="title" inputProps={{ maxLength: 120, 'aria-label': 'Título' }} />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: colors.textSecondary }}>
            Fecha
            <input type="date" value={f.fecha} onChange={(e) => set('fecha')(e.target.value)} className="h-12 px-3 text-sm" style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: colors.textSecondary }}>
            Hora (opcional)
            <input type="time" value={f.hora} onChange={(e) => set('hora')(e.target.value)} className="h-12 px-3 text-sm" style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }} />
          </label>
        </div>
        <TextArea value={f.detalle} onChange={set('detalle')} placeholder="Detalles: temas, qué llevar, formato de entrega…" minRows={3} maxLength={500} />
        <div className="flex items-center gap-3 p-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
          <Icon name="notifications_active" size={20} color={colors.textSecondary} />
          <span className="min-w-0 flex-1 text-sm">
            <b>{inicial.id ? 'Avisar al grupo del cambio' : 'Avisar al grupo'}</b>
            <span className="block text-xs" style={{ color: colors.textSecondary }}>
              Notificación a quien eligió {grupo.code} y activó los avisos.
            </span>
          </span>
          <Switch value={f.notificar} onChange={set('notificar')} label="Avisar al grupo" />
        </div>
        {error && (
          <div className="text-sm font-bold" role="alert" style={{ color: colors.crimsonDark }}>
            {error}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
