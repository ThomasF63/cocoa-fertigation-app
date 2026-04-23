// Sample-ID generation. Matches data/build_data_templates.js exactly.

import type { Plot } from "../types/design";
import type { SoilSample, BDRing } from "../types/samples";
import { DEFAULT_PLAN, type SamplingPlan } from "../types/plan";

export function soilSampleId(plot_id: string, depthCode: string): string {
  return `${plot_id}_${depthCode}`;
}

export function bdRingId(ringNumber: number, depthCode: string): string {
  return `BD${String(ringNumber).padStart(2, "0")}_${depthCode}`;
}

export function generateSoilSamples(plots: Plot[], plan: SamplingPlan = DEFAULT_PLAN): SoilSample[] {
  const out: SoilSample[] = [];
  for (const p of plots) {
    for (const d of plan.depths) {
      out.push({
        sample_id: soilSampleId(p.plot_id, d.code),
        plot_id: p.plot_id,
        depth_label: d.label,
        depth_top_cm: d.top,
        depth_bottom_cm: d.bottom,
      });
    }
  }
  return out;
}

export function generateBDRingStubs(plan: SamplingPlan = DEFAULT_PLAN): BDRing[] {
  const out: BDRing[] = [];
  const cells = plan.genotypes.length * plan.doses.length;
  const bdBlocks = Math.max(0, Math.min(plan.nBdBlocks, plan.nBlocks));
  const nPoints = bdBlocks * cells;
  for (let i = 1; i <= nPoints; i++) {
    for (const d of plan.bdRingDepths) {
      out.push({
        ring_id: bdRingId(i, d.code),
        depth_label: d.label,
        depth_top_cm: d.top,
        depth_bottom_cm: d.bottom,
      });
    }
  }
  return out;
}

