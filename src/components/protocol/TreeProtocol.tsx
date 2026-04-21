import { ProtocolLayout } from "./ProtocolLayout";
import type { SamplingPlan, PlanCounts } from "../../types/plan";

interface Props { plan: SamplingPlan; counts: PlanCounts; }

function TreeFigure() {
  return (
    <svg viewBox="0 0 340 300" role="img" aria-label="Tree measurement diagram" className="protocol-svg">
      <defs>
        <linearGradient id="canopyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ek-stem)"      stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--ek-stem-dark)" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <line x1="10" y1="275" x2="330" y2="275" stroke="var(--ek-soil-mid)" strokeWidth="1.5" />
      <line x1="10" y1="279" x2="330" y2="279" stroke="var(--ek-soil-mid)" strokeWidth="0.8" strokeDasharray="3 3" />

      <ellipse cx="170" cy="130" rx="115" ry="85" fill="url(#canopyGrad)" stroke="var(--ek-stem-dark)" strokeWidth="1" />

      <path d="M162 275 L162 210 Q162 180 170 170 Q178 180 178 210 L178 275 Z"
            fill="var(--ek-soil-warm)" stroke="var(--ek-soil-dark)" strokeWidth="1" />

      <line x1="145" y1="245" x2="195" y2="245" stroke="var(--ek-terracotta)" strokeWidth="2" />
      <line x1="145" y1="240" x2="145" y2="250" stroke="var(--ek-terracotta)" strokeWidth="2" />
      <line x1="195" y1="240" x2="195" y2="250" stroke="var(--ek-terracotta)" strokeWidth="2" />
      <text x="202" y="249" fill="var(--ek-terracotta)" fontSize="11" fontFamily="var(--font-mono)">30 cm</text>

      <g>
        <circle cx="110" cy="145" r="10" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="1" />
        <text x="110" y="149" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ek-soil-dark)">1</text>
        <circle cx="170" cy="115" r="10" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="1" />
        <text x="170" y="119" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ek-soil-dark)">2</text>
        <circle cx="230" cy="145" r="10" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="1" />
        <text x="230" y="149" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ek-soil-dark)">3</text>
      </g>

      <g transform="translate(14,18)">
        <circle cx="6" cy="6" r="6" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="1" />
        <text x="18" y="10" fontSize="10" fill="var(--ek-soil)" fontFamily="var(--font-mono)">SPAD leaves (mid-canopy, sun-lit)</text>
        <line x1="0" y1="24" x2="12" y2="24" stroke="var(--ek-terracotta)" strokeWidth="2" />
        <text x="18" y="28" fontSize="10" fill="var(--ek-soil)" fontFamily="var(--font-mono)">Stem diameter at 30 cm</text>
      </g>
    </svg>
  );
}

export function TreeProtocol({ plan, counts }: Props) {
  const { treesPerPlot } = plan;
  const { plots, trees } = counts;

  return (
    <ProtocolLayout
      title="Tree measurement protocol"
      summary={`Non-destructive measurements on the ${treesPerPlot} central trees of each plot: chlorophyll (SPAD, 3 mid-canopy leaves), stem diameter at 30 cm, pod load and vigour scores.`}
      purpose="Capture canopy N status (SPAD), growth (stem diameter) and reproductive/vegetative condition for each fertigation × genotype combination."
      timing="Between 09:00 and 15:00, overcast or shaded side; avoid wet leaves. One observer per plot for the whole plot."
      stats={[
        { label: "Central trees per plot", value: treesPerPlot },
        { label: "Plots", value: plots },
        { label: "Total tree measurements", value: trees },
        { label: "SPAD leaves per tree", value: 3, hint: "hard-wired in the form" },
      ]}
      gear={[
        "SPAD-502 meter (calibrated daily)",
        "Digital caliper (0.1 mm)",
        "Marking chalk or tape at 30 cm stem height",
        "Tablet running this app (offline mode)",
      ]}
      steps={[
        { label: `Locate the ${treesPerPlot} central trees`, detail: "Use the Layout tab to confirm tree IDs and walking order within the plot." },
        { label: "Select 3 mid-canopy, sun-exposed leaves", detail: "Second or third fully expanded leaf from the tip, one per cardinal orientation when possible." },
        { label: "Take 1 SPAD reading per leaf", detail: "Mid-blade, away from midrib and damage. Record L1, L2, L3 — the mean is computed automatically." },
        { label: "Measure stem diameter at 30 cm", detail: "Marked height above soil, caliper perpendicular to stem axis, avoid swelling or wounds." },
        { label: "Score pod load (0 to 5)", detail: "0 = none, 5 = heavy load of healthy pods. Visual assessment of the whole tree." },
        { label: "Score vigour (0 to 5)", detail: "0 = moribund, 5 = vigorous, full canopy, no chlorosis." },
        { label: "Save and move to next tree", detail: "The app auto-saves; use the stepper arrows or swipe between trees." },
      ]}
      qc={[
        "Re-calibrate SPAD at each plot boundary (or every 30 min).",
        "If readings differ by >5 SPAD units across the 3 leaves, take a 4th reading and drop the outlier.",
        "Flag any tree with obvious disease, pest damage, or recent pruning in notes.",
        "Do not measure under direct rain or on wet leaves.",
      ]}
      figure={<TreeFigure />}
      figureCaption="Tree measurement points: 3 mid-canopy leaves for SPAD, caliper at 30 cm stem height."
    />
  );
}
