// src/components/AccountSheet.jsx — Responsable: Alexis
// Hoja que sube desde abajo al tocar la foto del usuario en el encabezado:
// nombre, correo, tipo de cuenta, acceso al panel (si es admin) y cerrar sesión.
//
// Props: user, onClose, onLogout
import { colors, alpha } from '../styles/theme.js';
import Card from './Card.jsx';
import Icon from './Icon.jsx';
import UserAvatar from './UserAvatar.jsx';
import FilledButton from './FilledButton.jsx';

const TIPOS = {
  alumno: 'Alumno',
  prueba: 'Cuenta de prueba',
  admin: 'Administrador',
  maestro: 'Administrador maestro',
};

export default function AccountSheet({ user, onClose, onLogout }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: alpha('#000000', 0.45) }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] p-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tu cuenta"
      >
        <Card style={{ borderRadius: 28 }}>
          <div className="flex items-center gap-4 p-5">
            <UserAvatar user={user} size={56} ring={colors.border} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-black">{user.nombre || 'Sin nombre'}</div>
              <div className="truncate text-sm" style={{ color: colors.textSecondary }}>
                {user.correo}
              </div>
              <span
                className="mt-1 inline-block px-2 py-[2px] text-xs font-bold"
                style={{ backgroundColor: colors.cyanTint, color: colors.cyanDark, borderRadius: 8 }}
              >
                {TIPOS[user.tipo] ?? user.tipo}
              </span>
            </div>
          </div>

          <div className="grid gap-2 px-5 pb-5">
            {user.permisos?.admin && (
              <a
                href="/admin.html"
                className="tappable flex min-h-[52px] items-center gap-3 px-4 font-bold no-underline"
                style={{ backgroundColor: colors.background, color: colors.textPrimary, borderRadius: 16 }}
              >
                <Icon name="admin_panel_settings" color={colors.blue} />
                Abrir panel de administración
              </a>
            )}
            <FilledButton icon="logout" onClick={onLogout} className="w-full">
              Cerrar sesión
            </FilledButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
