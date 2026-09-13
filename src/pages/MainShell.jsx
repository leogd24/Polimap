import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import HomeScreen from './HomeScreen.jsx';
import CampusMapScreen from './CampusMapScreen.jsx';
import BuildingsScreen from './BuildingsScreen.jsx';
import ReportScreen from './ReportScreen.jsx';
import ScheduleScreen from './ScheduleScreen.jsx';
import BuildingDetailScreen from './BuildingDetailScreen.jsx';
import AssistantScreen from './AssistantScreen.jsx';

const titles = ['Inicio', 'Mapa del campus', 'Edificios', 'Reportar', 'Mi horario'];

const destinations = [
  { icon: 'home', label: 'Inicio' },
  { icon: 'map', label: 'Mapa' },
  { icon: 'apartment', label: 'Edificios' },
  { icon: 'add_alert', label: 'Reportar' },
  { icon: 'calendar_month', label: 'Horario' },
];

/// Equivalente de screens/main_shell.dart
export default function MainShell() {
  const [currentIndex, setCurrentIndex] = useState(0);
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
    <ReportScreen />,
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
          <div className="text-[11px] font-medium">Escuela Politécnica</div>
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
      </header>

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
                  backgroundColor: selected ? colors.gold : 'transparent',
                }}
              >
                <Icon
                  name={destination.icon}
                  filled={selected}
                  color={selected ? colors.blueDeep : alpha(colors.white, 0.75)}
                />
              </span>
              <span
                className="text-xs"
                style={{
                  fontWeight: selected ? 800 : 500,
                  color: selected ? colors.white : alpha(colors.white, 0.75),
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
    </div>
  );
}
