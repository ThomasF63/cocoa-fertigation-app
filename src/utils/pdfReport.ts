// Auto-assembled interim data report for the MCCS Phase 2 paper.
// Pulls live data from IndexedDB, runs descriptive + inferential stats, and
// composes a multi-page PDF with the Ekodama palette.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { countsByStore } from "../db/repo";
import type { StoreName } from "../db/schema";
import { VARIABLES, extractObservations, variableDef, type VariableKey, type Observation } from "../engine/variables";
import { describe, groupBy, sig } from "../engine/statsEngine";
import { fitAnova, fitSplitPlotAnova } from "../engine/anova";

const C = {
  soilHex:     [59, 50, 44]   as [number, number, number],
  soilDarkHex: [42, 35, 30]   as [number, number, number],
  sandHex:     [232, 223, 210] as [number, number, number],
  stemHex:     [101, 125, 88] as [number, number, number],
  terraHex:    [196, 107, 66] as [number, number, number],
  rootHex:     [247, 245, 240] as [number, number, number],
  ink:         [51, 51, 51]   as [number, number, number],
  muted:       [120, 115, 108] as [number, number, number],
};

const TARGETS: Record<StoreName, number> = {
  plots: 48, trees: 576, soil_samples: 192, bd_rings: 64, leaf_composites: 48,
  nmin_samples: 48, tree_measurements: 576, soil_analytics: 192, leaf_analytics: 48,
};
const LABELS: Record<StoreName, string> = {
  plots: "Plots", trees: "Trees",
  soil_samples: "Soil samples", bd_rings: "BD rings",
  leaf_composites: "Leaf composites", nmin_samples: "N-min samples",
  tree_measurements: "Tree measurements", soil_analytics: "Soil analytics",
  leaf_analytics: "Leaf analytics",
};

function fmtP(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "-";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
function stars(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01)  return "**";
  if (p < 0.05)  return "*";
  if (p < 0.1)   return ".";
  return "";
}

export interface ReportOptions {
  variables?: VariableKey[]; // variables to include in the analytical sections
}

