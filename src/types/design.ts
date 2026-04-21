// Design-side types for the MCCS 48-plot factorial.

export interface DepthLayer {
  code: string;   // positional: "D1" = first layer, "D2" = second, etc.
  label: string;  // display range, e.g. "0-10"
  top: number;
  bottom: number;
}

export type GenotypeCode = "CCN51" | "PS1319";
export type GenotypeLabel = "CCN 51" | "PS 13.19";
export type DoseCode = "L" | "M" | "H";
export type BlockNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const GENOTYPE_LABELS: Record<GenotypeCode, GenotypeLabel> = {
  CCN51: "CCN 51",
  PS1319: "PS 13.19",
};

export const DOSE_N_KG_HA_YR: Record<DoseCode, number> = {
  L: 56,
  M: 226,
  H: 340,
};

export const DEPTHS = [
  { code: "D1", label: "0-10",  top: 0,  bottom: 10 },
  { code: "D2", label: "10-20", top: 10, bottom: 20 },
  { code: "D3", label: "20-30", top: 20, bottom: 30 },
  { code: "D4", label: "30-50", top: 30, bottom: 50 },
] as const;

export type DepthCode = (typeof DEPTHS)[number]["code"];

export interface Plot {
  plot_id: string;           // B{block}_{geno}_{dose}, e.g. "B3_CCN51_M"
  block: BlockNumber;
  genotype: GenotypeCode;
  genotype_label: GenotypeLabel;
  dose_code: DoseCode;
  n_dose_kg_ha_yr: number;
  rootstock: string;         // VB 1151
  trees_per_plot: number;    // 96
  measurement_trees_n: number; // 12
  plot_lat?: string;
  plot_lon?: string;
  notes?: string;
}

export interface Tree {
  tree_id: string;           // B3_CCN51_M_T01
  plot_id: string;
  tree_number_in_plot: number; // 1..12
  tag_id?: string;
  tagged_date?: string;
  notes?: string;
}
