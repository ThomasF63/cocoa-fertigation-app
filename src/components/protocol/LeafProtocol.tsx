import { ProtocolLayout } from "./ProtocolLayout";
import type { SamplingPlan, PlanCounts } from "../../types/plan";

interface Props { plan: SamplingPlan; counts: PlanCounts; }

const LEAVES_PER_TREE = 3;

function ringPositions(n: number, cx: number, cy: number, rx: number, ry: number) {
  if (n <= 0) return [] as { x: number; y: number }[];
  if (n === 1) return [{ x: cx, y: cy }];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function LeafFigure({ nTrees }: { nTrees: number }) {
  const trees = ringPositions(nTrees, 160, 180, 115, 60);
  const bag = { x: 295, y: 55 };

  return (
    <svg viewBox="0 0 340 300" role="img" aria-label="Leaf composite diagram" className="protocol-svg">
      <line x1="10" y1="270" x2="330" y2="270" stroke="var(--ek-soil-mid)" strokeWidth="1.5" />
      <rect x="14" y="30" width="312" height="240" fill="none" stroke="var(--ek-soil-mid)" strokeWidth="0.8" strokeDasharray="3 3" rx="4" />
      <text x="20" y="24" fontSize="10" fill="var(--ek-soil-mid)" fontFamily="var(--font-mono)">
        Plot — {nTrees} tree{nTrees === 1 ? "" : "s"} sampled for leaf composite
      </text>

      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x},${t.y})`}>
          <ellipse cx="0" cy="-20" rx="22" ry="18" fill="var(--ek-stem)" opacity="0.55" stroke="var(--ek-stem-dark)" strokeWidth="1" />
          <rect x="-3" y="-5" width="6" height="26" fill="var(--ek-soil-warm)" stroke="var(--ek-soil-dark)" strokeWidth="0.6" />
          <circle cx="-12" cy="-18" r="3" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="0.6" />
          <circle cx="0"   cy="-28" r="3" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="0.6" />
          <circle cx="12"  cy="-18" r="3" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="0.6" />
          <text x="0" y="20" textAnchor="middle" fontSize="9" fill="var(--ek-soil-dark)" fontFamily="var(--font-mono)">
            {i + 1}
          </text>
        </g>
      ))}

      <g transform={`translate(${bag.x}, ${bag.y})`}>
        <rect x="-24" y="-14" width="48" height="34" rx="3" fill="var(--ek-root)" stroke="var(--ek-soil-dark)" strokeWidth="1" />
        <text x="0" y="0" textAnchor="middle" fontSize="9" fill="var(--ek-soil-dark)" fontFamily="var(--font-mono)">composite</text>
        <text x="0" y="12" textAnchor="middle" fontSize="9" fill="var(--ek-soil-dark)" fontFamily="var(--font-mono)">bag</text>
      </g>

      <g stroke="var(--ek-terracotta)" strokeWidth="1.2" fill="none" strokeDasharray="3 3">
        {trees.map((t, i) => (
          <path key={i} d={`M${t.x} ${t.y - 22} Q${(t.x + bag.x) / 2} ${(t.y + bag.y) / 2 - 40} ${bag.x - 12} ${bag.y}`} markerEnd="url(#leafArrow)" />
        ))}
      </g>

      <g transform="translate(14, 286)">
        <circle cx="6" cy="-4" r="4" fill="var(--ek-seed)" stroke="var(--ek-soil-dark)" strokeWidth="0.6" />
        <text x="16" y="0" fontSize="10" fill="var(--ek-soil)" fontFamily="var(--font-mono)">
          {LEAVES_PER_TREE} mid-canopy leaves × {nTrees} tree{nTrees === 1 ? "" : "s"} = {LEAVES_PER_TREE * nTrees} leaves per plot composite
        </text>
      </g>

      <defs>
        <marker id="leafArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ek-terracotta)" />
        </marker>
      </defs>
    </svg>
  );
}

export function LeafProtocol({ plan, counts }: Props) {
  const { nLeafTreesPerPlot, includeLeafComposites } = plan;
  const { plots, leaf_composites, leaf_subsamples } = counts;

  const enabled = includeLeafComposites && nLeafTreesPerPlot > 0;
  const leavesPerPlot = LEAVES_PER_TREE * nLeafTreesPerPlot;

  return (
    <ProtocolLayout
      title="Leaf composite protocol"
      summary={
        enabled
          ? `One composite leaf sample per plot, pooled from ${LEAVES_PER_TREE} mid-canopy sun-leaves on ${nLeafTreesPerPlot} tree${nLeafTreesPerPlot === 1 ? "" : "s"} (${leavesPerPlot} leaves per plot, ${leaf_composites} composite${leaf_composites === 1 ? "" : "s"} total).`
          : "Leaf composites are currently disabled in the plan."
      }
      purpose="Provide plot-level foliar nutrient status (N, P, K, S, micros) for comparison across genotypes and N doses."
      timing="Mid-morning (09:00 to 11:00) on dry foliage, same week as soil sampling. Avoid flushing leaves."
      stats={[
        { label: "Trees sampled per plot", value: nLeafTreesPerPlot },
        { label: "Leaves per tree", value: LEAVES_PER_TREE, hint: "protocol constant" },
        { label: "Leaves per plot", value: leavesPerPlot },
        { label: "Composites (plots)", value: leaf_composites },
        { label: "Total leaves collected", value: leaf_subsamples },
        { label: "Plots", value: plots },
      ]}
      gear={[
        "Pruning shears (cleaned between plots)",
        "Paper bags (pre-labelled) or breathable cloth bags",
        "Cool box for transport",
        "Drying oven (60 to 65 °C) for sample preparation",
      ]}
      steps={[
        { label: `Select the ${nLeafTreesPerPlot} designated tree${nLeafTreesPerPlot === 1 ? "" : "s"} per plot`, detail: `Use the Layout tab. Prefer the central ${nLeafTreesPerPlot} of the ${plan.treesPerPlot} measured trees.` },
        { label: `On each tree, pick ${LEAVES_PER_TREE} fully expanded sun-leaves`, detail: "2nd or 3rd leaf from the tip of a mid-canopy flush, one per cardinal side when possible." },
        { label: "Check leaf condition before picking", detail: "Reject leaves with disease spots, herbivory, or heavy dust. No flush leaves (pale, soft)." },
        { label: `Pool the ${leavesPerPlot} leaves into one labelled bag`, detail: "One bag = one plot composite. Label with plot ID (e.g. B3_CCN51_M_leaves) and date." },
        { label: "Record the sample in the app", detail: "Enter trees sampled, number of leaves, observer and date before leaving the plot." },
        { label: "Transport cool, weigh fresh same day", detail: "Record fresh weight once back at base, before drying." },
        { label: "Oven-dry at 60 to 65 °C to constant mass", detail: "Typically 48 h; record dry weight, then grind for laboratory digestion." },
      ]}
      qc={[
        "Clean shears between plots with 70% ethanol to avoid pathogen transfer.",
        "Do not mix leaves from different plots — one bag strictly per plot.",
        `If a tree has too few eligible leaves, document it and draw from an adjacent central tree; note the substitution.`,
        "Target 10 to 15 g dry mass per composite to ensure enough material for all analyses.",
      ]}
      figure={<LeafFigure nTrees={Math.max(nLeafTreesPerPlot, 1)} />}
      figureCaption={
        enabled
          ? `${nLeafTreesPerPlot} tree${nLeafTreesPerPlot === 1 ? "" : "s"} per plot × ${LEAVES_PER_TREE} mid-canopy sun-leaves per tree, pooled into one labelled composite bag.`
          : "Leaf composites disabled — toggle on in the Sampling plan."
      }
    />
  );
}
