import { useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ErrorBar,
  ResponsiveContainer,
} from "recharts";
import { describe, groupBy } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";
import { TOKENS } from "../../utils/palette";

const DOSE_COLOR: Record<string, string> = {
  "L": TOKENS.water,
  "M": TOKENS.seed,
  "H": TOKENS.terracotta,
};

const DEPTH_ORDER = ["0-10", "10-20", "20-30", "30-50"];

// Row is keyed by depth; one series per (genotype, dose).
interface Row {
  depth_mid_cm: number;
  depth_label: string;
  [series: string]: number | string | undefined;
}

export function DepthProfileChart({ obs, unit, label }: {
  obs: Observation[]; unit: string; label: string;
}) {
  const { rows, series } = useMemo(() => {
    // Only plot depth-resolved observations
    const depthObs = obs.filter(o => o.depth_label);
    if (depthObs.length === 0) return { rows: [], series: [] as string[] };

    const groups = groupBy(depthObs, o => `${o.genotype}|${o.dose_code}|${o.depth_label}`);

    const byDepth = new Map<string, Row>();
    const seriesSet = new Set<string>();
    for (const [k, arr] of groups) {
      const [gen, dose, depth] = k.split("|");
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      const midRange = depth.split("-").map(Number);
      const mid = (midRange[0] + midRange[1]) / 2;
      const row = byDepth.get(depth) ?? { depth_mid_cm: mid, depth_label: depth };
      const key = `${gen} ${doseLabel(dose as "L" | "M" | "H")}`;
      row[`${key}_mean`] = d.mean;
      row[`${key}_se`] = d.se;
      seriesSet.add(key);
      byDepth.set(depth, row);
    }

    const rows = Array.from(byDepth.values())
      .sort((a, b) => DEPTH_ORDER.indexOf(a.depth_label) - DEPTH_ORDER.indexOf(b.depth_label));

    return { rows, series: Array.from(seriesSet).sort() };
  }, [obs]);

  if (rows.length === 0) {
    return <div className="muted">No depth-resolved data yet for this variable.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={rows} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" />
        <YAxis
          type="number"
          dataKey="depth_mid_cm"
          reversed
          domain={[0, 50]}
          ticks={[5, 15, 25, 40]}
          tickFormatter={(v) => {
            // Return the depth range corresponding to this mid
            const row = rows.find(r => r.depth_mid_cm === v);
            return row ? row.depth_label : String(v);
          }}
          label={{ value: "Depth (cm)", angle: -90, position: "insideLeft", fontFamily: "PT Mono, monospace", fontSize: 11, fill: "var(--text-secondary)" }}
          tick={{ fill: "var(--text-secondary)", fontFamily: "PT Mono, monospace", fontSize: 10 }}
        />
        <XAxis
          type="number"
          label={{ value: unit ? `${label} (${unit})` : label, position: "bottom", offset: 8, fontFamily: "PT Mono, monospace", fontSize: 11, fill: "var(--text-secondary)" }}
          tick={{ fill: "var(--text-secondary)", fontFamily: "PT Mono, monospace", fontSize: 10 }}
        />
        <Tooltip contentStyle={{ fontFamily: "PT Mono, monospace", fontSize: 12, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        <Legend wrapperStyle={{ fontFamily: "PT Mono, monospace", fontSize: 11 }} />
        {series.map(name => {
          const doseCode = parseDoseFromSeries(name);
          const color = DOSE_COLOR[doseCode] ?? TOKENS.slate;
          const dash = name.startsWith("CCN 51") ? undefined : "5 3";
          return (
            <Line
              key={name}
              type="linear"
              dataKey={`${name}_mean`}
              name={name}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={dash}
              dot={{ r: 4, fill: color }}
            >
              <ErrorBar dataKey={`${name}_se`} direction="x" width={6} stroke={color} />
            </Line>
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function doseLabel(code: "L" | "M" | "H"): string {
  return code === "L" ? "56" : code === "M" ? "226" : "340";
}
function parseDoseFromSeries(name: string): "L" | "M" | "H" {
  if (name.endsWith("56"))  return "L";
  if (name.endsWith("226")) return "M";
  return "H";
}
