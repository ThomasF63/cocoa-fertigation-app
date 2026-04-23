import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { Check, Minimize2, X } from "lucide-react";
import { DOSE_CODE_BY_KG, GENOTYPE_CODE_BY_LABEL } from "../../utils/palette";
import type { GenotypeLabel } from "../../types/design";

interface PlotOption {
  plot_id: string;
  genotype_label: string;
  n_dose_kg_ha_yr: number;
  block: number;
}

function toggleSet<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="entry-progress">
      <div className="entry-progress-label">
        <span>{label}</span>
        <span>{value} / {total}</span>
      </div>
      <div className="entry-progress-bar">
        <div className="entry-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Numeric field with a persistent header label, a static unit suffix, and a
 *  one-tap clear button to erase the value. Designed so the user can always
 *  see *what* each number means and the unit it carries, even after entry. */
export function MeasurementInput({
  label, badge, unit, value, onChange, onClear,
  step = 0.1, inputMode = "decimal", size = "big", placeholder,
}: {
  label: string;
  badge?: string;
  unit: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  onClear: () => void;
  step?: number | string;
  inputMode?: "decimal" | "numeric";
  size?: "big" | "regular";
  placeholder?: string;
}) {
  const inputId = useId();
  const hasValue = value != null;
  return (
    <div className="m-field" data-size={size}>
      <div className="m-field-head">
        <label htmlFor={inputId} className="m-field-label">
          {label}
          {badge && <span className="m-field-badge">{badge}</span>}
        </label>
        <button
          type="button"
          className="m-field-clear"
          aria-label={`Clear ${label}`}
          disabled={!hasValue}
          onClick={onClear}
          tabIndex={hasValue ? 0 : -1}
        >
          <X size={14} />
        </button>
      </div>
      <div className="m-field-input" data-filled={hasValue}>
        <input
          id={inputId}
          className={size === "big" ? "big-input" : ""}
          type="number"
          inputMode={inputMode}
          step={step}
          placeholder={placeholder ?? ""}
          value={value ?? ""}
          onChange={e => {
            const v = e.target.value;
            if (v === "") return onChange(undefined);
            const n = Number(v);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
        />
        <span className="m-field-unit" aria-hidden="true">{unit}</span>
      </div>
    </div>
  );
}

/** Format ISO date for <input type="date"> */
export function isoDate(s?: string): string {
  if (!s) return "";
  return s.slice(0, 10);
}

/** Read a numeric input safely */
export function num(e: React.ChangeEvent<HTMLInputElement>): number | undefined {
  const v = e.target.value;
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Read a text input safely */
export function str(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string | undefined {
  const v = e.target.value;
  return v === "" ? undefined : v;
}

/** Per-plot annotation shown as a small corner badge in the matrix (e.g. "3/12"). */
export interface PlotBadge {
  text: string;          // short display, e.g. "3/12"
  tone?: "muted" | "progress" | "done";
}

/**
 * Matrix layout of the 48-plot factorial.
 *
 * Rows are blocks (one per replicate). Columns are genotype × N-dose combos.
 * Genotype tint + dose border weight still encode treatment so the grammar
 * matches the chips and plot-map. Filters dim non-matching columns rather
 * than removing them, so the matrix shape stays stable.
 */
export function PlotMatrix({
  plots, value, onChange, getBadge,
}: {
  plots: PlotOption[];
  value: string | null;
  onChange: (plot_id: string) => void;
  getBadge?: (plot_id: string) => PlotBadge | null;
}) {
  const [genoExcluded, setGenoExcluded] = useState<Set<string>>(() => new Set());
  const [doseExcluded, setDoseExcluded] = useState<Set<string>>(() => new Set());

  const { blocks, genotypes, doses, colSpec, plotAt } = useMemo(() => {
    const blockSet = new Set<number>();
    plots.forEach(p => blockSet.add(p.block));
    const bs = [...blockSet].sort((a, b) => a - b);
    const gs = [...new Set(plots.map(p => p.genotype_label))].sort((a, b) => a.localeCompare(b));
    const ds = [...new Set(plots.map(p => p.n_dose_kg_ha_yr))].sort((a, b) => a - b);
    const cols: { geno: string; dose: number }[] = [];
    for (const g of gs) for (const d of ds) cols.push({ geno: g, dose: d });
    const index = new Map<string, PlotOption>();
    for (const p of plots) index.set(`${p.block}|${p.genotype_label}|${p.n_dose_kg_ha_yr}`, p);
    return {
      blocks: bs, genotypes: gs, doses: ds, colSpec: cols,
      plotAt: (b: number, g: string, d: number) => index.get(`${b}|${g}|${d}`),
    };
  }, [plots]);

  return (
    <div className="plot-matrix">
      {(genotypes.length > 1 || doses.length > 1) && (
        <div className="matrix-filter-row">
          {genotypes.length > 1 && (
            <div className="filter-group">
              <span className="filter-label">Genotype</span>
              <div className="filter-chips" role="group" aria-label="Filter by genotype">
                {genotypes.map(g => {
                  const active = !genoExcluded.has(g);
                  const code = GENOTYPE_CODE_BY_LABEL[g as GenotypeLabel];
                  return (
                    <button
                      key={g}
                      type="button"
                      className="filter-chip"
                      data-active={active}
                      data-geno={code}
                      aria-pressed={active}
                      onClick={() => setGenoExcluded(s => toggleSet(s, g))}
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
                  const level = DOSE_CODE_BY_KG[d];
                  return (
                    <button
                      key={key}
                      type="button"
                      className="filter-chip mono"
                      data-active={active}
                      data-dose-level={level}
                      aria-pressed={active}
                      onClick={() => setDoseExcluded(s => toggleSet(s, key))}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className="matrix-grid"
        style={{ gridTemplateColumns: `minmax(36px, auto) repeat(${colSpec.length}, minmax(0, 1fr))` }}
      >
        {/* Super-header row — genotype groups spanning their dose columns */}
        <div className="matrix-corner" aria-hidden="true" />
        {genotypes.map(g => {
          const code = GENOTYPE_CODE_BY_LABEL[g as GenotypeLabel];
          return (
            <div
              key={g}
              className="matrix-geno-head"
              data-geno={code}
              data-faded={genoExcluded.has(g) || undefined}
              style={{ gridColumn: `span ${doses.length}` }}
            >
              {g}
            </div>
          );
        })}

        {/* Sub-header row — N-dose per column */}
        <div className="matrix-corner" aria-hidden="true" />
        {colSpec.map(({ geno, dose }, i) => {
          const level = DOSE_CODE_BY_KG[dose];
          const faded = genoExcluded.has(geno) || doseExcluded.has(String(dose));
          return (
            <div
              key={`h-${i}`}
              className="matrix-dose-head mono"
              data-dose-level={level}
              data-faded={faded || undefined}
            >
              {level} · {dose}
            </div>
          );
        })}

        {/* Data rows — one per block */}
        {blocks.map(b => (
          <Fragment key={b}>
            <div className="matrix-row-head mono">B{b}</div>
            {colSpec.map(({ geno, dose }, i) => {
              const p = plotAt(b, geno, dose);
              if (!p) return <div key={`${b}-${i}`} className="matrix-empty" />;
              const selected = value === p.plot_id;
              const faded = genoExcluded.has(geno) || doseExcluded.has(String(dose));
              const code = GENOTYPE_CODE_BY_LABEL[p.genotype_label as GenotypeLabel];
              const level = DOSE_CODE_BY_KG[p.n_dose_kg_ha_yr];
              const badge = getBadge?.(p.plot_id) ?? null;
              return (
                <button
                  key={p.plot_id}
                  type="button"
                  className="plot-card matrix-cell"
                  data-active={selected}
                  data-geno={code}
                  data-dose-level={level}
                  data-faded={faded || undefined}
                  aria-pressed={selected}
                  aria-label={`${p.plot_id} — block ${b}, ${p.genotype_label}, ${p.n_dose_kg_ha_yr} kg N`}
                  onClick={() => onChange(p.plot_id)}
                >
                  {badge && (
                    <span className="matrix-cell-badge mono" data-tone={badge.tone ?? "muted"}>
                      {badge.text}
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Header bar for the entry detail pane. Shows title + meta, plus two controls
 * in the top-right: minimize (collapse pane, keep data) and close (collapse
 * pane + clear selection/session input).
 */
export function DetailPaneHeader({
  title, progress, meta, collapsed, onToggleCollapse, onClose, savedAt,
}: {
  title: React.ReactNode;
  /** Large, prominent progress readout (e.g. "Tree 3 / 12"). Rendered as a
   *  pill to draw the eye since it tells the operator where they are. */
  progress?: React.ReactNode;
  meta?: React.ReactNode;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
  savedAt: number | null;
}) {
  const [flashOn, setFlashOn] = useState(false);
  useEffect(() => {
    if (savedAt === null) return;
    setFlashOn(true);
    const t = setTimeout(() => setFlashOn(false), 1500);
    return () => clearTimeout(t);
  }, [savedAt]);

  return (
    <div className="detail-head">
      <div className="detail-head-main">
        <div className="detail-head-title">{title}</div>
        {meta && <div className="detail-head-meta">{meta}</div>}
      </div>
      {progress && <div className="detail-head-progress">{progress}</div>}
      <span className="saved-flash" data-visible={flashOn}><Check size={14} /> Saved</span>
      <button
        type="button"
        className="detail-head-btn"
        aria-label={collapsed ? "Expand entry pane" : "Collapse entry pane"}
        title={collapsed ? "Expand" : "Collapse (keeps data)"}
        onClick={onToggleCollapse}
      >
        <Minimize2 size={16} />
      </button>
      <button
        type="button"
        className="detail-head-btn danger"
        aria-label="Close and clear"
        title="Close and clear selection"
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  );
}
