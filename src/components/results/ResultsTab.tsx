import { useEffect, useState } from "react";
import { VariablePicker } from "./VariablePicker";
import { DescriptiveTable } from "./DescriptiveTable";
import { DoseResponseChart } from "./DoseResponseChart";
import { DepthProfileChart } from "./DepthProfileChart";
import { AnovaTable } from "./AnovaTable";
import { MixedEffectsPanel } from "./MixedEffectsPanel";
import { extractObservations, variableDef, type Observation, type VariableKey } from "../../engine/variables";

type Sub = "descriptive" | "dose" | "depth" | "inference" | "mixed";

const SUBS: { key: Sub; label: string }[] = [
  { key: "descriptive", label: "Descriptive" },
  { key: "dose",        label: "Dose response" },
  { key: "depth",       label: "Depth profile" },
  { key: "inference",   label: "Fixed-effects ANOVA" },
  { key: "mixed",       label: "Mixed effects (split-plot)" },
];

export function ResultsTab() {
  const [sub, setSub] = useState<Sub>("descriptive");
  const [variable, setVariable] = useState<VariableKey>("soc_g_kg");
  const [obs, setObs] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setObs(await extractObservations(variable));
      setLoading(false);
    })();
  }, [variable]);

  const def = variableDef(variable);
  const depthResolved = def.level === "depth";

  return (
    <div className="column" style={{ gap: 10 }}>
      <nav className="entry-nav" aria-label="Results sections">
        {SUBS.map(s => (
          <button
            key={s.key}
            className="entry-nav-btn"
            data-active={sub === s.key}
            onClick={() => setSub(s.key)}
            disabled={s.key === "depth" && !depthResolved}
            title={s.key === "depth" && !depthResolved ? "Only available for depth-resolved variables" : undefined}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="card">
        <VariablePicker value={variable} onChange={setVariable} />
        <div className="row muted mono" style={{ marginTop: 8, fontSize: "0.78rem" }}>
          {loading ? "Loading..." : `${obs.length} observations across ${new Set(obs.map(o => o.plot_id)).size} plot(s)`}
        </div>
      </div>

      {sub === "descriptive" && (
        <div className="card">
          <div className="card-title">Treatment descriptives</div>
          <DescriptiveTable obs={obs} includeDepth={depthResolved} unit={def.unit} />
        </div>
      )}

      {sub === "dose" && (
        <div className="card">
          <div className="card-title">Dose response</div>
          <DoseResponseChart obs={obs} unit={def.unit} label={def.label} />
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
            Means +- SE across plots. Faint grey points: individual plot observations. For depth-resolved variables, values are averaged across depths.
          </div>
        </div>
      )}

      {sub === "depth" && (
        <div className="card">
          <div className="card-title">Depth profile</div>
          <DepthProfileChart obs={obs} unit={def.unit} label={def.label} />
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
            Means +- SE. Line style encodes genotype (solid = CCN 51, dashed = PS 13.19). Colour encodes N dose.
          </div>
        </div>
      )}

      {sub === "inference" && (
        <div className="card">
          <div className="card-title">Fixed-effects ANOVA</div>
          <AnovaTable obs={obs} depthResolved={depthResolved} label={def.label} unit={def.unit} />
        </div>
      )}

      {sub === "mixed" && (
        <div className="card">
          <div className="card-title">Mixed-effects split-plot ANOVA</div>
          <MixedEffectsPanel obs={obs} depthResolved={depthResolved} label={def.label} unit={def.unit} />
        </div>
      )}
    </div>
  );
}
