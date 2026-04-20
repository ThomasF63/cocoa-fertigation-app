// Variable definitions and observation extraction across the IndexedDB stores.

import { getAll } from "../db/repo";
import type { Plot } from "../types/design";
import type { BDRing, LeafComposite, NminSample } from "../types/samples";
import type { TreeMeasurement } from "../types/measurements";
import type { SoilAnalytics, LeafAnalytics } from "../types/analytics";

export type VariableKey =
  | "spad_mean"
  | "stem_diameter_30cm_mm"
  | "soc_g_kg"
  | "tn_g_kg"
  | "ph_h2o"
  | "bulk_density_g_cm3"
  | "soil_delta15n"
  | "leaf_n_pct"
  | "leaf_delta15n"
  | "net_min_rate_mg_kg_d"
  | "leaf_fresh_weight_g"
  | "leaf_dry_weight_g";

export type VariableLevel = "plot" | "depth";

export interface VariableDef {
  key: VariableKey;
  label: string;
  unit: string;
  level: VariableLevel;          // observation unit
  higherIsBetter?: boolean;       // for chart cue only
}

export const VARIABLES: VariableDef[] = [
  { key: "spad_mean",            label: "SPAD (plot mean)",        unit: "",               level: "plot" },
  { key: "stem_diameter_30cm_mm",label: "Stem diameter @ 30 cm",   unit: "mm",             level: "plot" },
  { key: "soc_g_kg",             label: "SOC",                     unit: "g kg\u207B\u00B9",level: "depth" },
  { key: "tn_g_kg",              label: "Total N",                 unit: "g kg\u207B\u00B9",level: "depth" },
  { key: "ph_h2o",               label: "pH (H\u2082O)",           unit: "",               level: "depth" },
  { key: "bulk_density_g_cm3",   label: "Bulk density",            unit: "g cm\u207B\u00B3",level: "depth" },
  { key: "soil_delta15n",        label: "Soil \u03B4\u00B9\u2075N",unit: "\u2030",         level: "depth" },
  { key: "leaf_n_pct",           label: "Leaf N",                  unit: "%",              level: "plot" },
  { key: "leaf_delta15n",        label: "Leaf \u03B4\u00B9\u2075N",unit: "\u2030",         level: "plot" },
  { key: "net_min_rate_mg_kg_d", label: "Net N mineralisation",    unit: "mg kg\u207B\u00B9 d\u207B\u00B9", level: "plot" },
  { key: "leaf_fresh_weight_g",  label: "Leaf fresh weight",       unit: "g",              level: "plot" },
  { key: "leaf_dry_weight_g",    label: "Leaf dry weight",         unit: "g",              level: "plot" },
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
    case "spad_mean":
    case "stem_diameter_30cm_mm": {
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
    case "soil_delta15n": {
      const rows = await getAll<SoilAnalytics>("soil_analytics");
      for (const r of rows) addObs(out, idx[r.plot_id], r.delta15n_per_mil, { depth_label: r.depth_label });
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
    case "leaf_n_pct": {
      const rows = await getAll<LeafAnalytics>("leaf_analytics");
      for (const r of rows) addObs(out, idx[r.plot_id], r.n_concentration_pct);
      break;
    }
    case "leaf_delta15n": {
      const rows = await getAll<LeafAnalytics>("leaf_analytics");
      for (const r of rows) addObs(out, idx[r.plot_id], r.delta15n_per_mil);
      break;
    }
    case "net_min_rate_mg_kg_d": {
      const rows = await getAll<NminSample>("nmin_samples");
      for (const r of rows) addObs(out, idx[r.plot_id], r.net_min_rate_mg_kg_d);
      break;
    }
    case "leaf_fresh_weight_g":
    case "leaf_dry_weight_g": {
      const rows = await getAll<LeafComposite>("leaf_composites");
      for (const r of rows) {
        const v = (r as unknown as Record<string, unknown>)[key] as number | undefined;
        addObs(out, idx[r.plot_id], v);
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
