// src/components/AparienciaSheet.jsx — Responsable: Alexis
// Hoja "Apariencia y accesibilidad" (botón con el ícono de contraste arriba):
//   - Tema: Automático (como el celular) / Claro / Oscuro.
//   - Tamaño de letra: Normal / Grande / Muy grande.
//   - Alto contraste y Menos movimiento.
// Se guarda en el celular (src/lib/tema.js).
//
// Props: open, onClose, prefs, onCambiar(cambios)
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import BottomSheet from './BottomSheet.jsx';
import { Switch } from './Inputs.jsx';

const TEMAS = [
  { value: 'auto', label: 'Automático', icon: 'brightness_auto', texto: 'Como tu celular' },
  { value: 'claro', label: 'Claro', icon: 'light_mode', texto: 'Fondo blanco' },
  { value: 'oscuro', label: 'Oscuro', icon: 'dark_mode', texto: 'Cansa menos de noche' },
];
const LETRAS = [
  { value: 'normal', label: 'Normal', muestra: 15 },
  { value: 'grande', label: 'Grande', muestra: 18 },
  { value: 'muy-grande', label: 'Muy grande', muestra: 21 },
];

export default function AparienciaSheet({ open, onClose, prefs, onCambiar, subtitulo = 'Se guarda en este celular.' }) {
  return (
    <BottomSheet open={open} onClose={onClose} icon="contrast" title="Apariencia y accesibilidad" subtitle={subtitulo}>
      <Grupo titulo="Tema">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
          {TEMAS.map((t) => (
            <Opcion key={t.value} activo={prefs.tema === t.value} onClick={() => onCambiar({ tema: t.value })}>
              <Icon name={t.icon} size={26} color={prefs.tema === t.value ? colors.ink : colors.textSecondary} />
              <span className="text-sm font-black">{t.label}</span>
              <span className="text-[0.6875rem]" style={{ color: colors.textMuted }}>
                {t.texto}
              </span>
            </Opcion>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Tamaño de letra">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamaño de letra">
          {LETRAS.map((l) => (
            <Opcion key={l.value} activo={prefs.letra === l.value} onClick={() => onCambiar({ letra: l.value })}>
              {/* La muestra va en px para que se vea la diferencia aunque ya esté grande */}
              <span className="font-black leading-none" style={{ fontSize: l.muestra * 1.5 }} aria-hidden>
                Aa
              </span>
              <span className="text-sm font-black">{l.label}</span>
            </Opcion>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Más opciones">
        <Fila icon="contrast" titulo="Alto contraste" texto="Textos y bordes más marcados." valor={prefs.contraste === 'alto'} onCambiar={(v) => onCambiar({ contraste: v ? 'alto' : 'normal' })} />
        <Fila icon="motion_photos_off" titulo="Menos movimiento" texto="Sin animaciones (también si tu celular lo pide)." valor={prefs.movimiento === 'reducido'} onCambiar={(v) => onCambiar({ movimiento: v ? 'reducido' : 'normal' })} />
      </Grupo>
      <EnlacePrivacidad />
    </BottomSheet>
  );
}

function Grupo({ titulo, children }) {
  return (
    <section className="mb-4">
      <h3 className="m-0 mb-2 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
        {titulo}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Opcion({ activo, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className="tappable flex min-h-[96px] flex-col items-center justify-center gap-1 p-2 text-center"
      style={{
        borderRadius: 16,
        border: `2px solid ${activo ? colors.ink : colors.border}`,
        backgroundColor: activo ? alpha(colors.ink, 0.08) : colors.surface,
        color: colors.textPrimary,
      }}
    >
      {children}
    </button>
  );
}

function Fila({ icon, titulo, texto, valor, onCambiar }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
      <Icon name={icon} size={22} color={colors.textSecondary} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black">{titulo}</div>
        <div className="text-xs" style={{ color: colors.textSecondary }}>
          {texto}
        </div>
      </div>
      <Switch value={valor} onChange={onCambiar} label={titulo} />
    </div>
  );
}

/** Enlace al aviso de privacidad (public/privacidad.html). */
export function EnlacePrivacidad() {
  return (
    <a
      href="/privacidad.html"
      className="tappable flex min-h-[52px] items-center gap-3 px-4 text-sm font-bold no-underline"
      style={{ backgroundColor: colors.background, color: colors.textPrimary, borderRadius: 16, border: `1px solid ${colors.border}` }}
    >
      <Icon name="privacy_tip" color={colors.cyanDark} />
      <span className="min-w-0 flex-1">
        Aviso de privacidad
        <span className="block text-xs font-normal" style={{ color: colors.textSecondary }}>
          Qué datos usa POLIMAP y para qué.
        </span>
      </span>
      <Icon name="chevron_right" color={colors.textSecondary} />
    </a>
  );
}
