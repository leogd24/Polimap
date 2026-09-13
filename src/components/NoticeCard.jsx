import { colors, alpha } from '../styles/theme.js';
import Card from './Card.jsx';
import Icon from './Icon.jsx';

/// Equivalente de widgets/notice_card.dart
export default function NoticeCard({ icon, title, body, color, filled = true }) {
  return (
    <Card>
      <div className="flex items-start p-4">
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: alpha(color, 0.12) }}
        >
          <Icon name={icon} color={color} filled={filled} />
        </div>
        <div className="ml-[13px] min-w-0">
          <div className="font-extrabold">{title}</div>
          <div className="mt-1" style={{ color: colors.textSecondary, lineHeight: 1.35 }}>
            {body}
          </div>
        </div>
      </div>
    </Card>
  );
}
