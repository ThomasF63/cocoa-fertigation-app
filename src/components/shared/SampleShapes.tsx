// Shared SVG marker glyphs for sampling indicators.
// Used by the Design Overview mini-grid (PlanTab) and the Layout tab,
// so the two diagrams speak the same visual language.

import { TOKENS } from "../../utils/palette";

// Neutral ink for soil + BD markers. --text-primary flips with the active
// theme (deep brown in light, warm cream in dark) so the glyphs read cleanly
// on every dose-fill tone without competing with the amber ramp.
export const SAMPLE_SOIL_COLOR = "var(--text-primary)";
const SAMPLE_INK = "var(--text-primary)";
// Thin panel-bg halo painted under each glyph to stencil it against the dose
// fill. Invisible on plain panel-bg legend swatches (same colour as the
// background), visible only where the marker sits on an amber tile.
const MARKER_HALO = "var(--panel-bg)";

interface MarkProps {
  cx: number;
  cy: number;
  r?: number;
}

// Soil composite sample — filled square with a panel-bg halo (paint-order
// puts the stroke behind the fill, so only the outer ~half of the stroke is
// visible as a thin rim).
export function SoilMark({ cx, cy, r = 2.2, color = SAMPLE_SOIL_COLOR }:
  MarkProps & { color?: string }) {
  const haloWidth = Math.max(0.9, r * 0.45);
  return (
    <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2}
      rx={Math.min(0.6, r * 0.25)} fill={color}
      stroke={MARKER_HALO} strokeWidth={haloWidth}
      style={{ paintOrder: "stroke" }} />
  );
}

// Bulk-density ring — open circle in neutral ink, ringed by a panel-bg halo
// so the glyph stays readable on the bright H-dose fill.
export function BdMark({ cx, cy, r = 2.2, strokeWidth = 1.4 }:
  MarkProps & { strokeWidth?: number }) {
  const haloWidth = strokeWidth + Math.max(1.0, r * 0.55);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={MARKER_HALO} strokeWidth={haloWidth} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={SAMPLE_INK} strokeWidth={strokeWidth} />
    </g>
  );
}

// N-min incubation — plus / cross in water-blue, with a panel-bg halo.
// Blue is kept as the single "pop" accent among the markers.
export function NminMark({ cx, cy, r = 2.4, strokeWidth = 1.4 }:
  MarkProps & { strokeWidth?: number }) {
  const d = `M${cx - r} ${cy} h${r * 2} M${cx} ${cy - r} v${r * 2}`;
  const haloWidth = strokeWidth + Math.max(1.0, r * 0.55);
  return (
    <g>
      <path d={d}
        stroke={MARKER_HALO} strokeWidth={haloWidth}
        strokeLinecap="round" fill="none" />
      <path d={d}
        stroke={TOKENS.water} strokeWidth={strokeWidth}
        strokeLinecap="round" fill="none" />
    </g>
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
