// src/admin/MapSection.jsx — Responsable: Alexis
// =====================================================================
// Sección "Mapa de reportes" del panel.
//
// Es el MISMO mapa 3D que hizo Marcos para los alumnos (CampusMap.jsx):
// mismos edificios en 3D, mismos pines con número y mismo límite del Poli.
// Encima le ponemos lo del panel:
//
//   - Un PUNTO por salón con reportes, en su lugar sobre el techo del
//     edificio (izquierda → derecha como en el esquema; los de pisos de
//     arriba un poco más al fondo). Color = prioridad, tamaño = cuántos
//     hay, y late si hay un urgente o 3+.
//   - Un halo de calor debajo del edificio con más reportes.
//   - En el pin de cada edificio, una burbuja con el número de reportes.
//   - Tocar un EDIFICIO abre su esquema (BuildingSchematic.jsx) con los
//     puntos en cada salón. Tocar un PUNTO abre ese reporte (o el esquema
//     en ese salón si hay varios).
//   - A la derecha: los edificios con más reportes.
// =====================================================================
import { Fragment, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, alpha } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { CAMPUS, COORDENADAS_EDIFICIOS, geometria3D, ESTILOS_MAPA } from '../components/CampusMap.jsx';
import { campusBuildings } from '../data/campusBuildings.js';
import { espacioDeReporte, posicionEspacio, buscarEspacio } from '../data/buildingLayouts.js';
import { SectionTitle, FilterBar } from './ui.jsx';
import { categoryInfo, applyFilters, locationText } from './reportMeta.js';
import { DOT_KEYS, summarize, dotRadius, sortReports } from './reportDots.js';
import BuildingSchematic from './BuildingSchematic.jsx';

const TAMANO_PIN = 28; // igual que en el mapa de Marcos
const SIN_SALON = '__sin';

/** Coordenadas de un edificio: las de la API si ya las tiene, si no las de Marcos. */
function buildingPoint(number, buildings) {
  const b = buildings.find((x) => x.number === number);
  if (b?.lat != null && b?.lng != null) return [Number(b.lat), Number(b.lng)];
  return COORDENADAS_EDIFICIOS[number] ?? null;
}

