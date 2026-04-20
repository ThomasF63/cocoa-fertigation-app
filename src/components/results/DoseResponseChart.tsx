import { useMemo } from "react";
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ErrorBar, ResponsiveContainer,
} from "recharts";
import { describe, groupBy } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";
import { TOKENS } from "../../utils/palette";

const GENO_COLOR: Record<string, string> = {
  "CCN 51":   TOKENS.stemDark,
  "PS 13.19": TOKENS.berryDark,
};

type Point = {
  n_dose: number;
  _errs: Record<string, number>;
} & Record<string, number | undefined | Record<string, number>>;

export function DoseResponseChart({ obs, unit, label }: {
  obs: Observation[]; unit: string; label: string;
}) {
  // Aggregate across replicates (and across depths for depth-level vars) to
  // one mean per (genotype, dose). Error bar = SE.
  const { rows, genotypes, scatter } = useMemo(() => {
    const genotypes = Array.from(new Set(obs.map(o => o.genotype)));
    const groups = groupBy(obs, o => `${o.genotype}|${o.n_dose_kg_ha_yr}`);

    const byDose = new Map<number, Point>();
    for (const [k, arr] of groups) {
      const [gen, doseStr] = k.split("|");
      const dose = Number(doseStr);
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      const existing: Point = byDose.get(dose) ?? { n_dose: dose, _errs: {} };
      existing[`${gen}_mean`] = d.mean;
      existing._errs[gen] = d.se;
      byDose.set(dose, existing);
    }
    const rows = Array.from(byDose.values()).sort((a, b) => a.n_dose - b.n_dose);

    // All individual observations, for a faint scatter layer
    const scatter = obs.map(o => ({
      n_dose: o.n_dose_kg_ha_yr,
      genotype: o.genotype,
      value: o.value,
    }));

    return { rows, genotypes, scatter };
  }, [obs]);

  if (obs.length === 0) {
    return <div className="muted">No data yet for this variable. Enter measurements in the Data entry tab.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={rows} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="n_dose"
          domain={[0, 400]}
          ticks={[56, 226, 340]}
          label={{ value: "N dose (kg N ha\u207B\u00B9 yr\u207B\u00B9)", position: "bottom", offset: 8, fontFamily: "PT Mono, monospace", fontSize: 11, fill: "var(--text-secondary)" }}
          tick={{ fill: "var(--text-secondary)", fontFamily: "PT Mono, monospace", fontSize: 10 }}
        />
        <YAxis
          label={{ value: unit ? `${label} (${unit})` : label, angle: -90, position: "insideLeft", fontFamily: "PT Mono, monospace", fontSize: 11, fill: "var(--text-secondary)" }}
          tick={{ fill: "var(--text-secondary)", fontFamily: "PT Mono, monospace", fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ fontFamily: "PT Mono, monospace", fontSize: 12, borderRadius: 8, border: "1px solid var(--panel-border)" }}
        />
        <Legend wrapperStyle={{ fontFamily: "PT Mono, monospace", fontSize: 11 }} />
        {/* Raw scatter: show individual plot-level observations lightly */}
        <Scatter
          name="Individual plots"
          data={scatter}
          dataKey="value"
          shape="circle"
          fill={TOKENS.soilDark}
          opacity={0.18}
        />
        {/* Treatment means with SE error bars, one line per genotype */}
        {genotypes.map(g => (
          <Line
            key={g}
            type="linear"
            dataKey={`${g}_mean`}
            name={g}
            stroke={GENO_COLOR[g] ?? TOKENS.slate}
            strokeWidth={2}
            dot={{ r: 5, fill: GENO_COLOR[g] ?? TOKENS.slate }}
          >
            <ErrorBar
              dataKey={`${g}_mean`}
              width={6}
              stroke={GENO_COLOR[g] ?? TOKENS.slate}
            />
          </Line>
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
