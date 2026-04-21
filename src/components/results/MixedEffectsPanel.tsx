import { useMemo } from "react";
import { fitSplitPlotAnova, type SplitPlotOutput } from "../../engine/anova";
import { sig } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";

function stars(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01)  return "**";
  if (p < 0.05)  return "*";
  if (p < 0.1)   return ".";
  return "";
}

function fmtP(p: number | null): string {
  if (p === null) return "-";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

function stratumLabel(s: "wp" | "sp" | "residual"): string {
  if (s === "wp")  return "whole-plot error";
  if (s === "sp")  return "sub-plot error";
  return "residual";
}

export function MixedEffectsPanel({ obs, depthResolved, label, unit }: {
  obs: Observation[]; depthResolved: boolean; label: string; unit: string;
}) {
  const result: SplitPlotOutput | null = useMemo(() => {
    if (obs.length === 0) return null;
    return fitSplitPlotAnova({
      y:         obs.map(o => o.value),
      block:     obs.map(o => o.block),
      wholePlot: obs.map(o => o.genotype),
      subPlot:   obs.map(o => o.n_dose_kg_ha_yr),
      subSubPlot: depthResolved ? obs.map(o => o.depth_label ?? "") : undefined,
      names: { wholePlot: "genotype", subPlot: "dose", subSubPlot: "depth" },
    });
  }, [obs, depthResolved]);

  if (!result || result.anova.n === 0) {
    return <div className="muted">No data yet. Enter measurements in the Data entry tab.</div>;
  }

  return (
    <>
      <div className="row" style={{ flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div className="stat"><span className="stat-label">Design</span><span className="stat-value" style={{ fontSize: "1rem" }}>{result.design}</span></div>
        <div className="stat"><span className="stat-label">Model n</span><span className="stat-value">{result.anova.n}</span></div>
        <div className="stat"><span className="stat-label">Outcome</span><span className="stat-value" style={{ fontSize: "1rem" }}>{label}{unit ? ` (${unit})` : ""}</span></div>
      </div>

      <div style={{
        background: "var(--soil-04)",
        border: "1px solid var(--panel-border)",
        borderRadius: "var(--radius-control)",
        padding: "var(--space-3) var(--space-4)",
        marginBottom: 10,
      }}>
        <h2 className="card-title">Model</h2>
        <code className="mono">{result.formula}</code>
      </div>

      <h2 className="card-title" style={{ marginTop: 10 }}>F-tests with appropriate error strata</h2>
      <div style={{ overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Term</th><th>df</th><th>SS</th><th>MS</th><th>F</th><th>Error stratum</th><th>p</th><th>sig.</th>
            </tr>
          </thead>
          <tbody>
            {result.f_tests.map((t, i) => {
              const strat = result.stratum_for_term[t.term] ?? "residual";
              const isErrorRow = t.term.startsWith("block:") && t.term !== "block";
              return (
                <tr key={i} style={isErrorRow ? { color: "var(--text-muted)" } : undefined}>
                  <td className="mono">{t.term}{isErrorRow ? " (error stratum)" : ""}</td>
                  <td className="mono">{t.df}</td>
                  <td className="mono">{sig(t.ss)}</td>
                  <td className="mono">{sig(t.ms)}</td>
                  <td className="mono">{t.f === null ? "-" : sig(t.f)}</td>
                  <td className="mono">{isErrorRow ? "-" : stratumLabel(strat)}</td>
                  <td className="mono">{fmtP(t.p)}</td>
                  <td className="mono">{stars(t.p)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--panel-border-strong)" }}>
              <td className="mono"><strong>Residual</strong></td>
              <td className="mono">{result.anova.residual.df}</td>
              <td className="mono">{sig(result.anova.residual.ss)}</td>
              <td className="mono">{sig(result.anova.residual.ms)}</td>
              <td></td><td></td><td></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="card-title" style={{ marginTop: 14 }}>Variance components</h2>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Whole-plot</span>
          <span className="stat-value">{sig(result.variance_components.wholePlotError.value)}</span>
          <span className="stat-sub">{result.variance_components.wholePlotError.label}</span>
        </div>
        {result.variance_components.subPlotError && (
          <div className="stat">
            <span className="stat-label">Sub-plot</span>
            <span className="stat-value">{sig(result.variance_components.subPlotError.value)}</span>
            <span className="stat-sub">{result.variance_components.subPlotError.label}</span>
          </div>
        )}
        <div className="stat">
          <span className="stat-label">Residual</span>
          <span className="stat-value">{sig(result.variance_components.residual.value)}</span>
          <span className="stat-sub">{result.variance_components.residual.label}</span>
        </div>
      </div>

      <div className="muted" style={{ fontSize: "0.75rem", marginTop: 14, lineHeight: 1.6 }}>
        <strong>Note on interpretation.</strong> The F-tests above use the correct error strata for a split-{result.design === "split-split-plot" ? "split-" : ""}plot design with block as a random effect: {result.design === "split-split-plot"
          ? "genotype is tested against block x genotype; dose and genotype:dose are tested against block x genotype x dose; depth and its interactions are tested against residual."
          : "genotype is tested against block x genotype; dose and genotype:dose are tested against residual."
        } For balanced data, these F-tests are numerically equivalent to a REML mixed model with block as a random effect. Variance components shown are method-of-moments estimates, which also coincide with REML for balanced designs.
        <br/><br/>
        If you need unbalanced-data mixed models, lmerTest-style Satterthwaite df, or continuous covariates, export the CSVs and run <span className="mono">lme4::lmer()</span> externally; the data model is identical.
      </div>

      {result.warnings.length > 0 && (
        <div className="muted" style={{ fontSize: "0.75rem", marginTop: 8, color: "var(--ek-terracotta)" }}>
          {result.warnings.map((w, i) => <div key={i}>Warning: {w}</div>)}
        </div>
      )}
    </>
  );
}
