// src/pages/ScheduleScreen.jsx — Pantalla "Horario" (diseño de Leo; funciones nuevas de Alexis)
// =====================================================================
//   - Recuerda tu grupo (no hay que elegirlo cada vez).
//   - "Ahora": qué clase tienes, cuánto falta y cuál sigue (hora de Zapopan).
//   - Mi día: pestañas Lun–Vie (abre en hoy, se desliza), horas libres y
//     colores por materia. Tocar una clase → salón, piso y "Ver en el mapa".
//   - Semana: cuadrícula tipo hoja de la UdeG; descargar imagen o Excel.
//   - Oficial: la hoja del PDF de la UdeG (imagen) para ver y descargar.
//   - Fechas: exámenes y entregas del grupo (los publican los consejales).
//   - Notas: calculadora de promedio y faltas con el encuadre de cada materia.
//   - Más: salones libres, comparar con un amigo, calendario del celular
//     con recordatorios, avisos en la app y MODO CONSEJAL.
//
// Props: onShowOnMap(numeroEdificio) → abre el mapa en ese edificio (MainShell)
//        onVerPorDentro(numeroEdificio, salon) → ficha del edificio con el salón resaltado
//        user → con sesión (para saber si eres consejal y puedes publicar fechas)
// /?tab=horario&vista=fechas abre directo en Fechas (lo usa la notificación).
// Cómo probar: npm run dev → pestaña Horario.
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { scheduleCareers, groupsForCareer } from '../data/schedules.js';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import PickerField from '../components/PickerField.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import Snackbar from '../components/Snackbar.jsx';
import AhoraCard from '../components/AhoraCard.jsx';
import DiaHorario from '../components/DiaHorario.jsx';
import SemanaGrid from '../components/SemanaGrid.jsx';
import OficialHorario from '../components/OficialHorario.jsx';
import HerramientasHorario from '../components/HerramientasHorario.jsx';
import CalendarioGrupo from '../components/CalendarioGrupo.jsx';
import Calificaciones from '../components/Calificaciones.jsx';
import useCalendarioGrupo from '../hooks/useCalendarioGrupo.js';
import ClaseSheet from '../components/ClaseSheet.jsx';
import PanelConsejal from '../components/PanelConsejal.jsx';
import useReloj from '../hooks/useReloj.js';
import { imagenSemana } from '../lib/horarioImagen.js';
import { libroHorario, TIPO_XLSX } from '../lib/horarioExcel.js';
import { getMyCouncilGroups } from '../lib/api.js';
import { CICLO, aMinutos, clasesDelDia, descargarArchivo, estadoAhora, grupoPorCodigo, indicesDeMaterias, llaveClase, materiaBonita, momento } from '../lib/horario.js';

const PREFS = 'polimap.horario';
const PREFS_INICIALES = { grupo: null, aviso: 10, avisosApp: false };

function leerPrefs() {
  try {
    return { ...PREFS_INICIALES, ...JSON.parse(localStorage.getItem(PREFS)) };
  } catch {
    return { ...PREFS_INICIALES };
  }
}

const VISTAS = [
  { key: 'dia', label: 'Mi día', icon: 'today' },
  { key: 'semana', label: 'Semana', icon: 'calendar_view_week' },
  { key: 'fechas', label: 'Fechas', icon: 'event_note' },
  { key: 'notas', label: 'Notas', icon: 'calculate' },
  { key: 'oficial', label: 'Oficial', icon: 'description' },
  { key: 'mas', label: 'Más', icon: 'apps' },
];

// Ícono de cada carrera para la lista.
const ICONO_CARRERA = [
  [/INFORMATICA/, 'computer'],
  [/TELECOMUNICACIONES/, 'cell_tower'],
  [/BIOTECNOLOGIA/, 'biotech'],
  [/ENERGIAS/, 'solar_power'],
  [/MANUFACTURA/, 'precision_manufacturing'],
  [/CONTABLE/, 'calculate'],
  [/ADUANAL/, 'local_shipping'],
  [/ADMINISTRACION|ADMINSTRACION/, 'business_center'],
];
const iconoCarrera = (c) => ICONO_CARRERA.find(([r]) => r.test(c))?.[1] ?? 'school';
const carreraCorta = (c) => c.replace(/^TECNOLOGO PROFESIONAL EN /, 'Tecnólogo en ').replace(/^BACHILLERATO TECNOLOGICO (EN )?/, 'Bachillerato ').toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

