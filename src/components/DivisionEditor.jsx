// src/components/DivisionEditor.jsx — Responsable: Alexis (pantalla de Horario)
// =====================================================================
// MODO CONSEJAL (pantalla completa): dividir al grupo por semana.
//   1. Elige la semana (flechas).
//   2. Elige un "pincel" (Grupo 1, Grupo 2, Mitad y mitad, Todo el grupo,
//      No hay clase o Normal) y toca las clases para pintarlas.
//   3. Escribe recordatorios ("traer bata el jueves").
//   4. Lista del grupo: pega la lista desde Excel o agrégala a mano
//      (código, nombre, correo) y reparte en Grupo 1 y Grupo 2.
//   5. Descarga en Excel (misma vista + hoja de división + hoja oficial),
//      descarga la imagen o compártela (WhatsApp).
// Todo se guarda solo en este celular (src/lib/division.js).
//
// Props: grupo, colores, estado, onClose, onMensaje(texto)
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import SemanaGrid, { estiloModo } from './SemanaGrid.jsx';
import BottomSheet from './BottomSheet.jsx';
import { TextArea } from './Inputs.jsx';
import { descargarArchivo, lunesDe, llaveClase, masDias, textoSemana } from '../lib/horario.js';
import { MODOS, ORDEN_MODOS, correoValido, guardarDivision, leerDivision, leerListaPegada, repartirMitades, semanaDe } from '../lib/division.js';
import { imagenSemana } from '../lib/horarioImagen.js';
import { libroHorario, TIPO_XLSX } from '../lib/horarioExcel.js';

