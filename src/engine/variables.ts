// Variable definitions and observation extraction across the IndexedDB stores.

import { getAll } from "../db/repo";
import type { Plot } from "../types/design";
import type { SoilSample, BDRing } from "../types/samples";
import type { TreeMeasurement } from "../types/measurements";
import type { SoilAnalytics } from "../types/analytics";
import { computeSoilStocks } from "./derived";

export type VariableKey =
  | "stem_diameter_5cm_mm"
  | "stem_diameter_30cm_mm"
  | "stem_diameter_50cm_mm"
  | "stem_diameter_130cm_mm"
  | "tree_height_m"
  | "canopy_width_mean_m"
  | "soc_g_kg"
  | "tn_g_kg"
  | "ph_h2o"
  | "bulk_density_g_cm3"
  | "coarse_fragments_pct"
  | "soc_stock_fd_mg_ha"
  | "soc_stock_esm_mg_ha"
  | "tn_stock_fd_kg_ha"
  | "tn_stock_esm_kg_ha"
  | "net_min_rate_mg_kg_d";

export type VariableLevel = "plot" | "depth";

export type VariableCategory =
  | "tree_growth"
  | "soil_chemistry"
  | "soil_physical"
  | "soil_stocks"
  | "n_mineralisation";

export interface VariableCategoryDef {
  key: VariableCategory;
  label: string;
}

export const VARIABLE_CATEGORIES: VariableCategoryDef[] = [
  { key: "tree_growth",      label: "Tree growth" },
  { key: "soil_chemistry",   label: "Soil chemistry" },
  { key: "soil_physical",    label: "Soil physical" },
  { key: "soil_stocks",      label: "Soil stocks" },
  { key: "n_mineralisation", label: "N mineralisation" },
];

export interface VariableDef {
  key: VariableKey;
  label: string;
  unit: string;
  level: VariableLevel;          // observation unit
  category: VariableCategory;
  higherIsBetter?: boolean;       // for chart cue only
}

export const VARIABLES: VariableDef[] = [
  { key: "stem_diameter_5cm_mm",  label: "Stem diameter @ 5 cm",    unit: "mm",             level: "plot",  category: "tree_growth" },
  { key: "stem_diameter_30cm_mm", label: "Stem diameter @ 30 cm",   unit: "mm",             level: "plot",  category: "tree_growth" },
  { key: "stem_diameter_50cm_mm", label: "Stem diameter @ 50 cm",   unit: "mm",             level: "plot",  category: "tree_growth" },
  { key: "stem_diameter_130cm_mm",label: "Stem diameter @ 130 cm (DBH)", unit: "mm",        level: "plot",  category: "tree_growth" },
  { key: "tree_height_m",         label: "Tree height",             unit: "m",              level: "plot",  category: "tree_growth" },
  { key: "canopy_width_mean_m",   label: "Canopy width (mean)",     unit: "m",              level: "plot",  category: "tree_growth" },
  { key: "soc_g_kg",             label: "SOC",                     unit: "g kg\u207B\u00B9",level: "depth", category: "soil_chemistry" },
  { key: "tn_g_kg",              label: "Total N",                 unit: "g kg\u207B\u00B9",level: "depth", category: "soil_chemistry" },
  { key: "ph_h2o",               label: "pH (H\u2082O)",           unit: "",               level: "depth", category: "soil_chemistry" },
  { key: "bulk_density_g_cm3",   label: "Bulk density",            unit: "g cm\u207B\u00B3",level: "depth", category: "soil_physical" },
  { key: "coarse_fragments_pct", label: "Coarse fragments (>2 mm)",unit: "% mass",         level: "depth", category: "soil_physical" },
  { key: "soc_stock_fd_mg_ha",   label: "SOC stock (fixed-depth)", unit: "Mg ha\u207B\u00B9",level: "depth", category: "soil_stocks" },
  { key: "soc_stock_esm_mg_ha",  label: "SOC stock (ESM)",         unit: "Mg ha\u207B\u00B9",level: "depth", category: "soil_stocks" },
  { key: "tn_stock_fd_kg_ha",    label: "TN stock (fixed-depth)",  unit: "kg ha\u207B\u00B9",level: "depth", category: "soil_stocks" },
  { key: "tn_stock_esm_kg_ha",   label: "TN stock (ESM)",          unit: "kg ha\u207B\u00B9",level: "depth", category: "soil_stocks" },
  { key: "net_min_rate_mg_kg_d", label: "Net N mineralisation",    unit: "mg kg\u207B\u00B9 d\u207B\u00B9", level: "plot", category: "n_mineralisation" },
];

