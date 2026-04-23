// Derived soil C and N stocks per plot and depth.
//
// Two conventions are reported:
//
//   1. Fixed-depth (FD): standard textbook formula
//        stock_fd = SOC_conc [g/kg] × BD [g/cm³] × thickness [cm]
//                   × (1 - CF/100) × 0.1                    (→ Mg C/ha)
//      where CF is the >2 mm coarse-fragment mass fraction (%).
//      BD comes from the balanced 12-plot subset — if the target plot was not
//      sampled, we use the treatment × depth mean (block × genotype × dose).
//
//   2. Equivalent soil mass (ESM): recomputes the stock for a reference mass
//      equal to the lightest observed cumulative fine-earth mass at each
//      depth. This removes bias from BD differences induced by treatment.
//      We use a single-layer ESM reassignment per depth, not the multi-layer
//      cubic-spline convention (Wendt & Hauser 2013 style) — the 2-3 depth
//      scheme is shallow enough that the simple approach is defensible.
//
// The implementation is intentionally self-contained: given the current
// contents of the IndexedDB stores, it returns per-(plot, depth) stocks.
// Returns an empty list when inputs are missing.

import { getAll } from "../db/repo";
import type { SoilSample, BDRing } from "../types/samples";
import type { SoilAnalytics, SoilStock } from "../types/analytics";
import type { Plot } from "../types/design";

const FD_CONV_SOC = 0.1;   // g/kg × g/cm³ × cm → Mg C/ha
const FD_CONV_TN  = 0.1 * 1000;  // Mg/ha → kg/ha (TN)

interface BdKey {
  depth_label: string;
  block: number;
  genotype: string;
  dose_code: string;
}

function bdKey(k: BdKey): string {
  return `${k.depth_label}|${k.block}|${k.genotype}|${k.dose_code}`;
}

/**
 * Compute SOC and TN stocks for every (plot × depth) that has both an
 * analytical value and a usable bulk density. Missing BD for a plot falls
 * back to the treatment × depth mean (block × genotype × dose cell).
 */
