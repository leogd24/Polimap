// src/admin/AccessSection.jsx — Responsable: Alexis
// =====================================================================
// Sección "Usuarios y consejales".
// Diseño "equipo con credenciales" (distinto al Historial a propósito):
//
//   - Banda azul arriba: resumen en una línea + formulario para designar
//     un correo como Profesor administrador, Correo de prueba o CONSEJAL.
//     Si es profesor, se le puede mandar la invitación por correo con los pasos.
//   - Consejales: cada grupo tiene un DUETO (consejal + subconsejal). Se
//     eligen grupo y puesto; si el lugar está ocupado pregunta si reemplazar.
//     Abajo, una tarjeta por grupo con sus dos lugares (vacíos con "+ Designar").
//     Ellos publican exámenes/entregas y encuadres de su grupo y reciben los
//     avisos "solo para consejales".
//   - Profesores y pruebas: solo la cuenta maestra. Los demás admins solo
//     ven y designan consejales.
//   - Cada admin es una credencial tipo gafete: franja de color (oro la
//     cuenta maestra, azul los profesores), foto grande, nombre, rol, punto
//     de estado (activo / aún no entra / bloqueado), contraseña y cambios
//     de la semana. La nota se edita tocándola. El botón "⋯" abre las
//     acciones: ver su historial, invitar, restablecer contraseña,
//     desbloquear y quitar.
//   - Correos de prueba: "pases de invitado" en forma de etiquetas.
//   - Personas que han entrado: buscador, filtro por tipo y "Cargar más".
//
// La cuenta maestra (rol 'maestro') está en la base de datos y no se puede
// quitar desde aquí (así nadie deja el panel sin dueño).
// Todo lo que se hace aquí queda en "Historial de cambios".
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import {
  getCouncilors,
  assignCouncilor,
  removeCouncilor,
  getAccessList,
  addAccess,
  removeAccess,
  getPeople,
  updateAccessNote,
  resetAccessPassword,
  unlockAccess,
  inviteAccess,
} from '../lib/api.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { TextField, SelectField } from '../components/Inputs.jsx';
import { allSchedules, scheduleCareers } from '../data/schedules.js';
import { OutlineButton } from './ui.jsx';
import { formatDate, timeAgo } from './reportMeta.js';

const ROLES = [
  { value: 'admin', label: 'Profesor', icon: 'admin_panel_settings', placeholder: 'nombre@academicos.udg.mx', texto: 'Entra al panel (debe ser @academicos.udg.mx)' },
  { value: 'prueba', label: 'Prueba', icon: 'science', placeholder: 'evaluador@gmail.com', texto: 'Cualquier correo; reporta en la app como alumno' },
  { value: 'consejal', label: 'Consejal', icon: 'how_to_reg', placeholder: 'nombre@alumnos.udg.mx', texto: 'Alumno del grupo. Cada grupo tiene un consejal y un subconsejal' },
];
const PUESTOS = [
  { value: 'consejal', label: 'Consejal' },
  { value: 'subconsejal', label: 'Subconsejal' },
];
// Grupos del horario agrupados por carrera (para elegir el del consejal).
const OPCIONES_GRUPO = scheduleCareers.map((c) => ({
  label: c,
  options: allSchedules.filter((g) => g.career === c).map((g) => ({ value: g.code, label: `${g.code} · ${g.shift}` })),
}));
const TIPOS = {
  alumno: { label: 'Alumnos', icon: 'school', color: colors.cyanDark },
  admin: { label: 'Admins', icon: 'admin_panel_settings', color: colors.ink },
  maestro: { label: 'Maestra', icon: 'workspace_premium', color: colors.goldDark },
  prueba: { label: 'Prueba', icon: 'science', color: colors.magentaDark },
  academico: { label: 'Académicos sin acceso', icon: 'person', color: colors.textSecondary },
  ninguno: { label: 'Sin acceso', icon: 'block', color: colors.textMuted },
};

