// src/components/FachadaEdificio.jsx — Responsable: Alexis
// =====================================================================
// DIBUJO de la fachada de un edificio del Poli (SVG hecho a mano), como en
// las fotos: concreto, pasillos con barandal, cortinas crema en planta baja,
// el número pintado en el muro, poste solar y árbol. Cada salón va en su
// piso de izquierda a derecha y las escaleras al centro
// (src/data/buildingLayouts.js). El cielo cambia con la hora y el clima de
// Zapopan (SchematicSky.jsx).
//
// Lo usan:
//   - el panel (src/admin/BuildingSchematic.jsx): con los puntos de reportes;
//   - la app (src/components/EdificioPorDentro.jsx): con TU salón resaltado.
//
// Props:
//   number, esquema (esquemaEdificio(n)), amb (useAmbiente().amb)
//   sel, onElegir(id)           salón seleccionado y al tocar uno
//   rellenoSalon(caja) → color   relleno encima del salón (calor, "tu salón"…)
//   bordeSalon(caja)   → color   borde (además del de seleccionado)
//   etiquetaSalon(caja) → texto  extra para el lector de pantalla
//   encima({ cajas, sueloY, H }) → nodos SVG que van hasta arriba (puntos, letreros)
// =====================================================================
import { useMemo } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { nombrePiso, fraccionesPiso } from '../data/buildingLayouts.js';
import { CieloDefs, Cielo, CapaClima, ESTILOS_CIELO, mezcla } from './SchematicSky.jsx';

// ---------------------------------------------------------------------
// Medidas del dibujo (unidades del viewBox, no píxeles)
// ---------------------------------------------------------------------
export const W = 1000; // ancho total
export const X0 = 96; // donde empieza el edificio (a la izquierda queda el poste)
export const X1 = 968; // donde termina
const MURO = 84; // muro del extremo, con el número pintado
const RX0 = X0 + MURO; // aquí empiezan los salones
const RX1 = X1 - 12;
const TOP = 90; // cielo arriba del techo (ahí pasa el sol)
const LOSA_TECHO = 20;
export const FH = 150; // alto de cada piso
const LOSA = 12; // grosor de cada losa
const SUELO = 118; // explanada y pasto

/** Posición de cada salón en el dibujo: [{ ...espacio, x, y, w }] */
export function cajasDe(esquema) {
  const lista = [];
  for (let i = 0; i < esquema.pisos; i += 1) {
    const piso = esquema.pisos - i;
    const y = TOP + LOSA_TECHO + i * FH;
    // Las escaleras quedan al centro en todos los pisos (fraccionesPiso).
    fraccionesPiso(esquema.plantas[piso]).forEach((e) => {
      lista.push({ ...e, x: RX0 + e.fx0 * (RX1 - RX0), y, w: (e.fx1 - e.fx0) * (RX1 - RX0) });
    });
  }
  return lista;
}

/** Alto total y dónde empieza el suelo. */
export function medidas(esquema) {
  const sueloY = TOP + LOSA_TECHO + esquema.pisos * FH;
  return { H: sueloY + SUELO, sueloY };
}

