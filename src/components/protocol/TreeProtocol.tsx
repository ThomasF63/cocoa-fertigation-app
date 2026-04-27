import { ProtocolLayout } from "./ProtocolLayout";
import type { SamplingPlan, PlanCounts } from "../../types/plan";

interface Props { plan: SamplingPlan; counts: PlanCounts; }

function TreeFigure() {
  // Layout:
  //   viewBox 420 x 290. Soil at y=258. Canopy centred at (165,118).
  //   Trunk runs to a Y-fork at y=206 (~40 cm above soil); two main
  //   branches diverge to (118,80) and (212,80) with rounded caps.
  //   D5 and D30 calipers sit on the single trunk below the fork.
  //   D50 and D130 calipers appear on each branch above the fork.
  //   Tree-height arrow on the far left; top-down canopy inset at (350,170).
  return (
    <svg viewBox="0 0 420 290" role="img" aria-label="Tree size measurement diagram" className="protocol-svg">
      <defs>
        <linearGradient id="canopyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ek-stem)"      stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--ek-stem-dark)" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {/* Soil line */}
      <line x1="10" y1="258" x2="410" y2="258" stroke="var(--ek-soil-mid)" strokeWidth="1.5" />
      <line x1="10" y1="262" x2="410" y2="262" stroke="var(--ek-soil-mid)" strokeWidth="0.8" strokeDasharray="3 3" />

      {/* Canopy */}
      <ellipse cx="165" cy="118" rx="95" ry="72" fill="url(#canopyGrad)" stroke="var(--ek-stem-dark)" strokeWidth="1" />

      {/* Trunk + two main branches forking at ~40 cm (y=206).
          Single silhouette: up the left of the trunk, out to the left
          branch top, rounded cap, down to the V-notch at (165,208), up to
          the right branch top, rounded cap, down the right side of trunk. */}
      <path d="M156 258 L156 206 L118 80 Q123 75 128 80 L165 208 L202 80 Q207 75 212 80 L174 206 L174 258 Z"
            fill="var(--ek-soil-warm)" stroke="var(--ek-soil-dark)" strokeWidth="1" />

      {/* Fork annotation */}
      <g fontFamily="var(--font-mono)" fontSize="10" fill="var(--ek-soil-mid)">
        <line x1="180" y1="208" x2="218" y2="208" stroke="var(--ek-soil-mid)" strokeWidth="0.6" strokeDasharray="2 2" />
        <text x="222" y="211">fork ~40 cm</text>
      </g>

      {/* Diameter caliper marks */}
      <g stroke="var(--ek-terracotta)" strokeWidth="2" fontFamily="var(--font-mono)" fontSize="11" fill="var(--ek-terracotta)">
        {/* D5 — single trunk, below fork */}
        <line x1="141" y1="251" x2="189" y2="251" />
        <line x1="141" y1="246" x2="141" y2="256" />
        <line x1="189" y1="246" x2="189" y2="256" />
        <text x="196" y="255" stroke="none">D5</text>

        {/* D30 — single trunk, below fork */}
        <line x1="141" y1="220" x2="189" y2="220" />
        <line x1="141" y1="215" x2="141" y2="225" />
        <line x1="189" y1="215" x2="189" y2="225" />
        <text x="196" y="224" stroke="none">D30</text>

        {/* D50 — one caliper per branch, just above the fork */}
        <line x1="146" y1="193" x2="164" y2="193" />
        <line x1="146" y1="188" x2="146" y2="198" />
        <line x1="164" y1="188" x2="164" y2="198" />
        <line x1="166" y1="193" x2="184" y2="193" />
        <line x1="166" y1="188" x2="166" y2="198" />
        <line x1="184" y1="188" x2="184" y2="198" />
        <text x="191" y="197" stroke="none">D50</text>

        {/* D130 (DBH) — one caliper per branch, high on the stem */}
        <line x1="115" y1="90" x2="137" y2="90" />
        <line x1="115" y1="85" x2="115" y2="95" />
        <line x1="137" y1="85" x2="137" y2="95" />
        <line x1="193" y1="90" x2="215" y2="90" />
        <line x1="193" y1="85" x2="193" y2="95" />
        <line x1="215" y1="85" x2="215" y2="95" />
        <text x="221" y="94" stroke="none">D130 (DBH)</text>
      </g>

      {/* Tree height arrow — label above the canopy, outside it */}
      <g stroke="var(--ek-soil-dark)" strokeWidth="1.2" fill="var(--ek-soil-dark)">
        <line x1="38" y1="258" x2="38" y2="42" />
        <polygon points="34,50 42,50 38,42" />
        <polygon points="34,250 42,250 38,258" />
        <text x="22" y="32" fontSize="11" fontFamily="var(--font-mono)" stroke="none">tree height</text>
      </g>

      {/* Canopy width inset (top-down view), pushed right to clear D-labels */}
      <g transform="translate(350,170)">
        <ellipse cx="0" cy="0" rx="38" ry="26" fill="url(#canopyGrad)" stroke="var(--ek-stem-dark)" strokeWidth="0.8" />
        <g stroke="var(--ek-terracotta)" strokeWidth="1.5" fill="var(--ek-terracotta)">
          <line x1="-38" y1="0" x2="38" y2="0" />
          <polygon points="-34,-3 -34,3 -40,0" />
          <polygon points="34,-3 34,3 40,0" />
        </g>
        <g stroke="var(--ek-stem-dark)" strokeWidth="1.5" fill="var(--ek-stem-dark)">
          <line x1="0" y1="-26" x2="0" y2="26" />
          <polygon points="-3,-22 3,-22 0,-28" />
          <polygon points="-3,22 3,22 0,28" />
        </g>
        <text x="0" y="-36" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ek-soil)">top-down view</text>
        <text x="0" y="48" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ek-terracotta)">along row</text>
        <text x="-44" y="3" textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ek-stem-dark)">across</text>
      </g>
    </svg>
  );
}

export function treeGear(_plan: SamplingPlan): string[] {
  return [
    "Digital caliper (0.1 mm) for trunk diameters",
    "Telescopic measuring rod or clinometer / hypsometer for tree height",
    "Tape measure (≥ 5 m) for canopy widths",
    "Marking chalk or tape at 5, 30, 50, 130 cm stem height",
    "Tablet running this app (offline mode)",
  ];
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
      gear={treeGear(plan)}
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
      figureCaption="D5 and D30 on the single trunk below the fork (~40 cm); D50 and D130 (DBH) on each main branch above the fork. Tree height runs from soil to canopy top; canopy width is measured along and across the planting row."
    />
  );
}
