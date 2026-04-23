// Treatment palette for visualisation. Muted Ekodama tones, with genotype
// driving fill (stem vs berry) and dose driving border weight / saturation.
// Values are CSS custom-property references so SVG fills/strokes adapt to the
// active theme (light / dark / contrast). Dark-mode overrides live in tokens.css.

import type { GenotypeCode, DoseCode, GenotypeLabel } from "../types/design";

export const TOKENS = {
  soil:       "var(--text-primary)",
  soilDark:   "var(--text-primary)",
  root:       "var(--ek-root)",
  stem:       "var(--ek-stem)",
  stemDark:   "var(--ek-stem-dark)",
  berry:      "var(--ek-berry)",
  berryDark:  "var(--ek-berry-dark)",
  seed:       "var(--ek-seed)",
  terracotta: "var(--ek-terracotta)",
  water:      "var(--ek-water)",
  slate:      "var(--ek-slate)",
} as const;

export const GENOTYPE_FILL: Record<GenotypeCode, string> = {
  CCN51:  "color-mix(in oklch, var(--ek-stem) 22%, transparent)",
  PS1319: "color-mix(in oklch, var(--ek-berry) 22%, transparent)",
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

// Reverse lookups for UI chips that receive labels/kg-values rather than codes.
export const DOSE_CODE_BY_KG: Record<number, DoseCode> = {
  56: "L",
  226: "M",
  340: "H",
};

export const GENOTYPE_CODE_BY_LABEL: Record<GenotypeLabel, GenotypeCode> = {
  "CCN 51":  "CCN51",
  "PS 13.19": "PS1319",
};
