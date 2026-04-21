import { DEFAULT_PLAN, maxBdBlocks, type SamplingPlan } from "../types/plan";

const KEY = "mccs_sampling_plan_v1";

// Legacy shapes:
//   - `nBdRings`   : earliest field name (pre-rename to nBdPoints)
//   - `nBdPoints`  : previous field (number of plots sampled, 0..plots)
// Both are mapped to `nBdBlocks` (whole blocks, 0..nBlocks).
type LegacyPlan = Partial<SamplingPlan> & { nBdRings?: number; nBdPoints?: number };

export function loadPlan(): SamplingPlan {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PLAN };
    const parsed = JSON.parse(raw) as LegacyPlan;
    const { nBdRings, nBdPoints, ...rest } = parsed;
    const merged: SamplingPlan = {
      ...DEFAULT_PLAN,
      ...rest,
    };
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

export function savePlan(plan: SamplingPlan): void {
  localStorage.setItem(KEY, JSON.stringify(plan));
}

export function resetPlan(): SamplingPlan {
  localStorage.removeItem(KEY);
  return { ...DEFAULT_PLAN };
}
