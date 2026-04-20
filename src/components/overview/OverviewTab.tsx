import { useCallback, useEffect, useState } from "react";
import { Database, Sprout, Upload, RefreshCw, Trash2 } from "lucide-react";
import { countsByStore, bulkPut, clearAll } from "../../db/repo";
import { importCsvFile } from "../../db/csv";
import type { StoreName } from "../../db/schema";
import { generatePlots, generateTrees } from "../../engine/layoutEngine";
import { generateSoilSamples, generateBDRingStubs, generateLeafComposites, generateNminSamples } from "../../engine/samplingEngine";

const TARGETS: Record<StoreName, number> = {
  plots: 48,
  trees: 576,
  soil_samples: 192,
  bd_rings: 64,
  leaf_composites: 48,
  nmin_samples: 48,
  tree_measurements: 576,
  soil_analytics: 192,
  leaf_analytics: 48,
};

const LABELS: Record<StoreName, string> = {
  plots: "Plots",
  trees: "Trees",
  soil_samples: "Soil samples",
  bd_rings: "BD rings",
  leaf_composites: "Leaf composites",
  nmin_samples: "N-min samples",
  tree_measurements: "Tree measurements",
  soil_analytics: "Soil analytics",
  leaf_analytics: "Leaf analytics",
};

interface Props {
  onPendingChange: (n: number) => void;
  onLastSync: (s: string | null) => void;
}

export function OverviewTab({ onPendingChange }: Props) {
  const [counts, setCounts] = useState<Record<StoreName, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const c = await countsByStore();
    setCounts(c);
    // Very crude: everything non-zero in tree_measurements / soil_analytics / nmin / leaf_analytics
    // counts as "pending" (data that is not yet in the CSVs on disk).
    const pending = (c.tree_measurements ?? 0) + (c.soil_analytics ?? 0)
                  + (c.nmin_samples ?? 0)     + (c.leaf_analytics ?? 0);
    onPendingChange(pending);
  }, [onPendingChange]);

  useEffect(() => { refresh(); }, [refresh]);

  async function seedDesign() {
    setBusy("Seeding factorial...");
    const plots = generatePlots();
    await bulkPut("plots", plots);
    await bulkPut("trees", generateTrees(plots));
    await bulkPut("soil_samples", generateSoilSamples(plots));
    await bulkPut("bd_rings", generateBDRingStubs());
    await bulkPut("leaf_composites", generateLeafComposites(plots));
    await bulkPut("nmin_samples", generateNminSamples(plots));
    setBusy(null);
    refresh();
  }

  async function onCsvImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(`Importing ${files.length} file(s)...`);
    for (const f of Array.from(files)) {
      try { await importCsvFile(f); }
      catch (e) { console.error("Import failed:", f.name, e); }
    }
    setBusy(null);
    refresh();
  }

  async function onWipe() {
    if (!confirm("Clear ALL local data? This cannot be undone.")) return;
    setBusy("Clearing...");
    await clearAll();
    setBusy(null);
    refresh();
  }

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <Sprout size={22} color="var(--ek-stem)" />
          <div>
            <div style={{ fontWeight: 600 }}>MCCS cocoa fertigation, Phase 2 paper</div>
            <div className="muted">Cross-sectional campaign, 3 to 4 days on-site, April 2026.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Data collection status</div>
        <div className="stat-grid">
          {counts && (Object.keys(TARGETS) as StoreName[]).map((s) => {
            const got = counts[s] ?? 0;
            const target = TARGETS[s];
            return (
              <div key={s} className="stat">
                <span className="stat-label">{LABELS[s]}</span>
                <span className="stat-value">{got}<span className="muted" style={{ fontSize: "0.7em" }}> / {target}</span></span>
                <span className="stat-sub">{target === 0 ? "" : `${Math.round(100 * got / target)}%`}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Actions</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <button className="btn primary" onClick={seedDesign} disabled={!!busy}>
            <Database size={16} /> Seed factorial (plots + trees + sample IDs)
          </button>
          <label className="btn">
            <Upload size={16} /> Import CSVs from data/
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={(e) => onCsvImport(e.target.files)}
              style={{ display: "none" }}
            />
          </label>
          <button className="btn" onClick={refresh} disabled={!!busy}>
            <RefreshCw size={16} /> Refresh counts
          </button>
          <span className="spacer" />
          <button className="btn accent" onClick={onWipe} disabled={!!busy}>
            <Trash2 size={16} /> Clear local data
          </button>
        </div>
        {busy && <div className="muted" style={{ marginTop: 10 }}>{busy}</div>}
        <div className="muted" style={{ marginTop: 10, fontSize: "0.78rem" }}>
          Seed: generates all 48 plots, 576 trees, 192 soil sample IDs, 64 BD ring stubs, 48 leaf and 48 N-min sample IDs directly into the local database.
          Import: accepts the CSVs from this project's <code>data/</code> folder (header-matched by filename). You can do either or both: seed first, then overlay measurement CSVs.
        </div>
      </div>
    </div>
  );
}
