import { Menu, Sun, Moon, Contrast, ZoomIn, ZoomOut } from "lucide-react";
import type { Theme } from "../../App";

interface Props {
  onToggleSidebar: () => void;
  onCycleTheme: () => void;
  theme: Theme;
  pendingChanges: number;
  uiScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  zoomInDisabled: boolean;
  zoomOutDisabled: boolean;
}

const THEME_META: Record<Theme, { icon: typeof Sun; label: string; next: Theme }> = {
  light:    { icon: Sun,      label: "Light",         next: "dark" },
  dark:     { icon: Moon,     label: "Dark",          next: "contrast" },
  contrast: { icon: Contrast, label: "High contrast", next: "light" },
};

export function AppHeader({
  onToggleSidebar, onCycleTheme, theme, pendingChanges,
  uiScale, onZoomIn, onZoomOut, onZoomReset, zoomInDisabled, zoomOutDisabled,
}: Props) {
  const meta = THEME_META[theme];
  const Icon = meta.icon;
  const scalePct = Math.round(uiScale * 100);
  return (
    <header className="header">
      <button className="sidebar-toggle-btn" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
        <Menu size={20} />
      </button>
      <h1 className="header-title" style={{ margin: 0 }}>MCCS Fertigation</h1>
      <span className="header-sub">Phase 2 paper, field + lab</span>
      <span className="header-spacer" />
      {pendingChanges > 0 && (
        <span className="badge terracotta" title="Unsynced changes">
          {pendingChanges} pending
        </span>
      )}
      <div className="zoom-group" role="group" aria-label="UI scale">
        <button
          className="sidebar-toggle-btn"
          aria-label="Decrease UI scale"
          title="Decrease UI scale"
          onClick={onZoomOut}
          disabled={zoomOutDisabled}
        >
          <ZoomOut size={18} />
        </button>
        <button
          className="sidebar-toggle-btn zoom-readout mono"
          aria-label={`UI scale ${scalePct}%. Click to reset.`}
          title="Reset UI scale"
          onClick={onZoomReset}
        >
          {scalePct}%
        </button>
        <button
          className="sidebar-toggle-btn"
          aria-label="Increase UI scale"
          title="Increase UI scale"
          onClick={onZoomIn}
          disabled={zoomInDisabled}
        >
          <ZoomIn size={18} />
        </button>
      </div>
      <button
        className="sidebar-toggle-btn"
        aria-label={`Theme: ${meta.label}. Click for ${THEME_META[meta.next].label}.`}
        onClick={onCycleTheme}
        title={`Theme: ${meta.label} → ${THEME_META[meta.next].label}`}
      >
        <Icon size={20} />
      </button>
    </header>
  );
}
