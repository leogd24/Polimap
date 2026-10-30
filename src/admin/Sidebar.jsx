// src/admin/Sidebar.jsx — Responsable: Alexis
// Menú lateral del panel (en celular se abre como cajón con el botón ☰).
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import BrandStripe from '../components/BrandStripe.jsx';
import UserAvatar from '../components/UserAvatar.jsx';

/**
 * Secciones del panel.
 *   maestro: true = solo la ve la cuenta maestra.
 */
export const SECTIONS = [
  { key: 'tablero', label: 'Tablero', icon: 'view_kanban' },
  { key: 'mapa', label: 'Mapa de reportes', icon: 'map' },
  { key: 'estadisticas', label: 'Estadísticas', icon: 'monitoring' },
  { key: 'avisos', label: 'Avisos de la app', icon: 'campaign' },
  { key: 'comentarios', label: 'Comentarios', icon: 'forum' },
  { key: 'perdidos', label: 'Objetos perdidos', icon: 'travel_explore' },
  { key: 'historial', label: 'Historial de cambios', icon: 'history' },
  // Profesores, pruebas y consejales en una sola sección (los admins que no son
  // maestros solo ven y designan consejales).
  { key: 'accesos', label: 'Usuarios y consejales', icon: 'manage_accounts' },
];

/// Props: user, current, onSelect, pending (sin atender), flagged (comentarios por revisar), onLogout,
///        sound + onToggleSound (aviso con sonido de reportes nuevos)
///        oscuro + onApariencia (abre Apariencia y accesibilidad, compartida con la app)
export default function Sidebar({ user, current, onSelect, pending, flagged = 0, onLogout, sound, onToggleSound, oscuro = false, onApariencia }) {
  const items = SECTIONS.filter((s) => !s.maestro || user.permisos.maestro);

  return (
    <aside className="flex h-full w-[290px] flex-col" style={{ backgroundColor: colors.blueDeep, color: colors.white }}>
      <div className="flex items-center gap-3 px-5 py-5">
        <PolimapLogo size={42} />
        <div className="min-w-0">
          <div className="text-lg font-black leading-tight">POLIMAP</div>
          <div className="text-xs" style={{ color: alpha(colors.white, 0.7) }}>
            Panel de administración
          </div>
        </div>
      </div>
      <BrandStripe height={4} />

      <nav className="app-scroll flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Secciones del panel">
        {items.map((item) => {
          const active = item.key === current;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={active ? 'page' : undefined}
              className="tappable flex min-h-[48px] items-center gap-3 border-0 px-3 text-left text-sm font-bold"
              style={{
                backgroundColor: active ? colors.blueLight : 'transparent',
                color: active ? colors.white : alpha(colors.white, 0.78),
                borderRadius: 14,
                boxShadow: active ? `inset 4px 0 0 ${colors.cyan}` : 'none',
              }}
            >
              <Icon name={item.icon} size={22} color={active ? colors.cyan : alpha(colors.white, 0.7)} />
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {item.key === 'tablero' && pending > 0 && (
                <span
                  className="whitespace-nowrap px-[10px] py-[2px] text-xs font-black"
                  style={{ backgroundColor: colors.crimson, color: colors.white, borderRadius: 999 }}
                  title="Reportes sin atender"
                >
                  {pending} {pending === 1 ? 'nuevo' : 'nuevos'}
                </span>
              )}
              {item.key === 'comentarios' && flagged > 0 && (
                <span
                  className="whitespace-nowrap px-[10px] py-[2px] text-xs font-black"
                  style={{ backgroundColor: colors.crimson, color: colors.white, borderRadius: 999 }}
                  title="Comentarios reportados u ocultos"
                >
                  {flagged} por revisar
                </span>
              )}
            </button>
          );
        })}
        <a
          href="/"
          className="tappable mt-2 flex min-h-[48px] items-center gap-3 px-3 text-sm font-bold no-underline"
          style={{ color: alpha(colors.white, 0.78), borderRadius: 14 }}
        >
          <Icon name="smartphone" size={22} color={alpha(colors.white, 0.7)} />
          Abrir la app de alumnos
        </a>
      </nav>

      {/* Pie: quién está dentro, cerrar sesión y sonido */}
      <div className="flex items-center gap-3 border-t px-5 py-4" style={{ borderColor: alpha(colors.white, 0.12) }}>
        <UserAvatar user={user} size={38} ring={alpha(colors.white, 0.5)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black">{user.nombre || user.correo}</div>
          <div className="text-xs" style={{ color: alpha(colors.white, 0.75) }}>
            {user.permisos.maestro ? 'Administrador maestro' : 'Administrador'} ·{' '}
            <button
              type="button"
              onClick={onLogout}
              className="border-0 bg-transparent p-0 text-xs underline"
              style={{ color: alpha(colors.white, 0.9), cursor: 'pointer' }}
            >
              cerrar sesión
            </button>
          </div>
        </div>
        {onApariencia && (
          <button
            type="button"
            onClick={onApariencia}
            aria-label="Apariencia y accesibilidad"
            title={`Apariencia y accesibilidad (ahora: ${oscuro ? 'oscuro' : 'claro'}). También cambia la app.`}
            className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
            style={{ backgroundColor: alpha(colors.white, 0.1) }}
          >
            <Icon name={oscuro ? 'dark_mode' : 'light_mode'} size={20} color={colors.white} />
          </button>
        )}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={sound ? 'Apagar sonido de reportes nuevos' : 'Encender sonido de reportes nuevos'}
            title={sound ? 'Sonido de reportes nuevos: encendido' : 'Sonido de reportes nuevos: apagado'}
            className="tappable flex h-10 w-10 items-center justify-center rounded-full border-0"
            style={{ backgroundColor: alpha(colors.white, 0.1) }}
          >
            <Icon name={sound ? 'notifications_active' : 'notifications_off'} size={20} color={colors.white} />
          </button>
        )}
      </div>
    </aside>
  );
}
