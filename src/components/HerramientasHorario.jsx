// src/components/HerramientasHorario.jsx — Responsable: Alexis (pantalla de Horario)
// Pestaña "Más" del horario:
//   1. Salones libres: qué aulas y laboratorios están vacíos ahora (o el día
//      y hora que elijas), por edificio. Tocar uno abre su detalle y el mapa.
//   2. Comparar con un amigo: horas libres en común con otro grupo.
//   3. Mi calendario: archivo .ics con todas las clases del ciclo y un aviso
//      antes de cada una (Google Calendar, Calendario de iPhone…).
//   4. Avisos en la app: notificación unos minutos antes de cada clase
//      mientras POLIMAP esté abierta.
//   5. Panel de consejal: SOLO si un admin te designó consejal o subconsejal
//      (fechas, avisos del grupo, encuadres y división). Abre PanelConsejal.
//
// Props: grupo, estado, prefs, onPrefs(cambios), onAbrirSalon(salon, dia),
//        puesto ({ grupo, rol } | null), onPanel()
import { useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import PickerField from './PickerField.jsx';
import { SelectField, Switch } from './Inputs.jsx';
import { allSchedules, scheduleCareers } from '../data/schedules.js';
import { CICLO, DIAS, aHora, compararGrupos, descargarArchivo, generarIcs, materiaBonita, salonesLibres } from '../lib/horario.js';

export default function HerramientasHorario({ grupo, estado, prefs, onPrefs, onAbrirSalon, puesto = null, onPanel }) {
  return (
    <div className="flex flex-col gap-4">
      {puesto && <TarjetaPanel puesto={puesto} onPanel={onPanel} />}
      <SalonesLibres estado={estado} onAbrirSalon={onAbrirSalon} />
      <Comparar grupo={grupo} />
      <Calendario grupo={grupo} prefs={prefs} onPrefs={onPrefs} />
      <div className="flex items-center justify-center gap-2 text-xs" style={{ color: colors.textMuted }}>
        <Icon name="offline_bolt" size={16} color={colors.greenDark} />
        Tu horario funciona aunque no tengas internet.
      </div>
    </div>
  );
}

/** Entrada al Panel de consejal (solo para el dueto designado). */
function TarjetaPanel({ puesto, onPanel }) {
  const sub = puesto.rol === 'subconsejal';
  return (
    <section className="overflow-hidden" style={{ borderRadius: 22, background: `linear-gradient(135deg, ${colors.blueDeep}, ${colors.blue})`, color: colors.white }}>
      <div className="flex" style={{ height: 4 }} aria-hidden="true">
        {[colors.green, colors.magenta, colors.cyan, colors.gold, colors.crimson].map((c) => (
          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ borderRadius: 14, backgroundColor: colors.magentaSolid }}>
          <Icon name="how_to_reg" size={24} color={colors.white} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.6875rem] font-black uppercase" style={{ color: colors.gold, letterSpacing: 0.8 }}>
            Eres {sub ? 'subconsejal' : 'consejal'} de {puesto.grupo}
          </div>
          <h3 className="m-0 mt-[2px] text-lg font-black leading-tight">Panel de consejal</h3>
          <p className="m-0 mt-1 text-xs" style={{ color: alpha(colors.white, 0.85), lineHeight: 1.4 }}>
            Avisos y encuestas para tu grupo, exámenes y entregas, encuadres de cada materia y la división por semana.
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <button type="button" onClick={onPanel} className="tappable flex h-12 w-full items-center justify-center gap-2 border-0 text-sm font-black" style={{ borderRadius: 14, backgroundColor: colors.gold, color: colors.blue }}>
          <Icon name="dashboard" size={20} color={colors.blue} />
          Abrir mi panel
        </button>
      </div>
    </section>
  );
}

function Seccion({ icon, color, titulo, texto, children }) {
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

// ---------------------------------------------------------------------
// 1. Salones libres
// ---------------------------------------------------------------------
const HORAS = Array.from({ length: 27 }, (_, i) => 7 * 60 + i * 30); // 7:00 a 20:00 cada media hora

function SalonesLibres({ estado, onAbrirSalon }) {
  const hoyEsDeClase = DIAS.includes(estado.dia) && estado.dia !== 'Sábado';
  const [ahora, setAhora] = useState(true);
  const [dia, setDia] = useState(hoyEsDeClase ? estado.dia : 'Lunes');
  const [minuto, setMinuto] = useState(10 * 60);

  const diaUsado = ahora ? estado.dia : dia;
  const minutoUsado = ahora ? estado.minuto : minuto;
  const fuera = ahora && (!hoyEsDeClase || estado.minuto < 7 * 60 || estado.minuto >= 20 * 60);
  const lista = useMemo(() => (fuera ? [] : salonesLibres(diaUsado, minutoUsado)), [diaUsado, minutoUsado, fuera]);
  const totalLibres = lista.reduce((n, e) => n + e.libres.length, 0);

  return (
    <Seccion icon="meeting_room" color={colors.greenDark} titulo="Salones libres" texto="Aulas y laboratorios sin clase según los horarios oficiales. Ideal para estudiar o hacer equipo.">
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip activo={ahora} onClick={() => setAhora(true)} icon="schedule">
          Ahora
        </Chip>
        <Chip activo={!ahora} onClick={() => setAhora(false)} icon="event">
          Otro día u hora
        </Chip>
      </div>
      {!ahora && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <SelectField sinVacio value={dia} onChange={(v) => v && setDia(v)} prefixIcon="today" options={DIAS.slice(0, 5).map((d) => ({ value: d, label: d }))} placeholder="Día" />
          <SelectField sinVacio value={String(minuto)} onChange={(v) => v && setMinuto(Number(v))} prefixIcon="schedule" options={HORAS.map((m) => ({ value: String(m), label: aHora(m) }))} placeholder="Hora" />
        </div>
      )}
      {fuera ? (
        <p className="m-0 text-sm" style={{ color: colors.textSecondary }}>
          Ahorita no hay clases (las clases son de lunes a viernes, de 7:00 a 20:00). Elige “Otro día u hora”.
        </p>
      ) : (
        <>
          <div className="mb-2 text-xs font-bold" style={{ color: colors.textMuted }}>
            {diaUsado} {aHora(minutoUsado)} · {totalLibres} libres
          </div>
          <div className="flex flex-col gap-2">
            {lista
              .filter((e) => e.edificio)
              .map((e) => (
                <div key={e.edificio} className="flex items-start gap-3">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center text-sm font-black" style={{ borderRadius: 10, backgroundColor: colors.blueTint, color: colors.ink }}>
                    {e.edificio}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {e.libres.length === 0 && (
                      <span className="py-1 text-xs" style={{ color: colors.textMuted }}>
                        Todos ocupados
                      </span>
                    )}
                    {e.libres.map((l) => (
                      <button
                        key={l.salon}
                        type="button"
                        onClick={() => onAbrirSalon(l.salon, diaUsado)}
                        className="tappable flex flex-col items-start border-0 px-2 py-1 text-left"
                        style={{ borderRadius: 10, backgroundColor: colors.greenTint, color: colors.greenDark }}
                      >
                        <span className="text-xs font-black">{l.salon.replace(/^(Aula|Lab\.|Taller) E\d+-/, '')}</span>
                        <span className="text-[0.625rem]" style={{ color: colors.textSecondary }}>
                          {l.hasta ? `hasta ${aHora(l.hasta)}` : 'resto del día'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </Seccion>
  );
}

function Chip({ activo, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="tappable flex h-9 items-center gap-1 px-3 text-xs font-black"
      style={{ borderRadius: 999, border: `1.5px solid ${activo ? colors.blue : colors.border}`, backgroundColor: activo ? colors.blue : colors.surface, color: activo ? colors.white : colors.textSecondary }}
    >
      <Icon name={icon} size={16} color={activo ? colors.white : colors.textSecondary} />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// 2. Comparar con otro grupo
// ---------------------------------------------------------------------
function Comparar({ grupo }) {
  const [otro, setOtro] = useState(null);
  const opciones = useMemo(
    () =>
      scheduleCareers.map((carrera) => ({
        label: carrera.replace(/^TECNOLOGO PROFESIONAL EN /, 'TP en ').replace(/^BACHILLERATO TECNOLOGICO /, 'BT '),
        options: allSchedules
          .filter((g) => g.career === carrera && g.code !== grupo.code)
          .sort((a, b) => a.shift.localeCompare(b.shift) || a.code.localeCompare(b.code))
          .map((g) => ({ value: g.code, label: g.code, description: `${g.group} · ${g.shift}` })),
      })),
    [grupo.code]
  );
  const g2 = allSchedules.find((g) => g.code === otro);
  const resultado = g2 ? compararGrupos(grupo, g2) : [];

  return (
    <Seccion icon="handshake" color={colors.cyanDark} titulo="Comparar con un amigo" texto="Elige el grupo de alguien y te digo a qué horas están libres los dos.">
      <PickerField value={otro} onChange={setOtro} placeholder="Grupo de tu amigo" prefixIcon="group_add" title="¿De qué grupo es?" options={opciones} clearable />
      {g2 && (
        <div className="mt-3 flex flex-col gap-2">
          {resultado.map((d) => (
            <div key={d.dia} className="flex items-start gap-3 px-3 py-2 text-sm" style={{ borderRadius: 12, backgroundColor: colors.background }}>
              <span className="w-[74px] shrink-0 font-black">{d.dia}</span>
              <span className="min-w-0 flex-1" style={{ color: colors.textSecondary }}>
                {d.soloUno ? (
                  `Solo ${d.soloUno === 'a' ? grupo.code : g2.code} tiene clases`
                ) : d.libres.length ? (
                  d.libres.map((l) => (
                    <span key={l.desde} className="mb-1 mr-1 inline-block px-2 py-[1px] text-xs font-black" style={{ borderRadius: 8, backgroundColor: colors.cyanTint, color: colors.cyanDark }}>
                      {aHora(l.desde)}–{aHora(l.hasta)}
                    </span>
                  ))
                ) : (
                  'Sin horas libres juntas'
                )}
                {d.juntos.length > 0 && (
                  <span className="block text-xs" style={{ color: colors.magentaDark }}>
                    Tienen juntos: {d.juntos.map((c) => `${materiaBonita(c.subject)} (${c.start})`).join(', ')}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Seccion>
  );
}

// ---------------------------------------------------------------------
// 3 y 4. Calendario del celular y avisos en la app
// ---------------------------------------------------------------------
function Calendario({ grupo, prefs, onPrefs }) {
  const [permiso, setPermiso] = useState(() => (typeof Notification === 'undefined' ? 'no' : Notification.permission));

  function descargarIcs() {
    descargarArchivo(generarIcs(grupo, { aviso: prefs.aviso }), `Horario ${grupo.code} ${CICLO.nombre}.ics`, 'text/calendar;charset=utf-8');
  }

  async function cambiarAvisos(activo) {
    if (activo && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setPermiso(await Notification.requestPermission());
    }
    onPrefs({ avisosApp: activo });
  }

  return (
    <Seccion icon="notifications_active" color={colors.goldDark} titulo="Recordatorios de clase" texto="Que tu celular te avise antes de cada clase.">
      <div className="mb-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-[1fr_auto]">
        <SelectField
          sinVacio
          value={String(prefs.aviso)}
          onChange={(v) => v !== null && onPrefs({ aviso: Number(v) })}
          prefixIcon="alarm"
          options={[
            { value: '5', label: 'Avisarme 5 min antes', icon: 'alarm' },
            { value: '10', label: 'Avisarme 10 min antes', icon: 'alarm' },
            { value: '15', label: 'Avisarme 15 min antes', icon: 'alarm' },
            { value: '30', label: 'Avisarme 30 min antes', icon: 'alarm' },
            { value: '0', label: 'Sin aviso', icon: 'alarm_off' },
          ]}
          placeholder="Aviso"
        />
        <button
          type="button"
          onClick={descargarIcs}
          className="tappable flex h-[54px] items-center justify-center gap-2 border-0 px-4 text-sm font-black"
          style={{ borderRadius: 14, backgroundColor: colors.gold, color: colors.blue }}
        >
          <Icon name="calendar_add_on" size={20} color={colors.blue} />
          Agregar a mi calendario
        </button>
      </div>
      <p className="m-0 mb-3 text-xs" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
        Descarga un archivo con todas tus clases hasta el fin del ciclo {CICLO.nombre}. Ábrelo y tu celular (Google Calendar o Calendario de iPhone)
        te avisará aunque no abras POLIMAP.
      </p>
      <div className="flex items-center gap-3 px-3 py-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
        <Icon name="phone_iphone" size={22} color={colors.textSecondary} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">Avisos de POLIMAP</div>
          <div className="text-xs" style={{ color: colors.textSecondary }}>
            {permiso === 'denied'
              ? 'Bloqueaste las notificaciones de POLIMAP en el navegador.'
              : permiso === 'no'
                ? 'Este navegador no permite notificaciones.'
                : 'Mientras la app esté abierta (aunque sea en otra pestaña).'}
          </div>
        </div>
        <Switch value={Boolean(prefs.avisosApp) && permiso === 'granted'} onChange={cambiarAvisos} label="Avisos de POLIMAP antes de cada clase" />
      </div>
    </Seccion>
  );
}
