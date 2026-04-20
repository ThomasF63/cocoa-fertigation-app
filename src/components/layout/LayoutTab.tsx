import { useEffect, useState } from "react";
import { computeFieldLayout, type FieldLayout } from "../../engine/layoutEngine";
import { getAll } from "../../db/repo";
import type { Plot } from "../../types/design";
import {
  GENOTYPE_FILL,
  GENOTYPE_STROKE,
  DOSE_STROKE_WIDTH,
  DOSE_LABEL,
  TOKENS,
} from "../../utils/palette";

export function LayoutTab() {
  const [layout, setLayout] = useState<FieldLayout | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getAll<Plot>("plots");
      setPlots(p);
      if (p.length > 0) setLayout(computeFieldLayout(p));
    })();
  }, []);

  if (!layout) {
    return (
      <div className="card">
        <div className="card-title">Field layout</div>
        <div className="muted">No plots loaded yet. Go to Overview and seed the factorial or import plot_register.csv.</div>
      </div>
    );
  }

  const selectedPlot = selected ? plots.find(p => p.plot_id === selected) : null;

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-title">48-plot factorial</div>
        <div style={{ overflow: "auto", background: "var(--soil-04)", borderRadius: 8, padding: 12 }}>
          <svg
            viewBox={`-10 -10 ${layout.width + 20} ${layout.height + 20}`}
            style={{ width: "100%", height: "auto", maxHeight: "60vh", display: "block" }}
            role="img"
            aria-label="MCCS field layout: 48 plots"
          >
            {layout.plots.map((cell) => {
              const isSel = cell.plot_id === selected;
              return (
                <g key={cell.plot_id}>
                  <rect
                    x={cell.x}
                    y={cell.y}
                    width={cell.w}
                    height={cell.h}
                    rx={4}
                    fill={GENOTYPE_FILL[cell.genotype]}
                    stroke={isSel ? TOKENS.soilDark : GENOTYPE_STROKE[cell.genotype]}
                    strokeWidth={isSel ? 3 : DOSE_STROKE_WIDTH[cell.dose_code]}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(cell.plot_id)}
                  >
                    <title>
                      {cell.plot_id} ({cell.genotype === "CCN51" ? "CCN 51" : "PS 13.19"}, {DOSE_LABEL[cell.dose_code]} kg N ha-1 yr-1)
                    </title>
                  </rect>
                  <text
                    x={cell.x + 4}
                    y={cell.y + 12}
                    fontFamily="PT Mono, monospace"
                    fontSize="8"
                    fill={TOKENS.soil}
                    pointerEvents="none"
                  >
                    B{cell.block} {cell.genotype === "CCN51" ? "CCN" : "PS"} {DOSE_LABEL[cell.dose_code]}
                  </text>
                  {cell.trees.map((t) => (
                    <circle
                      key={t.tree_id}
                      cx={t.cx}
                      cy={t.cy}
                      r={3}
                      fill={GENOTYPE_STROKE[cell.genotype]}
                      opacity={0.85}
                      pointerEvents="none"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="row muted" style={{ marginTop: 10, gap: 16, flexWrap: "wrap" }}>
          <span className="badge stem">CCN 51</span>
          <span className="badge berry">PS 13.19</span>
          <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="0.8"/></svg> 56 kg N ha-1 yr-1</span>
          <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="1.6"/></svg> 226</span>
          <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="2.6"/></svg> 340</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Plot inspector</div>
        {selectedPlot ? (
          <div className="stat-grid">
            <div className="stat"><span className="stat-label">Plot</span><span className="stat-value mono">{selectedPlot.plot_id}</span></div>
            <div className="stat"><span className="stat-label">Block</span><span className="stat-value">{selectedPlot.block}</span></div>
            <div className="stat"><span className="stat-label">Genotype</span><span className="stat-value">{selectedPlot.genotype_label}</span></div>
            <div className="stat"><span className="stat-label">N dose</span><span className="stat-value">{selectedPlot.n_dose_kg_ha_yr}</span><span className="stat-sub">kg N ha-1 yr-1</span></div>
            <div className="stat"><span className="stat-label">Central trees</span><span className="stat-value">{selectedPlot.measurement_trees_n}</span></div>
            <div className="stat"><span className="stat-label">Rootstock</span><span className="stat-value">{selectedPlot.rootstock}</span></div>
          </div>
        ) : (
          <div className="muted">Tap a plot on the map to see its details.</div>
        )}
      </div>
    </div>
  );
}
