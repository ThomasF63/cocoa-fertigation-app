export interface TreeMeasurement {
  tree_id: string;
  plot_id: string;
  measurement_date?: string;
  // Trunk diameters at standard heights above soil (mm). All optional;
  // D30 is the comparable measurement carried over from the original protocol.
  stem_diameter_5cm_mm?: number;
  stem_diameter_30cm_mm?: number;
  stem_diameter_50cm_mm?: number;
  stem_diameter_130cm_mm?: number;
  tree_height_m?: number;
  // Canopy width measured twice per tree, along and across the planting row (m).
  canopy_width_along_row_m?: number;
  canopy_width_across_row_m?: number;
  canopy_width_mean_m?: number;     // derived
  observer?: string;
  notes?: string;
}
