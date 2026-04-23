import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import {
  PlotMatrix, ProgressBar, MeasurementInput, DetailPaneHeader,
  str, type PlotBadge,
} from "./shared";
import type { Plot, Tree } from "../../types/design";
import type { TreeMeasurement } from "../../types/measurements";

function meanOf(a?: number, b?: number): number | undefined {
  const vals = [a, b].filter((v): v is number => typeof v === "number");
  if (!vals.length) return undefined;
  return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
}

function isEntered(m?: TreeMeasurement): boolean {
  if (!m) return false;
  return (
    m.measurement_date != null ||
    m.stem_diameter_5cm_mm != null ||
    m.stem_diameter_30cm_mm != null ||
    m.stem_diameter_50cm_mm != null ||
    m.stem_diameter_130cm_mm != null ||
    m.tree_height_m != null ||
    m.canopy_width_along_row_m != null ||
    m.canopy_width_across_row_m != null
  );
}

export function TreeMeasurementForm() {
  const plots = useStoreItems<Plot>("plots", "plot_id");
  const trees = useStoreItems<Tree>("trees", "tree_id");
  const meas = useStoreItems<TreeMeasurement>("tree_measurements", "tree_id");
  const debouncedSave = useDebouncedSave(meas.saveItem, "tree_id", 350);

  // Session-level context applied to every tree saved in this visit.
  const [sessionDate, setSessionDate] = useState<string>("");
  const [sessionObserver, setSessionObserver] = useState<string>("");

  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [treeIdx, setTreeIdx] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const sessionDateId = useId();
  const sessionObserverId = useId();
  const notesId = useId();

  const plotTrees = useMemo(() => {
    if (!selectedPlot) return [] as Tree[];
    return trees.items
      .filter(t => t.plot_id === selectedPlot)
      .sort((a, b) => a.tree_number_in_plot - b.tree_number_in_plot);
  }, [trees.items, selectedPlot]);

  const totalEntered = useMemo(() => meas.items.filter(isEntered).length, [meas.items]);
  const totalTrees = trees.items.length;

  const enteredByPlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const mr of meas.items) {
      if (!isEntered(mr)) continue;
      m.set(mr.plot_id, (m.get(mr.plot_id) ?? 0) + 1);
    }
    return m;
  }, [meas.items]);

  const treesByPlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trees.items) m.set(t.plot_id, (m.get(t.plot_id) ?? 0) + 1);
    return m;
  }, [trees.items]);

  function plotBadge(plot_id: string): PlotBadge | null {
    const total = treesByPlot.get(plot_id);
    if (!total) return null;
    const done = enteredByPlot.get(plot_id) ?? 0;
    if (done === 0) return null;
    return { text: `${done}/${total}`, tone: done >= total ? "done" : "progress" };
  }

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
    // Session date/observer propagate into a record once any field is
    // written, but never overwrite values already on the record.
    const next: TreeMeasurement = {
      ...currentMeas,
      measurement_date: currentMeas.measurement_date ?? (sessionDate || undefined),
      observer: currentMeas.observer ?? (sessionObserver || undefined),
      ...partial,
      tree_id: currentTree.tree_id,
      plot_id: currentTree.plot_id,
    };
    next.canopy_width_mean_m = meanOf(next.canopy_width_along_row_m, next.canopy_width_across_row_m);
    meas.replaceLocal(next);
    debouncedSave(next);
    setSavedAt(Date.now());
  }

  function closeAndClear() {
    // Close button: clear any measurements entered for the currently
    // selected tree and unselect the plot. Confirms to avoid accidents.
    if (!currentTree) { setSelectedPlot(null); setCollapsed(false); return; }
    if (isEntered(currentMeas)) {
      const ok = window.confirm(
        `Close and clear all measurements for ${currentTree.tree_id}? This cannot be undone.`
      );
      if (!ok) return;
      meas.deleteItem(currentTree.tree_id);
    }
    setSelectedPlot(null);
    setTreeIdx(0);
    setCollapsed(false);
  }

  const hasSelection = !!(selectedPlot && currentTree);
  const plotEntered = selectedPlot ? enteredByPlot.get(selectedPlot) ?? 0 : 0;
  const plotTotal = selectedPlot ? treesByPlot.get(selectedPlot) ?? 0 : 0;

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
              <label htmlFor={sessionDateId}>Measurement date</label>
              <input
                id={sessionDateId}
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={sessionObserverId}>Observer</label>
              <input
                id={sessionObserverId}
                type="text"
                placeholder="initials"
                value={sessionObserver}
                onChange={e => setSessionObserver(e.target.value)}
              />
            </div>
            <div className="session-progress">
              <ProgressBar value={totalEntered} total={totalTrees} label="Trees entered" />
            </div>
          </div>
        </div>

        <div className="card matrix-card">
          <PlotMatrix
            plots={plots.items}
            value={selectedPlot}
            onChange={(id) => { setSelectedPlot(id); setTreeIdx(0); setCollapsed(false); }}
            getBadge={plotBadge}
          />
        </div>
      </section>

      {hasSelection && (
        <section className="entry-detail">
          <DetailPaneHeader
            title={<span className="mono">{currentTree.tree_id}</span>}
            meta={<>Plot progress <span className="mono">{plotEntered}/{plotTotal}</span></>}
            progress={
              <>
                <span className="detail-progress-label">Tree</span>
                <span className="detail-progress-value mono">
                  {currentTree.tree_number_in_plot}
                </span>
                <span className="detail-progress-sep">/</span>
                <span className="detail-progress-total mono">{plotTrees.length}</span>
              </>
            }
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(c => !c)}
            onClose={closeAndClear}
            savedAt={savedAt}
          />

          {!collapsed && (
            <div className="detail-body">
              <fieldset className="m-group">
                <legend className="m-group-title">
                  Trunk diameter
                  <span className="m-group-sub">caliper at height above soil</span>
                </legend>
                <div className="m-grid m-grid-4">
                  <MeasurementInput
                    label="5 cm"
                    unit="mm"
                    value={currentMeas.stem_diameter_5cm_mm}
                    onChange={v => patch({ stem_diameter_5cm_mm: v })}
                    onClear={() => patch({ stem_diameter_5cm_mm: undefined })}
                  />
                  <MeasurementInput
                    label="30 cm"
                    unit="mm"
                    value={currentMeas.stem_diameter_30cm_mm}
                    onChange={v => patch({ stem_diameter_30cm_mm: v })}
                    onClear={() => patch({ stem_diameter_30cm_mm: undefined })}
                  />
                  <MeasurementInput
                    label="50 cm"
                    unit="mm"
                    value={currentMeas.stem_diameter_50cm_mm}
                    onChange={v => patch({ stem_diameter_50cm_mm: v })}
                    onClear={() => patch({ stem_diameter_50cm_mm: undefined })}
                  />
                  <MeasurementInput
                    label="130 cm"
                    badge="DBH"
                    unit="mm"
                    value={currentMeas.stem_diameter_130cm_mm}
                    onChange={v => patch({ stem_diameter_130cm_mm: v })}
                    onClear={() => patch({ stem_diameter_130cm_mm: undefined })}
                  />
                </div>
              </fieldset>

              <fieldset className="m-group">
                <legend className="m-group-title">
                  Height &amp; canopy
                  <span className="m-group-sub">tape, two perpendicular spans</span>
                </legend>
                <div className="m-grid m-grid-3">
                  <MeasurementInput
                    label="Height"
                    unit="m"
                    step="0.01"
                    value={currentMeas.tree_height_m}
                    onChange={v => patch({ tree_height_m: v })}
                    onClear={() => patch({ tree_height_m: undefined })}
                  />
                  <MeasurementInput
                    label="Along row"
                    unit="m"
                    step="0.01"
                    value={currentMeas.canopy_width_along_row_m}
                    onChange={v => patch({ canopy_width_along_row_m: v })}
                    onClear={() => patch({ canopy_width_along_row_m: undefined })}
                  />
                  <MeasurementInput
                    label="Across row"
                    unit="m"
                    step="0.01"
                    value={currentMeas.canopy_width_across_row_m}
                    onChange={v => patch({ canopy_width_across_row_m: v })}
                    onClear={() => patch({ canopy_width_across_row_m: undefined })}
                  />
                </div>
                <div className="m-group-foot">
                  Canopy mean: <strong style={{ color: "var(--text-primary)" }}>
                    {currentMeas.canopy_width_mean_m ?? "—"}
                  </strong> m
                </div>
              </fieldset>

              <div className="field notes-field">
                <label htmlFor={notesId}>Notes</label>
                <input
                  id={notesId}
                  type="text"
                  placeholder="optional"
                  value={currentMeas.notes ?? ""}
                  onChange={e => patch({ notes: str(e) })}
                />
              </div>

              <div className="detail-footer">
                <button
                  className="btn"
                  onClick={() => setTreeIdx(i => Math.max(0, i - 1))}
                  disabled={treeIdx <= 0}
                >
                  <ChevronLeft size={18} /> Prev tree
                </button>
                <button
                  className="btn primary"
                  onClick={() => setTreeIdx(i => Math.min(plotTrees.length - 1, i + 1))}
                  disabled={treeIdx >= plotTrees.length - 1}
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