export default function FachadaEdificio({ number, esquema, amb, sel = null, onElegir, rellenoSalon, bordeSalon, etiquetaSalon, encima, ariaLabel }) {
  const cajas = useMemo(() => cajasDe(esquema), [esquema]);
  const { H, sueloY } = medidas(esquema);

  return (
    <>
      <style>{ESTILOS}</style>
      <style>{ESTILOS_CIELO}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={ariaLabel ?? `Fachada del edificio ${number} con ${esquema.pisos} pisos`}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <Defs amb={amb} />

        {/* Cielo con sol o luna y nubes, según la hora y el clima */}
        <Cielo amb={amb} W={W} sueloY={sueloY} horizonte={TOP + 6} />

        {/* Explanada y pasto */}
        <rect x="0" y={sueloY} width={W} height={SUELO} style={{ fill: colors.concreteLight }} />
        <rect x="0" y={sueloY + 64} width={W} height={SUELO - 64} style={{ fill: mezcla(colors.grass, mezcla(colors.grassDark, colors.blueDeep, 0.55), amb.luz) }} />
        {[0.18, 0.42, 0.66, 0.9].map((t) => (
          <line key={t} x1={X0 + (X1 - X0) * t} y1={sueloY} x2={X0 + (X1 - X0) * t - 40} y2={sueloY + 64} style={{ stroke: colors.concrete, strokeWidth: 2 }} />
        ))}
        <rect x={X0 - 10} y={sueloY} width={X1 - X0 + 20} height="10" style={{ fill: alpha('#000000', 0.18) }} />
        {/* La explanada también se oscurece de noche */}
        <rect x="0" y={sueloY} width={W} height={SUELO} style={{ fill: colors.blueDeep, opacity: 0.4 * (1 - amb.luz) }} />

        {/* Poste solar y árbol, a la izquierda */}
        <Poste x={52} sueloY={sueloY} luces={amb.luces} />
        <Arbol x={X1 - 30} sueloY={sueloY + 70} />

        {/* Techo con volado */}
        <rect x={X0 - 16} y={TOP} width={X1 - X0 + 32} height={LOSA_TECHO} rx="2" style={{ fill: colors.concreteLight }} />
        <rect x={X0 - 16} y={TOP + LOSA_TECHO - 5} width={X1 - X0 + 32} height="5" style={{ fill: colors.concreteDark }} />

        {/* Muro del extremo con el número pintado */}
        <rect x={X0} y={TOP + LOSA_TECHO} width={MURO} height={esquema.pisos * FH} style={{ fill: colors.concrete }} />
        <rect x={X0 + MURO - 8} y={TOP + LOSA_TECHO} width="8" height={esquema.pisos * FH} style={{ fill: colors.concreteDark }} />
        <text x={X0 + MURO / 2 - 3} y={TOP + LOSA_TECHO + 78} textAnchor="middle" style={{ fill: alpha(colors.blueDeep, 0.78), fontSize: 64, fontWeight: 900 }}>
          {number}
        </text>

        {/* Pisos: salones, losas y barandales */}
        {Array.from({ length: esquema.pisos }, (_, i) => {
          const piso = esquema.pisos - i;
          const y = TOP + LOSA_TECHO + i * FH;
          return (
            <g key={piso}>
              {/* Muro de fondo de todo el piso (por si un lado no tiene salones) */}
              <rect x={RX0} y={y} width={RX1 - RX0} height={FH - LOSA} style={{ fill: colors.concrete }} />
              {cajas
                .filter((c) => c.piso === piso)
                .map((c) => (
                  <Salon key={c.id} c={c} planta={piso === 1} />
                ))}
              {/* Sombra bajo la losa de arriba */}
              <rect x={RX0} y={y} width={RX1 - RX0} height="10" style={{ fill: alpha(colors.concreteShadow, 0.55) }} />
              {/* Losa del piso */}
              {piso > 1 && <rect x={X0 - 10} y={y + FH - LOSA} width={X1 - X0 + 20} height={LOSA} style={{ fill: colors.concreteLight }} />}
              {piso > 1 && <Barandal y={y + FH - LOSA} />}
              {/* Nombre del piso en el muro del extremo */}
              <text x={X0 + MURO / 2 - 4} y={y + FH - LOSA - 10} textAnchor="middle" style={{ fill: alpha(colors.blueDeep, 0.6), fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
                {piso === 1 ? 'P. BAJA' : nombrePiso(piso).toUpperCase()}
              </text>
            </g>
          );
        })}
        <rect x={X1 - 12} y={TOP + LOSA_TECHO} width="12" height={esquema.pisos * FH} style={{ fill: colors.concreteDark }} />

        {/* Luz del momento sobre el edificio: oscuro de noche, naranja al atardecer */}
        <rect x={X0 - 16} y={TOP} width={X1 - X0 + 32} height={esquema.pisos * FH + LOSA_TECHO} style={{ fill: colors.blueDeep, opacity: 0.45 * (1 - amb.luz) + amb.gris * 0.12 }} />
        {amb.calido > 0.05 && (
          <rect x={X0 - 16} y={TOP} width={X1 - X0 + 32} height={esquema.pisos * FH + LOSA_TECHO} style={{ fill: colors.skyDusk, opacity: amb.calido * 0.2 }} />
        )}
        {cajas.map((c, i) => (
          <Ventanas key={`v-${c.id}`} c={c} planta={c.piso === 1} luces={amb.ocupado || i % 3 === 0 ? amb.luces : 0} />
        ))}

        {/* Salones: zona para tocar, relleno (calor / tu salón) y selección */}
        {cajas
          .filter((c) => c.tipo !== 'escaleras')
          .map((c) => {
            const activo = sel === c.id;
            const relleno = rellenoSalon?.(c);
            const borde = activo ? colors.gold : bordeSalon?.(c) ?? 'transparent';
            const extra = etiquetaSalon?.(c);
            const elegir = () => onElegir?.(c.id);
            return (
              <g
                key={`z-${c.id}`}
                className="bs-room"
                role="button"
                tabIndex={0}
                aria-pressed={activo}
                aria-label={`${c.nombre}, ${nombrePiso(c.piso)}${extra ? `, ${extra}` : ''}`}
                onClick={elegir}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), elegir())}
              >
                <title>{`${c.nombre} · ${nombrePiso(c.piso)}${extra ? ` · ${extra}` : ''}`}</title>
                <rect
                  x={c.x + 4}
                  y={c.y + 10}
                  width={Math.max(0, c.w - 8)}
                  height={FH - LOSA - 10}
                  rx="6"
                  style={{ fill: relleno ?? alpha('#ffffff', 0), stroke: borde, strokeWidth: 4 }}
                />
                <rect className="bs-hover" x={c.x + 4} y={c.y + 10} width={Math.max(0, c.w - 8)} height={FH - LOSA - 10} rx="6" style={{ fill: 'none', stroke: colors.cyan, strokeWidth: 3 }} />
                <Placa c={c} />
              </g>
            );
          })}

        {/* Lluvia, niebla o tormenta (delante del edificio) */}
        <CapaClima amb={amb} W={W} H={H} sueloY={sueloY} />

        {/* Lo que cada quien pone encima (puntos de reportes, "tu clase"…) */}
        {encima?.({ cajas, sueloY, H })}
      </svg>
    </>
  );
}

