import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, Maximize2, MousePointer2, ZoomIn, ZoomOut } from "lucide-react";
import { computeFieldLayout, type FieldLayout, type PlotLayoutCell } from "../../engine/layoutEngine";
import { getAll } from "../../db/repo";
import type { Plot } from "../../types/design";
import { usePlan } from "../../hooks/usePlan";
import type { SamplingPlan } from "../../types/plan";
import {
  GENOTYPE_FILL,
  GENOTYPE_STROKE,
  DOSE_STROKE_WIDTH,
  DOSE_LABEL,
  TOKENS,
} from "../../utils/palette";
import {
  SoilMark, BdMark, NminMark, TreeMark, SAMPLE_SOIL_COLOR,
} from "../shared/SampleShapes";

const CHART_FONT_MONO = "'Azeret Mono', ui-monospace, Menlo, Consolas, monospace";

type ViewMode = "trees" | "sampling";

// ── Sampling overlay ──────────────────────────────────────────────────────────
// Colour + shape tokens mirror the Design Overview (PlanTab):
//   soil → filled square (left stack, one per depth)
//   BD   → open ring     (right stack, one per BD depth)
//   Nmin → plus          (bottom row)
const IND_BD = TOKENS.slate;

// Internal layout within each full-size plot (plotW = 120, plotH = 240).
// Soil/BD marker stacks sit just below the plot label on the left/right
// margins, outside the 6×2 tree grid. N-min marker sits above the
// plot's bottom edge.
const LAYOUT_STACK_AREA_TOP = 44;
const LAYOUT_STACK_AREA_H = 42;
const LAYOUT_BOTTOM_MARGIN = 10;
const LAYOUT_SIDE_INSET = 10;
const LAYOUT_MARKER_R = 5;
const LAYOUT_MARKER_GAP = 11;
const LAYOUT_BOTTOM_R = 5.5;
const LAYOUT_BOTTOM_SPACING = 16;

