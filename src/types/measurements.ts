export interface TreeMeasurement {
  tree_id: string;
  plot_id: string;
  measurement_date?: string;
  spad_leaf_1?: number;
  spad_leaf_2?: number;
  spad_leaf_3?: number;
  spad_mean?: number;          // derived
  stem_diameter_30cm_mm?: number;
  pod_load_score?: number;     // 0..5
  vigour_score?: number;       // 0..5
  observer?: string;
  notes?: string;
}
