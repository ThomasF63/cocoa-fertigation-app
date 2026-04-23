import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ErrorBar, ResponsiveContainer,
} from "recharts";
import { describe, groupBy } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";
import { TOKENS } from "../../utils/palette";
import { makeDoseTooltipContent, type DoseTooltipSummary } from "./ChartTooltip";

const CHART_FONT_MONO = "'Azeret Mono', ui-monospace, Menlo, Consolas, monospace";

const GENO_COLOR: Record<string, string> = {
  "CCN 51":   TOKENS.stemDark,
  "PS 13.19": TOKENS.berryDark,
};

// Horizontal dodge per genotype: pushes the two genotypes to opposite sides
// of each nominal dose. Applied to scatter dots AND to mean+error markers so
// every series sits centred on its own cloud.
const GENO_DODGE_X: Record<string, number> = {
  "CCN 51":   -10,
  "PS 13.19": +10,
};
const JITTER_SPAN_X = 12; // ±6 kg N ha⁻¹ yr⁻¹ around the dodged position

// ── Scatter layout modes ─────────────────────────────────────────────────
type ScatterMode = "none" | "jitter" | "swarm";

const SCATTER_MODES: { key: ScatterMode; label: string; title: string }[] = [
  { key: "none",   label: "Stack",  title: "Raw positions — dots overlap at identical doses" },
  { key: "jitter", label: "Jitter", title: "Dodge by genotype + random horizontal jitter" },
  { key: "swarm",  label: "Swarm",  title: "Beeswarm — dots step aside to avoid overlap" },
];

// Visible dot geometry — kept in sync with DotShape so the swarm placer uses
// the same footprint it draws.
const DOT_R_VIS = 4;       // rendered radius (px)
const DOT_R_COLL = 5.5;    // collision radius (px) — buffer covers estimation
                           // error in the Y-axis domain, which Recharts pads
                           // slightly beyond the data range.

// Small deterministic hash so jitter is stable across re-renders and keyed by
// the observation identity (plot + depth) rather than by array index.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// Beeswarm: place points around a nominal x so coincident dots nudge sideways
// without overlapping. Runs in pixel space using the measured plot-area size
// so collisions reflect what the user actually sees on screen. Positions are
// returned as x in original data units.
interface SwarmInput { nominalX: number; y: number; id: string; }

function beeswarmLayout(
  points: SwarmInput[],
  ySpan: number,
  xSpan: number,
  plotW: number,
  plotH: number,
  rColl: number,
): Map<string, number> {
  // Pad the y-span a touch: Recharts' auto-domain extends beyond the data
  // range, so the actual pxPerY is smaller than (plotH / dataSpan).
  const pxPerX = plotW / Math.max(xSpan, 1e-9);
  const pxPerY = plotH / Math.max(ySpan * 1.15, 1e-9);
  const step = rColl;               // finer than 2r so candidate slots pack tightly
  const minCenterDistPxSq = (2 * rColl) * (2 * rColl);
  const maxAttempts = 400;

  const groups = new Map<number, SwarmInput[]>();
  for (const p of points) {
    const arr = groups.get(p.nominalX) ?? [];
    arr.push(p);
    groups.set(p.nominalX, arr);
  }

  const out = new Map<string, number>();
  for (const [nx, group] of groups) {
    group.sort((a, b) => a.y - b.y);
    const placed: { xPx: number; yPx: number }[] = [];
    const cx0 = nx * pxPerX;
    for (const p of group) {
      const yPx = p.y * pxPerY;
      let chosenOffPx = 0;
      for (let a = 0; a < maxAttempts; a++) {
        const sign = a === 0 ? 0 : (a % 2 === 1 ? 1 : -1);
        const mag = a === 0 ? 0 : Math.ceil(a / 2) * step;
        const offPx = sign * mag;
        const cx = cx0 + offPx;
        let hit = false;
        for (const q of placed) {
          const dx = cx - q.xPx;
          const dy = yPx - q.yPx;
          if (dx * dx + dy * dy < minCenterDistPxSq) { hit = true; break; }
        }
        if (!hit) { chosenOffPx = offPx; placed.push({ xPx: cx, yPx }); break; }
      }
      out.set(p.id, nx + chosenOffPx / pxPerX);
    }
  }
  return out;
}

