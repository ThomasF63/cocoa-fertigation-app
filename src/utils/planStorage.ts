import {
  DEFAULT_LAB_ANALYSES,
  DEFAULT_PLAN,
  maxBdBlocks,
  type LabAnalysisState,
  type SamplingPlan,
} from "../types/plan";

const KEY = "mccs_sampling_plan_v1";

// Legacy shapes:
//   - `nBdRings`   : earliest field name (pre-rename to nBdPoints)
//   - `nBdPoints`  : previous field (number of plots sampled, 0..plots)
//   - `labAnalyses.cn` : combined SOC+TN line, now split into `soc` + `tn`
type LegacyPlan = Partial<SamplingPlan> & {
  nBdRings?: number;
  nBdPoints?: number;
  labAnalyses?: Record<string, LabAnalysisState>;
};

export function loadPlan(): SamplingPlan {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PLAN };
    const parsed = JSON.parse(raw) as LegacyPlan;
    const { nBdRings, nBdPoints, ...rest } = parsed;
    const merged: SamplingPlan = {
      ...DEFAULT_PLAN,
      ...rest,
      labAnalyses: { ...DEFAULT_LAB_ANALYSES, ...(rest.labAnalyses as Record<string, LabAnalysisState> | undefined) } as SamplingPlan["labAnalyses"],
      customLabAnalyses: Array.isArray(rest.customLabAnalyses) ? rest.customLabAnalyses : [],
    };

    // Migrate legacy `cn` (combined SOC + TN) → split `soc` + `tn` 50/50.
    const legacyLab: Record<string, LabAnalysisState> = rest.labAnalyses ?? {};
    const cn = legacyLab.cn;
    if (cn && legacyLab.soc == null && legacyLab.tn == null) {
      const halfLow = Math.round(cn.costLowUsd / 2);
      const halfHigh = Math.round(cn.costHighUsd / 2);
      merged.labAnalyses.soc = { enabled: cn.enabled, costLowUsd: halfLow, costHighUsd: halfHigh };
      merged.labAnalyses.tn  = { enabled: cn.enabled, costLowUsd: cn.costLowUsd - halfLow, costHighUsd: cn.costHighUsd - halfHigh };
    }
    delete (merged.labAnalyses as Record<string, LabAnalysisState>).cn;

    if (rest.nBdBlocks == null) {
      const legacyPoints = nBdPoints ?? nBdRings;
      if (legacyPoints != null) {
        const cells = Math.max(1, merged.genotypes.length * merged.doses.length);
        merged.nBdBlocks = Math.floor(legacyPoints / cells);
      } else {
        merged.nBdBlocks = DEFAULT_PLAN.nBdBlocks;
      }
    }
    merged.nBdBlocks = Math.max(0, Math.min(merged.nBdBlocks, maxBdBlocks(merged)));
    return merged;
  } catch {
    return { ...DEFAULT_PLAN };
  }
}

export const PLAN_CHANGE_EVENT = "mccs:plan-change";

export function savePlan(plan: SamplingPlan): void {
  localStorage.setItem(KEY, JSON.stringify(plan));
  window.dispatchEvent(new CustomEvent(PLAN_CHANGE_EVENT));
}

export function resetPlan(): SamplingPlan {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(PLAN_CHANGE_EVENT));
  return { ...DEFAULT_PLAN };
}
