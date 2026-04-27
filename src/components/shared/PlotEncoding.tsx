import type { ReactNode } from "react";
import type { DoseCode, GenotypeCode } from "../../types/design";
import {
  DOSE_FILL,
  GENOTYPE_BADGE,
  GENOTYPE_BORDER,
  GENOTYPE_MONOGRAM,
  TOKENS,
  type EncodingMode,
} from "../../utils/palette";

// ── Shared helpers for rendering a plot tile under one of the user-selected
// encoding modes. Dose is always mapped to the orange fill ramp; genotype uses
// the mode-specific second channel (border colour, style, corner chip, hatch,
// or monogram letter).
//
// Each plot tile is drawn as two concentric rects: an outer frame (stroke +
// neutral gap fill) and an inner rect (dose colour) inset so there is visible
// whitespace between the border and the fill. The inset equals ~1.5× the
// stroke width, which reads as a gap roughly equal to the border thickness.

export const HATCH_PATTERN_PREFIX = "mccs-hatch";

// SVG defs block. Include once per SVG that renders plot tiles.
// scale controls hatch spacing; use ~6 for small mini-grids, 10–12 for full
// layout plots.
export function PlotEncodingDefs({
  idScope, scale = 8,
}: { idScope: string; scale?: number }) {
  return (
    <defs>
      {(["CCN51", "PS1319"] as GenotypeCode[]).map(g => {
        const stripe = GENOTYPE_BORDER[g];
        return (
          <pattern
            key={g}
            id={`${HATCH_PATTERN_PREFIX}-${idScope}-${g}`}
            patternUnits="userSpaceOnUse"
            width={scale}
            height={scale}
            patternTransform="rotate(45)"
          >
            {/* transparent base — the base fill comes from the rect */}
            <line
              x1={0} y1={0} x2={0} y2={scale}
              stroke={stripe}
              strokeWidth={Math.max(1.1, scale * 0.22)}
              opacity={0.55}
            />
          </pattern>
        );
      })}
    </defs>
  );
}

export interface PlotEncodingSpec {
  /** Outer rect (frame): its fill shows through as the gap between the
   *  border and the inner dose fill. */
  outerFill: string;
  outerStroke: string;
  outerStrokeWidth: number;
  outerStrokeDasharray?: string;
  /** Inner rect (inset from the outer by `innerInset` on every side). */
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  innerRx: number;
  innerFill: string;
  /** Overlay nodes drawn above the inner rect (chip, band, letter, hatch). */
  overlay?: ReactNode;
}

export interface EncodingArgs {
  mode: EncodingMode;
  geno: GenotypeCode;
  dose: DoseCode;
  active: boolean;
  selected?: boolean;
  /** Plot rect bounds in the parent SVG coords. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Unique SVG scope for pattern ids — must match the defs' idScope. */
  idScope: string;
  /** Scale hint for overlay sizing. 1 = mini-grid (~34 px plot), 3 = full
   * layout plot (~120 px). */
  scale?: number;
  /** Outer rect corner radius (default 4). */
  rx?: number;
}

const INACTIVE_FILL = "var(--soil-08)";
const INACTIVE_STROKE = "var(--panel-border)";
const NEUTRAL_STROKE = "var(--text-primary)";
const FRAME_FILL = "var(--panel-bg)";
// Selection override — applied to outerStroke/outerStrokeWidth but not to the
// inset, so the visible fill doesn't jump when selection toggles.
const SELECTION_STROKE = TOKENS.soilDark;
const SELECTION_STROKE_WIDTH = 2.6;

function makeInner(x: number, y: number, w: number, h: number, inset: number, rx: number) {
  const clamped = Math.max(0, inset);
  return {
    innerX: x + clamped,
    innerY: y + clamped,
    innerW: Math.max(0, w - 2 * clamped),
    innerH: Math.max(0, h - 2 * clamped),
    innerRx: Math.max(0, rx - clamped * 0.5),
  };
}

