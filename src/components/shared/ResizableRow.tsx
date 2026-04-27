import type { CSSProperties, ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useMediaQuery } from "../../hooks/useMediaQuery";

// Horizontal two-pane split with a draggable handle. On phones (≤768 px) it
// falls back to a flex-wrap stack. On wider screens — including touch tablets —
// it renders a react-resizable-panels PanelGroup with a finger-friendly handle;
// position is persisted per autoSaveId.
export function ResizableRow({
  autoSaveId,
  left,
  right,
  defaultSize = 50,
  minSize = 25,
  flexBasis = "360px",
  gap = 14,
}: {
  autoSaveId: string;
  left: ReactNode;
  right: ReactNode;
  defaultSize?: number;
  minSize?: number;
  flexBasis?: string;
  gap?: number;
}) {
  const isNarrow = useMediaQuery("(max-width: 768px)");
  if (isNarrow) {
    return (
      <div className="row" style={{ gap, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ flex: `1 1 ${flexBasis}`, minWidth: 0, display: "flex" }}>{left}</div>
        <div style={{ flex: `1 1 ${flexBasis}`, minWidth: 0, display: "flex" }}>{right}</div>
      </div>
    );
  }
  const paneStyle: CSSProperties = {
    display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0,
    width: "100%", height: "100%",
  };
  return (
    <PanelGroup direction="horizontal" autoSaveId={autoSaveId}>
      <Panel defaultSize={defaultSize} minSize={minSize}>
        <div style={paneStyle}>{left}</div>
      </Panel>
      <PanelResizeHandle className="resize-handle" aria-label="Resize panels" />
      <Panel defaultSize={100 - defaultSize} minSize={minSize}>
        <div style={paneStyle}>{right}</div>
      </Panel>
    </PanelGroup>
  );
}
