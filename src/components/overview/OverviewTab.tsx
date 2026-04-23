import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, Upload, RefreshCw, Trash2, FlaskConical } from "lucide-react";
import { countsByStore, getAll, bulkPut, clearAll } from "../../db/repo";
import { importCsvFile } from "../../db/csv";
import type { StoreName } from "../../db/schema";
import { generatePlots, generateTrees } from "../../engine/layoutEngine";
import { generateSoilSamples, generateBDRingStubs } from "../../engine/samplingEngine";
import { loadPlan } from "../../utils/planStorage";
import { planCounts } from "../../types/plan";
import { usePlan } from "../../hooks/usePlan";
import type { SoilSample, BDRing } from "../../types/samples";
import type { SoilAnalytics } from "../../types/analytics";

function buildTargets(plan: ReturnType<typeof loadPlan>): Record<StoreName, number> {
  const c = planCounts(plan);
  return {
    plots: c.plots,
    trees: c.trees,
    soil_samples: c.soil_samples,
    bd_rings: c.bd_rings,
    tree_measurements: c.trees,
    soil_analytics: c.soil_samples,
  };
}

const LABELS: Record<StoreName, string> = {
  plots: "Plots",
  trees: "Trees",
  soil_samples: "Soil samples",
  bd_rings: "BD rings",
  tree_measurements: "Tree measurements",
  soil_analytics: "Soil analytics",
};

// Stores that get ID stubs from seeding — the raw row count reflects the
// sampling frame, not collected observations. "Collected" requires that key
// field or lab values have actually been filled in.
const SCAFFOLD_STORES: StoreName[] = [
  "plots",
  "trees",
  "soil_samples",
  "bd_rings",
];

// The collection grid: row-count stores plus the sample-stub stores, the
// latter filtered by a "has-data" predicate.
const COLLECTION_GRID: StoreName[] = [
  "soil_samples",
  "bd_rings",
  "tree_measurements",
  "soil_analytics",
];

function isSoilSampleCollected(r: SoilSample): boolean {
  return !!r.sampling_date;
}
function isBDRingCollected(r: BDRing): boolean {
  // Field step done once a fresh weight has been recorded.
  return r.fresh_weight_g != null || !!r.sampling_date;
}
// N-min is a measurement column on soil_analytics rows. A measurement is
// considered in-progress once any incubation field is populated.
function isNminMeasured(r: SoilAnalytics): boolean {
  return (
    r.net_min_rate_mg_kg_d != null ||
    r.day0_nh4_mg_kg != null || r.day0_no3_mg_kg != null ||
    !!r.incubation_start_date
  );
}

interface Props {
  onPendingChange: (n: number) => void;
  onLastSync: (s: string | null) => void;
}

