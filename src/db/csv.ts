// CSV import / export. Column order and naming match data/build_data_templates.js
// so exports round-trip into the project's data/ folder.

import { parseCsv, toCsv, numOrUndef, strOrUndef } from "../utils/csvParse";
import { bulkPut } from "./repo";
import type { StoreName } from "./schema";
import type { Plot, Tree } from "../types/design";
import type { SoilSample, BDRing } from "../types/samples";
import type { TreeMeasurement } from "../types/measurements";
import type { SoilAnalytics } from "../types/analytics";

// ----- Header definitions (exact order matches data/ templates) -----

export const HEADERS: Record<StoreName | "soil_stocks" | "plot_summary", string[]> = {
  plots: [
    "plot_id","block","genotype","n_dose_kg_ha_yr","dose_code",
    "scion","rootstock","trees_per_plot","measurement_trees_n",
    "plot_lat","plot_lon","notes",
  ],
  trees: ["tree_id","plot_id","tree_number_in_plot","tag_id","tagged_date","notes"],
  soil_samples: [
    "sample_id","plot_id","depth_label","depth_top_cm","depth_bottom_cm",
    "n_subsamples","compositing_pattern","coarse_fragments_pct",
    "sampling_date","sampler","moisture_visual","notes",
  ],
  bd_rings: [
    "ring_id","plot_id","depth_label","depth_top_cm","depth_bottom_cm",
    "ring_volume_cm3","fresh_weight_g","oven_dry_weight_g","bulk_density_g_cm3",
    "sampling_date","sampler","notes",
  ],
  tree_measurements: [
    "tree_id","plot_id","measurement_date",
    "stem_diameter_5cm_mm","stem_diameter_30cm_mm",
    "stem_diameter_50cm_mm","stem_diameter_130cm_mm",
    "tree_height_m",
    "canopy_width_along_row_m","canopy_width_across_row_m","canopy_width_mean_m",
    "observer","notes",
  ],
  soil_analytics: [
    "sample_id","plot_id","depth_label","analysis_lab","analysis_date",
    "soc_g_kg","tn_g_kg","c_n_ratio","ph_h2o",
    "ca_mmolc_dm3","mg_mmolc_dm3","k_mmolc_dm3",
    "al3_mmolc_dm3","h_al_mmolc_dm3","base_saturation_pct",
    "incubation_lab","incubation_start_date","incubation_end_date",
    "day0_nh4_mg_kg","day0_no3_mg_kg",
    "day56_nh4_mg_kg","day56_no3_mg_kg",
    "net_min_rate_mg_kg_d",
    "notes",
  ],
  soil_stocks: [
    "plot_id","depth_label","depth_top_cm","depth_bottom_cm","layer_thickness_cm",
    "bulk_density_g_cm3","coarse_fragments_pct","soc_g_kg","tn_g_kg",
    "soc_stock_fd_mg_ha","tn_stock_fd_kg_ha",
    "soc_stock_esm_mg_ha","tn_stock_esm_kg_ha",
    "notes",
  ],
  plot_summary: [
    "plot_id","block","genotype","n_dose_kg_ha_yr",
    "soc_stock_fd_0_40_mg_ha","tn_stock_fd_0_40_kg_ha",
    "soc_stock_esm_0_40_mg_ha","tn_stock_esm_0_40_kg_ha",
    "mean_stem_diameter_30cm_mm","mean_tree_height_m","mean_canopy_width_m",
    "net_min_rate_mg_kg_d","notes",
  ],
};

// Maps a filename (without path) to a store.
export const FILENAME_TO_STORE: Record<string, StoreName> = {
  "plot_register.csv":         "plots",
  "tree_register.csv":         "trees",
  "soil_samples.csv":          "soil_samples",
  "bulk_density_rings.csv":    "bd_rings",
  "tree_measurements.csv":     "tree_measurements",
  "soil_analytics.csv":        "soil_analytics",
};

// ----- Row coercion per store -----

function byHeader(header: string[], row: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) o[header[i]] = row[i] ?? "";
  return o;
}

function rowToPlot(r: Record<string, string>): Plot {
  return {
    plot_id: r.plot_id,
    block: Number(r.block) as Plot["block"],
    genotype: r.genotype === "CCN 51" || r.genotype === "CCN51" ? "CCN51" : "PS1319",
    genotype_label: (r.genotype === "CCN51" ? "CCN 51" : r.genotype === "PS1319" ? "PS 13.19" : r.genotype) as Plot["genotype_label"],
    dose_code: r.dose_code as Plot["dose_code"],
    n_dose_kg_ha_yr: Number(r.n_dose_kg_ha_yr),
    rootstock: r.rootstock || "VB 1151",
    trees_per_plot: Number(r.trees_per_plot) || 96,
    measurement_trees_n: Number(r.measurement_trees_n) || 24,
    plot_lat: strOrUndef(r.plot_lat),
    plot_lon: strOrUndef(r.plot_lon),
    notes: strOrUndef(r.notes),
  };
}

function rowToTree(r: Record<string, string>): Tree {
  return {
    tree_id: r.tree_id,
    plot_id: r.plot_id,
    tree_number_in_plot: Number(r.tree_number_in_plot),
    tag_id: strOrUndef(r.tag_id),
    tagged_date: strOrUndef(r.tagged_date),
    notes: strOrUndef(r.notes),
  };
}

