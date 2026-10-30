// src/components/ClaseSheet.jsx — Responsable: Alexis (pantalla de Horario)
// Hoja con el detalle de una clase o de un salón:
//   - materia, hora, maestro(s) y grupo (si se abrió desde una clase);
//   - el salón: edificio y piso (del esquema de edificios);
//   - las clases que hay en ese salón ese día;
//   - "Ver en el mapa" → abre el mapa en ese edificio;
//   - "Falté" → suma una falta a esa materia en la calculadora (Horario → Notas).
//
// Props:
//   clase    sesión del horario (o null si solo es un salón)
//   salon    'Aula E4-A05' (si no hay clase)
//   dia      día para la lista "En este salón" (por defecto el de la clase)
//   grupo    código del grupo de la clase (para el texto)
//   onShowOnMap(numeroEdificio)  (opcional)
//   onClose()
import { useEffect, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BottomSheet from './BottomSheet.jsx';
import FilledButton from './FilledButton.jsx';
import { allSchedules } from '../data/schedules.js';
import { aHora, aMinutos, duracion, grupoPorCodigo, infoSalon, maestrosDeClase, materiaBonita, nombreBonito } from '../lib/horario.js';
import { calcular, leerGrupo, sesionesDelSemestre, sumarFalta, textoFaltas } from '../lib/calificaciones.js';

export default function ClaseSheet({ clase, salon, dia, grupo, onShowOnMap, onVerPorDentro, onClose }) {
  const abierta = Boolean(clase || salon);
  const texto = clase?.room ?? salon ?? '';
  const info = infoSalon(texto);
  const diaLista = dia ?? clase?.day;

  // Otras clases en este salón ese día (de todos los grupos).
  const enSalon = diaLista
    ? allSchedules
        .flatMap((g) => g.sessions.filter((s) => s.room === texto && s.day === diaLista).map((s) => ({ ...s, grupo: g.code })))
        .sort((a, b) => aMinutos(a.start) - aMinutos(b.start))
    : [];

  return (
    <BottomSheet
      open={abierta}
      onClose={onClose}
      icon={clase ? 'school' : info.tipo === 'lab' ? 'science' : info.tipo === 'taller' ? 'construction' : 'meeting_room'}
      iconColor={clase ? colors.magentaDark : colors.cyanDark}
      title={clase ? materiaBonita(clase.subject) : texto}
      subtitle={clase ? `${clase.day} · ${clase.start} a ${clase.end} · ${duracion(aMinutos(clase.end) - aMinutos(clase.start))}` : info.ubicacion}
      footer={
        info.edificio && (onShowOnMap || onVerPorDentro) ? (
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            {onVerPorDentro && (
              <FilledButton icon="domain" onClick={() => onVerPorDentro(info.edificio, info.id)} background={colors.blue} style={{ flex: 1 }}>
                Ver el salón por dentro
              </FilledButton>
            )}
            {onShowOnMap && (
              <FilledButton icon="map" onClick={() => onShowOnMap(info.edificio)} style={{ flex: 1 }}>
                Edificio {info.edificio} en el mapa
              </FilledButton>
            )}
          </div>
        ) : null
      }
    >
      {clase && (
        <div className="flex flex-col gap-2">
          {maestrosDeClase(clase).map((m) => (
            <Fila key={m} icon="person" titulo={nombreBonito(m)} texto="Maestro(a)" />
          ))}
          {grupo && <Fila icon="groups" titulo={grupo} texto="Grupo" />}
          <Fila icon="location_on" titulo={clase.room} texto={info.ubicacion && info.ubicacion !== clase.room ? info.ubicacion : 'Salón'} color={colors.crimsonDark} />
          {grupo && <Faltas grupo={grupo} materia={clase.subject} />}
        </div>
      )}

      {enSalon.length > 0 && (
        <>
          <h3 className="m-0 mb-2 mt-4 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
            En {texto} el {diaLista?.toLowerCase()}
          </h3>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {enSalon.map((s, i) => {
              const mia = clase && s.start === clase.start && s.subject === clase.subject;
              return (
                <li
                  key={`${s.grupo}-${s.start}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                  style={{ borderRadius: 12, backgroundColor: mia ? colors.magentaTint : colors.background }}
                >
                  <span className="w-[86px] shrink-0 font-black tabular-nums">
                    {s.start}–{aHora(aMinutos(s.end))}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{materiaBonita(s.subject)}</span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: colors.textSecondary }}>
                    {s.grupo}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </BottomSheet>
  );
}

function Fila({ icon, titulo, texto, color = colors.ink }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2" style={{ borderRadius: 14, backgroundColor: colors.background }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: alpha(color, 0.12) }}>
        <Icon name={icon} size={20} color={color} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-black">{titulo}</div>
        <div className="text-xs" style={{ color: colors.textMuted }}>
          {texto}
        </div>
      </div>
    </div>
  );
}

/** Faltas de esta materia (de la calculadora) con botón "Falté". */
function Faltas({ grupo, materia }) {
  const leer = () => {
    const g = grupoPorCodigo(grupo);
    return calcular(leerGrupo(grupo)[materia] ?? { criterios: [], faltas: 0 }, sesionesDelSemestre(g, materia)).asistencia;
  };
  const [a, setA] = useState(leer);
  useEffect(() => setA(leer()), [grupo, materia]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex items-center gap-3 p-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
      <Icon name="event_busy" size={22} color={colors.textSecondary} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black">
          {a.faltas} {a.faltas === 1 ? 'falta' : 'faltas'}
        </div>
        <div className="text-xs" style={{ color: colors.textSecondary }}>
          {textoFaltas(a)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          sumarFalta(grupo, materia);
          setA(leer());
        }}
        className="tappable h-10 shrink-0 px-3 text-xs font-black"
        style={{ borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
      >
        Falté
      </button>
    </div>
  );
}