export function resolvePlotEncoding(args: EncodingArgs): PlotEncodingSpec {
  const { mode, geno, dose, active, selected, x, y, w, h, idScope } = args;
  const scale = args.scale ?? 1;
  const rx = args.rx ?? 4;

  if (!active) {
    const outerStrokeWidth = selected ? SELECTION_STROKE_WIDTH : 0.8;
    const inset = 1.5 * (selected ? 0.8 : 0.8);
    return {
      outerFill: FRAME_FILL,
      outerStroke: selected ? SELECTION_STROKE : INACTIVE_STROKE,
      outerStrokeWidth,
      innerFill: INACTIVE_FILL,
      ...makeInner(x, y, w, h, inset, rx),
    };
  }

  const doseFill = DOSE_FILL[dose];

  // Helper: build a spec with the given border, auto-inset and no overlay.
  function framedSpec(
    stroke: string,
    strokeWidth: number,
    extras: {
      dasharray?: string;
      overlay?: ReactNode;
      // custom inset (overrides the stroke-derived default)
      inset?: number;
    } = {},
  ): PlotEncodingSpec {
    const selStrokeWidth = selected ? SELECTION_STROKE_WIDTH : strokeWidth;
    const selStroke = selected ? SELECTION_STROKE : stroke;
    // Inset is derived from the unselected stroke so the visible fill area is
    // stable through selection changes.
    const inset = extras.inset ?? (strokeWidth > 0 ? 1.5 * strokeWidth : 0);
    return {
      outerFill: FRAME_FILL,
      outerStroke: selStroke,
      outerStrokeWidth: selStrokeWidth,
      outerStrokeDasharray: extras.dasharray,
      innerFill: doseFill,
      ...makeInner(x, y, w, h, inset, rx),
      overlay: extras.overlay,
    };
  }

  // Overlays are positioned on the inner rect bounds, so compute those up
  // front for the modes that need them.
  const prelimInset = 1.5 * (() => {
    switch (mode) {
      case "corner-chip":
      case "top-band":
        return 0;
      case "border-color":
      case "chip-border":
        return 1.6 * scale * 0.6 + 0.9;
      case "border-style":
        return 1.3;
      case "hatching":
      case "letter":
        return 1;
    }
  })();
  const innerBounds = makeInner(x, y, w, h, prelimInset, rx);

  switch (mode) {
    case "border-color": {
      const strokeWidth = 1.6 * scale * 0.6 + 0.9;
      return framedSpec(GENOTYPE_BORDER[geno], strokeWidth);
    }

    case "border-style": {
      const dashed = geno === "PS1319";
      const strokeWidth = 1.3;
      const dashLen = Math.max(3, 3 * scale);
      const gapLen = Math.max(2, 2 * scale);
      return framedSpec(NEUTRAL_STROKE, strokeWidth, {
        dasharray: dashed ? `${dashLen} ${gapLen}` : undefined,
      });
    }

    case "corner-chip":
    case "chip-border": {
      const innerX = innerBounds.innerX;
      const innerY = innerBounds.innerY;
      const innerW = innerBounds.innerW;
      const innerH = innerBounds.innerH;
      const chipSize = Math.max(10, Math.round(Math.min(innerW, innerH) * 0.3));
      const color = GENOTYPE_BADGE[geno];
      const overlay = (
        <g pointerEvents="none">
          <polygon
            points={`${innerX},${innerY} ${innerX + chipSize},${innerY} ${innerX},${innerY + chipSize}`}
            fill={color}
            stroke={GENOTYPE_BORDER[geno]}
            strokeWidth={0.6}
          />
        </g>
      );
      if (mode === "chip-border") {
        const strokeWidth = 1.6 * scale * 0.6 + 0.9;
        return framedSpec(GENOTYPE_BORDER[geno], strokeWidth, { overlay });
      }
      // corner-chip: no outer border, no inset — chip on the plot corner.
      return framedSpec("none", 0, { overlay, inset: 0 });
    }

    case "top-band": {
      // Band sized off the plot width so it reads at both mini and full sizes.
      const bandH = Math.max(4, Math.round(w * 0.12));
      const bandGap = Math.max(2, Math.round(bandH * 0.25));
      const color = GENOTYPE_BADGE[geno];
      const overlay = (
        <rect
          x={x}
          y={y}
          width={w}
          height={bandH}
          rx={rx}
          fill={color}
          stroke={GENOTYPE_BORDER[geno]}
          strokeWidth={0.6}
          pointerEvents="none"
        />
      );
      // Custom inner rect: starts below the band + gap so the outer
      // (panel-bg) fill shows as a thin whitespace strip between the band and
      // the dose fill.
      const selStrokeWidth = selected ? SELECTION_STROKE_WIDTH : 0;
      const selStroke = selected ? SELECTION_STROKE : "none";
      const innerTop = y + bandH + bandGap;
      return {
        outerFill: FRAME_FILL,
        outerStroke: selStroke,
        outerStrokeWidth: selStrokeWidth,
        innerX: x,
        innerY: innerTop,
        innerW: w,
        innerH: Math.max(0, h - bandH - bandGap),
        innerRx: rx,
        innerFill: doseFill,
        overlay,
      };
    }

    case "hatching": {
      const strokeWidth = 1;
      if (geno === "CCN51") {
        return framedSpec(NEUTRAL_STROKE, strokeWidth);
      }
      const overlay = (
        <rect
          x={innerBounds.innerX}
          y={innerBounds.innerY}
          width={innerBounds.innerW}
          height={innerBounds.innerH}
          rx={innerBounds.innerRx}
          fill={`url(#${HATCH_PATTERN_PREFIX}-${idScope}-${geno})`}
          stroke="none"
          pointerEvents="none"
        />
      );
      return framedSpec(NEUTRAL_STROKE, strokeWidth, { overlay });
    }

    case "letter": {
      const strokeWidth = 1;
      const letter = GENOTYPE_MONOGRAM[geno];
      const color = GENOTYPE_BORDER[geno];
      const innerX = innerBounds.innerX;
      const innerY = innerBounds.innerY;
      const innerW = innerBounds.innerW;
      const size = Math.max(9, Math.round(innerW * 0.32));
      const pad = Math.max(2, Math.round(innerW * 0.08));
      const overlay = (
        <text
          x={innerX + pad}
          y={innerY + pad + size * 0.85}
          fontFamily="'Azeret Mono', ui-monospace, Menlo, Consolas, monospace"
          fontSize={size}
          fontWeight={700}
          fill={color}
          pointerEvents="none"
        >
          {letter}
        </text>
      );
      return framedSpec(NEUTRAL_STROKE, strokeWidth, { overlay });
    }
  }
}

