import { useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import Card, { Divider } from '../components/Card.jsx';
import DetailTitle from '../components/DetailTitle.jsx';
import InfoTile from '../components/InfoTile.jsx';
import MissingInfo from '../components/MissingInfo.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Snackbar from '../components/Snackbar.jsx';
import EdificioPorDentro from '../components/EdificioPorDentro.jsx';

/// Equivalente de screens/building_detail_screen.dart
/// salon (Alexis): id del salón a resaltar en "Por dentro" (ej. 'A05'), opcional.
export default function BuildingDetailScreen({ building, onBack, salon = null }) {
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
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 110)}
      >
        {/* Cabecera sencilla con el color del edificio. */}
        <div
          className="flex items-end gap-4 px-6 pb-5"
          style={{
            paddingTop: 'calc(72px + env(safe-area-inset-top))',
            backgroundColor: building.color,
          }}
        >
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.white }}
          >
            <Icon name={building.icon} size={30} color={building.color} />
          </div>
          <div className="min-w-0" style={{ color: colors.white }}>
            <div className="text-sm font-bold" style={{ opacity: 0.85 }}>
              Edificio {building.number}
            </div>
            <div className="text-2xl font-black leading-tight">{building.name}</div>
          </div>
        </div>

        <div className="px-[18px] pt-5 pb-8">
          {building.description === '' ? (
            <MissingInfo />
          ) : (
            <p className="m-0 text-base" style={{ lineHeight: 1.45, color: colors.textSecondary }}>
              {building.description}
            </p>
          )}

          {/* Qué hay aquí: lista simple de espacios */}
          {building.spaces.length > 0 && (
            <>
              <div className="mt-6">
                <DetailTitle icon="layers" title="Qué hay aquí" />
              </div>
              <ul className="m-0 mt-2 list-none p-0">
                {building.spaces.map((space) => (
                  <li
                    key={space}
                    className="flex items-center gap-3 py-[10px]"
                    style={{ borderBottom: `1px solid ${colors.border}` }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: building.color }} />
                    <span>{space}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Trámites y requisitos (ya incluyen los servicios) */}
          {building.procedures.length > 0 && (
            <>
              <div className="mt-6">
                <DetailTitle icon="assignment_turned_in" title="Trámites y requisitos" />
              </div>
              <div className="mt-2">
                <Card>
                  {building.procedures.map((procedure, index) => (
                    <div key={procedure.name}>
                      <div className="px-4 py-[14px]">
                        <div className="font-extrabold" style={{ color: colors.textPrimary }}>
                          {procedure.name}
                        </div>
                        <div className="mt-1 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
                          {procedure.details}
                        </div>
                      </div>
                      {index < building.procedures.length - 1 && <Divider indent={16} endIndent={16} />}
                    </div>
                  ))}
                </Card>
              </div>
            </>
          )}

          {/* Servicios: solo si no vienen ya como trámites */}
          {building.procedures.length === 0 && building.services.length > 0 && (
            <>
              <div className="mt-6">
                <DetailTitle icon="room_service" title="Servicios" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {building.services.map((service) => (
                  <span
                    key={service}
                    className="px-3 py-[6px] text-sm"
                    style={{ borderRadius: 8, backgroundColor: alpha(building.color, 0.08) }}
                  >
                    {service}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Por dentro: el esquema con tu salón resaltado (Alexis) */}
          <div className="mt-6">
            <DetailTitle icon="domain" title="Por dentro" />
          </div>
          <div className="mt-[10px]">
            <EdificioPorDentro number={building.number} salon={salon} />
          </div>

          {/* Horario y accesibilidad: solo cuando hay datos */}
          {building.hours !== '' && (
            <div className="mt-[18px]">
              <InfoTile icon="schedule" title="Horario de atención" body={building.hours} color={building.color} />
            </div>
          )}
          {building.accessibility !== '' && (
            <div className="mt-[10px]">
              <InfoTile icon="accessible_forward" title="Accesibilidad" body={building.accessibility} color={building.color} />
            </div>
          )}

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
