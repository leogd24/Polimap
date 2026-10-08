// src/admin/MapSection.jsx — Responsable: Alexis
// Sección "Mapa de reportes": dónde se concentran los problemas del campus.
//
//   - Un círculo por edificio, más grande entre más reportes tenga (mapa de calor).
//   - Un pin por reporte, del color de su estado. Si el reporte trae GPS se usa;
//     si no, se pone junto a su edificio. Al tocarlo se abre el detalle.
//   - A la derecha: ranking de lugares con más reportes.
//
// Usa el mismo Leaflet + OpenStreetMap que el mapa de Marcos y sus
// coordenadas de edificios (CampusMap.jsx exporta CAMPUS y COORDENADAS_EDIFICIOS).
import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, alpha } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { CAMPUS, COORDENADAS_EDIFICIOS } from '../components/CampusMap.jsx';
import { SectionTitle, FilterBar } from './ui.jsx';
import { STATES, stateInfo, categoryInfo, applyFilters, locationText } from './reportMeta.js';

/** Coordenadas de un edificio: las de la API si ya las tiene, si no las de Marcos. */
function buildingPoint(number, buildings) {
  const b = buildings.find((x) => x.number === number);
  if (b?.lat != null && b?.lng != null) return [b.lat, b.lng];
  return COORDENADAS_EDIFICIOS[number] ?? null;
}

/** Pequeño desfase para que los pines del mismo edificio no queden encimados. */
function spread(point, index) {
  if (index === 0) return point;
  const angle = index * 2.4; // ángulo dorado: reparte parejo
  const radius = 0.000035 * Math.sqrt(index);
  return [point[0] + radius * Math.sin(angle), point[1] + radius * Math.cos(angle)];
}

function pinIcon(estado, urgent) {
  const s = stateInfo(estado);
  const size = urgent ? 22 : 18;
  return L.divIcon({
    className: 'pm-admin-pin',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:${s.key === 'resuelto' ? 'var(--color-green)' : s.fg};
      border:3px solid ${colors.white};box-shadow:0 2px 6px ${alpha('#000000', 0.35)}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function heatIcon(count, max) {
  const size = Math.round(44 + (count / max) * 76); // de 44 a 120 px
  const strength = 18 + Math.round((count / max) * 30); // % de opacidad del rojo
  return L.divIcon({
    className: 'pm-admin-pin',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:color-mix(in srgb, var(--color-crimson) ${strength}%, transparent);
      border:2px solid color-mix(in srgb, var(--color-crimson) 45%, transparent)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapSection({ reports, buildings, buildingNames, filters, onFiltersChange, onOpen }) {
  const visible = useMemo(() => applyFilters(reports, filters, buildingNames), [reports, filters, buildingNames]);

  // Pines y conteos por lugar.
  const { pins, heat, ranking, sinUbicacion } = useMemo(() => {
    const perBuilding = {};
    const perPlace = {};
    const result = [];
    let missing = 0;

    visible.forEach((r) => {
      const place = locationText(r, buildingNames);
      perPlace[place] = (perPlace[place] || 0) + 1;

      let point = r.lat != null && r.lng != null ? [r.lat, r.lng] : null;
      if (r.edificioNumber) {
        perBuilding[r.edificioNumber] = (perBuilding[r.edificioNumber] || 0) + 1;
        if (!point) {
          const base = buildingPoint(r.edificioNumber, buildings);
          if (base) point = spread(base, perBuilding[r.edificioNumber] - 1);
        }
      }
      if (point) result.push({ report: r, point });
      else missing += 1;
    });

    const max = Math.max(1, ...Object.values(perBuilding));
    const heatSpots = Object.entries(perBuilding)
      .map(([number, count]) => ({ number: Number(number), count, point: buildingPoint(Number(number), buildings), max }))
      .filter((h) => h.point);

    const ranked = Object.entries(perPlace)
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { pins: result, heat: heatSpots, ranking: ranked, sinUbicacion: missing };
  }, [visible, buildings, buildingNames]);

  const maxRank = Math.max(1, ...ranking.map((r) => r.count));

  return (
    <div>
      <SectionTitle
        title="Mapa de reportes"
        subtitle="Dónde se concentran los problemas del campus. Toca un punto para ver el reporte."
      />
      <FilterBar filters={filters} onChange={onFiltersChange} buildings={buildings} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Quita el cuadro blanco que Leaflet pone a los íconos HTML */}
        <style>{'.pm-admin-pin{background:transparent;border:0}'}</style>
        <Card className="relative">
          <div style={{ height: 'min(70vh, 620px)' }}>
            <MapContainer
              center={CAMPUS.centro}
              zoom={CAMPUS.zoomInicial}
              minZoom={17}
              maxZoom={CAMPUS.zoomMax}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxNativeZoom={19}
                maxZoom={CAMPUS.zoomMax}
              />
              {heat.map((h) => (
                <Marker key={`heat-${h.number}`} position={h.point} icon={heatIcon(h.count, h.max)} interactive={false} />
              ))}
              {pins.map(({ report, point }) => (
                <Marker
                  key={report.folio}
                  position={point}
                  icon={pinIcon(report.estado, report.prioridad === 'alta')}
                  eventHandlers={{ click: () => onOpen(report.folio) }}
                >
                  <Tooltip direction="top" offset={[0, -10]}>
                    <b>{report.folio}</b> · {categoryInfo(report.categoria).label}
                    <br />
                    {stateInfo(report.estado).label}
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Leyenda */}
          <div
            className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-3 px-3 py-2 text-xs font-bold"
            style={{ backgroundColor: alpha(colors.white, 0.94), borderRadius: 12, color: colors.textSecondary }}
          >
            {STATES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: s.key === 'resuelto' ? colors.green : s.fg }}
                />
                {s.label}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-black">
            <Icon name="leaderboard" size={20} color={colors.blue} />
            Lugares con más reportes
          </h2>
          {ranking.length === 0 && (
            <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
              Sin reportes con estos filtros.
            </p>
          )}
          <ol className="m-0 grid list-none gap-3 p-0">
            {ranking.map((r) => (
              <li key={r.place} title={`${r.place}: ${r.count} reportes`}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-bold">{r.place}</span>
                  <span className="font-black">{r.count}</span>
                </div>
                <div className="mt-1 h-2 w-full" style={{ backgroundColor: colors.blueTint, borderRadius: 4 }}>
                  <div
                    className="h-2"
                    style={{ width: `${(r.count / maxRank) * 100}%`, backgroundColor: colors.crimson, borderRadius: 4 }}
                  />
                </div>
              </li>
            ))}
          </ol>
          {sinUbicacion > 0 && (
            <p className="m-0 mt-4 text-xs" style={{ color: colors.textMuted }}>
              {sinUbicacion} reporte(s) en zonas sin coordenadas no aparecen en el mapa.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
