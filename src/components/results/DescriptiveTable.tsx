import { useMemo } from "react";
import { describe, groupBy, sig } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";

export function DescriptiveTable({
  obs, includeDepth, unit,
}: { obs: Observation[]; includeDepth: boolean; unit: string }) {
  const rows = useMemo(() => {
    const keyFn = includeDepth
      ? (o: Observation) => `${o.genotype}|${o.n_dose_kg_ha_yr}|${o.depth_label ?? ""}`
      : (o: Observation) => `${o.genotype}|${o.n_dose_kg_ha_yr}`;
    const groups = groupBy(obs, keyFn);
    const out: {
      genotype: string; dose: number; depth?: string;
      n: number; mean: string; sd: string; se: string; ci: string; range: string;
    }[] = [];
    for (const [k, arr] of groups) {
      const [gen, dose, depth] = k.split("|");
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      out.push({
        genotype: gen,
        dose: Number(dose),
        depth: depth || undefined,
        n: d.n,
        mean: sig(d.mean),
        sd: sig(d.sd),
        se: sig(d.se),
        ci: `${sig(d.ci95_lo)} – ${sig(d.ci95_hi)}`,
        range: `${sig(d.min)} – ${sig(d.max)}`,
      });
    }
    out.sort((a, b) =>
      a.genotype.localeCompare(b.genotype) ||
      a.dose - b.dose ||
      (a.depth ?? "").localeCompare(b.depth ?? ""),
    );
    return out;
  }, [obs, includeDepth]);

  if (rows.length === 0) {
    return <div className="muted">No data yet for this variable. Enter measurements in the Data entry tab.</div>;
  }

  return (
    <div style={{ overflow: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Genotype</th>
            <th>N dose</th>
            {includeDepth && <th>Depth</th>}
            <th>n</th>
            <th>Mean {unit && `(${unit})`}</th>
            <th>SD</th>
            <th>SE</th>
            <th>95% CI</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.genotype}</td>
              <td className="mono">{r.dose}</td>
              {includeDepth && <td className="mono">{r.depth}</td>}
              <td className="mono">{r.n}</td>
              <td className="mono">{r.mean}</td>
              <td className="mono">{r.sd}</td>
              <td className="mono">{r.se}</td>
              <td className="mono">{r.ci}</td>
              <td className="mono">{r.range}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
