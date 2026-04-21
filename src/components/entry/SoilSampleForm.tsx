import { useId, useMemo, useState } from "react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import { PlotPicker, ProgressBar, Stepper, isoDate, num, str } from "./shared";
import type { Plot } from "../../types/design";
import type { SoilSample } from "../../types/samples";
import { loadPlan } from "../../utils/planStorage";

const COMPOSITING_PATTERNS = ["W", "X", "zigzag", "grid", "random"];

function isEntered(s?: SoilSample): boolean {
  return !!s?.sampling_date;
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
        <label htmlFor={dateId}>Date</label>
        <input
          id={dateId}
          type="date"
          value={isoDate(s.sampling_date)}
          onChange={e => onPatch(s.sample_id, { sampling_date: e.target.value || undefined })}
        />
      </div>
      <div className="field">
        <label htmlFor={subsamplesId}>Subsamples</label>
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
        <label htmlFor={patternId}>Pattern</label>
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
        <label htmlFor={moistureId}>Moisture</label>
        <input
          id={moistureId}
          type="text"
          placeholder="dry / moist / wet"
          value={s.moisture_visual ?? ""}
          onChange={e => onPatch(s.sample_id, { moisture_visual: str(e) })}
        />
      </div>
      <div className="field">
        <label htmlFor={notesId}>Notes</label>
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

  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const allDateId = useId();
  const allSamplerId = useId();

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

  if (plots.loading || samples.loading) {
    return <div className="card"><div className="muted">Loading...</div></div>;
  }
  if (plots.items.length === 0) {
    return <div className="card"><div className="muted">No plots yet. Seed the factorial from the Overview tab.</div></div>;
  }

  function patch(sample_id: string, partial: Partial<SoilSample>) {
    const existing = samples.items.find(s => s.sample_id === sample_id);
    if (!existing) {
      const depthCode = sample_id.split("_").pop();
      const depth = loadPlan().depths.find(d => d.code === depthCode);
      if (!depth || !selectedPlot) return;
      const next: SoilSample = {
        sample_id,
        plot_id: selectedPlot,
        depth_label: depth.label,
        depth_top_cm: depth.top,
        depth_bottom_cm: depth.bottom,
        ...partial,
      };
      samples.replaceLocal(next);
      debouncedSave(next);
    } else {
      const next = { ...existing, ...partial };
      samples.replaceLocal(next);
      debouncedSave(next);
    }
    setSavedAt(Date.now());
  }

  function applyToAllDepths(field: keyof SoilSample, value: string | undefined) {
    for (const s of plotSamples) patch(s.sample_id, { [field]: value } as Partial<SoilSample>);
  }

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <h2 className="card-title">Select plot</h2>
        <PlotPicker
          plots={plots.items}
          value={selectedPlot}
          onChange={(id) => setSelectedPlot(id)}
        />
      </div>

      {selectedPlot && (
        <div className="card">
          <div className="entry-toolbar">
            <ProgressBar value={totalEntered} total={192} label="Overall soil samples" />
          </div>

          <div className="field-grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor={allDateId}>Sampling date (applies to all 4 depths)</label>
              <input
                id={allDateId}
                type="date"
                onChange={e => applyToAllDepths("sampling_date", e.target.value || undefined)}
              />
            </div>
            <div className="field">
              <label htmlFor={allSamplerId}>Sampler (applies to all 4 depths)</label>
              <input
                id={allSamplerId}
                type="text"
                onChange={e => applyToAllDepths("sampler", e.target.value || undefined)}
              />
            </div>
          </div>

          <h2 className="card-title" style={{ marginTop: 4 }}>Per-depth details</h2>
          {plotSamples.map(s => (
            <DepthRow key={s.sample_id} s={s} onPatch={patch} />
          ))}

          <Stepper
            index={plotIdx}
            total={sortedPlots.length}
            onPrev={() => {
              const p = sortedPlots[Math.max(0, plotIdx - 1)];
              if (p) setSelectedPlot(p.plot_id);
            }}
            onNext={() => {
              const p = sortedPlots[Math.min(sortedPlots.length - 1, plotIdx + 1)];
              if (p) setSelectedPlot(p.plot_id);
            }}
            savedAt={savedAt}
          />
        </div>
      )}
    </div>
  );
}
