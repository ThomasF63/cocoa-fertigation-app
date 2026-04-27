import { useMemo, useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { describe, groupBy } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";
import { TOKENS } from "../../utils/palette";
import { makeDepthTooltipContent, type DepthTooltipRowSpec } from "./ChartTooltip";

const CHART_FONT_UI = "'Archivo', system-ui, sans-serif";
const CHART_FONT_MONO = "'Azeret Mono', ui-monospace, Menlo, Consolas, monospace";

const DOSE_COLOR: Record<string, string> = {
  "L": TOKENS.water,
  "M": TOKENS.seed,
  "H": TOKENS.terracotta,
};

const DOSE_ORDER: ReadonlyArray<"L" | "M" | "H"> = ["L", "M", "H"];

// Horizon bands — the samples themselves. Order = surface → subsoil.
// Alternating tints borrow the existing --ek-depth-* palette.
// Bands are derived from the depth labels actually present in the data so the
// chart adapts to any selectable scheme (1–4 layers, any intervals). Labels
// follow "top-bottom" in cm, matching DEPTH_SCHEMES in types/plan.ts.
interface HorizonBand {
  label: string;
  top: number;
  bottom: number;
  mid: number;
}
function parseHorizonLabel(label: string): HorizonBand | null {
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(label);
  if (!m) return null;
  const top = Number(m[1]);
  const bottom = Number(m[2]);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
  return { label, top, bottom, mid: (top + bottom) / 2 };
}

// Focus key: "dose:L" | "geno:CCN 51" | null (no focus).
type FocusKey = string | null;

// Row is keyed by depth; one series per (genotype, dose).
interface Row {
  depth_mid_cm: number;
  depth_label: string;
  [series: string]: number | string | undefined;
}

export function DepthProfileChart({ obs, unit, label }: {
  obs: Observation[]; unit: string; label: string;
}) {
  const [focus, setFocus] = useState<FocusKey>(null);

  const { rows, series, seriesSpecs, presentDoses, presentGenotypes, presentBands } = useMemo(() => {
    // Only plot depth-resolved observations
    const depthObs = obs.filter(o => o.depth_label);
    if (depthObs.length === 0) {
      return {
        rows: [],
        series: [] as string[],
        seriesSpecs: [] as DepthTooltipRowSpec[],
        presentDoses: [] as Array<"L" | "M" | "H">,
        presentGenotypes: [] as string[],
        presentBands: [] as HorizonBand[],
      };
    }

    const groups = groupBy(depthObs, o => `${o.genotype}|${o.dose_code}|${o.depth_label}`);

    const bandByLabel = new Map<string, HorizonBand>();
    const byDepth = new Map<string, Row>();
    const seriesSet = new Set<string>();
    const doseSet = new Set<"L" | "M" | "H">();
    const genoSet = new Set<string>();
    for (const [k, arr] of groups) {
      const [gen, dose, depth] = k.split("|");
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      let band = bandByLabel.get(depth);
      if (!band) {
        const parsed = parseHorizonLabel(depth);
        if (!parsed) continue;
        band = parsed;
        bandByLabel.set(depth, band);
      }
      const row = byDepth.get(depth) ?? { depth_mid_cm: band.mid, depth_label: depth };
      const key = `${gen} ${doseLabel(dose as "L" | "M" | "H")}`;
      row[`${key}_mean`] = d.mean;
      row[`${key}_se`] = d.se;
      seriesSet.add(key);
      doseSet.add(dose as "L" | "M" | "H");
      genoSet.add(gen);
      byDepth.set(depth, row);
    }

    const rows = Array.from(byDepth.values())
      .sort((a, b) => a.depth_mid_cm - b.depth_mid_cm);

    const series = Array.from(seriesSet).sort();
    const seriesSpecs: DepthTooltipRowSpec[] = series.map(name => {
      const doseCode = parseDoseFromSeries(name);
      const color = DOSE_COLOR[doseCode] ?? TOKENS.slate;
      const isCCN = name.startsWith("CCN 51");
      const genotype = isCCN ? "CCN 51" : "PS 13.19";
      return {
        key: name,
        genotype,
        doseLabel: doseLabel(doseCode),
        color,
        variant: isCCN ? "solid" : "ring",
      };
    });

    const presentDoses = DOSE_ORDER.filter(d => doseSet.has(d));
    const presentGenotypes = Array.from(genoSet).sort();
    const presentBands = Array.from(bandByLabel.values()).sort((a, b) => a.top - b.top);

    return { rows, series, seriesSpecs, presentDoses, presentGenotypes, presentBands };
  }, [obs]);

  const depthTooltipContent = useMemo(
    () => makeDepthTooltipContent({ unit, seriesSpecs }),
    [unit, seriesSpecs],
  );

  if (rows.length === 0) {
    return <div className="muted">No depth-resolved data yet for this variable.</div>;
  }

  const bandTicks = presentBands.map(b => b.mid);
  const bandByMid = new Map(presentBands.map(b => [b.mid, b]));
  const yDomain: [number, number] = [0, presentBands[presentBands.length - 1].bottom];

  return (
    <div className="depth-profile">
      <DepthProfileLegend
        doses={presentDoses}
        genotypes={presentGenotypes}
        focus={focus}
        onFocus={setFocus}
      />
      <div className="depth-profile-plot">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            layout="vertical"
            margin={{ top: 38, right: 24, left: 14, bottom: 10 }}
          >
            {/* Horizon-band strips: the actual sampled intervals.
                Alternating tints give the plot area the cadence of a soil
                profile rather than a generic grid. */}
            {presentBands.map((b, i) => (
              <ReferenceArea
                key={b.label}
                y1={b.top}
                y2={b.bottom}
                fill={i % 2 === 0 ? "var(--soil-04)" : "transparent"}
                stroke="none"
                ifOverflow="hidden"
              />
            ))}

            {/* Value-axis grid only; horizontal rhythm already comes from bands. */}
            <CartesianGrid
              horizontal={false}
              stroke="var(--panel-border)"
              strokeDasharray="2 4"
            />

            <YAxis
              type="number"
              dataKey="depth_mid_cm"
              domain={yDomain}
              ticks={bandTicks}
              axisLine={{ stroke: "var(--panel-border-strong)" }}
              tickLine={{ stroke: "var(--panel-border-strong)" }}
              tickFormatter={(v) => bandByMid.get(v)?.label ?? String(v)}
              tick={{ fill: "var(--text-secondary)", fontFamily: CHART_FONT_MONO, fontSize: 10, letterSpacing: "0.02em" }}
              width={56}
              label={{
                value: "Depth (cm)",
                angle: -90,
                position: "insideLeft",
                offset: -2,
                style: {
                  fontFamily: CHART_FONT_UI,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  fill: "var(--text-secondary)",
                },
              }}
            />
            <XAxis
              type="number"
              orientation="top"
              domain={["auto", "auto"]}
              axisLine={{ stroke: "var(--panel-border-strong)" }}
              tickLine={{ stroke: "var(--panel-border-strong)" }}
              tick={{ fill: "var(--text-secondary)", fontFamily: CHART_FONT_MONO, fontSize: 10 }}
              tickMargin={6}
              label={{
                value: unit ? `${label}  (${unit})` : label,
                position: "top",
                offset: 16,
                style: {
                  fontFamily: CHART_FONT_UI,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  fill: "var(--text-secondary)",
                },
              }}
            />

            {/* Ground-surface datum — an instrument's null reference line. */}
            <ReferenceLine
              y={0}
              stroke="var(--ek-soil-warm)"
              strokeOpacity={0.55}
              strokeWidth={1.25}
              ifOverflow="visible"
            />

            <Tooltip
              content={depthTooltipContent}
              cursor={{ stroke: "var(--panel-border-strong)", strokeDasharray: "3 3" }}
              offset={0}
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ outline: "none", zIndex: 10, pointerEvents: "none" }}
            />

            {series.map(name => {
              const doseCode = parseDoseFromSeries(name);
              const color = DOSE_COLOR[doseCode] ?? TOKENS.slate;
              const isCCN = name.startsWith("CCN 51");
              const dash = isCCN ? undefined : "6 4";
              const active = isFocused(focus, name);
              const opacity = focus === null ? 1 : active ? 1 : 0.18;
              // Genotype is also encoded as filled vs hollow dot, so coincident
              // points from two genotypes at the same depth read as two markers
              // rather than collapsing into one filled circle.
              const dot = isCCN
                ? { r: active ? 5 : 4.5, fill: color, stroke: color, strokeWidth: 1, opacity }
                : { r: active ? 5 : 4.5, fill: "var(--panel-bg)", stroke: color, strokeWidth: 2, opacity };
              return (
                <Line
                  key={name}
                  type="linear"
                  dataKey={`${name}_mean`}
                  name={name}
                  stroke={color}
                  strokeWidth={active ? 2.5 : 1.75}
                  strokeDasharray={dash}
                  strokeOpacity={opacity}
                  dot={dot}
                  activeDot={{ r: 6, fill: "var(--panel-bg)", stroke: color, strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <ErrorBar
                    dataKey={`${name}_se`}
                    direction="x"
                    width={6}
                    stroke={color}
                    strokeWidth={1.25}
                    opacity={opacity}
                  />
                </Line>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Bi-variate key rendered above the plot as an instrument caption.
// Dose drives colour, genotype drives line style + marker fill. Splitting the
// encoding into two independent sub-keys avoids the 6-item combinatorial
// cram. Hovering or clicking a chip focuses its axis and dims the rest.
function DepthProfileLegend({
  doses, genotypes, focus, onFocus,
}: {
  doses: ReadonlyArray<"L" | "M" | "H">;
  genotypes: ReadonlyArray<string>;
  focus: FocusKey;
  onFocus: (key: FocusKey) => void;
}) {
  return (
    <div
      className="depth-profile-legend"
      role="group"
      aria-label="Chart legend"
      onMouseLeave={() => onFocus(null)}
    >
      <div className="depth-profile-legend-group">
        <span className="depth-profile-legend-label">
          N dose
          <span className="depth-profile-legend-unit"> kg N ha⁻¹ yr⁻¹</span>
        </span>
        <ul className="depth-profile-legend-items">
          {doses.map(code => {
            const key = `dose:${code}`;
            const pressed = focus === key;
            return (
              <li key={code}>
                <button
                  type="button"
                  className="depth-profile-legend-chip"
                  data-dim={focus !== null && !pressed ? "" : undefined}
                  aria-pressed={pressed}
                  onMouseEnter={() => onFocus(key)}
                  onFocus={() => onFocus(key)}
                  onBlur={() => onFocus(null)}
                  onClick={() => onFocus(pressed ? null : key)}
                >
                  <LineMarker color={DOSE_COLOR[code]} filled />
                  <span className="depth-profile-legend-text mono">{doseLabel(code)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="depth-profile-legend-divider" aria-hidden />
      <div className="depth-profile-legend-group">
        <span className="depth-profile-legend-label">Genotype</span>
        <ul className="depth-profile-legend-items">
          {genotypes.map(gen => {
            const isCCN = gen.toUpperCase().startsWith("CCN");
            const key = `geno:${gen}`;
            const pressed = focus === key;
            return (
              <li key={gen}>
                <button
                  type="button"
                  className="depth-profile-legend-chip"
                  data-dim={focus !== null && !pressed ? "" : undefined}
                  aria-pressed={pressed}
                  onMouseEnter={() => onFocus(key)}
                  onFocus={() => onFocus(key)}
                  onBlur={() => onFocus(null)}
                  onClick={() => onFocus(pressed ? null : key)}
                >
                  <LineMarker color="var(--text-secondary)" filled={isCCN} dashed={!isCCN} />
                  <span className="depth-profile-legend-text">{gen}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// A mini "line + dot" glyph that mirrors the series rendering — the legend is
// a literal sample of the chart, not a coloured square.
function LineMarker({
  color, filled, dashed,
}: {
  color: string;
  filled: boolean;
  dashed?: boolean;
}) {
  const width = 28;
  const height = 10;
  const cy = height / 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      focusable="false"
      className="depth-profile-legend-glyph"
    >
      <line
        x1={1}
        x2={width - 1}
        y1={cy}
        y2={cy}
        stroke={color}
        strokeWidth={1.75}
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <circle
        cx={width / 2}
        cy={cy}
        r={3.25}
        fill={filled ? color : "var(--panel-bg)"}
        stroke={color}
        strokeWidth={filled ? 1 : 1.75}
      />
    </svg>
  );
}

function isFocused(focus: FocusKey, seriesName: string): boolean {
  if (focus === null) return true;
  if (focus.startsWith("dose:")) {
    const code = focus.slice(5) as "L" | "M" | "H";
    return parseDoseFromSeries(seriesName) === code;
  }
  if (focus.startsWith("geno:")) {
    const g = focus.slice(5);
    return seriesName.startsWith(g);
  }
  return true;
}

function doseLabel(code: "L" | "M" | "H"): string {
  return code === "L" ? "56" : code === "M" ? "226" : "340";
}
function parseDoseFromSeries(name: string): "L" | "M" | "H" {
  if (name.endsWith("56"))  return "L";
  if (name.endsWith("226")) return "M";
  return "H";
}