// ── Plot rect renderer ───────────────────────────────────────────────────────
// Emits the two rects (outer frame + inner dose fill). Caller wraps with its
// own <g> to attach event handlers, add <title>, etc.
export function PlotTileRects({
  spec, x, y, w, h, rx = 4, opacity,
}: {
  spec: PlotEncodingSpec;
  x: number; y: number; w: number; h: number;
  rx?: number;
  opacity?: number;
}) {
  // pointerEvents="none" so a separately-rendered interactive rect (with
  // onClick/title) can sit underneath and still receive events through the
  // visuals.
  return (
    <g opacity={opacity} pointerEvents="none">
      <rect
        x={x} y={y} width={w} height={h} rx={rx}
        fill={spec.outerFill}
        stroke={spec.outerStroke}
        strokeWidth={spec.outerStrokeWidth}
        strokeDasharray={spec.outerStrokeDasharray}
      />
      <rect
        x={spec.innerX} y={spec.innerY} width={spec.innerW} height={spec.innerH}
        rx={spec.innerRx}
        fill={spec.innerFill}
      />
    </g>
  );
}

// ── Legend swatches ───────────────────────────────────────────────────────────

export function DoseSwatch({ dose, size = 14 }: { dose: DoseCode; size?: number }) {
  return (
    <svg width={size} height={size * 0.7} style={{ flexShrink: 0 }}>
      <rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size * 0.7 - 1}
        rx={2}
        fill={DOSE_FILL[dose]}
        stroke="var(--panel-border-strong)"
        strokeWidth={0.8}
      />
    </svg>
  );
}

// Small swatch illustrating how a genotype is marked under the current mode.
export function GenotypeSwatch({
  mode, geno, idScope, size = 18,
}: {
  mode: EncodingMode;
  geno: GenotypeCode;
  idScope: string;
  size?: number;
}) {
  const w = size;
  const h = size;
  // Use the "M" dose as a representative fill shade for the swatch so the
  // second channel is shown against a mid orange.
  const spec = resolvePlotEncoding({
    mode, geno, dose: "M", active: true,
    x: 0.5, y: 0.5, w: w - 1, h: h - 1,
    idScope, scale: 1,
    rx: 2,
  });
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <PlotEncodingDefs idScope={idScope} scale={5} />
      <PlotTileRects spec={spec} x={0.5} y={0.5} w={w - 1} h={h - 1} rx={2} />
      {spec.overlay}
    </svg>
  );
}
