interface Props {
  collapsed: boolean;
  pendingChanges: number;
  lastSync: string | null;
}

export function Sidebar({ collapsed, pendingChanges, lastSync }: Props) {
  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sidebar-section" data-accent="soil">
        <h3>Trial</h3>
        <div className="sidebar-row"><span className="label">Site</span><span className="value">MCCS Bahia</span></div>
        <div className="sidebar-row"><span className="label">Blocks</span><span className="value">8</span></div>
        <div className="sidebar-row"><span className="label">Genotypes</span><span className="value">CCN 51 / PS 13.19</span></div>
        <div className="sidebar-row"><span className="label">N doses</span><span className="value">56 / 226 / 340</span></div>
        <div className="sidebar-row"><span className="label">Plots</span><span className="value">48</span></div>
      </div>

      <div className="sidebar-section" data-accent="stem">
        <h3>Field campaign</h3>
        <div className="sidebar-row"><span className="label">Window</span><span className="value">3 to 4 days</span></div>
        <div className="sidebar-row"><span className="label">Soil samples</span><span className="value">192</span></div>
        <div className="sidebar-row"><span className="label">BD rings</span><span className="value">64</span></div>
        <div className="sidebar-row"><span className="label">Tree meas.</span><span className="value">576</span></div>
        <div className="sidebar-row"><span className="label">Leaf comp.</span><span className="value">48</span></div>
      </div>

      <div className="sidebar-section" data-accent="terracotta">
        <h3>Sync status</h3>
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Pending</span>
            <span className="metric-value">{pendingChanges}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Last sync</span>
            <span className="metric-value" style={{ fontSize: "0.8rem" }}>{lastSync ?? "never"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
