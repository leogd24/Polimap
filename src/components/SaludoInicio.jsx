// src/components/SaludoInicio.jsx — Responsable: Alexis (Inicio de Leo)
// =====================================================================
// Arriba de Inicio, diseño "Google" (limpio) con los colores del Poli:
//   MARTES 27 DE OCTUBRE · ☁ 24°
//   Buenas tardes, Beto
//   [tarjeta noche con la franja de 5 colores]
//     SIGUIENTE CLASE · MAÑANA
//     Física y sus aplicaciones
//     7:00 – 9:00 · Aula E4-A05 (2º piso)
//     (Cómo llegar) (Examen mañana 10:00)
//   ☂ "Lleva paraguas…" solo si va a llover.
//
// Los datos (grupo, estado de la clase, fechas, clima) los calcula HomeScreen.
// Props: user, grupo, estado (estadoAhora), m (momento), consejo (consejoClima),
//        pronto (fechas de los próximos 3 días), onIrAHorario(), onIrAFechas(),
//        onComoLlegar(numeroEdificio, salon)
// =====================================================================
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BrandStripe from './BrandStripe.jsx';
import { aHora, aMinutos, duracion, infoSalon, materiaBonita } from '../lib/horario.js';
import { textoFaltan, tipoFecha } from '../lib/calendarioGrupo.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Buenos días" / "Buenas tardes" / "Buenas noches" */
function saludo(minuto) {
  if (minuto < 12 * 60) return 'Buenos días';
  if (minuto < 19 * 60) return 'Buenas tardes';
  return 'Buenas noches';
}

function primerNombre(user) {
  const n = String(user?.nombre ?? '').trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
}

export default function SaludoInicio({ user, grupo, estado, m, consejo, pronto = [], onIrAHorario, onIrAFechas, onComoLlegar }) {
  const nombre = primerNombre(user);
  const [, mes, dia] = m.fecha.split('-').map(Number);
  const fechaTexto = `${m.dia} ${dia} de ${MESES[mes - 1]}`;
  const lluvia = consejo?.texto && consejo.tono !== 'normal';

  // ¿Qué clase mostrar? La de ahora, o la siguiente (hoy, mañana o el lunes).
  const ahoraClase = estado?.estado === 'clase' ? estado.actual.clase : null;
  const sig = estado?.siguiente;
  const clase = ahoraClase ?? sig?.clase ?? null;
  const otroDia = !ahoraClase && sig && !sig.hoy;
  const etiqueta = !grupo
    ? 'TU HORARIO'
    : ahoraClase
      ? `AHORA · FALTAN ${duracion(estado.actual.faltan).toUpperCase()}`
      : sig
        ? `SIGUIENTE CLASE · ${otroDia ? (sig.manana ? 'MAÑANA' : `EL ${sig.dia.toUpperCase()}`) : `EN ${duracion(sig.en).toUpperCase()}`}`
        : 'SIN CLASES PRÓXIMAS';
  const salon = clase ? infoSalon(clase.room) : null;

  return (
    <section aria-label="Tu día">
      {/* Saludo */}
      <div className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: colors.textSecondary }}>
        <span>{fechaTexto}</span>
        {consejo && (
          <span className="inline-flex items-center gap-1" title={consejo.cielo}>
            · <Icon name={consejo.cieloIcon} size={17} color={colors.gold} />
            {consejo.temperatura}°
          </span>
        )}
      </div>
      <h2 className="m-0 mt-[2px] text-[1.75rem] font-black" style={{ color: colors.textPrimary, letterSpacing: -0.3, lineHeight: 1.15 }}>
        {saludo(m.minuto)}
        {nombre ? `, ${nombre}` : ''}
      </h2>

      {/* Tarjeta de la clase: noche del Poli con la franja de 5 colores */}
      <div className="relative mt-4 overflow-hidden" style={{ borderRadius: 24, background: `linear-gradient(135deg, ${colors.blue}, ${colors.blueLight})`, color: colors.white }}>
        <BrandStripe height={5} />
        <button type="button" onClick={onIrAHorario} className="tappable block w-full border-0 bg-transparent px-[18px] pb-2 pt-4 text-left" style={{ color: colors.white }}>
          <span className="block text-[0.6875rem] font-black" style={{ color: colors.gold, letterSpacing: 0.8 }}>
            {etiqueta}
          </span>
          <span className="mt-1 block text-[1.25rem] font-black leading-tight">
            {!grupo ? 'Elige tu grupo' : clase ? materiaBonita(clase.subject) : 'Disfruta tu tiempo libre'}
          </span>
          <span className="mt-1 block text-[0.8125rem]" style={{ color: alpha(colors.white, 0.86) }}>
            {!grupo
              ? 'Y aquí verás tu clase de ahora y la siguiente.'
              : clase
                ? `${clase.start.replace(/^0/, '')} – ${aHora(aMinutos(clase.end)).replace(/^0/, '')} · ${salon?.ubicacion || clase.room}`
                : 'No tienes más clases esta semana.'}
          </span>
          {ahoraClase && (
            <span className="mt-3 block h-[6px] overflow-hidden rounded-full" style={{ backgroundColor: alpha(colors.white, 0.2) }}>
              <span className="block h-full rounded-full" style={{ width: `${Math.round(estado.actual.progreso * 100)}%`, backgroundColor: colors.gold }} />
            </span>
          )}
        </button>
        {/* Chips de acción */}
        <div className="flex flex-wrap gap-2 px-[18px] pb-4 pt-2">
          {!grupo && <Chip icon="calendar_month" onClick={onIrAHorario}>Elegir mi grupo</Chip>}
          {salon?.edificio && <Chip icon="near_me" onClick={() => onComoLlegar?.(salon.edificio, salon.id)}>Cómo llegar</Chip>}
          {pronto[0] && (
            <Chip icon={tipoFecha(pronto[0].tipo).icon} acento={colors.crimsonDark} onClick={onIrAFechas}>
              {tipoFecha(pronto[0].tipo).label} {textoFaltan(pronto[0].fecha, m.fecha)}
              {pronto[0].hora ? ` ${pronto[0].hora}` : ''}
            </Chip>
          )}
          {grupo && !pronto[0] && <Chip icon="today" onClick={onIrAHorario}>Mi día</Chip>}
        </div>
      </div>

      {/* ¿Llevo paraguas? (solo si hay lluvia) */}
      {lluvia && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 text-[0.8125rem]" role="status" style={{ borderRadius: 14, backgroundColor: colors.goldTint, color: colors.textPrimary }}>
          <Icon name="umbrella" size={20} color={colors.goldDark} />
          <span className="min-w-0 flex-1">
            <b style={{ color: colors.goldDark }}>{consejo.titulo}:</b> {consejo.texto}
          </span>
        </div>
      )}
    </section>
  );
}

/** Chip blanco sobre la tarjeta noche. */
function Chip({ icon, acento = colors.blue, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable flex h-8 items-center gap-[5px] border-0 px-[10px] text-[0.75rem] font-bold"
      style={{ borderRadius: 14, backgroundColor: colors.white, color: colors.blue }}
    >
      <Icon name={icon} size={18} color={acento} />
      {children}
    </button>
  );
}
