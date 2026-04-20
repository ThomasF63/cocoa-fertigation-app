import { describe as d, it, expect } from "vitest";
import { fitAnova, fitSplitPlotAnova, fPValue } from "./anova";

// Two-way ANOVA with interaction, balanced 2x2 design with 3 reps = 12 obs.
// Expected values hand-computed from cell means.
//
//   A=1     A=2
// B=1: 10,11,12   14,15,16
// B=2: 20,21,22   24,25,26

d("fitAnova two-way balanced", () => {
  it("matches hand-computed SS decomposition", () => {
    const y = [10, 11, 12, 14, 15, 16, 20, 21, 22, 24, 25, 26];
    const A = ["1", "1", "1", "2", "2", "2", "1", "1", "1", "2", "2", "2"];
    const B = ["1", "1", "1", "1", "1", "1", "2", "2", "2", "2", "2", "2"];
    const out = fitAnova({
      y,
      factors: { A, B },
      terms: ["A", "B", "A:B"],
    });
    // Grand mean = 18; cell means 11, 15, 21, 25; A means 16, 20; B means 13, 23
    // SS(A) = 6*((16-18)^2 + (20-18)^2) = 6*8 = 48
    // SS(B) = 6*((13-18)^2 + (23-18)^2) = 6*50 = 300
    // SS(AB) = 3*((11-16-13+18)^2 + (15-20-13+18)^2 + (21-16-23+18)^2 + (25-20-23+18)^2) = 0
    // SS(error) within cells = 3*((-1)^2+0+1^2) repeated 4 times = 4*2 = 8
    const a = out.terms.find(t => t.term === "A")!;
    const b = out.terms.find(t => t.term === "B")!;
    const ab = out.terms.find(t => t.term === "A:B")!;
    expect(a.ss).toBeCloseTo(48, 6);
    expect(b.ss).toBeCloseTo(300, 6);
    expect(ab.ss).toBeCloseTo(0, 6);
    expect(out.residual.ss).toBeCloseTo(8, 6);
    expect(out.residual.df).toBe(8);
    // F(A) = 48/1 / (8/8) = 48
    expect(a.f).toBeCloseTo(48, 4);
  });

  it("returns a p-value strictly between 0 and 1", () => {
    const y = [1, 2, 3, 4, 5, 6, 7, 8];
    const A = ["1", "1", "1", "1", "2", "2", "2", "2"];
    const out = fitAnova({ y, factors: { A }, terms: ["A"] });
    const p = out.terms[0].p!;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});

d("fPValue sanity", () => {
  it("large F is small p", () => {
    expect(fPValue(50, 1, 20)).toBeLessThan(0.001);
  });
  it("F=1 gives a non-significant p", () => {
    const p = fPValue(1, 1, 20);
    expect(p).toBeGreaterThan(0.1);
    expect(p).toBeLessThan(0.5);
  });
});

d("fitSplitPlotAnova balanced split-plot", () => {
  // 3 blocks x 2 whole-plot (G) x 2 sub-plot (D) = 12 obs, with realistic
  // noise in all strata (block x G interaction AND residual > 0) so that
  // every F-test is computable.
  //
  //            G=A           G=B
  // block=1  D1:10 D2:14    D1:21 D2:22
  // block=2  D1:11 D2:15    D1:24 D2:27
  // block=3  D1:14 D2:15    D1:22 D2:29
  const y       = [10,14,21,22, 11,15,24,27, 14,15,22,29];
  const block   = [1,1,1,1, 2,2,2,2, 3,3,3,3];
  const geno    = ["A","A","B","B", "A","A","B","B", "A","A","B","B"];
  const dose    = ["1","2","1","2", "1","2","1","2", "1","2","1","2"];

  const sp = fitSplitPlotAnova({
    y, block, wholePlot: geno, subPlot: dose,
    names: { wholePlot: "genotype", subPlot: "dose" },
  });

  const term = (name: string) => sp.f_tests.find(t => t.term === name);

  it("identifies the correct error strata", () => {
    expect(sp.error_strata.wp?.term).toBe("block:genotype");
    expect(sp.stratum_for_term["genotype"]).toBe("wp");
    expect(sp.stratum_for_term["dose"]).toBe("residual");
    expect(sp.stratum_for_term["genotype:dose"]).toBe("residual");
  });

  it("computes non-null F for treatment terms and null F for error strata", () => {
    expect(term("genotype")?.f).not.toBeNull();
    expect(term("dose")?.f).not.toBeNull();
    expect(term("genotype:dose")?.f).not.toBeNull();
    expect(term("block:genotype")?.f).toBeNull(); // error stratum, not tested
  });

  it("detects the strong between-genotype signal", () => {
    // G means: A ~= 13, B ~= 24; p should be small
    const g = term("genotype")!;
    expect(g.f as number).toBeGreaterThan(3);
    expect(g.p as number).toBeLessThan(0.1);
  });

  it("variance components are non-negative", () => {
    expect(sp.variance_components.residual.value).toBeGreaterThanOrEqual(0);
    expect(sp.variance_components.wholePlotError.value).toBeGreaterThanOrEqual(0);
  });

  it("sums of squares sum to total", () => {
    const termsSum = sp.f_tests.reduce((a, t) => a + t.ss, 0);
    const total = sp.anova.total.ss;
    expect(Math.abs((termsSum + sp.anova.residual.ss) - total)).toBeLessThan(1e-8);
  });
});
