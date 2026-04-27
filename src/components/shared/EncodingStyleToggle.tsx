import { ENCODING_MODES, type EncodingMode } from "../../utils/palette";
import { useEncodingMode } from "../../hooks/useEncodingMode";

// Compact selector for the genotype-encoding style. Placed in a corner of
// each view that renders plot tiles so the user can compare options live.
export function EncodingStyleToggle({
  variant = "select",
}: { variant?: "select" | "chips" }) {
  const { mode, setMode } = useEncodingMode();

  if (variant === "chips") {
    return (
      <div
        role="group"
        aria-label="Genotype encoding style"
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          gap: 4,
          padding: 3,
          border: "1px solid var(--panel-border)",
          borderRadius: "var(--radius-control)",
          background: "var(--panel-bg)",
        }}
      >
        {ENCODING_MODES.map(opt => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              title={opt.hint}
              aria-pressed={active}
              style={{
                padding: "3px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.68rem",
                letterSpacing: "0.04em",
                borderRadius: 4,
                border: "none",
                background: active ? "var(--ek-soil)" : "transparent",
                color: active ? "var(--ek-root)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <label
      className="row"
      style={{
        gap: 6,
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: "0.68rem",
        color: "var(--text-secondary)",
        padding: "3px 6px 3px 8px",
        border: "1px solid var(--panel-border)",
        borderRadius: "var(--radius-control)",
        background: "var(--panel-bg)",
      }}
      title="Encoding style for genotype (dose always uses the orange fill ramp)"
    >
      <span style={{
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
      }}>
        Genotype
      </span>
      <select
        value={mode}
        onChange={e => setMode(e.target.value as EncodingMode)}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.72rem",
          padding: "2px 4px",
          border: "1px solid var(--panel-border)",
          borderRadius: 4,
          background: "var(--panel-bg)",
          color: "var(--text-primary)",
        }}
      >
        {ENCODING_MODES.map(opt => (
          <option key={opt.value} value={opt.value} title={opt.hint}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
