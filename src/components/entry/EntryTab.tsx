import { useState } from "react";
import { TreeMeasurementForm } from "./TreeMeasurementForm";
import { SoilSampleForm } from "./SoilSampleForm";
import { BulkDensityForm } from "./BulkDensityForm";
import { LeafCompositeForm } from "./LeafCompositeForm";

type Sub = "trees" | "soil" | "bd" | "leaves";

const SUBS: { key: Sub; label: string }[] = [
  { key: "trees",  label: "Trees" },
  { key: "soil",   label: "Soil" },
  { key: "bd",     label: "BD" },
  { key: "leaves", label: "Leaves" },
];

export function EntryTab() {
  const [sub, setSub] = useState<Sub>("trees");

  return (
    <div className="column" style={{ gap: 10 }}>
      <nav className="entry-nav" aria-label="Entry sections">
        {SUBS.map(s => (
          <button
            key={s.key}
            className="entry-nav-btn"
            data-active={sub === s.key}
            onClick={() => setSub(s.key)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {sub === "trees"  && <TreeMeasurementForm />}
      {sub === "soil"   && <SoilSampleForm />}
      {sub === "bd"     && <BulkDensityForm />}
      {sub === "leaves" && <LeafCompositeForm />}
    </div>
  );
}
