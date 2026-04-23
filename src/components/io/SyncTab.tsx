import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Share2, FileText, Download, Check, Circle } from "lucide-react";
import JSZip from "jszip";
import { countsByStore, getAll } from "../../db/repo";
import { importCsvFile, exportStoreToCsv, FILENAME_TO_STORE, HEADERS } from "../../db/csv";
import type { StoreName } from "../../db/schema";
import { generateReport } from "../../utils/pdfReport";

const FILE_FOR_STORE: Record<StoreName, string> =
  Object.fromEntries(Object.entries(FILENAME_TO_STORE).map(([f, s]) => [s, f])) as Record<StoreName, string>;

const BUNDLE_STORES = Object.keys(HEADERS).filter(k => k in FILE_FOR_STORE) as StoreName[];

interface Props {
  pendingChanges: number;
  lastSync: string | null;
  onSynced: (iso: string) => void;
}

type SyncState = "fresh" | "behind" | "untouched" | "empty";

export function SyncTab({ pendingChanges, lastSync, onSynced }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<StoreName, number> | null>(null);
  const [importedFiles, setImportedFiles] = useState<string[]>([]);

  const refresh = useCallback(async () => { setCounts(await countsByStore()); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function buildBundle(): Promise<Blob> {
    const zip = new JSZip();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const folder = zip.folder(`mccs-data-${stamp}`)!;
    for (const store of BUNDLE_STORES) {
      const items = await getAll(store);
      const csv = exportStoreToCsv(store, items as Record<string, unknown>[]);
      folder.file(FILE_FOR_STORE[store], csv);
    }
    folder.file("README.txt", [
      "MCCS cocoa fertigation - exported data bundle",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Drop the individual .csv files into the project's data/ folder,",
      "preserving the subdirectory structure (01_design, 02_field, 03_lab).",
      "File names match data/build_data_templates.js.",
    ].join("\n"));
    return zip.generateAsync({ type: "blob" });
  }

  async function onShareOrDownload(forceDownload = false) {
    setBusy("Building bundle...");
    const blob = await buildBundle();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `mccs-data-${stamp}.zip`;

    type NavigatorWithShare = Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };
    const nav = navigator as NavigatorWithShare;
    const file = new File([blob], filename, { type: "application/zip" });
    const shareable = !forceDownload && nav.canShare && nav.canShare({ files: [file] });

    try {
      if (shareable && nav.share) {
        await nav.share({ files: [file], title: "MCCS data", text: "Field + lab data bundle" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      onSynced(new Date().toISOString().slice(0, 19).replace("T", " "));
    } catch {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setBusy(null);
    }
  }

  async function onImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(`Importing ${files.length} file(s)...`);
    const names: string[] = [];
    for (const f of Array.from(files)) {
      try {
        await importCsvFile(f);
        names.push(f.name);
      }
      catch (e) { console.error("Import failed:", f.name, e); }
    }
    setImportedFiles(prev => Array.from(new Set([...prev, ...names])));
    setBusy(null);
    refresh();
  }

  async function onReport() {
    setBusy("Building PDF report...");
    try {
      const blob = await generateReport();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mccs-report-${stamp}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error(e);
      alert("Report generation failed: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  const totalRows = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const nonEmptyFiles = counts
    ? BUNDLE_STORES.filter(s => (counts[s] ?? 0) > 0).length
    : 0;

  const state: SyncState = useMemo(() => {
    if (totalRows === 0) return "empty";
    if (lastSync === null) return "untouched";
    if (pendingChanges > 0) return "behind";
    return "fresh";
  }, [totalRows, lastSync, pendingChanges]);

  const stateCopy: Record<SyncState, { label: string; note: string }> = {
    fresh:     { label: "Up to date",        note: "Local data has been shared." },
    behind:    { label: "Behind last share", note: `${pendingChanges} rows added since last share.` },
    untouched: { label: "Never shared",      note: "Local data has not left this device yet." },
    empty:     { label: "No local data",     note: "Nothing stored in this browser yet." },
  };

  return (
    <div className="sync-tab">
      {/* §01 — Status readout */}
      <section className="sync-panel sync-status" data-accent="water">
        <header className="sync-panel-head">
          <span className="sync-index">01</span>
          <div className="sync-panel-title">
            <h2>Offline status</h2>
            <p>Data is held in this browser and persists without internet. Share or download to get it off the iPad.</p>
          </div>
          <div className="sync-state" data-state={state}>
            <span className="sync-state-dot" aria-hidden="true" />
            <span className="sync-state-label">{stateCopy[state].label}</span>
          </div>
        </header>

        <div className="sync-readout">
          <div className="sync-readout-cell">
            <span className="sync-readout-label">Pending changes</span>
            <span className="sync-readout-value">{String(pendingChanges).padStart(3, "0")}</span>
            <span className="sync-readout-sub">measurement + lab rows</span>
          </div>
          <div className="sync-readout-cell">
            <span className="sync-readout-label">Rows on device</span>
            <span className="sync-readout-value">{totalRows.toLocaleString("en-US")}</span>
            <span className="sync-readout-sub">across {nonEmptyFiles} of {BUNDLE_STORES.length} files</span>
          </div>
          <div className="sync-readout-cell">
            <span className="sync-readout-label">Last shared</span>
            <span className="sync-readout-value sync-readout-value--sm">
              {lastSync ?? <span className="sync-readout-never">never</span>}
            </span>
            <span className="sync-readout-sub">{stateCopy[state].note}</span>
          </div>
        </div>
      </section>

      {/* §02 — Export */}
      <section className="sync-panel" data-accent="stem">
        <header className="sync-panel-head">
          <span className="sync-index">02</span>
          <div className="sync-panel-title">
            <h2>Export and share</h2>
            <p>Bundle every local CSV into a single .zip. On iPad, the iOS share sheet opens for AirDrop, Files, or email. On desktop, it downloads directly.</p>
          </div>
        </header>

        <div className="sync-actions">
          <button className="btn primary big" onClick={() => onShareOrDownload(false)} disabled={!!busy}>
            <Share2 size={20} /> Share bundle
          </button>
          <button className="btn big" onClick={() => onShareOrDownload(true)} disabled={!!busy}>
            <Download size={20} /> Download .zip
          </button>
        </div>

        <div className="sync-manifest">
          <div className="sync-manifest-head">
            <span className="sync-manifest-title">Bundle contents</span>
            <span className="sync-manifest-meta">
              <span className="mono">{BUNDLE_STORES.length}</span> files ·
              <span className="mono"> {totalRows.toLocaleString("en-US")}</span> rows
            </span>
          </div>
          <ul className="sync-manifest-list">
            {BUNDLE_STORES.map(store => {
              const rows = counts?.[store] ?? 0;
              const empty = rows === 0;
              return (
                <li key={store} className="sync-manifest-row" data-empty={empty}>
                  <span className="sync-manifest-file mono">{FILE_FOR_STORE[store]}</span>
                  <span className="sync-manifest-rows mono">
                    {empty ? "—" : rows.toLocaleString("en-US")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* §03 — Import */}
      <section className="sync-panel" data-accent="seed">
        <header className="sync-panel-head">
          <span className="sync-index">03</span>
          <div className="sync-panel-title">
            <h2>Import CSVs</h2>
            <p>Replace local data from previously exported files. Filenames must match. Header order is preserved for bit-for-bit round-trip.</p>
          </div>
        </header>

        <div className="sync-actions">
          <label className="btn primary big">
            <Upload size={20} /> Select one or more CSV files
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={(e) => onImport(e.target.files)}
              style={{ display: "none" }}
            />
          </label>
        </div>

        <div className="sync-manifest">
          <div className="sync-manifest-head">
            <span className="sync-manifest-title">Expected filenames</span>
            <span className="sync-manifest-meta">
              <span className="mono">{importedFiles.length}</span> of <span className="mono">{BUNDLE_STORES.length}</span> seen this session
            </span>
          </div>
          <ul className="sync-expect-list">
            {BUNDLE_STORES.map(store => {
              const file = FILE_FOR_STORE[store];
              const seen = importedFiles.includes(file);
              return (
                <li key={store} className="sync-expect-row" data-seen={seen}>
                  <span className="sync-expect-glyph" aria-hidden="true">
                    {seen ? <Check size={13} strokeWidth={3} /> : <Circle size={9} strokeWidth={2} />}
                  </span>
                  <span className="sync-expect-file mono">{file}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* §04 — Report */}
      <section className="sync-panel" data-accent="berry">
        <header className="sync-panel-head">
          <span className="sync-index">04</span>
          <div className="sync-panel-title">
            <h2>Generate report</h2>
            <p>Auto-assembled PDF covering completion, methods, descriptive tables, and the main fixed- and mixed-effects tests. Downloads as <code>mccs-report-YYYY-MM-DD.pdf</code>.</p>
          </div>
        </header>

        <div className="sync-actions">
          <button className="btn primary big" onClick={onReport} disabled={!!busy}>
            <FileText size={20} /> Build interim PDF report
          </button>
        </div>

        <ul className="sync-chips">
          <li>Completion status</li>
          <li>Methods snippet</li>
          <li>Per-variable descriptives</li>
          <li>Fixed-effects ANOVA</li>
          <li>Split-plot mixed-effects F-tests</li>
          <li>Variance components</li>
        </ul>
      </section>

      {busy && (
        <div className="sync-busy" role="status" aria-live="polite">
          <span className="sync-busy-spinner" aria-hidden="true" />
          {busy}
        </div>
      )}
    </div>
  );
}
