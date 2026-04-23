import { useState } from "react";
import { TreeProtocol } from "./TreeProtocol";
import { SoilProtocol } from "./SoilProtocol";
import { BulkDensityProtocol } from "./BulkDensityProtocol";
import { usePlan } from "../../hooks/usePlan";
import { planCounts } from "../../types/plan";

type Sub = "trees" | "soil" | "bd";

const SUBS: { key: Sub; label: string }[] = [
  { key: "trees", label: "Trees" },
  { key: "soil",  label: "Soil" },
  { key: "bd",    label: "BD" },
];

export function ProtocolTab() {
  const [sub, setSub] = useState<Sub>("trees");
  const { plan } = usePlan();

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

      {sub === "trees" && <TreeProtocol  plan={plan} counts={counts} />}
      {sub === "soil"  && <SoilProtocol  plan={plan} counts={counts} />}
      {sub === "bd"    && <BulkDensityProtocol plan={plan} counts={counts} />}
    </div>
  );
}