export default function AccessSection({ onMessage, onShowHistory, esMaestro = true }) {
  const [data, setData] = useState(null);
  const [consejales, setConsejales] = useState(null);
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState(esMaestro ? 'admin' : 'consejal');
  const [grupo, setGrupo] = useState(null);
  const [puesto, setPuesto] = useState('consejal');
  const [nota, setNota] = useState('');
  const [invitar, setInvitar] = useState(true);
  const [saving, setSaving] = useState(false);
  const correoRef = useRef(null);

  function load() {
    if (esMaestro) {
      getAccessList()
        .then(setData)
        .catch((error) => onMessage(`No se pudo cargar la lista: ${error.message}`));
    }
    getCouncilors()
      .then((r) => setConsejales(r.consejales ?? []))
      .catch((error) => onMessage(`No se pudieron cargar los consejales: ${error.message}. ¿Ya importaste sql/polimap.sql?`));
  }

  /** Designa consejal o subconsejal; si el lugar está ocupado, pregunta si reemplazar. */
  async function designarConsejal(reemplazar = false) {
    try {
      const r = await assignCouncilor(grupo, correo.trim(), puesto, reemplazar);
      const nombrePuesto = puesto === 'subconsejal' ? 'subconsejal' : 'consejal';
      onMessage(
        `${correo.trim()} ahora es ${nombrePuesto} de ${grupo}.` +
          (r.reemplazado ? ` Reemplaza a ${r.reemplazado}.` : '') +
          (r.antes && r.antes.grupo !== grupo ? ` (Antes estaba en ${r.antes.grupo}.)` : '')
      );
      setCorreo('');
      load();
    } catch (error) {
      if (error.status === 409 && error.data?.ocupado && !reemplazar) {
        const o = error.data.ocupado;
        if (window.confirm(`${error.message}\n\n¿Reemplazar a ${o.nombre || o.correo} por ${correo.trim()}?`)) return designarConsejal(true);
        return undefined;
      }
      onMessage(error.message);
    }
    return undefined;
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e?.preventDefault();
    if (!correo.trim() || saving) return;
    if (rol === 'consejal') {
      if (!grupo) {
        onMessage('Elige el grupo del consejal.');
        return;
      }
      setSaving(true);
      await designarConsejal();
      setSaving(false);
      return;
    }
    setSaving(true);
    try {
      const r = await addAccess(correo.trim(), rol, nota.trim(), rol === 'admin' && invitar);
      onMessage(
        `${correo.trim()} designado.` +
          (rol === 'admin' && invitar ? (r.invitado ? ' Se le mandó la invitación por correo.' : ' No se pudo mandar la invitación (revisa el correo en config.php).') : '')
      );
      setCorreo('');
      setNota('');
      load();
    } catch (error) {
      onMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Acciones de cada credencial: confirmar (si hace falta), llamar a la API y recargar.
  async function accion(fn, mensaje, confirmar) {
    if (confirmar && !window.confirm(confirmar)) return;
    try {
      await fn();
      onMessage(mensaje);
      load();
    } catch (error) {
      onMessage(error.message);
    }
  }

  // "Designar otro": sube a la banda y pone el cursor en el correo.
  function irAlFormulario() {
    setRol('admin');
    correoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => correoRef.current?.querySelector('input')?.focus(), 300);
  }

  const equipo = data?.accesos.filter((a) => a.rol === 'maestro' || a.rol === 'admin') ?? [];
  const pruebas = data?.accesos.filter((a) => a.rol === 'prueba') ?? [];
  const sinEntrar = equipo.filter((a) => !a.usuarioId).length;
  const rolInfo = ROLES.find((r) => r.value === rol);
  const rolesVisibles = esMaestro ? ROLES : ROLES.filter((r) => r.value === 'consejal');
  const duetosCompletos = new Set(
    (consejales ?? []).filter((c) => c.rol === 'consejal').map((c) => c.grupo).filter((g) => (consejales ?? []).some((x) => x.grupo === g && x.rol === 'subconsejal'))
  ).size;

  // "+ Designar" en un lugar vacío: llena el formulario y sube a la banda.
  function designarEn(g, p) {
    setRol('consejal');
    setGrupo(g);
    setPuesto(p);
    correoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => correoRef.current?.querySelector('input')?.focus(), 300);
  }

  return (
    <div>
      {/* ===== Banda azul: resumen + designar ===== */}
      <section
        className="relative mb-6 overflow-hidden p-5 sm:p-6"
        style={{ borderRadius: 26, background: `linear-gradient(135deg, ${colors.blueDeep}, ${colors.blue} 60%, ${colors.blueSteel})`, color: colors.white }}
      >
        {/* Círculos decorativos */}
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full" style={{ backgroundColor: alpha(colors.white, 0.06) }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full" style={{ backgroundColor: alpha(colors.gold, 0.12) }} />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: colors.gold }}>
              Usuarios y consejales
            </div>
            <h1 className="m-0 mt-1 text-2xl font-black sm:text-3xl">{esMaestro ? 'Equipo del panel' : 'Consejales de grupo'}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: alpha(colors.white, 0.85) }}>
              {esMaestro && <Resumen icon="badge" text={`${equipo.length} con acceso`} />}
              {esMaestro && sinEntrar > 0 && <Resumen icon="hourglass_empty" text={`${sinEntrar} sin entrar`} />}
              {esMaestro && <Resumen icon="science" text={`${pruebas.length} de prueba`} />}
              <Resumen icon="how_to_reg" text={`${duetosCompletos} de ${allSchedules.length} grupos con dueto completo`} />
              {esMaestro && <Resumen icon="group" text={`${data?.usuarios.total ?? 0} personas · ${data?.usuarios.activos7 ?? 0} activas esta semana`} />}
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            aria-label="Actualizar"
            title="Actualizar"
            className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
            style={{ backgroundColor: alpha(colors.white, 0.14) }}
          >
            <Icon name="refresh" size={20} color={colors.white} />
          </button>
        </div>

        {/* Formulario para designar */}
        <form onSubmit={add} className="relative mt-5 p-3 sm:p-4" style={{ borderRadius: 20, backgroundColor: alpha(colors.white, 0.1), border: `1px solid ${alpha(colors.white, 0.18)}` }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-black">Designar correo como</span>
            {/* Selector tipo "interruptor" de dos opciones */}
            <div className="flex p-1" role="radiogroup" style={{ borderRadius: 999, backgroundColor: alpha(colors.blueDeep, 0.45) }}>
              {rolesVisibles.map((r) => {
                const activo = r.value === rol;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => setRol(r.value)}
                    className="tappable flex h-8 items-center gap-1 border-0 px-3 text-xs font-black"
                    style={{ borderRadius: 999, backgroundColor: activo ? colors.white : 'transparent', color: activo ? colors.blue : colors.white }}
                  >
                    <Icon name={r.icon} size={16} color={activo ? colors.blue : colors.white} />
                    {r.label}
                  </button>
                );
              })}
            </div>
            <span className="text-xs" style={{ color: alpha(colors.white, 0.75) }}>
              {rolInfo.texto}
            </span>
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
            <div ref={correoRef}>
              <TextField value={correo} onChange={setCorreo} placeholder={rolInfo.placeholder} prefixIcon="mail" inputProps={{ type: 'email', 'aria-label': 'Correo' }} />
            </div>
            {rol === 'consejal' ? (
              // Consejal: grupo + puesto del dueto (en lugar de la nota)
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <SelectField value={grupo} onChange={setGrupo} placeholder="Grupo" prefixIcon="groups" options={OPCIONES_GRUPO} />
                <div className="flex items-center p-1" role="radiogroup" aria-label="Puesto" style={{ borderRadius: 14, backgroundColor: alpha(colors.blueDeep, 0.45) }}>
                  {PUESTOS.map((p) => {
                    const activo = p.value === puesto;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => setPuesto(p.value)}
                        className="tappable h-10 border-0 px-3 text-xs font-black"
                        style={{ borderRadius: 11, backgroundColor: activo ? colors.white : 'transparent', color: activo ? colors.blue : colors.white }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <TextField value={nota} onChange={setNota} placeholder="Nota (ej. Mtra. de Redes, Evaluador)" prefixIcon="sticky_note_2" inputProps={{ 'aria-label': 'Nota' }} />
            )}
            <button
              type="submit"
              disabled={saving}
              className="tappable flex h-12 items-center justify-center gap-2 border-0 px-5 text-sm font-black"
              style={{ borderRadius: 14, backgroundColor: colors.gold, color: colors.blueDeep, opacity: saving ? 0.6 : 1 }}
            >
              <Icon name={saving ? 'hourglass_top' : 'how_to_reg'} size={20} color={colors.blueDeep} />
              Designar
            </button>
          </div>
          {rol === 'admin' && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={invitar} onChange={(e) => setInvitar(e.target.checked)} className="h-4 w-4 shrink-0" style={{ accentColor: 'var(--color-gold)' }} />
                Mandarle por correo los pasos para entrar
              </label>
              {data && !data.correoActivo && <span style={{ color: colors.goldTint }}>(el correo está apagado en config.php)</span>}
            </div>
          )}
        </form>
      </section>

      {/* ===== Consejales: un dueto por grupo ===== */}
      <Duetos consejales={consejales} onDesignar={designarEn} onQuitar={(c) => accion(() => removeCouncilor(c.grupo, c.correo), `${c.correo} ya no es ${c.rol} de ${c.grupo}.`, `¿Quitar a ${c.nombre || c.correo} como ${c.rol} de ${c.grupo}?`)} />

      {esMaestro && (
      <>
      {/* ===== Credenciales ===== */}
      <Encabezado icon="badge" text="Credenciales del panel" />
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {equipo.map((a) => (
          <Credencial
            key={a.id}
            a={a}
            onNote={(n) => accion(() => updateAccessNote(a.id, n), 'Nota guardada.')}
            onInvite={() => accion(() => inviteAccess(a.id), `Invitación enviada a ${a.correo}.`)}
            onReset={() =>
              accion(
                () => resetAccessPassword(a.id),
                `Contraseña de ${a.correo} borrada. La crea de nuevo con "¿Primera vez u olvidaste tu contraseña?".`,
                `¿Restablecer la contraseña de ${a.correo}? Se cierran sus sesiones y tendrá que crear una nueva con un código.`
              )
            }
            onUnlock={() => accion(() => unlockAccess(a.id), `${a.correo} desbloqueado.`)}
            onRemove={() => accion(() => removeAccess(a.id), `${a.correo} ya no tiene acceso.`, `¿Quitar el acceso de ${a.correo}? Pierde la entrada al panel de inmediato.`)}
            onHistory={a.usuarioId ? () => onShowHistory?.({ quien: String(a.usuarioId) }) : null}
          />
        ))}
        {/* Tarjeta vacía para designar otro */}
        {data && (
          <button
            type="button"
            onClick={irAlFormulario}
            className="tappable flex min-h-[200px] flex-col items-center justify-center gap-2 p-4 text-sm font-black"
            style={{ borderRadius: 22, border: `2px dashed ${colors.border}`, backgroundColor: 'transparent', color: colors.textSecondary }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: colors.blueTint }}>
              <Icon name="person_add" size={28} color={colors.ink} />
            </span>
            Designar otro profesor
          </button>
        )}
      </div>

      {/* ===== Pases de invitado (correos de prueba) ===== */}
      <Encabezado icon="confirmation_number" text="Pases de prueba" note="Pueden reportar en la app aunque no tengan correo de alumno." />
      <div className="mb-7 flex flex-wrap gap-2">
        {pruebas.length === 0 && (
          <span className="text-sm" style={{ color: colors.textMuted }}>
            Ninguno por ahora. Usa "Prueba" en la banda de arriba para agregar uno.
          </span>
        )}
        {pruebas.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-2 py-1 pl-1 pr-1 text-sm"
            style={{ borderRadius: 999, backgroundColor: colors.surface, border: `1.5px dashed ${colors.magentaDark}` }}
            title={[a.nota, a.lastLogin ? `Entró ${timeAgo(a.lastLogin)}` : 'Aún no entra'].filter(Boolean).join(' · ')}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: colors.magentaTint }}>
              <Icon name="science" size={16} color={colors.magentaDark} />
            </span>
            <span className="max-w-[220px] truncate font-bold">{a.correo}</span>
            {a.nota && (
              <span className="hidden max-w-[140px] truncate text-xs sm:inline" style={{ color: colors.textMuted }}>
                {a.nota}
              </span>
            )}
            <button
              type="button"
              aria-label={`Quitar ${a.correo}`}
              onClick={() => accion(() => removeAccess(a.id), `${a.correo} quitado.`, `¿Quitar ${a.correo}?`)}
              className="tappable flex h-7 w-7 items-center justify-center rounded-full border-0"
              style={{ backgroundColor: colors.background }}
            >
              <Icon name="close" size={16} color={colors.textSecondary} />
            </button>
          </span>
        ))}
      </div>

      {/* ===== Personas que han entrado ===== */}
      <People onMessage={onMessage} porTipo={data?.usuarios.porTipo ?? {}} total={data?.usuarios.total ?? 0} />
      </>
      )}
    </div>
  );
}

