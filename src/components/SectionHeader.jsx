import { colors } from '../styles/theme.js';

/// Equivalente de widgets/section_header.dart
export default function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="m-0 text-[22px] font-black leading-tight">{title}</h2>
      <p className="m-0 mt-[2px] text-sm" style={{ color: colors.textSecondary }}>
        {subtitle}
      </p>
    </div>
  );
}
