import { ProtocolLayout } from "./ProtocolLayout";
import type { SamplingPlan, PlanCounts } from "../../types/plan";

interface Props { plan: SamplingPlan; counts: PlanCounts; }

function TreeFigure() {
  // Soil at y = 275. Heights above soil mapped at ~1.4 px per cm:
  //   D5  -> y 268,  D30 -> y 233,  D50 -> y 205,  D130 -> y 93.
  // Tree height arrow runs from soil to canopy top (y 50). Canopy widths shown
  // in the inset to keep the trunk diagram legible.
  return (
    <svg viewBox="0 0 360 320" role="img" aria-label="Tree size measurement diagram" className="protocol-svg">
      <defs>
        <linearGradient id="canopyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ek-stem)"      stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--ek-stem-dark)" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {/* Soil line */}
      <line x1="10" y1="275" x2="350" y2="275" stroke="var(--ek-soil-mid)" strokeWidth="1.5" />
      <line x1="10" y1="279" x2="350" y2="279" stroke="var(--ek-soil-mid)" strokeWidth="0.8" strokeDasharray="3 3" />

      {/* Canopy */}
      <ellipse cx="180" cy="125" rx="105" ry="80" fill="url(#canopyGrad)" stroke="var(--ek-stem-dark)" strokeWidth="1" />

      {/* Trunk: tapers from base (D5 ~ 18 px wide) to upper crown (~ 8 px wide) */}
      <path d="M171 275 L171 95 Q171 80 180 78 Q189 80 189 95 L189 275 Z"
            fill="var(--ek-soil-warm)" stroke="var(--ek-soil-dark)" strokeWidth="1" />

      {/* Diameter caliper marks at D5, D30, D50, D130 */}
      <g stroke="var(--ek-terracotta)" strokeWidth="2" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ek-terracotta)">
        {/* D5 at 5 cm above soil */}
        <line x1="155" y1="268" x2="205" y2="268" />
        <line x1="155" y1="263" x2="155" y2="273" />
        <line x1="205" y1="263" x2="205" y2="273" />
        <text x="212" y="272" stroke="none">D5  (5 cm)</text>
        {/* D30 */}
        <line x1="155" y1="233" x2="205" y2="233" />
        <line x1="155" y1="228" x2="155" y2="238" />
        <line x1="205" y1="228" x2="205" y2="238" />
        <text x="212" y="237" stroke="none">D30 (30 cm)</text>
        {/* D50 */}
        <line x1="155" y1="205" x2="205" y2="205" />
        <line x1="155" y1="200" x2="155" y2="210" />
        <line x1="205" y1="200" x2="205" y2="210" />
        <text x="212" y="209" stroke="none">D50 (50 cm)</text>
        {/* D130 (DBH) */}
        <line x1="155" y1="93" x2="205" y2="93" />
        <line x1="155" y1="88" x2="155" y2="98" />
        <line x1="205" y1="88" x2="205" y2="98" />
        <text x="212" y="97" stroke="none">D130 / DBH</text>
      </g>

      {/* Tree height arrow on the left */}
      <g stroke="var(--ek-soil-dark)" strokeWidth="1.2" fill="var(--ek-soil-dark)">
        <line x1="40" y1="275" x2="40" y2="50" />
        <polygon points="36,58 44,58 40,50" />
        <polygon points="36,267 44,267 40,275" />
        <text x="48" y="165" fontSize="10" fontFamily="var(--font-mono)">tree height (m)</text>
      </g>

      {/* Canopy width inset (top-down view) */}
      <g transform="translate(290,205)">
        <rect x="-40" y="-40" width="80" height="80" fill="none" stroke="var(--ek-soil-mid)" strokeWidth="0.8" strokeDasharray="2 2" />
        <ellipse cx="0" cy="0" rx="32" ry="22" fill="url(#canopyGrad)" stroke="var(--ek-stem-dark)" strokeWidth="0.8" />
        {/* row direction guide */}
        <line x1="-44" y1="0" x2="44" y2="0" stroke="var(--ek-soil-mid)" strokeWidth="0.6" />
        {/* along-row arrow (horizontal) */}
        <g stroke="var(--ek-terracotta)" strokeWidth="1.5" fill="var(--ek-terracotta)">
          <line x1="-32" y1="0" x2="32" y2="0" />
          <polygon points="-30,-3 -30,3 -36,0" />
          <polygon points="30,-3 30,3 36,0" />
        </g>
        {/* across-row arrow (vertical) */}
        <g stroke="var(--ek-stem-dark)" strokeWidth="1.5" fill="var(--ek-stem-dark)">
          <line x1="0" y1="-22" x2="0" y2="22" />
          <polygon points="-3,-20 3,-20 0,-26" />
          <polygon points="-3,20 3,20 0,26" />
        </g>
        <text x="0" y="-32" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ek-soil)">canopy (top-down)</text>
        <text x="0" y="44" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ek-terracotta)">along row</text>
        <text x="-46" y="3" textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ek-stem-dark)">across</text>
      </g>

      {/* Legend */}
      <g transform="translate(14,18)">
        <line x1="0" y1="6" x2="12" y2="6" stroke="var(--ek-terracotta)" strokeWidth="2" />
        <text x="18" y="10" fontSize="10" fill="var(--ek-soil)" fontFamily="var(--font-mono)">Caliper diameter</text>
        <line x1="0" y1="22" x2="12" y2="22" stroke="var(--ek-soil-dark)" strokeWidth="1.5" />
        <text x="18" y="26" fontSize="10" fill="var(--ek-soil)" fontFamily="var(--font-mono)">Vertical / across-row</text>
      </g>
    </svg>
  );
}

