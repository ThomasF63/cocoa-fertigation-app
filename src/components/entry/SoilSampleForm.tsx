import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save, X } from "lucide-react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import {
  PlotMatrix, ProgressBar, DetailPaneHeader,
  isoDate, num, str, type PlotBadge,
} from "./shared";
import type { Plot } from "../../types/design";
import type { SoilSample } from "../../types/samples";
import { loadPlan } from "../../utils/planStorage";
import { planCounts } from "../../types/plan";

const COMPOSITING_PATTERNS = ["W", "X", "zigzag", "grid", "random"];

function isEntered(s?: SoilSample): boolean {
  return !!s?.sampling_date;
}

function hasAnyValue(s?: SoilSample): boolean {
  if (!s) return false;
  return (
    s.sampling_date != null ||
    s.sampler != null ||
    s.n_subsamples != null ||
    s.compositing_pattern != null ||
    s.moisture_visual != null ||
    s.notes != null ||
    s.coarse_fragments_pct != null
  );
}

/** Small × button that clears one field. Tab-disabled when nothing to clear. */
function ClearBtn({ label, disabled, onClick }: {
  label: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="m-field-clear m-field-clear--inline"
      aria-label={`Clear ${label}`}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={onClick}
    >
      <X size={12} />
    </button>
  );
}

