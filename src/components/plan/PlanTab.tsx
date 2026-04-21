import { useState } from "react";
import { RotateCcw, AlertTriangle, Info } from "lucide-react";
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
  ALL_BLOCKS,
  DEFAULT_PLAN,
  DEPTH_SCHEMES,
  maxBdBlocks,
  planCounts,
  validatePlan,
  type DepthScheme,
  type SamplingPlan,
} from "../../types/plan";
import { loadPlan, savePlan, resetPlan } from "../../utils/planStorage";
import { GENOTYPE_FILL, GENOTYPE_STROKE, TOKENS } from "../../utils/palette";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: "0.65rem",
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--text-secondary)", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function CheckChip({
  label, checked, onChange, color,
}: {
  label: string; checked: boolean; onChange: () => void; color?: string;
}) {
  const c = color ?? "var(--ek-soil)";
  return (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      border: `1px solid ${checked ? c : "var(--panel-border-strong)"}`,
      background: checked ? `color-mix(in srgb, ${c} 12%, transparent)` : "var(--panel-bg)",
      cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.72rem",
      letterSpacing: "0.05em", userSelect: "none",
      transition: "background 0.12s, border-color 0.12s",
      color: checked ? c : "var(--text-secondary)",
    }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ width: 13, height: 13, accentColor: c }} />
      {label}
    </label>
  );
}

// ── Depth profile diagram ─────────────────────────────────────────────────────
// Vertical soil column, layers as coloured bands.

const DEPTH_COLORS = [
  "var(--ek-depth-1)", // D1 – lightest (surface)
  "var(--ek-depth-2)",
  "var(--ek-depth-3)",
  "var(--ek-depth-4)", // D4 – darkest (deep)
];

