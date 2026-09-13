import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Equivalente de widgets/detail_title.dart
export default function DetailTitle({ icon, title }) {
  return (
    <div className="flex items-center">
      <Icon name={icon} size={21} color={colors.blue} />
      <span className="ml-2 text-lg font-black">{title}</span>
    </div>
  );
}
