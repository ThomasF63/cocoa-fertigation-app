import { VARIABLES, type VariableKey } from "../../engine/variables";

export function VariablePicker({ value, onChange }: {
  value: VariableKey;
  onChange: (k: VariableKey) => void;
}) {
  return (
    <div className="plot-picker">
      <span className="muted mono" style={{ fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Variable
      </span>
      <select value={value} onChange={e => onChange(e.target.value as VariableKey)}>
        {VARIABLES.map(v => (
          <option key={v.key} value={v.key}>
            {v.label}{v.unit ? ` (${v.unit})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
