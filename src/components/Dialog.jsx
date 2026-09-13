import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import FilledButton from './FilledButton.jsx';

/// Equivalente del AlertDialog de Material usado al enviar un reporte.
export default function Dialog({ icon, title, content, actionLabel, onAction }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: alpha('#000000', 0.45) }}
    >
      <div
        className="w-full max-w-[320px] p-6"
        style={{ backgroundColor: colors.surface, borderRadius: 28 }}
      >
        {icon && (
          <div className="flex justify-center">
            <Icon name={icon} size={52} color={colors.blue} />
          </div>
        )}
        <h3 className="mt-4 mb-0 text-center text-xl font-bold">{title}</h3>
        <p className="mt-3 mb-0 text-center" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
          {content}
        </p>
        <div className="mt-6 flex justify-end">
          <FilledButton onClick={onAction}>{actionLabel}</FilledButton>
        </div>
      </div>
    </div>
  );
}
