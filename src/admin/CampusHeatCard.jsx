// src/admin/CampusHeatCard.jsx — Responsable: Alexis
// Tarjeta "Mapa de calor del campus" del Tablero.
//
// Es el Poli DIBUJADO (SVG) a partir del mapa de OpenStreetMap: solo el
// terreno del Matute Remus, su camino interno, La Grana y los 10 edificios
// (la Prepa 10 y lo demás quedan fuera para no distraer). Carga al instante y no descarga mapas.
// (El mapa real con calles está en la sección "Mapa de reportes".)
//
// El dibujo está GIRADO: el norte queda a la derecha (flecha "N"), así el
// campus, que es largo de sur a norte, cabe a lo ancho de la tarjeta.
// La Grana (la entrada) queda a la izquierda y el edificio 10 a la derecha.
//
// Sobre el dibujo:
//   1. Cada edificio con reportes lleva un "halo": más grande y más rojo
//      mientras más reportes tenga (naranja si son pocos).
//   2. Cada reporte es un punto con el color de su estado.
//   3. El edificio con más reportes lleva su etiqueta abajo: "Edif. 3 · 9 reportes".
//   4. Las zonas abiertas (Explanada, Otra zona…) van como chips abajo.
//   5. Al tocar un edificio o una zona se filtra el tablero por ese lugar.
//
// ¿Un edificio quedó en el lugar equivocado? Cambia su rectángulo en
// EDIFICIOS (son coordenadas del mapa original, sin girar).
//
// Props: reports (ya filtrados por los últimos 30 días), onSelectPlace('3' | 'zona')
import { colors, alpha } from '../styles/theme.js';
import { STATES } from './reportMeta.js';

// ---------------------------------------------------------------------------
// 1) Geometría (en pixeles de la captura de OpenStreetMap, norte arriba)
// ---------------------------------------------------------------------------
// Ventana: SOLO el Poli (Matute Remus), del edificio 10 hasta La Grana.
// x de 112 a 208, y de 112 a 362 (la Prepa 10 queda fuera).
const X0 = 112;
const X1 = 208;
const Y0 = 112;
const Y1 = 362;
const S = 2.4; // escala
const W = (Y1 - Y0) * S; // ancho del dibujo ya girado
const H = (X1 - X0) * S; // alto del dibujo ya girado

/** Gira 90° a la derecha: el norte (y chica) queda a la derecha. */
const P = (x, y) => [+((Y1 - y) * S).toFixed(1), +((x - X0) * S).toFixed(1)];
const pts = (list) => list.map(([x, y]) => P(x, y).join(',')).join(' ');
const rect = ([x1, y1, x2, y2]) =>
  pts([
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]);
const center = ([x1, y1, x2, y2]) => P((x1 + x2) / 2, (y1 + y2) / 2);

/** Los 10 edificios del Poli, del 1 (junto a La Grana) al 10 (fondo, norte). */
const EDIFICIOS = {
  1: [127, 315, 158, 329],
  2: [131, 290, 162, 306],
  3: [133, 272, 167, 286],
  4: [136, 253, 170, 267],
  5: [140, 235, 173, 245],
  6: [134, 210, 167, 223],
  7: [137, 190, 170, 201],
  8: [140, 169, 170, 180],
  9: [142, 143, 168, 162],
  10: [145, 123, 172, 141],
};

/** Edificio pequeño junto al camino (sin número): solo de fondo. */
const OTROS = [[175, 210, 187, 226]];

const TERRENO = [
  [142, 73],
  [200, 89],
  [193, 120],
  [203, 227],
  [258, 250],
  [330, 280],
  [330, 380],
  [65, 380],
  [85, 270],
  [120, 262],
  [107, 220],
];
const CAMINO = [
  [188, 118],
  [178, 147],
  [180, 170],
  [192, 203],
  [200, 227],
  [177, 257],
  [170, 293],
  [158, 353],
];
const LA_GRANA = [
  [60, 345],
  [127, 350],
  [197, 360],
  [293, 377],
  [330, 382],
];
const RIO = [
  [330, 95],
  [300, 120],
  [293, 183],
  [267, 188],
  [250, 148],
  [217, 145],
  [192, 152],
  [190, 175],
  [217, 217],
  [260, 247],
  [330, 268],
];
const CANCHAS = [
  [146, 85, 162, 112],
  [287, 282, 307, 312],
];