// ---------------------------------------------------------------------
// Piezas del dibujo
// ---------------------------------------------------------------------

/** Degradados del cielo y del brillo de las lámparas. */
function Defs({ amb }) {
  return (
    <defs>
      <CieloDefs amb={amb} />
      <radialGradient id="bs-luz">
        <stop offset="0" style={{ stopColor: colors.windowLit, stopOpacity: 0.9 }} />
        <stop offset="1" style={{ stopColor: colors.windowLit, stopOpacity: 0 }} />
      </radialGradient>
      <linearGradient id="bs-vidrio" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: colors.blueSteel }} />
        <stop offset="0.45" style={{ stopColor: colors.window }} />
        <stop offset="1" style={{ stopColor: colors.blueDeep }} />
      </linearGradient>
    </defs>
  );
}

/** Un salón: muro, puerta (o cortina en planta baja) y escaleras. */
function Salon({ c, planta }) {
  const piso = c.y + FH - LOSA; // donde está el suelo de este salón
  const partes = [
    <rect key="m" x={c.x} y={c.y} width={c.w} height={FH - LOSA} style={{ fill: colors.concrete }} />,
    // Columna a la izquierda del salón
    <rect key="col" x={c.x - 4} y={c.y} width="8" height={FH - LOSA} style={{ fill: colors.concreteDark }} />,
  ];

  if (c.tipo === 'escaleras') {
    // Escalera en zigzag
    const pasos = 7;
    const d = Array.from({ length: pasos }, (_, k) => {
      const px = c.x + 10 + ((c.w - 20) / pasos) * k;
      const py = piso - ((FH - LOSA - 24) / pasos) * k;
      return `L${px} ${py} L${px + (c.w - 20) / pasos} ${py}`;
    }).join(' ');
    partes.push(
      <path key="esc" d={`M${c.x + 10} ${piso} ${d}`} style={{ fill: 'none', stroke: colors.concreteShadow, strokeWidth: 3 }} />
    );
    return <g>{partes}</g>;
  }

  if (planta && c.tipo !== 'banos') {
    // Cortina metálica color crema, como en la foto del edificio 4
    const ancho = Math.min(c.w - 24, c.tipo === 'aula' ? 64 : 96);
    const x = c.x + 12;
    const y = piso - 82;
    partes.push(
      <rect key="cort" x={x} y={y} width={ancho} height="82" style={{ fill: colors.door }} />,
      ...Array.from({ length: 9 }, (_, k) => (
        <line key={`l${k}`} x1={x} x2={x + ancho} y1={y + 8 + k * 8.5} y2={y + 8 + k * 8.5} style={{ stroke: alpha(colors.concreteShadow, 0.35), strokeWidth: 1 }} />
      ))
    );
  } else {
    // Puerta del salón
    const x = c.x + 12;
    partes.push(
      <rect key="p" x={x} y={piso - 74} width="30" height="74" rx="2" style={{ fill: c.tipo === 'banos' ? colors.blueSteel : colors.window }} />,
      <circle key="pp" cx={x + 24} cy={piso - 36} r="2" style={{ fill: colors.concreteLight }} />
    );
    if (c.tipo === 'banos') {
      partes.push(
        <rect key="wc" x={x + 36} y={piso - 70} width="30" height="20" rx="4" style={{ fill: colors.cyan }} />,
        <text key="wct" x={x + 51} y={piso - 55} textAnchor="middle" style={{ fill: colors.white, fontSize: 11, fontWeight: 900 }}>
          WC
        </text>
      );
    }
  }
  return <g>{partes}</g>;
}

