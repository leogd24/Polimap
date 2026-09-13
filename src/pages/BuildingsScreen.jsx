import { useState } from 'react';
import { campusBuildings } from '../data/campusBuildings.js';
import BuildingCard from '../components/BuildingCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TextField } from '../components/Inputs.jsx';

/// Equivalente de screens/buildings_screen.dart
export default function BuildingsScreen({ onOpenBuilding }) {
  const [query, setQuery] = useState('');

  const normalized = query.toLowerCase().trim();
  const results = campusBuildings.filter(
    (building) =>
      normalized === '' ||
      building.name.toLowerCase().includes(normalized) ||
      building.services.some((service) => service.toLowerCase().includes(normalized))
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-[18px] pt-3 pb-3">
        <TextField
          value={query}
          onChange={setQuery}
          placeholder="Buscar edificio o servicio"
          prefixIcon="search"
        />
      </div>

      {results.length === 0 ? (
        <div className="flex-1">
          <EmptyState
            icon="search_off"
            title="Sin resultados"
            body="Prueba con “kardex”, “psicología” o “biblioteca”."
          />
        </div>
      ) : (
        <div className="app-scroll flex-1 px-[18px] pt-1 pb-7">
          <div className="grid grid-cols-2 gap-3">
            {results.map((building) => (
              <BuildingCard
                key={building.number}
                building={building}
                onTap={() => onOpenBuilding(building)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
