import type { ReactNode } from "react";

export interface ProtocolStat {
  label: string;
  value: string | number;
  hint?: string;
}

interface ProtocolLayoutProps {
  title: string;
  summary: string;
  purpose: string;
  timing: string;
  stats?: ProtocolStat[];
  gear: string[];
  steps: { label: string; detail?: string }[];
  qc: string[];
  figure: ReactNode;
  figureCaption: string;
}

export function ProtocolLayout({
  title,
  summary,
  purpose,
  timing,
  stats,
  gear,
  steps,
  qc,
  figure,
  figureCaption,
}: ProtocolLayoutProps) {
  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <h2 className="card-title">{title}</h2>
        <p className="protocol-summary">{summary}</p>
        <div className="protocol-meta">
          <div className="protocol-meta-cell">
            <span className="protocol-meta-label">Purpose</span>
            <span className="protocol-meta-value">{purpose}</span>
          </div>
          <div className="protocol-meta-cell">
            <span className="protocol-meta-label">Timing</span>
            <span className="protocol-meta-value">{timing}</span>
          </div>
        </div>
        {stats && stats.length > 0 && (
          <div className="protocol-stats">
            {stats.map((s, i) => (
              <div key={i} className="protocol-stat">
                <span className="protocol-stat-value">{s.value}</span>
                <span className="protocol-stat-label">{s.label}</span>
                {s.hint && <span className="protocol-stat-hint">{s.hint}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="protocol-grid">
        <div className="card">
          <h2 className="card-title">Procedure</h2>
          <ol className="protocol-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="protocol-step-label">{s.label}</span>
                {s.detail && <span className="protocol-step-detail">{s.detail}</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <h2 className="card-title">Visual guide</h2>
          <div className="protocol-figure">{figure}</div>
          <div className="protocol-figure-caption">{figureCaption}</div>
        </div>
      </div>

      <div className="protocol-grid">
        <div className="card">
          <h2 className="card-title">Equipment</h2>
          <ul className="protocol-list">
            {gear.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
        <div className="card">
          <h2 className="card-title">Quality control</h2>
          <ul className="protocol-list">
            {qc.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
