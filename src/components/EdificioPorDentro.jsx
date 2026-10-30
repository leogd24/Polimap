// src/components/EdificioPorDentro.jsx — Responsable: Alexis (en la ficha de edificio de Leo)
// =====================================================================
// "Por dentro": el mismo esquema del panel (FachadaEdificio), en la app.
//   - TU salón brilla en dorado: tu clase de ahora o la siguiente de hoy en
//     este edificio (del grupo que elegiste en Horario), con un letrero
//     "Ahora" / "12:00".
//   - Si llegaste desde una clase ("Ver por dentro"), ese salón ya viene elegido.
//   - Al tocar un salón: su piso, si está libre u ocupado ahora y sus clases
//     de hoy.
//
// Props: number (edificio), salon (id del salón a resaltar, ej. 'A05'; opcional)
// =====================================================================
import { useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import FachadaEdificio from './FachadaEdificio.jsx';
import { useAmbiente } from './SchematicSky.jsx';
import useReloj from '../hooks/useReloj.js';
import { allSchedules } from '../data/schedules.js';
import { esquemaEdificio, leerSalon, nombrePiso } from '../data/buildingLayouts.js';
import { aHora, aMinutos, clasesDelDia, grupoPorCodigo, materiaBonita, momento } from '../lib/horario.js';

/** Grupo guardado en Horario. */
function grupoGuardado() {
  try {
    return grupoPorCodigo(JSON.parse(localStorage.getItem('polimap.horario'))?.grupo ?? '');
  } catch {
    return null;
  }
}

export default function EdificioPorDentro({ number, salon = null }) {
  const esquema = useMemo(() => esquemaEdificio(number), [number]);
  const { amb } = useAmbiente();
  const ahora = useReloj(60000);
  const m = momento(ahora);
  const [sel, setSel] = useState(salon);

  // Mis clases de hoy en ESTE edificio (la de ahora y las que siguen).
  const mias = useMemo(() => {
    const g = grupoGuardado();
    if (!g || m.dia === 'Domingo') return [];
    return clasesDelDia(g, m.dia)
      .filter((c) => aMinutos(c.end) > m.minuto)
      .map((c) => ({ ...c, salon: leerSalon(c.room) }))
      .filter((c) => c.salon?.edificio === Number(number));
  }, [number, m.dia, m.minuto]);
  const miSalon = mias[0]?.salon.id ?? null;
  const miClase = mias[0] ?? null;
  const enCurso = miClase && aMinutos(miClase.start) <= m.minuto;

  const caja = sel ? esquema.espacios.find((e) => e.id === sel) : null;

  // Clases de hoy en el salón elegido (todos los grupos).
  const clasesSalon = useMemo(() => {
    if (!caja || m.dia === 'Domingo') return [];
    return allSchedules
      .flatMap((g) => g.sessions.filter((s) => s.day === m.dia && leerSalon(s.room)?.edificio === Number(number) && leerSalon(s.room)?.id === caja.id).map((s) => ({ ...s, grupo: g.code })))
      .sort((a, b) => aMinutos(a.start) - aMinutos(b.start));
  }, [caja, m.dia, number]);
  const ocupada = clasesSalon.find((c) => aMinutos(c.start) <= m.minuto && m.minuto < aMinutos(c.end));
  const proxima = clasesSalon.find((c) => aMinutos(c.start) > m.minuto);

  return (
    <section aria-label={`Edificio ${number} por dentro`}>
      <div className="overflow-hidden" style={{ borderRadius: 20, border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}>
        <FachadaEdificio
          number={number}
          esquema={esquema}
          amb={amb}
          sel={sel}
          onElegir={(id) => setSel((actual) => (actual === id ? null : id))}
          rellenoSalon={(c) => (c.id === miSalon ? alpha(colors.gold, 0.42) : c.id === salon && !miSalon ? alpha(colors.cyan, 0.3) : null)}
          bordeSalon={(c) => (c.id === miSalon ? colors.gold : null)}
          etiquetaSalon={(c) => (c.id === miSalon ? `tu clase ${enCurso ? 'de ahora' : `de las ${miClase.start}`}` : '')}
          encima={({ cajas }) => {
            const c = cajas.find((x) => x.id === miSalon);
            if (!c) return null;
            const texto = enCurso ? 'TU CLASE · AHORA' : `TU CLASE · ${miClase.start}`;
            // Letrero grande: el dibujo se encoge mucho en celular.
            const ancho = texto.length * 17 + 40;
            const x = Math.min(Math.max(c.x + c.w / 2 - ancho / 2, 10), 990 - ancho);
            return (
              <g pointerEvents="none" className="pd-letrero">
                <rect x={x} y={c.y - 20} width={ancho} height="48" rx="24" style={{ fill: colors.gold, stroke: colors.white, strokeWidth: 4 }} />
                <text x={x + ancho / 2} y={c.y + 12} textAnchor="middle" style={{ fill: colors.blueDeep, fontSize: 27, fontWeight: 900, letterSpacing: 0.5 }}>
                  {texto}
                </text>
              </g>
            );
          }}
        />
        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs font-bold" style={{ color: colors.textSecondary, borderTop: `1px solid ${colors.border}` }}>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: colors.gold }} />
            Tu clase de hoy
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="touch_app" size={16} color={colors.textMuted} />
            Toca un salón
          </span>
          {esquema.provisional && <span style={{ color: colors.textMuted }}>Salones tomados de los horarios 2026B</span>}
        </div>
      </div>

      {/* Tu clase aquí */}
      {miClase && (
        <button
          type="button"
          onClick={() => setSel(miSalon)}
          className="tappable mt-3 flex w-full items-center gap-3 p-3 text-left"
          style={{ borderRadius: 16, border: `1.5px solid ${colors.gold}`, backgroundColor: alpha(colors.gold, 0.12) }}
        >
          <Icon name="school" size={24} color={colors.goldDark} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">{materiaBonita(miClase.subject)}</span>
            <span className="block text-xs" style={{ color: colors.textSecondary }}>
              {enCurso ? 'Ahora' : `Hoy a las ${miClase.start}`} · {miClase.room} · {nombrePiso(esquema.espacios.find((e) => e.id === miSalon)?.piso ?? 1)}
            </span>
          </span>
        </button>
      )}

      {/* Salón elegido */}
      {caja && (
        <div className="mt-3 p-4" style={{ borderRadius: 16, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }} aria-live="polite">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
                {nombrePiso(caja.piso)}
              </div>
              <div className="text-base font-black">{caja.nombre}</div>
            </div>
            {m.dia !== 'Domingo' && m.dia !== 'Sábado' && (
              <span
                className="px-2 py-[3px] text-xs font-black"
                style={{ borderRadius: 8, backgroundColor: ocupada ? colors.crimsonTint : colors.greenTint, color: ocupada ? colors.crimsonDark : colors.greenDark }}
              >
                {ocupada ? `Ocupado hasta ${aHora(aMinutos(ocupada.end))}` : proxima ? `Libre hasta ${proxima.start}` : 'Libre el resto del día'}
              </span>
            )}
          </div>
          {clasesSalon.length > 0 ? (
            <ol className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
              {clasesSalon.map((c, i) => (
                <li key={`${c.grupo}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm" style={{ borderRadius: 10, backgroundColor: c === ocupada ? alpha(colors.crimson, 0.08) : colors.background }}>
                  <span className="w-[92px] shrink-0 font-black tabular-nums">
                    {c.start}–{aHora(aMinutos(c.end))}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{materiaBonita(c.subject)}</span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: colors.textSecondary }}>
                    {c.grupo}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 mt-2 text-sm" style={{ color: colors.textSecondary }}>
              Hoy no hay clases en este espacio según los horarios.
            </p>
          )}
        </div>
      )}
      <style>{`.pd-letrero{animation:pd-sube .5s ease-out}@keyframes pd-sube{from{opacity:0;transform:translateY(6px)}}`}</style>
    </section>
  );
}