function PlotSampleMarkers({
  x, y, w, h, plan, bdActive,
}: {
  x: number; y: number; w: number; h: number;
  plan: SamplingPlan; bdActive: boolean;
}) {
  const nSoil = plan.depths.length;
  const nBd = plan.bdRingDepths.length;
  const soilStackH = Math.max(0, nSoil - 1) * LAYOUT_MARKER_GAP;
  const bdStackH = Math.max(0, nBd - 1) * LAYOUT_MARKER_GAP;
  const soilStartY = y + LAYOUT_STACK_AREA_TOP + (LAYOUT_STACK_AREA_H - soilStackH) / 2;
  const bdStartY = y + LAYOUT_STACK_AREA_TOP + (LAYOUT_STACK_AREA_H - bdStackH) / 2;
  const bottomCy = y + h - LAYOUT_BOTTOM_MARGIN;

  const bottomMarks: "nmin"[] = [];
  if (plan.includeNmin) bottomMarks.push("nmin");

  return (
    <g pointerEvents="none">
      {Array.from({ length: nSoil }).map((_, di) => (
        <SoilMark key={`s-${di}`}
          cx={x + LAYOUT_SIDE_INSET}
          cy={soilStartY + di * LAYOUT_MARKER_GAP}
          r={LAYOUT_MARKER_R} />
      ))}
      {bdActive && Array.from({ length: nBd }).map((_, di) => (
        <BdMark key={`b-${di}`}
          cx={x + w - LAYOUT_SIDE_INSET}
          cy={bdStartY + di * LAYOUT_MARKER_GAP}
          r={LAYOUT_MARKER_R}
          strokeWidth={1.6} />
      ))}
      {bottomMarks.map((m, di) => {
        const cx = x + w / 2 + (di - (bottomMarks.length - 1) / 2) * LAYOUT_BOTTOM_SPACING;
        return <NminMark key={m} cx={cx} cy={bottomCy} r={LAYOUT_BOTTOM_R} strokeWidth={1.8} />;
      })}
    </g>
  );
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.4;
const WHEEL_ZOOM_FACTOR = 1.12;
const DRAG_THRESHOLD_PX = 6;
const VIEWBOX_PAD = 10;

type Tool = "pan" | "select";

export function LayoutTab() {
  const [layout, setLayout] = useState<FieldLayout | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("trees");
  const [tool, setTool] = useState<Tool>("pan");
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Dynamic viewBox height so the SVG fills the container's aspect exactly
  // (width always == layout.width + 2*VIEWBOX_PAD; height tracks container).
  const [vbH, setVbH] = useState<number | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltip, setTooltip] = useState<
    { plot: PlotLayoutCell; x: number; y: number } | null
  >(null);
  const { plan } = usePlan();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | {
        startX: number;
        startY: number;
        initPanX: number;
        initPanY: number;
        moved: boolean;
        // True when this gesture was initiated as a pan (space, middle-click,
        // or Pan tool) — suppresses plot click even if below drag threshold.
        panOnly: boolean;
      }
    | null
  >(null);
  // Remembers whether the *just-ended* gesture was a pan, so onClick (which
  // fires after pointerup) can still distinguish drag-end from a real click.
  const lastGestureRef = useRef<{ moved: boolean; panOnly: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getAll<Plot>("plots");
      setPlots(p);
      if (p.length > 0) setLayout(computeFieldLayout(p));
    })();
  }, []);

  // Track container aspect so the viewBox matches it exactly. This is what
  // makes the map fill the full available width — with a fixed viewBox and
  // preserveAspectRatio=meet the browser would otherwise letterbox the
  // portrait map inside a landscape container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw <= 0 || ch <= 0 || !layout) return;
      const vbW = layout.width + 2 * VIEWBOX_PAD;
      setVbH(vbW * (ch / cw));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  // Space-held temporarily switches the cursor to pan. Only active when the
  // focus isn't in a text input / textarea.
  useEffect(() => {
    function isTextTarget(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (isTextTarget(document.activeElement)) return;
      e.preventDefault();
      setSpaceHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      setSpaceHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Fit-all: scale + pan so the whole layout is centered inside the viewBox.
  const fitAll = useCallback(() => {
    if (!layout || vbH == null) return;
    const vbW = layout.width + 2 * VIEWBOX_PAD;
    const mapW = layout.width;
    const mapH = layout.height;
    const s = Math.min((vbW - 2 * VIEWBOX_PAD) / mapW, (vbH - 2 * VIEWBOX_PAD) / mapH);
    const px = (vbW - s * mapW) / 2 - VIEWBOX_PAD;
    const py = (vbH - s * mapH) / 2 - VIEWBOX_PAD;
    setScale(s);
    setPan({ x: px, y: py });
  }, [layout, vbH]);

  // Fit-all on first render (once both layout and vbH are known).
  const firstFitRef = useRef(false);
  useEffect(() => {
    if (!firstFitRef.current && layout && vbH != null) {
      firstFitRef.current = true;
      fitAll();
    }
  }, [layout, vbH, fitAll]);

  function switchMode(m: ViewMode) {
    setViewMode(m);
  }

  function clampScale(s: number) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  }

  function zoomAround(
    factor: number,
    anchor?: { x: number; y: number },
  ) {
    if (!layout || vbH == null) return;
    const newScale = clampScale(scale * factor);
    if (newScale === scale) return;
    const vbW = layout.width + 2 * VIEWBOX_PAD;
    const ax = anchor?.x ?? vbW / 2 - VIEWBOX_PAD;
    const ay = anchor?.y ?? vbH / 2 - VIEWBOX_PAD;
    const ratio = newScale / scale;
    setPan({
      x: ax - ratio * (ax - pan.x),
      y: ay - ratio * (ay - pan.y),
    });
    setScale(newScale);
  }

  function screenToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg || !layout || vbH == null) return null;
    const rect = svg.getBoundingClientRect();
    const vbW = layout.width + 2 * VIEWBOX_PAD;
    const k = rect.width / vbW;
    if (k <= 0) return null;
    return {
      x: (clientX - rect.left) / k - VIEWBOX_PAD,
      y: (clientY - rect.top) / k - VIEWBOX_PAD,
    };
  }

  function screenPerSvgUnit(): number {
    const svg = svgRef.current;
    if (!svg || !layout) return 1;
    const rect = svg.getBoundingClientRect();
    return rect.width / (layout.width + 2 * VIEWBOX_PAD);
  }

  // Native wheel listener so we can preventDefault (React's onWheel is passive
  // in some React versions). Zooms around the cursor position.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      if (!layout) return;
      e.preventDefault();
      const anchor = screenToSvg(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      zoomAround(factor, anchor ?? undefined);
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // zoomAround captures scale/pan via closure; re-bind on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, vbH, scale, pan.x, pan.y]);

  function handleSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Only primary button (left-click) or touch/pen should start a gesture
    // that could select. Middle (button === 1) and right (button === 2) are
    // always pan. Ignore anything else (e.g. side buttons).
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    const panOnly =
      tool === "pan" ||
      spaceHeld ||
      e.button === 1 ||
      (e.pointerType === "mouse" && e.button === 2);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: pan.x,
      initPanY: pan.y,
      moved: false,
      panOnly,
    };
    lastGestureRef.current = null;
    setIsDragging(false);
    // Capture unconditionally: guarantees pointerup fires on this element
    // even if the cursor leaves the SVG mid-drag, so the drag state can't
    // get stuck when the user releases over a different element.
    try {
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture can throw if the pointer is already released */
    }
  }

  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    // Safety: if no button is pressed, the gesture has ended (e.g. we missed
    // the pointerup for some reason) — don't keep panning.
    if (e.buttons === 0) {
      lastGestureRef.current = { moved: drag.moved, panOnly: drag.panOnly };
      dragRef.current = null;
      setIsDragging(false);
      return;
    }
    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;
    if (
      !drag.moved &&
      Math.abs(dxScreen) < DRAG_THRESHOLD_PX &&
      Math.abs(dyScreen) < DRAG_THRESHOLD_PX
    ) {
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      setIsDragging(true);
      setTooltip(null);
    }
    const k = screenPerSvgUnit();
    if (k <= 0) return;
    setPan({
      x: drag.initPanX + dxScreen / k,
      y: drag.initPanY + dyScreen / k,
    });
  }

  function endGesture(e?: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag) {
      lastGestureRef.current = { moved: drag.moved, panOnly: drag.panOnly };
    }
    dragRef.current = null;
    setIsDragging(false);
    if (e) {
      try {
        (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      } catch {
        /* capture may have already been released */
      }
    }
  }

  function handleSvgPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    endGesture(e);
  }

  function handleSvgPointerCancel(e: React.PointerEvent<SVGSVGElement>) {
    endGesture(e);
  }

  function updateTooltip(cell: PlotLayoutCell, e: React.PointerEvent) {
    if (isDragging) return;
    const host = containerRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    setTooltip({
      plot: cell,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function clearTooltip() {
    setTooltip(null);
  }

  function handlePlotClick(cell: PlotLayoutCell, e: React.MouseEvent) {
    // onClick fires after pointerup, by which time dragRef is cleared —
    // use the gesture summary captured in endGesture().
    const gesture = lastGestureRef.current;
    lastGestureRef.current = null;
    if (gesture?.moved) return;
    const panMode = gesture?.panOnly ?? (tool === "pan" || spaceHeld);
    // In pan mode, clicks never select unless Alt is the explicit
    // "I really mean select" modifier.
    if (panMode && !e.altKey) return;
    setSelected(cell.plot_id);
  }

  if (!layout) {
    return (
      <div className="card">
        <h2 className="card-title">Field layout</h2>
        <div className="muted">No plots loaded. Go to Overview and seed the factorial or import plot_register.csv.</div>
      </div>
    );
  }

  const selectedPlot = selected ? plots.find(p => p.plot_id === selected) : null;
  const plotCursor =
    isDragging ? "grabbing" : (tool === "pan" || spaceHeld) ? "grab" : "pointer";

  // Which plots are active under the current plan
  function isActive(cell: { block: number; genotype: string; dose_code: string }): boolean {
    if (viewMode !== "sampling") return true;
    return (
      cell.block <= plan.nBlocks &&
      plan.genotypes.includes(cell.genotype as never) &&
      plan.doses.includes(cell.dose_code as never)
    );
  }

  return (
    <div className="column" style={{ gap: 14 }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>48-plot factorial</h2>
          {/* View mode toggle */}
          <div className="row" style={{ gap: 0, border: "1px solid var(--panel-border-strong)", borderRadius: "var(--radius-control)", overflow: "hidden" }}>
            {(["trees", "sampling"] as ViewMode[]).map(m => (
              <button key={m}
                onClick={() => switchMode(m)}
                style={{
                  padding: "4px 12px",
                  fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  background: viewMode === m ? "var(--ek-soil)" : "var(--panel-bg)",
                  color: viewMode === m ? "var(--ek-root)" : "var(--text-secondary)",
                  border: "none", cursor: "pointer",
                  transition: "background 0.12s",
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Legend (above viewer) */}
        {viewMode === "trees" && (
          <div className="row muted" style={{ marginBottom: 10, gap: 16, flexWrap: "wrap" }}>
            <span className="badge stem">CCN 51</span>
            <span className="badge berry">PS 13.19</span>
            <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="0.8"/></svg> 56 kg N</span>
            <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="1.6"/></svg> 226</span>
            <span className="row" style={{ gap: 6 }}><svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="2.6"/></svg> 340</span>
          </div>
        )}
        {viewMode === "sampling" && (
          <div className="row muted" style={{ marginBottom: 10, gap: 14, flexWrap: "wrap" }}>
            {plan.depths.length > 0 && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width={14} height={Math.max(14, plan.depths.length * LAYOUT_MARKER_GAP + 4)}>
                  {Array.from({ length: plan.depths.length }).map((_, di) => (
                    <SoilMark key={di} cx={7}
                      cy={LAYOUT_MARKER_R + 1 + di * LAYOUT_MARKER_GAP}
                      r={LAYOUT_MARKER_R - 1} color={SAMPLE_SOIL_COLOR} />
                  ))}
                </svg>
                Soil sample ({plan.depths.length}/plot)
              </span>
            )}
            {plan.nBdBlocks > 0 && plan.bdRingDepths.length > 0 && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width={14} height={Math.max(14, plan.bdRingDepths.length * LAYOUT_MARKER_GAP + 4)}>
                  {Array.from({ length: plan.bdRingDepths.length }).map((_, di) => (
                    <BdMark key={di} cx={7}
                      cy={LAYOUT_MARKER_R + 1 + di * LAYOUT_MARKER_GAP}
                      r={LAYOUT_MARKER_R - 1} strokeWidth={1.4} />
                  ))}
                </svg>
                BD core ({plan.bdRingDepths.length}/plot × {plan.nBdBlocks} block{plan.nBdBlocks !== 1 ? "s" : ""})
              </span>
            )}
            {plan.includeNmin && (
              <span className="row" style={{ gap: 5, fontSize: "0.72rem" }}>
                <svg width={12} height={12}><NminMark cx={6} cy={6} r={LAYOUT_BOTTOM_R} strokeWidth={1.6} /></svg>
                N-min analysis
              </span>
            )}
            {/* Dose → border thickness */}
            <span className="row" style={{ gap: 6, fontSize: "0.72rem" }}>
              <svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="0.8"/></svg> 56 kg N
            </span>
            <span className="row" style={{ gap: 6, fontSize: "0.72rem" }}>
              <svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="1.6"/></svg> 226
            </span>
            <span className="row" style={{ gap: 6, fontSize: "0.72rem" }}>
              <svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke={TOKENS.soil} strokeWidth="2.6"/></svg> 340
            </span>
            <span className="row" style={{ gap: 5, fontSize: "0.72rem", color: "var(--text-muted)" }}>
              <svg width="12" height="10"><rect x="0" y="0" width="12" height="10" rx="1" fill="var(--soil-08)" opacity="0.4"/></svg>
              Excluded by plan
            </span>
          </div>
        )}

        <div
          ref={containerRef}
          style={{
            position: "relative",
            overflow: "hidden",
            background: "var(--soil-04)",
            border: "1px solid var(--panel-border)",
            borderRadius: 8,
            height: "clamp(460px, 72vh, 880px)",
            touchAction: "none",
          }}
        >
          {/* Tool toggle (top-left) — pan is default, select picks plots */}
          <div
            role="group"
            aria-label="Map tool"
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 2,
              display: "flex",
              border: "1px solid var(--panel-border-strong)",
              borderRadius: "var(--radius-control)",
              overflow: "hidden",
              background: "var(--panel-bg)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            {([
              { key: "pan" as const, label: "Pan", Icon: Hand, hint: "Drag to pan (V)" },
              { key: "select" as const, label: "Select", Icon: MousePointer2, hint: "Click plot to select (V)" },
            ]).map(({ key, label, Icon, hint }) => {
              const active = tool === key;
              return (
                <button
                  key={key}
                  onClick={() => setTool(key)}
                  aria-pressed={active}
                  title={hint}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    fontFamily: "var(--font-family)",
                    fontSize: "0.76rem",
                    fontWeight: 500,
                    letterSpacing: 0,
                    background: active ? "var(--ek-soil)" : "transparent",
                    color: active ? "var(--ek-root)" : "var(--text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.12s, color 0.12s",
                  }}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Zoom cluster (top-right) */}
          <div
            role="group"
            aria-label="Zoom"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--panel-border-strong)",
              borderRadius: "var(--radius-control)",
              overflow: "hidden",
              background: "var(--panel-bg)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            {([
              { key: "in",  title: "Zoom in",  Icon: ZoomIn,     onClick: () => zoomAround(ZOOM_STEP) },
              { key: "out", title: "Zoom out", Icon: ZoomOut,    onClick: () => zoomAround(1 / ZOOM_STEP) },
              { key: "fit", title: "Fit all",  Icon: Maximize2,  onClick: fitAll },
            ]).map((btn, i, arr) => (
              <button
                key={btn.key}
                onClick={btn.onClick}
                aria-label={btn.title}
                title={btn.title}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "7px 10px",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "none",
                  borderBottom:
                    i < arr.length - 1
                      ? "1px solid var(--panel-border)"
                      : "none",
                  cursor: "pointer",
                  lineHeight: 1,
                  minWidth: 34,
                }}
              >
                <btn.Icon size={15} strokeWidth={1.8} />
              </button>
            ))}
          </div>

          {/* Zoom % readout (bottom-right) — instrument-panel touch */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 12,
              zIndex: 2,
              padding: "3px 7px",
              borderRadius: "var(--radius-control)",
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.68rem",
              color: "var(--text-secondary)",
              letterSpacing: "0.04em",
              pointerEvents: "none",
            }}
          >
            {Math.round(scale * 100)}%
          </div>

          {/* Nav hint (bottom-left) — quiet, one line */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 12,
              zIndex: 2,
              fontFamily: "var(--font-family)",
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              letterSpacing: 0,
              pointerEvents: "none",
            }}
          >
            {tool === "pan"
              ? "Drag to pan · scroll to zoom · Alt-click to inspect"
              : "Click to inspect · drag (or Space) to pan · scroll to zoom"}
          </div>

          <svg
            ref={svgRef}
            viewBox={`-${VIEWBOX_PAD} -${VIEWBOX_PAD} ${layout.width + 2 * VIEWBOX_PAD} ${vbH ?? layout.height + 2 * VIEWBOX_PAD}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              cursor: isDragging
                ? "grabbing"
                : (tool === "pan" || spaceHeld)
                  ? "grab"
                  : "default",
              touchAction: "none",
              userSelect: "none",
            }}
            role="img"
            aria-label="MCCS field layout: 48 plots"
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerCancel}
            onLostPointerCapture={handleSvgPointerCancel}
            onPointerLeave={clearTooltip}
            onContextMenu={(e) => e.preventDefault()}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
            {/* Block enclosures — match the Design overview style: a thin
                outline grouping the 6 plots (2 genotypes × 3 doses) that
                make up each block. */}
            {(() => {
              const byBlock = new Map<number, PlotLayoutCell[]>();
              for (const c of layout.plots) {
                const list = byBlock.get(c.block) ?? [];
                list.push(c);
                byBlock.set(c.block, list);
              }
              const BLOCK_PAD = 6;
              return Array.from(byBlock.entries()).map(([block, cells]) => {
                const minX = Math.min(...cells.map(c => c.x));
                const minY = Math.min(...cells.map(c => c.y));
                const maxX = Math.max(...cells.map(c => c.x + c.w));
                const maxY = Math.max(...cells.map(c => c.y + c.h));
                return (
                  <rect
                    key={`block-${block}`}
                    x={minX - BLOCK_PAD}
                    y={minY - BLOCK_PAD}
                    width={maxX - minX + 2 * BLOCK_PAD}
                    height={maxY - minY + 2 * BLOCK_PAD}
                    fill="none"
                    stroke="var(--panel-border)"
                    strokeWidth={1.2}
                    rx={6}
                    pointerEvents="none"
                  />
                );
              });
            })()}
            {layout.plots.map((cell) => {
              const active = isActive(cell);
              const isSel = cell.plot_id === selected;
              const fill = active
                ? GENOTYPE_FILL[cell.genotype]
                : "var(--soil-08)";
              const stroke = isSel
                ? TOKENS.soilDark
                : active
                  ? GENOTYPE_STROKE[cell.genotype]
                  : "var(--panel-border)";

              return (
                <g
                  key={cell.plot_id}
                  onPointerEnter={(e) => updateTooltip(cell, e)}
                  onPointerMove={(e) => updateTooltip(cell, e)}
                  onPointerLeave={clearTooltip}
                >
                  <rect
                    x={cell.x} y={cell.y} width={cell.w} height={cell.h}
                    rx={4} fill={fill}
                    stroke={stroke}
                    strokeWidth={isSel ? 3 : DOSE_STROKE_WIDTH[cell.dose_code]}
                    opacity={active ? 1 : 0.4}
                    style={{ cursor: plotCursor }}
                    onClick={(e) => handlePlotClick(cell, e)}
                  >
                    <title>
                      {cell.plot_id} ({cell.genotype === "CCN51" ? "CCN 51" : "PS 13.19"}, {DOSE_LABEL[cell.dose_code]} kg N ha⁻¹ yr⁻¹)
                    </title>
                  </rect>

                  {/* Label: block + genotype only. N dose is shown by the
                      rectangle border thickness (same convention used in
                      the legend above). */}
                  <text x={cell.x + 8} y={cell.y + 18}
                    fontFamily={CHART_FONT_MONO} fontSize="13"
                    fontWeight={600}
                    letterSpacing="0.02em"
                    fill={active ? TOKENS.soilDark : "var(--text-muted)"}
                    pointerEvents="none">
                    B{cell.block} · {cell.genotype === "CCN51" ? "CCN 51" : "PS 13.19"}
                  </text>

                  {/* Trees view — filled diamond so the tree glyph is clearly
                      distinct from the soil square / BD ring / N-min plus
                      used in the sampling view. */}
                  {viewMode === "trees" && cell.trees.map((t) => (
                    <g key={t.tree_id} pointerEvents="none">
                      <TreeMark
                        cx={t.cx} cy={t.cy} r={5.5}
                        color={GENOTYPE_STROKE[cell.genotype]} />
                    </g>
                  ))}

                  {/* Sampling view */}
                  {viewMode === "sampling" && active && (
                    <PlotSampleMarkers
                      x={cell.x} y={cell.y} w={cell.w} h={cell.h}
                      plan={plan}
                      bdActive={cell.block <= plan.nBdBlocks && plan.bdRingDepths.length > 0}
                    />
                  )}
                </g>
              );
            })}

            {/* BD ring count label — shown once in sampling mode */}
            {viewMode === "sampling" && plan.nBdBlocks > 0 && (() => {
              const cells = plan.genotypes.length * plan.doses.length;
              const bdPoints = plan.nBdBlocks * cells;
              const bdRings = bdPoints * plan.bdRingDepths.length;
              return (
                <text
                  x={layout.width / 2} y={layout.height + 14}
                  textAnchor="middle"
                  fontFamily={CHART_FONT_MONO} fontSize="9"
                  fill={IND_BD}>
                  {plan.nBdBlocks} BD block{plan.nBdBlocks !== 1 ? "s" : ""} × {cells} plots × {plan.bdRingDepths.length} depth{plan.bdRingDepths.length !== 1 ? "s" : ""} = {bdRings} Kopecky ring{bdRings !== 1 ? "s" : ""}
                </text>
              );
            })()}
            </g>
          </svg>

          {tooltip && (() => {
            const host = containerRef.current;
            const hostW = host?.clientWidth ?? 0;
            const hostH = host?.clientHeight ?? 0;
            const CARD_W = 188;
            const CARD_H = 118;
            // Prefer below-right of the pointer; flip if that would clip.
            const placeRight = tooltip.x + 14 + CARD_W <= hostW;
            const placeBelow = tooltip.y + 14 + CARD_H <= hostH;
            const left = placeRight
              ? tooltip.x + 14
              : Math.max(8, tooltip.x - 14 - CARD_W);
            const top = placeBelow
              ? tooltip.y + 14
              : Math.max(8, tooltip.y - 14 - CARD_H);
            const geno =
              tooltip.plot.genotype === "CCN51" ? "CCN 51" : "PS 13.19";
            return (
              <div
                role="tooltip"
                style={{
                  position: "absolute",
                  left,
                  top,
                  zIndex: 3,
                  minWidth: CARD_W,
                  padding: "8px 10px",
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border-strong)",
                  borderRadius: "var(--radius-control)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  lineHeight: 1.35,
                  color: "var(--text-primary)",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {tooltip.plot.plot_id}
                </div>
                <div>Block {tooltip.plot.block}</div>
                <div>{geno}</div>
                <div>{DOSE_LABEL[tooltip.plot.dose_code]} kg N ha⁻¹ yr⁻¹</div>
                <div style={{ color: "var(--text-secondary)" }}>
                  12 central trees · 6×2 double row
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Plot inspector */}
      <div className="card">
        <h2 className="card-title">Plot inspector</h2>
        {selectedPlot ? (
          <div className="stat-grid">
            <div className="stat"><span className="stat-label">Plot</span><span className="stat-value mono">{selectedPlot.plot_id}</span></div>
            <div className="stat"><span className="stat-label">Block</span><span className="stat-value">{selectedPlot.block}</span></div>
            <div className="stat"><span className="stat-label">Genotype</span><span className="stat-value">{selectedPlot.genotype_label}</span></div>
            <div className="stat"><span className="stat-label">N dose</span><span className="stat-value">{selectedPlot.n_dose_kg_ha_yr}</span><span className="stat-sub">kg N ha⁻¹ yr⁻¹</span></div>
            <div className="stat"><span className="stat-label">Central trees</span><span className="stat-value">{selectedPlot.measurement_trees_n}</span></div>
            <div className="stat"><span className="stat-label">Rootstock</span><span className="stat-value">{selectedPlot.rootstock}</span></div>
          </div>
        ) : (
          <div className="muted">Tap a plot on the map to see its details.</div>
        )}
      </div>
    </div>
  );
}
