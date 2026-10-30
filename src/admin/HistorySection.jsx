// src/admin/HistorySection.jsx — Responsable: Alexis
// =====================================================================
// Sección "Historial de cambios": TODO lo que pasa en el panel, no solo
// los reportes (api/historial.php):
//   - Reportes: enviados, cambios de estado, prioridad y comentarios.
//   - Avisos: publicar, editar, borrar y mandar como notificación.
//   - Comentarios: ocultar, aprobar, borrar y pausar cuentas.
//   - Accesos: agregar o quitar admins, restablecer contraseñas, invitaciones.
//   - Entradas: quién entró al panel y los intentos con contraseña mala.
//
// Arriba: números de hoy y de la semana, el admin más activo y los intentos
// fallidos. Filtros por tipo, por persona, por fechas y buscador. La lista
// va agrupada por día ("Hoy", "Ayer", "24 de octubre") y se puede descargar
// en CSV. Tocar un folio abre el reporte.
//
// Props: onOpen(folio), onMessage, refreshKey, preset ({ quien }) desde Usuarios admin
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { getPanelHistory } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { TextField, SelectField } from '../components/Inputs.jsx';
import { SectionTitle, OutlineButton, DateField } from './ui.jsx';
import { stateInfo, priorityInfo, formatDate } from './reportMeta.js';

const TIPOS = [
  { key: 'todo', label: 'Todo', icon: 'history' },
  { key: 'reporte', label: 'Reportes', icon: 'report', color: colors.crimson },
  { key: 'aviso', label: 'Avisos', icon: 'campaign', color: colors.cyanDark },
  { key: 'comentario', label: 'Comentarios', icon: 'forum', color: colors.magenta },
  { key: 'acceso', label: 'Accesos', icon: 'manage_accounts', color: colors.goldDark },
  { key: 'sesion', label: 'Entradas', icon: 'login', color: colors.green },
  { key: 'perdido', label: 'Perdidos', icon: 'travel_explore', color: colors.blueSteel },
];
const colorDe = (tipo) => TIPOS.find((t) => t.key === tipo)?.color ?? colors.blue;

const VACIO = { tipo: 'todo', quien: '', desde: '', hasta: '', q: '' };

