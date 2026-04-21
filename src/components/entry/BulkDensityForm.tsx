import { useId, useMemo, useState } from "react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import { PlotPicker, ProgressBar, Stepper, isoDate, num, str } from "./shared";
import type { Plot } from "../../types/design";
import type { BDRing } from "../../types/samples";

function computeBD(fresh?: number, dry?: number, vol?: number): number | undefined {
  if (dry == null || vol == null || vol === 0) return undefined;
  return Number((dry / vol).toFixed(3));
}

function isEntered(r?: BDRing): boolean {
  return !!(r && (r.ring_volume_cm3 != null || r.fresh_weight_g != null || r.oven_dry_weight_g != null));
}

export function BulkDensityForm() {
  const plots = useStoreItems<Plot>("plots", "plot_id");
  const rings = useStoreItems<BDRing>("bd_rings", "ring_id");
  const debouncedSave = useDebouncedSave(rings.saveItem, "ring_id", 350);

  const [idx, setIdx] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dateId = useId();
  const samplerId = useId();
  const volId = useId();
  const freshId = useId();
  const dryId = useId();
  const notesId = useId();

  const sorted = useMemo(
    () => [...rings.items].sort((a, b) => a.ring_id.localeCompare(b.ring_id)),
    [rings.items],
  );
  const ring = sorted[idx];

  const totalEntered = useMemo(() => rings.items.filter(isEntered).length, [rings.items]);

  if (plots.loading || rings.loading) return <div className="card"><div className="muted">Loading...</div></div>;
  if (sorted.length === 0) return <div className="card"><div className="muted">No BD ring stubs yet. Seed the factorial from the Overview tab.</div></div>;

  function patch(partial: Partial<BDRing>) {
    if (!ring) return;
    const next: BDRing = { ...ring, ...partial };
    next.bulk_density_g_cm3 = computeBD(next.fresh_weight_g, next.oven_dry_weight_g, next.ring_volume_cm3);
    rings.replaceLocal(next);
    debouncedSave(next);
    setSavedAt(Date.now());
  }

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <div className="entry-toolbar">
          <ProgressBar value={totalEntered} total={64} label="BD rings entered" />
        </div>

        <div className="row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{ring.ring_id}</div>
          <div className="muted mono" style={{ fontSize: "0.8rem" }}>{ring.depth_label} cm</div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <span className="field-label">Plot assignment</span>
          <PlotPicker
            plots={plots.items}
            value={ring.plot_id ?? null}
            onChange={(id) => patch({ plot_id: id })}
            label="Plot"
          />
        </div>

        <div className="field-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor={dateId}>Sampling date</label>
            <input
              id={dateId}
              type="date"
              value={isoDate(ring.sampling_date)}
              onChange={e => patch({ sampling_date: e.target.value || undefined })}
            />
          </div>
          <div className="field">
            <label htmlFor={samplerId}>Sampler</label>
            <input
              id={samplerId}
              type="text"
              value={ring.sampler ?? ""}
              onChange={e => patch({ sampler: str(e) })}
            />
          </div>
        </div>

        <div className="big-input-grid" style={{ marginBottom: 10 }}>
          <div className="field">
            <label htmlFor={volId}>Ring volume (cm<sup>3</sup>)</label>
            <input
              id={volId}
              className="big-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={ring.ring_volume_cm3 ?? ""}
              onChange={e => patch({ ring_volume_cm3: num(e) })}
            />
          </div>
          <div className="field">
            <label htmlFor={freshId}>Fresh weight (g)</label>
            <input
              id={freshId}
              className="big-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={ring.fresh_weight_g ?? ""}
              onChange={e => patch({ fresh_weight_g: num(e) })}
            />
          </div>
          <div className="field">
            <label htmlFor={dryId}>Dry weight (g)</label>
            <input
              id={dryId}
              className="big-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={ring.oven_dry_weight_g ?? ""}
              onChange={e => patch({ oven_dry_weight_g: num(e) })}
            />
          </div>
        </div>

        <div className="stat" style={{ marginBottom: 14 }}>
          <span className="stat-label">Bulk density (g cm<sup>-3</sup>, derived)</span>
          <span className="stat-value">{ring.bulk_density_g_cm3 ?? "-"}</span>
        </div>

        <div className="field">
          <label htmlFor={notesId}>Notes</label>
          <input
            id={notesId}
            type="text"
            value={ring.notes ?? ""}
            onChange={e => patch({ notes: str(e) })}
          />
        </div>

        <Stepper
          index={idx}
          total={sorted.length}
          onPrev={() => setIdx(i => Math.max(0, i - 1))}
          onNext={() => setIdx(i => Math.min(sorted.length - 1, i + 1))}
          savedAt={savedAt}
        />
      </div>
    </div>
  );
}