export default function DivisionEditor({ grupo, colores, estado, onClose, onMensaje }) {
  const [datos, setDatos] = useState(() => leerDivision(grupo.code));
  const [lunes, setLunes] = useState(() => lunesDe(estado.fecha));
  const [pincel, setPincel] = useState('g1');
  const [pegar, setPegar] = useState(false);
  const [trabajando, setTrabajando] = useState('');
  const cerrar = useRef(null);
  const alCerrar = useRef(onClose);
  alCerrar.current = onClose;

  const semana = semanaDe(datos, lunes);
  const texto = textoSemana(lunes);

  // Guardar cada cambio.
  useEffect(() => {
    guardarDivision(grupo.code, datos);
  }, [grupo.code, datos]);

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && !document.querySelector('[data-hoja-pegar]') && alCerrar.current();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  function cambiarSemana(cambios) {
    setDatos((d) => ({ ...d, semanas: { ...d.semanas, [lunes]: { ...semanaDe(d, lunes), ...cambios } } }));
  }

  function pintar(clase) {
    const k = llaveClase(clase);
    const modos = { ...semana.modos };
    // Tocar otra vez con el mismo pincel la regresa a normal.
    if (modos[k] === pincel || pincel === 'normal') delete modos[k];
    else modos[k] = pincel;
    cambiarSemana({ modos });
  }

  function copiarSemanaPasada() {
    const pasada = datos.semanas[masDias(lunes, -7)];
    if (!pasada || !Object.keys(pasada.modos).length) {
      onMensaje('La semana pasada no tiene división guardada.');
      return;
    }
    cambiarSemana({ modos: { ...pasada.modos } });
    onMensaje('Se copió la división de la semana pasada.');
  }

  function setLista(lista) {
    setDatos((d) => ({ ...d, lista }));
  }

  const nombreBase = `Horario ${grupo.code} ${texto.replace(/^Semana /, 'semana ')}`;

  async function descargarExcel() {
    setTrabajando('excel');
    try {
      const bytes = await libroHorario({ grupo, colores, modos: semana.modos, semana: texto, notas: semana.notas, lista: datos.lista });
      descargarArchivo(new Blob([bytes], { type: TIPO_XLSX }), `${nombreBase}.xlsx`);
      onMensaje('Excel descargado. Ábrelo con Excel o Google Sheets.');
    } catch (e) {
      onMensaje(`No se pudo crear el Excel: ${e.message}`);
    } finally {
      setTrabajando('');
    }
  }

  async function imagen(compartir) {
    setTrabajando(compartir ? 'compartir' : 'imagen');
    try {
      const blob = await imagenSemana({ grupo, colores, modos: semana.modos, semana: texto, notas: semana.notas });
      const archivo = new File([blob], `${nombreBase}.png`, { type: 'image/png' });
      if (compartir && navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: `Horario ${grupo.code}`, text: `${texto} · ${grupo.code}` });
      } else {
        descargarArchivo(blob, `${nombreBase}.png`);
        if (compartir) onMensaje('Tu navegador no deja compartir directo: se descargó la imagen.');
      }
    } catch (e) {
      if (e.name !== 'AbortError') onMensaje(`No se pudo crear la imagen: ${e.message}`);
    } finally {
      setTrabajando('');
    }
  }

  const cuenta = {
    g1: datos.lista.filter((a) => a.grupo === 1).length,
    g2: datos.lista.filter((a) => a.grupo === 2).length,
  };
  const marcadas = Object.keys(semana.modos).length;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Modo consejal ${grupo.code}`} className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Barra */}
      <header className="flex shrink-0 items-center gap-2 px-2" style={{ backgroundColor: colors.magentaSolid, color: colors.white, paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(60px + env(safe-area-inset-top))' }}>
        <button ref={cerrar} type="button" onClick={onClose} aria-label="Cerrar modo consejal" className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent">
          <Icon name="arrow_back" color={colors.white} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-black">Modo consejal · {grupo.code}</div>
          <div className="text-[0.6875rem]" style={{ color: alpha(colors.white, 0.8) }}>
            Se guarda en este celular
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-28 pt-3">
        <div className="mx-auto flex max-w-[980px] flex-col gap-4">
          {/* Semana */}
          <div className="flex items-center gap-2 p-1" style={{ borderRadius: 16, backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
            <BotonRedondo icon="chevron_left" label="Semana anterior" onClick={() => setLunes((l) => masDias(l, -7))} />
            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-sm font-black">{texto}</div>
              <div className="text-[0.6875rem]" style={{ color: colors.textMuted }}>
                {marcadas ? `${marcadas} ${marcadas === 1 ? 'clase marcada' : 'clases marcadas'}` : 'Sin cambios: horario normal'}
                {lunes === lunesDe(estado.fecha) ? ' · esta semana' : ''}
              </div>
            </div>
            <BotonRedondo icon="chevron_right" label="Semana siguiente" onClick={() => setLunes((l) => masDias(l, 7))} />
          </div>

          {/* Pinceles */}
          <section>
            <h3 className="m-0 mb-2 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
              1. Elige y toca las clases
            </h3>
            <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-label="Pincel">
              {ORDEN_MODOS.map((m) => {
                const activo = pincel === m;
                const e = estiloModo(m, null);
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => setPincel(m)}
                    className="tappable relative flex items-center gap-2 overflow-hidden p-2 text-left"
                    style={{ borderRadius: 14, border: `2px solid ${activo ? colors.ink : colors.border}`, backgroundColor: colors.surface }}
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden" style={{ borderRadius: 10, background: e.background, border: m === 'normal' || m === 'sin' ? `1px solid ${colors.border}` : 'none' }}>
                      {m === 'sin' ? (
                        <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden>
                          <path d="M0 0L36 36M36 0L0 36" stroke={colors.crimson} strokeWidth="2.5" />
                        </svg>
                      ) : (
                        <Icon name={MODOS[m].icon} size={20} color={m === 'normal' ? colors.textSecondary : colors.white} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black leading-tight">{MODOS[m].label}</span>
                      <span className="block text-[0.6875rem] leading-tight" style={{ color: colors.textMuted }}>
                        {MODOS[m].texto}
                      </span>
                    </span>
                    {activo && <Icon name="check_circle" size={18} color={colors.ink} style={{ position: 'absolute', right: 6, top: 6 }} />}
                  </button>
                );
              })}
            </div>
          </section>

          <SemanaGrid grupo={grupo} colores={colores} modos={semana.modos} onTocar={pintar} alto={70} />

          <div className="flex flex-wrap gap-2">
            <BotonClaro icon="content_copy" onClick={copiarSemanaPasada}>
              Copiar la semana pasada
            </BotonClaro>
            {marcadas > 0 && (
              <BotonClaro icon="restart_alt" onClick={() => window.confirm('¿Quitar todas las marcas de esta semana?') && cambiarSemana({ modos: {} })}>
                Limpiar semana
              </BotonClaro>
            )}
          </div>

          {/* Recordatorios */}
          <section>
            <h3 className="m-0 mb-2 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
              2. Recordatorios de la semana
            </h3>
            <TextArea value={semana.notas} onChange={(notas) => cambiarSemana({ notas })} placeholder="Ej. El jueves traer bata. El viernes no hay clases después de las 12." minRows={3} maxLength={600} />
          </section>

          {/* Lista */}
          <Lista lista={datos.lista} onCambiar={setLista} onPegar={() => setPegar(true)} cuenta={cuenta} />
        </div>
      </div>

      {/* Acciones (fijas abajo) */}
      <footer className="absolute inset-x-0 bottom-0 flex gap-2 px-3 pt-3" style={{ backgroundColor: colors.surface, borderTop: `1px solid ${colors.border}`, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex w-full max-w-[980px] gap-2">
          <BotonAccion icon={trabajando === 'excel' ? 'hourglass_top' : 'table_view'} onClick={descargarExcel} fondo={colors.greenSolid} disabled={Boolean(trabajando)}>
            Excel
          </BotonAccion>
          <BotonAccion icon={trabajando === 'imagen' ? 'hourglass_top' : 'image'} onClick={() => imagen(false)} fondo={colors.blue} disabled={Boolean(trabajando)}>
            Imagen
          </BotonAccion>
          <BotonAccion icon={trabajando === 'compartir' ? 'hourglass_top' : 'share'} onClick={() => imagen(true)} fondo={colors.magentaSolid} disabled={Boolean(trabajando)}>
            Compartir
          </BotonAccion>
        </div>
      </footer>

      <HojaPegar
        open={pegar}
        onClose={() => setPegar(false)}
        onListo={(nuevos, reemplazar) => {
          setLista(reemplazar ? nuevos : [...datos.lista, ...nuevos]);
          setPegar(false);
          onMensaje(`${nuevos.length} ${nuevos.length === 1 ? 'alumno agregado' : 'alumnos agregados'}.`);
        }}
      />
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------
// Lista del grupo
// ---------------------------------------------------------------------
function Lista({ lista, onCambiar, onPegar, cuenta }) {
  const cambiar = (i, cambios) => onCambiar(lista.map((a, k) => (k === i ? { ...a, ...cambios } : a)));
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="m-0 flex-1 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
          3. Lista del grupo ({lista.length})
        </h3>
        <span className="px-2 py-[2px] text-xs font-black" style={{ borderRadius: 8, backgroundColor: colors.cyanTint, color: colors.cyanDark }}>
          G1: {cuenta.g1}
        </span>
        <span className="px-2 py-[2px] text-xs font-black" style={{ borderRadius: 8, backgroundColor: colors.crimsonTint, color: colors.crimsonDark }}>
          G2: {cuenta.g2}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <BotonClaro icon="content_paste" onClick={onPegar}>
          Pegar lista
        </BotonClaro>
        <BotonClaro icon="person_add" onClick={() => onCambiar([...lista, { codigo: '', nombre: '', correo: '', grupo: null }])}>
          Agregar alumno
        </BotonClaro>
        {lista.length > 1 && (
          <BotonClaro icon="call_split" onClick={() => onCambiar(repartirMitades(lista))}>
            Repartir en dos mitades
          </BotonClaro>
        )}
        {lista.length > 0 && (
          <BotonClaro icon="delete_sweep" onClick={() => window.confirm('¿Borrar toda la lista?') && onCambiar([])}>
            Borrar lista
          </BotonClaro>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="m-0 px-3 py-6 text-center text-sm" style={{ borderRadius: 16, border: `1.5px dashed ${colors.border}`, color: colors.textSecondary }}>
          Copia la lista de tu grupo desde Excel (código, nombre y correo) y tócale a “Pegar lista”.
        </p>
      ) : (
        <div className="overflow-x-auto" style={{ borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr style={{ backgroundColor: colors.goldTint, color: colors.ink }}>
                {['Código', 'Nombre', 'Correo institucional', 'Grupo', ''].map((t) => (
                  <th key={t} className="px-2 py-2 text-xs font-black uppercase">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((a, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${colors.border}`, backgroundColor: a.grupo === 1 ? alpha(colors.cyan, 0.08) : a.grupo === 2 ? alpha(colors.crimson, 0.07) : undefined }}>
                  <td className="px-1 py-1">
                    <Celda value={a.codigo} onChange={(v) => cambiar(i, { codigo: v.replace(/\D/g, '') })} label="Código" ancho={110} modo="numeric" />
                  </td>
                  <td className="px-1 py-1">
                    <Celda value={a.nombre} onChange={(v) => cambiar(i, { nombre: v.toUpperCase() })} label="Nombre" />
                  </td>
                  <td className="px-1 py-1">
                    <Celda value={a.correo} onChange={(v) => cambiar(i, { correo: v.trim().toLowerCase() })} label="Correo" error={!correoValido(a.correo)} />
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex gap-1">
                      {[1, 2].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => cambiar(i, { grupo: a.grupo === n ? null : n })}
                          aria-pressed={a.grupo === n}
                          aria-label={`Grupo ${n}`}
                          className="tappable h-8 w-9 border-0 text-xs font-black"
                          style={{
                            borderRadius: 8,
                            backgroundColor: a.grupo === n ? (n === 1 ? colors.cyanSolid : colors.crimsonSolid) : colors.background,
                            color: a.grupo === n ? colors.white : colors.textSecondary,
                          }}
                        >
                          G{n}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <BotonRedondo icon="close" label={`Quitar ${a.nombre || 'alumno'}`} onClick={() => onCambiar(lista.filter((_, k) => k !== i))} chico />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Celda({ value, onChange, label, ancho, modo, error = false }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      inputMode={modo}
      placeholder={label}
      className="h-9 w-full min-w-0 px-2 text-sm outline-none"
      style={{ width: ancho, borderRadius: 8, border: `1px solid ${error ? colors.crimson : 'transparent'}`, backgroundColor: 'transparent', color: colors.textPrimary }}
      onFocus={(e) => (e.currentTarget.style.borderColor = colors.ink)}
      onBlur={(e) => (e.currentTarget.style.borderColor = error ? colors.crimson : 'transparent')}
    />
  );
}

