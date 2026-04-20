import { useMemo, useState } from "react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import { PlotPicker, ProgressBar, Stepper, isoDate, str } from "./shared";
import type { Plot } from "../../types/design";
import type { SoilSample } from "../../types/samples";
import { DEPTHS } from "../../types/design";

function isEntered(s?: SoilSample): boolean {
  return !!s?.sampling_date;
}

export function SoilSampleForm() {
  const plots = useStoreItems<Plot>("plots", "plot_id");
  const samples = useStoreItems<SoilSample>("soil_samples", "sample_id");
  const debouncedSave = useDebouncedSave(samples.saveItem, "sample_id", 350);

  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
      // derive defaults from depth code
      const depthCode = sample_id.split("_").pop();
      const depth = DEPTHS.find(d => d.code === depthCode);
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
        <div className="card-title">Select plot</div>
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
              <label>Sampling date (applies to all 4 depths)</label>
              <input
                type="date"
                onChange={e => applyToAllDepths("sampling_date", e.target.value || undefined)}
              />
            </div>
            <div className="field">
              <label>Sampler (applies to all 4 depths)</label>
              <input
                type="text"
                onChange={e => applyToAllDepths("sampler", e.target.value || undefined)}
              />
            </div>
          </div>

          <div className="card-title" style={{ marginTop: 4 }}>Per-depth details</div>
          {plotSamples.map(s => (
            <div key={s.sample_id} className="depth-row">
              <div className="depth-label">{s.depth_label} cm</div>
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={isoDate(s.sampling_date)}
                  onChange={e => patch(s.sample_id, { sampling_date: e.target.value || undefined })}
                />
              </div>
              <div className="field">
                <label>Moisture</label>
                <input
                  type="text"
                  placeholder="dry / moist / wet"
                  value={s.moisture_visual ?? ""}
                  onChange={e => patch(s.sample_id, { moisture_visual: str(e) })}
                />
              </div>
              <div className="field">
                <label>Notes</label>
                <input
                  type="text"
                  value={s.notes ?? ""}
                  onChange={e => patch(s.sample_id, { notes: str(e) })}
                />
              </div>
            </div>
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
