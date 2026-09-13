import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Equivalente de widgets/empty_state.dart
export default function EmptyState({ icon, title, body, filled = false }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center p-8">
        <Icon name={icon} size={62} filled={filled} color={colors.textMuted} />
        <h3 className="m-0 mt-[14px] text-xl font-black">{title}</h3>
        <p
          className="m-0 mt-[6px] text-center"
          style={{ color: colors.textSecondary, lineHeight: 1.4 }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
