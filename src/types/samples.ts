// Sample and measurement types, one for each table in data/.

import type { DepthCode } from "./design";

export interface SoilSample {
  sample_id: string;         // {plot_id}_D1..Dn
  plot_id: string;
  depth_label: string;       // "0-10" ...
  depth_top_cm: number;
  depth_bottom_cm: number;
  n_subsamples?: number;     // number of field subsamples composited
  compositing_pattern?: string; // e.g. "W", "X", "grid", "random"
  coarse_fragments_pct?: number; // % mass >2 mm, for stock correction
  sampling_date?: string;    // ISO
  sampler?: string;
  moisture_visual?: string;
  notes?: string;
}

export interface BDRing {
  ring_id: string;           // BD01_D1 .. BDnn_Dm
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

export type DepthCodeExport = DepthCode;
