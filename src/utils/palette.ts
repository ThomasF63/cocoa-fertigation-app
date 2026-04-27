// Treatment palette for visualisation.
//
// N dose → sequential orange (seed) fill ramp (L → M → H).
// Genotype → a second visual channel selected by the user at runtime
// (border colour, border style, hatching, corner chip, or monogram).
// See ENCODING_MODES below.
//
// Values reference CSS custom properties so SVG fills/strokes adapt to the
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

// ── Dose fill ramp (L → M → H) ────────────────────────────────────────────────
// Sequential amber ramp built on --ek-seed. Mixed with --panel-bg so it adapts
// to light / dark theme. H = full seed, L = ~25 % seed.
export const DOSE_FILL: Record<DoseCode, string> = {
  L: "color-mix(in oklch, var(--ek-seed) 25%, var(--panel-bg))",
  M: "color-mix(in oklch, var(--ek-seed) 60%, var(--panel-bg))",
  H: "var(--ek-seed)",
};

// Same ramp rendered on a transparent/white card (for legend swatches where
// --panel-bg may not apply cleanly).
export const DOSE_FILL_SWATCH: Record<DoseCode, string> = DOSE_FILL;

// ── Genotype secondary channel ────────────────────────────────────────────────
// Used when the encoding mode expresses genotype via colour (border, chip, or
// hatching stripes).
export const GENOTYPE_BORDER: Record<GenotypeCode, string> = {
  CCN51:  TOKENS.stemDark,
  PS1319: TOKENS.berryDark,
};

export const GENOTYPE_BADGE: Record<GenotypeCode, string> = {
  CCN51:  TOKENS.stem,
  PS1319: TOKENS.berry,
};

export const GENOTYPE_MONOGRAM: Record<GenotypeCode, string> = {
  CCN51:  "C",
  PS1319: "P",
};

// Retained for any call sites that still need the old treatment encoding
// (genotype fill + dose border thickness). New layout code uses DOSE_FILL +
// the encoding mode below.
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

// ── Encoding modes ────────────────────────────────────────────────────────────
// User-selectable ways to encode genotype as a second channel, on top of the
// dose orange ramp. All five preserve a bivariate mapping and avoid relying on
// border thickness for dose.
export type EncodingMode =
  | "border-color"
  | "border-style"
  | "corner-chip"
  | "chip-border"
  | "top-band"
  | "hatching"
  | "letter";

export const ENCODING_MODES: {
  value: EncodingMode;
  label: string;
  hint: string;
}[] = [
  { value: "border-color", label: "Border color", hint: "Dose → fill · Genotype → border colour (sage vs mauve)" },
  { value: "border-style", label: "Border style", hint: "Dose → fill · Genotype → solid vs dashed border" },
  { value: "corner-chip",  label: "Corner chip",  hint: "Dose → fill · Genotype → small coloured corner triangle" },
  { value: "chip-border",  label: "Chip + border", hint: "Dose → fill · Genotype → corner chip AND matching border colour" },
  { value: "top-band",     label: "Top band",     hint: "Dose → fill · Genotype → horizontal coloured band along the top edge" },
  { value: "hatching",     label: "Hatching",     hint: "Dose → fill · Genotype → solid vs diagonal hatch overlay" },
  { value: "letter",       label: "Monogram",     hint: "Dose → fill · Genotype → small letter badge (C / P)" },
];

export const DEFAULT_ENCODING_MODE: EncodingMode = "border-color";

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
