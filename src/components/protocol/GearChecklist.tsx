import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { SamplingPlan } from "../../types/plan";
import { treeGear } from "./TreeProtocol";
import { soilGear } from "./SoilProtocol";
import { bdGear } from "./BulkDensityProtocol";

interface Section {
  title: string;
  items: string[];
}

function buildSections(plan: SamplingPlan): Section[] {
  const sections: Section[] = [
    { title: "Tree measurements", items: treeGear(plan) },
  ];
  if (plan.depths.length > 0) {
    sections.push({ title: "Soil compositing", items: soilGear(plan) });
  }
  if (plan.nBdBlocks > 0 && plan.bdRingDepths.length > 0) {
    sections.push({ title: "Bulk density", items: bdGear(plan) });
  }
  return sections;
}

export function GearChecklist({ plan }: { plan: SamplingPlan }) {
  const sections = buildSections(plan);
  const totalCount = sections.reduce((n, s) => n + s.items.length, 0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const doneCount = checked.size;
  const allDone = doneCount === totalCount && totalCount > 0;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>Equipment checklist</h2>
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: 3 }}>
            {allDone
              ? "All items checked — ready to go."
              : `${doneCount} / ${totalCount} checked`}
          </div>
        </div>
        <button
          onClick={() => setChecked(new Set())}
          title="Uncheck all"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 10px",
            fontFamily: "var(--font-family)", fontSize: "0.74rem",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--panel-border-strong)",
            borderRadius: "var(--radius-control)",
            cursor: "pointer",
          }}
        >
          <RotateCcw size={12} strokeWidth={2} />
          Reset
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, borderRadius: 2,
        background: "var(--panel-border)",
        marginBottom: 18, overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%",
          background: allDone ? "var(--ek-stem)" : "var(--ek-soil)",
          borderRadius: 2,
          transition: "width 0.18s ease",
        }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {sections.map((section, si) => (
          <div key={si}>
            <div style={{
              fontSize: "0.68rem", fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--text-secondary)", marginBottom: 6,
            }}>
              {section.title}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {section.items.map((item, ii) => {
                const key = `${si}-${ii}`;
                const isChecked = checked.has(key);
                return (
                  <li key={key} style={{ borderBottom: "1px solid var(--panel-border)" }}>
                    <label style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "7px 2px", cursor: "pointer",
                    }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(key)}
                        style={{ marginTop: 2, accentColor: "var(--ek-soil)", flexShrink: 0 }}
                      />
                      <span style={{
                        fontSize: "0.84rem",
                        color: isChecked ? "var(--text-muted)" : "var(--text-primary)",
                        textDecoration: isChecked ? "line-through" : "none",
                        transition: "color 0.12s",
                      }}>
                        {item}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
