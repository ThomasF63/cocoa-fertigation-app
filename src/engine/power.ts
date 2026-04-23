// Power analysis for the SOC / TN stock dose-response question.
//
// The Phase 2 primary question is: does N fertigation rate shift SOC stocks?
// In the split-plot design (block × genotype × dose × depth), the cleanest
// planning question is "what is the minimum detectable difference (MDD)
// between two dose means, averaged over genotype, at a given depth, given
// between-plot CV and compositing intensity?"
//
// We treat the dose-pair contrast as a two-sample t-test with
// n_per_dose = nBlocks × nGenotypes independent plot-level observations.
// This is conservative for a formal split-plot F-test (it ignores the
// genotype blocking) but is exactly the right mental model for a pairwise
// dose contrast from plot means.
//
// Composite sub-core count reduces within-plot noise:
//   σ_total² = σ_between² + σ_within² / n_subcores
// Both CVs are expressed as % of the assumed SOC stock mean.
//
// Critical values use Student's t via bisection on the F CDF
// (t²_{df} = F_{1,df}). Re-uses fCdf from anova.ts.

import { fCdf } from "./anova";

export interface PowerInputs {
  nBlocks: number;
  nGenotypes: number;           // only enters via n_per_dose = nBlocks × nGenotypes
  meanStock: number;            // assumed mean SOC (or TN) stock, in the target unit
  betweenPlotCvPct: number;     // plot-to-plot CV (%)
  withinPlotCvPct: number;      // within-plot spatial CV (%), composited away by sub-cores
  nSubcores: number;            // 1..n
  alpha: number;                // two-sided significance, e.g. 0.05
  power: number;                // desired power, e.g. 0.8
}

export interface PowerResult {
  nPerDose: number;
  df: number;
  sigmaBetween: number;
  sigmaWithinEffective: number; // σ_within / sqrt(n_subcores)
  sigmaTotal: number;           // plot-level SD used for MDD
  cvTotalPct: number;
  tAlpha: number;
  tBeta: number;
  mddAbsolute: number;          // same unit as meanStock
  mddRelativePct: number;       // % of meanStock
}

/** Regularized lower tail of t: P(T_df ≤ t) via t² = F_{1, df}. */
export function tCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const p = fCdf(t * t, 1, df);
  // fCdf gives P(F ≤ t²), which equals P(|T| ≤ |t|) = 2·P(T ≤ |t|) − 1
  return t >= 0 ? 0.5 + 0.5 * p : 0.5 - 0.5 * p;
}

/** Inverse CDF of Student-t. p ∈ (0, 1). df ≥ 1. */
export function tInv(p: number, df: number): number {
  if (p <= 0 || p >= 1) throw new Error("tInv: p must be in (0, 1)");
  // Bracket
  let lo = -40, hi = 40;
  // Quick normal-approx starting guess
  const z = normalInv(p);
  let mid = z;
  // Widen bracket if needed
  while (tCdf(lo, df) > p) lo *= 2;
  while (tCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 80; i++) {
    mid = 0.5 * (lo + hi);
    const c = tCdf(mid, df);
    if (c < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-8) break;
  }
  return mid;
}

