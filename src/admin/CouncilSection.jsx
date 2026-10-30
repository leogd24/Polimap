// src/admin/CouncilSection.jsx — Responsable: Alexis
// Sección "Consejales de grupo" del panel.
//   - Designa a un alumno (por su correo @alumnos.udg.mx) como consejal o
//     jefe de un grupo. Solo ellos publican exámenes y entregas de su grupo
//     y el encuadre de cada materia (app → Horario → Fechas / Notas).
//   - Puede ser alguien que todavía no entra a la app: en cuanto inicie
//     sesión con ese correo, ya puede publicar.
//   - Quitar. Todo queda en Historial → Accesos.
// API: getCouncilors, assignCouncilor, removeCouncilor (api/calendario.php).
import { useEffect, useMemo, useState } from 'react';
import { colors } from '../styles/theme.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import EmptyState from '../components/EmptyState.jsx';
import FilledButton from '../components/FilledButton.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { TextField, SelectField } from '../components/Inputs.jsx';
import { SectionTitle, OutlineButton } from './ui.jsx';
import { getCouncilors, assignCouncilor, removeCouncilor } from '../lib/api.js';
import { allSchedules, scheduleCareers } from '../data/schedules.js';

const ROLES = [
  { value: 'consejal', label: 'Consejal' },
  { value: 'jefe', label: 'Jefe de grupo' },
];

export default function CouncilSection({ onMessage }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({ grupo: null, correo: '', rol: 'consejal' });
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');

  // Grupos del horario, agrupados por carrera (para el <select>).
  const opcionesGrupo = useMemo(
    () =>
      scheduleCareers.map((c) => ({
        label: c,
        options: allSchedules.filter((g) => g.career === c).map((g) => ({ value: g.code, label: `${g.code} · ${g.shift}` })),
      })),
    []
  );

  function cargar() {
    setCargando(true);
    getCouncilors()
      .then((r) => setLista(r.consejales ?? []))
      .catch((e) => onMessage(`No se pudieron cargar: ${e.message}. ¿Ya corriste sql/migracion-calendario.sql?`))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function asignar() {
    if (!form.grupo || !form.correo.trim()) {
      onMessage('Elige el grupo y escribe el correo del alumno.');
      return;
    }
    setGuardando(true);
    try {
      await assignCouncilor(form.grupo, form.correo.trim(), form.rol);
      onMessage(`Listo: ${form.correo.trim()} ya puede publicar fechas de ${form.grupo}.`);
      setForm((f) => ({ ...f, correo: '' }));
      cargar();
    } catch (e) {
      onMessage(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(c) {
    if (!window.confirm(`¿Quitar a ${c.nombre || c.correo} como ${c.rol === 'jefe' ? 'jefe' : 'consejal'} de ${c.grupo}?`)) return;
    try {
      await removeCouncilor(c.grupo, c.correo);
      onMessage('Consejal quitado.');
      cargar();
    } catch (e) {
      onMessage(e.message);
    }
  }

  // Agrupados por grupo.
  const q = filtro.trim().toLowerCase();
  const visibles = lista.filter((c) => !q || c.grupo.toLowerCase().includes(q) || c.correo.includes(q) || (c.nombre || '').toLowerCase().includes(q));
  const porGrupo = [];
  visibles.forEach((c) => {
    const g = porGrupo[porGrupo.length - 1];
    if (g && g.grupo === c.grupo) g.items.push(c);
    else porGrupo.push({ grupo: c.grupo, items: [c] });
  });
  const sinConsejal = allSchedules.length - new Set(lista.map((c) => c.grupo)).size;

  return (
    <div>
      <SectionTitle
        title="Consejales de grupo"
        subtitle="Ellos publican los exámenes y entregas de su grupo (y el encuadre de cada materia). A todo el grupo le llega una notificación."
      >
        <OutlineButton icon="refresh" onClick={cargar}>
          Actualizar
        </OutlineButton>
      </SectionTitle>

      <Card className="mb-5 p-5">
        <h2 className="m-0 mb-3 text-base font-black">Designar consejal</h2>
        <div className="grid gap-3 md:grid-cols-[1.2fr_1.6fr_1fr_auto]">
          <SelectField value={form.grupo} onChange={(v) => setForm((f) => ({ ...f, grupo: v }))} placeholder="Grupo" prefixIcon="groups" options={opcionesGrupo} />
          <TextField
            value={form.correo}
            onChange={(v) => setForm((f) => ({ ...f, correo: v }))}
            placeholder="correo@alumnos.udg.mx"
            prefixIcon="alternate_email"
            inputProps={{ type: 'email', 'aria-label': 'Correo del alumno', onKeyDown: (e) => e.key === 'Enter' && asignar() }}
          />
          <SelectField value={form.rol} onChange={(v) => setForm((f) => ({ ...f, rol: v ?? 'consejal' }))} placeholder="Rol" prefixIcon="badge" options={ROLES} />
          <FilledButton icon={guardando ? 'hourglass_top' : 'how_to_reg'} onClick={asignar} style={{ opacity: guardando ? 0.6 : 1 }}>
            Designar
          </FilledButton>
        </div>
        <p className="m-0 mt-3 text-xs" style={{ color: colors.textSecondary }}>
          Puede ser alguien que aún no entra a la app: en cuanto inicie sesión con ese correo podrá publicar. {sinConsejal} de {allSchedules.length} grupos aún no tienen consejal.
        </p>
      </Card>

      <div className="mb-3 max-w-[420px]">
        <TextField value={filtro} onChange={setFiltro} placeholder="Buscar grupo, nombre o correo" prefixIcon="search" inputProps={{ type: 'search', 'aria-label': 'Buscar consejales' }} />
      </div>

      {!cargando && porGrupo.length === 0 ? (
        <EmptyState icon="how_to_reg" title={q ? 'Sin resultados' : 'Aún no hay consejales'} body={q ? 'Prueba con otro grupo o correo.' : 'Designa al primero con el formulario de arriba.'} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {porGrupo.map((g) => (
            <Card key={g.grupo} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="groups" size={20} color={colors.ink} />
                <b className="flex-1">{g.grupo}</b>
                <span className="text-xs" style={{ color: colors.textSecondary }}>
                  {allSchedules.find((x) => x.code === g.grupo)?.shift ?? ''}
                </span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {g.items.map((c) => (
                  <li key={c.correo} className="flex items-center gap-3">
                    <UserAvatar user={{ nombre: c.nombre || c.correo, foto: c.foto }} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{c.nombre || c.correo}</div>
                      <div className="truncate text-xs" style={{ color: colors.textSecondary }}>
                        {c.rol === 'jefe' ? 'Jefe de grupo' : 'Consejal'} · {c.correo}
                        {!c.entro && ' · aún no entra a la app'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(c)}
                      aria-label={`Quitar a ${c.nombre || c.correo}`}
                      title="Quitar"
                      className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
                      style={{ backgroundColor: colors.background }}
                    >
                      <Icon name="person_remove" size={20} color={colors.crimsonDark} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
