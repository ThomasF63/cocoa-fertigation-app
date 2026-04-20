export type TabKey = "overview" | "layout" | "entry" | "results" | "sync";

interface Props {
  active: TabKey;
  onChange: (k: TabKey) => void;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "layout",   label: "Layout" },
  { key: "entry",    label: "Data entry" },
  { key: "results",  label: "Results" },
  { key: "sync",     label: "Sync" },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Sections">
      {TABS.map(t => (
        <button
          key={t.key}
          className="tab-btn"
          data-active={active === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
