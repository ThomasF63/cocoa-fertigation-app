// Shared SVG marker glyphs for sampling indicators.
// Used by the Design Overview mini-grid (PlanTab) and the Layout tab,
// so the two diagrams speak the same visual language.

import { TOKENS } from "../../utils/palette";

export const SAMPLE_SOIL_COLOR = "var(--ek-depth-3)";

interface MarkProps {
  cx: number;
  cy: number;
  r?: number;
}

// Soil composite sample — filled square.
export function SoilMark({ cx, cy, r = 2.2, color = SAMPLE_SOIL_COLOR }:
  MarkProps & { color?: string }) {
  return (
    <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2}
      rx={Math.min(0.6, r * 0.25)} fill={color} />
  );
}

// Bulk-density ring — open circle.
export function BdMark({ cx, cy, r = 2.2, strokeWidth = 1.2 }:
  MarkProps & { strokeWidth?: number }) {
  return (
    <circle cx={cx} cy={cy} r={r} fill="none"
      stroke={TOKENS.slate} strokeWidth={strokeWidth} />
  );
}

// N-min incubation — plus / cross.
export function NminMark({ cx, cy, r = 2.4, strokeWidth = 1.4 }:
  MarkProps & { strokeWidth?: number }) {
  return (
    <path
      d={`M${cx - r} ${cy} h${r * 2} M${cx} ${cy - r} v${r * 2}`}
      stroke={TOKENS.water} strokeWidth={strokeWidth}
      strokeLinecap="round" fill="none" />
  );
}

// Central measurement tree — filled diamond (rotated square) so it reads
// as distinct from the soil square, BD ring, and N-min plus.
export function TreeMark({ cx, cy, r = 5, color }:
  MarkProps & { color: string }) {
  return (
    <polygon
      points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      fill={color} />
  );
}
