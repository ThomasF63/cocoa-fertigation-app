import { ProtocolLayout } from "./ProtocolLayout";
import type { SamplingPlan, PlanCounts } from "../../types/plan";
import type { DepthLayer } from "../../types/design";

interface Props { plan: SamplingPlan; counts: PlanCounts; }

const LAYER_SHADES = [
  "oklch(65% 0.045 50)",
  "oklch(55% 0.040 50)",
  "oklch(45% 0.035 50)",
  "oklch(35% 0.030 50)",
  "oklch(28% 0.025 50)",
];

function wPoints(n: number, x0: number, x1: number, yTop: number, yBot: number) {
  if (n <= 0) return [] as { x: number; y: number }[];
  if (n === 1) return [{ x: (x0 + x1) / 2, y: (yTop + yBot) / 2 }];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * (x1 - x0);
    const y = i % 2 === 0 ? yBot : yTop;
    pts.push({ x, y });
  }
  return pts;
}

function depthsJoin(layers: DepthLayer[]): string {
  return layers.map(l => `${l.label}`).join(" / ") + " cm";
}

function SoilFigure({ layers, nSubsamples }: { layers: DepthLayer[]; nSubsamples: number }) {
  const W = 340, plotTop = 20, plotBot = 130, plotLeft = 20, plotRight = 320;
  const waypoints = wPoints(nSubsamples, plotLeft + 20, plotRight - 20, plotTop + 12, plotBot - 10);
  const pathD = waypoints.length
    ? `M${waypoints[0].x} ${waypoints[0].y} ` + waypoints.slice(1).map(p => `L${p.x} ${p.y}`).join(" ")
    : "";

  // Depth profile block
  const profileTop = 170;
  const profileBot = 300;
  const profileHeight = profileBot - profileTop;
  const maxDepth = Math.max(...layers.map(l => l.bottom), 1);

  // Core positions: spread across the plot width
  const nCores = Math.min(nSubsamples, 5);
  const coreXs: number[] = [];
  for (let i = 0; i < nCores; i++) {
    const t = nCores === 1 ? 0.5 : i / (nCores - 1);
    coreXs.push(plotLeft + 40 + t * (plotRight - plotLeft - 100));
  }

  return (
    <svg viewBox={`0 0 ${W} 320`} role="img" aria-label="Soil compositing diagram" className="protocol-svg">
      {/* Plot frame */}
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBot - plotTop}
            fill="var(--ek-soil-sand)" stroke="var(--ek-soil-mid)" strokeWidth="1" rx="4" />
      <text x={plotLeft + 6} y={plotTop - 4} fontSize="10" fill="var(--ek-soil-mid)" fontFamily="var(--font-mono)">
        Plot ({nSubsamples} subsamples, compositing pattern in app)
      </text>

      {/* Path */}
      {pathD && (
        <path d={pathD} fill="none" stroke="var(--ek-terracotta)" strokeWidth="1.5" strokeDasharray="4 3" />
      )}

      {/* Subsample points */}
      <g fill="var(--ek-soil-dark)">
        {waypoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--ek-root)">
              {i + 1}
            </text>
          </g>
        ))}
      </g>

      {/* Depth profile */}
      <g transform={`translate(0,${profileTop})`}>
        <text x={plotLeft} y="-6" fontSize="10" fill="var(--ek-soil-mid)" fontFamily="var(--font-mono)">
          Depth profile ({layers.length} layer{layers.length > 1 ? "s" : ""}, composited by depth)
        </text>
        <line x1={plotLeft} y1="0" x2={plotRight} y2="0" stroke="var(--ek-soil-dark)" strokeWidth="1.5" />

        {layers.map((l, i) => {
          const y = (l.top / maxDepth) * profileHeight;
          const h = ((l.bottom - l.top) / maxDepth) * profileHeight;
          const shade = LAYER_SHADES[Math.min(i, LAYER_SHADES.length - 1)];
          return (
            <g key={l.code}>
              <rect x={plotLeft} y={y} width={plotRight - plotLeft} height={h}
                    fill={shade} stroke="var(--ek-soil-mid)" strokeWidth="0.8" />
              <text x={plotLeft + 12} y={y + Math.min(h / 2 + 4, h - 4)}
                    fontSize="11" fill="var(--ek-root)" fontWeight="700" fontFamily="var(--font-mono)">
                {l.label} cm
              </text>
              {/* composite arrow per layer */}
              <path d={`M${plotRight - 60} ${y + h / 2} L${plotRight - 6} ${y + h / 2}`}
                    stroke="var(--ek-soil-dark)" strokeWidth="1" fill="none" markerEnd="url(#soilArrow)" />
            </g>
          );
        })}

        {/* Cores spanning the full profile */}
        <g fill="var(--ek-seed)" stroke="var(--ek-terracotta)" strokeWidth="1.5">
          {coreXs.map((x, i) => (
            <rect key={i} x={x} y={-4} width="8" height={profileHeight + 4} opacity="0.5" />
          ))}
        </g>
      </g>

      <defs>
        <marker id="soilArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ek-soil-dark)" />
        </marker>
      </defs>
    </svg>
  );
}

