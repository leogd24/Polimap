// src/components/Calificaciones.jsx — Responsable: Alexis (Horario → Notas)
// =====================================================================
// Calculadora de promedio y faltas, por materia del grupo.
//   - El ENCUADRE (criterios y %) lo escribe el alumno o lo importa del que
//     subió el consejal del grupo ("Usar el encuadre del grupo").
//   - Pone lo que va sacando y ve: puntos que lleva, promedio, cuánto
//     necesita en lo que falta para pasar con 60.
//   - Faltas: botones − / +, clases del semestre (salen del horario) y el
//     mínimo para el ordinario (80 %). "Puedes faltar 3 veces más".
//   - Todo se guarda SOLO en este celular (src/lib/calificaciones.js).
//   - Consejales: "Compartir este encuadre con el grupo".
//
// Props: grupo (objeto de horario), cal (useCalendarioGrupo), onMensaje(texto)
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BottomSheet from './BottomSheet.jsx';
import { saveGroupFraming } from '../lib/api.js';
import { CICLO, materiaBonita } from '../lib/horario.js';
import {
  ASISTENCIA_EXTRA,
  CAL_MINIMA,
  calcular,
  desdeEncuadre,
  guardarMateria,
  leerGrupo,
  materiaVacia,
  nuevoId,
  promedioGeneral,
  sesionesDelSemestre,
  textoFaltas,
} from '../lib/calificaciones.js';

/** Las materias guardadas del grupo, y se actualiza si otra pantalla las cambia. */
function useMaterias(codigo) {
  const [datos, setDatos] = useState(() => leerGrupo(codigo));
  useEffect(() => {
    setDatos(leerGrupo(codigo));
    const cambio = () => setDatos(leerGrupo(codigo));
    window.addEventListener('polimap:calificaciones', cambio);
    return () => window.removeEventListener('polimap:calificaciones', cambio);
  }, [codigo]);
  return datos;
}

// Colores y textos según cómo vas.
const NOTA = {
  aprobado: { fg: colors.greenDark, bg: colors.greenTint, texto: 'Vas aprobando' },
  'en-camino': { fg: colors.cyanDark, bg: colors.cyanTint, texto: 'En camino' },
  dificil: { fg: colors.goldDark, bg: colors.goldTint, texto: 'Hay que echarle ganas' },
  imposible: { fg: colors.crimsonDark, bg: colors.crimsonTint, texto: 'Ya no alcanza para 60' },
  reprobado: { fg: colors.crimsonDark, bg: colors.crimsonTint, texto: 'No alcanzó 60' },
  'sin-datos': { fg: colors.textSecondary, bg: colors.blueTint, texto: 'Sin calificaciones' },
};
const ASIS = {
  bien: { fg: colors.greenDark, barra: colors.greenSolid },
  cuidado: { fg: colors.goldDark, barra: colors.gold },
  limite: { fg: colors.crimsonDark, barra: colors.crimsonSolid },
  extraordinario: { fg: colors.crimsonDark, barra: colors.crimsonSolid },
  'sin-derecho': { fg: colors.crimsonDark, barra: colors.crimsonSolid },
};