function rowToSoilSample(r: Record<string, string>): SoilSample {
  return {
    sample_id: r.sample_id,
    plot_id: r.plot_id,
    depth_label: r.depth_label,
    depth_top_cm: Number(r.depth_top_cm),
    depth_bottom_cm: Number(r.depth_bottom_cm),
    n_subsamples: numOrUndef(r.n_subsamples),
    compositing_pattern: strOrUndef(r.compositing_pattern),
    coarse_fragments_pct: numOrUndef(r.coarse_fragments_pct),
    sampling_date: strOrUndef(r.sampling_date),
    sampler: strOrUndef(r.sampler),
    moisture_visual: strOrUndef(r.moisture_visual),
    notes: strOrUndef(r.notes),
  };
}

function rowToBDRing(r: Record<string, string>): BDRing {
  return {
    ring_id: r.ring_id,
    plot_id: strOrUndef(r.plot_id),
    depth_label: r.depth_label,
    depth_top_cm: Number(r.depth_top_cm),
    depth_bottom_cm: Number(r.depth_bottom_cm),
    ring_volume_cm3: numOrUndef(r.ring_volume_cm3),
    fresh_weight_g: numOrUndef(r.fresh_weight_g),
    oven_dry_weight_g: numOrUndef(r.oven_dry_weight_g),
    bulk_density_g_cm3: numOrUndef(r.bulk_density_g_cm3),
    sampling_date: strOrUndef(r.sampling_date),
    sampler: strOrUndef(r.sampler),
    notes: strOrUndef(r.notes),
  };
}

function rowToTreeMeasurement(r: Record<string, string>): TreeMeasurement {
  return {
    tree_id: r.tree_id,
    plot_id: r.plot_id,
    measurement_date: strOrUndef(r.measurement_date),
    stem_diameter_5cm_mm: numOrUndef(r.stem_diameter_5cm_mm),
    stem_diameter_30cm_mm: numOrUndef(r.stem_diameter_30cm_mm),
    stem_diameter_50cm_mm: numOrUndef(r.stem_diameter_50cm_mm),
    stem_diameter_130cm_mm: numOrUndef(r.stem_diameter_130cm_mm),
    tree_height_m: numOrUndef(r.tree_height_m),
    canopy_width_along_row_m: numOrUndef(r.canopy_width_along_row_m),
    canopy_width_across_row_m: numOrUndef(r.canopy_width_across_row_m),
    canopy_width_mean_m: numOrUndef(r.canopy_width_mean_m),
    observer: strOrUndef(r.observer),
    notes: strOrUndef(r.notes),
  };
}

function rowToSoilAnalytics(r: Record<string, string>): SoilAnalytics {
  return {
    sample_id: r.sample_id,
    plot_id: r.plot_id,
    depth_label: r.depth_label,
    analysis_lab: strOrUndef(r.analysis_lab),
    analysis_date: strOrUndef(r.analysis_date),
    soc_g_kg: numOrUndef(r.soc_g_kg),
    tn_g_kg: numOrUndef(r.tn_g_kg),
    c_n_ratio: numOrUndef(r.c_n_ratio),
    ph_h2o: numOrUndef(r.ph_h2o),
    ca_mmolc_dm3: numOrUndef(r.ca_mmolc_dm3),
    mg_mmolc_dm3: numOrUndef(r.mg_mmolc_dm3),
    k_mmolc_dm3: numOrUndef(r.k_mmolc_dm3),
    al3_mmolc_dm3: numOrUndef(r.al3_mmolc_dm3),
    h_al_mmolc_dm3: numOrUndef(r.h_al_mmolc_dm3),
    base_saturation_pct: numOrUndef(r.base_saturation_pct),
    incubation_lab: strOrUndef(r.incubation_lab),
    incubation_start_date: strOrUndef(r.incubation_start_date),
    incubation_end_date: strOrUndef(r.incubation_end_date),
    day0_nh4_mg_kg: numOrUndef(r.day0_nh4_mg_kg),
    day0_no3_mg_kg: numOrUndef(r.day0_no3_mg_kg),
    day56_nh4_mg_kg: numOrUndef(r.day56_nh4_mg_kg),
    day56_no3_mg_kg: numOrUndef(r.day56_no3_mg_kg),
    net_min_rate_mg_kg_d: numOrUndef(r.net_min_rate_mg_kg_d),
    notes: strOrUndef(r.notes),
  };
}

type Coercer = (r: Record<string, string>) => unknown;
const COERCERS: Record<StoreName, Coercer> = {
  plots: rowToPlot,
  trees: rowToTree,
  soil_samples: rowToSoilSample,
  bd_rings: rowToBDRing,
  tree_measurements: rowToTreeMeasurement,
  soil_analytics: rowToSoilAnalytics,
};

// ----- Import -----

export interface ImportResult {
  store: StoreName;
  filename: string;
  rowCount: number;
}

export async function importCsvFile(file: File): Promise<ImportResult> {
  const store = FILENAME_TO_STORE[file.name];
  if (!store) throw new Error(`Unrecognised filename: ${file.name}`);
  const text = await file.text();
  const { header, rows } = parseCsv(text);
  const dicts = rows.map(r => byHeader(header, r));
  const coercer = COERCERS[store];
  const values = dicts.map(d => coercer(d));
  await bulkPut(store, values);
  return { store, filename: file.name, rowCount: values.length };
}

// ----- Export -----

function rowFor(store: StoreName, v: Record<string, unknown>): (string | number)[] {
  const header = HEADERS[store];
  return header.map(col => {
    const val = v[col];
    if (val === undefined || val === null) return "";
    return val as string | number;
  });
}

export function exportStoreToCsv(store: StoreName, items: Record<string, unknown>[]): string {
  const header = HEADERS[store];
  const rows = items.map(v => rowFor(store, v));
  return toCsv(header, rows);
}
