import {
  type BlockNumber,
  type DepthLayer,
  type DoseCode,
  type GenotypeCode,
} from "./design";

// ── Depth schemes ────────────────────────────────────────────────────────────
// Codes are always positional (D1 = first layer, D2 = second …) regardless of
// the chosen depth range. Sample IDs therefore stay stable across schemes.

export interface DepthScheme {
  key: string;
  nLayers: 1 | 2 | 3 | 4;
  shortLabel: string;  // for chip button
  layers: DepthLayer[];
}

export const DEPTH_SCHEMES: DepthScheme[] = [
  // ── 1 layer ──
  {
    key: "1L_0-20",
    nLayers: 1,
    shortLabel: "0–20 cm",
    layers: [{ code: "D1", label: "0-20", top: 0, bottom: 20 }],
  },
  {
    key: "1L_0-30",
    nLayers: 1,
    shortLabel: "0–30 cm",
    layers: [{ code: "D1", label: "0-30", top: 0, bottom: 30 }],
  },
  // ── 2 layers ──
  {
    key: "2L_0-10_10-30",
    nLayers: 2,
    shortLabel: "0–10 / 10–30",
    layers: [
      { code: "D1", label: "0-10",  top: 0,  bottom: 10 },
      { code: "D2", label: "10-30", top: 10, bottom: 30 },
    ],
  },
  {
    key: "2L_0-20_20-40",
    nLayers: 2,
    shortLabel: "0–20 / 20–40",
    layers: [
      { code: "D1", label: "0-20",  top: 0,  bottom: 20 },
      { code: "D2", label: "20-40", top: 20, bottom: 40 },
    ],
  },
  // ── 3 layers ──
  {
    key: "3L_0-10_10-20_20-30",
    nLayers: 3,
    shortLabel: "0–10 / 10–20 / 20–30",
    layers: [
      { code: "D1", label: "0-10",  top: 0,  bottom: 10 },
      { code: "D2", label: "10-20", top: 10, bottom: 20 },
      { code: "D3", label: "20-30", top: 20, bottom: 30 },
    ],
  },
  {
    key: "3L_0-10_10-20_20-40",
    nLayers: 3,
    shortLabel: "0–10 / 10–20 / 20–40",
    layers: [
      { code: "D1", label: "0-10",  top: 0,  bottom: 10 },
      { code: "D2", label: "10-20", top: 10, bottom: 20 },
      { code: "D3", label: "20-40", top: 20, bottom: 40 },
    ],
  },
  {
    key: "3L_0-10_10-30_30-50",
    nLayers: 3,
    shortLabel: "0–10 / 10–30 / 30–50",
    layers: [
      { code: "D1", label: "0-10",  top: 0,  bottom: 10 },
      { code: "D2", label: "10-30", top: 10, bottom: 30 },
      { code: "D3", label: "30-50", top: 30, bottom: 50 },
    ],
  },
  // ── 4 layers (default) ──
  {
    key: "4L_default",
    nLayers: 4,
    shortLabel: "0–10 / 10–20 / 20–30 / 30–50",
    layers: [
      { code: "D1", label: "0-10",  top: 0,  bottom: 10 },
      { code: "D2", label: "10-20", top: 10, bottom: 20 },
      { code: "D3", label: "20-30", top: 20, bottom: 30 },
      { code: "D4", label: "30-50", top: 30, bottom: 50 },
    ],
  },
];

// Planning baseline: 2 layers (0-20, 20-40 cm) — retains Macedo (2025)'s
// 0-20 cm topsoil interval and adds one extension below for SOC depth
// attenuation. Other schemes remain selectable via the Sampling plan tab.
export const DEFAULT_DEPTH_SCHEME = DEPTH_SCHEMES.find(s => s.key === "2L_0-20_20-40")!;

// ── Lab analyses ──────────────────────────────────────────────────────────────
// Optional assays the user can enable. Scope drives how the unit count is
// derived from PlanCounts: per_composite (one run per lab composite) or
// per_plot (one run per plot — typical for texture / one-off assays).

export type LabAnalysisCode = "soc" | "tn" | "ph" | "texture" | "cec" | "available_p";
export type LabAnalysisScope = "per_composite" | "per_plot";

export interface LabAnalysisDef {
  code: LabAnalysisCode;
  label: string;
  scope: LabAnalysisScope;
  description: string;
  defaultLowUsd: number;
  defaultHighUsd: number;
  defaultEnabled: boolean;
  required?: boolean;
}