// Custom Scatter dot: translucent fill + matching thin border.
function DotShape(props: { cx?: number; cy?: number; fill?: string }) {
  const { cx, cy, fill } = props;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={DOT_R_VIS}
      fill={fill}
      fillOpacity={0.32}
      stroke={fill}
      strokeWidth={1}
      strokeOpacity={0.9}
    />
  );
}

export function DoseResponseChart({ obs, unit, label }: {
  obs: Observation[]; unit: string; label: string;
}) {
  const [mode, setMode] = useState<ScatterMode>("swarm");

  // Measure the rendered plot area so the swarm uses true pixel distances
  // rather than a fixed guess. The chart itself is inside ResponsiveContainer;
  // we observe its wrapper and subtract a conservative estimate of the
  // YAxis / legend / bottom-axis chrome to get the plot area.
  const chartRef = useRef<HTMLDivElement>(null);
  const [plotDims, setPlotDims] = useState({ w: 600, h: 280 });
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setPlotDims({
        w: Math.max(200, rect.width  - 75),   // YAxis ≈ 55 + right margin 20
        h: Math.max(140, rect.height - 60),   // legend + bottom axis
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Per-genotype means (with dodge applied only in jitter/swarm modes so the
  // mean markers follow their scatter cloud). `summary` is the nominal-dose
  // aggregate used by the hover tooltip (no dodge).
  const { genotypes, ySpan, meansByGeno, summary } = useMemo(() => {
    const genotypes = Array.from(new Set(obs.map(o => o.genotype)));
    const groups = groupBy(obs, o => `${o.genotype}|${o.n_dose_kg_ha_yr}`);

    const dodge = (g: string) => mode === "none" ? 0 : (GENO_DODGE_X[g] ?? 0);

    const meansByGeno = new Map<string, { n_dose: number; mean: number; se: number }[]>();
    for (const g of genotypes) meansByGeno.set(g, []);
    const summary: DoseTooltipSummary[] = [];
    for (const [k, arr] of groups) {
      const [gen, doseStr] = k.split("|");
      const dose = Number(doseStr);
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      meansByGeno.get(gen)?.push({ n_dose: dose + dodge(gen), mean: d.mean, se: d.se });
      summary.push({ genotype: gen, dose, mean: d.mean, se: d.se, n: d.n });
    }
    for (const arr of meansByGeno.values()) arr.sort((a, b) => a.n_dose - b.n_dose);

    const ys = obs.map(o => o.value).filter(Number.isFinite);
    const ySpan = ys.length > 1 ? Math.max(...ys) - Math.min(...ys) : 1;

    return { genotypes, ySpan, meansByGeno, summary };
  }, [obs, mode]);

  const doseTooltipContent = useMemo(
    () => makeDoseTooltipContent({ unit, summary, genotypeColors: GENO_COLOR }),
    [unit, summary],
  );

  // Scatter positions — one layer per genotype, layout depends on `mode`.
  const scatterByGeno = useMemo(() => {
    const byGeno = new Map<string, { n_dose: number; value: number }[]>();
    for (const g of genotypes) byGeno.set(g, []);

    if (mode === "none") {
      for (const o of obs) {
        byGeno.get(o.genotype)?.push({ n_dose: o.n_dose_kg_ha_yr, value: o.value });
      }
      return byGeno;
    }

    if (mode === "jitter") {
      for (const o of obs) {
        const d = GENO_DODGE_X[o.genotype] ?? 0;
        const h = hashStr(`${o.plot_id}|${o.depth_label ?? ""}`);
        const jit = ((h % 1000) / 1000 - 0.5) * JITTER_SPAN_X;
        byGeno.get(o.genotype)?.push({
          n_dose: o.n_dose_kg_ha_yr + d + jit,
          value: o.value,
        });
      }
      return byGeno;
    }

    // swarm
    const swarmPoints: (SwarmInput & { g: string; v: number })[] = obs.map((o, i) => ({
      id: `${i}`,
      nominalX: o.n_dose_kg_ha_yr + (GENO_DODGE_X[o.genotype] ?? 0),
      y: o.value,
      g: o.genotype,
      v: o.value,
    }));
    const xSpan = 400; // axis domain is fixed at [0, 400]
    const positions = beeswarmLayout(swarmPoints, ySpan, xSpan, plotDims.w, plotDims.h, DOT_R_COLL);
    for (const p of swarmPoints) {
      const x = positions.get(p.id) ?? p.nominalX;
      byGeno.get(p.g)?.push({ n_dose: x, value: p.v });
    }
    return byGeno;
  }, [obs, mode, genotypes, ySpan, plotDims]);

  if (obs.length === 0) {
    return <div className="muted">No data yet for this variable. Enter measurements in the Data entry tab.</div>;
  }

  return (
    <div className="chart-block">
      <div className="chart-toolbar">
        <span className="chart-toolbar-label">Points</span>
        <div className="chart-toolbar-seg" role="radiogroup" aria-label="Scatter layout">
          {SCATTER_MODES.map(m => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              data-active={mode === m.key}
              className="chart-toolbar-btn"
              title={m.title}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartRef} style={{ width: "100%", height: "clamp(260px, 45vh, 420px)" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 20, left: 10, bottom: 36 }}>
            <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="n_dose"
              domain={[0, 400]}
              ticks={[56, 226, 340]}
              label={{ value: "N dose (kg N ha⁻¹ yr⁻¹)", position: "insideBottom", offset: -18, fontFamily: CHART_FONT_MONO, fontSize: 11, fill: "var(--text-secondary)" }}
              tick={{ fill: "var(--text-secondary)", fontFamily: CHART_FONT_MONO, fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="value"
              label={{ value: unit ? `${label} (${unit})` : label, angle: -90, position: "insideLeft", fontFamily: CHART_FONT_MONO, fontSize: 11, fill: "var(--text-secondary)" }}
              tick={{ fill: "var(--text-secondary)", fontFamily: CHART_FONT_MONO, fontSize: 10 }}
            />
            <Tooltip
              content={doseTooltipContent}
              cursor={{ stroke: "var(--panel-border-strong)", strokeDasharray: "3 3" }}
              offset={0}
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ outline: "none", zIndex: 10, pointerEvents: "none" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              iconSize={10}
              wrapperStyle={{ fontFamily: CHART_FONT_MONO, fontSize: 11, paddingBottom: 6 }}
            />
            {/* Raw scatter per genotype — positions come from the mode above. */}
            {genotypes.map(g => (
              <Scatter
                key={`scatter-${g}`}
                name={g}
                data={scatterByGeno.get(g) ?? []}
                dataKey="value"
                fill={GENO_COLOR[g] ?? TOKENS.soilDark}
                shape={DotShape}
                legendType="none"
              />
            ))}
            {/* Treatment means + SE error bars — dodged to sit with their dots. */}
            {genotypes.map(g => (
              <Line
                key={g}
                type="linear"
                data={meansByGeno.get(g) ?? []}
                dataKey="mean"
                name={g}
                stroke={GENO_COLOR[g] ?? TOKENS.slate}
                strokeWidth={2}
                dot={{ r: 5, fill: GENO_COLOR[g] ?? TOKENS.slate }}
              >
                <ErrorBar dataKey="se" width={6} stroke={GENO_COLOR[g] ?? TOKENS.slate} />
              </Line>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
