import { useEffect, useState } from "react";
import {
  VARIABLES,
  VARIABLE_CATEGORIES,
  variableDef,
  type VariableCategory,
  type VariableKey,
} from "../../engine/variables";

export function VariablePicker({ value, onChange }: {
  value: VariableKey;
  onChange: (k: VariableKey) => void;
}) {
  const [activeCat, setActiveCat] = useState<VariableCategory>(
    () => variableDef(value).category
  );

  // Keep the visible category in sync when the selected variable changes from
  // outside (e.g. deep-link or reset), so the active card is always on-screen.
  useEffect(() => {
    setActiveCat(variableDef(value).category);
  }, [value]);

  const visible = VARIABLES.filter(v => v.category === activeCat);

  return (
    <div className="variable-picker">
      <div className="picker-tabs" role="tablist" aria-label="Variable categories">
        {VARIABLE_CATEGORIES.map(c => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={activeCat === c.key}
            className="picker-tab"
            data-active={activeCat === c.key}
            onClick={() => setActiveCat(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="picker-grid variable-grid" role="tabpanel">
        {visible.map(v => {
          const selected = value === v.key;
          return (
            <button
              key={v.key}
              type="button"
              className="picker-card variable-card"
              data-active={selected}
              aria-pressed={selected}
              onClick={() => onChange(v.key)}
            >
              <span className="picker-card-label">{v.label}</span>
              {v.unit && <span className="picker-card-unit mono">{v.unit}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