/** Hoja para pegar la lista copiada de Excel. */
function HojaPegar({ open, onClose, onListo }) {
  const [texto, setTexto] = useState('');
  const filas = leerListaPegada(texto);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      icon="content_paste"
      title="Pegar lista del grupo"
      subtitle="Copia las columnas de Excel (código, nombre, correo) y pégalas aquí."
      footer={
        <div className="flex gap-2" data-hoja-pegar>
          <button type="button" disabled={!filas.length} onClick={() => onListo(filas, false)} className="tappable h-12 flex-1 border-0 text-sm font-black" style={{ borderRadius: 14, backgroundColor: colors.blue, color: colors.white, opacity: filas.length ? 1 : 0.4 }}>
            Agregar {filas.length || ''}
          </button>
          <button type="button" disabled={!filas.length} onClick={() => onListo(filas, true)} className="tappable h-12 flex-1 text-sm font-black" style={{ borderRadius: 14, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary, opacity: filas.length ? 1 : 0.4 }}>
            Reemplazar lista
          </button>
        </div>
      }
    >
      <div data-hoja-pegar>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={7}
          placeholder={'223935252\tARELLANO GOMEZ LUIS MANUEL\tluis.arellano3525@alumnos.udg.mx\n223935066\tASCENCIO MAGAÑA EMMANUEL\temmanuel.ascencio3506@alumnos.udg.mx'}
          className="w-full p-3 text-sm outline-none"
          style={{ borderRadius: 14, border: `1.5px solid ${colors.border}`, fontFamily: 'ui-monospace, monospace', backgroundColor: colors.background }}
          aria-label="Lista pegada"
        />
        {filas.length > 0 && (
          <div className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
            Se leyeron <b>{filas.length}</b> alumnos. Primero: {filas[0].codigo || 'sin código'} · {filas[0].nombre || 'sin nombre'} · {filas[0].correo || 'sin correo'}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function BotonRedondo({ icon, label, onClick, chico = false }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`tappable flex shrink-0 items-center justify-center rounded-full border-0 ${chico ? 'h-8 w-8' : 'h-11 w-11'}`} style={{ backgroundColor: colors.background }}>
      <Icon name={icon} size={chico ? 18 : 24} color={colors.textSecondary} />
    </button>
  );
}

function BotonClaro({ icon, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="tappable flex h-9 items-center gap-1 px-3 text-xs font-black" style={{ borderRadius: 999, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textSecondary }}>
      <Icon name={icon} size={16} color={colors.textSecondary} />
      {children}
    </button>
  );
}

function BotonAccion({ icon, onClick, fondo, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="tappable flex h-12 flex-1 items-center justify-center gap-2 border-0 text-sm font-black" style={{ borderRadius: 14, backgroundColor: fondo, color: colors.white, opacity: disabled ? 0.6 : 1 }}>
      <Icon name={icon} size={20} color={colors.white} />
      {children}
    </button>
  );
}

