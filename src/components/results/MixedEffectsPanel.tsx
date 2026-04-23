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

function sigClass(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "";
  if (p < 0.001) return "sig-strong";
  if (p < 0.01)  return "sig-med";
  if (p < 0.05)  return "sig-weak";
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
      <div className="inline-stats mono">
        <span>{result.design}</span>
        <span><em>n</em> = {result.anova.n}</span>
        <span className="muted">{label}{unit ? ` (${unit})` : ""}</span>
        <span className="muted" style={{ flex: "1 1 100%" }}>
          <code className="mono">{result.formula}</code>
        </span>
      </div>

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
                <tr
                  key={i}
                  className={isErrorRow ? "" : sigClass(t.p)}
                  style={isErrorRow ? { color: "var(--text-muted)" } : undefined}
                >
                  <td className="mono">{t.term}{isErrorRow ? " (error stratum)" : ""}</td>
                  <td className="mono">{t.df}</td>
                  <td className="mono">{sig(t.ss)}</td>
                  <td className="mono">{sig(t.ms)}</td>
                  <td className="mono">{t.f === null ? "-" : sig(t.f)}</td>
                  <td className="mono">{isErrorRow ? "-" : stratumLabel(strat)}</td>
                  <td className="mono sig-pcell">{fmtP(t.p)}</td>
                  <td className="mono sig-stars">{stars(t.p)}</td>
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

      <div className="variance-row mono">
        <span className="var-label">Variance components:</span>
        <span><strong>whole-plot</strong> {sig(result.variance_components.wholePlotError.value)}</span>
        {result.variance_components.subPlotError && (
          <span><strong>sub-plot</strong> {sig(result.variance_components.subPlotError.value)}</span>
        )}
        <span><strong>residual</strong> {sig(result.variance_components.residual.value)}</span>
      </div>

      <div className="muted caption">
        Correct error strata for split-{result.design === "split-split-plot" ? "split-" : ""}plot with block as random: {result.design === "split-split-plot"
          ? "genotype vs block×genotype; dose and genotype:dose vs block×genotype×dose; depth and its interactions vs residual."
          : "genotype vs block×genotype; dose and genotype:dose vs residual."
        } For balanced data these F-tests match <span className="mono">lmer</span> REML; variance components are method-of-moments (≡ REML when balanced).
      </div>

      {result.warnings.length > 0 && (
        <div className="muted" style={{ fontSize: "0.75rem", marginTop: 8, color: "var(--ek-terracotta)" }}>
          {result.warnings.map((w, i) => <div key={i}>Warning: {w}</div>)}
        </div>
      )}
    </>
  );
}
