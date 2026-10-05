import { campusBuildings } from '../data/campusBuildings.js';
import CampusMap from '../components/CampusMap.jsx';

/// Pestaña "Mapa": muestra el mapa interactivo del campus (Marcos).
export default function CampusMapScreen({ onOpenBuilding }) {
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
      <CampusMap alto="100%" onOpenBuilding={abrirFicha} />
    </div>
  );
}