/**
 * Consejales por grupo: una tarjeta por grupo con sus dos lugares
 * (consejal y subconsejal). Por defecto solo los grupos que ya tienen a
 * alguien; "Ver los 83 grupos" muestra también los vacíos.
 */
function Duetos({ consejales, onDesignar, onQuitar }) {
  const [q, setQ] = useState('');
  const [todos, setTodos] = useState(false);
  const lista = consejales ?? [];
  const conAlguien = new Set(lista.map((c) => c.grupo));
  const texto = q.trim().toLowerCase();
  const grupos = allSchedules.filter((g) => {
    if (!todos && !conAlguien.has(g.code) && !texto) return false;
    if (!texto) return true;
    return g.code.toLowerCase().includes(texto) || lista.some((c) => c.grupo === g.code && (c.correo.includes(texto) || (c.nombre || '').toLowerCase().includes(texto)));
  });

  return (
    <section className="mb-7">
      <Encabezado icon="how_to_reg" text="Consejales por grupo" note="Un dueto por grupo: consejal y subconsejal. Publican fechas y encuadres y reciben los avisos para consejales." />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-[360px]">
          <TextField value={q} onChange={setQ} placeholder="Buscar grupo, nombre o correo" prefixIcon="search" inputProps={{ type: 'search', 'aria-label': 'Buscar consejales' }} />
        </div>
        <OutlineButton icon={todos ? 'filter_alt' : 'grid_view'} active={todos} onClick={() => setTodos((t) => !t)}>
          {todos ? 'Solo con consejales' : `Ver los ${allSchedules.length} grupos`}
        </OutlineButton>
      </div>
      {consejales === null ? (
        <p className="text-sm" style={{ color: colors.textMuted }}>
          Cargando…
        </p>
      ) : grupos.length === 0 ? (
        <p className="text-sm" style={{ color: colors.textMuted }}>
          {texto ? 'Sin resultados.' : 'Aún no hay consejales. Usa "Consejal" en la banda de arriba o "Ver los grupos".'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => (
            <Card key={g.code} className="p-0" style={{ borderRadius: 22 }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: `linear-gradient(120deg, ${colors.magentaSolid}, ${colors.blueSteel})`, color: colors.white }}>
                <Icon name="groups" size={20} color={colors.white} />
                <b className="flex-1 text-base">{g.code}</b>
                <span className="text-xs font-bold" style={{ color: alpha(colors.white, 0.85) }}>
                  {g.shift}
                </span>
              </div>
              <div className="grid grid-cols-2">
                {PUESTOS.map((p, i) => {
                  const c = lista.find((x) => x.grupo === g.code && x.rol === p.value);
                  return (
                    <div key={p.value} className="flex min-w-0 flex-col items-center gap-1 p-3 text-center" style={{ borderLeft: i ? `1px solid ${colors.border}` : 'none' }}>
                      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                        {p.label}
                      </span>
                      {c ? (
                        <>
                          <UserAvatar user={{ nombre: c.nombre || c.correo, correo: c.correo, foto: c.foto }} size={48} ring={p.value === 'consejal' ? colors.magenta : colors.cyan} />
                          <span className="w-full truncate text-sm font-black">{c.nombre || c.correo.split('@')[0]}</span>
                          <span className="w-full truncate text-[11px]" style={{ color: colors.textSecondary }}>
                            {c.correo}
                          </span>
                          <span className="text-[11px] font-bold" style={{ color: c.entro ? colors.greenDark : colors.textMuted }}>
                            {c.entro ? 'Ya entró a la app' : 'Aún no entra'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuitar(c)}
                            className="tappable mt-1 h-8 border-0 px-3 text-[11px] font-black"
                            style={{ borderRadius: 999, backgroundColor: colors.background, color: colors.crimsonDark }}
                          >
                            Quitar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDesignar(g.code, p.value)}
                          className="tappable mt-1 flex h-[118px] w-full flex-col items-center justify-center gap-1 text-xs font-black"
                          style={{ borderRadius: 16, border: `2px dashed ${colors.border}`, backgroundColor: 'transparent', color: colors.textSecondary }}
                        >
                          <Icon name="person_add" size={24} color={colors.ink} />
                          Designar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function Resumen({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} size={16} color={colors.gold} />
      {text}
    </span>
  );
}

function Encabezado({ icon, text, note }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="m-0 flex items-center gap-2 text-lg font-black">
        <Icon name={icon} size={22} color={colors.ink} />
        {text}
      </h2>
      {note && (
        <span className="text-xs" style={{ color: colors.textMuted }}>
          {note}
        </span>
      )}
    </div>
  );
}

/** Estado de una credencial: punto de color + texto. */
function estadoDe(a) {
  if (a.bloqueadoHasta) {
    const hora = new Date(a.bloqueadoHasta).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return { color: colors.crimson, text: `Bloqueado hasta ${hora}` };
  }
  if (!a.usuarioId || !a.lastLogin) return { color: colors.textMuted, text: 'Aún no entra' };
  const horas = (Date.now() - new Date(a.lastLogin).getTime()) / 3.6e6;
  if (horas < 24 * 7) return { color: colors.green, text: `Activo · ${timeAgo(a.lastLogin)}` };
  return { color: colors.gold, text: `Inactivo · ${timeAgo(a.lastLogin)}` };
}

/** Credencial tipo gafete de un admin. */
function Credencial({ a, onNote, onInvite, onReset, onUnlock, onRemove, onHistory }) {
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState(a.nota || '');
  const maestro = a.rol === 'maestro';
  const tono = maestro ? colors.gold : colors.blue;
  const estado = estadoDe(a);

  // Opciones del menú "⋯" (solo las que aplican a esta cuenta).
  const opciones = [
    onHistory && { icon: 'history', text: 'Ver su historial', onClick: onHistory },
    !maestro && { icon: 'forward_to_inbox', text: a.lastLogin ? 'Reenviar invitación' : 'Mandar invitación', onClick: onInvite },
    a.tieneClave && { icon: 'lock_reset', text: 'Restablecer contraseña', onClick: onReset },
    a.bloqueadoHasta && { icon: 'lock_open', text: 'Desbloquear', onClick: onUnlock },
    { icon: 'edit_note', text: 'Editar nota', onClick: () => setEditando(true) },
    !maestro && { icon: 'person_remove', text: 'Quitar acceso', onClick: onRemove, danger: true },
  ].filter(Boolean);

  return (
    <Card className="relative flex flex-col items-center p-0 text-center" style={{ borderRadius: 22, overflow: 'visible' }}>
      {/* Franja superior con la "ranura" del gafete */}
      <div
        className="relative h-[72px] w-full"
        style={{
          borderRadius: '22px 22px 0 0',
          background: maestro
            ? `linear-gradient(120deg, ${colors.goldDark}, ${colors.gold})`
            : `linear-gradient(120deg, ${colors.blue}, ${colors.blueSteel})`,
        }}
      >
        <span aria-hidden className="absolute left-1/2 top-3 h-[7px] w-12 -translate-x-1/2 rounded-full" style={{ backgroundColor: alpha(colors.white, 0.55) }} />
        <span className="absolute left-4 top-3 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: alpha(colors.white, 0.9) }}>
          POLIMAP
        </span>
        <div className="absolute right-2 top-2 z-20">
          <MenuAcciones opciones={opciones} />
        </div>
      </div>

      {/* Foto grande montada sobre la franja */}
      <div className="relative z-10 -mt-10 rounded-full p-1" style={{ backgroundColor: colors.surface }}>
        <UserAvatar user={{ nombre: a.nombre, correo: a.correo, foto: a.foto }} size={76} ring={tono} />
      </div>

      <div className="w-full px-4 pb-4">
        {/* Si todavía no entra, no sabemos su nombre: usamos la parte antes de la @ */}
        <div className="mt-2 truncate text-lg font-black">{a.nombre || a.correo.split('@')[0]}</div>
        <div className="truncate text-xs" style={{ color: colors.textSecondary }}>
          {a.correo}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-[11px] font-black uppercase tracking-wider" style={{ borderRadius: 999, backgroundColor: alpha(tono, 0.14), color: maestro ? colors.goldDark : colors.ink }}>
          <Icon name={maestro ? 'workspace_premium' : 'admin_panel_settings'} size={14} color={maestro ? colors.goldDark : colors.ink} />
          {maestro ? 'Cuenta maestra' : 'Administrador'}
        </div>

        {/* Estado */}
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold" style={{ color: colors.textSecondary }} title={a.lastLogin ? formatDate(a.lastLogin) : ''}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: estado.color, boxShadow: `0 0 0 3px ${alpha(estado.color, 0.2)}` }} />
          {estado.text}
        </div>

        {/* Pie del gafete: contraseña y cambios */}
        <div className="mt-3 grid grid-cols-2 overflow-hidden text-xs" style={{ borderRadius: 12, border: `1px solid ${colors.border}` }}>
          <div className="flex flex-col items-center gap-[2px] py-2" style={{ borderRight: `1px solid ${colors.border}` }}>
            <Icon name={a.tieneClave ? 'key' : 'key_off'} size={18} color={a.tieneClave ? colors.greenDark : colors.goldDark} />
            <span style={{ color: colors.textSecondary }}>{a.tieneClave ? 'Con contraseña' : 'Sin contraseña'}</span>
          </div>
          <div className="flex flex-col items-center gap-[2px] py-2">
            <span className="text-base font-black leading-[18px]">{a.cambiosSemana}</span>
            <span style={{ color: colors.textSecondary }}>cambios (7 días)</span>
          </div>
        </div>

        {/* Nota */}
        {editando ? (
          <div className="mt-3 flex items-center gap-2 text-left">
            <div className="min-w-0 flex-1">
              <TextField value={nota} onChange={setNota} placeholder="Nota (ej. Mtra. de Redes)" prefixIcon="sticky_note_2" />
            </div>
            <IconoBoton
              icon="check"
              label="Guardar nota"
              onClick={() => {
                onNote(nota.trim());
                setEditando(false);
              }}
            />
            <IconoBoton icon="close" label="Cancelar" onClick={() => setEditando(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="mt-3 w-full border-0 bg-transparent px-2 py-1 text-xs italic"
            style={{ color: a.nota ? colors.textPrimary : colors.textMuted }}
            title="Editar nota"
          >
            {a.nota ? `“${a.nota}”` : '+ Agregar una nota'}
          </button>
        )}
        {maestro && (
          <div className="mt-1 text-[10px]" style={{ color: colors.textMuted }}>
            La cuenta maestra solo se cambia con SQL.
          </div>
        )}
      </div>
    </Card>
  );
}

/** Botón "⋯" con la lista de acciones. Se cierra al tocar fuera o con Esc. */
function MenuAcciones({ opciones }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Acciones"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="tappable flex h-9 w-9 items-center justify-center rounded-full border-0"
        style={{ backgroundColor: alpha(colors.white, 0.22) }}
      >
        <Icon name="more_horiz" size={22} color={colors.white} />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-56 overflow-hidden py-1 text-left"
          style={{ borderRadius: 14, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: `0 12px 32px ${alpha(colors.blueDeep, 0.22)}` }}
        >
          {opciones.map((o) => (
            <button
              key={o.text}
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                o.onClick();
              }}
              className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-sm font-bold hover:bg-[var(--color-background)]"
              style={{ color: o.danger ? colors.crimsonDark : colors.textPrimary }}
            >
              <Icon name={o.icon} size={18} color={o.danger ? colors.crimsonDark : colors.textSecondary} />
              {o.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Personas que han entrado: buscador, filtro por tipo y páginas. */
function People({ onMessage, porTipo, total }) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [items, setItems] = useState([]);
  const [cuantas, setCuantas] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      getPeople({ q, tipo, pagina: 0 })
        .then((d) => {
          setItems(d.items);
          setCuantas(d.total);
          setHayMas(d.hayMas);
          setPagina(0);
        })
        .catch((e) => onMessage(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mas() {
    const d = await getPeople({ q, tipo, pagina: pagina + 1 });
    setItems((l) => [...l, ...d.items]);
    setHayMas(d.hayMas);
    setPagina((p) => p + 1);
  }

  return (
    <Card className="p-5" style={{ borderRadius: 22 }}>
      <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-black">
        <Icon name="group" size={20} color={colors.ink} />
        Personas que han entrado ({total})
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <TextField value={q} onChange={setQ} placeholder="Buscar por nombre o correo" prefixIcon="search" />
        </div>
        {[['', 'Todas', 'groups', colors.textSecondary], ...Object.entries(TIPOS).filter(([k]) => porTipo[k]).map(([k, t]) => [k, t.label, t.icon, t.color])].map(
          ([k, label, icon, color]) => {
            const activo = tipo === k;
            return (
              <button
                key={k || 'todas'}
                type="button"
                onClick={() => setTipo(k)}
                className="tappable flex h-9 items-center gap-1 px-3 text-xs font-bold"
                style={{
                  borderRadius: 999,
                  border: `1.5px solid ${activo ? colors.blue : colors.border}`,
                  backgroundColor: activo ? colors.blue : colors.surface,
                  color: activo ? colors.white : colors.textSecondary,
                }}
              >
                <Icon name={icon} size={16} color={activo ? colors.white : color} />
                {label}
                <span style={{ opacity: 0.75 }}>{k ? porTipo[k] : total}</span>
              </button>
            );
          }
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr style={{ color: colors.textMuted }}>
              <th className="py-2 pr-3 text-xs font-black uppercase">Persona</th>
              <th className="py-2 pr-3 text-xs font-black uppercase">Tipo</th>
              <th className="py-2 pr-3 text-xs font-black uppercase">Primera vez</th>
              <th className="py-2 text-xs font-black uppercase">Última entrada</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const t = TIPOS[u.tipo] ?? TIPOS.ninguno;
              return (
                <tr key={u.id} className="border-t" style={{ borderColor: colors.border }}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={u} size={30} ring={colors.border} />
                      <div className="min-w-0">
                        <div className="truncate font-bold">{u.nombre || '—'}</div>
                        <div className="truncate text-xs" style={{ color: colors.textMuted }}>
                          {u.correo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: t.color }}>
                      <Icon name={t.icon} size={15} color={t.color} />
                      {t.label.replace(/s$/, '').replace('Académicos sin acceso', 'Académico')}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs" style={{ color: colors.textSecondary }}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-2 text-xs" title={formatDate(u.lastLogin)}>
                    {timeAgo(u.lastLogin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="m-0 py-6 text-center text-sm" style={{ color: colors.textMuted }}>
            Nadie coincide con la búsqueda.
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs" style={{ color: colors.textMuted }}>
        <span>
          Mostrando {items.length} de {cuantas}
        </span>
        {hayMas && (
          <OutlineButton icon="expand_more" onClick={mas}>
            Cargar más
          </OutlineButton>
        )}
      </div>
    </Card>
  );
}

function IconoBoton({ icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="tappable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0"
      style={{ backgroundColor: danger ? colors.crimsonTint : colors.background }}
    >
      <Icon name={icon} size={20} color={danger ? colors.crimsonDark : colors.textSecondary} />
    </button>
  );
}
