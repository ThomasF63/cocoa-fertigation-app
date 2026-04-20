// Sample and measurement types, one for each table in data/.

import type { DepthCode } from "./design";

export interface SoilSample {
  sample_id: string;         // {plot_id}_D1..D4
  plot_id: string;
  depth_label: string;       // "0-10" ...
  depth_top_cm: number;
  depth_bottom_cm: number;
  sampling_date?: string;    // ISO
  sampler?: string;
  moisture_visual?: string;
  notes?: string;
}

export interface BDRing {
  ring_id: string;           // BD01_D1 .. BD16_D4
  plot_id?: string;          // assigned on-site
  depth_label: string;
  depth_top_cm: number;
  depth_bottom_cm: number;
  ring_volume_cm3?: number;
  fresh_weight_g?: number;
  oven_dry_weight_g?: number;
  bulk_density_g_cm3?: number; // derived
  sampling_date?: string;
  sampler?: string;
  notes?: string;
}

export interface LeafComposite {
  sample_id: string;         // {plot_id}_LEAF
  plot_id: string;
  sampling_date?: string;
  n_leaves_combined?: number;
  fresh_weight_g?: number;
  dry_weight_g?: number;
  observer?: string;
  notes?: string;
}

export interface NminSample {
  sample_id: string;         // {plot_id}_NMIN
  plot_id: string;
  lab?: string;
  incubation_start_date?: string;
  incubation_end_date?: string;
  day0_nh4_mg_kg?: number;
  day0_no3_mg_kg?: number;
  day56_nh4_mg_kg?: number;
  day56_no3_mg_kg?: number;
  net_min_rate_mg_kg_d?: number; // derived
  notes?: string;
}

export type DepthCodeExport = DepthCode;
