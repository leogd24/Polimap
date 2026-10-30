import { useEffect, useMemo, useState } from 'react';
import { colors } from '../styles/theme.js';
import { campusBuildings } from '../data/campusBuildings.js';
import Icon from '../components/Icon.jsx';
import PushCard from '../components/PushCard.jsx';
import AvisosInicio from '../components/AvisosInicio.jsx';
import CommentsSheet from '../components/CommentsSheet.jsx';
import SaludoInicio from '../components/SaludoInicio.jsx';
import TuDia from '../components/TuDia.jsx';
import useNoticesFeed from '../hooks/useNoticesFeed.js';
import useGrupoGuardado from '../hooks/useGrupoGuardado.js';
import useReloj from '../hooks/useReloj.js';
import { getWeather, getGroupCalendar } from '../lib/api.js';
import { consejoClima } from '../lib/clima.js';
import { aMinutos, clasesDelDia, estadoAhora, momento } from '../lib/horario.js';
import { proximasImportantes } from '../lib/calendarioGrupo.js';

/// Equivalente de screens/home_screen.dart — diseño "Google" con los colores del Poli (Alexis)
///   1. Saludo, fecha y clima + tarjeta de tu clase (SaludoInicio).
///   2. Buscador grande "Busca un salón, profe o aviso" (abre el asistente).
///   3. Accesos en chips con el color de cada sección (como la barra de abajo).
///   4. Tu día: clases, exámenes y avisos urgentes en orden de hora (TuDia).
///   5. Avisos estilo Google Discover (AvisosInicio).
///   6. Activar avisos en el celular (PushCard).
/// Props: onNavigate(pestaña), onOpenAssistant, onOpenBuilding(building, salon),
///        onOpenPerdidos, user, onRequestLogin, focusId (aviso de una notificación)
export default function HomeScreen({ onNavigate, onOpenAssistant, onOpenBuilding, onOpenPerdidos, user, onRequestLogin, focusId = null }) {
  const { notices, loading, like, setCount, setPoll } = useNoticesFeed();
  const [comentarios, setComentarios] = useState(null);
  const [abrirAviso, setAbrirAviso] = useState(null);

  // --- Datos del día (los usan el saludo y "Tu día") ---
  const ahora = useReloj(60000);
  const m = momento(ahora);
  const grupo = useGrupoGuardado();
  const estado = useMemo(() => (grupo ? estadoAhora(grupo, ahora) : null), [grupo, ahora]);
  const [clima, setClima] = useState(null);
  const [fechas, setFechas] = useState([]);

  // Clima: al abrir y cada 15 min (api.js lo guarda 15 min para no gastar).
  useEffect(() => {
    let vivo = true;
    const traer = () => getWeather().then((d) => vivo && setClima(d));
    traer();
    const id = setInterval(traer, 15 * 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  // Exámenes y entregas del grupo (sin internet: lo último guardado).
  useEffect(() => {
    if (!grupo) return undefined;
    let vivo = true;
    getGroupCalendar(grupo.code)
      .then((d) => vivo && setFechas(d.fechas ?? []))
      .catch(() => vivo && setFechas([]));
    return () => {
      vivo = false;
    };
  }, [grupo?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoy = grupo && m.dia !== 'Domingo' ? clasesDelDia(grupo, m.dia) : [];
  const consejo = consejoClima(clima, {
    fecha: m.fecha,
    minuto: m.minuto,
    desde: hoy.length ? aMinutos(hoy[0].start) : 7 * 60,
    hasta: hoy.length ? aMinutos(hoy[hoy.length - 1].end) : 20 * 60,
  });
  const urgentes = notices.filter((n) => n.type === 'urgente');

  // Horario en una pestaña en particular (Fechas, Notas…).
  const irAHorario = (vista) => {
    onNavigate(4);
    if (vista) window.dispatchEvent(new CustomEvent('polimap:vista-horario', { detail: vista }));
  };

  // Accesos con el color de cada sección, igual que la barra de abajo.
  const accesos = [
    { icon: 'map', label: 'Mapa', color: colors.greenDark, onTap: () => onNavigate(1) },
    { icon: 'calendar_month', label: 'Horario', color: colors.magentaDark, onTap: () => irAHorario('dia') },
    { icon: 'add_alert', label: 'Reportar', color: colors.crimsonDark, onTap: () => onNavigate(3) },
    { icon: 'apartment', label: 'Edificios', color: colors.goldDark, onTap: () => onNavigate(2) },
    { icon: 'travel_explore', label: 'Perdidos', color: colors.cyanDark, onTap: onOpenPerdidos },
    { icon: 'event_note', label: 'Fechas', color: colors.crimsonDark, onTap: () => irAHorario('fechas') },
    { icon: 'calculate', label: 'Mis notas', color: colors.greenDark, onTap: () => irAHorario('notas') },
    { icon: 'badge', label: 'Control Escolar', color: colors.ink, onTap: () => onOpenBuilding(campusBuildings.find((b) => b.number === 1)) },
  ];

  return (
    <div className="app-scroll flex-1 px-4 pt-4 pb-8">
      <div className="mx-auto flex max-w-[620px] flex-col gap-5">
        {/* 1. Saludo y tu clase */}
        <SaludoInicio
          user={user}
          grupo={grupo}
          estado={estado}
          m={m}
          consejo={consejo}
          pronto={proximasImportantes(fechas, m.fecha, 3)}
          onIrAHorario={() => irAHorario('dia')}
          onIrAFechas={() => irAHorario('fechas')}
          onComoLlegar={(numero, salon) => onOpenBuilding(campusBuildings.find((b) => b.number === numero), salon)}
        />

        {/* 2. Buscador grande (abre el asistente) */}
        <button
          type="button"
          onClick={onOpenAssistant}
          className="tappable -mt-1 flex w-full items-center gap-3 border-0 px-5 py-[14px] text-left text-[0.9375rem]"
          style={{ borderRadius: 28, backgroundColor: colors.blueTint, color: colors.textSecondary }}
        >
          <Icon name="search" size={22} color={colors.ink} />
          <span className="min-w-0 flex-1 truncate">Busca un salón, profe o aviso</span>
          <Icon name="chat_bubble" size={20} color={colors.textSecondary} />
        </button>

        {/* 3. Accesos en chips (se deslizan) */}
        <nav aria-label="Accesos rápidos" className="inicio-chips -mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {accesos.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onTap}
              className="tappable flex h-10 shrink-0 items-center gap-[6px] whitespace-nowrap px-[14px] text-[0.875rem] font-semibold"
              style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
            >
              <Icon name={a.icon} size={20} color={a.color} />
              {a.label}
            </button>
          ))}
        </nav>

        {/* 4. Tu día */}
        <TuDia
          grupo={grupo}
          estado={estado}
          m={m}
          fechas={fechas}
          urgentes={urgentes}
          onIrAHorario={() => irAHorario('dia')}
          onIrAFechas={() => irAHorario('fechas')}
          onAbrirAviso={(id) => setAbrirAviso({ id, vez: Date.now() })}
        />

        {/* 5. Avisos */}
        <section aria-label="Avisos del Poli">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="m-0 text-[1.0625rem] font-black" style={{ color: colors.textPrimary }}>
              Avisos del Poli
            </h3>
            {loading && (
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                Cargando…
              </span>
            )}
          </div>
          <AvisosInicio
            notices={notices}
            user={user}
            onLike={like}
            onOpenComments={setComentarios}
            onRequestLogin={onRequestLogin}
            onPollChange={setPoll}
            focusId={focusId}
            abrir={abrirAviso}
          />
        </section>

        {/* 6. Avisos en el celular */}
        <PushCard />
      </div>

      {comentarios && (
        <CommentsSheet
          notice={comentarios}
          user={user}
          onClose={() => setComentarios(null)}
          onRequestLogin={() => {
            setComentarios(null);
            onRequestLogin?.();
          }}
          onCountChange={(n) => setCount(comentarios.id, n)}
        />
      )}
      <style>{`.inicio-chips{scrollbar-width:none}.inicio-chips::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}