export function TreeProtocol({ plan, counts }: Props) {
  const { treesPerPlot } = plan;
  const { plots, trees } = counts;

  return (
    <ProtocolLayout
      title="Tree size protocol"
      summary={`Non-destructive size measurements on the ${treesPerPlot} central trees of each plot: trunk diameters at four heights (5, 30, 50, 130 cm), total tree height, and canopy width along and across the planting row.`}
      purpose="Capture tree growth and canopy occupancy for each fertigation x genotype combination, with multiple stem reference heights to support biomass allometrics, taper analysis, and comparison with other cocoa datasets."
      timing="Any time of day, dry conditions preferred. One observer per plot for the whole plot to keep operator effects within plots."
      stats={[
        { label: "Central trees per plot", value: treesPerPlot },
        { label: "Plots", value: plots },
        { label: "Total trees measured", value: trees },
        { label: "Diameter heights per tree", value: 4, hint: "5, 30, 50, 130 cm" },
        { label: "Canopy widths per tree", value: 2, hint: "along and across the row" },
      ]}
      gear={[
        "Digital caliper (0.1 mm) for trunk diameters",
        "Telescopic measuring rod or clinometer / hypsometer for tree height",
        "Tape measure (>= 5 m) for canopy widths",
        "Marking chalk or tape at 5, 30, 50, 130 cm stem height",
        "Tablet running this app (offline mode)",
      ]}
      steps={[
        { label: `Locate the ${treesPerPlot} central trees`, detail: "Use the Layout tab to confirm tree IDs and walking order within the plot." },
        { label: "Mark heights on the trunk", detail: "From soil surface (root collar), mark 5, 30, 50, 130 cm on the trunk. Use a chalk band if heights are reused on subsequent visits." },
        { label: "Measure trunk diameter at each marked height", detail: "Caliper perpendicular to the stem axis, away from swellings, wounds, and branch insertions. Skip a height if the trunk has already branched at that level (record blank, not zero)." },
        { label: "Measure tree height", detail: "From soil surface to the top of the canopy. Use a telescopic rod for trees up to ~6 m; clinometer or hypsometer beyond. One observer to limit operator drift." },
        { label: "Measure canopy width along the row", detail: "Tape measure across the projected canopy edge to canopy edge, parallel to the planting row." },
        { label: "Measure canopy width across the row", detail: "Same projected edge-to-edge measurement, perpendicular to the row. The app computes the mean of the two." },
        { label: "Save and move to next tree", detail: "The app auto-saves; use the stepper arrows or swipe between trees." },
      ]}
      qc={[
        "Always measure from the same datum (soil surface at the trunk base, not from a buttress or root flare).",
        "Caliper jaws perpendicular to the stem; take the mean of two perpendicular reads if the trunk is visibly oval.",
        "Skip (leave blank) any diameter height that falls above a branch insertion or below a buttress; do not record zero.",
        "Canopy width: project the outermost foliage edge to the ground rather than reaching from the trunk.",
        "Flag any tree with major pruning, breakage, or recent training in notes.",
      ]}
      figure={<TreeFigure />}
      figureCaption="Trunk diameter heights (D5 / D30 / D50 / D130), total tree height, and canopy width measured along and across the planting row."
    />
  );
}
