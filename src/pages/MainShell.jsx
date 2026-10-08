import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import BrandStripe from '../components/BrandStripe.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
import HomeScreen from './HomeScreen.jsx';
import CampusMapScreen from './CampusMapScreen.jsx';
import BuildingsScreen from './BuildingsScreen.jsx';
import ReportScreen from './ReportScreen.jsx';
import ScheduleScreen from './ScheduleScreen.jsx';
import BuildingDetailScreen from './BuildingDetailScreen.jsx';
import AssistantScreen from './AssistantScreen.jsx';
import LoginRequired from '../components/LoginRequired.jsx';

const titles = ['Inicio', 'Mapa del campus', 'Edificios', 'Reportar', 'Mi horario'];

// Cada pestaña tiene un color de la Paleta Oficial del Politécnico.
//   accent: color oficial (fondo de la pastilla cuando está seleccionada)
//   onDark: versión legible como texto/ícono sobre la barra noche (≥ 4.5:1)
const destinations = [
  { icon: 'home', label: 'Inicio', accent: colors.cyan, onDark: colors.cyan },
  { icon: 'map', label: 'Mapa', accent: colors.green, onDark: colors.green },
  { icon: 'apartment', label: 'Edificios', accent: colors.gold, onDark: colors.gold },
  { icon: 'add_alert', label: 'Reportar', accent: colors.crimson, onDark: colors.crimsonLight },
  { icon: 'calendar_month', label: 'Horario', accent: colors.magenta, onDark: colors.magentaLight },
];

/// Equivalente de screens/main_shell.dart
/// Props (login, Alexis):
///   user           usuario con sesión, o null si es invitado
///   onLogout       cerrar sesión
///   onRequestLogin abrir el inicio de sesión (invitado que quiere reportar)
export default function MainShell({ user, onLogout, onRequestLogin }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  // Pila de pantallas que se apilan sobre el shell (detalle y asistente).
  const [stack, setStack] = useState([]);

  const openAssistant = () => setStack((previous) => [...previous, { type: 'assistant' }]);
  const openBuilding = (building) => setStack((previous) => [...previous, { type: 'detail', building }]);
  const pop = () => setStack((previous) => previous.slice(0, -1));

  // IndexedStack: las cinco pantallas se mantienen montadas y conservan su estado.
  const pages = [
    <HomeScreen onNavigate={setCurrentIndex} onOpenAssistant={openAssistant} onOpenBuilding={openBuilding} />,
    <CampusMapScreen onOpenBuilding={openBuilding} />,
    <BuildingsScreen onOpenBuilding={openBuilding} />,
    // Reportar es lo único que pide cuenta: el invitado ve por qué y cómo entrar.
    user ? <ReportScreen user={user} /> : <LoginRequired onLogin={onRequestLogin} />,
    <ScheduleScreen />,
  ];

  const top = stack[stack.length - 1];

  return (
    <div className="flex h-[100dvh] flex-col" style={{ backgroundColor: colors.background }}>
      <header
        className="flex shrink-0 items-center pl-5 pr-3"
        style={{
          backgroundColor: colors.blue,
          color: colors.white,
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(64px + env(safe-area-inset-top))',
        }}
      >
        <PolimapLogo size={38} />
        <div className="ml-3 min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold">{titles[currentIndex]}</div>
          <div className="text-[11px] font-medium">
            Escuela Politécnica{user ? '' : ' · Invitado'}
          </div>
        </div>
        <button
          type="button"
          onClick={openAssistant}
          title="Asistente de consultas"
          aria-label="Asistente de consultas"
          className="tappable flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, backgroundColor: alpha(colors.white, 0.16) }}
        >
          <Icon name="chat_bubble" filled={false} color={colors.white} />
        </button>
        {/* Invitado: botón para iniciar sesión */}
        {!user && (
          <button
            type="button"
            onClick={onRequestLogin}
            title="Iniciar sesión"
            aria-label="Iniciar sesión"
            className="tappable ml-2 flex h-10 items-center gap-1 rounded-full border-0 px-3 text-sm font-bold"
            style={{ backgroundColor: alpha(colors.white, 0.16), color: colors.white }}
          >
            <Icon name="login" size={20} color={colors.white} />
            <span className="hidden min-[380px]:inline">Entrar</span>
          </button>
        )}
        {/* Foto de la cuenta de Google: abre la hoja con "Cerrar sesión" */}
        {user && (
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            title="Tu cuenta"
            aria-label="Tu cuenta"
            className="tappable ml-2 flex items-center justify-center rounded-full border-0 bg-transparent p-0"
            style={{ width: 44, height: 44 }}
          >
            <UserAvatar user={user} size={36} ring={alpha(colors.white, 0.7)} />
          </button>
        )}
      </header>
      {/* Franja con los 5 colores oficiales del Politécnico */}
      <BrandStripe height={4} />

      <main className="relative min-h-0 flex-1">
        {pages.map((page, index) => (
          <div
            key={index}
            className="absolute inset-0 flex flex-col"
            style={{ display: index === currentIndex ? 'flex' : 'none' }}
          >
            {page}
          </div>
        ))}
      </main>

      <nav
        className="flex shrink-0 items-stretch"
        style={{
          backgroundColor: colors.blue,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {destinations.map((destination, index) => {
          const selected = index === currentIndex;
          return (
            <button
              key={destination.label}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className="flex flex-1 flex-col items-center gap-1 pt-3 pb-2"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span
                className="flex items-center justify-center transition-colors"
                style={{
                  width: 56,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: selected ? destination.accent : 'transparent',
                }}
              >
                <Icon
                  name={destination.icon}
                  filled={selected}
                  color={selected ? colors.blue : destination.onDark}
                />
              </span>
              <span
                className="text-xs"
                style={{
                  fontWeight: selected ? 800 : 500,
                  color: selected ? colors.white : destination.onDark,
                }}
              >
                {destination.label}
              </span>
            </button>
          );
        })}
      </nav>

      {top && top.type === 'detail' && (
        <BuildingDetailScreen building={top.building} onBack={pop} />
      )}
      {top && top.type === 'assistant' && <AssistantScreen onBack={pop} />}

      {accountOpen && (
        <AccountSheet user={user} onClose={() => setAccountOpen(false)} onLogout={onLogout} />
      )}
    </div>
  );
}
