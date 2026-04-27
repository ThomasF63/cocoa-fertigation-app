import { useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from "recharts";
import { ResizableRow } from "../shared/ResizableRow";
import {
  type DoseCode,
  type GenotypeCode,
} from "../../types/design";
import {
  ALL_GENOTYPES,
  ALL_DOSES,
  ALL_BLOCKS,
  computeLabCost,
  planCounts,
  validatePlan,
  type SamplingPlan,
} from "../../types/plan";
import { usePlan } from "../../hooks/usePlan";
import { DOSE_LABEL } from "../../utils/palette";
import {
  SoilMark, BdMark, NminMark,
} from "../shared/SampleShapes";
import {
  DoseSwatch, GenotypeSwatch, PlotEncodingDefs, PlotTileRects, resolvePlotEncoding,
} from "../shared/PlotEncoding";
import { EncodingStyleToggle } from "../shared/EncodingStyleToggle";
import { useEncodingMode } from "../../hooks/useEncodingMode";
import { computeMdd, powerAtMdd, sweepPowerAtMdd } from "../../engine/power";

// ── Mini field grid ───────────────────────────────────────────────────────────
// Shows which plots are active under the current plan.
// 8 blocks in a 2×4 grid; each block: 2 rows (genotype) × 3 cols (dose).

const PLOT_W = 34, PLOT_H = 34, PLOT_GAP = 4, BLOCK_GAP = 16;
// Block layout: 2 genotype columns × 3 dose rows (portrait).
const BLOCK_W = 2 * PLOT_W + PLOT_GAP;
const BLOCK_H = 3 * PLOT_H + 2 * PLOT_GAP;

// Soil/BD/Nmin markers share a bottom baseline: soil stacks upward on the
// left, BD on the right, Nmin sits at the bottom centre.
const BOTTOM_PADDING = 4;
const SIDE_INSET = 6;
const MARKER_R = 2.2;
const MARKER_GAP = 5.5;
const BOTTOM_R = 2.4;
const BOTTOM_SPACING = 7;

const BLOCK_BORDER_PAD = 5;   // block rects extend 4 units outside each plot group; +1 for stroke

function MiniFieldGrid({ plan }: { plan: SamplingPlan }) {
  const { mode: encodingMode } = useEncodingMode();
  const svgW = 4 * BLOCK_W + 3 * BLOCK_GAP;
  const svgH = 2 * BLOCK_H + BLOCK_GAP;
  const vbX = -BLOCK_BORDER_PAD;
  const vbY = -BLOCK_BORDER_PAD;
  const vbW = svgW + 2 * BLOCK_BORDER_PAD;
  const vbH = svgH + 2 * BLOCK_BORDER_PAD;

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
          x: bx + gi * (PLOT_W + PLOT_GAP),
          y: by + di * (PLOT_H + PLOT_GAP),
          active,
          bd: active && blockBd && plan.bdRingDepths.length > 0,
          geno: geno as GenotypeCode,
          dose: dose as DoseCode,
        });
      }
    }
  }

  const nSoil = plan.depths.length;
  const nBd = plan.bdRingDepths.length;
  const bottomMarks = [
    plan.includeNmin ? { key: "nmin" as const } : null,
  ].filter(Boolean) as { key: "nmin" }[];
  const bdShown = plan.nBdBlocks > 0 && nBd > 0;
  const soilShown = nSoil > 0;

  return (
    <div>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", maxWidth: vbW * 2, height: "auto" }}
      >
        <PlotEncodingDefs idScope="plan-mini" scale={5} />
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
          const spec = resolvePlotEncoding({
            mode: encodingMode,
            geno: c.geno,
            dose: c.dose,
            active: c.active,
            x: c.x, y: c.y, w: PLOT_W, h: PLOT_H,
            idScope: "plan-mini",
            scale: 1,
          });
          // Markers bottom-align inside the inner (framed) rect so they stay
          // clear of the border gap.
          const innerBottom = spec.innerY + spec.innerH;
          const bottomCy = innerBottom - BOTTOM_PADDING;
          const soilStartY = bottomCy - (nSoil - 1) * MARKER_GAP;
          const bdStartY = bottomCy - (nBd - 1) * MARKER_GAP;
          const innerCenterX = spec.innerX + spec.innerW / 2;
          const innerRight = spec.innerX + spec.innerW;
          return (
            <g key={i}>
              <PlotTileRects
                spec={spec}
                x={c.x} y={c.y} w={PLOT_W} h={PLOT_H}
                rx={3}
              />
              {c.active && spec.overlay}

              {c.active && soilShown && Array.from({ length: nSoil }).map((_, di) => (
                <SoilMark key={`s-${di}`}
                  cx={spec.innerX + SIDE_INSET}
                  cy={soilStartY + di * MARKER_GAP}
                  r={MARKER_R} />
              ))}

              {c.bd && Array.from({ length: nBd }).map((_, di) => (
                <BdMark key={`b-${di}`}
                  cx={innerRight - SIDE_INSET}
                  cy={bdStartY + di * MARKER_GAP}
                  r={MARKER_R} />
              ))}

              {c.active && bottomMarks.map((m, di) => {
                const cx = innerCenterX + (di - (bottomMarks.length - 1) / 2) * BOTTOM_SPACING;
                return <NminMark key={m.key} cx={cx} cy={bottomCy} r={BOTTOM_R} />;
              })}
            </g>
          );
        })}
      </svg>

      <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {(["L", "M", "H"] as DoseCode[]).map(d => (
          <span key={d} className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            <DoseSwatch dose={d} size={14} />
            {DOSE_LABEL[d]} kg N
          </span>
        ))}
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--panel-border)" }} />
        <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
          <GenotypeSwatch mode={encodingMode} geno="CCN51" idScope="plan-mini-legend" size={14} />
          CCN 51
        </span>
        <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
          <GenotypeSwatch mode={encodingMode} geno="PS1319" idScope="plan-mini-legend" size={14} />
          PS 13.19
        </span>
        {soilShown && (
          <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            <svg width={10} height={Math.max(10, nSoil * MARKER_GAP + 4)}>
              {Array.from({ length: nSoil }).map((_, di) => (
                <SoilMark key={di} cx={5} cy={3 + di * MARKER_GAP} r={MARKER_R} />
              ))}
            </svg>
            Soil sample ({nSoil}/plot)
          </span>
        )}
        {bdShown && (
          <span className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            <svg width={10} height={Math.max(10, nBd * MARKER_GAP + 4)}>
              {Array.from({ length: nBd }).map((_, di) => (
                <BdMark key={di} cx={5} cy={3 + di * MARKER_GAP} r={MARKER_R} />
              ))}
            </svg>
            BD ring ({nBd}/pit · 1 pit/plot)
          </span>
        )}
        {bottomMarks.map(m => (
          <span key={m.key} className="row" style={{ gap: 4, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            <svg width={10} height={10}>
              <NminMark cx={5} cy={5} r={BOTTOM_R} />
            </svg>
            N-min analysis
          </span>
        ))}
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
  const { plan } = usePlan();

  const counts = planCounts(plan);
  const labCost = computeLabCost(plan, counts);
  const issues = validatePlan(plan);
  const errors = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warn");

  const rowCardStyle: CSSProperties = {
    flex: "1 1 auto", marginTop: 0, minWidth: 0, width: "100%",
    display: "flex", flexDirection: "column",
  };

  return (
    <div className="column" style={{ gap: 14 }}>

      <ResizableRow
        autoSaveId="mccs.plan.top"
        left={
        <div className="card" style={rowCardStyle}>
          <h2 className="card-title">Derived sample counts</h2>
          <div className="muted" style={{ fontSize: "0.78rem", marginBottom: 10 }}>
            Adjust the plan in the left panel. All counts update live.
          </div>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-label">Plots</span>
              <span className="stat-value">{counts.plots}</span>
              <span className="stat-sub">{plan.nBlocks} blk × {plan.genotypes.length} geno × {plan.doses.length} dose</span>
            </div>
            <div className="stat">
              <span className="stat-label">Measured trees</span>
              <span className="stat-value">{counts.trees}</span>
              <span className="stat-sub">{plan.treesPerPlot} per plot</span>
            </div>
            <div className="stat">
              <span className="stat-label">Soil samples</span>
              <span className="stat-value">{counts.soil_samples}</span>
              <span className="stat-sub">
                {plan.depths.length} layer{plan.depths.length !== 1 ? "s" : ""} × {counts.plots} plots
                {plan.nCompositesPerPlot > 1 ? ` × ${plan.nCompositesPerPlot} composites` : ""}
              </span>
              <span className="stat-sub muted">
                {counts.soil_subsamples} field subsamples → {counts.soil_samples} composite{counts.soil_samples !== 1 ? "s" : ""}
                {plan.nCompositesPerPlot > 1 ? ` (${plan.nCompositesPerPlot} per plot × depth)` : ""}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">BD points</span>
              <span className="stat-value">{counts.bd_points}</span>
              <span className="stat-sub">{plan.nBdBlocks} block{plan.nBdBlocks !== 1 ? "s" : ""} × {plan.genotypes.length * plan.doses.length} plots</span>
              <span className="stat-sub muted">One pit opened per (genotype × dose) plot in each selected block — the rate-limiting step in the field</span>
            </div>
            <div className="stat">
              <span className="stat-label">BD rings</span>
              <span className="stat-value">{counts.bd_rings}</span>
              <span className="stat-sub">{counts.bd_points} point{counts.bd_points !== 1 ? "s" : ""} × {plan.bdRingDepths.length} depth{plan.bdRingDepths.length !== 1 ? "s" : ""}</span>
              <span className="stat-sub muted">One Kopecky ring per depth, driven horizontally into the pit face</span>
            </div>
            <div className="stat">
              <span className="stat-label">N-min measurements</span>
              <span className="stat-value">{counts.nmin_measurements}</span>
              <span className="stat-sub">{plan.includeNmin ? "1 per plot, run on the 0–10 cm sample" : "excluded"}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Lab cost (total)</span>
              <span className="stat-value">
                {labCost.items.length === 0
                  ? "$0"
                  : labCost.totalLowUsd === labCost.totalHighUsd
                    ? `$${labCost.totalLowUsd.toLocaleString("en-US")}`
                    : `$${labCost.totalLowUsd.toLocaleString("en-US")}–$${labCost.totalHighUsd.toLocaleString("en-US")}`}
              </span>
              <span className="stat-sub">
                {labCost.items.length === 0
                  ? "No analyses enabled"
                  : `${labCost.items.length} assay${labCost.items.length === 1 ? "" : "s"} enabled`}
              </span>
              {labCost.items.map(line => (
                <span key={line.code} className="stat-sub muted">
                  {line.label}: {line.units} × $
                  {line.unitLowUsd === line.unitHighUsd
                    ? line.unitLowUsd
                    : `${line.unitLowUsd}–${line.unitHighUsd}`}
                  {" "}= $
                  {line.totalLowUsd === line.totalHighUsd
                    ? line.totalLowUsd.toLocaleString("en-US")
                    : `${line.totalLowUsd.toLocaleString("en-US")}–${line.totalHighUsd.toLocaleString("en-US")}`}
                </span>
              ))}
            </div>
          </div>
        </div>
        }
        right={
        <div className="card" style={rowCardStyle}>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Design overview</h2>
            <EncodingStyleToggle />
          </div>
          <div className="row" style={{ gap: 18, flexWrap: "wrap", marginBottom: 10, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            <span><strong style={{ color: "var(--text-primary)" }}>{counts.plots}</strong> plots</span>
            <span><strong style={{ color: "var(--text-primary)" }}>{counts.soil_samples}</strong> soil samples for analysis</span>
            <span><strong style={{ color: "var(--text-primary)" }}>{counts.bd_points}</strong> BD points / <strong style={{ color: "var(--text-primary)" }}>{counts.bd_rings}</strong> rings</span>
          </div>
          <MiniFieldGrid plan={plan} />
        </div>
        }
      />

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

      <div className="card">
        <h2 className="card-title">Power analysis: SOC / TN stock detection</h2>
        <PowerAnalysisBody plan={plan} />
      </div>

    </div>
  );
}

// ── Power analysis card ──────────────────────────────────────────────────────
// Minimum detectable difference (MDD) between two dose means for SOC (or TN)
// stocks, as a function of between-plot CV and sub-core count.
// See engine/power.ts for the formula.

const DEFAULT_MEAN_STOCK = 30;      // Mg C ha⁻¹ per 0–50 cm, cocoa-clay ballpark
const DEFAULT_BETWEEN_CV = 8;       // %, optimistic baseline for a managed uniform-texture trial
const DEFAULT_WITHIN_CV = 20;       // %, within-plot core-to-core heterogeneity (pre-compositing)
const DEFAULT_TARGET_MDD = 3;       // Mg C ha⁻¹ (≈ 10 % of a 30 Mg C ha⁻¹ stock)
const CV_CHART_GRID = Array.from({ length: 23 }, (_, i) => i);  // 0…22 %, 1 % step
const SUBCORE_COMPARE = [1, 4, 10];
const SUBCORE_COLORS: Record<number, string> = {
  1:  "var(--ek-terracotta)",
  2:  "var(--ek-seed)",
  4:  "var(--ek-stem)",
  6:  "var(--ek-water)",
  10: "var(--ek-berry)",
};
const CURRENT_LINE_COLOR = "var(--ek-stem)";
const MONO_FONT = "'Azeret Mono', ui-monospace, Menlo, Consolas, monospace";

function PowerAnalysisBody({ plan }: { plan: SamplingPlan }) {
  const [meanStock, setMeanStock]       = useState(DEFAULT_MEAN_STOCK);
  const [betweenCv, setBetweenCv]       = useState(DEFAULT_BETWEEN_CV);
  const [withinCv,  setWithinCv]        = useState(DEFAULT_WITHIN_CV);
  const [alphaPct,  setAlphaPct]        = useState(5);   // 5 % two-sided
  const [powerPct,  setPowerPct]        = useState(80);  // 80 % target power
  const [nSubcores, setNSubcores]       = useState(plan.nSubsamplesPerPlot);
  const [targetMdd, setTargetMdd]       = useState(DEFAULT_TARGET_MDD);

  const nBlocks = plan.nBlocks;
  const nGenotypes = plan.genotypes.length;
  const planSubcores = plan.nSubsamplesPerPlot;
  const nComposites = Math.max(1, plan.nCompositesPerPlot);
  // Averaging k composites per plot × depth reduces within-plot noise the same
  // way as k× more sub-cores: σ_within² / (n_subcores × n_composites).
  const effectiveSubcores = nSubcores * nComposites;

  const mddBase = useMemo(() => ({
    nBlocks, nGenotypes,
    meanStock,
    withinPlotCvPct: withinCv,
    alpha: alphaPct / 100,
    power: powerPct / 100,
  }), [nBlocks, nGenotypes, meanStock, withinCv, alphaPct, powerPct]);

  const powerBase = useMemo(() => ({
    nBlocks, nGenotypes,
    meanStock,
    withinPlotCvPct: withinCv,
    alpha: alphaPct / 100,
    targetMdd,
  }), [nBlocks, nGenotypes, meanStock, withinCv, alphaPct, targetMdd]);

  // MDD (at target power) under the current settings — used for the
  // secondary stat tiles and the "MDD needed" sub-label.
  const current = useMemo(() => computeMdd({
    ...mddBase, betweenPlotCvPct: betweenCv, nSubcores: effectiveSubcores,
  }), [mddBase, betweenCv, effectiveSubcores]);

  // Achieved power (at target MDD) under the current settings — primary KPI.
  const achievedPower = useMemo(() => powerAtMdd({
    ...powerBase, betweenPlotCvPct: betweenCv, nSubcores: effectiveSubcores,
  }), [powerBase, betweenCv, effectiveSubcores]);

  const targetPowerFrac = powerPct / 100;
  const targetMet = achievedPower >= targetPowerFrac;

  // Sub-core curves shown in the chart: the fixed comparison set plus the
  // user's current choice (so moving the Sub-cores input always moves a line).
  // Curves are plotted at the *field* sub-core level; composites scale each
  // point up invisibly via effectiveSubcores in the sweep below.
  const subcoreLines = useMemo(() => {
    const set = new Set<number>([...SUBCORE_COMPARE, nSubcores]);
    return Array.from(set).sort((a, b) => a - b);
  }, [nSubcores]);

  // Power-vs-CV chart data. Every input feeds sweepPowerAtMdd, so changing any
  // of them (mean, within CV, α, target MDD, n_subcores, composites, blocks,
  // genotypes) reshapes the curves in real time.
  const chartRows = useMemo(() => {
    const effectiveGrid = subcoreLines.map(sc => sc * nComposites);
    const sweep = sweepPowerAtMdd(powerBase, CV_CHART_GRID, effectiveGrid);
    return CV_CHART_GRID.map(cv => {
      const row: Record<string, number> = { cvPct: cv };
      for (const sc of subcoreLines) {
        const effective = sc * nComposites;
        const r = sweep.find(x => x.cvPct === cv && x.nSubcores === effective);
        row[`subcores_${sc}`] = r ? Number((r.power * 100).toFixed(2)) : 0;
      }
      return row;
    });
  }, [powerBase, subcoreLines, nComposites]);

  return (
    <>
      <div className="muted" style={{ fontSize: "0.76rem", marginBottom: 10 }}>
        Achieved power to detect a{" "}
        <strong style={{ color: "var(--text-primary)" }}>{targetMdd}</strong>{" "}
        Mg C ha⁻¹ difference between two dose means —{" "}
        <strong style={{ color: "var(--text-primary)" }}>{nBlocks * nGenotypes}</strong>{" "}
        plots/dose ({nBlocks}×{nGenotypes}),{" "}
        <strong style={{ color: "var(--text-primary)" }}>{nSubcores}</strong>{" "}
        sub-cores composited
        {nComposites > 1 && (
          <>
            {" "}×{" "}
            <strong style={{ color: "var(--text-primary)" }}>{nComposites}</strong>{" "}
            composites/plot (effective n = {effectiveSubcores})
          </>
        )}
        . Two-sided t-test.
        {nSubcores !== planSubcores && (
          <>
            {" "}<span style={{ color: "var(--ek-terracotta)" }}>
              Plan uses {planSubcores}.
            </span>{" "}
            <button
              onClick={() => setNSubcores(planSubcores)}
              style={{
                background: "none", border: "none", padding: 0,
                color: "var(--text-secondary)", textDecoration: "underline",
                cursor: "pointer", font: "inherit",
              }}
            >
              reset
            </button>
          </>
        )}
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <PowerInput label="Mean" unit="Mg C ha⁻¹"
          value={meanStock} min={1}  max={200} step={1}
          onChange={setMeanStock} />
        <PowerInput label="Target MDD" unit="Mg C ha⁻¹"
          value={targetMdd} min={0.1} max={50}  step={0.1}
          onChange={setTargetMdd} />
        <PowerInput label="Sub-cores" unit="n/plot"
          value={nSubcores} min={1}  step={1}
          onChange={setNSubcores} />
        <PowerInput label="CV between" unit="%"
          value={betweenCv} min={1}  max={60}  step={0.5}
          onChange={setBetweenCv} />
        <PowerInput label="CV within" unit="%"
          value={withinCv}  min={0}  max={100} step={1}
          onChange={setWithinCv} />
        <PowerInput label="α" unit="%"
          value={alphaPct}  min={1}  max={20}  step={0.5}
          onChange={setAlphaPct} />
        <PowerInput label="Target power" unit="%"
          value={powerPct}  min={50} max={99}  step={1}
          onChange={setPowerPct} />
      </div>

      <ResizableRow
        autoSaveId="mccs.plan.power"
        defaultSize={32}
        minSize={20}
        flexBasis="220px"
        left={
          <div
            className="column"
            style={{ gap: 8, width: "100%", minWidth: 0 }}
          >
            <PowerStat
              label={`Power @ ${targetMdd} Mg C ha⁻¹`}
              value={`${(achievedPower * 100).toFixed(1)}%`}
              sub={targetMet
                ? `≥ ${powerPct}% target — detectable`
                : `< ${powerPct}% target — under-powered`}
              tone={targetMet ? "pass" : "fail"} />
            <PowerStat label="MDD @ target power"
              value={`${current.mddAbsolute.toFixed(2)}`}
              sub={`Mg C ha⁻¹ · α=${alphaPct}% · pw=${powerPct}%`} />
            <PowerStat label="σ total (plot)"
              value={current.sigmaTotal.toFixed(2)}
              sub={`CVₜ ${current.cvTotalPct.toFixed(1)}% · df ${current.df}`} />
            <PowerStat label="Composite effect"
              value={current.sigmaWithinEffective.toFixed(2)}
              sub={`σ within / √${nSubcores}`} />
          </div>
        }
        right={
        <div style={{ flex: "1 1 auto", minHeight: 240, minWidth: 0, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <LineChart data={chartRows} margin={{ top: 6, right: 16, left: 0, bottom: 18 }}>
              <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="cvPct"
                type="number"
                domain={[CV_CHART_GRID[0], CV_CHART_GRID[CV_CHART_GRID.length - 1]]}
                tick={{ fontFamily: MONO_FONT, fontSize: 10, fill: "var(--text-secondary)" }}
                label={{ value: "Between-plot CV (%)", position: "insideBottom", offset: -4,
                          fontSize: 11, fill: "var(--text-secondary)" }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ fontFamily: MONO_FONT, fontSize: 10, fill: "var(--text-secondary)" }}
                label={{ value: `Power (%) at Δ = ${targetMdd} Mg C ha⁻¹`,
                          angle: -90, position: "insideLeft",
                          fontSize: 11, fill: "var(--text-secondary)" }}
              />
              <Tooltip
                contentStyle={{ fontFamily: MONO_FONT, fontSize: 11 }}
                formatter={(v) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(v);
                }}
                labelFormatter={(cv) => `CV between = ${cv}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceArea y1={powerPct} y2={100}
                fill="var(--ek-stem)" fillOpacity={0.08} ifOverflow="visible" />
              <ReferenceLine y={powerPct}
                stroke="var(--ek-stem)" strokeDasharray="4 3"
                label={{ value: `target ${powerPct}%`, position: "insideTopRight",
                          fontSize: 10, fill: "var(--text-secondary)" }} />
              <ReferenceLine x={betweenCv}
                stroke="var(--text-muted)" strokeDasharray="2 3"
                label={{ value: `CV ${betweenCv}%`, position: "insideTop",
                          fontSize: 10, fill: "var(--text-secondary)" }} />
              {subcoreLines.map(sc => {
                const isCurrent = sc === nSubcores;
                return (
                  <Line key={sc} type="monotone" dataKey={`subcores_${sc}`}
                    name={`${sc} sub-core${sc === 1 ? "" : "s"}${isCurrent ? " (current)" : ""}`}
                    stroke={isCurrent ? CURRENT_LINE_COLOR : (SUBCORE_COLORS[sc] ?? "var(--ek-slate)")}
                    strokeWidth={isCurrent ? 3 : 1.5}
                    strokeOpacity={isCurrent ? 1 : 0.55}
                    strokeDasharray={isCurrent ? undefined : "4 3"}
                    dot={isCurrent ? { r: 3 } : false}
                    isAnimationActive={false} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
        }
      />

      <div className="muted" style={{ fontSize: "0.7rem", marginTop: 8 }}>
        Green band = at or above the {powerPct}% target; vertical dashes mark the current between-plot CV. Solid line = your selected sub-core count; dashed lines are reference levels. CV between = residual plot-to-plot SD after compositing; CV within is averaged down by √(sub-cores). Macedo 2022 cocoa-clay 0–20 cm OM suggests ≈ 10–15%.
      </div>
    </>
  );
}

function PowerStat({ label, value, sub, tone }: {
  label: string; value: string; sub: string;
  tone?: "neutral" | "pass" | "fail";
}) {
  const t = tone ?? "neutral";
  const borderColor =
    t === "pass" ? "var(--ek-stem)" :
    t === "fail" ? "var(--ek-terracotta)" :
    "var(--panel-border)";
  const valueColor =
    t === "pass" ? "var(--ek-stem)" :
    t === "fail" ? "var(--ek-terracotta)" :
    "var(--text-primary)";
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      padding: "6px 10px",
      border: `1px solid ${borderColor}`,
      borderLeftWidth: t === "neutral" ? 1 : 3,
      borderRadius: 6,
      background: "var(--panel-bg)",
    }}>
      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      <span style={{ fontFamily: MONO_FONT, fontSize: "1.0rem", color: valueColor, fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{sub}</span>
    </div>
  );
}

function PowerInput(props: {
  label: string; unit: string;
  value: number; min: number; max?: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="column" style={{ gap: 2, fontSize: "0.72rem", minWidth: 92, flex: "1 1 100px" }}>
      <span style={{ color: "var(--text-secondary)" }}>
        {props.label} <span className="muted">({props.unit})</span>
      </span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={e => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) props.onChange(v);
        }}
        style={{
          fontFamily: MONO_FONT, fontSize: "0.82rem",
          padding: "3px 6px",
          border: "1px solid var(--panel-border)", borderRadius: 4,
          background: "var(--panel-bg)", color: "var(--text-primary)",
          width: "100%",
        }}
      />
    </label>
  );
}
