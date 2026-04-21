import { LayoutGrid, ClipboardList, BookOpen, Map, Edit3, BarChart3, UploadCloud } from "lucide-react";
import type { TabKey } from "./TabBar";

interface Props {
  active: TabKey;
  onChange: (k: TabKey) => void;
  pendingChanges: number;
}

const ITEMS: { key: TabKey; label: string; Icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Overview",   Icon: LayoutGrid },
  { key: "plan",     label: "Plan",       Icon: ClipboardList },
  { key: "protocol", label: "Protocol",   Icon: BookOpen },
  { key: "layout",   label: "Field",      Icon: Map },
  { key: "entry",    label: "Collect",    Icon: Edit3 },
  { key: "results",  label: "Results",    Icon: BarChart3 },
  { key: "sync",     label: "Sync",       Icon: UploadCloud },
];

export function BottomBar({ active, onChange, pendingChanges }: Props) {
  return (
    <nav className="bottom-bar" aria-label="Primary">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className="bottom-btn"
          data-active={active === key}
          onClick={() => onChange(key)}
          aria-current={active === key ? "page" : undefined}
        >
          <Icon className="icon" size={24} />
          <span>{label}</span>
          {key === "sync" && pendingChanges > 0 && (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: "calc(50% - 18px)",
                background: "var(--ek-terracotta)",
                color: "var(--ek-root)",
                borderRadius: 999,
                padding: "2px 6px",
                fontSize: "0.55rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {pendingChanges}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