export function soilGear(plan: SamplingPlan): string[] {
  const nLayers = plan.depths.length;
  return [
    "Dutch auger (ø 5 cm) or split-tube sampler",
    "Depth-marked ruler and sharp knife or spatula",
    `${nLayers || 0} labelled bucket${nLayers === 1 ? "" : "s"} per plot (one per depth layer)`,
    "Ziplock bags (2 L) and permanent marker",
    "GPS or plot flags to confirm location",
  ];
}

export function SoilProtocol({ plan, counts }: Props) {
  const { depths, nSubsamplesPerPlot } = plan;
  const { plots, soil_samples, soil_subsamples } = counts;
  const nLayers = depths.length;
  const depthRange = nLayers ? `${depths[0].top} to ${depths[nLayers - 1].bottom} cm` : "no layers";

  return (
    <ProtocolLayout
      title="Soil composite sampling protocol"
      summary={
        nLayers > 0
          ? `${nSubsamplesPerPlot} subsamples per plot, composited by depth into ${nLayers} layered sample${nLayers > 1 ? "s" : ""} per plot (${depthsJoin(depths)}).`
          : `No soil depth layers are currently selected in the plan — soil sampling is disabled.`
      }
      purpose="Characterise plot-level soil C, N, P, pH and fertility indicators by depth, balancing spatial variability with laboratory cost."
      timing="Single field campaign over 3 to 4 days. Avoid sampling within 48 h after irrigation or heavy rain to stabilise moisture."
      stats={[
        { label: "Subsamples per plot", value: nSubsamplesPerPlot },
        { label: "Depth layers", value: nLayers, hint: depthRange },
        { label: "Plots", value: plots },
        { label: "Composite samples (lab)", value: soil_samples },
        { label: "Field subsamples (total)", value: soil_subsamples },
      ]}
      gear={soilGear(plan)}
      steps={[
        { label: `Walk the compositing pattern inside the plot`, detail: `${nSubsamplesPerPlot} subsample point${nSubsamplesPerPlot === 1 ? "" : "s"} spaced across the plot, at least 1 m from trunks and ≥ 2 m from the plot edge. Pattern (W, X, zigzag, grid, random) is recorded per sample in the Data entry tab.` },
        { label: `Auger a full 0 to ${nLayers ? depths[nLayers - 1].bottom : 50} cm core at each point`, detail: "Keep the core intact on a clean sheet; scrape surface litter aside but do not discard it into the sample." },
        { label: `Split each core into ${nLayers} depth layer${nLayers === 1 ? "" : "s"}`, detail: nLayers > 0 ? `${depthsJoin(depths)}, cut with a knife at the marked depths.` : "No layers configured." },
        { label: `Bulk by depth across the ${nSubsamplesPerPlot} point${nSubsamplesPerPlot === 1 ? "" : "s"}`, detail: `Yields ${nLayers} composite sample${nLayers === 1 ? "" : "s"} per plot.` },
        { label: "Homogenise and subsample into the lab bag", detail: "Break clods, mix thoroughly, quarter down to ~500 g per depth for the labelled lab bag." },
        { label: "Label with plot × depth ID and record", detail: "Use the ID from this app (e.g. B3_CCN51_M_D2). Enter date, sampler, compositing pattern, and visual moisture." },
        { label: "Keep cool and transport daily", detail: "Store in a cool box until evening; air-dry or refrigerate (4 °C) within 24 h depending on target analyses." },
      ]}
      qc={[
        "Clean the auger between depths with a brush to avoid cross-contamination.",
        "Never composite across depths — each layer is a separate lab sample.",
        "If a subsample hits a stone or root cluster, replace that point with a nearby equivalent and note it.",
        "Photograph the first core of each day to document visible horizonation.",
        "Cross-check that bag labels match the sample IDs listed in the app before leaving the plot.",
      ]}
      figure={<SoilFigure layers={depths} nSubsamples={nSubsamplesPerPlot} />}
      figureCaption={
        nLayers > 0
          ? `Top: ${nSubsamplesPerPlot} subsample point${nSubsamplesPerPlot === 1 ? "" : "s"} per plot. Bottom: each core is split into ${nLayers} layer${nLayers === 1 ? "" : "s"}; layers are bulked across subsamples, giving ${nLayers} composite sample${nLayers === 1 ? "" : "s"} per plot.`
          : "No depth layers configured — edit the Sampling plan to enable soil sampling."
      }
    />
  );
}