export const LAB_ANALYSES: LabAnalysisDef[] = [
  {
    code: "soc",
    label: "Total SOC (combustion)",
    scope: "per_composite",
    description: "Organic carbon by dry combustion (Elementar).",
    defaultLowUsd: 8,
    defaultHighUsd: 10,
    defaultEnabled: true,
    required: true,
  },
  {
    code: "tn",
    label: "Total N (combustion)",
    scope: "per_composite",
    description: "Total nitrogen by dry combustion (Elementar).",
    defaultLowUsd: 7,
    defaultHighUsd: 10,
    defaultEnabled: true,
  },
  {
    code: "ph",
    label: "pH (H₂O)",
    scope: "per_composite",
    description: "Per-layer pH on each composite.",
    defaultLowUsd: 4,
    defaultHighUsd: 7,
    defaultEnabled: false,
  },
  {
    code: "cec",
    label: "CEC + exchangeable bases",
    scope: "per_composite",
    description: "Ca, Mg, K, Na on each composite.",
    defaultLowUsd: 15,
    defaultHighUsd: 30,
    defaultEnabled: false,
  },
  {
    code: "available_p",
    label: "Available P (Mehlich)",
    scope: "per_composite",
    description: "Plant-available phosphorus.",
    defaultLowUsd: 8,
    defaultHighUsd: 15,
    defaultEnabled: false,
  },
  {
    code: "texture",
    label: "Particle-size (pipette)",
    scope: "per_plot",
    description: "Typically run once per plot on the topsoil.",
    defaultLowUsd: 25,
    defaultHighUsd: 45,
    defaultEnabled: false,
  },
];

export interface LabAnalysisState {
  enabled: boolean;
  costLowUsd: number;
  costHighUsd: number;
}

export const DEFAULT_LAB_ANALYSES: Record<LabAnalysisCode, LabAnalysisState> =
  Object.fromEntries(
    LAB_ANALYSES.map(a => [a.code, {
      enabled: a.defaultEnabled,
      costLowUsd: a.defaultLowUsd,
      costHighUsd: a.defaultHighUsd,
    }])
  ) as Record<LabAnalysisCode, LabAnalysisState>;

// User-defined assays. Unlike LAB_ANALYSES these are not tied to specific
// sample workflows — only to the cost model. Scope still controls whether
// the unit count is per composite or per plot.
export interface CustomLabAnalysis {
  id: string;
  label: string;
  scope: LabAnalysisScope;
  enabled: boolean;
  costLowUsd: number;
  costHighUsd: number;
}

export function newCustomLabAnalysis(): CustomLabAnalysis {
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: "Custom test",
    scope: "per_composite",
    enabled: true,
    costLowUsd: 10,
    costHighUsd: 15,
  };
}

// ── Plan type ─────────────────────────────────────────────────────────────────

export interface SamplingPlan {
  genotypes: GenotypeCode[];
  doses: DoseCode[];
  nBlocks: number;              // 1..8
  depths: DepthLayer[];         // layers for composite soil samples
  nSubsamplesPerPlot: number;   // subsamples composited into each plot×depth sample
  nCompositesPerPlot: number;   // composite samples generated per plot × depth (1 = single composite; >1 = replicate composites for averaging)
  treesPerPlot: number;         // 1..24
  nBdBlocks: number;            // number of blocks (first N) where BD is sampled; 0..nBlocks. One core per (geno × dose) plot per selected block.
  bdRingDepths: DepthLayer[];   // depths extracted at each BD point — one physical ring per depth
  includeNmin: boolean;
  labAnalyses: Record<LabAnalysisCode, LabAnalysisState>;
  customLabAnalyses: CustomLabAnalysis[];
}

export const ALL_BLOCKS: BlockNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const ALL_GENOTYPES: GenotypeCode[] = ["CCN51", "PS1319"];
export const ALL_DOSES: DoseCode[] = ["L", "M", "H"];

export const DEFAULT_PLAN: SamplingPlan = {
  genotypes: [...ALL_GENOTYPES],
  doses: [...ALL_DOSES],
  nBlocks: 8,
  depths: [...DEFAULT_DEPTH_SCHEME.layers],
  nSubsamplesPerPlot: 5,
  nCompositesPerPlot: 1,
  treesPerPlot: 24,
  nBdBlocks: 2,
  bdRingDepths: [...DEFAULT_DEPTH_SCHEME.layers],
  includeNmin: true,
  labAnalyses: { ...DEFAULT_LAB_ANALYSES },
  customLabAnalyses: [],
};

// ── Derived counts ────────────────────────────────────────────────────────────

export interface PlanCounts {
  plots: number;
  trees: number;
  soil_samples: number;       // composite samples sent to lab
  soil_subsamples: number;    // field subsamples collected in total
  bd_points: number;          // BD sampling locations (plots where a BD column is extracted)
  bd_rings: number;           // physical Kopecky rings = points × depths
  // N-min is a measurement performed on the 0–10 cm soil sample, not a
  // distinct sample type. This counts planned measurements, one per plot.
  nmin_measurements: number;
}

