// src/components/DiaHorario.jsx — Responsable: Alexis (pantalla de Horario)
// Vista "Mi día": pestañas Lun–Vie y las clases del día elegido.
//   - Abre en el día de hoy (o el lunes si es fin de semana).
//   - Se cambia de día tocando la pestaña o deslizando a los lados.
//   - Cada clase con su color de materia; la que está en curso dice AHORA.
//   - Entre clases aparecen las horas libres ("Libre 1 h · 11:00–12:00").
//   - Tocar una clase abre su detalle (salón y "Ver en el mapa").
//
// Props: grupo, colores (Map materia→índice), estado (estadoAhora), onAbrirClase(clase)
import { useEffect, useRef, useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { DIAS_CORTOS, aHora, aMinutos, clasesDelDia, diasConClases, duracion, huecos, llaveClase, materiaBonita, nombreBonito, maestrosDeClase, tonoDe } from '../lib/horario.js';

export default function DiaHorario({ grupo, colores, estado, onAbrirClase }) {
  const dias = diasConClases(grupo);
  const inicial = Math.max(0, dias.indexOf(estado.dia));
  const [elegido, setElegido] = useState(inicial);
  const carril = useRef(null);
  const moviendo = useRef(false);

  // Al cambiar de grupo, volver al día de hoy.
  useEffect(() => {
    setElegido(inicial);
    requestAnimationFrame(() => carril.current?.scrollTo({ left: inicial * carril.current.clientWidth }));
  }, [grupo.code]); // eslint-disable-line react-hooks/exhaustive-deps

  function irA(i) {
    setElegido(i);
    moviendo.current = true;
    carril.current?.scrollTo({ left: i * carril.current.clientWidth, behavior: 'smooth' });
    setTimeout(() => (moviendo.current = false), 450);
  }

  function alDeslizar(e) {
    if (moviendo.current) return;
    const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
    if (i !== elegido) setElegido(i);
  }

  return (
    <div>
      {/* Pestañas de días */}
      <div className="flex gap-1 p-1" role="tablist" aria-label="Día" style={{ backgroundColor: colors.surface, borderRadius: 16, border: `1px solid ${colors.border}` }}>
        {dias.map((d, i) => {
          const activo = i === elegido;
          const hoy = d === estado.dia;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => irA(i)}
              className="tappable relative flex h-11 flex-1 flex-col items-center justify-center border-0 text-sm font-black"
              style={{ borderRadius: 12, backgroundColor: activo ? colors.blue : 'transparent', color: activo ? colors.white : colors.textSecondary }}
            >
              {DIAS_CORTOS[d]}
              {hoy && <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ backgroundColor: activo ? colors.gold : colors.crimson }} aria-label="hoy" />}
            </button>
          );
        })}
      </div>

      {/* Días (se deslizan) */}
      <div ref={carril} onScroll={alDeslizar} className="dia-carril -mx-[18px] mt-3 flex snap-x snap-mandatory overflow-x-auto">
        {dias.map((d) => (
          <div key={d} className="w-full shrink-0 snap-center px-[18px]" role="tabpanel" aria-label={d}>
            <ListaDia grupo={grupo} dia={d} colores={colores} estado={estado} onAbrirClase={onAbrirClase} />
          </div>
        ))}
      </div>
      <style>{`.dia-carril{scrollbar-width:none}.dia-carril::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

function ListaDia({ grupo, dia, colores, estado, onAbrirClase }) {
  const clases = clasesDelDia(grupo, dia);
  const libres = huecos(clases);
  const esHoy = dia === estado.dia;
  const primera = clases[0];
  const ultima = clases[clases.length - 1];

  // Mezclar clases y huecos en orden de hora.
  const filas = [...clases.map((c) => ({ tipo: 'clase', desde: aMinutos(c.start), c })), ...libres.map((h) => ({ tipo: 'hueco', ...h }))].sort((a, b) => a.desde - b.desde);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 text-xs font-bold" style={{ color: colors.textMuted }}>
        <span>
          {dia}
          {esHoy ? ' · hoy' : ''}
        </span>
        {primera && (
          <span>
            {primera.start} a {aHora(aMinutos(ultima.end))} · {clases.length} {clases.length === 1 ? 'clase' : 'clases'}
          </span>
        )}
      </div>
      {filas.map((f) =>
        f.tipo === 'hueco' ? (
          <div key={`h${f.desde}`} className="flex items-center gap-3 px-3 py-2 text-xs font-bold" style={{ borderRadius: 14, border: `1.5px dashed ${colors.border}`, color: colors.textSecondary }}>
            <Icon name="free_breakfast" size={18} color={colors.greenDark} />
            Libre {duracion(f.minutos)} · {aHora(f.desde)}–{aHora(f.hasta)}
          </div>
        ) : (
          <TarjetaClase
            key={llaveClase(f.c)}
            clase={f.c}
            tono={tonoDe(colores.get(f.c.subject) ?? 0)}
            ahora={esHoy && estado.actual?.clase === f.c}
            paso={esHoy && aMinutos(f.c.end) <= estado.minuto}
            onClick={() => onAbrirClase(f.c)}
          />
        )
      )}
    </div>
  );
}

function TarjetaClase({ clase, tono, ahora, paso, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable flex w-full items-stretch gap-3 border-0 p-0 text-left"
      style={{
        borderRadius: 16,
        backgroundColor: colors.surface,
        border: ahora ? `2px solid ${colors.gold}` : `1px solid ${colors.border}`,
        opacity: paso ? 0.6 : 1,
        overflow: 'hidden',
      }}
    >
      <span className="w-[6px] shrink-0" style={{ backgroundColor: tono.color }} />
      <span className="w-[52px] shrink-0 py-3">
        <span className="block text-[0.9375rem] font-black tabular-nums" style={{ color: colors.textPrimary }}>
          {clase.start}
        </span>
        <span className="block text-xs tabular-nums" style={{ color: colors.textMuted }}>
          {aHora(aMinutos(clase.end))}
        </span>
      </span>
      <span className="min-w-0 flex-1 py-3 pr-3">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm font-black leading-tight" style={{ color: colors.textPrimary }}>
            {materiaBonita(clase.subject)}
          </span>
          {ahora && (
            <span className="shrink-0 px-2 py-[2px] text-[0.625rem] font-black" style={{ borderRadius: 6, backgroundColor: colors.gold, color: colors.blue }}>
              AHORA
            </span>
          )}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-[2px] text-xs font-black" style={{ borderRadius: 8, backgroundColor: tono.fondo, color: tono.texto }}>
          <Icon name="location_on" size={14} color={tono.texto} />
          {clase.room}
        </span>
        <span className="mt-1 block truncate text-xs" style={{ color: colors.textSecondary }}>
          {maestrosDeClase(clase).map(nombreBonito).join(' · ')}
        </span>
      </span>
    </button>
  );
}
