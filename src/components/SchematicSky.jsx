// src/components/SchematicSky.jsx — Responsable: Alexis
// =====================================================================
// Cielo y clima del ESQUEMA DEL EDIFICIO (plus visual).
//
//   useAmbiente()    → calcula el ambiente con la hora del Poli (Zapopan) y el
//                      clima real (src/lib/ambiente.js). Se actualiza cada minuto.
//   <CieloDefs>      → degradados del cielo (van dentro de <defs>)
//   <Cielo>          → cielo, estrellas, sol o luna y nubes (DETRÁS del edificio)
//                      horizonte = altura del techo (el sol sale por encima)
//   <CapaClima>      → lluvia, niebla y relámpagos (DELANTE del edificio)
//   <AmbienteBoton>  → botón del encabezado: "17:42 · 22° Nublado" y, al
//                      tocarlo, opciones para ver otra hora o clima (para la expo)
//
// Los colores se MEZCLAN con color-mix() según la luz del día: así el
// cielo pasa poco a poco de noche → amanecer → día → atardecer → noche.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { getWeather } from '../lib/api.js';
import { calcularAmbiente, climaDeCodigo, CLIMAS, MOMENTOS } from '../lib/ambiente.js';

/** Mezcla dos colores: t = 1 → todo `a`, t = 0 → todo `b`. */
export function mezcla(a, b, t) {
  const p = Math.round(Math.max(0, Math.min(1, t)) * 100);
  return `color-mix(in srgb, ${a} ${p}%, ${b})`;
}

// ---------------------------------------------------------------------
// Hook: ambiente actual (hora + clima), con opción de forzarlo
// ---------------------------------------------------------------------
export function useAmbiente() {
  const [ahora, setAhora] = useState(() => new Date());
  const [datos, setDatos] = useState(null); // { codigo, temperatura, nubes }
  const [momento, setMomento] = useState('auto');
  const [climaForzado, setClimaForzado] = useState('auto');

  // Cada minuto se recalcula (el sol se mueve y las luces se prenden solas).
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Clima real (una vez; api.js lo guarda 15 minutos).
  useEffect(() => {
    let vivo = true;
    getWeather().then((d) => vivo && setDatos(d));
    return () => {
      vivo = false;
    };
  }, []);

  const climaReal = datos ? climaDeCodigo(datos.codigo) : null;
  const clima = climaForzado === 'auto' ? climaReal : climaForzado;
  const amb = useMemo(() => calcularAmbiente({ fecha: ahora, clima, momento }), [ahora, clima, momento]);

  return {
    amb,
    temperatura: climaForzado === 'auto' ? datos?.temperatura ?? null : null,
    climaReal,
    momento,
    setMomento,
    climaForzado,
    setClimaForzado,
    forzado: momento !== 'auto' || climaForzado !== 'auto',
  };
}

// ---------------------------------------------------------------------
// Degradados
// ---------------------------------------------------------------------
export function CieloDefs({ amb }) {
  const { luz, calido, gris } = amb;
  // Arriba: noche → azul de día, con un toque morado en amanecer/atardecer.
  let arriba = mezcla(colors.skyDay, colors.blueDeep, luz);
  arriba = mezcla(mezcla(colors.blueSteel, colors.magenta, 0.75), arriba, calido * 0.55);
  // Abajo (horizonte): noche → azul claro, y naranja cuando sale o se mete el sol.
  let abajo = mezcla(colors.skyDayLow, colors.blueSteel, luz);
  abajo = mezcla(colors.skyDusk, abajo, calido * 0.9);
  // Nublado: todo más gris.
  arriba = mezcla(colors.concreteShadow, arriba, gris * 0.55);
  abajo = mezcla(colors.concreteDark, abajo, gris * 0.5);
  const sol = mezcla(colors.skyDusk, colors.windowLit, calido);

  return (
    <>
      <linearGradient id="bs-cielo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: arriba }} />
        <stop offset="1" style={{ stopColor: abajo }} />
      </linearGradient>
      <radialGradient id="bs-sol">
        <stop offset="0" style={{ stopColor: sol, stopOpacity: 0.85 }} />
        <stop offset="1" style={{ stopColor: sol, stopOpacity: 0 }} />
      </radialGradient>
      <linearGradient id="bs-niebla" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: colors.white, stopOpacity: 0.15 }} />
        <stop offset="1" style={{ stopColor: colors.white, stopOpacity: 0.85 }} />
      </linearGradient>
    </>
  );
}

