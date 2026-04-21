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

export const DEFAULT_DEPTH_SCHEME = DEPTH_SCHEMES.find(s => s.key === "4L_default")!;

// ── Plan type ─────────────────────────────────────────────────────────────────

export interface SamplingPlan {
  genotypes: GenotypeCode[];
  doses: DoseCode[];
  nBlocks: number;              // 1..8
  depths: DepthLayer[];         // layers for composite soil samples
  nSubsamplesPerPlot: number;   // subsamples composited into each plot×depth sample
  nLeafTreesPerPlot: number;    // trees sampled per plot for leaf composite (1..treesPerPlot)
  treesPerPlot: number;         // 1..12
  nBdBlocks: number;            // number of blocks (first N) where BD is sampled; 0..nBlocks. One core per (geno × dose) plot per selected block.
  bdRingDepths: DepthLayer[];   // depths extracted at each BD point — one physical ring per depth
  includeLeafComposites: boolean;
  includeNmin: boolean;
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
  nLeafTreesPerPlot: 5,
  treesPerPlot: 12,
  nBdBlocks: 2,
  bdRingDepths: [...DEFAULT_DEPTH_SCHEME.layers],
  includeLeafComposites: true,
  includeNmin: true,
};

// ── Derived counts ────────────────────────────────────────────────────────────

export interface PlanCounts {
  plots: number;
  trees: number;
  soil_samples: number;       // composite samples sent to lab
  soil_subsamples: number;    // field subsamples collected in total
  bd_points: number;          // BD sampling locations (plots where a BD column is extracted)
  bd_rings: number;           // physical Kopecky rings = points × depths
  leaf_composites: number;
  leaf_subsamples: number;    // total leaves collected across all plots
  nmin_samples: number;
}

export function planCounts(plan: SamplingPlan): PlanCounts {
  const cells = plan.genotypes.length * plan.doses.length;
  const plots = plan.nBlocks * cells;
  const soil_samples = plots * plan.depths.length;
  const bdBlocks = Math.max(0, Math.min(plan.nBdBlocks, plan.nBlocks));
  const bd_points = bdBlocks * cells;
  return {
    plots,
    trees:            plots * plan.treesPerPlot,
    soil_samples,
    soil_subsamples:  soil_samples * plan.nSubsamplesPerPlot,
    bd_points,
    bd_rings:         bd_points * plan.bdRingDepths.length,
    leaf_composites:  plan.includeLeafComposites ? plots : 0,
    leaf_subsamples:  plan.includeLeafComposites ? plots * plan.nLeafTreesPerPlot : 0,
    nmin_samples:     plan.includeNmin ? plots : 0,
  };
}

// Max BD blocks for a plan — cannot exceed the number of active blocks.
export function maxBdBlocks(plan: SamplingPlan): number {
  return plan.nBlocks;
}

export const FULL_FACTORIAL_COUNTS: PlanCounts = planCounts(DEFAULT_PLAN);

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
