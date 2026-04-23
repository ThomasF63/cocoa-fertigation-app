import type { ReactNode } from "react";
import { sig } from "../../engine/statsEngine";

// Recharts passes an opaque payload shape; we treat entries as unknown and
// narrow the fields we need inside the tooltip function.
interface TooltipContentProps {
  active?: boolean;
  payload?: ReadonlyArray<unknown>;
}

// Swatch variant: a filled dot for solid series, a ring for hollow markers.
type SwatchVariant = "solid" | "ring" | "line-dashed";

export interface ChartTooltipRow {
  key: string;
  name: string;
  color: string;
  variant?: SwatchVariant;
  mean: number | null | undefined;
  se?: number | null;
  // Optional extra note shown beneath the value (e.g. "n=4").
  note?: string;
}

// Presentational card: header (label + value) and a list of series rows.
export function ChartTooltipCard({
  headerLabel, headerValue, unit, rows,
}: {
  headerLabel: string;
  headerValue: ReactNode;
  unit: string;
  rows: ChartTooltipRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="chart-tooltip" role="tooltip">
      <div className="chart-tooltip-head">
        <span className="chart-tooltip-key">{headerLabel}</span>
        <span className="chart-tooltip-hval">{headerValue}</span>
      </div>
      {unit && <div className="chart-tooltip-unit">{unit}</div>}
      <ul className="chart-tooltip-rows">
        {rows.map(r => (
          <li key={r.key} className="chart-tooltip-row">
            <Swatch color={r.color} variant={r.variant ?? "solid"} />
            <span className="chart-tooltip-name">{r.name}</span>
            <span className="chart-tooltip-metric mono">
              <span className="chart-tooltip-mean">{sig(r.mean)}</span>
              {r.se != null && Number.isFinite(r.se) && (
                <span className="chart-tooltip-se">± {sig(r.se)}</span>
              )}
            </span>
            {r.note && <span className="chart-tooltip-note">{r.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Swatch({ color, variant }: { color: string; variant: SwatchVariant }) {
  if (variant === "ring") {
    return (
      <span
        className="chart-tooltip-swatch chart-tooltip-swatch-ring"
        style={{ borderColor: color }}
        aria-hidden
      />
    );
  }
  if (variant === "line-dashed") {
    return (
      <span
        className="chart-tooltip-swatch chart-tooltip-swatch-line-dashed"
        style={{ color }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="chart-tooltip-swatch"
      style={{ background: color }}
      aria-hidden
    />
  );
}

// ── Dose response ───────────────────────────────────────────────────────────
const NOMINAL_DOSES = [56, 226, 340];

function snapDose(x: number): number {
  let best = NOMINAL_DOSES[0];
  let bestDist = Math.abs(x - best);
  for (const d of NOMINAL_DOSES) {
    const dist = Math.abs(x - d);
    if (dist < bestDist) { best = d; bestDist = dist; }
  }
  return best;
}

export interface DoseTooltipSummary {
  genotype: string;
  dose: number;
  mean: number;
  se: number;
  n: number;
}

export function makeDoseTooltipContent({
  unit, summary, genotypeColors,
}: {
  unit: string;
  // one row per (genotype × nominal dose)
  summary: DoseTooltipSummary[];
  genotypeColors: Record<string, string>;
}) {
  return function DoseTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) return null;
    // Prefer an explicit n_dose from any hovered item; else snap from value.
    const raw = payload
      .map(p => {
        const inner = (p as { payload?: unknown }).payload as { n_dose?: unknown } | undefined;
        return Number(inner?.n_dose);
      })
      .find(Number.isFinite);
    if (!Number.isFinite(raw)) return null;
    const dose = snapDose(raw as number);

    const rows: ChartTooltipRow[] = summary
      .filter(s => s.dose === dose)
      .sort((a, b) => a.genotype.localeCompare(b.genotype))
      .map(s => ({
        key: s.genotype,
        name: s.genotype,
        color: genotypeColors[s.genotype] ?? "var(--text-primary)",
        mean: s.mean,
        se: s.se,
        note: `n = ${s.n}`,
      }));

    return (
      <ChartTooltipCard
        headerLabel="N dose"
        headerValue={<><span className="mono">{dose}</span> kg N ha⁻¹ yr⁻¹</>}
        unit={unit}
        rows={rows}
      />
    );
  };
}

// ── Depth profile ───────────────────────────────────────────────────────────
export interface DepthTooltipRowSpec {
  key: string;           // series label, e.g. "CCN 51 226"
  genotype: string;
  doseLabel: string;     // "56" / "226" / "340"
  color: string;
  variant: SwatchVariant;
}

export function makeDepthTooltipContent({
  unit, seriesSpecs,
}: {
  unit: string;
  seriesSpecs: DepthTooltipRowSpec[];
}) {
  return function DepthTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) return null;
    const first = payload[0] as { payload?: unknown } | undefined;
    const row = first?.payload as Record<string, unknown> | undefined;
    if (!row) return null;
    const depthLabel = String(row.depth_label ?? "");

    // Group rows by genotype so both CCN 51 and PS 13.19 cluster together.
    const byGeno = new Map<string, ChartTooltipRow[]>();
    for (const spec of seriesSpecs) {
      const mean = row[`${spec.key}_mean`];
      const se = row[`${spec.key}_se`];
      if (typeof mean !== "number" || !Number.isFinite(mean)) continue;
      const arr = byGeno.get(spec.genotype) ?? [];
      arr.push({
        key: spec.key,
        name: `${spec.doseLabel} kg N`,
        color: spec.color,
        variant: spec.variant,
        mean,
        se: typeof se === "number" ? se : null,
      });
      byGeno.set(spec.genotype, arr);
    }

    const rows: ChartTooltipRow[] = [];
    for (const [geno, arr] of byGeno) {
      rows.push({ key: `__hdr_${geno}`, name: geno, color: "transparent", mean: NaN, variant: "solid" });
      // Sort by numeric dose (56 → 226 → 340)
      arr.sort((a, b) => Number(a.name.split(" ")[0]) - Number(b.name.split(" ")[0]));
      rows.push(...arr);
    }

    // Strip the dummy "header" sentinels — render them differently.
    return (
      <div className="chart-tooltip" role="tooltip">
        <div className="chart-tooltip-head">
          <span className="chart-tooltip-key">Depth</span>
          <span className="chart-tooltip-hval"><span className="mono">{depthLabel}</span> cm</span>
        </div>
        {unit && <div className="chart-tooltip-unit">{unit}</div>}
        <ul className="chart-tooltip-rows">
          {rows.map(r => {
            if (r.key.startsWith("__hdr_")) {
              return (
                <li key={r.key} className="chart-tooltip-subhead">{r.name}</li>
              );
            }
            return (
              <li key={r.key} className="chart-tooltip-row">
                <Swatch color={r.color} variant={r.variant ?? "solid"} />
                <span className="chart-tooltip-name">{r.name}</span>
                <span className="chart-tooltip-metric mono">
                  <span className="chart-tooltip-mean">{sig(r.mean)}</span>
                  {r.se != null && Number.isFinite(r.se) && (
                    <span className="chart-tooltip-se">± {sig(r.se)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };
}
