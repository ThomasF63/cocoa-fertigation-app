import { useId, useMemo, useState } from "react";
import { useStoreItems, useDebouncedSave } from "../../utils/useStoreItems";
import { ProgressBar, Stepper, isoDate, num, str } from "./shared";
import type { LeafComposite } from "../../types/samples";

function isEntered(l?: LeafComposite): boolean {
  return !!(l && (l.fresh_weight_g != null || l.dry_weight_g != null || l.n_leaves_combined != null || l.sampling_date));
}

export function LeafCompositeForm() {
  const comps = useStoreItems<LeafComposite>("leaf_composites", "sample_id");
  const debouncedSave = useDebouncedSave(comps.saveItem, "sample_id", 350);

  const sorted = useMemo(
    () => [...comps.items].sort((a, b) => a.sample_id.localeCompare(b.sample_id)),
    [comps.items],
  );
  const [idx, setIdx] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dateId = useId();
  const observerId = useId();
  const treesId = useId();
  const leavesId = useId();
  const freshId = useId();
  const dryId = useId();
  const notesId = useId();

  if (comps.loading) return <div className="card"><div className="muted">Loading...</div></div>;
  if (sorted.length === 0) return <div className="card"><div className="muted">No leaf composite stubs. Seed the factorial first.</div></div>;

  const item = sorted[idx];
  const totalEntered = comps.items.filter(isEntered).length;

  function patch(partial: Partial<LeafComposite>) {
    const next: LeafComposite = { ...item, ...partial };
    comps.replaceLocal(next);
    debouncedSave(next);
    setSavedAt(Date.now());
  }

  return (
    <div className="card">
      <div className="entry-toolbar">
        <ProgressBar value={totalEntered} total={48} label="Leaf composites" />
      </div>

      <div className="row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
        <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{item.sample_id}</div>
        <div className="muted mono" style={{ fontSize: "0.8rem" }}>Plot {item.plot_id}</div>
      </div>

      <div className="field-grid" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor={dateId}>Sampling date</label>
          <input
            id={dateId}
            type="date"
            value={isoDate(item.sampling_date)}
            onChange={e => patch({ sampling_date: e.target.value || undefined })}
          />
        </div>
        <div className="field">
          <label htmlFor={observerId}>Observer</label>
          <input
            id={observerId}
            type="text"
            value={item.observer ?? ""}
            onChange={e => patch({ observer: str(e) })}
          />
        </div>
      </div>

      <div className="big-input-grid" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor={treesId}>Trees sampled</label>
          <input
            id={treesId}
            className="big-input"
            type="number"
            inputMode="numeric"
            step="1"
            value={item.n_trees_sampled ?? ""}
            onChange={e => patch({ n_trees_sampled: num(e) })}
          />
        </div>
        <div className="field">
          <label htmlFor={leavesId}>Number of leaves</label>
          <input
            id={leavesId}
            className="big-input"
            type="number"
            inputMode="decimal"
            step="1"
            value={item.n_leaves_combined ?? ""}
            onChange={e => patch({ n_leaves_combined: num(e) })}
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
            value={item.fresh_weight_g ?? ""}
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
            value={item.dry_weight_g ?? ""}
            onChange={e => patch({ dry_weight_g: num(e) })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={notesId}>Notes</label>
        <input
          id={notesId}
          type="text"
          value={item.notes ?? ""}
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
  );
}