/** Mezcla dos puntos [lat, lng]: t = 0 → a, t = 1 → b. */
function mezclar(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Lugar del punto de un salón sobre el techo 3D del edificio.
 * El techo es un rectángulo: [0] suroeste, [1] sureste, [2] noreste, [3] noroeste.
 */
function puntoDeSalon(geo, numero, espacioId) {
  const techo = geo.cajas[0].techo;
  if (espacioId === SIN_SALON) return mezclar(techo[0], techo[1], 0.5); // al frente, al centro
  const pos = posicionEspacio(numero, espacioId);
  if (!pos) return geo.cima;
  const sur = mezclar(techo[0], techo[1], 0.08 + pos.fx * 0.84);
  const norte = mezclar(techo[3], techo[2], 0.08 + pos.fx * 0.84);
  const fondo = pos.pisos > 1 ? 0.2 + ((pos.piso - 1) / (pos.pisos - 1)) * 0.6 : 0.5;
  return mezclar(sur, norte, fondo);
}

/** Pin de edificio de Marcos + burbuja con los reportes. */
function iconoEdificio(numero, resumen, activo) {
  const burbuja = resumen
    ? `<span class="pm-burbuja${resumen.loud ? ' is-loud' : ''}" style="background:${resumen.color}">${resumen.count}</span>`
    : '';
  return L.divIcon({
    className: 'pm-pin-wrap',
    html: `<div class="pm-pin${activo ? ' is-active' : ''}">
        <span class="pm-pin__onda"></span>
        <span class="pm-pin__sombra"></span>
        <span class="pm-pin__cuerpo"><span>${numero}</span></span>
        ${burbuja}
      </div>`,
    iconSize: [TAMANO_PIN, TAMANO_PIN + 10],
    iconAnchor: [TAMANO_PIN / 2, TAMANO_PIN + 6],
  });
}

/** Punto de reporte (o de varios del mismo salón). */
function iconoPunto(resumen) {
  const d = Math.round(dotRadius(resumen.weight, 7, 2.2, 17) * 2);
  const numero = resumen.count > 1 ? `<b>${resumen.count}</b>` : '';
  return L.divIcon({
    className: 'pm-pin-wrap',
    html: `<span class="pm-punto${resumen.loud ? ' is-loud' : ''}" style="--d:${d}px;--c:${resumen.color}">${numero}</span>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}

export default function MapSection({ reports, buildings, buildingNames, filters, onFiltersChange, onOpen }) {
  const visible = useMemo(() => applyFilters(reports, filters, buildingNames), [reports, filters, buildingNames]);
  const [abierto, setAbierto] = useState(null); // { number, room }

  // Edificios con su geometría 3D (igual que en CampusMap.jsx).
  const edificios = useMemo(
    () =>
      campusBuildings
        .map((base) => {
          const api = buildings.find((b) => b.number === base.number) ?? {};
          const coords = buildingPoint(base.number, buildings);
          if (!coords) return null;
          return { ...base, ...api, color: api.color ?? base.color, coords, geo: geometria3D(base.number, coords) };
        })
        .filter(Boolean),
    [buildings]
  );

  // Reportes agrupados por edificio y por salón.
  const { porEdificio, puntos, sueltos, sinMapa } = useMemo(() => {
    const edif = new Map();
    const salones = new Map();
    const conGps = [];
    let faltan = 0;
    visible.forEach((r) => {
      const n = r.edificioNumber;
      if (n && edificios.some((e) => e.number === n)) {
        if (!edif.has(n)) edif.set(n, []);
        edif.get(n).push(r);
        const sala = espacioDeReporte(r) ?? SIN_SALON;
        const key = `${n}|${sala}`;
        if (!salones.has(key)) salones.set(key, { number: n, sala, lista: [] });
        salones.get(key).lista.push(r);
      } else if (r.lat != null && r.lng != null) {
        conGps.push(r);
      } else {
        faltan += 1;
      }
    });
    return { porEdificio: edif, puntos: [...salones.values()], sueltos: conGps, sinMapa: faltan };
  }, [visible, edificios]);

  const ranking = [...porEdificio.entries()]
    .map(([number, lista]) => ({ number, resumen: summarize(lista) }))
    .sort((a, b) => b.resumen.weight - a.resumen.weight);
  const maxPeso = Math.max(1, ...ranking.map((r) => r.resumen.weight));
  const zonas = useMemo(() => {
    const cuenta = {};
    sueltos.forEach((r) => {
      const z = locationText(r, buildingNames);
      cuenta[z] = (cuenta[z] || 0) + 1;
    });
    return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
  }, [sueltos, buildingNames]);

  const abrirEdificio = (number, room = null) => setAbierto({ number, room });

  return (
    <div>
      <SectionTitle
        title="Mapa de reportes"
        subtitle="Toca un edificio para ver su esquema con los reportes en cada salón."
      />
      <FilterBar filters={filters} onChange={onFiltersChange} buildings={buildings} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        {/* isolate: Leaflet usa z-index altos (400–1000); así el mapa queda
            DEBAJO del menú lateral y de la barra de arriba en el celular. */}
        <Card className="relative isolate">
          <div
            className="pm-mapa relative"
            style={{
              height: 'min(80vh, 780px)',
              // Mismas variables que usa el mapa de Marcos (vienen de theme.js).
              '--pm-azul': colors.blue,
              '--pm-carmesi': colors.crimson,
              '--pm-oro': colors.gold,
              '--pm-pin': `${TAMANO_PIN}px`,
              '--pm-sombra': colors.blueDeep,
            }}
          >
            <style>{ESTILOS_MAPA}</style>
            <style>{ESTILOS_PANEL}</style>
            <style>{edificios.map((b) => `.pm-3d--${b.number}{--c:${b.color ?? colors.blue}}`).join('')}</style>

            <MapContainer
              center={CAMPUS.centro}
              // Un nivel más cerca que el de alumnos: así se distinguen los puntos de cada salón.
              zoom={Math.min(CAMPUS.zoomInicial + 1, CAMPUS.zoomMax)}
              minZoom={CAMPUS.zoomMin}
              maxZoom={CAMPUS.zoomMax}
              maxBounds={CAMPUS.limites}
              maxBoundsViscosity={0.85}
              bounceAtZoomLimits
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                crossOrigin // así el service worker puede guardar los cuadritos y verlos sin internet
                maxNativeZoom={19}
                maxZoom={CAMPUS.zoomMax}
              />

              {/* Halo de calor debajo de cada edificio con reportes sin resolver */}
              {ranking
                .filter((r) => r.resumen.pending > 0)
                .map(({ number, resumen }) => {
                  const e = edificios.find((x) => x.number === number);
                  return (
                    <Circle
                      key={`calor-${number}`}
                      center={e.coords}
                      radius={10 + (resumen.weight / maxPeso) * 12}
                      className={`pm-calor${resumen.loud ? ' is-loud' : ''}`}
                      pathOptions={{ color: 'transparent', fillColor: 'currentColor', fillOpacity: 1 }}
                      interactive={false}
                    />
                  );
                })}

              {/* Edificios 3D de Marcos (de norte a sur, para que los de enfrente tapen) */}
              {[...edificios]
                .sort((a, b) => b.coords[0] - a.coords[0])
                .map((b) => {
                  const activo = abierto?.number === b.number;
                  const clase = `pm-3d--${b.number}${activo ? ' is-active' : ''}`;
                  const alTocar = { click: () => abrirEdificio(b.number) };
                  return (
                    <Fragment key={`${b.number}-${activo}`}>
                      {b.geo.cajas.flatMap((caja) => caja.paredes).map((pared, i) => (
                        <Polygon key={`p${i}`} positions={pared} className={`pm-3d-pared ${clase}`} bubblingMouseEvents={false} eventHandlers={alTocar} />
                      ))}
                      {b.geo.cajas.map((caja, i) => (
                        <Polygon key={`t${i}`} positions={caja.techo} className={`pm-3d-techo ${clase}`} bubblingMouseEvents={false} eventHandlers={alTocar} />
                      ))}
                    </Fragment>
                  );
                })}

              {/* Puntos por salón */}
              {puntos.map(({ number, sala, lista }) => {
                const e = edificios.find((x) => x.number === number);
                const resumen = summarize(lista);
                const ordenados = sortReports(lista);
                const nombreSala = sala === SIN_SALON ? 'Sin salón' : buscarEspacio(number, sala)?.nombre ?? sala;
                return (
                  <Marker
                    key={`${number}-${sala}`}
                    position={puntoDeSalon(e.geo, number, sala)}
                    icon={iconoPunto(resumen)}
                    zIndexOffset={resumen.loud ? 800 : 600}
                    eventHandlers={{
                      click: () => (lista.length === 1 ? onOpen(lista[0].folio) : abrirEdificio(number, sala)),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      <b>
                        Edificio {number} · {nombreSala}
                      </b>
                      {ordenados.slice(0, 4).map((r) => (
                        <div key={r.folio}>
                          {r.folio} · {categoryInfo(r.categoria).label}
                        </div>
                      ))}
                      {ordenados.length > 4 && <div>y {ordenados.length - 4} más…</div>}
                    </Tooltip>
                  </Marker>
                );
              })}

              {/* Reportes fuera de los edificios que sí traen GPS */}
              {sueltos.map((r) => (
                <Marker
                  key={r.folio}
                  position={[r.lat, r.lng]}
                  icon={iconoPunto(summarize([r]))}
                  zIndexOffset={600}
                  eventHandlers={{ click: () => onOpen(r.folio) }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <b>{r.folio}</b> · {categoryInfo(r.categoria).label}
                    <br />
                    {locationText(r, buildingNames)}
                  </Tooltip>
                </Marker>
              ))}

              {/* Pin de Marcos sobre cada edificio, con la burbuja de reportes */}
              {edificios.map((b) => {
                const lista = porEdificio.get(b.number);
                return (
                  <Marker
                    key={`pin-${b.number}-${lista?.length ?? 0}`}
                    position={b.geo.cima}
                    icon={iconoEdificio(b.number, lista ? summarize(lista) : null, abierto?.number === b.number)}
                    zIndexOffset={1000}
                    title={`Edificio ${b.number}: ver esquema`}
                    eventHandlers={{ click: () => abrirEdificio(b.number) }}
                  />
                );
              })}
            </MapContainer>
          </div>

          {/* Leyenda */}
          <div
            className="absolute bottom-3 left-3 z-[400] flex max-w-[calc(100%-24px)] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs font-bold"
            style={{ backgroundColor: alpha(colors.white, 0.95), borderRadius: 12, color: colors.textSecondary }}
          >
            {DOT_KEYS.map((d) => (
              <span key={d.key} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                {d.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <Icon name="touch_app" size={16} color={colors.textMuted} />
              Toca un edificio para ver su esquema
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="m-0 mb-1 flex items-center gap-2 text-base font-black">
            <Icon name="leaderboard" size={20} color={colors.ink} />
            Edificios con más reportes
          </h2>
          <p className="m-0 mb-3 text-xs" style={{ color: colors.textMuted }}>
            Toca uno para abrir su esquema.
          </p>
          {ranking.length === 0 && zonas.length === 0 && (
            <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
              Sin reportes con estos filtros.
            </p>
          )}
          <ol className="m-0 grid list-none gap-2 p-0">
            {ranking.map(({ number, resumen }) => (
              <li key={number}>
                <button
                  type="button"
                  onClick={() => abrirEdificio(number)}
                  className="tappable w-full border-0 bg-transparent p-2 text-left"
                  style={{ borderRadius: 12 }}
                  title={`Edificio ${number}: ${resumen.count} reportes`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: resumen.color }} />
                      <span className="truncate font-bold">{locationText({ edificioNumber: number }, buildingNames)}</span>
                    </span>
                    <span className="flex items-center gap-1 font-black">
                      {resumen.urgent > 0 && (
                        <span
                          className="px-[6px] text-[10px] font-black"
                          style={{ backgroundColor: colors.crimsonTint, color: colors.crimsonDark, borderRadius: 6 }}
                        >
                          {resumen.urgent} URG
                        </span>
                      )}
                      {resumen.count}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full" style={{ backgroundColor: colors.blueTint, borderRadius: 4 }}>
                    <div
                      className="h-2"
                      style={{ width: `${(resumen.weight / maxPeso) * 100}%`, backgroundColor: resumen.color, borderRadius: 4 }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ol>
          {zonas.length > 0 && (
            <>
              <h3 className="m-0 mt-4 mb-2 text-sm font-black" style={{ color: colors.textSecondary }}>
                Fuera de los edificios (con GPS)
              </h3>
              <ul className="m-0 grid list-none gap-1 p-0 text-sm">
                {zonas.map(([zona, n]) => (
                  <li key={zona} className="flex justify-between gap-2">
                    <span className="truncate">{zona}</span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
          {sinMapa > 0 && (
            <p className="m-0 mt-4 text-xs" style={{ color: colors.textMuted }}>
              {sinMapa} reporte(s) de zonas abiertas sin GPS no aparecen en el mapa.
            </p>
          )}
        </Card>
      </div>

      {abierto && (
        <BuildingSchematic
          key={`${abierto.number}-${abierto.room ?? ''}`}
          number={abierto.number}
          building={edificios.find((e) => e.number === abierto.number)}
          reports={visible}
          initialRoom={abierto.room}
          onOpen={onOpen}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  );
}

// Estilos del panel encima de los del mapa de Marcos.
const ESTILOS_PANEL = `
.pm-pin-wrap { background: none; border: 0; }
.pm-pin { cursor: pointer; }
/* Burbuja con el número de reportes, arriba a la derecha del pin */
.pm-burbuja {
  position: absolute; left: calc(var(--pm-pin) - 8px); top: -9px; min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 999px; border: 2px solid white; color: white; font: 900 11px/16px var(--font-sans);
  text-align: center; box-shadow: 0 2px 5px rgb(0 0 0 / .3);
}
.pm-burbuja.is-loud { animation: pm-latido 1.3s ease-in-out infinite; }
/* Punto de reporte */
.pm-punto {
  position: relative; display: grid; place-items: center; width: var(--d); height: var(--d); border-radius: 50%;
  background: var(--c); border: 2.5px solid white; box-shadow: 0 2px 6px rgb(0 0 0 / .35); color: white;
  font: 900 11px/1 var(--font-sans); cursor: pointer;
}
.pm-punto::before {
  content: ""; position: absolute; inset: -3px; border-radius: 50%; background: var(--c); opacity: 0; z-index: -1;
}
.pm-punto.is-loud::before { animation: pm-onda-punto 1.6s ease-out infinite; }
/* Halo de calor (círculo de Leaflet) */
.pm-calor { color: var(--pm-carmesi); opacity: .22; }
.pm-calor.is-loud { animation: pm-calor 1.8s ease-in-out infinite; }
@keyframes pm-onda-punto { from { transform: scale(1); opacity: .55; } to { transform: scale(2.4); opacity: 0; } }
@keyframes pm-latido { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes pm-calor { 0%, 100% { opacity: .16; } 50% { opacity: .36; } }
@media (prefers-reduced-motion: reduce) {
  .pm-punto.is-loud::before, .pm-burbuja.is-loud, .pm-calor.is-loud { animation: none; }
}
`;