const STATE_DOT = {
  recibido: colors.crimson,
  revision: colors.gold,
  proceso: colors.cyan,
  resuelto: colors.green,
};

// ---------------------------------------------------------------------------
// 2) Componente
// ---------------------------------------------------------------------------
export default function CampusHeatCard({ reports, onSelectPlace }) {
  // Reportes por edificio y por zona abierta.
  const byBuilding = {};
  const byZone = {};
  reports.forEach((r) => {
    if (r.edificioNumber && EDIFICIOS[r.edificioNumber]) {
      (byBuilding[r.edificioNumber] ||= []).push(r);
    } else {
      (byZone[r.zona || 'Otra zona'] ||= []).push(r);
    }
  });
  const max = Math.max(1, ...Object.values(byBuilding).map((l) => l.length));
  const hottest = Object.entries(byBuilding).sort((a, b) => b[1].length - a[1].length)[0];

  const textLabel = (x, y, text, size = 11, extra = {}) => {
    const [vx, vy] = P(x, y);
    return (
      <text x={vx} y={vy} textAnchor="middle" fontSize={size} fill={colors.textSecondary} {...extra}>
        {text}
      </text>
    );
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Mapa del Poli con la cantidad de reportes por edificio"
        style={{ backgroundColor: colors.background, borderRadius: 16 }}
      >
        <defs>
          <clipPath id="poli-ventana">
            <rect x="0" y="0" width={W} height={H} rx="16" />
          </clipPath>
        </defs>

        <g clipPath="url(#poli-ventana)">
          {/* Terreno del Poli */}
          <polygon points={pts(TERRENO)} fill={colors.goldTint} stroke={alpha(colors.gold, 0.35)} strokeWidth="1.5" />

          {/* Río */}
          <polyline
            points={pts(RIO)}
            fill="none"
            stroke={alpha(colors.cyan, 0.55)}
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Canchas */}
          {CANCHAS.map((c) => (
            <polygon key={c.join()} points={rect(c)} fill={colors.greenTint} stroke={alpha(colors.green, 0.6)} />
          ))}

          {/* Calles: borde gris + relleno blanco */}
          {[LA_GRANA, CAMINO].map((line, i) => (
            <g key={i}>
              <polyline
                points={pts(line)}
                fill="none"
                stroke={colors.border}
                strokeWidth={i === 0 ? 20 : 14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={pts(line)}
                fill="none"
                stroke={colors.white}
                strokeWidth={i === 0 ? 16 : 10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Edificios que no son del Poli (de fondo) */}
          {OTROS.map((b) => (
            <polygon key={b.join()} points={rect(b)} fill={colors.border} stroke={alpha(colors.textMuted, 0.4)} />
          ))}

          {/* Edificios del Poli: se pueden tocar para filtrar */}
          {Object.entries(EDIFICIOS).map(([n, b]) => {
            const count = byBuilding[n]?.length || 0;
            return (
              <g key={n} onClick={() => onSelectPlace?.(n)} style={{ cursor: onSelectPlace ? 'pointer' : 'default' }}>
                <title>{`Edificio ${n}: ${count} ${count === 1 ? 'reporte' : 'reportes'}`}</title>
                <polygon
                  points={rect(b)}
                  fill={count ? colors.surface : colors.blueTint}
                  stroke={count ? colors.blueSteel : alpha(colors.blueSteel, 0.45)}
                  strokeWidth={count ? 1.5 : 1}
                />
              </g>
            );
          })}

          {/* Textos del mapa */}
          {textLabel(150, 357, 'La Grana', 13, { fontWeight: 700, transform: rotateText(150, 357, -90) })}
          {textLabel(117, 232, 'Escuela Politécnica "Ing. Jorge Matute Remus"', 13, {
            fontStyle: 'italic',
            fontWeight: 700,
            fill: colors.blueSteel,
          })}

          {/* Halos de calor */}
          {Object.entries(byBuilding).map(([n, list]) => {
            const intensity = list.length / max;
            const [cx, cy] = center(EDIFICIOS[n]);
            const r = 16 + intensity * 30;
            const color = intensity >= 0.6 ? colors.crimson : colors.gold;
            return (
              <g key={`h${n}`} pointerEvents="none">
                <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.16 + intensity * 0.12} />
                <circle cx={cx} cy={cy} r={r * 0.55} fill={color} opacity={0.2 + intensity * 0.15} />
              </g>
            );
          })}

          {/* Un punto por reporte, alrededor del centro del edificio */}
          {Object.entries(byBuilding).map(([n, list]) => {
            const [bx, by] = center(EDIFICIOS[n]);
            return list.slice(0, 12).map((r, i) => {
              const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
              const spread = list.length === 1 ? 0 : Math.min(15, 7 + list.length * 1.5);
              return (
                <circle
                  key={r.folio}
                  cx={bx + Math.cos(angle) * spread}
                  cy={by + Math.sin(angle) * spread}
                  r="6"
                  fill={STATE_DOT[r.estado] || colors.crimson}
                  stroke={colors.white}
                  strokeWidth="2"
                  pointerEvents="none"
                />
              );
            });
          })}

          {/* Número de cada edificio */}
          {Object.entries(EDIFICIOS).map(([n, b]) => {
            const [cx, cy] = center(b);
            const y = cy + 26; // debajo del edificio
            return (
              <g key={`n${n}`} pointerEvents="none">
                <circle cx={cx} cy={y} r="10" fill={colors.blue} />
                <text x={cx} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={colors.white}>
                  {n}
                </text>
              </g>
            );
          })}

          {/* Etiqueta del edificio con más reportes */}
          {hottest && (
            <g pointerEvents="none">
              {(() => {
                const [cx, cy] = center(EDIFICIOS[hottest[0]]);
                const label = `Edif. ${hottest[0]} · ${hottest[1].length} ${hottest[1].length === 1 ? 'reporte' : 'reportes'}`;
                const w = label.length * 7 + 16;
                const x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, cx));
                return (
                  <>
                    <rect x={x - w / 2} y={cy + 42} width={w} height="22" rx="11" fill={colors.blue} />
                    <text x={x} y={cy + 57} textAnchor="middle" fontSize="12" fontWeight="800" fill={colors.white}>
                      {label}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Norte */}
          <g transform={`translate(${W - 34} ${H - 30})`} pointerEvents="none">
            <circle r="16" fill={colors.surface} stroke={colors.border} />
            <path d="M -8 0 L 6 0 M 1 -5 L 7 0 L 1 5" stroke={colors.textPrimary} strokeWidth="2" fill="none" />
            <text x="0" y="-20" textAnchor="middle" fontSize="11" fontWeight="800" fill={colors.textPrimary}>
              N
            </text>
          </g>

          {/* Crédito (el dibujo se basa en OpenStreetMap) */}
          <text x="10" y={H - 8} fontSize="9" fill={colors.textMuted}>
            Basado en © OpenStreetMap
          </text>

          {reports.length === 0 && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fontWeight="700" fill={colors.textSecondary}>
              Sin reportes en los últimos 30 días
            </text>
          )}
        </g>
      </svg>

      {/* Zonas abiertas (sin edificio) */}
      {Object.keys(byZone).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(byZone).map(([zona, list]) => (
            <button
              key={zona}
              type="button"
              onClick={() => onSelectPlace?.('zona')}
              className="inline-flex items-center gap-2 border-0 px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: colors.goldTint, color: colors.goldDark, borderRadius: 999, cursor: 'pointer' }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors.gold }} />
              {zona} · {list.length}
            </button>
          ))}
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: colors.textSecondary }}>
        {STATES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="inline-block h-[9px] w-[9px] rounded-full" style={{ backgroundColor: STATE_DOT[s.key] }} />
            {s.key === 'revision' ? 'Revisión' : s.key === 'proceso' ? 'Proceso' : s.label}
          </span>
        ))}
        <span className="ml-auto">Toca un edificio para filtrar</span>
      </div>
    </div>
  );
}

/** Gira un texto para que siga la inclinación de la calle. */
function rotateText(x, y, degrees) {
  const [vx, vy] = P(x, y);
  return `rotate(${degrees} ${vx} ${vy})`;
}
