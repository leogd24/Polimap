// src/admin/LostSection.jsx — Responsable: Alexis
// Sección "Objetos perdidos" del panel: revisar lo que publican los alumnos.
//   - Arriba lo oculto (3 reportes o lo ocultó un admin), luego lo más reportado.
//   - Ver quién lo publicó (correo), los reportes, la foto y el estado.
//   - Acciones: Ocultar / Volver a mostrar (borra los reportes) / Borrar.
//   - Cada acción queda en "Historial de cambios" (tipo Perdidos).
// API: getLostPanel, moderateLostItem, deleteLostItem (api/perdidos.php).
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SectionTitle, OutlineButton } from './ui.jsx';
import { getLostPanel, moderateLostItem, deleteLostItem } from '../lib/api.js';
import { categoriaPerdido, ESTADOS_PERDIDO, lugarPerdido } from '../lib/perdidos.js';
import { formatDate } from './reportMeta.js';

const FILTROS = [
  { key: 'revisar', label: 'Por revisar' },
  { key: 'activo', label: 'Publicados' },
  { key: 'todo', label: 'Todo' },
];

export default function LostSection({ onMessage }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('revisar');

  function cargar() {
    setCargando(true);
    getLostPanel()
      .then((r) => setItems(r.items ?? []))
      .catch((e) => onMessage(`No se pudieron cargar: ${e.message}. ¿Ya importaste sql/polimap.sql?`))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function moderar(it, estado) {
    try {
      await moderateLostItem(it.id, estado);
      onMessage(estado === 'oculto' ? 'Publicación oculta.' : 'Publicación visible otra vez (reportes borrados).');
      cargar();
    } catch (e) {
      onMessage(e.message);
    }
  }

  async function borrar(it) {
    if (!window.confirm(`¿Borrar "${it.title}"? No se puede deshacer.`)) return;
    try {
      await deleteLostItem(it.id);
      onMessage('Publicación borrada.');
      cargar();
    } catch (e) {
      onMessage(e.message);
    }
  }

  const porRevisar = items.filter((i) => i.status === 'oculto' || i.reports > 0);
  const visibles = filtro === 'revisar' ? porRevisar : filtro === 'activo' ? items.filter((i) => i.status === 'activo') : items;

  return (
    <div>
      <SectionTitle title="Objetos perdidos" subtitle="Lo que publican los alumnos. Con 3 reportes se oculta solo hasta que lo revises. Todo se borra a los 30 días.">
        <OutlineButton icon="refresh" onClick={cargar}>
          Actualizar
        </OutlineButton>
      </SectionTitle>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <OutlineButton key={f.key} active={filtro === f.key} onClick={() => setFiltro(f.key)} badge={f.key === 'revisar' && porRevisar.length ? porRevisar.length : undefined}>
            {f.label}
          </OutlineButton>
        ))}
      </div>

      {!cargando && visibles.length === 0 ? (
        <EmptyState icon="travel_explore" title={filtro === 'revisar' ? 'Nada por revisar' : 'Sin publicaciones'} body={filtro === 'revisar' ? 'No hay publicaciones reportadas ni ocultas.' : 'Aún no hay publicaciones.'} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((it) => {
            const cat = categoriaPerdido(it.category);
            const est = ESTADOS_PERDIDO[it.status] ?? ESTADOS_PERDIDO.activo;
            return (
              <Card key={it.id} className="flex gap-3 p-4" style={it.status === 'oculto' ? { border: `2px solid ${colors.crimson}` } : undefined}>
                {it.photo ? (
                  <img src={it.photo} alt="" className="h-20 w-20 shrink-0 object-cover" style={{ borderRadius: 14 }} />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center" style={{ borderRadius: 14, backgroundColor: colors.blueTint }}>
                    <Icon name={cat.icon} size={34} color={colors.ink} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black">{it.title}</span>
                    <span className="px-2 py-[2px] text-[11px] font-black" style={{ borderRadius: 8, backgroundColor: est.bg, color: est.fg }}>
                      {est.label.toUpperCase()}
                    </span>
                    {it.reports > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[11px] font-black" style={{ borderRadius: 8, backgroundColor: colors.crimsonTint, color: colors.crimsonDark }}>
                        <Icon name="flag" size={13} color={colors.crimsonDark} />
                        {it.reports} {it.reports === 1 ? 'reporte' : 'reportes'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                    {it.type === 'encontrado' ? 'Encontrado' : 'Perdido'} · {cat.label}
                    {lugarPerdido(it) ? ` · ${lugarPerdido(it)}` : ''}
                  </div>
                  {it.description && (
                    <p className="m-0 mt-1 line-clamp-3 text-sm" style={{ color: colors.textSecondary }}>
                      {it.description}
                    </p>
                  )}
                  {it.handover && (
                    <div className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                      <b>Dónde recogerlo:</b> {it.handover}
                    </div>
                  )}
                  <div className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                    {it.author?.nombre || 'Alumno'} · {it.contact} · {formatDate(it.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {it.status === 'oculto' ? (
                    <Accion icon="visibility" label="Volver a mostrar" onClick={() => moderar(it, 'activo')} />
                  ) : it.status === 'activo' ? (
                    <Accion icon="visibility_off" label="Ocultar" onClick={() => moderar(it, 'oculto')} />
                  ) : null}
                  <Accion icon="delete" label="Borrar" onClick={() => borrar(it)} peligro />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Accion({ icon, label, onClick, peligro }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0"
      style={{ backgroundColor: colors.background }}
    >
      <Icon name={icon} size={20} color={peligro ? colors.crimsonDark : colors.textSecondary} />
    </button>
  );
}
