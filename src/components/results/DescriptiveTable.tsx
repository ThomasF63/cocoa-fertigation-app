import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { describe, groupBy, sig, type DescribeResult } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";
import { DOSE_CODE_BY_KG, GENOTYPE_CODE_BY_LABEL } from "../../utils/palette";
import type { GenotypeLabel } from "../../types/design";

const BARS_KEY = "mccs.descriptive.dataBars";

interface Row {
  genotype: string;
  dose: number;
  depth?: string;
  d: DescribeResult;
}

interface Scale { lo: number; hi: number }

interface Scales {
  n: Scale;
  mean: Scale;
  sd: Scale;
  se: Scale;
  ci: Scale;
  range: Scale;
}

type SortCol =
  | "genotype" | "dose" | "depth"
  | "n" | "mean" | "sd" | "se" | "ci" | "range";
type SortDir = "asc" | "desc";
interface SortKey { col: SortCol; dir: SortDir }

function readBarsPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(BARS_KEY);
  return v === null ? true : v === "1";
}

/** Inline background-gradient style for a left-anchored data bar. */
function dataBarStyle(value: number, scale: Scale, color: string): CSSProperties | undefined {
  const span = scale.hi - scale.lo;
  const pct = span <= 0 ? 100 : Math.max(0, Math.min(100, ((value - scale.lo) / span) * 100));
  return {
    background: `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`,
  };
}

/** Returns left/width (%) for a floating segment positioned on a global scale. */
function floatBarPos(lo: number, hi: number, scale: Scale): { left: number; width: number } {
  const span = scale.hi - scale.lo;
  if (span <= 0) return { left: 0, width: 100 };
  const left = ((lo - scale.lo) / span) * 100;
  const right = ((hi - scale.lo) / span) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(1.5, Math.min(100, right - left)),
  };
}

/** Row comparator for a single sort column. Numeric cols use numeric diff;
    string cols use localeCompare. For CI, sort by lower bound; for Range, by min. */
function rowCompare(a: Row, b: Row, col: SortCol): number {
  switch (col) {
    case "genotype": return a.genotype.localeCompare(b.genotype);
    case "dose":     return a.dose - b.dose;
    case "depth":    return (a.depth ?? "").localeCompare(b.depth ?? "");
    case "n":        return a.d.n - b.d.n;
    case "mean":     return a.d.mean - b.d.mean;
    case "sd":       return a.d.sd - b.d.sd;
    case "se":       return a.d.se - b.d.se;
    case "ci":       return a.d.ci95_lo - b.d.ci95_lo;
    case "range":    return a.d.min - b.d.min;
  }
}