export async function computeSoilStocks(): Promise<SoilStock[]> {
  const [plots, samples, rings, analytics] = await Promise.all([
    getAll<Plot>("plots"),
    getAll<SoilSample>("soil_samples"),
    getAll<BDRing>("bd_rings"),
    getAll<SoilAnalytics>("soil_analytics"),
  ]);
  if (samples.length === 0 || analytics.length === 0) return [];

  const plotIdx = new Map<string, Plot>(plots.map(p => [p.plot_id, p]));
  const sampleIdx = new Map<string, SoilSample>(samples.map(s => [s.sample_id, s]));
  const analyticsIdx = new Map<string, SoilAnalytics>(analytics.map(a => [a.sample_id, a]));

  // Direct BD per (plot_id, depth_label)
  const bdByPlotDepth = new Map<string, number>();
  for (const r of rings) {
    if (!r.plot_id || r.bulk_density_g_cm3 == null) continue;
    bdByPlotDepth.set(`${r.plot_id}|${r.depth_label}`, r.bulk_density_g_cm3);
  }
  // Treatment-level BD mean per (block, genotype, dose, depth)
  const bdByTreatment = new Map<string, { sum: number; n: number }>();
  for (const r of rings) {
    if (!r.plot_id || r.bulk_density_g_cm3 == null) continue;
    const p = plotIdx.get(r.plot_id); if (!p) continue;
    const k = bdKey({ depth_label: r.depth_label, block: p.block, genotype: p.genotype, dose_code: p.dose_code });
    const cur = bdByTreatment.get(k) ?? { sum: 0, n: 0 };
    cur.sum += r.bulk_density_g_cm3; cur.n += 1;
    bdByTreatment.set(k, cur);
  }
  // Global fallback: mean BD per depth across all rings
  const bdByDepth = new Map<string, { sum: number; n: number }>();
  for (const r of rings) {
    if (r.bulk_density_g_cm3 == null) continue;
    const cur = bdByDepth.get(r.depth_label) ?? { sum: 0, n: 0 };
    cur.sum += r.bulk_density_g_cm3; cur.n += 1;
    bdByDepth.set(r.depth_label, cur);
  }

  function lookupBd(plotId: string, depthLabel: string): number | undefined {
    const direct = bdByPlotDepth.get(`${plotId}|${depthLabel}`);
    if (direct != null) return direct;
    const p = plotIdx.get(plotId); if (!p) return undefined;
    const tk = bdKey({ depth_label: depthLabel, block: p.block, genotype: p.genotype, dose_code: p.dose_code });
    const t = bdByTreatment.get(tk);
    if (t && t.n > 0) return t.sum / t.n;
    const g = bdByDepth.get(depthLabel);
    if (g && g.n > 0) return g.sum / g.n;
    return undefined;
  }

  // First pass: fixed-depth stocks for each analytics row
  const out: SoilStock[] = [];
  type Row = {
    plot_id: string;
    depth_label: string;
    depth_top_cm: number;
    depth_bottom_cm: number;
    thickness: number;
    bd?: number;
    cf_pct: number;
    soc_g_kg?: number;
    tn_g_kg?: number;
    fine_mass_mg_ha: number; // for ESM grouping
  };
  const rows: Row[] = [];

  for (const a of analytics) {
    const samp = sampleIdx.get(a.sample_id);
    if (!samp) continue;
    const thickness = samp.depth_bottom_cm - samp.depth_top_cm;
    const bd = lookupBd(samp.plot_id, samp.depth_label);
    const cf = samp.coarse_fragments_pct ?? 0;
    const fineFrac = Math.max(0, 1 - cf / 100);
    // Fine-earth mass per ha = BD × thickness × (1 - CF/100) × 100 (→ Mg/ha)
    const fineMassMgHa = (bd != null) ? bd * thickness * fineFrac * 100 : 0;
    rows.push({
      plot_id: samp.plot_id,
      depth_label: samp.depth_label,
      depth_top_cm: samp.depth_top_cm,
      depth_bottom_cm: samp.depth_bottom_cm,
      thickness,
      bd,
      cf_pct: cf,
      soc_g_kg: a.soc_g_kg,
      tn_g_kg: a.tn_g_kg,
      fine_mass_mg_ha: fineMassMgHa,
    });
  }

  // ESM reference mass per depth = lightest observed fine-earth mass across plots
  const refFineMassByDepth = new Map<string, number>();
  for (const r of rows) {
    if (r.fine_mass_mg_ha <= 0) continue;
    const cur = refFineMassByDepth.get(r.depth_label);
    if (cur == null || r.fine_mass_mg_ha < cur) refFineMassByDepth.set(r.depth_label, r.fine_mass_mg_ha);
  }

  for (const r of rows) {
    const fd_soc = (r.soc_g_kg != null && r.bd != null)
      ? r.soc_g_kg * r.bd * r.thickness * (1 - r.cf_pct / 100) * FD_CONV_SOC
      : undefined;
    const fd_tn = (r.tn_g_kg != null && r.bd != null)
      ? r.tn_g_kg * r.bd * r.thickness * (1 - r.cf_pct / 100) * FD_CONV_TN
      : undefined;

    // ESM: the stock per unit fine-earth mass is SOC_conc, so
    //   stock_esm = SOC_conc [g/kg] × refFineMass [Mg/ha] × 1e-3  (→ Mg C/ha)
    // This is equivalent to saying "how much C would be in the reference mass".
    const refMass = refFineMassByDepth.get(r.depth_label);
    const esm_soc = (r.soc_g_kg != null && refMass != null)
      ? r.soc_g_kg * refMass * 1e-3
      : undefined;
    const esm_tn = (r.tn_g_kg != null && refMass != null)
      ? r.tn_g_kg * refMass * 1e-3 * 1000
      : undefined;

    out.push({
      plot_id: r.plot_id,
      depth_label: r.depth_label,
      depth_top_cm: r.depth_top_cm,
      depth_bottom_cm: r.depth_bottom_cm,
      layer_thickness_cm: r.thickness,
      bulk_density_g_cm3: r.bd,
      coarse_fragments_pct: r.cf_pct,
      soc_g_kg: r.soc_g_kg,
      tn_g_kg: r.tn_g_kg,
      soc_stock_fd_mg_ha: fd_soc,
      tn_stock_fd_kg_ha: fd_tn,
      soc_stock_esm_mg_ha: esm_soc,
      tn_stock_esm_kg_ha: esm_tn,
    });
  }

  return out;
}
