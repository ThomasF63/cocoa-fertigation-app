// Balanced / sequential Type I fixed-effects ANOVA for the MCCS factorial.
//
// Approach: treatment-contrast dummy coding; build design matrices for each
// nested model (null, +term1, +term2, ...); fit OLS via the normal equations
// with Gaussian elimination; sequential SS = RSS_{i-1} - RSS_i.
//
// This implementation treats all factors as FIXED (including block). That is
// sufficient for the cross-sectional Phase 2 analysis. Proper split-plot
// inference with block as a random effect lands in M7 via WebR / lme4.

// =============== Distribution helpers ===============

/** Lanczos log-gamma. Accurate to ~15 digits. */
function lgamma(x: number): number {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = p[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += p[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued-fraction helper for the incomplete beta. */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** CDF of F(df1, df2) at value F. */
export function fCdf(F: number, df1: number, df2: number): number {
  if (F <= 0) return 0;
  return 1 - betai(df2 / 2, df1 / 2, df2 / (df2 + df1 * F));
}

/** One-sided p-value for an F statistic. */
export function fPValue(F: number, df1: number, df2: number): number {
  return 1 - fCdf(F, df1, df2);
}

// =============== Linear algebra ===============

/** Solve A x = b via Gaussian elimination with partial pivoting. Returns null if singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    if (Math.abs(M[piv][i]) < 1e-10) return null;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function transpose(m: number[][]): number[][] {
  const r = m.length, c = m[0].length;
  const out = Array.from({ length: c }, () => new Array(r).fill(0));
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = m[i][j];
  return out;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const r = A.length, inner = A[0].length, c = B[0].length;
  const out = Array.from({ length: r }, () => new Array(c).fill(0));
  for (let i = 0; i < r; i++) {
    for (let k = 0; k < inner; k++) {
      const aik = A[i][k];
      for (let j = 0; j < c; j++) out[i][j] += aik * B[k][j];
    }
  }
  return out;
}

function matVec(A: number[][], v: number[]): number[] {
  const r = A.length, c = A[0].length;
  const out = new Array(r).fill(0);
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < c; j++) s += A[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

/** Residual sum of squares from OLS of y on X. Returns NaN if singular. */
function rssOf(X: number[][], y: number[]): number {
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matVec(Xt, y);
  const beta = solve(XtX, Xty);
  if (!beta) return NaN;
  const fitted = matVec(X, beta);
  let rss = 0;
  for (let i = 0; i < y.length; i++) rss += (y[i] - fitted[i]) ** 2;
  return rss;
}

// =============== Factor encoding ===============

export type FactorValues = (string | number)[];

interface FactorCode {
  levels: string[];
  ref: string;
  cols: number[][]; // one column per non-reference level, length = n (observations)
}

function encodeFactor(values: FactorValues): FactorCode {
  const asStr = values.map(String);
  const levels = Array.from(new Set(asStr)).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const ref = levels[0];
  const cols: number[][] = [];
  for (const lv of levels.slice(1)) {
    cols.push(asStr.map(v => (v === lv ? 1 : 0)));
  }
  return { levels, ref, cols };
}

/** Cross-product of column sets (for interaction terms). */
function crossCols(sets: number[][][]): number[][] {
  if (sets.length === 0) return [];
  let out = sets[0];
  for (let i = 1; i < sets.length; i++) {
    const next: number[][] = [];
    for (const a of out) for (const b of sets[i]) next.push(a.map((v, k) => v * b[k]));
    out = next;
  }
  return out;
}

// =============== ANOVA ===============

export interface AnovaTerm {
  term: string;
  df: number;
  ss: number;
  ms: number;
  f: number | null;
  p: number | null;
}

export interface AnovaOutput {
  terms: AnovaTerm[];
  residual: { df: number; ss: number; ms: number };
  total: { df: number; ss: number };
  n: number;
  r_squared: number;
  warnings: string[];
}

export interface AnovaInput {
  y: number[];                                    // outcome, length n
  factors: Record<string, FactorValues>;          // each length n
  terms: string[];                                // ordered; single factor or "A:B" etc.
}

export function fitAnova(input: AnovaInput): AnovaOutput {
  const { y, factors, terms } = input;
  const n = y.length;
  const warnings: string[] = [];

  // Filter out observations with missing y or any missing factor value
  const keep: boolean[] = new Array(n).fill(true);
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(y[i])) { keep[i] = false; continue; }
    for (const k of Object.keys(factors)) {
      const v = factors[k][i];
      if (v === undefined || v === null || v === "") { keep[i] = false; break; }
    }
  }
  const idx = keep.map((k, i) => (k ? i : -1)).filter(i => i >= 0);
  if (idx.length < 5) {
    return {
      terms: [],
      residual: { df: 0, ss: 0, ms: 0 },
      total: { df: 0, ss: 0 },
      n: idx.length,
      r_squared: 0,
      warnings: ["Too few observations to fit a model (need at least 5)."],
    };
  }
  const yk = idx.map(i => y[i]);
  const fk: Record<string, FactorCode> = {};
  for (const k of Object.keys(factors)) {
    fk[k] = encodeFactor(idx.map(i => factors[k][i]));
  }

  // Check balance: each combination of all factors has the same count
  {
    const combos = new Map<string, number>();
    const factorNames = Object.keys(factors);
    for (let i = 0; i < idx.length; i++) {
      const key = factorNames.map(f => String(factors[f][idx[i]])).join("|");
      combos.set(key, (combos.get(key) ?? 0) + 1);
    }
    const counts = Array.from(combos.values());
    if (counts.length > 1 && new Set(counts).size > 1) {
      warnings.push("Design is unbalanced across factor cells. Type I SS are order-dependent.");
    }
  }

  // Build term column sets
  function colsFor(term: string): number[][] {
    const parts = term.split(":").map(s => s.trim());
    const sets = parts.map(p => {
      const f = fk[p];
      if (!f) throw new Error(`Unknown factor in term "${term}": ${p}`);
      return f.cols;
    });
    return crossCols(sets);
  }

  const termCols: number[][][] = [];
  for (const t of terms) {
    const cols = colsFor(t);
    termCols.push(cols);
  }

  // Build full model's columns
  const nk = yk.length;
  const intercept = new Array(nk).fill(1);
  const flat = (cols: number[][][]) => cols.flat();
  const allModelCols = flat(termCols);

  // Sequential fits. Start with intercept-only.
  function makeX(cols: number[][]): number[][] {
    const X: number[][] = [];
    for (let i = 0; i < nk; i++) {
      const row = [intercept[i]];
      for (const c of cols) row.push(c[i]);
      X.push(row);
    }
    return X;
  }

  const rssList: number[] = [];
  let accum: number[][] = [];
  // Null model (intercept only)
  rssList.push(rssOf(makeX(accum), yk));
  for (let i = 0; i < terms.length; i++) {
    accum = accum.concat(termCols[i]);
    rssList.push(rssOf(makeX(accum), yk));
  }

  const totalSS = rssList[0];
  const residualSS = rssList[rssList.length - 1];
  if (!Number.isFinite(residualSS)) {
    warnings.push("Design matrix is singular; some terms could not be estimated.");
  }

  // DF for each term = number of columns added by that term
  const termDF = termCols.map(cols => cols.length);
  const modelDF = termDF.reduce((a, b) => a + b, 0);
  const residualDF = nk - 1 - modelDF;

  const outTerms: AnovaTerm[] = terms.map((t, i) => {
    const ss = rssList[i] - rssList[i + 1];
    const df = termDF[i];
    const ms = df > 0 ? ss / df : 0;
    const msE = residualDF > 0 ? residualSS / residualDF : 0;
    const f = msE > 0 && df > 0 ? ms / msE : null;
    const p = f !== null && residualDF > 0 ? fPValue(f, df, residualDF) : null;
    return { term: t, df, ss, ms, f, p };
  });

  return {
    terms: outTerms,
    residual: {
      df: residualDF,
      ss: residualSS,
      ms: residualDF > 0 ? residualSS / residualDF : 0,
    },
    total: { df: nk - 1, ss: totalSS },
    n: nk,
    r_squared: totalSS > 0 ? 1 - residualSS / totalSS : 0,
    warnings,
  };
}

// =============== Split-plot ANOVA with correct error strata ===============
//
// For a balanced RCBD-split-plot, the F-tests computed with the appropriate
// error strata are numerically identical to those from lmer(y ~ ... + (1|block))
// in REML. The variance-component point estimates below are the classical
// method-of-moments estimators for balanced designs; they match lmer VarCorr()
// to machine precision for balanced data.

export interface StratumSummary {
  term: string;
  df: number;
  ms: number;
}

export interface VarianceComponents {
  residual:        { value: number; label: string };
  wholePlotError:  { value: number; label: string };
  subPlotError?:   { value: number; label: string };
}

export interface SplitPlotOutput {
  design: "split-plot" | "split-split-plot";
  formula: string;
  anova: AnovaOutput;
  f_tests: AnovaTerm[];
  variance_components: VarianceComponents;
  error_strata: { wp?: StratumSummary; sp?: StratumSummary; residual: StratumSummary };
  stratum_for_term: Record<string, "wp" | "sp" | "residual">;
  warnings: string[];
}

export interface SplitPlotInput {
  y: number[];
  block: FactorValues;
  wholePlot: FactorValues;
  subPlot: FactorValues;
  subSubPlot?: FactorValues;
  names?: { wholePlot?: string; subPlot?: string; subSubPlot?: string };
}

// ---- Classical balanced split-plot / split-split-plot via direct SS formulas.
//
// For balanced designs this gives the canonical decomposition (same as
// R aov(y ~ wp*sp*ssp + Error(block/wp/sp)) and lme4 REML). Sequential Type I
// SS with treatment-contrast coding does NOT recover this decomposition when
// error-stratum terms are placed before main effects, which is why we take
// this direct route.

function groupStats(y: number[], keys: string[]): Map<string, { sum: number; count: number; mean: number }> {
  const m = new Map<string, { sum: number; count: number }>();
  for (let i = 0; i < y.length; i++) {
    const e = m.get(keys[i]) ?? { sum: 0, count: 0 };
    e.sum += y[i]; e.count += 1;
    m.set(keys[i], e);
  }
  const out = new Map<string, { sum: number; count: number; mean: number }>();
  for (const [k, e] of m) out.set(k, { ...e, mean: e.sum / e.count });
  return out;
}

function buildKey(factors: (string | number)[][], i: number): string {
  return factors.map(f => String(f[i])).join("|");
}

/** Main-effect SS: SS(X) = sum over levels of count_i * (mean_i - grand)^2 */
function mainSS(y: number[], levels: (string | number)[], grand: number): number {
  const keys = levels.map(String);
  const stats = groupStats(y, keys);
  let ss = 0;
  for (const { count, mean } of stats.values()) ss += count * (mean - grand) ** 2;
  return ss;
}

/** Cell-level SS for a term defined by a list of factors, with the lower-order
 *  effects subtracted. Uses inclusion/exclusion over the power set. */
function interactionSS(
  y: number[],
  factors: (string | number)[][],
  grand: number,
): number {
  // cell stats over the selected factors
  const keys = y.map((_, i) => buildKey(factors, i));
  const stats = groupStats(y, keys);

  // For each cell, compute the "residual" effect = cell_mean - sum over lower-order means
  // by Moebius inversion on the factor indices.
  // For an n-way interaction, the effect of cell (i1..in) is the alternating-sum
  // across all subsets S of {1..n} of ((-1)^(n-|S|)) * mean_over_S(cell).
  // Simpler: iterate all 2^n subsets, compute the mean given that subset of factor
  // levels are fixed (others averaged over), and accumulate with sign.

  // Precompute group stats for every non-empty subset.
  const n = factors.length;
  const subsetStats: Map<number, Map<string, number>> = new Map();
  for (let mask = 0; mask < (1 << n); mask++) {
    const pickedFactors: (string | number)[][] = [];
    for (let j = 0; j < n; j++) if (mask & (1 << j)) pickedFactors.push(factors[j]);
    if (mask === 0) continue; // handled as grand mean
    const skeys = y.map((_, i) => pickedFactors.map(f => String(f[i])).join("|"));
    const ss = groupStats(y, skeys);
    const map = new Map<string, number>();
    for (const [k, v] of ss) map.set(k, v.mean);
    subsetStats.set(mask, map);
  }

  let ss = 0;
  for (const [cellKey, cellStat] of stats) {
    const cellLevels = cellKey.split("|"); // matches factors order
    let effect = 0;
    for (let mask = 0; mask < (1 << n); mask++) {
      const bits = popcount(mask);
      const sign = ((n - bits) % 2 === 0) ? 1 : -1;
      let meanVal: number;
      if (mask === 0) {
        meanVal = grand;
      } else {
        const pickedLevels: string[] = [];
        for (let j = 0; j < n; j++) if (mask & (1 << j)) pickedLevels.push(cellLevels[j]);
        const sk = pickedLevels.join("|");
        meanVal = subsetStats.get(mask)!.get(sk) ?? 0;
      }
      effect += sign * meanVal;
    }
    ss += cellStat.count * effect * effect;
  }
  return ss;
}

function popcount(n: number): number {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

function termSS(
  y: number[],
  factors: Record<string, (string | number)[]>,
  termFactorNames: string[],
  grand: number,
): number {
  const fs = termFactorNames.map(n => factors[n]);
  if (fs.length === 1) return mainSS(y, fs[0], grand);
  return interactionSS(y, fs, grand);
}

function levelCount(vals: (string | number)[]): number {
  return new Set(vals.map(String)).size;
}

export function fitSplitPlotAnova(input: SplitPlotInput): SplitPlotOutput {
  const wp = input.names?.wholePlot ?? "wholePlot";
  const sp = input.names?.subPlot ?? "subPlot";
  const ssp = input.names?.subSubPlot ?? "subSubPlot";
  const hasSSP = !!input.subSubPlot;

  const factors: Record<string, (string | number)[]> = {
    block: input.block,
    [wp]: input.wholePlot,
    [sp]: input.subPlot,
  };
  if (hasSSP) factors[ssp] = input.subSubPlot!;

  const warnings: string[] = [];
  const n = input.y.length;

  // Balance check over all factor combinations
  {
    const combos = new Map<string, number>();
    const names = Object.keys(factors);
    for (let i = 0; i < n; i++) {
      const k = names.map(nm => String(factors[nm][i])).join("|");
      combos.set(k, (combos.get(k) ?? 0) + 1);
    }
    const counts = Array.from(combos.values());
    if (counts.length > 1 && new Set(counts).size > 1) {
      warnings.push("Design is unbalanced across factor cells. SS formulas below assume balance.");
    }
  }

  const grand = input.y.reduce((a, b) => a + b, 0) / n;
  const totalSS = input.y.reduce((a, b) => a + (b - grand) ** 2, 0);

  // Term list and SS
  const termDefs: { name: string; factors: string[] }[] = hasSSP
    ? [
        { name: "block",                    factors: ["block"] },
        { name: `block:${wp}`,              factors: ["block", wp] },
        { name: wp,                         factors: [wp] },
        { name: `block:${wp}:${sp}`,        factors: ["block", wp, sp] },
        { name: sp,                         factors: [sp] },
        { name: `${wp}:${sp}`,              factors: [wp, sp] },
        { name: ssp,                        factors: [ssp] },
        { name: `${wp}:${ssp}`,             factors: [wp, ssp] },
        { name: `${sp}:${ssp}`,             factors: [sp, ssp] },
        { name: `${wp}:${sp}:${ssp}`,       factors: [wp, sp, ssp] },
      ]
    : [
        { name: "block",           factors: ["block"] },
        { name: `block:${wp}`,     factors: ["block", wp] },
        { name: wp,                factors: [wp] },
        { name: sp,                factors: [sp] },
        { name: `${wp}:${sp}`,     factors: [wp, sp] },
      ];

  // Level counts
  const nLev: Record<string, number> = {};
  for (const k of Object.keys(factors)) nLev[k] = levelCount(factors[k]);

  // Compute SS and df for each term
  const rawTerms: AnovaTerm[] = termDefs.map(({ name, factors: tf }) => {
    const ss = termSS(input.y, factors, tf, grand);
    const df = tf.reduce((a, nm) => a * (nLev[nm] - 1), 1);
    return { term: name, df, ss, ms: df > 0 ? ss / df : 0, f: null, p: null };
  });

  const summedSS = rawTerms.reduce((a, t) => a + t.ss, 0);
  const residualSS = Math.max(0, totalSS - summedSS);
  // Residual df = n - 1 - sum of term df
  const residualDF = n - 1 - rawTerms.reduce((a, t) => a + t.df, 0);
  const residualMS = residualDF > 0 ? residualSS / residualDF : 0;

  const wpErrorKey = `block:${wp}`;
  const spErrorKey = `block:${wp}:${sp}`;
  const byTerm: Record<string, AnovaTerm> = {};
  for (const t of rawTerms) byTerm[t.term] = t;
  const wpError = byTerm[wpErrorKey];
  const spError = hasSSP ? byTerm[spErrorKey] : undefined;

  const stratum_for_term: Record<string, "wp" | "sp" | "residual"> = {};
  const f_tests: AnovaTerm[] = rawTerms.map(t => {
    if (t.term === wpErrorKey || t.term === spErrorKey) {
      stratum_for_term[t.term] = "residual";
      return { ...t, f: null, p: null };
    }
    let errorMS = residualMS;
    let errorDF = residualDF;
    let stratum: "wp" | "sp" | "residual" = "residual";

    if (t.term === wp && wpError) {
      errorMS = wpError.ms; errorDF = wpError.df; stratum = "wp";
    } else if (hasSSP && (t.term === sp || t.term === `${wp}:${sp}`) && spError) {
      errorMS = spError.ms; errorDF = spError.df; stratum = "sp";
    }

    stratum_for_term[t.term] = stratum;
    if (errorMS <= 0 || t.df <= 0 || errorDF <= 0) {
      return { ...t, f: null, p: null };
    }
    const f = t.ms / errorMS;
    const p = fPValue(f, t.df, errorDF);
    return { ...t, f, p };
  });

  // Variance components (method of moments, balanced design)
  // For split-plot: sigma2_wp = (MS_bg - MS_res) / (n_total / n_wp_cells)
  const wpCells = new Set(input.block.map((b, i) => `${String(b)}|${String(input.wholePlot[i])}`)).size;
  const n_per_wp = wpCells > 0 ? n / wpCells : 0;

  let sigma2_sp = 0;
  if (hasSSP && spError) {
    const spCells = new Set(
      input.block.map((b, i) => `${String(b)}|${String(input.wholePlot[i])}|${String(input.subPlot[i])}`)
    ).size;
    const n_per_sp = spCells > 0 ? n / spCells : 0;
    sigma2_sp = n_per_sp > 0 ? Math.max(0, (spError.ms - residualMS) / n_per_sp) : 0;
  }
  const wpBelowMS = hasSSP && spError ? spError.ms : residualMS;
  const sigma2_wp = wpError && n_per_wp > 0 ? Math.max(0, (wpError.ms - wpBelowMS) / n_per_wp) : 0;

  const variance_components: VarianceComponents = {
    residual:       { value: residualMS, label: hasSSP ? "within sub-sub-plot (bottom stratum)" : "within sub-plot (bottom stratum)" },
    wholePlotError: { value: sigma2_wp,  label: `block x ${wp} (whole-plot random effect)` },
  };
  if (hasSSP) {
    variance_components.subPlotError = { value: sigma2_sp, label: `block x ${wp} x ${sp} (sub-plot random effect)` };
  }

  const formula = hasSSP
    ? `y ~ ${wp} * ${sp} * ${ssp} + (1|block:${wp}) + (1|block:${wp}:${sp})`
    : `y ~ ${wp} * ${sp} + (1|block:${wp})`;

  const error_strata: SplitPlotOutput["error_strata"] = {
    residual: { term: "residual", df: residualDF, ms: residualMS },
  };
  if (wpError) error_strata.wp = { term: wpErrorKey, df: wpError.df, ms: wpError.ms };
  if (spError) error_strata.sp = { term: spErrorKey, df: spError.df, ms: spError.ms };

  // Synthesise an AnovaOutput-compatible summary for the consumer
  const totalDF = n - 1;
  const anovaSummary: AnovaOutput = {
    terms: rawTerms,
    residual: { df: residualDF, ss: residualSS, ms: residualMS },
    total: { df: totalDF, ss: totalSS },
    n,
    r_squared: totalSS > 0 ? 1 - residualSS / totalSS : 0,
    warnings,
  };

  return {
    design: hasSSP ? "split-split-plot" : "split-plot",
    formula,
    anova: anovaSummary,
    f_tests,
    variance_components,
    error_strata,
    stratum_for_term,
    warnings,
  };
}