export function DescriptiveTable({
  obs, includeDepth, unit,
}: { obs: Observation[]; includeDepth: boolean; unit: string }) {
  const [showBars, setShowBars] = useState<boolean>(readBarsPref);

  // Exclusion-based filters: empty Set = show all. Keyed by stringified value.
  const [genoExcluded, setGenoExcluded]   = useState<Set<string>>(() => new Set());
  const [doseExcluded, setDoseExcluded]   = useState<Set<string>>(() => new Set());
  const [depthExcluded, setDepthExcluded] = useState<Set<string>>(() => new Set());

  // Multi-column sort: first entry is primary, next are tiebreakers.
  // Empty = default ordering (genotype → dose → depth asc).
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);

  useEffect(() => {
    window.localStorage.setItem(BARS_KEY, showBars ? "1" : "0");
  }, [showBars]);

  // Universe of filter values derived from obs (stable order).
  const { genotypes, doses, depths } = useMemo(() => {
    const g = new Set<string>();
    const d = new Set<number>();
    const p = new Set<string>();
    for (const o of obs) {
      g.add(o.genotype);
      d.add(o.n_dose_kg_ha_yr);
      if (o.depth_label) p.add(o.depth_label);
    }
    return {
      genotypes: [...g].sort((a, b) => a.localeCompare(b)),
      doses:     [...d].sort((a, b) => a - b),
      depths:    [...p].sort((a, b) => a.localeCompare(b)),
    };
  }, [obs]);

  const { rows, scales } = useMemo<{ rows: Row[]; scales: Scales | null }>(() => {
    // Filter observations before grouping so scales reflect the visible set.
    const filtered = obs.filter(o => {
      if (genoExcluded.has(o.genotype)) return false;
      if (doseExcluded.has(String(o.n_dose_kg_ha_yr))) return false;
      if (includeDepth && o.depth_label && depthExcluded.has(o.depth_label)) return false;
      return true;
    });

    const keyFn = includeDepth
      ? (o: Observation) => `${o.genotype}|${o.n_dose_kg_ha_yr}|${o.depth_label ?? ""}`
      : (o: Observation) => `${o.genotype}|${o.n_dose_kg_ha_yr}`;
    const groups = groupBy(filtered, keyFn);
    const out: Row[] = [];
    for (const [k, arr] of groups) {
      const [gen, dose, depth] = k.split("|");
      const d = describe(arr.map(o => o.value));
      if (!d) continue;
      out.push({ genotype: gen, dose: Number(dose), depth: depth || undefined, d });
    }

    // Sort: user-defined multi-key if present, else default genotype→dose→depth.
    if (sortKeys.length > 0) {
      out.sort((a, b) => {
        for (const k of sortKeys) {
          const c = rowCompare(a, b, k.col);
          if (c !== 0) return k.dir === "asc" ? c : -c;
        }
        return 0;
      });
    } else {
      out.sort((a, b) =>
        a.genotype.localeCompare(b.genotype) ||
        a.dose - b.dose ||
        (a.depth ?? "").localeCompare(b.depth ?? ""),
      );
    }

    if (out.length === 0) return { rows: [], scales: null };
    const ns  = out.map(r => r.d.n);
    const ms  = out.map(r => r.d.mean);
    const sds = out.map(r => r.d.sd);
    const ses = out.map(r => r.d.se);
    const scales: Scales = {
      n:    { lo: Math.min(...ns),  hi: Math.max(...ns) },
      mean: { lo: Math.min(...ms),  hi: Math.max(...ms) },
      sd:   { lo: Math.min(...sds), hi: Math.max(...sds) },
      se:   { lo: Math.min(...ses), hi: Math.max(...ses) },
      ci:   {
        lo: Math.min(...out.map(r => r.d.ci95_lo)),
        hi: Math.max(...out.map(r => r.d.ci95_hi)),
      },
      range: {
        lo: Math.min(...out.map(r => r.d.min)),
        hi: Math.max(...out.map(r => r.d.max)),
      },
    };
    return { rows: out, scales };
  }, [obs, includeDepth, genoExcluded, doseExcluded, depthExcluded, sortKeys]);

  const noSourceData = obs.length === 0;

  const filtersActive =
    genoExcluded.size > 0 || doseExcluded.size > 0 || depthExcluded.size > 0;

  function toggleExcluded(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string,
  ) {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function resetFilters() {
    setGenoExcluded(new Set());
    setDoseExcluded(new Set());
    setDepthExcluded(new Set());
  }

  // Header-click handler implementing cycle primary→asc→desc→off, shift=add tiebreaker.
  function onHeaderClick(col: SortCol, ev: MouseEvent<HTMLButtonElement>) {
    const additive = ev.shiftKey;
    setSortKeys(prev => {
      const idx = prev.findIndex(k => k.col === col);
      if (additive) {
        if (idx === -1) return [...prev, { col, dir: "asc" }];
        const existing = prev[idx];
        if (existing.dir === "asc") {
          const copy = prev.slice();
          copy[idx] = { col, dir: "desc" };
          return copy;
        }
        // desc → remove from sort
        return prev.filter((_, i) => i !== idx);
      }
      // Non-additive click: replace the whole sort with this column,
      // cycling asc → desc → off if already primary.
      if (prev.length === 1 && prev[0].col === col) {
        if (prev[0].dir === "asc") return [{ col, dir: "desc" }];
        return [];
      }
      return [{ col, dir: "asc" }];
    });
  }

  function sortIndicator(col: SortCol): { glyph: string; order: number } | null {
    const idx = sortKeys.findIndex(k => k.col === col);
    if (idx === -1) return null;
    return { glyph: sortKeys[idx].dir === "asc" ? "↑" : "↓", order: idx + 1 };
  }

  function renderHeader(label: string, col: SortCol) {
    const ind = sortIndicator(col);
    const ariaSort =
      ind == null ? "none" : ind.glyph === "↑" ? "ascending" : "descending";
    return (
      <th aria-sort={ariaSort}>
        <button
          type="button"
          className="sort-header"
          data-active={ind != null}
          onClick={(e) => onHeaderClick(col, e)}
          title="Click to sort. Shift-click to add as tiebreaker."
        >
          <span>{label}</span>
          {ind && (
            <span className="sort-indicator" aria-hidden>
              {ind.glyph}
              {sortKeys.length > 1 && <sub>{ind.order}</sub>}
            </span>
          )}
        </button>
      </th>
    );
  }

  const bar = showBars && scales !== null;

  const C_MEAN  = "oklch(63% 0.072 240 / 0.18)";  // water blue
  const C_SD    = "oklch(73% 0.105 65 / 0.16)";   // amber
  const C_SE    = "oklch(73% 0.105 65 / 0.12)";   // amber, lighter
  const C_N     = "oklch(27% 0.022 50 / 0.10)";   // soil neutral
  const C_CI    = "var(--ek-water)";
  const C_RANGE = "var(--ek-soil-warm)";

  return (
    <div className="descriptive-block">
      {/* Filter chips — only render when we have any filterable universe. */}
      {!noSourceData && (
        <div className="descriptive-filters">
          {genotypes.length > 1 && (
            <div className="filter-group">
              <span className="filter-label">Genotype</span>
              <div className="filter-chips" role="group" aria-label="Filter by genotype">
                {genotypes.map(g => {
                  const active = !genoExcluded.has(g);
                  const genoCode = GENOTYPE_CODE_BY_LABEL[g as GenotypeLabel];
                  return (
                    <button
                      key={g}
                      type="button"
                      className="filter-chip"
                      data-active={active}
                      data-geno={genoCode}
                      aria-pressed={active}
                      onClick={() => toggleExcluded(setGenoExcluded, g)}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {doses.length > 1 && (
            <div className="filter-group">
              <span className="filter-label">N dose</span>
              <div className="filter-chips" role="group" aria-label="Filter by N dose">
                {doses.map(d => {
                  const key = String(d);
                  const active = !doseExcluded.has(key);
                  const doseLevel = DOSE_CODE_BY_KG[d];
                  return (
                    <button
                      key={key}
                      type="button"
                      className="filter-chip mono"
                      data-active={active}
                      data-dose-level={doseLevel}
                      aria-pressed={active}
                      onClick={() => toggleExcluded(setDoseExcluded, key)}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {includeDepth && depths.length > 1 && (
            <div className="filter-group">
              <span className="filter-label">Depth</span>
              <div className="filter-chips" role="group" aria-label="Filter by depth">
                {depths.map(p => {
                  const active = !depthExcluded.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className="filter-chip mono"
                      data-active={active}
                      aria-pressed={active}
                      onClick={() => toggleExcluded(setDepthExcluded, p)}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {filtersActive && (
            <button
              type="button"
              className="filter-reset"
              onClick={resetFilters}
              title="Clear all filters"
            >
              Reset
            </button>
          )}
        </div>
      )}

      <div className="descriptive-toolbar">
        {sortKeys.length > 0 && (
          <button
            type="button"
            className="filter-reset"
            onClick={() => setSortKeys([])}
            title="Clear sort and return to default order"
          >
            Clear sort
          </button>
        )}
        <span className="chart-toolbar-label">Data bars</span>
        <div className="chart-toolbar-seg" role="radiogroup" aria-label="Show data bars">
          <button
            type="button"
            role="radio"
            aria-checked={showBars}
            data-active={showBars}
            className="chart-toolbar-btn"
            onClick={() => setShowBars(true)}
          >
            On
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!showBars}
            data-active={!showBars}
            className="chart-toolbar-btn"
            onClick={() => setShowBars(false)}
          >
            Off
          </button>
        </div>
      </div>

      {noSourceData ? (
        <div className="muted">No data yet for this variable. Enter measurements in the Data entry tab.</div>
      ) : rows.length === 0 ? (
        <div className="muted">No rows match the current filters. Adjust the chips above or reset.</div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table className="data-table descriptive-table">
            <thead>
              <tr>
                {renderHeader("Genotype", "genotype")}
                {renderHeader("N dose", "dose")}
                {includeDepth && renderHeader("Depth", "depth")}
                {renderHeader("n", "n")}
                {renderHeader(`Mean${unit ? ` (${unit})` : ""}`, "mean")}
                {renderHeader("SD", "sd")}
                {renderHeader("SE", "se")}
                {renderHeader("95% CI", "ci")}
                {renderHeader("Range", "range")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const ciPos    = bar ? floatBarPos(r.d.ci95_lo, r.d.ci95_hi, scales!.ci)    : null;
                const rangePos = bar ? floatBarPos(r.d.min,     r.d.max,     scales!.range) : null;
                return (
                  <tr key={i}>
                    <td>{r.genotype}</td>
                    <td className="mono">{r.dose}</td>
                    {includeDepth && <td className="mono">{r.depth}</td>}
                    <td className="mono databar" style={bar ? dataBarStyle(r.d.n,    scales!.n,    C_N)    : undefined}>{r.d.n}</td>
                    <td className="mono databar" style={bar ? dataBarStyle(r.d.mean, scales!.mean, C_MEAN) : undefined}>{sig(r.d.mean)}</td>
                    <td className="mono databar" style={bar ? dataBarStyle(r.d.sd,   scales!.sd,   C_SD)   : undefined}>{sig(r.d.sd)}</td>
                    <td className="mono databar" style={bar ? dataBarStyle(r.d.se,   scales!.se,   C_SE)   : undefined}>{sig(r.d.se)}</td>
                    <td className="mono floatbar">
                      {ciPos && (
                        <span
                          className="floatbar-track"
                          aria-hidden
                          style={{ left: `${ciPos.left}%`, width: `${ciPos.width}%`, background: C_CI }}
                        />
                      )}
                      <span className="floatbar-text">{`${sig(r.d.ci95_lo)} – ${sig(r.d.ci95_hi)}`}</span>
                    </td>
                    <td className="mono floatbar">
                      {rangePos && (
                        <span
                          className="floatbar-track"
                          aria-hidden
                          style={{ left: `${rangePos.left}%`, width: `${rangePos.width}%`, background: C_RANGE }}
                        />
                      )}
                      <span className="floatbar-text">{`${sig(r.d.min)} – ${sig(r.d.max)}`}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
