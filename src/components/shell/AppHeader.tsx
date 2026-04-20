import { Menu, Sun, Moon } from "lucide-react";

interface Props {
  onToggleSidebar: () => void;
  onToggleContrast: () => void;
  contrastOn: boolean;
  pendingChanges: number;
}

export function AppHeader({ onToggleSidebar, onToggleContrast, contrastOn, pendingChanges }: Props) {
  return (
    <header className="header">
      <button className="sidebar-toggle-btn" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
        <Menu size={16} />
      </button>
      <span className="header-title">MCCS Fertigation</span>
      <span className="header-sub">Phase 2 paper, field + lab</span>
      <span className="header-spacer" />
      {pendingChanges > 0 && (
        <span className="badge terracotta" title="Unsynced changes">
          {pendingChanges} pending
        </span>
      )}
      <button
        className="sidebar-toggle-btn"
        aria-label="High contrast"
        onClick={onToggleContrast}
        title={contrastOn ? "Normal contrast" : "High contrast (outdoor)"}
      >
        {contrastOn ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </header>
  );
}
