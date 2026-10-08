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
 *   nuevo:   true = lleva la etiqueta rosa "NUEVO" (funciones del panel v2).
 */
export const SECTIONS = [
  { key: 'tablero', label: 'Tablero', icon: 'view_kanban' },
  { key: 'mapa', label: 'Mapa de reportes', icon: 'map', nuevo: true },
  { key: 'estadisticas', label: 'Estadísticas', icon: 'monitoring', nuevo: true },
  { key: 'avisos', label: 'Avisos de la app', icon: 'campaign', nuevo: true },
  { key: 'historial', label: 'Historial de cambios', icon: 'history' },
  { key: 'accesos', label: 'Usuarios admin', icon: 'manage_accounts', maestro: true },
];

/// Props: user, current, onSelect, pending (sin atender), onLogout,
///        sound + onToggleSound (aviso con sonido de reportes nuevos)
export default function Sidebar({ user, current, onSelect, pending, onLogout, sound, onToggleSound }) {
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
              {item.nuevo && (
                <span
                  className="px-[6px] py-[1px] text-[9px] font-black"
                  style={{ backgroundColor: colors.magenta, color: colors.white, borderRadius: 6, letterSpacing: 0.5 }}
                >
                  NUEVO
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