/** Ventanas con persiana. `luces` (0–1): qué tan prendidos están los focos. */
function Ventanas({ c, planta, luces }) {
  if (c.tipo === 'escaleras' || c.tipo === 'banos') return null;
  const inicio = c.x + (planta ? Math.min(c.w - 24, c.tipo === 'aula' ? 64 : 96) + 22 : 50);
  const fin = c.x + c.w - 10;
  const alto = 40;
  const y = c.y + 24;
  const cuantas = Math.max(0, Math.floor((fin - inicio) / 34));
  if (cuantas === 0) return null;
  const ancho = (fin - inicio) / cuantas;
  return (
    <g>
      {luces > 0 && (
        <ellipse cx={c.x + c.w / 2} cy={c.y + 16} rx={c.w / 2.4} ry="26" style={{ fill: 'url(#bs-luz)', opacity: luces }} />
      )}
      {Array.from({ length: cuantas }, (_, k) => {
        const x = inicio + k * ancho + 2;
        return (
          <g key={k}>
            <rect x={x} y={y} width={ancho - 4} height={alto} rx="2" style={{ fill: 'url(#bs-vidrio)' }} />
            {luces > 0 && (
              <rect x={x} y={y} width={ancho - 4} height={alto} rx="2" style={{ fill: colors.windowLit, opacity: luces }} />
            )}
            {[1, 2, 3, 4].map((t) => (
              <line
                key={t}
                x1={x}
                x2={x + ancho - 4}
                y1={y + t * 8}
                y2={y + t * 8}
                style={{ stroke: mezcla(alpha(colors.goldDeep, 0.35), alpha('#ffffff', 0.18), luces), strokeWidth: 1.5 }}
              />
            ))}
          </g>
        );
      })}
      {luces > 0 && (
        <rect x={c.x + c.w / 2 - 8} y={c.y + 10} width="16" height="4" rx="2" style={{ fill: colors.windowLit, opacity: luces }} />
      )}
    </g>
  );
}

