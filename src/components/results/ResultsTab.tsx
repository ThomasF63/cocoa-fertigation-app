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
  const plotCount = new Set(obs.map(o => o.plot_id)).size;

  return (
    <div className="results-tab">
      <VariablePicker value={variable} onChange={setVariable} />

      <div className="results-subnav-row">
        <nav className="entry-nav compact" aria-label="Results sections">
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
        <div className="results-meta mono">
          {loading ? "Loading…" : `${obs.length} obs · ${plotCount} plot${plotCount === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="card results-content">
        {sub === "descriptive" && (
          <DescriptiveTable obs={obs} includeDepth={depthResolved} unit={def.unit} />
        )}

        {sub === "dose" && (
          <>
            <DoseResponseChart obs={obs} unit={def.unit} label={def.label} />
            <div className="muted caption">
              Means ± SE across plots. Individual plots shown as translucent points coloured by genotype; use the selector above the chart to switch between stacked, jittered, and beeswarm layouts. For depth-resolved variables, means are across depths.
            </div>
          </>
        )}

        {sub === "depth" && (
          <>
            <DepthProfileChart obs={obs} unit={def.unit} label={def.label} />
            <div className="muted caption">
              Means ± SE, plotted at horizon mid-depth. Horizontal error bars are ± 1 SE. Shaded strips mark the sampled depth intervals; hover a legend chip to isolate a dose or genotype.
            </div>
          </>
        )}

        {sub === "inference" && (
          <AnovaTable obs={obs} depthResolved={depthResolved} label={def.label} unit={def.unit} />
        )}

        {sub === "mixed" && (
          <MixedEffectsPanel obs={obs} depthResolved={depthResolved} label={def.label} unit={def.unit} />
        )}
      </div>
    </div>
  );
}
