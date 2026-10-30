// src/components/SemanaGrid.jsx — Responsable: Alexis (pantalla de Horario)
// Cuadrícula de la semana, como la hoja de la UdeG: horas a la izquierda,
// días arriba y cada clase como un bloque del alto de su duración.
//   - Normal: cada materia con su color; hoy resaltado y línea de "ahora".
//   - Modo consejal (prop `modos`): cada bloque se pinta según la división
//     (Grupo 1 azul, Grupo 2 rojo, mitad y mitad, todo el grupo, sin clase).
//
// Props:
//   grupo, colores (Map materia→índice)
//   estado       (estadoAhora) para resaltar hoy; opcional
//   modos        { llaveClase: 'g1' | … } → activa el modo consejal
//   onTocar(clase)  al tocar un bloque
//   alto         px por hora (por defecto 64)
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { DIAS_CORTOS, aHora, aMinutos, clasesDelDia, diasConClases, llaveClase, materiaBonita, rangoHoras, tonoDe } from '../lib/horario.js';
import { MODOS } from '../lib/division.js';

export default function SemanaGrid({ grupo, colores, estado, modos, onTocar, alto = 64 }) {
  const dias = diasConClases(grupo);
  const [ini, fin] = rangoHoras(grupo);
  const horas = Array.from({ length: fin - ini }, (_, i) => ini + i);
  const total = (fin - ini) * alto;
  const consejal = Boolean(modos);

  return (
    <div className="overflow-x-auto" style={{ borderRadius: 18, border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}>
      {/* En celular caben los 5 días (≈58 px cada uno); con sábado se desliza. */}
      <div className="grid" style={{ gridTemplateColumns: `40px repeat(${dias.length}, minmax(0, 1fr))`, minWidth: 40 + dias.length * 58 }}>
        {/* Encabezado */}
        <div style={{ backgroundColor: colors.blue }} />
        {dias.map((d) => {
          const hoy = estado?.dia === d;
          return (
            <div
              key={d}
              className="py-2 text-center text-xs font-black uppercase"
              style={{ backgroundColor: hoy ? colors.blueSteel : colors.blue, color: colors.white, letterSpacing: 0.4, boxShadow: hoy ? `inset 0 -3px 0 ${colors.gold}` : 'none' }}
            >
              {DIAS_CORTOS[d]}
              {hoy && <span className="ml-1 normal-case">· hoy</span>}
            </div>
          );
        })}

        {/* Columna de horas */}
        <div className="relative" style={{ height: total }}>
          {horas.map((h, i) => (
            <div key={h} className="absolute inset-x-0 pr-1 pt-1 text-right text-[0.5938rem] font-bold tabular-nums" style={{ top: i * alto, color: colors.textMuted }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Un día por columna */}
        {dias.map((d) => {
          const hoy = estado?.dia === d;
          return (
            <div key={d} className="relative" style={{ height: total, borderLeft: `1px solid ${colors.border}`, backgroundColor: hoy ? alpha(colors.gold, 0.06) : undefined }}>
              {horas.map((h, i) => (
                <div key={h} className="absolute inset-x-0" style={{ top: i * alto, height: alto, borderTop: i ? `1px solid ${alpha(colors.border, 0.7)}` : 'none' }} />
              ))}
              {clasesDelDia(grupo, d).map((c) => {
                const top = ((aMinutos(c.start) - ini * 60) / 60) * alto;
                const h = ((aMinutos(c.end) - aMinutos(c.start)) / 60) * alto;
                return (
                  <Bloque
                    key={llaveClase(c)}
                    clase={c}
                    top={top}
                    alto={h}
                    tono={tonoDe(colores.get(c.subject) ?? 0)}
                    modo={consejal ? modos[llaveClase(c)] ?? 'normal' : null}
                    ahora={hoy && estado?.actual?.clase === c}
                    onClick={onTocar ? () => onTocar(c) : undefined}
                  />
                );
              })}
              {hoy && estado && estado.minuto >= ini * 60 && estado.minuto <= fin * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: ((estado.minuto - ini * 60) / 60) * alto }} aria-hidden>
                  <div className="h-[2px]" style={{ backgroundColor: colors.crimson }} />
                  <div className="absolute -left-[4px] -top-[3px] h-2 w-2 rounded-full" style={{ backgroundColor: colors.crimson }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Estilo de un bloque según el modo consejal. */
export function estiloModo(modo, tono) {
  switch (modo) {
    case 'g1':
      return { background: colors.cyanSolid, color: colors.white };
    case 'g2':
      return { background: colors.crimsonSolid, color: colors.white };
    case 'mitad':
      return { background: `linear-gradient(135deg, ${colors.cyanSolid} 0 50%, ${colors.crimsonSolid} 50% 100%)`, color: colors.white };
    case 'todos':
      return { background: colors.magentaSolid, color: colors.white };
    case 'sin':
      return { background: colors.background, color: colors.textMuted, tachado: true };
    case 'normal':
      return { background: colors.surface, color: colors.textPrimary, borde: colors.border };
    default:
      return { background: tono.fondo, color: tono.texto, franja: tono.color };
  }
}

function Bloque({ clase, top, alto, tono, modo, ahora, onClick }) {
  const e = estiloModo(modo, tono);
  const Etiqueta = onClick ? 'button' : 'div';
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={`${clase.day} ${clase.start}: ${materiaBonita(clase.subject)}${modo ? ` (${MODOS[modo].label})` : ''}`}
      className={`absolute inset-x-[2px] z-[1] flex flex-col overflow-hidden border-0 p-1 text-left ${onClick ? 'tappable' : ''}`}
      style={{
        top: top + 2,
        height: alto - 4,
        borderRadius: 10,
        background: e.background,
        color: e.color,
        border: ahora ? `2px solid ${colors.gold}` : e.borde ? `1px solid ${e.borde}` : 'none',
        boxShadow: e.franja ? `inset 3px 0 0 ${e.franja}` : undefined,
      }}
    >
      <span className={`line-clamp-3 text-[0.6562rem] font-black leading-[1.15] ${e.tachado ? 'line-through' : ''}`}>{materiaBonita(clase.subject)}</span>
      {alto > 50 && <span className="mt-auto truncate text-[0.5938rem] font-bold opacity-90">{clase.room.replace(/^(Aula|Lab\.|Taller) /, '')}</span>}
      {alto > 50 && <span className="truncate text-[0.5625rem] opacity-75 tabular-nums">{clase.start}–{aHora(aMinutos(clase.end))}</span>}
      {e.tachado && (
        // Tachado con una X roja, como en la hoja de los consejales.
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
          <line x1="0" y1="0" x2="100" y2="100" stroke={colors.crimson} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1="100" y1="0" x2="0" y2="100" stroke={colors.crimson} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {modo && modo !== 'normal' && modo !== 'sin' && (
        <span className="absolute right-1 top-1 hidden rounded px-1 text-[0.5312rem] font-black sm:block" style={{ backgroundColor: alpha(colors.white, 0.22) }}>
          {MODOS[modo].corto}
        </span>
      )}
      {ahora && <Icon name="schedule" size={12} color={colors.gold} style={{ position: 'absolute', right: 3, bottom: 3 }} />}
    </Etiqueta>
  );
}