/** Letrero con el nombre del salón ("A05", "Lab. fermentación"…). */
function Placa({ c }) {
  if (c.tipo === 'escaleras') return null;
  const max = Math.max(3, Math.floor((c.w - 22) / 7));
  const texto = c.corto.length > max ? `${c.corto.slice(0, max - 1)}…` : c.corto;
  const ancho = Math.min(c.w - 14, texto.length * 7.4 + 16);
  const x = c.x + c.w - ancho - 8;
  const y = c.y + FH - LOSA - 30;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={ancho} height="20" rx="10" style={{ fill: alpha('#ffffff', 0.94) }} />
      <text x={x + ancho / 2} y={y + 14} textAnchor="middle" style={{ fill: colors.blue, fontSize: 12, fontWeight: 800 }}>
        {texto}
      </text>
    </g>
  );
}

/** Barandal metálico del pasillo (pisos de arriba). */
function Barandal({ y }) {
  const alto = 46;
  const postes = [];
  for (let x = RX0; x <= RX1; x += 38) postes.push(x);
  return (
    <g pointerEvents="none">
      <rect x={RX0 - 4} y={y - alto} width={RX1 - RX0 + 8} height="5" rx="2" style={{ fill: colors.concreteLight }} />
      {[14, 26, 38].map((d) => (
        <line key={d} x1={RX0} x2={RX1} y1={y - alto + d} y2={y - alto + d} style={{ stroke: alpha(colors.concreteLight, 0.85), strokeWidth: 2 }} />
      ))}
      {postes.map((x) => (
        <rect key={x} x={x - 1.5} y={y - alto} width="3" height={alto} style={{ fill: colors.concreteLight }} />
      ))}
    </g>
  );
}

/** Poste con panel solar (como los del Poli). */
function Poste({ x, sueloY, luces }) {
  const alto = 260;
  return (
    <g pointerEvents="none">
      {luces > 0 && <circle cx={x} cy={sueloY - alto + 22} r="46" style={{ fill: 'url(#bs-luz)', opacity: luces }} />}
      <rect x={x - 2.5} y={sueloY - alto} width="5" height={alto} style={{ fill: colors.blueSteel }} />
      <rect x={x - 16} y={sueloY - alto - 12} width="32" height="9" rx="1" transform={`rotate(-12 ${x} ${sueloY - alto - 8})`} style={{ fill: colors.blueDeep }} />
      <path d={`M${x - 11} ${sueloY - alto + 14} h22 l-4 12 h-14 z`} style={{ fill: colors.blueSteel }} />
      <rect x={x - 7} y={sueloY - alto + 26} width="14" height="4" rx="2" style={{ fill: mezcla(colors.windowLit, colors.concreteLight, luces) }} />
    </g>
  );
}

function Arbol({ x, sueloY }) {
  return (
    <g pointerEvents="none">
      <rect x={x - 3} y={sueloY - 46} width="6" height="46" style={{ fill: colors.concreteShadow }} />
      <circle cx={x} cy={sueloY - 58} r="22" style={{ fill: colors.grassDark }} />
      <circle cx={x - 14} cy={sueloY - 46} r="14" style={{ fill: colors.grass }} />
      <circle cx={x + 13} cy={sueloY - 48} r="15" style={{ fill: colors.grass }} />
    </g>
  );
}

const ESTILOS = `
.bs-room { cursor: pointer; outline: none; }
.bs-room .bs-hover { opacity: 0; transition: opacity .15s ease; }
.bs-room:hover .bs-hover, .bs-room:focus-visible .bs-hover { opacity: 1; }
`;