// ---------------------------------------------------------------------
// Cielo (detrás del edificio)
// ---------------------------------------------------------------------
const ESTRELLAS = [
  [60, 22], [150, 50], [240, 18], [330, 44], [420, 26], [510, 52], [600, 16], [690, 40],
  [780, 24], [860, 58], [980, 20], [20, 60], [560, 34], [120, 92], [905, 96], [40, 140],
];

// Nubes fijas (x, y, tamaño); se muestran más entre más nublado esté.
const NUBES = [
  [140, 40, 1], [470, 28, 1.3], [790, 52, 1.1], [300, 70, 0.8], [640, 64, 0.9], [930, 30, 0.8],
  [40, 110, 0.9], [560, 96, 1.2], [230, 22, 0.7],
];

export function Cielo({ amb, W, sueloY, horizonte }) {
  // El techo del edificio hace de "horizonte": el sol sale asomándose por
  // encima del techo a la izquierda, sube al centro y se mete a la derecha.
  const posicion = (astro) => [40 + astro.x * (W - 80), horizonte - astro.alto * (horizonte - 22)];
  const solXY = amb.sol && posicion(amb.sol);
  const lunaXY = amb.luna && posicion(amb.luna);
  const colorSol = mezcla(colors.skyDusk, colors.windowLit, amb.calido);
  const cuantasNubes = Math.round(amb.nubes * NUBES.length);
  // Nubes: blancas de día, grises con lluvia, azuladas de noche y rosadas al atardecer.
  let colorNube = mezcla(colors.white, colors.concreteDark, 1 - amb.gris * 0.7);
  colorNube = mezcla(colorNube, colors.blueSteel, 0.35 + amb.luz * 0.65);
  colorNube = mezcla(colors.skyDusk, colorNube, amb.calido * 0.45);

  return (
    <g pointerEvents="none">
      <rect x="0" y="0" width={W} height={sueloY} fill="url(#bs-cielo)" />

      {/* Estrellas */}
      {amb.estrellas > 0.02 &&
        ESTRELLAS.map(([x, y], i) => (
          <circle
            key={i}
            className={i % 4 === 0 ? 'bs-titila' : undefined}
            cx={x}
            cy={y}
            r={i % 3 === 0 ? 1.8 : 1.2}
            style={{ fill: colors.white, opacity: amb.estrellas * 0.85 }}
          />
        ))}

      {/* Sol con su brillo */}
      {solXY && (
        <g>
          <circle cx={solXY[0]} cy={solXY[1]} r="70" fill="url(#bs-sol)" />
          <circle cx={solXY[0]} cy={solXY[1]} r="20" style={{ fill: colorSol }} />
        </g>
      )}

      {/* Luna (cuarto creciente dibujado con dos círculos) */}
      {lunaXY && (
        <g>
          <circle cx={lunaXY[0]} cy={lunaXY[1]} r="34" style={{ fill: alpha(colors.white, 0.08) }} />
          <circle cx={lunaXY[0]} cy={lunaXY[1]} r="15" style={{ fill: colors.concreteLight }} />
          <circle cx={lunaXY[0] - 3} cy={lunaXY[1] - 3} r="3" style={{ fill: alpha(colors.concreteDark, 0.35) }} />
          <circle cx={lunaXY[0] + 5} cy={lunaXY[1] + 4} r="2" style={{ fill: alpha(colors.concreteDark, 0.3) }} />
        </g>
      )}

      {/* Nubes */}
      {NUBES.slice(0, cuantasNubes).map(([x, y, t], i) => (
        <g key={i} className={i % 2 ? 'bs-nube bs-nube--lenta' : 'bs-nube'}>
          <Nube x={x} y={y} t={t} color={colorNube} opacidad={0.75 + amb.gris * 0.25} />
        </g>
      ))}
    </g>
  );
}

