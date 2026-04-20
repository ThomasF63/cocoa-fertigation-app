import { useCallback, useEffect, useState } from "react";
import { Upload, Share2, FileText } from "lucide-react";
import JSZip from "jszip";
import { countsByStore, getAll } from "../../db/repo";
import { importCsvFile, exportStoreToCsv, FILENAME_TO_STORE, HEADERS } from "../../db/csv";
import type { StoreName } from "../../db/schema";
import { generateReport } from "../../utils/pdfReport";

const FILE_FOR_STORE: Record<StoreName, string> =
  Object.fromEntries(Object.entries(FILENAME_TO_STORE).map(([f, s]) => [s, f])) as Record<StoreName, string>;

interface Props {
  pendingChanges: number;
  lastSync: string | null;
  onSynced: (iso: string) => void;
}

export function SyncTab({ pendingChanges, lastSync, onSynced }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<StoreName, number> | null>(null);

  const refresh = useCallback(async () => { setCounts(await countsByStore()); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function buildBundle(): Promise<Blob> {
    const zip = new JSZip();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const folder = zip.folder(`mccs-data-${stamp}`)!;
    for (const store of Object.keys(HEADERS).filter(k => k in FILE_FOR_STORE) as StoreName[]) {
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

  async function onShareOrDownload() {
    setBusy("Building bundle...");
    const blob = await buildBundle();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `mccs-data-${stamp}.zip`;

    // Try iOS Share Sheet first (works on iPad Safari when served over HTTPS / PWA)
    type NavigatorWithShare = Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };
    const nav = navigator as NavigatorWithShare;
    const file = new File([blob], filename, { type: "application/zip" });
    const shareable = nav.canShare && nav.canShare({ files: [file] });

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
      // user-cancel or no share support; fall back to download
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
    for (const f of Array.from(files)) {
      try { await importCsvFile(f); }
      catch (e) { console.error("Import failed:", f.name, e); }
    }
    setBusy(null);
    refresh();
  }

  const totalRows = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-title">Offline status</div>
        <div className="stat-grid">
          <div className="stat"><span className="stat-label">Pending changes</span><span className="stat-value">{pendingChanges}</span><span className="stat-sub">measurement + lab rows</span></div>
          <div className="stat"><span className="stat-label">Total rows (local)</span><span className="stat-value">{totalRows}</span></div>
          <div className="stat"><span className="stat-label">Last sync</span><span className="stat-value" style={{ fontSize: "1rem" }}>{lastSync ?? "never"}</span></div>
        </div>
        <div className="muted" style={{ marginTop: 10, fontSize: "0.85rem" }}>
          Data is stored locally in this browser and persists without internet. When you are back online, use the buttons below to get the data off the iPad and into the project's <code>data/</code> folder.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Export and share</div>
        <div className="column">
          <button className="btn primary big" onClick={onShareOrDownload} disabled={!!busy}>
            <Share2 size={20} /> Export and share bundle (.zip of all CSVs)
          </button>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            On iPad: opens the iOS share sheet. AirDrop to your laptop, save to Files / OneDrive, or send by email.
            On desktop: downloads a .zip.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Import CSVs</div>
        <label className="btn big">
          <Upload size={20} /> Select one or more CSV files
          <input
            type="file"
            accept=".csv"
            multiple
            onChange={(e) => onImport(e.target.files)}
            style={{ display: "none" }}
          />
        </label>
        <div className="muted" style={{ marginTop: 10, fontSize: "0.85rem" }}>
          Filenames must match the ones in <code>data/</code> (e.g., <code>soil_samples.csv</code>, <code>tree_measurements.csv</code>). Header order is preserved for bit-for-bit round-trip.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Generate report</div>
        <div className="column">
          <button className="btn big" onClick={onReport} disabled={!!busy}>
            <FileText size={20} /> Build interim PDF report
          </button>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Auto-assembled PDF: completion status, methods snippet, per-variable descriptive tables, fixed-effects ANOVA and split-plot mixed-effects F-tests (with correct error strata and variance components). Downloads as <code>mccs-report-YYYY-MM-DD.pdf</code>.
          </div>
        </div>
      </div>

      {busy && <div className="muted">{busy}</div>}
    </div>
  );

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
}