export interface Observation {
  plot_id: string;
  block: number;
  genotype: string;            // label
  dose_code: "L" | "M" | "H";
  n_dose_kg_ha_yr: number;
  depth_label?: string;        // present only for depth-level vars
  depth_top_cm?: number;
  value: number;
}

interface PlotIndex {
  [plot_id: string]: Plot;
}

function index(plots: Plot[]): PlotIndex {
  const o: PlotIndex = {};
  for (const p of plots) o[p.plot_id] = p;
  return o;
}

function addObs(out: Observation[], plot: Plot | undefined, v: number | undefined, extras: Partial<Observation> = {}) {
  if (!plot || v === undefined || v === null || !Number.isFinite(v)) return;
  out.push({
    plot_id: plot.plot_id,
    block: plot.block,
    genotype: plot.genotype_label,
    dose_code: plot.dose_code,
    n_dose_kg_ha_yr: plot.n_dose_kg_ha_yr,
    value: v,
    ...extras,
  });
}

export async function extractObservations(key: VariableKey): Promise<Observation[]> {
  const plots = await getAll<Plot>("plots");
  const idx = index(plots);
  const out: Observation[] = [];

  switch (key) {
    case "stem_diameter_5cm_mm":
    case "stem_diameter_30cm_mm":
    case "stem_diameter_50cm_mm":
    case "stem_diameter_130cm_mm":
    case "tree_height_m":
    case "canopy_width_mean_m": {
      const meas = await getAll<TreeMeasurement>("tree_measurements");
      // Aggregate tree to plot-level mean
      const byPlot = new Map<string, number[]>();
      for (const m of meas) {
        const val = (m as unknown as Record<string, unknown>)[key] as number | undefined;
        if (typeof val !== "number" || !Number.isFinite(val)) continue;
        const arr = byPlot.get(m.plot_id) ?? [];
        arr.push(val); byPlot.set(m.plot_id, arr);
      }
      for (const [plot_id, vals] of byPlot) {
        const p = idx[plot_id];
        if (!p || vals.length === 0) continue;
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        addObs(out, p, avg);
      }
      break;
    }
    case "soc_g_kg":
    case "tn_g_kg":
    case "ph_h2o": {
      const rows = await getAll<SoilAnalytics>("soil_analytics");
      for (const r of rows) {
        const p = idx[r.plot_id];
        const v = (r as unknown as Record<string, unknown>)[key] as number | undefined;
        addObs(out, p, v, { depth_label: r.depth_label });
      }
      break;
    }
    case "bulk_density_g_cm3": {
      const rings = await getAll<BDRing>("bd_rings");
      for (const r of rings) {
        if (!r.plot_id) continue;
        addObs(out, idx[r.plot_id], r.bulk_density_g_cm3, { depth_label: r.depth_label });
      }
      break;
    }
    case "coarse_fragments_pct": {
      const rows = await getAll<SoilSample>("soil_samples");
      for (const r of rows) addObs(out, idx[r.plot_id], r.coarse_fragments_pct, { depth_label: r.depth_label });
      break;
    }
    case "soc_stock_fd_mg_ha":
    case "soc_stock_esm_mg_ha":
    case "tn_stock_fd_kg_ha":
    case "tn_stock_esm_kg_ha": {
      // Derived stocks: computed on-the-fly from soil_samples + bd_rings + soil_analytics.
      const stocks = await computeSoilStocks();
      for (const s of stocks) {
        const v = (s as unknown as Record<string, unknown>)[key] as number | undefined;
        addObs(out, idx[s.plot_id], v, { depth_label: s.depth_label });
      }
      break;
    }
    case "net_min_rate_mg_kg_d": {
      // N-min is an incubation-based measurement on an existing soil sample
      // (typically the 0–10 cm horizon). It lives as columns on the
      // soil_analytics row for that plot × depth, so extract it from there
      // wherever the rate column is populated — the sampling plan decides
      // which depth the lab actually ran it on.
      const rows = await getAll<SoilAnalytics>("soil_analytics");
      for (const r of rows) {
        if (r.net_min_rate_mg_kg_d == null) continue;
        addObs(out, idx[r.plot_id], r.net_min_rate_mg_kg_d);
      }
      break;
    }
  }
  return out;
}

export function variableDef(key: VariableKey): VariableDef {
  const v = VARIABLES.find(x => x.key === key);
  if (!v) throw new Error("Unknown variable " + key);
  return v;
}