export function OverviewTab({ onPendingChange }: Props) {
  const [counts, setCounts] = useState<Record<StoreName, number> | null>(null);
  const [collected, setCollected] = useState<Record<StoreName, number> | null>(null);
  const [nminMeasured, setNminMeasured] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const { plan } = usePlan();
  const TARGETS = useMemo(() => buildTargets(plan), [plan]);
  const nminTarget = useMemo(() => planCounts(plan).nmin_measurements, [plan]);

  const refresh = useCallback(async () => {
    const c = await countsByStore();
    setCounts(c);

    const [soilSamples, bdRings, analytics] = await Promise.all([
      getAll<SoilSample>("soil_samples"),
      getAll<BDRing>("bd_rings"),
      getAll<SoilAnalytics>("soil_analytics"),
    ]);
    const col: Record<StoreName, number> = {
      plots: 0,
      trees: 0,
      soil_samples: soilSamples.filter(isSoilSampleCollected).length,
      bd_rings: bdRings.filter(isBDRingCollected).length,
      tree_measurements: c.tree_measurements ?? 0,
      soil_analytics: c.soil_analytics ?? 0,
    };
    const nmin = analytics.filter(isNminMeasured).length;
    setCollected(col);
    setNminMeasured(nmin);

    // "Pending" = collected records that haven't been exported to CSV on disk.
    const pending = col.tree_measurements + col.soil_analytics;
    onPendingChange(pending);
  }, [onPendingChange]);

  useEffect(() => { refresh(); }, [refresh]);

  async function seedDesign() {
    setBusy("Seeding factorial...");
    const plan = loadPlan();
    const plots = generatePlots(plan);
    await bulkPut("plots", plots);
    await bulkPut("trees", generateTrees(plots));
    await bulkPut("soil_samples", generateSoilSamples(plots, plan));
    await bulkPut("bd_rings", generateBDRingStubs(plan));
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

  const loadDummy = useCallback(async () => {
    setBusy("Loading dummy dataset...");
    const base = import.meta.env.BASE_URL;
    const files = [
      "plot_register.csv",
      "tree_register.csv",
      "soil_samples.csv",
      "bulk_density_rings.csv",
      "tree_measurements.csv",
      "soil_analytics.csv",
    ];
    for (const name of files) {
      const res = await fetch(`${base}dummy/${name}`);
      if (!res.ok) { console.warn(`dummy fetch failed: ${name}`); continue; }
      const text = await res.text();
      const file = new File([text], name, { type: "text/csv" });
      try { await importCsvFile(file); }
      catch (e) { console.error(`dummy import failed: ${name}`, e); }
    }
    setBusy(null);
    refresh();
  }, [refresh]);

  // Dev convenience: auto-seed the dummy dataset on first load when the DB is empty.
  const autoSeeded = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (autoSeeded.current) return;
    if (!counts) return;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) { autoSeeded.current = true; return; }
    autoSeeded.current = true;
    loadDummy();
  }, [counts, loadDummy]);

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <h2 className="card-title">Data collection status</h2>
        <div className="muted" style={{ fontSize: "0.8rem", marginBottom: 8 }}>
          Progress reflects records with actual field or lab values, not seeded ID stubs.
        </div>
        <div className="stat-grid">
          {counts && collected && COLLECTION_GRID.map((s) => {
            const got = collected[s] ?? 0;
            const target = TARGETS[s];
            const pct = target === 0 ? 0 : Math.min(100, Math.round(100 * got / target));
            const sub = s === "soil_samples"    ? "sampled"
                      : s === "bd_rings"        ? "weighed"
                      : s === "tree_measurements" ? "measured"
                      : s === "soil_analytics"  ? "analyzed"
                      : "";
            return (
              <div key={s} className="stat">
                <span className="stat-label">{LABELS[s]}</span>
                <span className="stat-value">{got}<span className="muted" style={{ fontSize: "0.7em" }}> / {target}</span></span>
                <span className="stat-sub">{target === 0 ? "" : `${pct}% ${sub}`}</span>
                {target > 0 && (
                  <div className="stat-bar" role="progressbar" aria-label={`${LABELS[s]} progress`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {/* N-min is a measurement on soil_analytics rows, not its own store.
              Shown as a dedicated tile because its progress diverges from the
              broader soil-analytics panel (separate incubation workflow). */}
          {counts && nminTarget > 0 && (() => {
            const pct = Math.min(100, Math.round(100 * nminMeasured / nminTarget));
            return (
              <div key="nmin" className="stat">
                <span className="stat-label">N-min measurements</span>
                <span className="stat-value">{nminMeasured}<span className="muted" style={{ fontSize: "0.7em" }}> / {nminTarget}</span></span>
                <span className="stat-sub">{`${pct}% incubated/analyzed`}</span>
                <div className="stat-bar" role="progressbar" aria-label="N-min measurements progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
        </div>

        <h3 style={{ fontSize: "0.85rem", marginTop: 14, marginBottom: 6, color: "var(--ek-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Design scaffolded (ID stubs from seeding)
        </h3>
        <div className="row muted" style={{ fontSize: "0.82rem", gap: 14, flexWrap: "wrap" }}>
          {counts && SCAFFOLD_STORES.map((s) => (
            <span key={s}>
              {LABELS[s]}: <strong style={{ color: "var(--ek-ink)" }}>{counts[s] ?? 0}</strong> / {TARGETS[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Actions</h2>
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
          {import.meta.env.DEV && (
            <button className="btn" onClick={loadDummy} disabled={!!busy} title="Dev-only: load the bundled dummy dataset">
              <FlaskConical size={16} /> Load dummy dataset
            </button>
          )}
          <span className="spacer" />
          <button className="btn accent" onClick={onWipe} disabled={!!busy}>
            <Trash2 size={16} /> Clear local data
          </button>
        </div>
        {busy && <div className="muted" style={{ marginTop: 10 }}>{busy}</div>}
        <div className="muted" style={{ marginTop: 10, fontSize: "0.78rem" }}>
          Seed: generates {TARGETS.plots} plots, {TARGETS.trees} trees, {TARGETS.soil_samples} soil sample IDs and {TARGETS.bd_rings} BD ring stubs into the local database, from the current sampling plan. N-min is a measurement run on the 0–10 cm soil sample, not a separate sample type — enter its columns via <code>soil_analytics.csv</code>.
          Import: accepts the CSVs from this project's <code>data/</code> folder (header-matched by filename). You can do either or both: seed first, then overlay measurement CSVs.
        </div>
      </div>
    </div>
  );
}