function Nube({ x, y, t, color, opacidad }) {
  return (
    <g style={{ opacity: opacidad }}>
      <ellipse cx={x} cy={y + 8 * t} rx={46 * t} ry={14 * t} style={{ fill: color }} />
      <circle cx={x - 18 * t} cy={y} r={16 * t} style={{ fill: color }} />
      <circle cx={x + 6 * t} cy={y - 6 * t} r={20 * t} style={{ fill: color }} />
      <circle cx={x + 26 * t} cy={y + 2 * t} r={13 * t} style={{ fill: color }} />
    </g>
  );
}

// ---------------------------------------------------------------------
// Clima delante del edificio: lluvia, charcos, niebla y relámpagos
// ---------------------------------------------------------------------
// Gotas fijas (se repiten dos veces hacia arriba para que caigan sin cortes).
const GOTAS = Array.from({ length: 110 }, (_, i) => [(i * 97.3) % 1000, (i * 53.7) % 1, i % 3]);

export function CapaClima({ amb, W, H, sueloY }) {
  const gotas = Math.round(amb.lluvia * GOTAS.length);
  return (
    <g pointerEvents="none">
      {/* Charcos en la explanada */}
      {amb.lluvia > 0 &&
        [0.18, 0.47, 0.76].map((t) => (
          <ellipse
            key={t}
            cx={t * W}
            cy={sueloY + 40}
            rx={60 * amb.lluvia}
            ry="6"
            style={{ fill: alpha(colors.skyDayLow, 0.45) }}
          />
        ))}

      {/* Lluvia */}
      {gotas > 0 && (
        <g className="bs-lluvia" style={{ '--h': `${H}px` }}>
          {[0, -H].map((dy) =>
            GOTAS.slice(0, gotas).map(([x, f, k]) => {
              const y = dy + f * H;
              return (
                <line
                  key={`${dy}-${x}`}
                  x1={x}
                  y1={y}
                  x2={x - 5}
                  y2={y + 16 + k * 4}
                  style={{ stroke: alpha(colors.skyDayLow, 0.55), strokeWidth: 1.6, strokeLinecap: 'round' }}
                />
              );
            })
          )}
        </g>
      )}

      {/* Niebla */}
      {amb.niebla > 0 && <rect x="0" y="0" width={W} height={H} fill="url(#bs-niebla)" style={{ opacity: amb.niebla }} />}

      {/* Tormenta: rayo y destello cada ~7 s */}
      {amb.tormenta && (
        <>
          <path
            className="bs-rayo"
            d="M760 0 L735 48 L752 50 L722 112 L770 40 L752 38 L775 0 Z"
            style={{ fill: colors.windowLit }}
          />
          <rect className="bs-destello" x="0" y="0" width={W} height={H} style={{ fill: colors.white }} />
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------
// Botón del encabezado + opciones
// ---------------------------------------------------------------------
export function AmbienteBoton({ ambiente }) {
  const [abierto, setAbierto] = useState(false);
  const { amb, temperatura, climaReal, momento, setMomento, climaForzado, setClimaForzado, forzado } = ambiente;
  // Sin internet no sabemos el clima: solo se muestra la hora.
  const sinClima = climaForzado === 'auto' && !climaReal;
  const texto = [amb.hora, temperatura != null ? `${temperatura}°` : null, sinClima ? null : CLIMAS[amb.clima].label]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="tappable flex h-10 items-center gap-2 border-0 px-3 text-sm font-bold"
        style={{
          backgroundColor: forzado ? colors.goldTint : colors.surface,
          borderRadius: 999,
          color: forzado ? colors.goldDark : colors.textSecondary,
        }}
        aria-expanded={abierto}
        title="Hora y clima del Poli (cambia solos)"
      >
        <Icon name={amb.icono} size={18} color={forzado ? colors.goldDark : colors.textSecondary} />
        {texto}
        {forzado && <span className="text-[10px] font-black">VISTA PREVIA</span>}
      </button>

      {abierto && (
        <div
          className="absolute right-0 top-12 z-10 w-[300px] p-4"
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            border: `1px solid ${colors.border}`,
            boxShadow: `0 12px 30px ${alpha('#000000', 0.18)}`,
          }}
        >
          <div className="text-xs font-black uppercase" style={{ color: colors.textMuted }}>
            Hora del día
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOMENTOS.map((m) => (
              <Opcion key={m.key} activa={momento === m.key} icon={m.icon} onClick={() => setMomento(m.key)}>
                {m.label}
              </Opcion>
            ))}
          </div>
          <div className="mt-4 text-xs font-black uppercase" style={{ color: colors.textMuted }}>
            Clima
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Opcion activa={climaForzado === 'auto'} icon="satellite_alt" onClick={() => setClimaForzado('auto')}>
              Real
            </Opcion>
            {['despejado', 'nubes', 'nublado', 'lluvia', 'tormenta', 'niebla'].map((k) => (
              <Opcion key={k} activa={climaForzado === k} icon={CLIMAS[k].icon} onClick={() => setClimaForzado(k)}>
                {CLIMAS[k].label}
              </Opcion>
            ))}
          </div>
          <p className="m-0 mt-4 text-xs" style={{ color: colors.textMuted, lineHeight: 1.4 }}>
            Hoy en el Poli (Zapopan): amanece {amb.amanecer} y oscurece {amb.atardecer}. Con “Ahora” y “Real” el dibujo
            cambia solo con la hora y el clima de Zapopan (Open-Meteo).
          </p>
        </div>
      )}
    </div>
  );
}

