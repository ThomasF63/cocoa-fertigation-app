import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import {
  PlotMatrix, ProgressBar, MeasurementInput, DetailPaneHeader,
  str, type PlotBadge,
} from "./shared";
import type { Plot, DepthLayer } from "../../types/design";
import type { BDRing } from "../../types/samples";
import { loadPlan } from "../../utils/planStorage";

function computeBD(fresh?: number, dry?: number, vol?: number): number | undefined {
  if (dry == null || vol == null || vol === 0) return undefined;
  return Number((dry / vol).toFixed(3));
}

function isEntered(r?: BDRing): boolean {
  return !!(r && (r.ring_volume_cm3 != null || r.fresh_weight_g != null || r.oven_dry_weight_g != null));
}

function hasAnyUserEntry(r?: BDRing): boolean {
  if (!r) return false;
  return (
    r.plot_id != null ||
    r.ring_volume_cm3 != null ||
    r.fresh_weight_g != null ||
    r.oven_dry_weight_g != null ||
    r.sampling_date != null ||
    r.sampler != null ||
    r.notes != null
  );
}

export function BulkDensityForm() {
  const plots = useStoreItems<Plot>("plots", "plot_id");
  const rings = useStoreItems<BDRing>("bd_rings", "ring_id");
  const debouncedSave = useDebouncedSave(rings.saveItem, "ring_id", 350);

  const [sessionDate, setSessionDate] = useState<string>("");
  const [sessionSampler, setSessionSampler] = useState<string>("");
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const sessionDateId = useId();
  const sessionSamplerId = useId();

  // Plan depths drive the BD per-plot slot rows. Read once per render —
  // cheap, and keeps the form in sync if the plan changes elsewhere.
  const bdDepths: DepthLayer[] = loadPlan().bdRingDepths;

  const sortedPlots = useMemo(
    () => [...plots.items].sort((a, b) => a.plot_id.localeCompare(b.plot_id)),
    [plots.items],
  );
  const plotIdx = sortedPlots.findIndex(p => p.plot_id === selectedPlot);

  // Ring currently assigned to (selectedPlot, depth.label), if any.
  function ringAt(depth: DepthLayer): BDRing | undefined {
    if (!selectedPlot) return undefined;
    return rings.items.find(r => r.plot_id === selectedPlot && r.depth_label === depth.label);
  }

  // Rings eligible to drop into (selectedPlot, depth.label): matching depth,
  // either currently unassigned or already assigned to this plot.
  function ringsAvailableFor(depth: DepthLayer): BDRing[] {
    if (!selectedPlot) return [];
    return rings.items
      .filter(r =>
        r.depth_label === depth.label &&
        (r.plot_id == null || r.plot_id === selectedPlot)
      )
      .sort((a, b) => a.ring_id.localeCompare(b.ring_id));
  }

  const totalEntered = useMemo(() => rings.items.filter(isEntered).length, [rings.items]);

  const enteredByPlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rings.items) {
      if (!isEntered(r) || !r.plot_id) continue;
      m.set(r.plot_id, (m.get(r.plot_id) ?? 0) + 1);
    }
    return m;
  }, [rings.items]);

  function plotBadge(plot_id: string): PlotBadge | null {
    const done = enteredByPlot.get(plot_id) ?? 0;
    if (done === 0) return null;
    return {
      text: `${done}/${bdDepths.length}`,
      tone: done >= bdDepths.length ? "done" : "progress",
    };
  }

  if (plots.loading || rings.loading) return <div className="card"><div className="muted">Loading...</div></div>;
  if (rings.items.length === 0) {
    return <div className="card"><div className="muted">No BD ring stubs yet. Seed the factorial from the Overview tab.</div></div>;
  }

  function assignRing(depth: DepthLayer, newRingId: string | "") {
    if (!selectedPlot) return;
    // Un-assign any ring currently occupying this slot so it returns to
    // the unassigned pool and can be picked elsewhere.
    const current = ringAt(depth);
    if (current && current.ring_id !== newRingId) {
      rings.saveItem({ ...current, plot_id: undefined });
    }
    if (newRingId) {
      const r = rings.items.find(x => x.ring_id === newRingId);
      if (r) {
        const next: BDRing = {
          ...r,
          plot_id: selectedPlot,
          sampling_date: r.sampling_date ?? (sessionDate || undefined),
          sampler: r.sampler ?? (sessionSampler || undefined),
        };
        rings.saveItem(next);
      }
    }
    setSavedAt(Date.now());
  }

  function patchRing(depth: DepthLayer, partial: Partial<BDRing>) {
    const current = ringAt(depth);
    if (!current) return;
    const next: BDRing = {
      ...current,
      sampling_date: current.sampling_date ?? (sessionDate || undefined),
      sampler: current.sampler ?? (sessionSampler || undefined),
      ...partial,
    };
    next.bulk_density_g_cm3 = computeBD(next.fresh_weight_g, next.oven_dry_weight_g, next.ring_volume_cm3);
    rings.replaceLocal(next);
    debouncedSave(next);
    setSavedAt(Date.now());
  }

  function closeAndClear() {
    if (!selectedPlot) { setCollapsed(false); return; }
    const plotRings = rings.items.filter(r => r.plot_id === selectedPlot);
    const anyData = plotRings.some(hasAnyUserEntry);
    if (anyData) {
      const ok = window.confirm(
        `Close and clear all BD ring entries for ${selectedPlot}? The ring stubs return to the unassigned pool.`
      );
      if (!ok) return;
      for (const r of plotRings) {
        const cleared: BDRing = {
          ring_id: r.ring_id,
          depth_label: r.depth_label,
          depth_top_cm: r.depth_top_cm,
          depth_bottom_cm: r.depth_bottom_cm,
        };
        rings.saveItem(cleared);
      }
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
              <ProgressBar value={totalEntered} total={rings.items.length} label="Rings entered" />
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
                <span className="detail-progress-label">Rings</span>
                <span className="detail-progress-value mono">{plotDone}</span>
                <span className="detail-progress-sep">/</span>
                <span className="detail-progress-total mono">{bdDepths.length}</span>
              </>
            }
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(c => !c)}
            onClose={closeAndClear}
            savedAt={savedAt}
          />

          {!collapsed && (
            <div className="detail-body">
              <div className="bd-depth-list">
                {bdDepths.map(d => {
                  const ring = ringAt(d);
                  const options = ringsAvailableFor(d);
                  return (
                    <BDDepthRow
                      key={d.code}
                      depth={d}
                      ring={ring}
                      options={options}
                      onAssign={(id) => assignRing(d, id)}
                      onPatch={(partial) => patchRing(d, partial)}
                    />
                  );
                })}
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

function BDDepthRow({
  depth, ring, options, onAssign, onPatch,
}: {
  depth: DepthLayer;
  ring: BDRing | undefined;
  options: BDRing[];
  onAssign: (ring_id: string | "") => void;
  onPatch: (partial: Partial<BDRing>) => void;
}) {
  const selectId = useId();
  const notesId = useId();
  return (
    <fieldset className="m-group bd-depth-row">
      <legend className="m-group-title">
        <span className="bd-depth-chip mono">{depth.label} cm</span>
        {ring && ring.bulk_density_g_cm3 != null && (
          <span className="m-group-sub">
            BD <strong style={{ color: "var(--text-primary)" }}>{ring.bulk_density_g_cm3}</strong> g cm⁻³
          </span>
        )}
      </legend>
      <div className="bd-row-body">
        <div className="field bd-ring-picker">
          <label htmlFor={selectId}>Ring ID</label>
          <select
            id={selectId}
            value={ring?.ring_id ?? ""}
            onChange={e => onAssign(e.target.value as string | "")}
          >
            <option value="">— choose —</option>
            {/* Group rings so the user can tell at a glance which stubs are
                already bound to this plot vs free in the pool. Each group
                only renders when it has options so optgroups don't appear
                with empty bodies. */}
            {(() => {
              const here = options.filter(r => r.plot_id != null);
              const free = options.filter(r => r.plot_id == null);
              return (
                <>
                  {here.length > 0 && (
                    <optgroup label="Already here">
                      {here.map(r => (
                        <option key={r.ring_id} value={r.ring_id}>{r.ring_id}</option>
                      ))}
                    </optgroup>
                  )}
                  {free.length > 0 && (
                    <optgroup label="Unassigned">
                      {free.map(r => (
                        <option key={r.ring_id} value={r.ring_id}>{r.ring_id}</option>
                      ))}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </select>
        </div>
        <div className="m-grid m-grid-3 bd-ring-measurements">
          <MeasurementInput
            label="Volume"
            unit="cm³"
            value={ring?.ring_volume_cm3}
            onChange={v => onPatch({ ring_volume_cm3: v })}
            onClear={() => onPatch({ ring_volume_cm3: undefined })}
          />
          <MeasurementInput
            label="Fresh"
            unit="g"
            step="0.01"
            value={ring?.fresh_weight_g}
            onChange={v => onPatch({ fresh_weight_g: v })}
            onClear={() => onPatch({ fresh_weight_g: undefined })}
          />
          <MeasurementInput
            label="Oven-dry"
            unit="g"
            step="0.01"
            value={ring?.oven_dry_weight_g}
            onChange={v => onPatch({ oven_dry_weight_g: v })}
            onClear={() => onPatch({ oven_dry_weight_g: undefined })}
          />
        </div>
      </div>
      {ring && (
        <div className="bd-notes-row">
          <label htmlFor={notesId} className="bd-notes-label">Notes</label>
          <input
            id={notesId}
            type="text"
            placeholder="optional"
            value={ring.notes ?? ""}
            onChange={e => onPatch({ notes: str(e) })}
          />
        </div>
      )}
    </fieldset>
  );
}