/** Beasley-Springer-Moro inverse normal CDF (good to ~1e-7 in the tails). */
export function normalInv(p: number): number {
  const a = [-3.969683028665376e1,  2.209460984245205e2, -2.759285104469687e2,
              1.383577518672690e2, -3.066479806614716e1,  2.506628277459239];
  const b = [-5.447609879822406e1,  1.615858368580409e2, -1.556989798598866e2,
              6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734,  4.374664141464968,  2.938163982698783];
  const d = [ 7.784695709041462e-3,  3.224671290700398e-1,  2.445134137142996,
              3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
             ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
}

export function computeMdd(inp: PowerInputs): PowerResult {
  const nPerDose = inp.nBlocks * inp.nGenotypes;
  const df = Math.max(1, 2 * nPerDose - 2);
  const sigmaBetween = (inp.betweenPlotCvPct / 100) * inp.meanStock;
  const sigmaWithinEffective = (inp.withinPlotCvPct / 100) * inp.meanStock /
                               Math.sqrt(Math.max(1, inp.nSubcores));
  const sigmaTotal = Math.sqrt(sigmaBetween * sigmaBetween + sigmaWithinEffective * sigmaWithinEffective);
  const tAlpha = tInv(1 - inp.alpha / 2, df);
  const tBeta  = tInv(inp.power, df);
  const seDiff = sigmaTotal * Math.sqrt(2 / nPerDose);
  const mddAbsolute = (tAlpha + tBeta) * seDiff;
  const mddRelativePct = 100 * mddAbsolute / inp.meanStock;
  return {
    nPerDose, df,
    sigmaBetween, sigmaWithinEffective, sigmaTotal,
    cvTotalPct: 100 * sigmaTotal / inp.meanStock,
    tAlpha, tBeta,
    mddAbsolute, mddRelativePct,
  };
}

/**
 * Sweep MDD across a grid of between-plot CVs and sub-core counts, holding
 * other inputs fixed. Used by the Planner chart and the deck export.
 */
export function sweepMdd(
  base: Omit<PowerInputs, "betweenPlotCvPct" | "nSubcores">,
  cvGridPct: number[],
  subcoresGrid: number[],
): { cvPct: number; nSubcores: number; mddAbsolute: number; mddRelativePct: number }[] {
  const out: { cvPct: number; nSubcores: number; mddAbsolute: number; mddRelativePct: number }[] = [];
  for (const cv of cvGridPct) {
    for (const sc of subcoresGrid) {
      const r = computeMdd({ ...base, betweenPlotCvPct: cv, nSubcores: sc });
      out.push({ cvPct: cv, nSubcores: sc, mddAbsolute: r.mddAbsolute, mddRelativePct: r.mddRelativePct });
    }
  }
  return out;
}

// ── Achieved power at a target effect size ──────────────────────────────────
// Inverts the MDD relationship: given a target effect Δ we want to detect,
// return the power the current design achieves. Uses the same central-t
// approximation as computeMdd — i.e. t_β = Δ/SE − t_α, power = P(T_df ≤ t_β).
// This matches the textbook pwr.t2n.test result to a few tenths of a percent
// in the regimes relevant here (df ≥ 20, power 0.5–0.99).

export interface PowerAtMddInputs {
  nBlocks: number;
  nGenotypes: number;
  meanStock: number;
  betweenPlotCvPct: number;
  withinPlotCvPct: number;
  nSubcores: number;
  alpha: number;
  targetMdd: number;            // absolute effect size to detect, same unit as meanStock
}

export function powerAtMdd(inp: PowerAtMddInputs): number {
  const nPerDose = inp.nBlocks * inp.nGenotypes;
  const df = Math.max(1, 2 * nPerDose - 2);
  const sigmaBetween = (inp.betweenPlotCvPct / 100) * inp.meanStock;
  const sigmaWithinEffective = (inp.withinPlotCvPct / 100) * inp.meanStock /
                               Math.sqrt(Math.max(1, inp.nSubcores));
  const sigmaTotal = Math.sqrt(sigmaBetween * sigmaBetween + sigmaWithinEffective * sigmaWithinEffective);
  const seDiff = sigmaTotal * Math.sqrt(2 / nPerDose);
  if (!(seDiff > 0)) return inp.targetMdd > 0 ? 1 : 0;
  const tAlpha = tInv(1 - inp.alpha / 2, df);
  const tBeta = inp.targetMdd / seDiff - tAlpha;
  const p = tCdf(tBeta, df);
  return Math.min(1, Math.max(0, p));
}

/**
 * Sweep achieved power across a grid of between-plot CVs and sub-core counts,
 * at a fixed target effect size. Used by the Planner chart.
 */
export function sweepPowerAtMdd(
  base: Omit<PowerAtMddInputs, "betweenPlotCvPct" | "nSubcores">,
  cvGridPct: number[],
  subcoresGrid: number[],
): { cvPct: number; nSubcores: number; power: number }[] {
  const out: { cvPct: number; nSubcores: number; power: number }[] = [];
  for (const cv of cvGridPct) {
    for (const sc of subcoresGrid) {
      out.push({
        cvPct: cv,
        nSubcores: sc,
        power: powerAtMdd({ ...base, betweenPlotCvPct: cv, nSubcores: sc }),
      });
    }
  }
  return out;
}
