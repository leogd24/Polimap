// src/admin/BuildingSchematic.jsx — Responsable: Alexis
// =====================================================================
// ESQUEMA DEL EDIFICIO (se abre al tocar un edificio en "Mapa de reportes")
//
// Dibuja la fachada del edificio como en las fotos del Poli: concreto,
// pasillos con barandal en los pisos de arriba, cortinas crema en la planta
// baja, el número pintado en el muro del extremo y un poste solar.
// Cada salón sale en su piso, de izquierda a derecha (src/data/buildingLayouts.js).
//
// Encima de cada salón con reportes va un PUNTO:
//   color  → prioridad (rojo urgente, naranja media, ciano baja, verde resuelto)
//   tamaño → cuántos reportes y apoyos hay ahí
//   late   → si hay un urgente o 3+ reportes
// Los reportes sin salón se dibujan en la explanada, frente al edificio.
//
// Al tocar un salón, a la derecha salen sus reportes; al tocar uno se abre
// el detalle de siempre (ReportDetail).
//
// El cielo cambia solo con la HORA del Poli en Zapopan (amanecer, día, tarde,
// atardecer y noche, con el sol o la luna en su lugar) y con el CLIMA real
// (nubes, lluvia, tormenta, niebla). Ver SchematicSky.jsx y src/lib/ambiente.js.
//
// Todo es SVG hecho a mano: no usa imágenes ni librerías.
// Los colores salen de theme.js (van en `style`, porque los atributos de SVG
// como fill="" no entienden var(--color-…)).
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import ReportCard from './ReportCard.jsx';
import { esquemaEdificio, espacioDeReporte, nombrePiso } from '../data/buildingLayouts.js';
import FachadaEdificio, { cajasDe, X0, X1 } from '../components/FachadaEdificio.jsx';
import { DOT_KEYS, summarize, dotRadius, sortReports } from './reportDots.js';
import { useAmbiente, AmbienteBoton } from '../components/SchematicSky.jsx';

// Medidas del dibujo y piezas (pisos, salones, cielo): src/components/FachadaEdificio.jsx
const SIN_SALON = '__sin';


