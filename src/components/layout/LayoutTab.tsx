import { useEffect, useState } from "react";
import { computeFieldLayout, type FieldLayout } from "../../engine/layoutEngine";
import { getAll } from "../../db/repo";
import type { Plot } from "../../types/design";
import { loadPlan } from "../../utils/planStorage";
import type { SamplingPlan } from "../../types/plan";
import {
  GENOTYPE_FILL,
  GENOTYPE_STROKE,
  DOSE_STROKE_WIDTH,
  DOSE_LABEL,
  TOKENS,
} from "../../utils/palette";

const CHART_FONT_MONO = "'Azeret Mono', ui-monospace, Menlo, Consolas, monospace";

type ViewMode = "trees" | "sampling";

// ── Sampling overlay ──────────────────────────────────────────────────────────
// Colour constants for each sample type indicator
const IND_SOIL  = "var(--ek-depth-3)";
const IND_LEAF  = TOKENS.stem;
const IND_NMIN  = TOKENS.water;
const IND_BD    = TOKENS.slate;

// Small indicator row rendered at the bottom of each active plot.
// Each dot = one sample type present.
function SamplingIndicators({
  x, y, w, h, plan,
}: {
  x: number; y: number; w: number; h: number; plan: SamplingPlan;
}) {
  const dots: { color: string; title: string }[] = [];
  if (plan.depths.length > 0) dots.push({ color: IND_SOIL, title: `Soil (${plan.depths.length} layer${plan.depths.length > 1 ? "s" : ""})` });
  if (plan.includeLeafComposites)  dots.push({ color: IND_LEAF, title: "Leaf composite" });
  if (plan.includeNmin)            dots.push({ color: IND_NMIN, title: "N-min" });

  const dotR = 3, gap = 2;
  const rowW = dots.length * (dotR * 2 + gap) - gap;
  const startX = x + (w - rowW) / 2;
  const cy = y + h - 6;

  return (
    <g>
      {dots.map((d, i) => (
        <circle key={i}
          cx={startX + i * (dotR * 2 + gap) + dotR}
          cy={cy} r={dotR}
          fill={d.color} opacity={0.9} pointerEvents="none">
          <title>{d.title}</title>
        </circle>
      ))}
    </g>
  );
}

// Depth strata shown as horizontal bands across the bottom third of a plot.
function DepthBands({
  x, y, w, h, plan,
}: {
  x: number; y: number; w: number; h: number; plan: SamplingPlan;
}) {
  if (plan.depths.length === 0) return null;
  const DEPTH_COLORS = ["var(--ek-depth-1)", "var(--ek-depth-2)", "var(--ek-depth-3)", "var(--ek-depth-4)"];
  const bandH = Math.min(7, (h * 0.35) / plan.depths.length);
  const totalH = bandH * plan.depths.length;
  const startY = y + h - totalH - 2;

  return (
    <g opacity={0.7} pointerEvents="none">
      {plan.depths.map((d, i) => (
        <rect key={d.code}
          x={x + 2} y={startY + i * bandH}
          width={w - 4} height={bandH}
          fill={DEPTH_COLORS[i % DEPTH_COLORS.length]}
          rx={i === 0 ? 1 : 0}
        />
      ))}
    </g>
  );
}

