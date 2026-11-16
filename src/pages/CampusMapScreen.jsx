import { campusBuildings } from '../data/campusBuildings.js';
import { colors } from '../styles/theme.js';
import CampusMap from '../components/CampusMap.jsx';

/// Pestaña "Mapa": muestra el mapa interactivo del campus (Marcos).
// focus → { number, vez } que manda MainShell cuando el asistente pide "Ver en el mapa".
// onNavigate(indice) → abre Reportar (3) u Horario (4) desde los
// botones flotantes del mapa (los mismos íconos y colores que en Inicio).
export default function CampusMapScreen({ onOpenBuilding, focus, onNavigate }) {
  // El mapa nos da solo el NÚMERO del edificio que tocaste.
  // Aquí buscamos el edificio completo en los datos para abrir su ficha,
  // porque así es como lo espera onOpenBuilding.
  const abrirFicha = (numero) => {
    const edificio = campusBuildings.find((b) => b.number === numero);
    if (edificio) onOpenBuilding(edificio);
  };

  const accesos = onNavigate
    ? [
        { icon: 'calendar_month', label: 'Horario', color: colors.magentaDark, onTap: () => onNavigate(4) },
        { icon: 'add_alert', label: 'Reportar', color: colors.crimsonDark, onTap: () => onNavigate(3) },
      ]
    : [];

  return (
    // flex-1 + min-h-0: el mapa ocupa todo el espacio libre de la pantalla
    // (arriba de la barra de navegación de abajo).
    <div className="relative flex-1 min-h-0">
      <CampusMap
        alto="100%"
        onOpenBuilding={abrirFicha}
        focusNumber={focus?.number ?? null}
        focusKey={focus?.vez}
        accesos={accesos}
      />
    </div>
  );
}
