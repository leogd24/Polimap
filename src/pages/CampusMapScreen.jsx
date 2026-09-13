import { campusBuildings } from '../data/campusBuildings.js';
import RouteStop from '../components/RouteStop.jsx';
import SectionHeader from '../components/SectionHeader.jsx';

/// Equivalente de screens/campus_map_screen.dart
export default function CampusMapScreen({ onOpenBuilding }) {
  // El orden del recorrido lo marca el número del edificio, no el orden de
  // la lista: agregar edificios nuevos a los datos los acomoda solos.
  const route = [...campusBuildings].sort((a, b) => a.number - b.number);

  return (
    <div className="app-scroll flex-1 px-[18px] pt-3 pb-7">
      <div className="pb-5">
        <SectionHeader
          title="Recorrido del campus"
          subtitle={`Del edificio 1 al ${route.length}. Toca uno para ver su información.`}
        />
      </div>

      {route.map((building, index) => (
        <RouteStop
          key={building.number}
          building={building}
          isFirst={index === 0}
          isLast={index === route.length - 1}
          onTap={() => onOpenBuilding(building)}
        />
      ))}
    </div>
  );
}