export function LayoutTab() {
  const [layout, setLayout] = useState<FieldLayout | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("trees");
  const [plan, setPlan] = useState<SamplingPlan>(loadPlan);

  useEffect(() => {
    (async () => {
      const p = await getAll<Plot>("plots");
      setPlots(p);
      if (p.length > 0) setLayout(computeFieldLayout(p));
    })();
  }, []);

  // Refresh plan when switching to sampling mode
  function switchMode(m: ViewMode) {
    if (m === "sampling") setPlan(loadPlan());
    setViewMode(m);
  }

  if (!layout) {
    return (
      <div className="card">
        <h2 className="card-title">Field layout</h2>
        <div className="muted">No plots loaded. Go to Overview and seed the factorial or import plot_register.csv.</div>
      </div>
    );
  }

  const selectedPlot = selected ? plots.find(p => p.plot_id === selected) : null;

  // Which plots are active under the current plan
  function isActive(cell: { block: number; genotype: string; dose_code: string }): boolean {
    if (viewMode !== "sampling") return true;
    return (
      cell.block <= plan.nBlocks &&
      plan.genotypes.includes(cell.genotype as never) &&
      plan.doses.includes(cell.dose_code as never)
    );
  }

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>48-plot factorial</h2>
          {/* View mode toggle */}
          <div className="row" style={{ gap: 0, border: "1px solid var(--panel-border-strong)", borderRadius: "var(--radius-control)", overflow: "hidden" }}>
            {(["trees", "sampling"] as ViewMode[]).map(m => (
              <button key={m}
                onClick={() => switchMode(m)}
                style={{
                  padding: "4px 12px",
                  fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  background: viewMode === m ? "var(--ek-soil)" : "var(--panel-bg)",
                  color: viewMode === m ? "var(--ek-root)" : "var(--text-secondary)",
                  border: "none", cursor: "pointer",
                  transition: "background 0.12s",
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Legend (above viewer) */}
        {viewMode === "trees" && (
          <div className="row muted" style={{ marginBottom: 10, gap: 16, flexWrap: "wrap" }}>
            <span className="badge stem">CCN 51</span>
            <span className="badge berry">PS 13.19</span>
            <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="0.8"/></svg> 56 kg N</span>
            <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="1.6"/></svg> 226</span>
            <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="2.6"/></svg> 340</span>
          </div>
        )}
        {viewMode === "sampling" && (
          <div className="row muted" style={{ marginBottom: 10, gap: 14, flexWrap: "wrap" }}>
            {plan.depths.length > 0 && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width="12" height="10"><rect x="0" y="0" width="12" height="10" rx="1" fill={IND_SOIL}/></svg>
                Soil core ({plan.depths.length} layer{plan.depths.length > 1 ? "s" : ""})
              </span>
            )}
            {plan.includeLeafComposites && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={IND_LEAF}/></svg>
                Leaf composite
              </span>
            )}
            {plan.includeNmin && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={IND_NMIN}/></svg>
                N-min
              </span>
            )}
            {plan.nBdBlocks > 0 && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="none" stroke={IND_BD} strokeWidth="1.5"/></svg>
                BD point ({plan.nBdBlocks} block{plan.nBdBlocks !== 1 ? "s" : ""})
              </span>
            )}
            <span className="row" style={{ gap: 5, fontSize: "0.72rem", color: "var(--text-muted)" }}>
              <svg width="12" height="10"><rect x="0" y="0" width="12" height="10" rx="1" fill="var(--soil-08)" opacity="0.4"/></svg>
              Excluded by plan
            </span>
          </div>
        )}

        <div style={{ overflow: "auto", background: "var(--soil-04)", borderRadius: 8, padding: 12 }}>
          <svg
            viewBox={`-10 -10 ${layout.width + 20} ${layout.height + 20}`}
            style={{ width: "100%", height: "auto", maxHeight: "85vh", display: "block" }}
            role="img"
            aria-label="MCCS field layout: 48 plots"
          >
            {layout.plots.map((cell) => {
              const active = isActive(cell);
              const isSel = cell.plot_id === selected;
              const fill = active
                ? GENOTYPE_FILL[cell.genotype]
                : "var(--soil-08)";
              const stroke = isSel
                ? TOKENS.soilDark
                : active
                  ? GENOTYPE_STROKE[cell.genotype]
                  : "var(--panel-border)";

              return (
                <g key={cell.plot_id}>
                  <rect
                    x={cell.x} y={cell.y} width={cell.w} height={cell.h}
                    rx={4} fill={fill}
                    stroke={stroke}
                    strokeWidth={isSel ? 3 : DOSE_STROKE_WIDTH[cell.dose_code]}
                    opacity={active ? 1 : 0.4}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(cell.plot_id)}
                  >
                    <title>
                      {cell.plot_id} ({cell.genotype === "CCN51" ? "CCN 51" : "PS 13.19"}, {DOSE_LABEL[cell.dose_code]} kg N ha⁻¹ yr⁻¹)
                    </title>
                  </rect>

                  <text x={cell.x + 10} y={cell.y + 18}
                    fontFamily={CHART_FONT_MONO} fontSize="16"
                    fontWeight={600}
                    letterSpacing="0.02em"
                    fill={active ? TOKENS.soilDark : "var(--text-muted)"}
                    pointerEvents="none">
                    B{cell.block} · {cell.genotype === "CCN51" ? "CCN 51" : "PS 13.19"} · {DOSE_LABEL[cell.dose_code]} N
                  </text>

                  {/* Trees view */}
                  {viewMode === "trees" && cell.trees.map((t) => (
                    <circle key={t.tree_id}
                      cx={t.cx} cy={t.cy} r={5}
                      fill={GENOTYPE_STROKE[cell.genotype]}
                      opacity={0.9} pointerEvents="none"
                    />
                  ))}

                  {/* Sampling view */}
                  {viewMode === "sampling" && active && (
                    <>
                      <DepthBands
                        x={cell.x} y={cell.y} w={cell.w} h={cell.h}
                        plan={plan}
                      />
                      <SamplingIndicators
                        x={cell.x} y={cell.y} w={cell.w} h={cell.h}
                        plan={plan}
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* BD ring count label — shown once in sampling mode */}
            {viewMode === "sampling" && plan.nBdBlocks > 0 && (() => {
              const cells = plan.genotypes.length * plan.doses.length;
              const bdPoints = plan.nBdBlocks * cells;
              const bdRings = bdPoints * plan.bdRingDepths.length;
              return (
                <text
                  x={layout.width / 2} y={layout.height + 14}
                  textAnchor="middle"
                  fontFamily={CHART_FONT_MONO} fontSize="9"
                  fill={IND_BD}>
                  {plan.nBdBlocks} BD block{plan.nBdBlocks !== 1 ? "s" : ""} × {cells} plots × {plan.bdRingDepths.length} depth{plan.bdRingDepths.length !== 1 ? "s" : ""} = {bdRings} Kopecky ring{bdRings !== 1 ? "s" : ""}
                </text>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Plot inspector */}
      <div className="card">
        <h2 className="card-title">Plot inspector</h2>
        {selectedPlot ? (
          <div className="stat-grid">
            <div className="stat"><span className="stat-label">Plot</span><span className="stat-value mono">{selectedPlot.plot_id}</span></div>
            <div className="stat"><span className="stat-label">Block</span><span className="stat-value">{selectedPlot.block}</span></div>
            <div className="stat"><span className="stat-label">Genotype</span><span className="stat-value">{selectedPlot.genotype_label}</span></div>
            <div className="stat"><span className="stat-label">N dose</span><span className="stat-value">{selectedPlot.n_dose_kg_ha_yr}</span><span className="stat-sub">kg N ha⁻¹ yr⁻¹</span></div>
            <div className="stat"><span className="stat-label">Central trees</span><span className="stat-value">{selectedPlot.measurement_trees_n}</span></div>
            <div className="stat"><span className="stat-label">Rootstock</span><span className="stat-value">{selectedPlot.rootstock}</span></div>
          </div>
        ) : (
          <div className="muted">Tap a plot on the map to see its details.</div>
        )}
      </div>
    </div>
  );
}
