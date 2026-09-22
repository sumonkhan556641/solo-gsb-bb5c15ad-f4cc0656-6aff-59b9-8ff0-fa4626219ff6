interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  invalid?: boolean;
  disabled?: boolean;
  width?: number;
}

/** 受控数字输入：保留原始字符串以容忍中间编辑态，非法值由上层校验标红 */
export default function NumberField({
  label,
  value,
  onChange,
  invalid = false,
  disabled = false,
  width = 72,
}: NumberFieldProps) {
  return (
    <label className={`number-field${invalid ? ' invalid' : ''}`}>
      <span className="number-field-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        style={{ width }}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
