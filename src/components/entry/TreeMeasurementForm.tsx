import { useId, useMemo, useState } from "react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import { PlotPicker, ProgressBar, Stepper, ScoreButtons, isoDate, num, str } from "./shared";
import type { Plot, Tree } from "../../types/design";
import type { TreeMeasurement } from "../../types/measurements";

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function meanOf(a?: number, b?: number, c?: number): number | undefined {
  const vals = [a, b, c].filter((v): v is number => typeof v === "number");
  if (!vals.length) return undefined;
  return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
}

function isEntered(m?: TreeMeasurement): boolean {
  if (!m) return false;
  return (
    m.measurement_date != null ||
    m.spad_leaf_1 != null || m.spad_leaf_2 != null || m.spad_leaf_3 != null ||
    m.stem_diameter_30cm_mm != null
  );
}

export function TreeMeasurementForm() {
  const plots = useStoreItems<Plot>("plots", "plot_id");
  const trees = useStoreItems<Tree>("trees", "tree_id");
  const meas = useStoreItems<TreeMeasurement>("tree_measurements", "tree_id");
  const debouncedSave = useDebouncedSave(meas.saveItem, "tree_id", 350);

  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [treeIdx, setTreeIdx] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dateId = useId();
  const spadBaseId = useId();
  const stemId = useId();
  const observerId = useId();
  const notesId = useId();

  const plotTrees = useMemo(() => {
    if (!selectedPlot) return [] as Tree[];
    return trees.items
      .filter(t => t.plot_id === selectedPlot)
      .sort((a, b) => a.tree_number_in_plot - b.tree_number_in_plot);
  }, [trees.items, selectedPlot]);

  const totalEntered = useMemo(() => meas.items.filter(isEntered).length, [meas.items]);
  const plotEntered = useMemo(() => {
    if (!selectedPlot) return 0;
    return meas.items.filter(m => m.plot_id === selectedPlot && isEntered(m)).length;
  }, [meas.items, selectedPlot]);

  if (plots.loading || trees.loading || meas.loading) {
    return <div className="card"><div className="muted">Loading...</div></div>;
  }
  if (plots.items.length === 0) {
    return (
      <div className="card">
        <div className="muted">No plots yet. Seed the factorial from the Overview tab.</div>
      </div>
    );
  }

  const currentTree = plotTrees[treeIdx];
  const currentMeas: TreeMeasurement = currentTree
    ? meas.items.find(m => m.tree_id === currentTree.tree_id) ?? {
        tree_id: currentTree.tree_id,
        plot_id: currentTree.plot_id,
      }
    : { tree_id: "", plot_id: "" };

  function patch(partial: Partial<TreeMeasurement>) {
    if (!currentTree) return;
    const next: TreeMeasurement = {
      ...currentMeas,
      ...partial,
      tree_id: currentTree.tree_id,
      plot_id: currentTree.plot_id,
    };
    next.spad_mean = meanOf(next.spad_leaf_1, next.spad_leaf_2, next.spad_leaf_3);
    meas.replaceLocal(next);
    debouncedSave(next);
    setSavedAt(Date.now());
  }

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <h2 className="card-title">Select plot</h2>
        <PlotPicker
          plots={plots.items}
          value={selectedPlot}
          onChange={(id) => { setSelectedPlot(id); setTreeIdx(0); }}
        />
      </div>

      {selectedPlot && currentTree && (
        <>
          <div className="card">
            <div className="entry-toolbar">
              <ProgressBar value={plotEntered} total={12} label="Plot progress" />
              <ProgressBar value={totalEntered} total={576} label="Overall" />
            </div>

            <div className="row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
              <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                {currentTree.tree_id}
              </div>
              <div className="muted mono" style={{ fontSize: "0.8rem" }}>
                Tree {currentTree.tree_number_in_plot} of 12
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor={dateId}>Measurement date</label>
              <input
                id={dateId}
                type="date"
                value={isoDate(currentMeas.measurement_date)}
                onChange={e => patch({ measurement_date: e.target.value || undefined })}
              />
            </div>

            <fieldset className="column" style={{ gap: 6, marginBottom: 14, border: "none", padding: 0, margin: 0 }}>
              <legend className="mono" style={{ fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", padding: 0 }}>
                SPAD readings (3 mid-canopy leaves)
              </legend>
              <div className="big-input-grid">
                <label htmlFor={`${spadBaseId}-spad-1`} style={srOnly}>SPAD leaf 1</label>
                <input
                  id={`${spadBaseId}-spad-1`}
                  className="big-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="L1"
                  value={currentMeas.spad_leaf_1 ?? ""}
                  onChange={e => patch({ spad_leaf_1: num(e) })}
                />
                <label htmlFor={`${spadBaseId}-spad-2`} style={srOnly}>SPAD leaf 2</label>
                <input
                  id={`${spadBaseId}-spad-2`}
                  className="big-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="L2"
                  value={currentMeas.spad_leaf_2 ?? ""}
                  onChange={e => patch({ spad_leaf_2: num(e) })}
                />
                <label htmlFor={`${spadBaseId}-spad-3`} style={srOnly}>SPAD leaf 3</label>
                <input
                  id={`${spadBaseId}-spad-3`}
                  className="big-input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="L3"
                  value={currentMeas.spad_leaf_3 ?? ""}
                  onChange={e => patch({ spad_leaf_3: num(e) })}
                />
              </div>
              <div className="mono muted" style={{ textAlign: "right", fontSize: "0.82rem" }}>
                Mean: <strong style={{ color: "var(--text-primary)" }}>{currentMeas.spad_mean ?? "-"}</strong>
              </div>
            </fieldset>

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor={stemId}>Stem diameter at 30 cm (mm)</label>
              <input
                id={stemId}
                className="big-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="mm"
                value={currentMeas.stem_diameter_30cm_mm ?? ""}
                onChange={e => patch({ stem_diameter_30cm_mm: num(e) })}
              />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span className="field-label">Pod load (0 to 5)</span>
              <ScoreButtons
                label="Pod load (0 to 5)"
                value={currentMeas.pod_load_score}
                onChange={v => patch({ pod_load_score: v })}
              />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span className="field-label">Vigour (0 to 5)</span>
              <ScoreButtons
                label="Vigour (0 to 5)"
                value={currentMeas.vigour_score}
                onChange={v => patch({ vigour_score: v })}
              />
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor={observerId}>Observer</label>
                <input
                  id={observerId}
                  type="text"
                  value={currentMeas.observer ?? ""}
                  onChange={e => patch({ observer: str(e) })}
                />
              </div>
              <div className="field">
                <label htmlFor={notesId}>Notes</label>
                <input
                  id={notesId}
                  type="text"
                  value={currentMeas.notes ?? ""}
                  onChange={e => patch({ notes: str(e) })}
                />
              </div>
            </div>

            <Stepper
              index={treeIdx}
              total={plotTrees.length}
              onPrev={() => setTreeIdx(i => Math.max(0, i - 1))}
              onNext={() => setTreeIdx(i => Math.min(plotTrees.length - 1, i + 1))}
              savedAt={savedAt}
            />
          </div>
        </>
      )}
    </div>
  );
}
