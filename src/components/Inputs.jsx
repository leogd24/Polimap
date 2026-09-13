import { useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';

/// Réplica del `inputDecorationTheme` de Flutter: relleno blanco,
/// borde de 1 px y borde azul de 1.5 px al enfocar.
function fieldStyle(focused) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 'var(--radius-input)',
    border: focused ? `1.5px solid ${colors.blue}` : `1px solid ${colors.border}`,
    // Compensa el grosor extra del borde enfocado para que no salte el alto.
    padding: focused ? '0.5px' : '1px',
  };
}

export function TextField({ value, onChange, placeholder, prefixIcon, suffix, filled = true }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex items-center" style={fieldStyle(focused)}>
      {prefixIcon && (
        <span className="pl-3">
          <Icon name={prefixIcon} filled={filled} color={colors.textSecondary} />
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="min-w-0 flex-1 bg-transparent px-3 py-4 outline-none placeholder:text-[color:var(--color-text-muted)]"
      />
      {suffix}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, minRows = 4, maxLength, error }) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <div style={{ ...fieldStyle(focused), border: error ? `1.5px solid ${colors.crimson}` : fieldStyle(focused).border }}>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent px-4 py-4 outline-none placeholder:text-[color:var(--color-text-muted)]"
        />
      </div>
      <div className="flex items-start justify-between px-4 pt-1">
        <span className="text-xs" style={{ color: colors.crimson }}>
          {error || ''}
        </span>
        {maxLength && (
          <span className="shrink-0 pl-3 text-xs" style={{ color: colors.textSecondary }}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

/// Equivalente del DropdownButtonFormField.
export function SelectField({
  value,
  onChange,
  placeholder,
  prefixIcon,
  options,
  disabled = false,
  error,
}) {
  const [focused, setFocused] = useState(false);
  const style = fieldStyle(focused);

  return (
    <div>
      <div
        className="flex items-center"
        style={{
          ...style,
          border: error ? `1.5px solid ${colors.crimson}` : style.border,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {prefixIcon && (
          <span className="pl-3">
            <Icon name={prefixIcon} filled={false} color={colors.textSecondary} />
          </span>
        )}
        <select
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="min-w-0 flex-1 appearance-none bg-transparent px-3 py-4 text-[13px] outline-none"
          style={{ color: value ? colors.textPrimary : colors.textMuted }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} style={{ color: colors.textPrimary }}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pr-3">
          <Icon name="arrow_drop_down" color={colors.textSecondary} />
        </span>
      </div>
      {error && (
        <div className="px-4 pt-1 text-xs" style={{ color: colors.crimson }}>
          {error}
        </div>
      )}
    </div>
  );
}

/// Equivalente del `switchTheme`: pulgar blanco sobre pista dorada al activar.
export function Switch({ value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="relative shrink-0 transition-colors"
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        backgroundColor: value ? colors.gold : colors.blueTint,
        border: `2px solid ${value ? colors.gold : colors.border}`,
      }}
    >
      <span
        className="absolute top-1/2 block transition-all"
        style={{
          width: value ? 24 : 16,
          height: value ? 24 : 16,
          borderRadius: '50%',
          backgroundColor: value ? colors.white : colors.textMuted,
          left: value ? 22 : 6,
          transform: 'translateY(-50%)',
        }}
      />
    </button>
  );
}
