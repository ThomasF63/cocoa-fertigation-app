import { useMemo } from "react";
import { fitAnova, type AnovaInput } from "../../engine/anova";
import { sig } from "../../engine/statsEngine";
import type { Observation } from "../../engine/variables";

/** Pretty one-character sig stars for p. */
function stars(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01)  return "**";
  if (p < 0.05)  return "*";
  if (p < 0.1)   return ".";
  return "";
}

/** Row class keying background intensity to significance (p < 0.05 threshold). */
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

export function AnovaTable({ obs, depthResolved, label, unit }: {
  obs: Observation[]; depthResolved: boolean; label: string; unit: string;
}) {
  const result = useMemo(() => {
    if (obs.length === 0) return null;

    const input: AnovaInput = depthResolved
      ? {
          y: obs.map(o => o.value),
          factors: {
            block:    obs.map(o => o.block),
            genotype: obs.map(o => o.genotype),
            dose:     obs.map(o => o.n_dose_kg_ha_yr),
            depth:    obs.map(o => o.depth_label ?? ""),
          },
          terms: [
            "block",
            "genotype", "dose", "depth",
            "genotype:dose", "genotype:depth", "dose:depth",
            "genotype:dose:depth",
          ],
        }
      : {
          y: obs.map(o => o.value),
          factors: {
            block:    obs.map(o => o.block),
            genotype: obs.map(o => o.genotype),
            dose:     obs.map(o => o.n_dose_kg_ha_yr),
          },
          terms: ["block", "genotype", "dose", "genotype:dose"],
        };

    return fitAnova(input);
  }, [obs, depthResolved]);

  if (!result || result.n === 0) {
    return <div className="muted">No data yet. Enter measurements in the Data entry tab.</div>;
  }

  return (
    <>
      <div className="inline-stats mono">
        <span><em>n</em> = {result.n}</span>
        <span>R<sup>2</sup> = {sig(result.r_squared)}</span>
        <span>df<sub>res</sub> = {result.residual.df}</span>
        <span className="muted">{label}{unit ? ` (${unit})` : ""}</span>
      </div>

      <div style={{ overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Term</th><th>df</th><th>SS</th><th>MS</th><th>F</th><th>p</th><th>sig.</th>
            </tr>
          </thead>
          <tbody>
            {result.terms.map((t, i) => (
              <tr key={i} className={sigClass(t.p)}>
                <td className="mono">{t.term}</td>
                <td className="mono">{t.df}</td>
                <td className="mono">{sig(t.ss)}</td>
                <td className="mono">{sig(t.ms)}</td>
                <td className="mono">{t.f === null ? "-" : sig(t.f)}</td>
                <td className="mono sig-pcell">{fmtP(t.p)}</td>
                <td className="mono sig-stars">{stars(t.p)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--panel-border-strong)" }}>
              <td className="mono"><strong>Residual</strong></td>
              <td className="mono">{result.residual.df}</td>
              <td className="mono">{sig(result.residual.ss)}</td>
              <td className="mono">{sig(result.residual.ms)}</td>
              <td className="mono">-</td><td className="mono">-</td><td></td>
            </tr>
            <tr>
              <td className="mono"><strong>Total</strong></td>
              <td className="mono">{result.total.df}</td>
              <td className="mono">{sig(result.total.ss)}</td>
              <td></td><td></td><td></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="muted caption">
        Sequential Type I ANOVA, treatment contrasts; block and treatment factors <em>fixed</em>. Switch to <strong>Mixed effects</strong> for block-as-random inference with correct error strata. Sig. codes: <span className="mono">***</span> p&lt;0.001, <span className="mono">**</span> p&lt;0.01, <span className="mono">*</span> p&lt;0.05, <span className="mono">.</span> p&lt;0.1.
      </div>

      {result.warnings.length > 0 && (
        <div className="muted" style={{ fontSize: "0.75rem", marginTop: 8, color: "var(--ek-terracotta)" }}>
          {result.warnings.map((w, i) => <div key={i}>Warning: {w}</div>)}
        </div>
      )}
    </>
  );
}
