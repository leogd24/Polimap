import { colors, alpha } from '../styles/theme.js';
import Card from './Card.jsx';
import Icon from './Icon.jsx';

/// Equivalente de widgets/info_tile.dart
export default function InfoTile({ icon, title, body, color }) {
  return (
    <Card>
      <div className="flex items-center p-4">
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: alpha(color, 0.1) }}
        >
          <Icon name={icon} color={color} />
        </div>
        <div className="ml-[13px] min-w-0">
          <div className="font-extrabold">{title}</div>
          <div className="mt-[3px]" style={{ color: colors.textSecondary }}>
            {body}
          </div>
        </div>
      </div>
    </Card>
  );
}
