import { campusBuildings } from '../data/campusBuildings.js';
import CampusMap from '../components/CampusMap.jsx';

/// Pestaña "Mapa": muestra el mapa interactivo del campus (Marcos).
/// Props:
///   onOpenBuilding → abre la ficha completa de un edificio.
///   focus          → (opcional) edificio a enfocar, lo manda MainShell
///                    cuando tocan "Ver en el mapa" en el asistente.
///                    Forma: { number: 3, vez: 1 } (ver CampusMap.jsx, paso 5.2).
export default function CampusMapScreen({ onOpenBuilding, focus = null }) {
  // El mapa nos da solo el NÚMERO del edificio que tocaste.
  // Aquí buscamos el edificio completo en los datos para abrir su ficha,
  // porque así es como lo espera onOpenBuilding.
  const abrirFicha = (numero) => {
    const edificio = campusBuildings.find((b) => b.number === numero);
    if (edificio) onOpenBuilding(edificio);
  };

  return (
    // flex-1 + min-h-0: el mapa ocupa todo el espacio libre de la pantalla
    // (arriba de la barra de navegación de abajo).
    <div className="relative flex-1 min-h-0">
      <CampusMap alto="100%" onOpenBuilding={abrirFicha} focusNumber={focus} />
    </div>
  );
}