function DepthProfileDiagram({ layers }: { layers: DepthLayer[] }) {
  if (layers.length === 0) {
    return <div className="muted" style={{ fontSize: "0.78rem" }}>No layers selected.</div>;
  }
  const maxDepth = Math.max(...layers.map(l => l.bottom));
  const W = 56, H = 160, labelX = W + 8;
  const toY = (cm: number) => (cm / maxDepth) * H;

  return (
    <svg width={labelX + 80} height={H + 28} style={{ display: "block", overflow: "visible" }}>
      {/* axis labels */}
      <text x={W - 4} y={8} textAnchor="end" fontFamily="var(--font-mono)"
        fontSize="9" fill="var(--text-muted)">0</text>
      <text x={W - 4} y={H + 11} textAnchor="end" fontFamily="var(--font-mono)"
        fontSize="9" fill="var(--text-muted)">{maxDepth}</text>
      <text x={W - 4} y={H + 21} textAnchor="end" fontFamily="var(--font-mono)"
        fontSize="8" fill="var(--text-muted)">cm</text>

      {/* outer border */}
      <rect x={0} y={0} width={W} height={H} fill="none"
        stroke="var(--panel-border-strong)" strokeWidth={1} rx={3} />

      {layers.map((l, i) => {
        const y0 = toY(l.top);
        const y1 = toY(l.bottom);
        const mid = (y0 + y1) / 2;
        const fill = DEPTH_COLORS[i % DEPTH_COLORS.length];
        return (
          <g key={l.code}>
            <rect x={0} y={y0} width={W} height={y1 - y0} fill={fill}
              stroke="var(--panel-bg)" strokeWidth={1} />
            {/* code label inside bar */}
            <text x={W / 2} y={mid + 4} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize="9" fontWeight="700"
              fill="var(--ek-root)" fillOpacity={0.85} pointerEvents="none">
              {l.code}
            </text>
            {/* range label to the right */}
            <text x={labelX} y={y0 + 10} fontFamily="var(--font-mono)"
              fontSize="9" fill="var(--text-secondary)">
              {l.top}–{l.bottom} cm
            </text>
            {/* divider tick */}
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

// ── Depth scheme picker ───────────────────────────────────────────────────────

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
    <div className="column" style={{ gap: 10 }}>
      {/* Layer count selector */}
      <div className="row" style={{ gap: 6 }}>
        {countBtns.map(n => (
          <button
            key={n}
            className="btn"
            data-active={nLayers === n}
            onClick={() => selectCount(n)}
            style={{
              minWidth: 36,
              background: nLayers === n ? "var(--ek-soil)" : undefined,
              color: nLayers === n ? "var(--ek-root)" : undefined,
              borderColor: nLayers === n ? "var(--ek-soil)" : undefined,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
            }}
          >
            {n}
          </button>
        ))}
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          {nLayers === 1 ? "layer" : "layers"}
        </span>
      </div>

      {/* Preset chips for selected count */}
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {schemesForCount.map(s => {
          const active = matchedScheme?.key === s.key;
          return (
            <button key={s.key} className="btn" onClick={() => selectScheme(s)}
              style={{
                background: active ? "var(--ek-water)" : undefined,
                color: active ? "var(--ek-root)" : undefined,
                borderColor: active ? "var(--ek-water)" : undefined,
                fontFamily: "var(--font-mono)", fontSize: "0.72rem",
              }}>
              {s.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Depth profile diagram */}
      <DepthProfileDiagram layers={value} />
    </div>
  );
}

// ── Mini field grid ───────────────────────────────────────────────────────────
// Shows which plots are active under the current plan.
// 8 blocks in a 2×4 grid; each block: 2 rows (genotype) × 3 cols (dose).

const PLOT_W = 28, PLOT_H = 24, PLOT_GAP = 4, BLOCK_GAP = 16;
const BLOCK_W = 3 * PLOT_W + 2 * PLOT_GAP;
const BLOCK_H = 2 * PLOT_H + PLOT_GAP;

function MiniFieldGrid({ plan }: { plan: SamplingPlan }) {
  const svgW = 4 * BLOCK_W + 3 * BLOCK_GAP;
  const svgH = 2 * BLOCK_H + BLOCK_GAP;

  const activeBlocks = ALL_BLOCKS.slice(0, plan.nBlocks);
  const bdBlocks = ALL_BLOCKS.slice(0, Math.min(plan.nBdBlocks, plan.nBlocks));
  const cells: { x: number; y: number; active: boolean; bd: boolean; geno: GenotypeCode; dose: DoseCode }[] = [];

  for (const block of ALL_BLOCKS) {
    const bi = block - 1;
    const bRow = Math.floor(bi / 4);
    const bCol = bi % 4;
    const bx = bCol * (BLOCK_W + BLOCK_GAP);
    const by = bRow * (BLOCK_H + BLOCK_GAP);
    const blockActive = activeBlocks.includes(block);
    const blockBd = bdBlocks.includes(block);

    for (const [gi, geno] of ALL_GENOTYPES.entries()) {
      for (const [di, dose] of ALL_DOSES.entries()) {
        const active = blockActive && plan.genotypes.includes(geno) && plan.doses.includes(dose);
        cells.push({
          x: bx + di * (PLOT_W + PLOT_GAP),
          y: by + gi * (PLOT_H + PLOT_GAP),
          active,
          bd: active && blockBd && plan.bdRingDepths.length > 0,
          geno: geno as GenotypeCode,
          dose: dose as DoseCode,
        });
      }
    }
  }

  // Sample type indicators – show per-cell dots at bottom
  const dotR = 2.5;
  const dotTypes = [
    { key: "soil",  color: "var(--ek-depth-3)", show: plan.depths.length > 0 },
    { key: "leaf",  color: TOKENS.stem,       show: plan.includeLeafComposites },
    { key: "nmin",  color: TOKENS.water,      show: plan.includeNmin },
  ];
  const activeDots = dotTypes.filter(d => d.show);
  const bdShown = plan.nBdBlocks > 0 && plan.bdRingDepths.length > 0;

  return (
    <div>
      <svg width={svgW} height={svgH} style={{ display: "block", overflow: "visible" }}>
        {/* Block separators */}
        {ALL_BLOCKS.map(block => {
          const bi = block - 1;
          const bRow = Math.floor(bi / 4);
          const bCol = bi % 4;
          const bx = bCol * (BLOCK_W + BLOCK_GAP);
          const by = bRow * (BLOCK_H + BLOCK_GAP);
          return (
            <rect key={block} x={bx - 4} y={by - 4}
              width={BLOCK_W + 8} height={BLOCK_H + 8}
              fill="none" stroke="var(--panel-border)" strokeWidth={1} rx={5}
            />
          );
        })}

        {cells.map((c, i) => {
          const fill = c.active ? GENOTYPE_FILL[c.geno] : "var(--soil-08)";
          const stroke = c.active ? GENOTYPE_STROKE[c.geno] : "var(--panel-border)";
          return (
            <g key={i}>
              <rect x={c.x} y={c.y} width={PLOT_W} height={PLOT_H}
                rx={3} fill={fill} stroke={stroke} strokeWidth={1} />
              {/* sample-type dots */}
              {c.active && activeDots.map((d, di) => (
                <circle
                  key={d.key}
                  cx={c.x + 6 + di * (dotR * 2 + 3)}
                  cy={c.y + PLOT_H - 6}
                  r={dotR}
                  fill={d.color}
                />
              ))}
              {/* BD core marker — open ring on plots in the first N blocks */}
              {c.bd && (
                <circle
                  cx={c.x + PLOT_W - 6}
                  cy={c.y + 6}
                  r={3}
                  fill="none"
                  stroke={TOKENS.slate}
                  strokeWidth={1.2}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 10 }}>
        <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
          <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={GENOTYPE_FILL.CCN51} stroke={GENOTYPE_STROKE.CCN51} strokeWidth="0.8"/></svg>
          CCN 51
        </span>
        <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
          <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={GENOTYPE_FILL.PS1319} stroke={GENOTYPE_STROKE.PS1319} strokeWidth="0.8"/></svg>
          PS 13.19
        </span>
        {activeDots.map(d => (
          <span key={d.key} className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            <svg width={8} height={8}><circle cx={4} cy={4} r={3} fill={d.color}/></svg>
            {d.key === "soil" ? "Soil sample" : d.key === "leaf" ? "Leaf composite" : "N-min"}
          </span>
        ))}
        {bdShown && (
          <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={3.5} fill="none" stroke={TOKENS.slate} strokeWidth="1.2"/></svg>
            BD core
          </span>
        )}
        <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-muted)" }}>
          <svg width={10} height={10}><rect x={1} y={1} width={8} height={8} rx={1} fill="var(--soil-08)" stroke="var(--panel-border)" strokeWidth="0.8"/></svg>
          Excluded
        </span>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function PlanTab() {
  const [plan, setPlan] = useState<SamplingPlan>(loadPlan);

  function update(partial: Partial<SamplingPlan>) {
    const next = { ...plan, ...partial };
    // Keep BD blocks within the active block count.
    const bdMax = maxBdBlocks(next);
    if (next.nBdBlocks > bdMax) next.nBdBlocks = bdMax;
    setPlan(next);
    savePlan(next);
  }

  function handleReset() {
    if (!confirm("Reset to the default full-factorial plan?")) return;
    setPlan(resetPlan());
  }

  const counts = planCounts(plan);
  const issues = validatePlan(plan);
  const errors  = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warn");

  return (
    <div className="column" style={{ gap: 14 }}>

      {/* ── Summary counts ────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Derived sample counts</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">Plots</span>
            <span className="stat-value">{counts.plots}</span>
            <span className="stat-sub">{plan.nBlocks} blk × {plan.genotypes.length} geno × {plan.doses.length} dose</span>
          </div>
          <div className="stat">
            <span className="stat-label">Central trees</span>
            <span className="stat-value">{counts.trees}</span>
            <span className="stat-sub">{plan.treesPerPlot} per plot</span>
          </div>
          <div className="stat">
            <span className="stat-label">Soil samples</span>
            <span className="stat-value">{counts.soil_samples}</span>
            <span className="stat-sub">{plan.depths.length} layer{plan.depths.length !== 1 ? "s" : ""} × {counts.plots} plots</span>
            <span className="stat-sub muted">{counts.soil_subsamples} field subsamples → {counts.soil_samples} composites</span>
          </div>
          <div className="stat">
            <span className="stat-label">BD rings</span>
            <span className="stat-value">{counts.bd_rings}</span>
            <span className="stat-sub">{plan.nBdBlocks} block{plan.nBdBlocks !== 1 ? "s" : ""} × {plan.genotypes.length * plan.doses.length} plots × {plan.bdRingDepths.length} depth{plan.bdRingDepths.length !== 1 ? "s" : ""}</span>
            <span className="stat-sub muted">1 core per (genotype × dose) plot in each selected block, one Kopecky ring per depth</span>
          </div>
          <div className="stat">
            <span className="stat-label">Leaf composites</span>
            <span className="stat-value">{counts.leaf_composites}</span>
            <span className="stat-sub">{plan.includeLeafComposites ? "1 per plot" : "excluded"}</span>
            {plan.includeLeafComposites && (
              <span className="stat-sub muted">{counts.leaf_subsamples} leaves ({plan.nLeafTreesPerPlot} trees/plot)</span>
            )}
          </div>
          <div className="stat">
            <span className="stat-label">N-min samples</span>
            <span className="stat-value">{counts.nmin_samples}</span>
            <span className="stat-sub">{plan.includeNmin ? "1 per plot" : "excluded"}</span>
          </div>
        </div>
      </div>

      {/* ── Issues ────────────────────────────────────────── */}
      {issues.length > 0 && (
        <div className="card">
          <div className="column" style={{ gap: 6 }}>
            {errors.map((is, n) => (
              <div key={n} className="row" style={{ gap: 8, color: "var(--ek-terracotta)" }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "0.82rem" }}>{is.message}</span>
              </div>
            ))}
            {warnings.map((is, n) => (
              <div key={n} className="row" style={{ gap: 8, color: "var(--ek-seed)" }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "0.82rem" }}>{is.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Design overview ────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Design overview</h2>
        <div className="row" style={{ gap: 18, flexWrap: "wrap", marginBottom: 10, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          <span><strong style={{ color: "var(--text-primary)" }}>{counts.plots}</strong> plots</span>
          <span><strong style={{ color: "var(--text-primary)" }}>{counts.soil_samples}</strong> soil samples for analysis</span>
          <span><strong style={{ color: "var(--text-primary)" }}>{counts.bd_rings}</strong> BD cores</span>
        </div>
        <MiniFieldGrid plan={plan} />
      </div>

      {/* ── Treatment factors ─────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Treatment factors</h2>

        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Genotypes</SectionTitle>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {(ALL_GENOTYPES as GenotypeCode[]).map(g => (
              <CheckChip key={g}
                label={GENOTYPE_LABELS[g]}
                checked={plan.genotypes.includes(g)}
                onChange={() => update({ genotypes: toggle(plan.genotypes, g) })}
                color={g === "CCN51" ? "var(--ek-stem)" : "var(--ek-berry)"}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <SectionTitle>N doses</SectionTitle>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {(ALL_DOSES as DoseCode[]).map(d => (
              <CheckChip key={d}
                label={`${DOSE_N_KG_HA_YR[d]} kg N ha⁻¹ yr⁻¹`}
                checked={plan.doses.includes(d)}
                onChange={() => update({ doses: toggle(plan.doses, d) })}
                color="var(--ek-seed)"
              />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Replicate blocks</SectionTitle>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <input type="range" min={1} max={8} value={plan.nBlocks}
              onChange={e => update({ nBlocks: Number(e.target.value) })}
              style={{ width: 160, accentColor: "var(--ek-soil)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, minWidth: 24 }}>
              {plan.nBlocks}
            </span>
            <span className="muted" style={{ fontSize: "0.78rem" }}>of 8</span>
          </div>
        </div>
      </div>

      {/* ── Soil sampling ─────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Soil sampling — composite samples</h2>
        <DepthSchemePicker value={plan.depths} onChange={depths => update({ depths })} />
        {plan.depths.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <SectionTitle>Subsamples per plot per depth</SectionTitle>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input type="range" min={1} max={20} value={plan.nSubsamplesPerPlot}
                onChange={e => update({ nSubsamplesPerPlot: Number(e.target.value) })}
                style={{ width: 160, accentColor: "var(--ek-soil)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, minWidth: 24 }}>
                {plan.nSubsamplesPerPlot}
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                composited into 1 bag per depth
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Soil sampling — bulk density rings</h2>
        <div className="column" style={{ gap: 12 }}>
          <div>
            <SectionTitle>BD sampling blocks (first N)</SectionTitle>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input type="range" min={0} max={Math.max(1, maxBdBlocks(plan))} value={plan.nBdBlocks}
                onChange={e => update({ nBdBlocks: Number(e.target.value) })}
                style={{ width: 160, accentColor: "var(--ek-soil)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, minWidth: 24 }}>
                {plan.nBdBlocks}
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                of {maxBdBlocks(plan)} blocks
              </span>
            </div>
            <div className="muted" style={{ fontSize: "0.72rem", marginTop: 6 }}>
              One core per (genotype × dose) plot in each selected block, one Kopecky ring per depth. Total BD points = {counts.bd_points}; total rings = {counts.bd_rings}.
            </div>
          </div>
          {plan.nBdBlocks > 0 && (
            <div>
              <SectionTitle>BD ring depths</SectionTitle>
              <DepthSchemePicker value={plan.bdRingDepths} onChange={bdRingDepths => update({ bdRingDepths })} />
            </div>
          )}
        </div>
      </div>

      {/* ── Tree measurements ─────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Tree measurements</h2>
        <SectionTitle>Central trees per plot</SectionTitle>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <input type="range" min={1} max={12} value={plan.treesPerPlot}
            onChange={e => update({ treesPerPlot: Number(e.target.value) })}
            style={{ width: 160, accentColor: "var(--ek-soil)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, minWidth: 24 }}>
            {plan.treesPerPlot}
          </span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>of 12 max</span>
        </div>
      </div>

      {/* ── Other samples ─────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Other samples</h2>
        <div className="row" style={{ gap: 16, flexWrap: "wrap", marginBottom: plan.includeLeafComposites ? 14 : 0 }}>
          <CheckChip label="Leaf composites" checked={plan.includeLeafComposites}
            onChange={() => update({ includeLeafComposites: !plan.includeLeafComposites })} />
          <CheckChip label="N-min incubation" checked={plan.includeNmin}
            onChange={() => update({ includeNmin: !plan.includeNmin })} />
        </div>
        {plan.includeLeafComposites && (
          <div>
            <SectionTitle>Trees sampled per plot (leaf composite)</SectionTitle>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input type="range" min={1} max={plan.treesPerPlot} value={plan.nLeafTreesPerPlot}
                onChange={e => update({ nLeafTreesPerPlot: Number(e.target.value) })}
                style={{ width: 160, accentColor: "var(--ek-stem)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, minWidth: 24 }}>
                {plan.nLeafTreesPerPlot}
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                of {plan.treesPerPlot} measurement trees
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Reset ─────────────────────────────────────────── */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Changes save automatically. The seed button in Overview uses this plan.
          </span>
          <button className="btn" onClick={handleReset}>
            <RotateCcw size={14} /> Reset to defaults
          </button>
        </div>
      </div>

    </div>
  );
}