// Vista inicial desde la dirección (?vista=fechas), por ejemplo al tocar la notificación.
const vistaInicial = () => {
  const v = new URLSearchParams(window.location.search).get('vista');
  return VISTAS.some((x) => x.key === v) ? v : 'dia';
};

export default function ScheduleScreen({ onShowOnMap, onVerPorDentro, user = null }) {
  const [prefs, setPrefsState] = useState(leerPrefs);
  const [vista, setVista] = useState(vistaInicial);
  const [elegir, setElegir] = useState(false);
  const [detalle, setDetalle] = useState(null); // { clase } | { salon, dia }
  const [panel, setPanel] = useState(false); // Panel de consejal abierto
  const [misGrupos, setMisGrupos] = useState([]); // [{ grupo, rol }] donde soy consejal o subconsejal
  const [mensaje, setMensaje] = useState('');
  const ahora = useReloj(30000);

  const grupo = prefs.grupo ? grupoPorCodigo(prefs.grupo) : null;
  const colores = useMemo(() => (grupo ? indicesDeMaterias(grupo) : new Map()), [grupo]);
  const estado = useMemo(() => (grupo ? estadoAhora(grupo, ahora) : null), [grupo, ahora]);
  // Fechas, encuadres y consejales del grupo (para las pestañas Fechas y Notas).
  const cal = useCalendarioGrupo(grupo?.code ?? null, user);

  function setPrefs(cambios) {
    setPrefsState((p) => {
      const nuevo = { ...p, ...cambios };
      try {
        localStorage.setItem(PREFS, JSON.stringify(nuevo));
      } catch {
        // Sin almacenamiento: solo dura mientras la app esté abierta.
      }
      return nuevo;
    });
  }

  // Avisar a Inicio (SaludoInicio) cuando cambia el grupo. Va en un efecto y
  // no dentro de setPrefs para no actualizar otra pantalla a media pintada.
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    window.dispatchEvent(new Event('polimap:horario'));
  }, [prefs.grupo]);

  // Inicio puede pedir abrir una pestaña (ej. "Mañana: examen…" → Fechas).
  useEffect(() => {
    const abrir = (e) => VISTAS.some((v) => v.key === e.detail) && setVista(e.detail);
    window.addEventListener('polimap:vista-horario', abrir);
    return () => window.removeEventListener('polimap:vista-horario', abrir);
  }, []);

  useRecordatoriosApp(grupo, prefs, ahora);

  // ¿Soy consejal o subconsejal? (lo designa un admin en el panel). Solo con sesión.
  useEffect(() => {
    if (!user) {
      setMisGrupos([]);
      return undefined;
    }
    let vivo = true;
    getMyCouncilGroups()
      .then((r) => vivo && setMisGrupos(r.grupos ?? []))
      .catch(() => vivo && setMisGrupos([]));
    return () => {
      vivo = false;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const miPuesto = misGrupos[0] ?? null; // un alumno está en un solo grupo como consejal

  const abrirEnMapa = onShowOnMap
    ? (numero) => {
        setDetalle(null);
        onShowOnMap(numero);
      }
    : null;

  if (!grupo) {
    return (
      <div className="app-scroll flex-1 px-[18px] pb-7 pt-3">
        <div className="mx-auto max-w-[560px]">
          <div className="pb-4 pt-6">
            <EmptyState icon="calendar_month" title="¿Cuál es tu grupo?" body="Elígelo una vez y POLIMAP lo recuerda: te dirá qué clase tienes ahora, en qué salón y cuál sigue." />
          </div>
          <ElegirGrupo actual={null} onElegir={(codigo) => setPrefs({ grupo: codigo })} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-scroll flex-1 px-[18px] pb-7 pt-3">
      <div className="mx-auto flex max-w-[980px] flex-col gap-3">
        {/* Grupo */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: colors.surface, borderRadius: 18, border: `1px solid ${colors.border}` }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ backgroundColor: colors.magentaTint, borderRadius: 12 }}>
            <Icon name={iconoCarrera(grupo.career)} size={22} color={colors.magentaDark} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-black leading-tight">
              {grupo.code} <span className="text-xs font-bold" style={{ color: colors.textMuted }}>· {grupo.weeklyHours} h/semana</span>
            </div>
            <div className="truncate text-xs" style={{ color: colors.textSecondary }}>
              {grupo.group} · {grupo.shift} · {carreraCorta(grupo.career)}
            </div>
          </div>
          <button type="button" onClick={() => setElegir(true)} className="tappable flex h-9 shrink-0 items-center gap-1 px-3 text-xs font-black" style={{ borderRadius: 999, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textSecondary }}>
            <Icon name="swap_horiz" size={16} color={colors.textSecondary} />
            Cambiar
          </button>
        </div>

        {estado && <AhoraCard estado={estado} onAbrirClase={(clase) => setDetalle({ clase })} />}

        {/* Vistas */}
        {/* 6 pestañas: ícono arriba y texto abajo para que quepan en el celular */}
        <div className="horario-vistas flex gap-1 overflow-x-auto p-1" role="tablist" aria-label="Vista del horario" style={{ backgroundColor: alpha(colors.ink, 0.08), borderRadius: 16 }}>
          {VISTAS.map((v) => {
            const activo = vista === v.key;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setVista(v.key)}
                className="tappable flex min-h-[52px] min-w-[54px] flex-1 flex-col items-center justify-center gap-[2px] border-0 px-1 text-[0.6875rem] font-black"
                style={{ borderRadius: 12, backgroundColor: activo ? colors.surface : 'transparent', color: activo ? colors.ink : colors.textSecondary, boxShadow: activo ? `0 1px 4px ${alpha(colors.blue, 0.15)}` : 'none' }}
              >
                <Icon name={v.icon} size={18} color={activo ? colors.magentaDark : colors.textSecondary} />
                {v.label}
              </button>
            );
          })}
        </div>

        {vista === 'dia' && <DiaHorario grupo={grupo} colores={colores} estado={estado} onAbrirClase={(clase) => setDetalle({ clase })} />}
        {vista === 'semana' && <VistaSemana grupo={grupo} colores={colores} estado={estado} onAbrirClase={(clase) => setDetalle({ clase })} onMensaje={setMensaje} />}
        {vista === 'fechas' && <CalendarioGrupo grupo={grupo} cal={cal} hoy={momento(ahora).fecha} user={user} onMensaje={setMensaje} />}
        {vista === 'notas' && <Calificaciones grupo={grupo} cal={cal} onMensaje={setMensaje} />}
        {vista === 'oficial' && <OficialHorario grupo={grupo} />}
        {vista === 'mas' && (
          <HerramientasHorario grupo={grupo} estado={estado} prefs={prefs} onPrefs={setPrefs} onAbrirSalon={(salon, dia) => setDetalle({ salon, dia })} puesto={miPuesto} onPanel={() => setPanel(true)} />
        )}

        <p className="m-0 mt-1 text-center text-[0.6875rem]" style={{ color: colors.textMuted }}>
          Horarios del calendario {CICLO.nombre}. Verifica cambios con tu coordinación.
        </p>
      </div>

      <BottomSheet open={elegir} onClose={() => setElegir(false)} icon="groups" title="Cambiar de grupo" subtitle="Tu grupo se guarda en este celular.">
        <ElegirGrupo
          actual={grupo}
          onElegir={(codigo) => {
            setPrefs({ grupo: codigo });
            setElegir(false);
          }}
        />
      </BottomSheet>

      <ClaseSheet clase={detalle?.clase ?? null} salon={detalle?.salon ?? null} dia={detalle?.dia} grupo={detalle?.clase ? grupo.code : null} onShowOnMap={abrirEnMapa}
        onVerPorDentro={
          onVerPorDentro
            ? (numero, salon) => {
                setDetalle(null);
                onVerPorDentro(numero, salon);
              }
            : null
        }
        onClose={() => setDetalle(null)}
      />

      {panel && miPuesto && <PanelConsejal codigo={miPuesto.grupo} rol={miPuesto.rol} user={user} onClose={() => setPanel(false)} />}
      {mensaje && <Snackbar message={mensaje} onDismiss={() => setMensaje('')} />}
      <style>{`.horario-vistas{scrollbar-width:none}.horario-vistas::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

/** Carrera y grupo con la lista bonita (PickerField). */
function ElegirGrupo({ actual, onElegir }) {
  const [carrera, setCarrera] = useState(actual?.career ?? null);
  const grupos = carrera ? groupsForCareer(carrera) : [];
  const opcionesGrupo = ['Matutino', 'Vespertino']
    .map((turno) => ({
      label: `Turno ${turno.toLowerCase()}`,
      icon: turno === 'Matutino' ? 'wb_sunny' : 'wb_twilight',
      options: grupos.filter((g) => g.shift === turno).map((g) => ({ value: g.code, label: g.code, description: `${g.group} · ${g.weeklyHours} h a la semana`, icon: turno === 'Matutino' ? 'wb_sunny' : 'wb_twilight', color: turno === 'Matutino' ? colors.gold : colors.magenta })),
    }))
    .filter((g) => g.options.length);

  return (
    <div className="flex flex-col gap-3">
      <PickerField
        value={carrera}
        onChange={setCarrera}
        placeholder="Selecciona tu carrera"
        prefixIcon="school"
        title="¿Qué estudias?"
        options={scheduleCareers.map((c) => ({ value: c, label: carreraCorta(c), icon: iconoCarrera(c), color: colors.cyan, description: `${groupsForCareer(c).length} grupos` }))}
      />
      <PickerField
        value={actual?.career === carrera ? actual?.code : null}
        onChange={(codigo) => codigo && onElegir(codigo)}
        placeholder={carrera ? 'Selecciona tu grupo' : 'Primero elige la carrera'}
        prefixIcon="groups"
        title="¿Cuál es tu grupo?"
        options={opcionesGrupo}
      />
    </div>
  );
}

/** Pestaña Semana: cuadrícula + descargar imagen/Excel. (La división del grupo está en el Panel de consejal.) */
function VistaSemana({ grupo, colores, estado, onAbrirClase, onMensaje }) {
  const [trabajando, setTrabajando] = useState('');
  async function descargar(tipo) {
    setTrabajando(tipo);
    try {
      if (tipo === 'imagen') {
        descargarArchivo(await imagenSemana({ grupo, colores }), `Horario ${grupo.code} ${CICLO.nombre}.png`);
      } else {
        descargarArchivo(new Blob([await libroHorario({ grupo, colores, modos: null })], { type: TIPO_XLSX }), `Horario ${grupo.code} ${CICLO.nombre}.xlsx`);
      }
    } catch (e) {
      onMensaje(`No se pudo descargar: ${e.message}`);
    } finally {
      setTrabajando('');
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <SemanaGrid grupo={grupo} colores={colores} estado={estado} onTocar={onAbrirClase} />
      <div className="grid grid-cols-2 gap-2">
        <BotonVista icon={trabajando === 'imagen' ? 'hourglass_top' : 'image'} onClick={() => descargar('imagen')}>
          Descargar imagen
        </BotonVista>
        <BotonVista icon={trabajando === 'excel' ? 'hourglass_top' : 'table_view'} onClick={() => descargar('excel')}>
          Descargar Excel
        </BotonVista>
      </div>
    </div>
  );
}

function BotonVista({ icon, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="tappable flex h-11 items-center justify-center gap-2 text-sm font-black" style={{ borderRadius: 14, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}>
      <Icon name={icon} size={20} color={colors.textPrimary} />
      {children}
    </button>
  );
}

/**
 * Avisos en la app: si están activados, manda una notificación `aviso`
 * minutos antes de cada clase. Funciona mientras POLIMAP esté abierta
 * (aunque sea en otra pestaña); para avisos con la app cerrada está el
 * calendario del celular (.ics).
 */
function useRecordatoriosApp(grupo, prefs, ahora) {
  const avisados = useRef(new Set());
  useEffect(() => {
    if (!grupo || !prefs.avisosApp || !prefs.aviso || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const e = estadoAhora(grupo, ahora);
    for (const c of clasesDelDia(grupo, e.dia)) {
      const faltan = aMinutos(c.start) - e.minuto;
      const llave = `${e.fecha}|${llaveClase(c)}`;
      if (faltan > 0 && faltan <= prefs.aviso && !avisados.current.has(llave)) {
        avisados.current.add(llave);
        const titulo = `${materiaBonita(c.subject)} en ${faltan} min`;
        const opciones = { body: `${c.room} · ${c.start}`, tag: llave, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' };
        notificar(titulo, opciones);
      }
    }
  }, [grupo, prefs.avisosApp, prefs.aviso, ahora]);
}

/** Notificación: por el service worker (Android lo exige) o directa si no hay. */
function notificar(titulo, opciones) {
  const directa = () => {
    try {
      new Notification(titulo, opciones); // eslint-disable-line no-new
    } catch {
      // Este navegador no deja mostrarla.
    }
  };
  if (!navigator.serviceWorker) return directa();
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => (reg ? reg.showNotification(titulo, opciones) : directa()))
    .catch(directa);
}
