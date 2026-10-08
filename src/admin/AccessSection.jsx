// src/admin/AccessSection.jsx — Responsable: Alexis
// Sección "Accesos" (solo el administrador maestro).
//
//   - Profesores administradores: correos @academicos.udg.mx DESIGNADOS que
//     pueden entrar a este panel. Si no están en esta lista, no entran aunque
//     sean profesores. Cada uno crea su propia contraseña con un código que le
//     llega al correo ("Crear o recuperar contraseña" en la entrada del panel).
//   - Correos de prueba: cualquier correo (Gmail, etc.) que puede reportar en
//     la app como si fuera alumno. Sirve para evaluadores o compañeros.
//   - La cuenta maestra (rol 'maestro') está en la base de datos y no se
//     puede quitar desde aquí (así nadie deja el panel sin dueño).
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import { getAccessList, addAccess, removeAccess } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import FilledButton from '../components/FilledButton.jsx';
import { TextField, SelectField } from '../components/Inputs.jsx';
import { SectionTitle } from './ui.jsx';
import { formatDate, timeAgo } from './reportMeta.js';

const ROLES = [
  { value: 'admin', label: 'Profesor administrador (panel)' },
  { value: 'prueba', label: 'Correo de prueba (puede reportar como alumno)' },
];
const TIPOS = { alumno: 'Alumno', prueba: 'Prueba', admin: 'Admin', maestro: 'Maestro', academico: 'Académico sin acceso', ninguno: 'Sin acceso' };

export default function AccessSection({ onMessage }) {
  const [data, setData] = useState(null);
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('admin');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    getAccessList()
      .then(setData)
      .catch((error) => onMessage(`No se pudo cargar la lista: ${error.message}`));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!correo.trim() || saving) return;
    setSaving(true);
    try {
      await addAccess(correo.trim(), rol, nota.trim());
      onMessage(`${correo.trim()} agregado.`);
      setCorreo('');
      setNota('');
      load();
    } catch (error) {
      onMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`¿Quitar el acceso de ${item.correo}? Pierde la entrada de inmediato.`)) return;
    try {
      await removeAccess(item.id);
      onMessage(`${item.correo} ya no tiene acceso.`);
      load();
    } catch (error) {
      onMessage(error.message);
    }
  }

  const maestros = data?.accesos.filter((a) => a.rol === 'maestro') ?? [];
  const admins = data?.accesos.filter((a) => a.rol === 'admin') ?? [];
  const pruebas = data?.accesos.filter((a) => a.rol === 'prueba') ?? [];

  return (
    <div>
      <SectionTitle title="Usuarios admin" subtitle="Correos designados: quién entra al panel y quién puede reportar sin correo de alumno." />

      <Card className="mb-5 p-5">
        <h2 className="m-0 mb-3 text-base font-black">Agregar correo</h2>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <TextField value={correo} onChange={setCorreo} placeholder="nombre@academicos.udg.mx" prefixIcon="mail" />
          <SelectField value={rol} onChange={(v) => setRol(v ?? 'admin')} placeholder="Tipo de acceso" prefixIcon="badge" options={ROLES} />
          <TextField value={nota} onChange={setNota} placeholder="Nota (ej. Evaluador, Mtra. de Redes)" prefixIcon="sticky_note_2" />
          <FilledButton icon="person_add" onClick={add} style={{ opacity: saving ? 0.6 : 1 }}>
            Agregar
          </FilledButton>
        </div>
        <p className="m-0 mt-2 text-xs" style={{ color: colors.textMuted }}>
          Los profesores administradores deben tener correo @academicos.udg.mx. Después de agregarlos, cada uno entra a
          este panel → "¿Primera vez u olvidaste tu contraseña?" y crea la suya con el código que le llega. Los
          correos de prueba pueden ser de cualquier dominio y solo sirven para reportar en la app.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AccessList
          title="Profesores administradores"
          icon="admin_panel_settings"
          items={admins}
          empty="Todavía no agregas profesores."
          onRemove={remove}
          showPassword
          header={maestros.map((m) => (
            <Row
              key={m.id}
              correo={m.correo}
              detail={['Cuenta maestra · solo se cambia con SQL', m.tieneClave ? 'Con contraseña' : 'Sin contraseña aún']
                .join(' · ')}
              icon="workspace_premium"
            />
          ))}
        />
        <AccessList title="Correos de prueba" icon="science" items={pruebas} empty="Sin correos de prueba." onRemove={remove} />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-black">
          <Icon name="group" size={20} color={colors.blue} />
          Personas que han entrado ({data?.usuarios.total ?? 0})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr style={{ color: colors.textSecondary }}>
                <th className="py-2 pr-3 font-bold">Nombre</th>
                <th className="py-2 pr-3 font-bold">Correo</th>
                <th className="py-2 pr-3 font-bold">Tipo</th>
                <th className="py-2 font-bold">Última entrada</th>
              </tr>
            </thead>
            <tbody>
              {(data?.usuarios.recientes ?? []).map((u) => (
                <tr key={u.correo} className="border-t" style={{ borderColor: colors.border }}>
                  <td className="py-2 pr-3">{u.nombre || '—'}</td>
                  <td className="py-2 pr-3">{u.correo}</td>
                  <td className="py-2 pr-3">{TIPOS[u.tipo] ?? u.tipo}</td>
                  <td className="py-2" title={formatDate(u.lastLogin)}>
                    {timeAgo(u.lastLogin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AccessList({ title, icon, items, empty, onRemove, header, showPassword = false }) {
  return (
    <Card className="p-5">
      <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-black">
        <Icon name={icon} size={20} color={colors.blue} />
        {title}
      </h2>
      <div className="grid gap-2">
        {header}
        {items.map((item) => (
          <Row
            key={item.id}
            correo={item.correo}
            detail={[
              item.nota,
              showPassword && (item.tieneClave ? 'Con contraseña' : 'Sin contraseña aún'),
              item.nombre ? `Entró ${timeAgo(item.lastLogin)}` : 'Aún no entra',
            ]
              .filter(Boolean)
              .join(' · ')}
            onRemove={() => onRemove(item)}
          />
        ))}
        {items.length === 0 && (
          <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
            {empty}
          </p>
        )}
      </div>
    </Card>
  );
}

function Row({ correo, detail, onRemove, icon = 'person' }) {
  return (
    <div className="flex items-center gap-3 p-2" style={{ backgroundColor: colors.background, borderRadius: 14 }}>
      <Icon name={icon} size={22} color={colors.textSecondary} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{correo}</div>
        {detail && (
          <div className="truncate text-xs" style={{ color: colors.textMuted }}>
            {detail}
          </div>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${correo}`}
          title="Quitar acceso"
          className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
          style={{ backgroundColor: colors.surface }}
        >
          <Icon name="person_remove" size={20} color={colors.crimsonDark} />
        </button>
      )}
    </div>
  );
}
