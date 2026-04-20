import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/shell/AppHeader";
import { Sidebar } from "./components/shell/Sidebar";
import { TabBar, type TabKey } from "./components/shell/TabBar";
import { BottomBar } from "./components/shell/BottomBar";
import { OverviewTab } from "./components/overview/OverviewTab";
import { LayoutTab } from "./components/layout/LayoutTab";
import { EntryTab } from "./components/entry/EntryTab";
import { ResultsTab } from "./components/results/ResultsTab";
import { SyncTab } from "./components/io/SyncTab";

export default function App() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [highContrast]);

  const panel = useMemo(() => {
    switch (tab) {
      case "overview": return <OverviewTab onPendingChange={setPendingChanges} onLastSync={setLastSync} />;
      case "layout":   return <LayoutTab />;
      case "entry":    return <EntryTab />;
      case "results":  return <ResultsTab />;
      case "sync":     return <SyncTab onSynced={(n) => { setPendingChanges(0); setLastSync(n); }} pendingChanges={pendingChanges} lastSync={lastSync} />;
    }
  }, [tab, pendingChanges, lastSync]);

  return (
    <div className="app-shell">
      <AppHeader
        onToggleSidebar={() => setSidebarCollapsed(c => !c)}
        onToggleContrast={() => setHighContrast(c => !c)}
        contrastOn={highContrast}
        pendingChanges={pendingChanges}
      />
      <div className="app-body">
        <Sidebar collapsed={sidebarCollapsed} pendingChanges={pendingChanges} lastSync={lastSync} />
        <main className="app-main">
          <TabBar active={tab} onChange={setTab} />
          <div className="tab-panel">{panel}</div>
        </main>
      </div>
      <BottomBar active={tab} onChange={setTab} pendingChanges={pendingChanges} />
    </div>
  );
}
