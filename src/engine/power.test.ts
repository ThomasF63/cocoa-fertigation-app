import { describe as d, it, expect } from "vitest";
import { computeMdd, normalInv, tCdf, tInv, sweepMdd, powerAtMdd, sweepPowerAtMdd } from "./power";

d("normalInv", () => {
  it("matches known quantiles", () => {
    expect(normalInv(0.5)).toBeCloseTo(0, 6);
    expect(normalInv(0.975)).toBeCloseTo(1.959964, 4);
    expect(normalInv(0.025)).toBeCloseTo(-1.959964, 4);
    expect(normalInv(0.8)).toBeCloseTo(0.841621, 4);
  });
});

d("tCdf / tInv", () => {
  it("tCdf(0, df) = 0.5", () => {
    expect(tCdf(0, 10)).toBeCloseTo(0.5, 6);
  });

  it("tInv ↔ tCdf round-trip", () => {
    for (const df of [5, 10, 30, 120]) {
      for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 0.975]) {
        const t = tInv(p, df);
        expect(tCdf(t, df)).toBeCloseTo(p, 4);
      }
    }
  });

  it("matches standard t quantiles", () => {
    // t_{0.975, df=30} ≈ 2.042
    expect(tInv(0.975, 30)).toBeCloseTo(2.042, 2);
    // t_{0.975, df=∞} → 1.96 (df=1000 is close enough)
    expect(tInv(0.975, 1000)).toBeCloseTo(1.96, 2);
    // t_{0.8, df=30} ≈ 0.854
    expect(tInv(0.8, 30)).toBeCloseTo(0.854, 2);
  });
});

d("computeMdd", () => {
  it("matches hand calculation for a simple case", () => {
    // 8 blocks × 2 genotypes = 16 per dose; df = 30
    // mean 30, between CV 15%, within CV 0 (no composite effect)
    // σ = 4.5; SE_diff = 4.5 * sqrt(2/16) = 1.5910
    // t_{0.025,30} + t_{0.8,30} ≈ 2.042 + 0.854 = 2.896
    // MDD ≈ 4.608 Mg C/ha
    const r = computeMdd({
      nBlocks: 8, nGenotypes: 2,
      meanStock: 30,
      betweenPlotCvPct: 15, withinPlotCvPct: 0, nSubcores: 1,
      alpha: 0.05, power: 0.8,
    });
    expect(r.nPerDose).toBe(16);
    expect(r.df).toBe(30);
    expect(r.sigmaTotal).toBeCloseTo(4.5, 6);
    expect(r.mddAbsolute).toBeCloseTo(4.61, 1);
  });

  it("MDD decreases as sub-cores increase (within-plot CV > 0)", () => {
    const base = {
      nBlocks: 8, nGenotypes: 2,
      meanStock: 30,
      betweenPlotCvPct: 10, withinPlotCvPct: 30,
      alpha: 0.05, power: 0.8,
    };
    const r1 = computeMdd({ ...base, nSubcores: 1 });
    const r5 = computeMdd({ ...base, nSubcores: 5 });
    const r10 = computeMdd({ ...base, nSubcores: 10 });
    expect(r5.mddAbsolute).toBeLessThan(r1.mddAbsolute);
    expect(r10.mddAbsolute).toBeLessThan(r5.mddAbsolute);
  });

  it("MDD grows with between-plot CV (holding sub-cores fixed)", () => {
    const base = {
      nBlocks: 8, nGenotypes: 2,
      meanStock: 30,
      withinPlotCvPct: 20, nSubcores: 5,
      alpha: 0.05, power: 0.8,
    };
    const lo = computeMdd({ ...base, betweenPlotCvPct: 8 });
    const hi = computeMdd({ ...base, betweenPlotCvPct: 20 });
    expect(hi.mddAbsolute).toBeGreaterThan(lo.mddAbsolute);
  });
});

d("powerAtMdd", () => {
  it("round-trips with computeMdd: MDD@pw fed back yields pw", () => {
    for (const pw of [0.6, 0.8, 0.9]) {
      const base = {
        nBlocks: 8, nGenotypes: 2,
        meanStock: 30,
        betweenPlotCvPct: 12, withinPlotCvPct: 30, nSubcores: 5,
        alpha: 0.05,
      };
      const mdd = computeMdd({ ...base, power: pw }).mddAbsolute;
      const achieved = powerAtMdd({ ...base, targetMdd: mdd });
      expect(achieved).toBeCloseTo(pw, 3);
    }
  });

  it("power rises with more sub-cores and drops with higher between-CV", () => {
    const base = {
      nBlocks: 8, nGenotypes: 2,
      meanStock: 30,
      withinPlotCvPct: 30,
      alpha: 0.05,
      targetMdd: 3,
    };
    const lowCv  = powerAtMdd({ ...base, betweenPlotCvPct: 8,  nSubcores: 5 });
    const highCv = powerAtMdd({ ...base, betweenPlotCvPct: 20, nSubcores: 5 });
    expect(lowCv).toBeGreaterThan(highCv);

    const sc1  = powerAtMdd({ ...base, betweenPlotCvPct: 12, nSubcores: 1 });
    const sc10 = powerAtMdd({ ...base, betweenPlotCvPct: 12, nSubcores: 10 });
    expect(sc10).toBeGreaterThan(sc1);
  });
});

d("sweepPowerAtMdd", () => {
  it("returns rows for every (cv, subcore) with power in [0,1]", () => {
    const rows = sweepPowerAtMdd(
      { nBlocks: 8, nGenotypes: 2, meanStock: 30, withinPlotCvPct: 30, alpha: 0.05, targetMdd: 3 },
      [8, 12, 16],
      [1, 5, 10],
    );
    expect(rows.length).toBe(9);
    for (const r of rows) {
      expect(r.power).toBeGreaterThanOrEqual(0);
      expect(r.power).toBeLessThanOrEqual(1);
    }
  });
});

d("sweepMdd", () => {
  it("generates rows for every (cv, subcore) pair", () => {
    const rows = sweepMdd(
      { nBlocks: 8, nGenotypes: 2, meanStock: 30, withinPlotCvPct: 25, alpha: 0.05, power: 0.8 },
      [8, 12, 16, 20],
      [4, 5, 6],
    );
    expect(rows.length).toBe(12);
    // Monotone in CV for any fixed sub-core count
    const c4 = rows.filter(r => r.nSubcores === 4).map(r => r.mddAbsolute);
    for (let i = 1; i < c4.length; i++) expect(c4[i]).toBeGreaterThan(c4[i - 1]);
  });
});
