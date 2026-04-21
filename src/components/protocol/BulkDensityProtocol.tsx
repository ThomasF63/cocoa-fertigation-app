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

function depthsJoin(layers: DepthLayer[]): string {
  return layers.map(l => l.label).join(" / ") + " cm";
}

function BDFigure({ layers }: { layers: DepthLayer[] }) {
  const W = 340, profileTop = 40, profileBot = 260;
  const profileHeight = profileBot - profileTop;
  const maxDepth = Math.max(...layers.map(l => l.bottom), 1);

  return (
    <svg viewBox={`0 0 ${W} 300`} role="img" aria-label="Bulk density ring diagram" className="protocol-svg">
      <line x1="10" y1={profileTop} x2="330" y2={profileTop} stroke="var(--ek-soil-dark)" strokeWidth="1.5" />
      <text x="14" y={profileTop - 6} fontSize="10" fill="var(--ek-soil-mid)" fontFamily="var(--font-mono)">
        Pit face (0 cm)
      </text>

      {layers.length === 0 && (
        <text x={W / 2} y={profileTop + 60} textAnchor="middle" fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-mono)">
          No BD ring depths configured
        </text>
      )}

      {layers.map((l, i) => {
        const y = profileTop + (l.top / maxDepth) * profileHeight;
        const h = ((l.bottom - l.top) / maxDepth) * profileHeight;
        const ringH = Math.min(24, Math.max(12, h - 10));
        const ringY = y + (h - ringH) / 2;
        const shade = LAYER_SHADES[Math.min(i, LAYER_SHADES.length - 1)];
        return (
          <g key={l.code}>
            <rect x="10" y={y} width="320" height={h} fill={shade} stroke="var(--ek-soil-mid)" strokeWidth="0.8" />
            <text x="22" y={y + Math.min(h / 2 + 4, h - 4)} fontSize="11" fill="var(--ek-root)"
                  fontWeight="700" fontFamily="var(--font-mono)">{l.label} cm</text>
            {/* Ring */}
            <rect x="150" y={ringY} width="40" height={ringH} rx="2"
                  stroke="var(--ek-terracotta)" strokeWidth="2.5" fill="none" />
            <rect x="152" y={ringY + 2} width="36" height={ringH - 4} rx="1"
                  fill="var(--ek-seed)" opacity="0.45" />
            <text x="198" y={ringY + ringH / 2 + 3} fontSize="10" fill="var(--ek-soil-dark)" fontFamily="var(--font-mono)">
              ring, known V
            </text>
          </g>
        );
      })}

      <g transform="translate(14, 275)">
        <rect x="0" y="0" width="16" height="10" stroke="var(--ek-terracotta)" strokeWidth="2" fill="var(--ek-seed)" fillOpacity="0.45" />
        <text x="22" y="9" fontSize="10" fill="var(--ek-soil)" fontFamily="var(--font-mono)">
          BD ring: intact core, mass ÷ volume → ρb (g cm⁻³)
        </text>
      </g>
    </svg>
  );
}

export function BulkDensityProtocol({ plan, counts }: Props) {
  const { bdRingDepths } = plan;
  const { bd_points, bd_rings } = counts;
  const nLayers = bdRingDepths.length;

  const enabled = bd_points > 0 && nLayers > 0;

  return (
    <ProtocolLayout
      title="Bulk density ring protocol"
      summary={
        enabled
          ? `Intact-core Kopecky rings driven horizontally into a freshly cut pit face, one ring per depth layer at ${bd_points} sampling point${bd_points === 1 ? "" : "s"} (${bd_rings} ring${bd_rings === 1 ? "" : "s"} total across ${nLayers} depth layer${nLayers === 1 ? "" : "s"}: ${depthsJoin(bdRingDepths)}).`
          : "Bulk density sampling is currently disabled in the plan (no BD points or no BD depths configured)."
      }
      purpose="Convert gravimetric soil concentrations (e.g. % C, mg N kg⁻¹) into areal stocks (Mg ha⁻¹) using measured bulk density by depth."
      timing="Same campaign as soil composites; dig one BD pit per selected point, avoid wheel tracks and tree trunks."
      stats={[
        { label: "BD sampling points", value: bd_points },
        { label: "Depth layers", value: nLayers },
        { label: "Total rings", value: bd_rings },
        { label: "Rings per pit", value: nLayers },
      ]}
      gear={[
        `Steel BD rings of known volume (e.g. 100 cm³), ${Math.max(nLayers, 1)} per pit`,
        "Ring driver / mallet and straight blade for trimming",
        "Shovel for opening a clean vertical pit face",
        "Pre-labelled aluminium tins or sealed bags",
        "Field balance (0.01 g) for fresh weight, oven (105 °C) for dry weight",
      ]}
      steps={[
        { label: `Open a clean vertical pit to ≥ ${nLayers ? bdRingDepths[nLayers - 1].bottom + 5 : 55} cm`, detail: "One pit per selected BD point, outside the tree dripline, wheel tracks, and irrigation lines." },
        { label: "Trim the pit face smooth at each depth", detail: nLayers > 0 ? `Make a level shelf at the centre of each layer: ${bdRingDepths.map(l => `${(l.top + l.bottom) / 2} cm`).join(", ")}.` : "No layers configured." },
        { label: "Drive the ring horizontally into the face", detail: "Use the driver to push the ring fully in without compacting; stop when flush." },
        { label: "Excavate around the ring and lift intact", detail: "Cut the soil above and below with a blade; keep the core flush with both ring ends." },
        { label: "Trim excess soil flush with both rims", detail: "Flat blade, no crumb loss; this defines the known volume." },
        { label: "Transfer to labelled tin and seal", detail: "Label with ring ID (e.g. BD_03_D2), depth, plot, and sampling date." },
        { label: "Weigh fresh, dry at 105 °C to constant mass", detail: "Record fresh weight same day; oven-dry 48 h; record dry weight. App computes ρb = dry / volume." },
      ]}
      qc={[
        "Discard any ring where the core is cracked, compressed, or short of the rim.",
        "Check ring volume monthly; replace dented rings.",
        "Weigh tin + soil and tare separately; tare before and after oven-drying to catch tin mass changes.",
        "Target ≤ 5% duplicate variation where duplicate rings are taken.",
      ]}
      figure={<BDFigure layers={bdRingDepths} />}
      figureCaption={
        enabled
          ? `One BD ring per depth layer, driven horizontally into the pit face at the centre of each of the ${nLayers} configured layer${nLayers === 1 ? "" : "s"}.`
          : "No BD sampling configured — edit the Sampling plan to enable."
      }
    />
  );
}
