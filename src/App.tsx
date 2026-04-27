import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";

class TabErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* error already in state */ }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ margin: 16 }}>
          <h2 className="card-title" style={{ color: "var(--ek-terracotta)" }}>Something went wrong</h2>
          <div className="muted" style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            {(this.state.error as Error).message}
          </div>
          <button className="btn primary" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Back to Overview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { AppHeader } from "./components/shell/AppHeader";
import { Sidebar } from "./components/shell/Sidebar";
import { TabBar, type TabKey } from "./components/shell/TabBar";
import { BottomBar } from "./components/shell/BottomBar";
import { OverviewTab } from "./components/overview/OverviewTab";
import { PlanTab } from "./components/plan/PlanTab";
import { ProtocolTab } from "./components/protocol/ProtocolTab";
import { LayoutTab } from "./components/layout/LayoutTab";
import { EntryTab } from "./components/entry/EntryTab";
import { ResultsTab } from "./components/results/ResultsTab";
import { SyncTab } from "./components/io/SyncTab";
import { useMediaQuery, NARROW_OR_TOUCH_QUERY } from "./hooks/useMediaQuery";

export type Theme = "light" | "dark" | "contrast";
const THEME_ORDER: Theme[] = ["light", "dark", "contrast"];
const THEME_KEY = "mccs.theme";

const SCALE_KEY = "mccs.uiScale";
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.4;
const SCALE_STEP = 0.1;
const SCALE_DEFAULT = 1;

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "contrast") return stored;
  return "light";
}

function loadScale(): number {
  const stored = Number(localStorage.getItem(SCALE_KEY));
  if (!Number.isFinite(stored) || stored < SCALE_MIN || stored > SCALE_MAX) return SCALE_DEFAULT;
  return stored;
}

function clampScale(s: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(s * 10) / 10));
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(NARROW_OR_TOUCH_QUERY).matches;
  });
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [uiScale, setUiScale] = useState<number>(loadScale);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const isNarrow = useMediaQuery(NARROW_OR_TOUCH_QUERY);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    localStorage.setItem(SCALE_KEY, String(uiScale));
  }, [uiScale]);

  const cycleTheme = () => {
    setTheme(t => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);
  };

  const zoomIn  = () => setUiScale(s => clampScale(s + SCALE_STEP));
  const zoomOut = () => setUiScale(s => clampScale(s - SCALE_STEP));
  const zoomReset = () => setUiScale(SCALE_DEFAULT);

  const toggleSidebar = () => {
    if (isNarrow) {
      setSidebarCollapsed(c => !c);
      return;
    }
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

  const panel = useMemo(() => {
    switch (tab) {
      case "overview": return <OverviewTab onPendingChange={setPendingChanges} onLastSync={setLastSync} />;
      case "plan":     return <PlanTab />;
      case "protocol": return <ProtocolTab />;
      case "layout":   return <LayoutTab />;
      case "entry":    return <EntryTab />;
      case "results":  return <ResultsTab />;
      case "sync":     return <SyncTab onSynced={(n) => { setPendingChanges(0); setLastSync(n); }} pendingChanges={pendingChanges} lastSync={lastSync} />;
    }
  }, [tab, pendingChanges, lastSync]);

  const mainContent = (
    <main className="app-main">
      <TabBar active={tab} onChange={setTab} />
      <TabErrorBoundary key={tab} onReset={() => setTab("overview")}>
        <div className="tab-panel">{panel}</div>
      </TabErrorBoundary>
    </main>
  );

  return (
    <div className="app-shell">
      <div className="ios-status-fill" aria-hidden="true" />
      <AppHeader
        onToggleSidebar={toggleSidebar}
        onCycleTheme={cycleTheme}
        theme={theme}
        pendingChanges={pendingChanges}
        uiScale={uiScale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        zoomInDisabled={uiScale >= SCALE_MAX - 1e-9}
        zoomOutDisabled={uiScale <= SCALE_MIN + 1e-9}
      />
      <div className="app-body">
        {isNarrow ? (
          <>
            {!sidebarCollapsed && (
              <div className="sidebar-backdrop" onClick={() => setSidebarCollapsed(true)} />
            )}
            <Sidebar collapsed={sidebarCollapsed} pendingChanges={pendingChanges} lastSync={lastSync} />
            {mainContent}
          </>
        ) : (
          <PanelGroup direction="horizontal" autoSaveId="mccs.shell.split">
            <Panel
              ref={sidebarPanelRef}
              id="sidebar"
              order={1}
              defaultSize={22}
              minSize={14}
              maxSize={42}
              collapsible
              collapsedSize={0}
              onCollapse={() => setSidebarCollapsed(true)}
              onExpand={() => setSidebarCollapsed(false)}
              className="shell-panel-sidebar"
            >
              <Sidebar collapsed={sidebarCollapsed} pendingChanges={pendingChanges} lastSync={lastSync} />
            </Panel>
            <PanelResizeHandle className="resize-handle" aria-label="Resize sidebar" />
            <Panel id="main" order={2} minSize={40} className="shell-panel-main">
              {mainContent}
            </Panel>
          </PanelGroup>
        )}
      </div>
      <BottomBar active={tab} onChange={setTab} pendingChanges={pendingChanges} />
    </div>
  );
}
