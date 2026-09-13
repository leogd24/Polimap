import { colors } from '../styles/theme.js';

/// Equivalente de widgets/form_label.dart
export default function FormLabel({ number, label }) {
  return (
    <div className="flex items-center">
      <div
        className="flex items-center justify-center rounded-full text-xs font-black"
        style={{ width: 28, height: 28, backgroundColor: colors.blue, color: colors.white }}
      >
        {number}
      </div>
      <span className="ml-[9px] text-[17px] font-black">{label}</span>
    </div>
  );
}