export function planCounts(plan: SamplingPlan): PlanCounts {
  const cells = plan.genotypes.length * plan.doses.length;
  const plots = plan.nBlocks * cells;
  const nComposites = Math.max(1, plan.nCompositesPerPlot);
  const soil_samples = plots * plan.depths.length * nComposites;
  const bdBlocks = Math.max(0, Math.min(plan.nBdBlocks, plan.nBlocks));
  const bd_points = bdBlocks * cells;
  return {
    plots,
    trees:            plots * plan.treesPerPlot,
    soil_samples,
    soil_subsamples:  soil_samples * plan.nSubsamplesPerPlot,
    bd_points,
    bd_rings:         bd_points * plan.bdRingDepths.length,
    // N-min is run on the 0-10 cm composite; one measurement per plot
    // regardless of how many composites are made per depth.
    nmin_measurements: plan.includeNmin ? plots : 0,
  };
}

// Max BD blocks for a plan — cannot exceed the number of active blocks.
export function maxBdBlocks(plan: SamplingPlan): number {
  return plan.nBlocks;
}

export const FULL_FACTORIAL_COUNTS: PlanCounts = planCounts(DEFAULT_PLAN);

// ── Lab cost estimate ─────────────────────────────────────────────────────────
// Units: per_composite → counts.soil_samples, per_plot → counts.plots.
// A composite is one Elementar (or other) run: you pay once for each
// physical sample the lab touches, so the total scales with composites.

export interface LabCostLine {
  code: string;                 // built-in LabAnalysisCode or a custom id
  label: string;
  scope: LabAnalysisScope;
  custom: boolean;
  units: number;                // number of lab runs for this assay
  unitLowUsd: number;
  unitHighUsd: number;
  totalLowUsd: number;
  totalHighUsd: number;
}

export interface LabCostBreakdown {
  totalLowUsd: number;
  totalHighUsd: number;
  items: LabCostLine[];
}

export function computeLabCost(plan: SamplingPlan, counts: PlanCounts): LabCostBreakdown {
  const items: LabCostLine[] = [];
  let totalLow = 0;
  let totalHigh = 0;

  function pushLine(
    code: string,
    label: string,
    scope: LabAnalysisScope,
    custom: boolean,
    costLow: number,
    costHigh: number,
  ) {
    const units = scope === "per_composite" ? counts.soil_samples : counts.plots;
    const lineLow = units * costLow;
    const lineHigh = units * costHigh;
    items.push({
      code, label, scope, custom, units,
      unitLowUsd: costLow,
      unitHighUsd: costHigh,
      totalLowUsd: lineLow,
      totalHighUsd: lineHigh,
    });
    totalLow += lineLow;
    totalHigh += lineHigh;
  }

  for (const def of LAB_ANALYSES) {
    const state = plan.labAnalyses?.[def.code];
    if (!state || !state.enabled) continue;
    pushLine(def.code, def.label, def.scope, false, state.costLowUsd, state.costHighUsd);
  }
  for (const custom of plan.customLabAnalyses ?? []) {
    if (!custom.enabled) continue;
    pushLine(custom.id, custom.label || "Custom test", custom.scope, true, custom.costLowUsd, custom.costHighUsd);
  }
  return { totalLowUsd: totalLow, totalHighUsd: totalHigh, items };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface PlanIssue {
  level: "error" | "warn";
  message: string;
}

export function validatePlan(plan: SamplingPlan): PlanIssue[] {
  const out: PlanIssue[] = [];
  if (plan.genotypes.length === 0)    out.push({ level: "error", message: "Select at least one genotype." });
  if (plan.doses.length === 0)        out.push({ level: "error", message: "Select at least one N dose." });
  if (plan.nBlocks < 1)               out.push({ level: "error", message: "At least one replicate block is required." });
  if (plan.treesPerPlot < 1)          out.push({ level: "error", message: "At least one central tree per plot is required." });
  if (plan.depths.length === 0)       out.push({ level: "warn",  message: "No soil depths selected — no soil samples will be generated." });
  if (plan.nBdBlocks > 0 && plan.bdRingDepths.length === 0)
    out.push({ level: "warn", message: "BD sampling enabled but no depths selected." });
  if (plan.genotypes.length < 2)      out.push({ level: "warn",  message: "One genotype only — genotype effect cannot be estimated." });
  if (plan.doses.length < 2)          out.push({ level: "warn",  message: "One N dose only — dose response cannot be estimated." });
  if (plan.nBlocks < 3)               out.push({ level: "warn",  message: "Fewer than 3 blocks — statistical power will be limited." });

  if (plan.nBdBlocks > plan.nBlocks) {
    out.push({
      level: "error",
      message: `BD blocks (${plan.nBdBlocks}) exceed the number of active blocks (${plan.nBlocks}).`,
    });
  }

  return out;
}
