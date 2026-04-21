import { useEffect, useState } from "react";
import { TreeProtocol } from "./TreeProtocol";
import { SoilProtocol } from "./SoilProtocol";
import { BulkDensityProtocol } from "./BulkDensityProtocol";
import { LeafProtocol } from "./LeafProtocol";
import { loadPlan } from "../../utils/planStorage";
import { planCounts, type SamplingPlan } from "../../types/plan";

type Sub = "trees" | "soil" | "bd" | "leaves";

const SUBS: { key: Sub; label: string }[] = [
  { key: "trees",  label: "Trees" },
  { key: "soil",   label: "Soil" },
  { key: "bd",     label: "BD" },
  { key: "leaves", label: "Leaves" },
];

export function ProtocolTab() {
  const [sub, setSub] = useState<Sub>("trees");
  const [plan, setPlan] = useState<SamplingPlan>(() => loadPlan());

  // Refresh when plan changes in another tab or the window regains focus.
  useEffect(() => {
    const refresh = () => setPlan(loadPlan());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Always re-read on sub-tab change as a safety net (cheap localStorage read).
  useEffect(() => {
    setPlan(loadPlan());
  }, [sub]);

  const counts = planCounts(plan);

  return (
    <div className="column" style={{ gap: 10 }}>
      <nav className="entry-nav" aria-label="Protocol sections">
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

      {sub === "trees"  && <TreeProtocol  plan={plan} counts={counts} />}
      {sub === "soil"   && <SoilProtocol  plan={plan} counts={counts} />}
      {sub === "bd"     && <BulkDensityProtocol plan={plan} counts={counts} />}
      {sub === "leaves" && <LeafProtocol  plan={plan} counts={counts} />}
    </div>
  );
}