export default function HistorySection({ onOpen, onMessage, refreshKey, preset = null }) {
  const [filtros, setFiltros] = useState(() => ({ ...VACIO, ...(preset ?? {}) }));
  const [busqueda, setBusqueda] = useState(filtros.q); // se manda al dejar de escribir
  const [items, setItems] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [loading, setLoading] = useState(true);

  // Si llega un filtro nuevo desde "Usuarios admin" (Ver su historial).
  useEffect(() => {
    if (preset) setFiltros({ ...VACIO, ...preset });
  }, [preset]);

  // Buscador: espera 400 ms después de la última tecla.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda })), 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Pedir la primera página cada vez que cambian los filtros.
  useEffect(() => {
    let vivo = true;
    setLoading(true);
    getPanelHistory({ ...filtros, pagina: 0 })
      .then((d) => {
        if (!vivo) return;
        setItems(d.items);
        setHayMas(d.hayMas);
        setPagina(0);
        if (d.resumen) setResumen(d.resumen);
        if (d.admins) setAdmins(d.admins);
      })
      .catch((e) => onMessage(`No se pudo cargar el historial: ${e.message}`))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, [filtros, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarMas() {
    try {
      const d = await getPanelHistory({ ...filtros, pagina: pagina + 1 });
      setItems((l) => [...l, ...d.items]);
      setHayMas(d.hayMas);
      setPagina((p) => p + 1);
    } catch (e) {
      onMessage(e.message);
    }
  }

  const grupos = useMemo(() => agruparPorDia(items), [items]);
  const set = (k) => (v) => setFiltros((f) => ({ ...f, [k]: v ?? '' }));
  const hayFiltros = filtros.tipo !== 'todo' || filtros.quien || filtros.desde || filtros.hasta || filtros.q;

  return (
    <div>
      <SectionTitle
        title="Historial de cambios"
        subtitle="Todo lo que pasa en el panel: reportes, avisos, comentarios, accesos y entradas."
      >
        <OutlineButton icon="download" onClick={() => descargarCsv(items)}>
          Descargar CSV
        </OutlineButton>
      </SectionTitle>

      {/* Números de la semana */}
      {resumen && (
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Tile icon="today" tone={colors.cyanDark} label="Movimientos hoy" value={resumen.hoy} />
          <Tile icon="date_range" tone={colors.blue} label="Últimos 7 días" value={resumen.semana} note="sin contar entradas" />
          <Card className="flex items-center gap-3 p-4" style={{ borderRadius: 20 }}>
            {resumen.masActivo ? (
              <>
                <UserAvatar user={resumen.masActivo} size={44} ring={colors.gold} />
                <div className="min-w-0">
                  <div className="text-xs font-bold" style={{ color: colors.textSecondary }}>
                    Más activo esta semana
                  </div>
                  <div className="truncate text-base font-black">{resumen.masActivo.nombre || resumen.masActivo.correo}</div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    {resumen.masActivo.cambios} cambios
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm" style={{ color: colors.textMuted }}>
                Nadie ha hecho cambios esta semana.
              </div>
            )}
          </Card>
          <Tile
            icon={resumen.fallidosSemana ? 'gpp_maybe' : 'verified_user'}
            tone={resumen.fallidosSemana ? colors.crimson : colors.green}
            label="Contraseñas incorrectas (7 días)"
            value={resumen.fallidosSemana}
            note={resumen.fallidosSemana ? 'Revisa en "Entradas"' : 'Todo tranquilo'}
            onClick={resumen.fallidosSemana ? () => setFiltros({ ...VACIO, tipo: 'sesion' }) : undefined}
          />
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-4 p-4" style={{ borderRadius: 20 }}>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => {
            const activo = filtros.tipo === t.key;
            const n = t.key === 'todo' ? null : resumen?.porTipo?.[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => set('tipo')(t.key)}
                className="tappable flex h-9 items-center gap-2 px-3 text-sm font-bold"
                style={{
                  borderRadius: 999,
                  border: `1.5px solid ${activo ? colors.blue : colors.border}`,
                  backgroundColor: activo ? colors.blue : colors.surface,
                  color: activo ? colors.white : colors.textSecondary,
                }}
              >
                <Icon name={t.icon} size={17} color={activo ? colors.white : t.color ?? colors.textSecondary} />
                {t.label}
                {n != null && (
                  <span className="text-xs font-black" style={{ opacity: 0.75 }} title="Últimos 7 días">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
          <TextField value={busqueda} onChange={setBusqueda} placeholder="Buscar folio, aviso, correo…" prefixIcon="search" />
          <SelectField
            value={filtros.quien || null}
            onChange={set('quien')}
            placeholder="Todas las personas"
            prefixIcon="person_search"
            options={[
              { value: 'alumnos', label: 'Solo lo que hicieron alumnos' },
              ...admins.map((a) => ({ value: String(a.id), label: a.nombre || a.correo })),
            ]}
          />
          <DateField label="Desde" value={filtros.desde} onChange={set('desde')} />
          <DateField label="Hasta" value={filtros.hasta} onChange={set('hasta')} />
          {hayFiltros ? (
            <OutlineButton
              icon="filter_alt_off"
              onClick={() => {
                setBusqueda('');
                setFiltros(VACIO);
              }}
            >
              Limpiar
            </OutlineButton>
          ) : (
            <span />
          )}
        </div>
      </Card>

      {/* Línea de tiempo por día */}
      <Card className="p-5" style={{ borderRadius: 20 }}>
        {loading ? (
          <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
            Cargando…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center" style={{ color: colors.textMuted }}>
            <Icon name="manage_search" size={44} color={colors.border} />
            <div className="font-bold" style={{ color: colors.textSecondary }}>
              No hay movimientos con estos filtros
            </div>
          </div>
        ) : (
          grupos.map((g) => (
            <section key={g.dia} className="mb-5 last:mb-0">
              <h3 className="m-0 mb-3 flex items-center gap-2 text-xs font-black uppercase" style={{ color: colors.textSecondary, letterSpacing: 0.6 }}>
                {g.titulo}
                <span className="font-bold" style={{ color: colors.textMuted }}>
                  · {g.items.length} {g.items.length === 1 ? 'movimiento' : 'movimientos'}
                </span>
                <span className="h-px flex-1" style={{ backgroundColor: colors.border }} />
              </h3>
              <ol className="m-0 grid list-none gap-0 p-0">
                {g.items.map((h, i) => (
                  <Movimiento key={h.id} h={h} ultimo={i === g.items.length - 1} onOpen={onOpen} />
                ))}
              </ol>
            </section>
          ))
        )}
        {hayMas && !loading && (
          <div className="mt-2 flex justify-center">
            <OutlineButton icon="expand_more" onClick={cargarMas}>
              Cargar más
            </OutlineButton>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Un renglón: foto de quién, qué hizo y a qué, y la hora. */
function Movimiento({ h, ultimo, onOpen }) {
  const d = describir(h);
  const color = colorDe(h.tipo);
  const actor = nombreActor(h);
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="relative">
          {h.quien ? (
            <UserAvatar user={h.quien} size={36} ring={colors.surface} />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.background }}>
              <Icon name={d.sinActorIcon ?? 'person'} size={18} color={colors.textMuted} />
            </span>
          )}
          {/* Ícono de la acción, en la esquina de la foto */}
          <span
            className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ backgroundColor: d.alerta ? colors.crimson : color, border: `2px solid ${colors.surface}` }}
          >
            <Icon name={d.icon} size={11} color={colors.white} />
          </span>
        </span>
        {!ultimo && <span className="mt-1 w-[2px] flex-1" style={{ backgroundColor: colors.border }} />}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 text-sm" style={{ lineHeight: 1.45, color: colors.textPrimary }}>
            <b>{actor}</b> {d.verbo}{' '}
            {h.folio ? (
              <button
                type="button"
                onClick={() => onOpen?.(h.folio)}
                className="border-0 bg-transparent p-0 font-black underline"
                style={{ color: colors.ink, cursor: 'pointer' }}
              >
                {h.folio}
              </button>
            ) : h.objeto && !d.sinObjeto ? (
              <b>{h.objeto}</b>
            ) : null}
            {d.extra && <span style={{ color: colors.textSecondary }}> {d.extra}</span>}
          </div>
          <span className="shrink-0 text-xs" style={{ color: colors.textMuted }} title={formatDate(h.fecha)}>
            {hora(h.fecha)}
          </span>
        </div>
        {(h.detalle || d.cita) && (
          <div
            className="mt-1 text-xs"
            style={{
              color: d.alerta ? colors.crimsonDark : colors.textSecondary,
              ...(d.cita ? { backgroundColor: colors.background, padding: '6px 10px', borderRadius: 10, display: 'inline-block' } : {}),
            }}
          >
            {d.cita ?? h.detalle}
          </div>
        )}
      </div>
    </li>
  );
}

function nombreActor(h) {
  if (h.quien) return h.quien.nombre || h.quien.correo;
  if (h.correo) return h.correo;
  if (h.tipo === 'reporte' && (h.accion === 'creado' || h.accion === 'apoyo')) return 'Un alumno';
  return 'Sistema';
}

/** Texto de cada acción. */
function describir(h) {
  if (h.tipo === 'reporte') {
    switch (h.accion) {
      case 'creado':
        return { icon: 'add', verbo: 'envió el reporte', sinActorIcon: 'school' };
      case 'apoyo':
        return { icon: 'group_add', verbo: 'se sumó ("a mí también me pasa") a', sinActorIcon: 'school' };
      case 'estado':
        return { icon: 'swap_horiz', verbo: 'cambió el estado de', extra: `: ${stateInfo(h.antes).label} → ${stateInfo(h.despues).label}` };
      case 'prioridad':
        return { icon: 'flag', verbo: 'cambió la prioridad de', extra: `: ${priorityInfo(h.antes).label} → ${priorityInfo(h.despues).label}` };
      case 'comentario':
        return h.despues
          ? { icon: 'chat', verbo: 'comentó en', cita: `“${h.despues}”` }
          : { icon: 'chat', verbo: 'borró el comentario de' };
      default:
        return { icon: 'history', verbo: h.accion };
    }
  }
  const textos = {
    aviso: {
      crear: ['add', 'publicó el aviso'],
      editar: ['edit', 'editó el aviso'],
      borrar: ['delete', 'borró el aviso'],
      notificar: ['notifications_active', 'mandó como notificación'],
    },
    comentario: {
      ocultar: ['visibility_off', 'ocultó el comentario de'],
      mostrar: ['check', 'aprobó el comentario de'],
      borrar: ['delete', 'borró el comentario de'],
      pausar: ['voice_over_off', 'pausó la cuenta de'],
      quitar_pausa: ['record_voice_over', 'quitó la pausa a'],
      revisar_bloqueo: ['verified', 'revisó lo que bloqueó el filtro a'],
    },
    acceso: {
      agregar: ['person_add', 'agregó a'],
      quitar: ['person_remove', 'quitó el acceso a'],
      nota: ['sticky_note_2', 'cambió la nota de'],
      reset_clave: ['lock_reset', 'restableció la contraseña de'],
      desbloquear: ['lock_open', 'desbloqueó a'],
      invitar: ['forward_to_inbox', 'mandó la invitación a'],
      consejal: ['how_to_reg', 'designó como consejal a'],
      quitar_consejal: ['person_off', 'quitó como consejal a'],
    },
    sesion: {
      entrar: ['login', 'entró al panel'],
      clave_incorrecta: ['password', 'escribió una contraseña incorrecta', true],
      bloqueo: ['lock', 'quedó bloqueado 15 minutos', true],
      clave_creada: ['key', 'creó o recuperó su contraseña'],
    },
    perdido: {
      ocultar: ['visibility_off', 'ocultó la publicación de objetos perdidos'],
      mostrar: ['check', 'volvió a mostrar la publicación'],
      borrar: ['delete', 'borró la publicación de objetos perdidos'],
    },
  };
  const [icon, verbo, alerta] = textos[h.tipo]?.[h.accion] ?? ['history', h.accion];
  return { icon, verbo, alerta: Boolean(alerta), sinObjeto: h.tipo === 'sesion', sinActorIcon: h.tipo === 'sesion' ? 'person_alert' : undefined };
}

/** "10:32" */
function hora(iso) {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** [{ dia: '2026-10-26', titulo: 'Hoy', items }] */
function agruparPorDia(items) {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const clave = (d) => d.toLocaleDateString('en-CA');
  const grupos = [];
  items.forEach((h) => {
    const dia = (h.fecha || '').slice(0, 10);
    let g = grupos[grupos.length - 1];
    if (!g || g.dia !== dia) {
      const f = new Date(`${dia}T12:00:00`);
      const titulo =
        dia === clave(hoy)
          ? 'Hoy'
          : dia === clave(ayer)
            ? 'Ayer'
            : f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      g = { dia, titulo, items: [] };
      grupos.push(g);
    }
    g.items.push(h);
  });
  return grupos;
}

/** CSV de lo que se ve (con BOM para que Excel lea bien los acentos). */
function descargarCsv(items) {
  const filas = [['Fecha', 'Tipo', 'Quién', 'Acción', 'Sobre', 'Detalle']];
  items.forEach((h) => {
    const d = describir(h);
    filas.push([
      formatDate(h.fecha),
      TIPOS.find((t) => t.key === h.tipo)?.label ?? h.tipo,
      nombreActor(h),
      `${d.verbo}${d.extra ?? ''}`,
      h.folio ?? h.objeto ?? '',
      d.cita ?? h.detalle ?? '',
    ]);
  });
  const csv = filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `POLIMAP-historial-${new Date().toLocaleDateString('en-CA')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function Tile({ icon, tone, label, value, note, onClick }) {
  return (
    <Card className={`p-4 ${onClick ? 'cursor-pointer' : ''}`} style={{ borderRadius: 20 }}>
      <div onClick={onClick} role={onClick ? 'button' : undefined}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center" style={{ backgroundColor: alpha(tone, 0.12), borderRadius: 10 }}>
            <Icon name={icon} size={18} color={tone} />
          </span>
          <span className="text-xs font-bold" style={{ color: colors.textSecondary }}>
            {label}
          </span>
        </div>
        <div className="mt-2 text-[28px] font-black leading-none">{value}</div>
        {note && (
          <div className="mt-1 text-xs" style={{ color: colors.textMuted }}>
            {note}
          </div>
        )}
      </div>
    </Card>
  );
}