function DepthRow({
  s, onPatch,
}: {
  s: SoilSample;
  onPatch: (sample_id: string, partial: Partial<SoilSample>) => void;
}) {
  const dateId = useId();
  const subsamplesId = useId();
  const patternId = useId();
  const moistureId = useId();
  const notesId = useId();

  return (
    <div className="depth-row">
      <div className="depth-label">{s.depth_label} cm</div>
      <div className="field">
        <div className="m-field-head">
          <label htmlFor={dateId}>Date</label>
          <ClearBtn
            label="date"
            disabled={s.sampling_date == null}
            onClick={() => onPatch(s.sample_id, { sampling_date: undefined })}
          />
        </div>
        <input
          id={dateId}
          type="date"
          value={isoDate(s.sampling_date)}
          onChange={e => onPatch(s.sample_id, { sampling_date: e.target.value || undefined })}
        />
      </div>
      <div className="field">
        <div className="m-field-head">
          <label htmlFor={subsamplesId}>Subsamples</label>
          <ClearBtn
            label="subsamples"
            disabled={s.n_subsamples == null}
            onClick={() => onPatch(s.sample_id, { n_subsamples: undefined })}
          />
        </div>
        <input
          id={subsamplesId}
          className="big-input"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder={String(loadPlan().nSubsamplesPerPlot)}
          value={s.n_subsamples ?? ""}
          onChange={e => onPatch(s.sample_id, { n_subsamples: num(e) })}
        />
      </div>
      <div className="field">
        <div className="m-field-head">
          <label htmlFor={patternId}>Pattern</label>
          <ClearBtn
            label="pattern"
            disabled={s.compositing_pattern == null}
            onClick={() => onPatch(s.sample_id, { compositing_pattern: undefined })}
          />
        </div>
        <select
          id={patternId}
          value={s.compositing_pattern ?? ""}
          onChange={e => onPatch(s.sample_id, { compositing_pattern: e.target.value || undefined })}
        >
          <option value="">—</option>
          {COMPOSITING_PATTERNS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="m-field-head">
          <label htmlFor={moistureId}>Moisture</label>
          <ClearBtn
            label="moisture"
            disabled={s.moisture_visual == null}
            onClick={() => onPatch(s.sample_id, { moisture_visual: undefined })}
          />
        </div>
        <input
          id={moistureId}
          type="text"
          placeholder="dry / moist / wet"
          value={s.moisture_visual ?? ""}
          onChange={e => onPatch(s.sample_id, { moisture_visual: str(e) })}
        />
      </div>
      <div className="field">
        <div className="m-field-head">
          <label htmlFor={notesId}>Notes</label>
          <ClearBtn
            label="notes"
            disabled={s.notes == null}
            onClick={() => onPatch(s.sample_id, { notes: undefined })}
          />
        </div>
        <input
          id={notesId}
          type="text"
          value={s.notes ?? ""}
          onChange={e => onPatch(s.sample_id, { notes: str(e) })}
        />
      </div>
    </div>
  );
}

export function SoilSampleForm() {
  const plots = useStoreItems<Plot>("plots", "plot_id");
  const samples = useStoreItems<SoilSample>("soil_samples", "sample_id");
  const debouncedSave = useDebouncedSave(samples.saveItem, "sample_id", 350);

  const [sessionDate, setSessionDate] = useState<string>("");
  const [sessionSampler, setSessionSampler] = useState<string>("");
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const sessionDateId = useId();
  const sessionSamplerId = useId();

  const sortedPlots = useMemo(
    () => [...plots.items].sort((a, b) => a.plot_id.localeCompare(b.plot_id)),
    [plots.items],
  );
  const plotIdx = sortedPlots.findIndex(p => p.plot_id === selectedPlot);

  const plotSamples = useMemo(() => {
    if (!selectedPlot) return [] as SoilSample[];
    return samples.items
      .filter(s => s.plot_id === selectedPlot)
      .sort((a, b) => a.depth_top_cm - b.depth_top_cm);
  }, [samples.items, selectedPlot]);

  const totalEntered = useMemo(() => samples.items.filter(isEntered).length, [samples.items]);
  const expectedTotal = planCounts(loadPlan()).soil_samples;

  const enteredByPlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of samples.items) {
      if (!isEntered(s)) continue;
      m.set(s.plot_id, (m.get(s.plot_id) ?? 0) + 1);
    }
    return m;
  }, [samples.items]);

  const depthsPerPlot = loadPlan().depths.length;

  function plotBadge(plot_id: string): PlotBadge | null {
    const done = enteredByPlot.get(plot_id) ?? 0;
    if (done === 0) return null;
    return {
      text: `${done}/${depthsPerPlot}`,
      tone: done >= depthsPerPlot ? "done" : "progress",
    };
  }

  if (plots.loading || samples.loading) {
    return <div className="card"><div className="muted">Loading...</div></div>;
  }
  if (plots.items.length === 0) {
    return <div className="card"><div className="muted">No plots yet. Seed the factorial from the Overview tab.</div></div>;
  }

  function ensureSample(sample_id: string): SoilSample | null {
    const existing = samples.items.find(s => s.sample_id === sample_id);
    if (existing) return existing;
    const depthCode = sample_id.split("_").pop();
    const depth = loadPlan().depths.find(d => d.code === depthCode);
    if (!depth || !selectedPlot) return null;
    return {
      sample_id,
      plot_id: selectedPlot,
      depth_label: depth.label,
      depth_top_cm: depth.top,
      depth_bottom_cm: depth.bottom,
    };
  }

  function patch(sample_id: string, partial: Partial<SoilSample>) {
    const base = ensureSample(sample_id);
    if (!base) return;
    // Session-level date/sampler propagate forward but never overwrite.
    const next: SoilSample = {
      ...base,
      sampling_date: base.sampling_date ?? (sessionDate || undefined),
      sampler: base.sampler ?? (sessionSampler || undefined),
      ...partial,
    };
    samples.replaceLocal(next);
    debouncedSave(next);
    setSavedAt(Date.now());
  }

  function closeAndClear() {
    const entered = plotSamples.filter(hasAnyValue);
    if (entered.length > 0) {
      const ok = window.confirm(
        `Close and clear all soil entries for ${selectedPlot}? ${entered.length} depth record(s) will be deleted.`
      );
      if (!ok) return;
      for (const s of entered) samples.deleteItem(s.sample_id);
    }
    setSelectedPlot(null);
    setCollapsed(false);
  }

  const hasSelection = !!selectedPlot;
  const plotDone = selectedPlot ? enteredByPlot.get(selectedPlot) ?? 0 : 0;

  return (
    <div
      className="entry-layout"
      data-has-selection={hasSelection ? "true" : "false"}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <section className="entry-session">
        <div className="card session-card">
          <div className="session-fields">
            <div className="field">
              <label htmlFor={sessionDateId}>Sampling date</label>
              <input
                id={sessionDateId}
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={sessionSamplerId}>Sampler</label>
              <input
                id={sessionSamplerId}
                type="text"
                placeholder="initials"
                value={sessionSampler}
                onChange={e => setSessionSampler(e.target.value)}
              />
            </div>
            <div className="session-progress">
              <ProgressBar value={totalEntered} total={expectedTotal} label="Soil samples entered" />
            </div>
          </div>
        </div>

        <div className="card matrix-card">
          <PlotMatrix
            plots={plots.items}
            value={selectedPlot}
            onChange={(id) => { setSelectedPlot(id); setCollapsed(false); }}
            getBadge={plotBadge}
          />
        </div>
      </section>

      {hasSelection && (
        <section className="entry-detail">
          <DetailPaneHeader
            title={<span className="mono">{selectedPlot}</span>}
            meta={<>Plot <span className="mono">{plotIdx + 1}/{sortedPlots.length}</span></>}
            progress={
              <>
                <span className="detail-progress-label">Depths</span>
                <span className="detail-progress-value mono">{plotDone}</span>
                <span className="detail-progress-sep">/</span>
                <span className="detail-progress-total mono">{depthsPerPlot}</span>
              </>
            }
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(c => !c)}
            onClose={closeAndClear}
            savedAt={savedAt}
          />

          {!collapsed && (
            <div className="detail-body">
              <div className="soil-depths">
                {plotSamples.map(s => (
                  <DepthRow key={s.sample_id} s={s} onPatch={patch} />
                ))}
              </div>

              <div className="detail-footer">
                <button
                  className="btn"
                  onClick={() => {
                    const p = sortedPlots[Math.max(0, plotIdx - 1)];
                    if (p) setSelectedPlot(p.plot_id);
                  }}
                  disabled={plotIdx <= 0}
                >
                  <ChevronLeft size={18} /> Prev plot
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    const p = sortedPlots[Math.min(sortedPlots.length - 1, plotIdx + 1)];
                    if (p) setSelectedPlot(p.plot_id);
                  }}
                  disabled={plotIdx >= sortedPlots.length - 1}
                >
                  <Save size={16} /> Save &amp; next <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
