// Descriptive statistics and grouping helpers.
// M5 layer: no inferential tests yet. M6 will add balanced ANOVA + Tukey.

import { mean, standardDeviation } from "simple-statistics";

// t critical at alpha = 0.025 (two-sided 95% CI). Small lookup table, log-interpolated
// on df. Accurate to ~1% for df >= 1, which is plenty for display purposes.
const T_TABLE: Array<[number, number]> = [
  [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
  [6, 2.447],  [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
  [15, 2.131], [20, 2.086], [30, 2.042], [60, 2.000], [120, 1.980], [10000, 1.960],
];
function tCrit975(df: number): number {
  if (df <= 1) return T_TABLE[0][1];
  for (let i = 1; i < T_TABLE.length; i++) {
    const [d1, t1] = T_TABLE[i - 1];
    const [d2, t2] = T_TABLE[i];
    if (df <= d2) {
      const frac = (Math.log(df) - Math.log(d1)) / (Math.log(d2) - Math.log(d1));
      return t1 + frac * (t2 - t1);
    }
  }
  return 1.96;
}

export interface DescribeResult {
  n: number;
  mean: number;
  sd: number;
  se: number;
  ci95_lo: number;
  ci95_hi: number;
  min: number;
  max: number;
}

export function describe(values: number[]): DescribeResult | null {
  const v = values.filter(x => Number.isFinite(x));
  if (v.length === 0) return null;
  const m = mean(v);
  const sd = v.length > 1 ? standardDeviation(v) : 0;
  const se = v.length > 1 ? sd / Math.sqrt(v.length) : 0;
  const tCrit = tCrit975(Math.max(1, v.length - 1));
  return {
    n: v.length,
    mean: m,
    sd,
    se,
    ci95_lo: m - tCrit * se,
    ci95_hi: m + tCrit * se,
    min: Math.min(...v),
    max: Math.max(...v),
  };
}

export function groupBy<T>(rows: T[], keyFn: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const arr = m.get(k);
    if (arr) arr.push(r); else m.set(k, [r]);
  }
  return m;
}

/** Round a number to N significant digits, returning a string for stable display. */
export function sig(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  if (n === 0) return "0";
  const mag = Math.floor(Math.log10(Math.abs(n)));
  const power = digits - 1 - mag;
  const rounded = Math.round(n * Math.pow(10, power)) / Math.pow(10, power);
  return String(rounded);
}
