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
  delta15n_per_mil?: number;
  notes?: string;
}

export interface LeafAnalytics {
  sample_id: string;
  plot_id: string;
  lab?: string;
  analysis_date?: string;
  n_concentration_pct?: number;
  delta15n_per_mil?: number;
  notes?: string;
}

export interface SoilStock {
  plot_id: string;
  depth_label: string;
  depth_top_cm: number;
  depth_bottom_cm: number;
  layer_thickness_cm: number;
  bulk_density_g_cm3?: number;
  soc_g_kg?: number;
  tn_g_kg?: number;
  soc_stock_mg_ha?: number;    // derived
  tn_stock_kg_ha?: number;     // derived
  notes?: string;
}

export interface PlotSummary {
  plot_id: string;
  block: number;
  genotype: string;
  n_dose_kg_ha_yr: number;
  soc_stock_0_50_mg_ha?: number;
  tn_stock_0_50_kg_ha?: number;
  mean_spad?: number;
  mean_stem_diameter_mm?: number;
  leaf_n_pct?: number;
  leaf_delta15n_per_mil?: number;
  net_min_rate_mg_kg_d?: number;
  notes?: string;
}
