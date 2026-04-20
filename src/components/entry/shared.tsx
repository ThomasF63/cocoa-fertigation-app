import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

export function PlotPicker({
  plots, value, onChange, label = "Plot",
}: {
  plots: { plot_id: string; genotype_label: string; n_dose_kg_ha_yr: number; block: number }[];
  value: string | null;
  onChange: (plot_id: string) => void;
  label?: string;
}) {
  const sorted = [...plots].sort((a, b) => a.plot_id.localeCompare(b.plot_id));
  return (
    <div className="plot-picker">
      <span className="muted mono" style={{ fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>Select a plot...</option>
        {sorted.map(p => (
          <option key={p.plot_id} value={p.plot_id}>
            {p.plot_id} &middot; B{p.block} &middot; {p.genotype_label} &middot; {p.n_dose_kg_ha_yr} kg N
          </option>
        ))}
      </select>
    </div>
  );
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

export function Stepper({
  index, total, onPrev, onNext, savedAt,
}: {
  index: number; total: number;
  onPrev: () => void; onNext: () => void;
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
    <>
      <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
        <span className="saved-flash" data-visible={flashOn}><Check size={14} /> Saved</span>
      </div>
      <div className="stepper">
        <button className="btn" onClick={onPrev} disabled={index <= 0}>
          <ChevronLeft size={20} /> Prev
        </button>
        <div className="mono muted" style={{ alignSelf: "center", minWidth: 80, textAlign: "center" }}>
          {index + 1} / {total}
        </div>
        <button className="btn primary" onClick={onNext} disabled={index >= total - 1}>
          Next <ChevronRight size={20} />
        </button>
      </div>
    </>
  );
}

export function ScoreButtons({
  value, onChange, max = 5,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  max?: number;
}) {
  return (
    <div className="score-buttons">
      {Array.from({ length: max + 1 }, (_, i) => (
        <button
          key={i}
          data-active={value === i}
          onClick={() => onChange(value === i ? undefined : i)}
          type="button"
        >{i}</button>
      ))}
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
