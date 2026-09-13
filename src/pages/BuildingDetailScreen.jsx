import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import Card, { Divider } from '../components/Card.jsx';
import DetailTitle from '../components/DetailTitle.jsx';
import InfoTile from '../components/InfoTile.jsx';
import MissingInfo from '../components/MissingInfo.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Snackbar from '../components/Snackbar.jsx';

/// Equivalente de screens/building_detail_screen.dart
export default function BuildingDetailScreen({ building, onBack }) {
  const [snackbar, setSnackbar] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Barra fija: al bajar toma el color del edificio y muestra el nombre. */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-2 transition-colors"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(60px + env(safe-area-inset-top))',
          backgroundColor: scrolled ? building.color : 'transparent',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Regresar"
          className="tappable flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44 }}
        >
          <Icon name="arrow_back" color={colors.white} />
        </button>
        {scrolled && (
          <span className="truncate font-black" style={{ color: colors.white }}>
            {building.name}
          </span>
        )}
      </div>

      <div
        className="app-scroll flex-1"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 190)}
      >
        {/* Cabecera de 245 px con degradado del color del edificio. */}
        <div
          className="relative overflow-hidden"
          style={{
            height: 245,
            background: `linear-gradient(to bottom right, ${building.color}, ${alpha(building.color, 0.72)})`,
          }}
        >
          <div style={{ position: 'absolute', right: -25, bottom: -20 }}>
            <Icon name={building.icon} size={210} color={alpha(colors.white, 0.12)} />
          </div>
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: 24,
              top: 95,
              width: 68,
              height: 68,
              borderRadius: 21,
              backgroundColor: colors.white,
            }}
          >
            <Icon name={building.icon} size={34} color={building.color} />
          </div>
          <div
            className="absolute text-2xl font-black"
            style={{ left: 24, bottom: 16, right: 24, color: colors.white }}
          >
            {building.name}
          </div>
        </div>

        <div className="px-[18px] pt-5 pb-8">
          <div className="font-black" style={{ color: building.color }}>
            Edificio {building.number}
          </div>

          <div className="mt-[6px]">
            {building.description === '' ? (
              <MissingInfo />
            ) : (
              <p
                className="m-0 text-base"
                style={{ lineHeight: 1.45, color: colors.textSecondary }}
              >
                {building.description}
              </p>
            )}
          </div>

          <div className="mt-[22px]">
            <DetailTitle icon="room_service" title="Servicios" />
          </div>
          <div className="mt-[10px]">
            {building.services.length === 0 ? (
              <MissingInfo />
            ) : (
              <div className="flex flex-wrap gap-2">
                {building.services.map((service) => (
                  <span
                    key={service}
                    className="inline-flex items-center gap-[6px] px-3 py-[6px] text-sm"
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${alpha(building.color, 0.18)}`,
                      backgroundColor: alpha(building.color, 0.07),
                    }}
                  >
                    <Icon name="check_circle" size={17} color={building.color} />
                    {service}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-[22px]">
            <DetailTitle icon="layers" title="Espacios" />
          </div>
          <div className="mt-2">
            {building.spaces.length === 0 ? (
              <MissingInfo />
            ) : (
              <Card>
                {building.spaces.map((space, index) => (
                  <div key={space}>
                    <div className="flex items-center px-4 py-3">
                      <div
                        className="flex shrink-0 items-center justify-center rounded-full"
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: alpha(building.color, 0.1),
                          color: building.color,
                        }}
                      >
                        {index + 1}
                      </div>
                      <span className="ml-4">{space}</span>
                    </div>
                    {index < building.spaces.length - 1 && <Divider indent={72} />}
                  </div>
                ))}
              </Card>
            )}
          </div>

          {building.procedures.length > 0 && (
            <>
              <div className="mt-[22px]">
                <DetailTitle icon="assignment_turned_in" title="Trámites y requisitos" />
              </div>
              <div className="mt-2">
                <Card>
                  {building.procedures.map((procedure, index) => (
                    <div key={procedure.name}>
                      <div className="px-4 py-[14px]">
                        <div className="font-extrabold" style={{ color: building.color }}>
                          {procedure.name}
                        </div>
                        <div
                          className="mt-1"
                          style={{ color: colors.textSecondary, lineHeight: 1.4 }}
                        >
                          {procedure.details}
                        </div>
                      </div>
                      {index < building.procedures.length - 1 && (
                        <Divider indent={16} endIndent={16} />
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            </>
          )}

          <div className="mt-[18px]">
            <InfoTile
              icon="schedule"
              title="Horario de atención"
              body={building.hours === '' ? 'Sin información' : building.hours}
              color={building.color}
            />
          </div>
          <div className="mt-[10px]">
            <InfoTile
              icon="accessible_forward"
              title="Accesibilidad"
              body={building.accessibility === '' ? 'Sin información' : building.accessibility}
              color={building.color}
            />
          </div>

          <div className="mt-5">
            <FilledButton
              onClick={() => setSnackbar(true)}
              icon="directions_walk"
              background={building.color}
              className="w-full"
              style={{ height: 54 }}
            >
              Cómo llegar
            </FilledButton>
          </div>
        </div>
      </div>

      {snackbar && (
        <Snackbar
          message="Ruta preparada. Se conectará al mapa oficial del campus."
          onDismiss={() => setSnackbar(false)}
        />
      )}
    </div>
  );
}