export default function BuildingSchematic({ number, building, reports, onOpen, onClose, initialRoom = null }) {
  const esquema = useMemo(() => esquemaEdificio(number), [number]);
  const [sel, setSel] = useState(initialRoom);
  // Hora y clima del Poli (se actualiza cada minuto).
  const ambiente = useAmbiente();
  const amb = ambiente.amb;

  // Cerrar con Esc (si no hay un detalle de reporte abierto encima).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !document.querySelector('[data-report-detail]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reportes de este edificio repartidos por salón.
  const { porEspacio, delEdificio } = useMemo(() => {
    const lista = reports.filter((r) => r.edificioNumber === number);
    const grupos = new Map();
    lista.forEach((r) => {
      const id = espacioDeReporte(r) ?? SIN_SALON;
      if (!grupos.has(id)) grupos.set(id, []);
      grupos.get(id).push(r);
    });
    return { porEspacio: grupos, delEdificio: lista };
  }, [reports, number]);

  const total = summarize(delEdificio);
  // Posición de cada salón en el dibujo (la misma que usa FachadaEdificio).
  const cajas = useMemo(() => cajasDe(esquema), [esquema]);

  const seleccion =
    sel === SIN_SALON
      ? { id: SIN_SALON, nombre: 'Sin salón indicado', piso: null }
      : cajas.find((c) => c.id === sel) ?? null;
  const listaSel = sel ? sortReports(porEspacio.get(sel) ?? []) : [];
  const conReportes = [...porEspacio.entries()]
    .map(([id, lista]) => ({
      id,
      caja: cajas.find((c) => c.id === id),
      resumen: summarize(lista),
    }))
    .sort((a, b) => b.resumen.weight - a.resumen.weight);

  const elegir = (id) => setSel((actual) => (actual === id ? null : id));

  return (
    <div
      className="fixed inset-0 z-[35] flex items-stretch justify-center sm:items-center sm:p-5"
      style={{ backgroundColor: alpha('#000000', 0.5) }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Esquema del edificio ${number}`}
    >
      <style>{ESTILOS}</style>
      <div
        className="app-scroll flex max-h-full w-full max-w-[1280px] flex-col overflow-y-auto sm:max-h-[94vh]"
        style={{ backgroundColor: colors.background, borderRadius: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Encabezado */}
        <header className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center text-xl font-black"
            style={{ backgroundColor: colors.blue, color: colors.white, borderRadius: 14 }}
          >
            {number}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase" style={{ color: colors.crimson, letterSpacing: 0.6 }}>
              Esquema del edificio
            </div>
            <h2 className="m-0 truncate text-xl font-black" style={{ color: colors.textPrimary }}>
              Edificio {number}
              {building?.summary ? (
                <span className="font-bold" style={{ color: colors.textSecondary }}>
                  {' '}
                  · {building.summary}
                </span>
              ) : null}
            </h2>
          </div>
          <Chip icon="report" text={`${total.count} ${total.count === 1 ? 'reporte' : 'reportes'}`} />
          {total.pending > 0 && <Chip icon="pending" text={`${total.pending} sin resolver`} tone="gold" />}
          {total.urgent > 0 && <Chip icon="priority_high" text={`${total.urgent} urgente${total.urgent === 1 ? '' : 's'}`} tone="red" />}
          <AmbienteBoton ambiente={ambiente} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar esquema"
            className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
            style={{ backgroundColor: colors.surface }}
          >
            <Icon name="close" color={colors.textPrimary} />
          </button>
        </header>

        <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ------------------------- DIBUJO ------------------------- */}
          <Card className="overflow-hidden p-0" style={{ borderRadius: 20 }}>
            <FachadaEdificio
              number={number}
              esquema={esquema}
              amb={amb}
              sel={sel}
              onElegir={elegir}
              // Salón con reportes sin resolver: tinte rojo según cuántos
              rellenoSalon={(c) => {
                const lista = porEspacio.get(c.id);
                const res = lista ? summarize(lista) : null;
                return res && res.pending > 0 ? alpha(colors.crimson, Math.min(0.34, 0.1 + res.pending * 0.06)) : null;
              }}
              etiquetaSalon={(c) => (porEspacio.get(c.id) ? `${porEspacio.get(c.id).length} reportes` : '')}
              encima={({ cajas: lista, sueloY }) => (
                <>
                  {/* Puntos de reporte por salón */}
                  {lista.map((c) => {
                    const reps = porEspacio.get(c.id);
                    if (!reps) return null;
                    return <Punto key={`p-${c.id}`} cx={c.x + c.w / 2} cy={c.y + 62} resumen={summarize(reps)} onClick={() => elegir(c.id)} />;
                  })}

                  {/* Reportes sin salón: en la explanada */}
                  {porEspacio.has(SIN_SALON) && (
                    <g className="bs-dot" onClick={() => elegir(SIN_SALON)} role="button" tabIndex={0} aria-label="Reportes del edificio sin salón indicado">
                      <title>Reportes del edificio sin salón indicado</title>
                      <rect
                        x={(X0 + X1) / 2 - 110}
                        y={sueloY + 18}
                        width="220"
                        height="34"
                        rx="17"
                        style={{
                          fill: alpha('#ffffff', 0.92),
                          stroke: sel === SIN_SALON ? colors.gold : colors.border,
                          strokeWidth: sel === SIN_SALON ? 3 : 1.5,
                        }}
                      />
                      <text x={(X0 + X1) / 2 + 14} y={sueloY + 40} textAnchor="middle" style={{ fill: colors.textSecondary, fontSize: 14, fontWeight: 800 }}>
                        Sin salón · {porEspacio.get(SIN_SALON).length}
                      </text>
                      <Punto cx={(X0 + X1) / 2 - 86} cy={sueloY + 35} resumen={summarize(porEspacio.get(SIN_SALON))} small />
                    </g>
                  )}
                </>
              )}
            />

            {/* Leyenda */}
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs font-bold"
              style={{ color: colors.textSecondary, borderTop: `1px solid ${colors.border}` }}
            >
              {DOT_KEYS.map((d) => (
                <span key={d.key} className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <Icon name="bubble_chart" size={16} color={colors.textMuted} />
                Más grande = más reportes
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="radio_button_checked" size={16} color={colors.textMuted} />
                Late = urgente o 3+
              </span>
              {esquema.provisional && (
                <span className="ml-auto inline-flex items-center gap-1" style={{ color: colors.textMuted }}>
                  <Icon name="info" size={16} color={colors.textMuted} />
                  Salones tomados de los horarios 2026B
                </span>
              )}
            </div>
          </Card>

          {/* ------------------------- LISTA ------------------------- */}
          <Card className="flex min-h-[260px] flex-col p-4" style={{ borderRadius: 20 }}>
            {seleccion ? (
              <>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase" style={{ color: colors.textMuted }}>
                      {seleccion.piso ? nombrePiso(seleccion.piso) : 'Explanada'}
                    </div>
                    <h3 className="m-0 text-lg font-black">{seleccion.nombre}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSel(null)}
                    className="tappable border-0 bg-transparent p-1 text-sm font-bold underline"
                    style={{ color: colors.cyanDark }}
                  >
                    Todo el edificio
                  </button>
                </div>
                {listaSel.length === 0 ? (
                  <Vacio texto="Sin reportes en este salón con los filtros actuales." />
                ) : (
                  <div className="mt-3 grid gap-2">
                    {listaSel.map((r) => (
                      <ReportCard key={r.folio} report={r} compact onOpen={() => onOpen(r.folio)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="m-0 flex items-center gap-2 text-base font-black">
                  <Icon name="meeting_room" size={20} color={colors.ink} />
                  Salones con reportes
                </h3>
                <p className="m-0 mt-1 text-xs" style={{ color: colors.textMuted }}>
                  Toca un salón en el dibujo o en esta lista.
                </p>
                {conReportes.length === 0 ? (
                  <Vacio texto="Este edificio no tiene reportes con los filtros actuales." />
                ) : (
                  <ul className="m-0 mt-3 grid list-none gap-2 p-0">
                    {conReportes.map(({ id, caja, resumen }) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSel(id)}
                          className="tappable flex w-full items-center gap-3 border-0 px-3 py-2 text-left"
                          style={{ backgroundColor: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}` }}
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black"
                            style={{ backgroundColor: resumen.color, color: colors.white }}
                          >
                            {resumen.count}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">
                              {caja ? caja.nombre : 'Sin salón indicado'}
                            </span>
                            <span className="block text-xs" style={{ color: colors.textMuted }}>
                              {caja ? nombrePiso(caja.piso) : 'Explanada'}
                              {resumen.pending ? ` · ${resumen.pending} sin resolver` : ' · resueltos'}
                              {resumen.apoyos ? ` · +${resumen.apoyos} apoyos` : ''}
                            </span>
                          </span>
                          <Icon name="chevron_right" size={20} color={colors.textMuted} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Piezas del dibujo
// ---------------------------------------------------------------------

/** Punto de reporte: color por prioridad, tamaño por cantidad y late si es importante. */
function Punto({ cx, cy, resumen, onClick, small = false }) {
  const r = small ? 11 : dotRadius(resumen.weight, 14, 3, 30);
  return (
    <g className={resumen.loud ? 'bs-dot bs-loud' : 'bs-dot'} onClick={onClick}>
      <circle className="bs-halo" cx={cx} cy={cy} r={r + 6} style={{ fill: resumen.color, opacity: 0.28 }} />
      <circle cx={cx} cy={cy} r={r} style={{ fill: resumen.color, stroke: colors.white, strokeWidth: 3 }} />
      <text
        x={cx}
        y={cy + (small ? 4 : 5)}
        textAnchor="middle"
        pointerEvents="none"
        style={{ fill: colors.white, fontSize: small ? 11 : Math.min(16, 10 + r / 4), fontWeight: 900 }}
      >
        {resumen.count}
      </text>
    </g>
  );
}

function Chip({ icon, text, tone }) {
  const tonos = {
    red: [colors.crimsonTint, colors.crimsonDark],
    gold: [colors.goldTint, colors.goldDark],
  };
  const [bg, fg] = tonos[tone] ?? [colors.surface, colors.textSecondary];
  return (
    <span className="inline-flex h-8 items-center gap-1 px-3 text-xs font-black" style={{ backgroundColor: bg, color: fg, borderRadius: 999 }}>
      <Icon name={icon} size={16} color={fg} />
      {text}
    </span>
  );
}

function Vacio({ texto }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm" style={{ color: colors.textMuted }}>
      <Icon name="task_alt" size={36} color={colors.green} />
      {texto}
    </div>
  );
}

const ESTILOS = `
.bs-dot { cursor: pointer; }
.bs-loud .bs-halo { transform-box: fill-box; transform-origin: center; animation: bs-late 1.6s ease-out infinite; }
@keyframes bs-late { from { transform: scale(.85); opacity: .55; } to { transform: scale(1.9); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .bs-loud .bs-halo { animation: none; } }
`;
