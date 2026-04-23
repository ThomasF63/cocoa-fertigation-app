export interface SoilAnalytics {
  sample_id: string;
  plot_id: string;
  depth_label: string;
  analysis_lab?: string;
  analysis_date?: string;
  soc_g_kg?: number;
  tn_g_kg?: number;
  c_n_ratio?: number;
  ph_h2o?: number;
  ca_mmolc_dm3?: number;
  mg_mmolc_dm3?: number;
  k_mmolc_dm3?: number;
  al3_mmolc_dm3?: number;
  h_al_mmolc_dm3?: number;
  base_saturation_pct?: number;
  // N mineralisation — an incubation-based measurement on the same soil
  // sample (typically the 0–10 cm layer). Not a separate sample.
  incubation_lab?: string;
  incubation_start_date?: string;
  incubation_end_date?: string;
  day0_nh4_mg_kg?: number;
  day0_no3_mg_kg?: number;
  day56_nh4_mg_kg?: number;
  day56_no3_mg_kg?: number;
  net_min_rate_mg_kg_d?: number;
  notes?: string;
}

export interface SoilStock {
  plot_id: string;
  depth_label: string;
  depth_top_cm: number;
  depth_bottom_cm: number;
  layer_thickness_cm: number;
  bulk_density_g_cm3?: number;
  coarse_fragments_pct?: number;
  soc_g_kg?: number;
  tn_g_kg?: number;
  soc_stock_fd_mg_ha?: number;       // derived, fixed-depth
  tn_stock_fd_kg_ha?: number;
  soc_stock_esm_mg_ha?: number;      // derived, equivalent soil mass
  tn_stock_esm_kg_ha?: number;
  notes?: string;
}

export interface PlotSummary {
  plot_id: string;
  block: number;
  genotype: string;
  n_dose_kg_ha_yr: number;
  soc_stock_fd_0_40_mg_ha?: number;
  tn_stock_fd_0_40_kg_ha?: number;
  soc_stock_esm_0_40_mg_ha?: number;
  tn_stock_esm_0_40_kg_ha?: number;
  mean_stem_diameter_30cm_mm?: number;
  mean_tree_height_m?: number;
  mean_canopy_width_m?: number;
  net_min_rate_mg_kg_d?: number;
  notes?: string;
}
