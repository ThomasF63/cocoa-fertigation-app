import { useCallback, useEffect, useState } from "react";
import { maxBdBlocks, type SamplingPlan } from "../types/plan";
import { loadPlan, savePlan, resetPlan, PLAN_CHANGE_EVENT } from "../utils/planStorage";

export function usePlan() {
  const [plan, setPlan] = useState<SamplingPlan>(loadPlan);

  useEffect(() => {
    const refresh = () => setPlan(loadPlan());
    window.addEventListener(PLAN_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PLAN_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const update = useCallback((partial: Partial<SamplingPlan>) => {
    setPlan(prev => {
      const next = { ...prev, ...partial };
      const bdMax = maxBdBlocks(next);
      if (next.nBdBlocks > bdMax) next.nBdBlocks = bdMax;
      savePlan(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPlan(resetPlan());
  }, []);

  return { plan, update, reset };
}
