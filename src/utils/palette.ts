// Treatment palette for visualisation. Muted Ekodama tones, with genotype
// driving fill (stem vs berry) and dose driving border weight / saturation.

import type { GenotypeCode, DoseCode } from "../types/design";

export const TOKENS = {
  soil: "#3B322C",
  soilDark: "#2A231E",
  root: "#F7F5F0",
  stem: "#657D58",
  stemDark: "#3E5233",
  berry: "#B5678A",
  berryDark: "#7A4059",
  seed: "#E89B48",
  terracotta: "#C46B42",
  water: "#6B9AC4",
  slate: "#6C7A8A",
} as const;

export const GENOTYPE_FILL: Record<GenotypeCode, string> = {
  CCN51: "rgba(101, 125, 88, 0.22)",
  PS1319: "rgba(181, 103, 138, 0.22)",
};

export const GENOTYPE_STROKE: Record<GenotypeCode, string> = {
  CCN51: TOKENS.stemDark,
  PS1319: TOKENS.berryDark,
};

export const DOSE_STROKE_WIDTH: Record<DoseCode, number> = {
  L: 0.8,
  M: 1.6,
  H: 2.6,
};

export const DOSE_LABEL: Record<DoseCode, string> = {
  L: "56",
  M: "226",
  H: "340",
};