function Opcion({ activa, icon, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable flex h-8 items-center gap-1 border-0 px-3 text-xs font-bold"
      style={{
        borderRadius: 999,
        backgroundColor: activa ? colors.blue : colors.background,
        color: activa ? colors.white : colors.textSecondary,
      }}
    >
      <Icon name={icon} size={16} color={activa ? colors.white : colors.textSecondary} />
      {children}
    </button>
  );
}

// Animaciones (nubes, estrellas, lluvia y tormenta)
export const ESTILOS_CIELO = `
.bs-nube { animation: bs-nube 70s ease-in-out infinite alternate; }
.bs-nube--lenta { animation-duration: 110s; animation-direction: alternate-reverse; }
@keyframes bs-nube { from { transform: translateX(-30px); } to { transform: translateX(30px); } }
.bs-titila { animation: bs-titila 3s ease-in-out infinite; }
@keyframes bs-titila { 0%, 100% { opacity: .2; } 50% { opacity: 1; } }
.bs-lluvia { animation: bs-cae .8s linear infinite; }
@keyframes bs-cae { from { transform: translateY(0); } to { transform: translateY(var(--h)); } }
.bs-rayo, .bs-destello { opacity: 0; animation: bs-rayo 7s linear infinite; }
.bs-destello { animation-name: bs-destello; }
@keyframes bs-rayo { 0%, 90%, 93%, 100% { opacity: 0; } 91%, 92.5% { opacity: 1; } }
@keyframes bs-destello { 0%, 90%, 94%, 100% { opacity: 0; } 91% { opacity: .5; } 92% { opacity: .1; } 93% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .bs-nube, .bs-titila, .bs-lluvia, .bs-rayo, .bs-destello { animation: none; }
}
`;
