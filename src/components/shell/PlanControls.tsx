import { useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import {
  DOSE_N_KG_HA_YR,
  GENOTYPE_LABELS,
  type DepthLayer,
  type DoseCode,
  type GenotypeCode,
} from "../../types/design";
import {
  ALL_GENOTYPES,
  ALL_DOSES,
  DEPTH_SCHEMES,
  maxBdBlocks,
  type DepthScheme,
} from "../../types/plan";
import { usePlan } from "../../hooks/usePlan";

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: "0.62rem",
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--text-secondary)", marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function CheckChip({
  label, checked, onChange, color, genotype, doseLevel,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  /** Generic accent colour, used when no genotype/doseLevel is supplied. */
  color?: string;
  /** Treatment-factor variants — drive the same data attributes as the
      descriptive-table filter chips so the two stay visually aligned. */
  genotype?: GenotypeCode;
  doseLevel?: DoseCode;
}) {
  const style = color && !genotype && !doseLevel
    ? ({ "--chip-accent": color } as CSSProperties)
    : undefined;
  return (
    <label
      className="filter-chip mono"
      data-active={checked}
      data-geno={genotype}
      data-dose-level={doseLevel}
      style={style}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

const DEPTH_COLORS = [
  "var(--ek-depth-1)",
  "var(--ek-depth-2)",
  "var(--ek-depth-3)",
  "var(--ek-depth-4)",
];

function DepthProfileDiagram({ layers }: { layers: DepthLayer[] }) {
  if (layers.length === 0) {
    return <div className="muted" style={{ fontSize: "0.74rem" }}>No layers selected.</div>;
  }
  const maxDepth = Math.max(...layers.map(l => l.bottom));
  const W = 44, H = 120, labelX = W + 6;

  return (
    <svg width={labelX + 70} height={H + 24} style={{ display: "block", overflow: "visible" }}>
      <text x={W - 4} y={8} textAnchor="end" fontFamily="var(--font-mono)"
        fontSize="9" fill="var(--text-muted)">0</text>
      <text x={W - 4} y={H + 11} textAnchor="end" fontFamily="var(--font-mono)"
        fontSize="9" fill="var(--text-muted)">{maxDepth}</text>
      <text x={W - 4} y={H + 21} textAnchor="end" fontFamily="var(--font-mono)"
        fontSize="8" fill="var(--text-muted)">cm</text>
      <rect x={0} y={0} width={W} height={H} fill="none"
        stroke="var(--panel-border-strong)" strokeWidth={1} rx={3} />
      {layers.map((l, i) => {
        const y0 = (l.top / maxDepth) * H;
        const y1 = (l.bottom / maxDepth) * H;
        const mid = (y0 + y1) / 2;
        const fill = DEPTH_COLORS[i % DEPTH_COLORS.length];
        return (
          <g key={l.code}>
            <rect x={0} y={y0} width={W} height={y1 - y0} fill={fill}
              stroke="var(--panel-bg)" strokeWidth={1} />
            <text x={W / 2} y={mid + 4} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize="9" fontWeight="700"
              fill="var(--ek-root)" fillOpacity={0.85} pointerEvents="none">
              {l.code}
            </text>
            <text x={labelX} y={y0 + 10} fontFamily="var(--font-mono)"
              fontSize="9" fill="var(--text-secondary)">
              {l.top}–{l.bottom} cm
            </text>
            {i > 0 && (
              <line x1={-4} y1={y0} x2={W} y2={y0}
                stroke="var(--panel-bg)" strokeWidth={1} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DepthSchemePicker({
  value, onChange,
}: {
  value: DepthLayer[];
  onChange: (layers: DepthLayer[]) => void;
}) {
  const matchedScheme = DEPTH_SCHEMES.find(s =>
    s.layers.length === value.length &&
    s.layers.every((l, i) => l.top === value[i]?.top && l.bottom === value[i]?.bottom)
  );
  const [nLayers, setNLayers] = useState<1 | 2 | 3 | 4>(
    (matchedScheme?.nLayers ?? (value.length as 1 | 2 | 3 | 4)) || 4
  );
  const schemesForCount = DEPTH_SCHEMES.filter(s => s.nLayers === nLayers);

  function selectCount(n: 1 | 2 | 3 | 4) {
    setNLayers(n);
    const first = DEPTH_SCHEMES.find(s => s.nLayers === n);
    if (first) onChange(first.layers);
  }

  function selectScheme(s: DepthScheme) {
    onChange(s.layers);
  }

  const countBtns: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

  return (
    <div className="column" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 4, alignItems: "center" }}>
        {countBtns.map(n => (
          <button
            key={n}
            className="btn"
            data-active={nLayers === n}
            onClick={() => selectCount(n)}
            style={{
              minWidth: 30, padding: "3px 8px",
              background: nLayers === n ? "var(--ek-soil)" : undefined,
              color: nLayers === n ? "var(--ek-root)" : undefined,
              borderColor: nLayers === n ? "var(--ek-soil)" : undefined,
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.72rem",
            }}
          >
            {n}
          </button>
        ))}
        <span className="muted" style={{ fontSize: "0.72rem" }}>
          {nLayers === 1 ? "layer" : "layers"}
        </span>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {schemesForCount.map(s => {
          const active = matchedScheme?.key === s.key;
          return (
            <button key={s.key} className="btn" onClick={() => selectScheme(s)}
              style={{
                padding: "3px 8px",
                background: active ? "var(--ek-water)" : undefined,
                color: active ? "var(--ek-root)" : undefined,
                borderColor: active ? "var(--ek-water)" : undefined,
                fontFamily: "var(--font-mono)", fontSize: "0.68rem",
              }}>
              {s.shortLabel}
            </button>
          );
        })}
      </div>

      <DepthProfileDiagram layers={value} />
    </div>
  );
}

function Slider({
  value, min, max, accent, onChange, suffix,
}: {
  value: number; min: number; max: number;
  accent?: string;
  onChange: (n: number) => void;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 130, accentColor: accent ?? "var(--ek-soil)" }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.92rem", fontWeight: 700, minWidth: 22 }}>
        {value}
      </span>
      {suffix && <span className="muted" style={{ fontSize: "0.72rem" }}>{suffix}</span>}
    </div>
  );
}

export function PlanControls() {
  const { plan, update, reset } = usePlan();

  function handleReset() {
    if (!confirm("Reset to the default full-factorial plan?")) return;
    reset();
  }

  return (
    <>
      {/* Treatment factors */}
      <div className="sidebar-section" data-accent="stem">
        <h3>Treatment factors</h3>

        <div style={{ marginBottom: 12 }}>
          <SectionTitle>Genotypes</SectionTitle>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {(ALL_GENOTYPES as GenotypeCode[]).map(g => (
              <CheckChip key={g}
                label={GENOTYPE_LABELS[g]}
                checked={plan.genotypes.includes(g)}
                onChange={() => update({ genotypes: toggle(plan.genotypes, g) })}
                genotype={g}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <SectionTitle>N doses</SectionTitle>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {(ALL_DOSES as DoseCode[]).map(d => (
              <CheckChip key={d}
                label={`${DOSE_N_KG_HA_YR[d]} kg N`}
                checked={plan.doses.includes(d)}
                onChange={() => update({ doses: toggle(plan.doses, d) })}
                doseLevel={d}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Replicate blocks</SectionTitle>
          <Slider value={plan.nBlocks} min={1} max={8}
            onChange={n => update({ nBlocks: n })}
            suffix="of 8" />
        </div>
      </div>

      {/* Soil composites */}
      <div className="sidebar-section" data-accent="soil">
        <h3>Soil composites</h3>
        <DepthSchemePicker value={plan.depths} onChange={depths => update({ depths })} />
        {plan.depths.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SectionTitle>Subsamples per plot × depth</SectionTitle>
            <Slider value={plan.nSubsamplesPerPlot} min={1} max={20}
              onChange={n => update({ nSubsamplesPerPlot: n })}
              suffix="→ 1 composite" />
          </div>
        )}
      </div>

      {/* Bulk density */}
      <div className="sidebar-section" data-accent="slate">
        <h3>Bulk density</h3>
        <div className="column" style={{ gap: 10 }}>
          <div>
            <SectionTitle>BD blocks (first N)</SectionTitle>
            <Slider value={plan.nBdBlocks} min={0} max={Math.max(1, maxBdBlocks(plan))}
              onChange={n => update({ nBdBlocks: n })}
              suffix={`of ${maxBdBlocks(plan)}`} />
          </div>
          {plan.nBdBlocks > 0 && (
            <div>
              <SectionTitle>BD ring depths</SectionTitle>
              <DepthSchemePicker value={plan.bdRingDepths}
                onChange={bdRingDepths => update({ bdRingDepths })} />
            </div>
          )}
        </div>
      </div>

      {/* Trees */}
      <div className="sidebar-section" data-accent="stem">
        <h3>Tree measurements</h3>
        <SectionTitle>Central trees per plot</SectionTitle>
        <Slider value={plan.treesPerPlot} min={1} max={12}
          onChange={n => update({ treesPerPlot: n })}
          suffix="of 12 max" />
      </div>

      {/* Additional analyses — measurements run on already-collected samples. */}
      <div className="sidebar-section" data-accent="water">
        <h3>Additional analyses</h3>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <CheckChip label="N-min analysis" checked={plan.includeNmin}
            onChange={() => update({ includeNmin: !plan.includeNmin })}
            color="var(--ek-water)" />
        </div>
        <div className="muted" style={{ fontSize: "0.70rem", marginTop: 6 }}>
          Runs on the 0–10 cm soil sample; no extra sampling in the field.
        </div>
      </div>

      {/* Reset */}
      <div className="sidebar-section" data-accent="terracotta">
        <button className="btn" onClick={handleReset} style={{ width: "100%", justifyContent: "center" }}>
          <RotateCcw size={13} /> Reset to defaults
        </button>
        <div className="muted" style={{ fontSize: "0.7rem", marginTop: 6, textAlign: "center" }}>
          Changes save automatically.
        </div>
      </div>
    </>
  );
}

