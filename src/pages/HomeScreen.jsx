import { colors, alpha } from '../styles/theme.js';
import { campusBuildings } from '../data/campusBuildings.js';
import SectionHeader from '../components/SectionHeader.jsx';
import QuickActionCard from '../components/QuickActionCard.jsx';
import NoticeCard from '../components/NoticeCard.jsx';
import FilledButton from '../components/FilledButton.jsx';

/// Equivalente de screens/home_screen.dart
export default function HomeScreen({ onNavigate, onOpenAssistant, onOpenBuilding }) {
  return (
    <div className="app-scroll flex-1 px-[18px] pt-3 pb-7">
      <div
        className="p-[22px]"
        style={{
          borderRadius: 'var(--radius-hero)',
          background: `linear-gradient(to bottom right, ${colors.blue}, ${colors.blueLight})`,
          boxShadow: `0 12px 25px ${alpha(colors.blue, 0.24)}`,
        }}
      >
        <span
          className="inline-block text-[11px] font-extrabold"
          style={{
            color: colors.white,
            letterSpacing: 1,
            padding: '5px 10px',
            borderRadius: 20,
            backgroundColor: alpha(colors.white, 0.14),
          }}
        >
          GUÍA DEL CAMPUS
        </span>
        <h2
          className="mt-[15px] mb-0 text-[27px]"
          style={{ color: colors.white, fontWeight: 900, lineHeight: 1.1 }}
        >
          ¿A dónde necesitas ir?
        </h2>
        <p
          className="mt-2 mb-0 text-[15px]"
          style={{ color: alpha(colors.white, 0.84), lineHeight: 1.4 }}
        >
          Encuentra edificios, servicios y respuestas sin perder tiempo.
        </p>
        <FilledButton
          onClick={onOpenAssistant}
          icon="search"
          background={colors.white}
          foreground={colors.blue}
          className="mt-[18px]"
          style={{ paddingLeft: 18, paddingRight: 18 }}
        >
          Pregúntale a POLIMAP
        </FilledButton>
      </div>

      <div className="mt-6">
        <SectionHeader title="Accesos rápidos" subtitle="Lo más utilizado por estudiantes" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <QuickActionCard icon="map" title="Ver mapa" color={colors.blue} onTap={() => onNavigate(1)} />
        <QuickActionCard
          icon="apartment"
          title="Edificios"
          color={colors.blue}
          onTap={() => onNavigate(2)}
        />
        <QuickActionCard
          icon="badge"
          title="Control Escolar"
          color={colors.crimson}
          onTap={() => onOpenBuilding(campusBuildings[5])}
        />
        <QuickActionCard
          icon="add_alert"
          title="Crear reporte"
          color={colors.gold}
          onTap={() => onNavigate(3)}
        />
      </div>

      <div className="mt-6">
        <SectionHeader title="Avisos importantes" subtitle="Información para la comunidad" />
      </div>

      <div className="mt-3">
        <NoticeCard
          icon="info"
          filled={false}
          title="Versión inicial de POLIMAP"
          body="Las ubicaciones y horarios se validarán con cada área del plantel."
          color={colors.blue}
        />
      </div>
      <div className="mt-[10px]">
        <NoticeCard
          icon="accessible_forward"
          title="Rutas accesibles"
          body="Consulta en cada edificio sus accesos y rutas recomendadas."
          color={colors.gold}
        />
      </div>
    </div>
  );
}