export async function generateReport(opts: ReportOptions = {}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = 0;

  function header(title: string, subtitle?: string) {
    doc.setFillColor(...C.soilDarkHex);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(...C.rootHex);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, margin, 14);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(subtitle, margin, 21);
    }
    doc.setTextColor(...C.ink);
    y = 38;
  }

  function sectionTitle(s: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.soilDarkHex);
    doc.text(s, margin, y);
    doc.setDrawColor(...C.terraHex);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 1.5, margin + 20, y + 1.5);
    y += 7;
    doc.setTextColor(...C.ink);
  }

  function paragraph(text: string, size = 9.5) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...C.ink);
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.42) + 2;
  }

  function ensureSpace(mm: number) {
    if (y + mm > pageH - 16) {
      addFooter();
      doc.addPage();
      y = margin;
    }
  }

  let pageNum = 1;
  function addFooter() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    const stamp = new Date().toISOString().slice(0, 10);
    doc.text(`MCCS cocoa fertigation, Phase 2 interim report, ${stamp}`, margin, pageH - 8);
    doc.text(`p. ${pageNum}`, pageW - margin, pageH - 8, { align: "right" });
    pageNum++;
  }

  // ---------- Cover + completion ----------
  header("MCCS cocoa fertigation", "Phase 2 paper, interim data report");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.muted);
  doc.text(
    [
      `Date of report: ${new Date().toISOString().slice(0, 10)}`,
      "Site: MCCS, Barro Preto, Bahia, Brazil",
      "Design: split-plot RCBD, 8 blocks x 2 genotypes x 3 N doses, 48 plots",
      "Genotypes: CCN 51, PS 13.19 on VB 1151 rootstock",
      "N doses: 56, 226, 340 kg N ha-1 yr-1 (urea, drip fertigation)",
    ].join("\n"),
    margin, y
  );
  y += 26;
  doc.setTextColor(...C.ink);

  sectionTitle("1. Data collection status");

  const counts = await countsByStore();
  const rows = (Object.keys(TARGETS) as StoreName[]).map(s => [
    LABELS[s],
    String(counts[s] ?? 0),
    String(TARGETS[s]),
    `${Math.round((100 * (counts[s] ?? 0)) / TARGETS[s])}%`,
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Table", "Entered", "Target", "Progress"]],
    body: rows,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: { fillColor: C.soilHex, textColor: C.rootHex, font: "helvetica", fontStyle: "bold", fontSize: 9 },
    bodyStyles:  { font: "helvetica", fontSize: 9, textColor: C.ink },
    alternateRowStyles: { fillColor: [245, 243, 237] },
  });
  // @ts-expect-error autoTable adds lastAutoTable at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // ---------- Methods snippet ----------
  ensureSpace(60);
  sectionTitle("2. Methods snippet");
  paragraph(
    "This report summarises the cross-sectional (space-for-time) sampling campaign carried out on the ongoing Macedo (2025) N fertigation trial at MCCS, during a 3 to 4 day window in April 2026. The campaign comprises depth-resolved soil sampling (0 to 10, 10 to 20, 20 to 30, 30 to 50 cm), tree measurements on the 12 central trees of each plot (SPAD chlorophyll, stem diameter at 30 cm), and plot-level leaf composites. Post-visit laboratory analyses comprise SOC and TN by dry combustion, 56-day aerobic N mineralisation incubation, natural abundance delta 15N, pH and exchangeable bases, and leaf tissue N."
  );
  paragraph(
    "Archived 2021 and 2022 soils from the original Macedo trial were no longer available at the time of this study. A retrospective reconstruction of SOC and TN stocks was therefore not possible, and the present analysis is based on a single cross-sectional campaign. Partial nitrogen mass balance and first-pass net global warming potential are computed in conjunction with the plant biomass, tissue N and fertigation records of Macedo (2025). Proper temporal stock-change inference is out of scope for this paper."
  );

  // ---------- Analytical sections per variable ----------
  const varsToInclude: VariableKey[] = opts.variables
    ?? VARIABLES.map(v => v.key);

  const variablesWithData: { key: VariableKey; obs: Observation[] }[] = [];
  for (const key of varsToInclude) {
    const obs = await extractObservations(key);
    if (obs.length > 0) variablesWithData.push({ key, obs });
  }

  if (variablesWithData.length === 0) {
    ensureSpace(30);
    sectionTitle("3. Analytical results");
    paragraph("No measurement data has been entered yet. Enter data in the app's Data entry tab, then regenerate this report.");
  } else {
    ensureSpace(20);
    sectionTitle(`3. Analytical results (${variablesWithData.length} variable${variablesWithData.length === 1 ? "" : "s"} with data)`);
  }

  for (const { key, obs } of variablesWithData) {
    const def = variableDef(key);
    const depthResolved = def.level === "depth";

    ensureSpace(70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.stemHex);
    doc.text(`${def.label}${def.unit ? ` (${def.unit})` : ""}`, margin, y);
    y += 2;
    doc.setDrawColor(...C.sandHex);
    doc.line(margin, y + 1, pageW - margin, y + 1);
    y += 6;
    doc.setTextColor(...C.ink);

    // Descriptive table
    const keyFn = depthResolved
      ? (o: Observation) => `${o.genotype}|${o.n_dose_kg_ha_yr}|${o.depth_label ?? ""}`
      : (o: Observation) => `${o.genotype}|${o.n_dose_kg_ha_yr}`;
    const groups = groupBy(obs, keyFn);
    const descRows: string[][] = [];
    for (const [k, arr] of groups) {
      const [gen, dose, depth] = k.split("|");
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      descRows.push([
        gen, dose,
        ...(depthResolved ? [depth] : []),
        String(d.n), sig(d.mean), sig(d.sd), sig(d.se),
        `${sig(d.ci95_lo)} – ${sig(d.ci95_hi)}`,
      ]);
    }
    descRows.sort((a, b) =>
      a[0].localeCompare(b[0]) ||
      Number(a[1]) - Number(b[1]) ||
      (depthResolved ? (a[2] || "").localeCompare(b[2] || "") : 0),
    );

    autoTable(doc, {
      startY: y,
      head: [[
        "Genotype", "N dose",
        ...(depthResolved ? ["Depth"] : []),
        "n", "Mean", "SD", "SE", "95% CI",
      ]],
      body: descRows,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: C.soilHex, textColor: C.rootHex, fontSize: 8, fontStyle: "bold" },
      bodyStyles:  { fontSize: 8, textColor: C.ink },
      alternateRowStyles: { fillColor: [245, 243, 237] },
    });
    // @ts-expect-error autoTable lastAutoTable at runtime
    y = (doc.lastAutoTable?.finalY ?? y) + 4;

    // Fixed-effects ANOVA
    ensureSpace(40);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text("Fixed-effects ANOVA (Type I, block treated as fixed)", margin, y);
    y += 4;
    doc.setTextColor(...C.ink);

    try {
      const anova = fitAnova({
        y: obs.map(o => o.value),
        factors: depthResolved ? {
          block: obs.map(o => o.block),
          genotype: obs.map(o => o.genotype),
          dose: obs.map(o => o.n_dose_kg_ha_yr),
          depth: obs.map(o => o.depth_label ?? ""),
        } : {
          block: obs.map(o => o.block),
          genotype: obs.map(o => o.genotype),
          dose: obs.map(o => o.n_dose_kg_ha_yr),
        },
        terms: depthResolved
          ? ["block", "genotype", "dose", "depth", "genotype:dose", "genotype:depth", "dose:depth", "genotype:dose:depth"]
          : ["block", "genotype", "dose", "genotype:dose"],
      });
      const anovaRows = anova.terms.map(t => [
        t.term, String(t.df), sig(t.ss), sig(t.ms),
        t.f === null ? "-" : sig(t.f),
        fmtP(t.p), stars(t.p),
      ]);
      anovaRows.push([
        "Residual", String(anova.residual.df), sig(anova.residual.ss), sig(anova.residual.ms), "-", "-", "",
      ]);
      autoTable(doc, {
        startY: y,
        head: [["Term", "df", "SS", "MS", "F", "p", "sig"]],
        body: anovaRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.soilHex, textColor: C.rootHex, fontSize: 8, fontStyle: "bold" },
        bodyStyles:  { fontSize: 8, textColor: C.ink },
        alternateRowStyles: { fillColor: [245, 243, 237] },
      });
      // @ts-expect-error autoTable lastAutoTable at runtime
      y = (doc.lastAutoTable?.finalY ?? y) + 4;
    } catch (e) {
      paragraph(`(fixed-effects ANOVA failed: ${String(e)})`, 8);
    }

    // Mixed-effects split-plot
    ensureSpace(40);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text("Mixed-effects split-plot (correct error strata; block as random effect)", margin, y);
    y += 4;
    doc.setTextColor(...C.ink);

    try {
      const sp = fitSplitPlotAnova({
        y: obs.map(o => o.value),
        block: obs.map(o => o.block),
        wholePlot: obs.map(o => o.genotype),
        subPlot: obs.map(o => o.n_dose_kg_ha_yr),
        subSubPlot: depthResolved ? obs.map(o => o.depth_label ?? "") : undefined,
        names: { wholePlot: "genotype", subPlot: "dose", subSubPlot: "depth" },
      });
      const fRows = sp.f_tests.map(t => {
        const strat = sp.stratum_for_term[t.term] ?? "residual";
        const isErrorStratum = t.term.startsWith("block:") && t.term !== "block";
        return [
          isErrorStratum ? `${t.term} (error stratum)` : t.term,
          String(t.df),
          sig(t.ms),
          t.f === null ? "-" : sig(t.f),
          isErrorStratum ? "-" : (strat === "wp" ? "whole-plot" : strat === "sp" ? "sub-plot" : "residual"),
          fmtP(t.p), stars(t.p),
        ];
      });
      fRows.push([
        "Residual", String(sp.anova.residual.df), sig(sp.anova.residual.ms), "-", "-", "-", "",
      ]);
      autoTable(doc, {
        startY: y,
        head: [["Term", "df", "MS", "F", "Error stratum", "p", "sig"]],
        body: fRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.soilHex, textColor: C.rootHex, fontSize: 8, fontStyle: "bold" },
        bodyStyles:  { fontSize: 8, textColor: C.ink },
        alternateRowStyles: { fillColor: [245, 243, 237] },
      });
      // @ts-expect-error autoTable lastAutoTable at runtime
      y = (doc.lastAutoTable?.finalY ?? y) + 4;

      // Variance components
      ensureSpace(20);
      const vc = sp.variance_components;
      const vcRows: string[][] = [
        ["whole-plot", sig(vc.wholePlotError.value), vc.wholePlotError.label],
      ];
      if (vc.subPlotError) vcRows.push(["sub-plot", sig(vc.subPlotError.value), vc.subPlotError.label]);
      vcRows.push(["residual", sig(vc.residual.value), vc.residual.label]);
      autoTable(doc, {
        startY: y,
        head: [["Stratum", "Variance", "Source"]],
        body: vcRows,
        theme: "plain",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.sandHex, textColor: C.soilDarkHex, fontSize: 8, fontStyle: "bold" },
        bodyStyles:  { fontSize: 8, textColor: C.ink },
      });
      // @ts-expect-error autoTable lastAutoTable at runtime
      y = (doc.lastAutoTable?.finalY ?? y) + 8;
    } catch (e) {
      paragraph(`(split-plot fit failed: ${String(e)})`, 8);
    }
  }

  // ---------- Notes ----------
  ensureSpace(40);
  sectionTitle("4. Notes and caveats");
  paragraph(
    "Scope. This report covers only the cross-sectional Phase 2 campaign. GHG fluxes, 15N tracer work, post-fertigation mineral N time series and long-term temporal SOC change are out of scope for this paper."
  );
  paragraph(
    "Inference. The Fixed-effects ANOVA treats block as a fixed factor; the Mixed-effects split-plot ANOVA applies the correct error strata (whole-plot error = block x genotype; sub-plot error = block x genotype x dose when depth is included; residual otherwise). For balanced data these strata-based F-tests are numerically equivalent to lme4::lmer REML with (1|block:genotype) and (1|block:genotype:dose). Variance components are method-of-moments estimates that coincide with REML for balanced designs."
  );
  paragraph(
    "Significance codes used throughout: *** p<0.001, ** p<0.01, * p<0.05, . p<0.1."
  );

  addFooter();

  return doc.output("blob");
}