export default function Calificaciones({ grupo, cal, onMensaje }) {
  const guardadas = useMaterias(grupo.code);
  const [abierta, setAbierta] = useState(null);
  const encuadres = cal.datos?.encuadres ?? [];

  // Materias del horario, en el orden en que aparecen.
  const materias = useMemo(() => [...new Set(grupo.sessions.map((s) => s.subject))], [grupo]);
  const filas = materias.map((m) => {
    const datos = guardadas[m] ?? null;
    const auto = sesionesDelSemestre(grupo, m);
    return { materia: m, datos, auto, r: calcular(datos ?? materiaVacia(), auto), encuadre: encuadres.find((e) => e.materia === m) ?? null };
  });
  const general = promedioGeneral(filas.filter((f) => f.datos && !f.datos.nuevo).map((f) => f.r));
  const enRiesgo = filas.filter((f) => f.datos && ['limite', 'extraordinario', 'sin-derecho'].includes(f.r.asistencia.estado)).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen */}
      <section className="flex items-center gap-4 p-4" style={{ borderRadius: 20, background: `linear-gradient(135deg, ${colors.blue}, ${colors.blueLight})`, color: colors.white }}>
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center" style={{ borderRadius: 18, backgroundColor: alpha(colors.white, 0.14) }}>
          <span className="text-2xl font-black leading-none">{general ?? '—'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-black">Promedio general</div>
          <div className="text-xs" style={{ color: alpha(colors.white, 0.86), lineHeight: 1.4 }}>
            {general === null ? 'Toca una materia, pon su encuadre y lo que vas sacando.' : 'De lo que ya está calificado.'}
            {enRiesgo > 0 && ` · ${enRiesgo} ${enRiesgo === 1 ? 'materia' : 'materias'} con muchas faltas.`}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        {filas.map(({ materia, datos, r, encuadre }) => {
          const n = NOTA[datos && !datos.nuevo ? r.nota : 'sin-datos'];
          const a = ASIS[r.asistencia.estado];
          const pctFaltas = r.asistencia.maxFaltas ? Math.min(100, (r.asistencia.faltas / r.asistencia.maxFaltas) * 100) : 0;
          return (
            <button
              key={materia}
              type="button"
              onClick={() => setAbierta(materia)}
              className="tappable flex w-full flex-col gap-2 p-3 text-left"
              style={{ borderRadius: 18, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
            >
              <span className="flex w-full items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black leading-snug" style={{ color: colors.textPrimary }}>
                    {materiaBonita(materia)}
                  </span>
                  <span className="block text-xs" style={{ color: colors.textSecondary }}>
                    {datos && !datos.nuevo
                      ? r.necesitas !== null && r.nota !== 'aprobado' && r.nota !== 'imposible'
                        ? `Necesitas ${r.necesitas} en lo que falta`
                        : n.texto
                      : encuadre
                        ? 'Tu consejal subió el encuadre'
                        : 'Toca para poner tu encuadre'}
                  </span>
                </span>
                <span className="shrink-0 px-2 py-[2px] text-sm font-black tabular-nums" style={{ borderRadius: 10, backgroundColor: n.bg, color: n.fg }}>
                  {datos && !datos.nuevo && r.promedio !== null ? r.promedio : '—'}
                </span>
              </span>
              {/* Faltas */}
              <span className="flex w-full items-center gap-2 text-[0.6875rem] font-bold" style={{ color: datos?.faltas ? a.fg : colors.textSecondary }}>
                <Icon name="event_busy" size={14} color={datos?.faltas ? a.fg : colors.textSecondary} />
                <span className="h-[6px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.blueTint }}>
                  <span className="block h-full rounded-full" style={{ width: `${pctFaltas}%`, backgroundColor: a.barra }} />
                </span>
                {r.asistencia.faltas}/{r.asistencia.maxFaltas} faltas
              </span>
            </button>
          );
        })}
      </div>

      <p className="m-0 flex items-start gap-2 px-1 text-xs" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
        <Icon name="lock" size={16} color={colors.textSecondary} />
        Se guarda solo en este celular. El encuadre te lo da tu profe al inicio del curso; si es distinto al del grupo, cámbialo aquí.
        Mínimo para aprobar: {CAL_MINIMA}. Asistencia: 80 % para ordinario y {ASISTENCIA_EXTRA} % para extraordinario (Reglamento de la UdeG).
      </p>

      {abierta && (
        <HojaMateria
          grupo={grupo}
          materia={abierta}
          inicial={guardadas[abierta] ?? null}
          encuadre={encuadres.find((e) => e.materia === abierta) ?? null}
          puedeCompartir={Boolean(cal.datos?.puedoPublicar)}
          onEncuadreCompartido={(e) =>
            cal.cambiar((d) => ({ ...d, encuadres: [...d.encuadres.filter((x) => x.materia !== e.materia), e] }))
          }
          onMensaje={onMensaje}
          onClose={() => setAbierta(null)}
        />
      )}
    </div>
  );
}

/** Campo numérico chiquito (porcentaje o calificación). */
function Numero({ value, onChange, label, placeholder = '', max = 100, ancho = 64 }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      max={max}
      step="any"
      value={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => {
        const t = e.target.value;
        if (t === '') return onChange(null);
        const n = Math.max(0, Math.min(max, Number(t)));
        onChange(Number.isNaN(n) ? null : n);
      }}
      className="h-11 px-2 text-center text-sm font-black tabular-nums"
      style={{ width: ancho, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
    />
  );
}

function HojaMateria({ grupo, materia, inicial, encuadre, puedeCompartir, onEncuadreCompartido, onMensaje, onClose }) {
  const auto = useMemo(() => sesionesDelSemestre(grupo, materia), [grupo, materia]);
  // Si no hay nada guardado y el consejal subió el encuadre, se usa ese de entrada.
  const [m, setM] = useState(() => inicial ?? (encuadre ? { ...desdeEncuadre(encuadre), nuevo: true } : materiaVacia()));
  const [compartiendo, setCompartiendo] = useState(false);
  const r = calcular(m, auto);
  const a = r.asistencia;

  function cambiar(cambios) {
    setM((x) => {
      const nuevo = { ...x, ...cambios, nuevo: false };
      guardarMateria(grupo.code, materia, nuevo);
      return nuevo;
    });
  }
  const setCriterio = (id, cambios) => cambiar({ criterios: m.criterios.map((c) => (c.id === id ? { ...c, ...cambios } : c)), origen: 'propio' });

  async function compartir() {
    if (r.suma !== 100) {
      onMensaje('Los porcentajes deben sumar 100 para compartir el encuadre.');
      return;
    }
    if (!window.confirm(`¿Compartir este encuadre de ${materiaBonita(materia)} con todo ${grupo.code}? Solo se comparten los criterios y porcentajes, no tus calificaciones.`)) return;
    setCompartiendo(true);
    try {
      const res = await saveGroupFraming(grupo.code, materia, m.criterios.map((c) => ({ nombre: c.nombre, porcentaje: c.porcentaje })), m.asistenciaMin);
      onEncuadreCompartido(res.encuadre);
      onMensaje('Encuadre compartido con el grupo.');
    } catch (e) {
      onMensaje(e.message);
    } finally {
      setCompartiendo(false);
    }
  }

  const resumen = NOTA[r.nota];
  const mismoQueGrupo =
    encuadre && encuadre.criterios.length === m.criterios.length && encuadre.criterios.every((c, i) => c.nombre === m.criterios[i].nombre && c.porcentaje === m.criterios[i].porcentaje);

  return (
    <BottomSheet open onClose={onClose} title={materiaBonita(materia)} subtitle="Encuadre, calificaciones y faltas" icon="calculate" ancho={560}>
      {/* flex (no grid): así los renglones se encogen al ancho del celular */}
      <div className="flex min-w-0 flex-col gap-4">
        {/* Encuadre del grupo */}
        {encuadre && !mismoQueGrupo && (
          <div className="flex items-start gap-3 p-3" style={{ borderRadius: 14, backgroundColor: colors.cyanTint }}>
            <Icon name="group" size={22} color={colors.cyanDark} />
            <div className="min-w-0 flex-1 text-sm" style={{ color: colors.cyanDark }}>
              <b>Encuadre del grupo</b>
              <span className="block text-xs">
                {encuadre.criterios.map((c) => `${c.nombre} ${c.porcentaje} %`).join(' · ')}
                {encuadre.por ? ` — lo subió ${encuadre.por}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  const nuevo = desdeEncuadre(encuadre, m);
                  setM(nuevo);
                  guardarMateria(grupo.code, materia, nuevo);
                }}
                className="tappable mt-2 h-9 border-0 px-3 text-xs font-black"
                style={{ borderRadius: 10, backgroundColor: colors.cyanSolid, color: colors.white }}
              >
                Usar este encuadre
              </button>
            </div>
          </div>
        )}

        {/* Encuadre y calificaciones */}
        <section aria-label="Encuadre y calificaciones">
          <div className="mb-2 flex items-end gap-2 px-1 text-[0.6875rem] font-black uppercase" style={{ color: colors.textSecondary, letterSpacing: 0.4 }}>
            <span className="flex-1">Criterio</span>
            <span className="w-16 text-center">%</span>
            <span className="w-16 text-center">Sacaste</span>
            <span className="w-9" />
          </div>
          <div className="flex flex-col gap-2">
            {m.criterios.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  type="text"
                  size={1}
                  value={c.nombre}
                  maxLength={40}
                  aria-label={`Nombre del criterio ${i + 1}`}
                  onChange={(e) => setCriterio(c.id, { nombre: e.target.value })}
                  className="h-11 min-w-0 flex-1 px-3 text-sm font-bold"
                  style={{ borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
                />
                <Numero value={c.porcentaje} onChange={(v) => setCriterio(c.id, { porcentaje: v ?? 0 })} label={`Porcentaje de ${c.nombre}`} />
                <Numero value={c.cal} onChange={(v) => setCriterio(c.id, { cal: v })} label={`Calificación de ${c.nombre}`} placeholder="—" />
                <button
                  type="button"
                  onClick={() => cambiar({ criterios: m.criterios.filter((x) => x.id !== c.id), origen: 'propio' })}
                  disabled={m.criterios.length <= 1}
                  aria-label={`Quitar ${c.nombre}`}
                  className="tappable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0"
                  style={{ backgroundColor: colors.background, opacity: m.criterios.length <= 1 ? 0.4 : 1 }}
                >
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {m.criterios.length < 12 && (
              <button
                type="button"
                onClick={() => cambiar({ criterios: [...m.criterios, { id: nuevoId(), nombre: 'Nuevo criterio', porcentaje: 0, cal: null }], origen: 'propio' })}
                className="tappable flex h-9 items-center gap-1 px-3 text-xs font-black"
                style={{ borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
              >
                <Icon name="add" size={16} color={colors.textSecondary} />
                Agregar criterio
              </button>
            )}
            <span className="text-xs font-black" role="status" style={{ color: r.suma === 100 ? colors.greenDark : colors.crimsonDark }}>
              {r.suma === 100 ? 'Suma 100 %' : `Suma ${r.suma} %: debe ser 100`}
            </span>
          </div>
        </section>

        {/* Resultado */}
        <section className="p-4" aria-label="Resultado" style={{ borderRadius: 16, backgroundColor: resumen.bg }}>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-black tabular-nums" style={{ color: resumen.fg }}>
              {r.puntos}
            </div>
            <div className="min-w-0 flex-1 text-sm" style={{ color: resumen.fg }}>
              <b>{resumen.texto}</b>
              <span className="block text-xs">
                puntos de 100 · {r.evaluado} % del curso calificado{r.promedio !== null ? ` · promedio ${r.promedio}` : ''}
              </span>
            </div>
          </div>
          <p className="m-0 mt-2 text-sm font-bold" style={{ color: resumen.fg }}>
            {r.necesitas === null
              ? r.puntos >= CAL_MINIMA
                ? `Calificación final: ${r.puntos}.`
                : `Calificación final: ${r.puntos}. Revisa con tu profe si hay extraordinario.`
              : r.nota === 'aprobado'
                ? `Ya tienes ${CAL_MINIMA} asegurados. Lo más que puedes sacar: ${r.maximo}.`
                : r.nota === 'imposible'
                  ? `Aunque saques 100 en lo que falta llegas a ${r.maximo}. Habla con tu profe.`
                  : `Necesitas ${r.necesitas} de promedio en lo que falta (${100 - r.evaluado} %) para llegar a ${CAL_MINIMA}.`}
          </p>
        </section>

        {/* Faltas */}
        <section className="p-4" aria-label="Faltas" style={{ borderRadius: 16, border: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-3">
            <Icon name="event_busy" size={22} color={ASIS[a.estado].fg} />
            <b className="flex-1 text-sm">Faltas</b>
            <button type="button" onClick={() => cambiar({ faltas: Math.max(0, a.faltas - 1) })} aria-label="Quitar una falta" className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
              <Icon name="remove" color={colors.textPrimary} />
            </button>
            <span className="w-8 text-center text-xl font-black tabular-nums" aria-live="polite">
              {a.faltas}
            </span>
            <button type="button" onClick={() => cambiar({ faltas: a.faltas + 1 })} aria-label="Sumar una falta" className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.background }}>
              <Icon name="add" color={colors.textPrimary} />
            </button>
          </div>
          <p className="m-0 mt-2 text-sm font-bold" style={{ color: ASIS[a.estado].fg }}>
            {textoFaltas(a)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold" style={{ color: colors.textSecondary }}>
            <label className="flex items-center gap-2">
              Clases del semestre
              <Numero value={m.sesiones} onChange={(v) => cambiar({ sesiones: v ? Math.round(v) : null })} label="Clases del semestre" placeholder={String(auto)} max={300} />
            </label>
            <label className="flex items-center gap-2">
              Asistencia mínima
              <Numero value={m.asistenciaMin} onChange={(v) => cambiar({ asistenciaMin: v ?? 80 })} label="Asistencia mínima para ordinario" max={100} />
              %
            </label>
          </div>
          <p className="m-0 mt-2 text-[0.6875rem]" style={{ color: colors.textSecondary }}>
            Las {auto} clases salen de tu horario y del ciclo {CICLO.nombre} (sin días festivos). Si tu profe cuenta distinto, cámbialo.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {puedeCompartir && (
            <button
              type="button"
              onClick={compartir}
              disabled={compartiendo}
              className="tappable flex h-11 items-center gap-2 border-0 px-4 text-sm font-black"
              style={{ borderRadius: 12, backgroundColor: colors.blue, color: colors.white, opacity: compartiendo ? 0.6 : 1 }}
            >
              <Icon name="share" size={18} color={colors.white} />
              Compartir encuadre con {grupo.code}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('¿Borrar tus calificaciones y faltas de esta materia?')) return;
              const limpio = { ...materiaVacia(), criterios: m.criterios.map((c) => ({ ...c, cal: null })), asistenciaMin: m.asistenciaMin, origen: m.origen };
              setM(limpio);
              guardarMateria(grupo.code, materia, limpio);
            }}
            className="tappable flex h-11 items-center gap-2 px-4 text-sm font-bold"
            style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
          >
            <Icon name="restart_alt" size={18} color={colors.textSecondary} />
            Empezar de nuevo
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
