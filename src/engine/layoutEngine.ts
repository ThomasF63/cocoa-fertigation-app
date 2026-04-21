// Deterministic generation of the 48-plot factorial and 576 central trees.
// Each plot holds 12 central cocoa trees in a 2 x 6 double row (mirrors the
// field planting pattern). Blocks are arranged 2 x 4 on wide screens.

import {
  DOSE_N_KG_HA_YR,
  GENOTYPE_LABELS,
  type BlockNumber,
  type DoseCode,
  type GenotypeCode,
  type Plot,
  type Tree,
} from "../types/design";
import {
  ALL_BLOCKS,
  ALL_DOSES,
  ALL_GENOTYPES,
  DEFAULT_PLAN,
  type SamplingPlan,
} from "../types/plan";

const BLOCKS: BlockNumber[] = ALL_BLOCKS;
const GENOTYPES: GenotypeCode[] = ALL_GENOTYPES;
const DOSES: DoseCode[] = ALL_DOSES;

export function plotId(block: BlockNumber, geno: GenotypeCode, dose: DoseCode): string {
  return `B${block}_${geno}_${dose}`;
}

export function treeId(plot_id: string, treeNumber: number): string {
  return `${plot_id}_T${String(treeNumber).padStart(2, "0")}`;
}

export function generatePlots(plan: SamplingPlan = DEFAULT_PLAN): Plot[] {
  const blocks = BLOCKS.slice(0, plan.nBlocks);
  const plots: Plot[] = [];
  for (const block of blocks) {
    for (const geno of plan.genotypes) {
      for (const dose of plan.doses) {
        plots.push({
          plot_id: plotId(block, geno, dose),
          block,
          genotype: geno,
          genotype_label: GENOTYPE_LABELS[geno],
          dose_code: dose,
          n_dose_kg_ha_yr: DOSE_N_KG_HA_YR[dose],
          rootstock: "VB 1151",
          trees_per_plot: 96,
          measurement_trees_n: plan.treesPerPlot,
        });
      }
    }
  }
  return plots;
}

export function generateTrees(plots: Plot[] = generatePlots()): Tree[] {
  const trees: Tree[] = [];
  for (const p of plots) {
    for (let t = 1; t <= p.measurement_trees_n; t++) {
      trees.push({
        tree_id: treeId(p.plot_id, t),
        plot_id: p.plot_id,
        tree_number_in_plot: t,
      });
    }
  }
  return trees;
}

// ------ Screen layout ------
// Blocks are arranged in a 2 x 4 grid on wide screens. Inside each block,
// the six treatment plots are arranged as 2 rows (genotype) x 3 cols (dose).
// Within each plot, 12 central trees form a 3 x 4 grid.

export interface PlotLayoutCell {
  plot_id: string;
  x: number;       // top-left of plot rect, in viewport units
  y: number;
  w: number;
  h: number;
  block: BlockNumber;
  genotype: GenotypeCode;
  dose_code: DoseCode;
  trees: { tree_id: string; cx: number; cy: number }[];
}

export interface FieldLayout {
  width: number;
  height: number;
  plots: PlotLayoutCell[];
}

export interface LayoutConfig {
  blockGridCols: number;   // default 4
  plotsPerBlockCols: number; // default 3 (doses)
  plotsPerBlockRows: number; // default 2 (genotypes)
  plotW: number;
  plotH: number;
  blockGap: number;
  plotGap: number;
  treeMargin: number;
  treeRadius: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  blockGridCols: 2,
  plotsPerBlockCols: 3,
  plotsPerBlockRows: 2,
  plotW: 240,
  plotH: 90,
  blockGap: 30,
  plotGap: 8,
  treeMargin: 18,
  treeRadius: 5,
};

export function computeFieldLayout(
  plots: Plot[] = generatePlots(),
  cfg: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): FieldLayout {
  const { blockGridCols, plotsPerBlockCols, plotsPerBlockRows,
          plotW, plotH, blockGap, plotGap, treeMargin, treeRadius } = cfg;

  const blockW = plotsPerBlockCols * plotW + (plotsPerBlockCols - 1) * plotGap;
  const blockH = plotsPerBlockRows * plotH + (plotsPerBlockRows - 1) * plotGap;

  const blockGridRows = Math.ceil(8 / blockGridCols);
  const width = blockGridCols * blockW + (blockGridCols - 1) * blockGap;
  const height = blockGridRows * blockH + (blockGridRows - 1) * blockGap;

  const cells: PlotLayoutCell[] = [];
  for (const p of plots) {
    const blockIdx = p.block - 1;
    const blockRow = Math.floor(blockIdx / blockGridCols);
    const blockCol = blockIdx % blockGridCols;
    const blockOriginX = blockCol * (blockW + blockGap);
    const blockOriginY = blockRow * (blockH + blockGap);

    const genotypeRow = p.genotype === "CCN51" ? 0 : 1;
    const doseCol = p.dose_code === "L" ? 0 : p.dose_code === "M" ? 1 : 2;

    const x = blockOriginX + doseCol * (plotW + plotGap);
    const y = blockOriginY + genotypeRow * (plotH + plotGap);

    // 12 trees: 2 rows x 6 cols (double row, as planted in the field).
    // Rows are shifted toward the bottom of the plot to leave headroom at the
    // top for the plot label.
    const rows = 2, cols = 6;
    const labelReserve = 32;
    const usableW = plotW - 2 * treeMargin;
    const usableH = plotH - treeMargin - labelReserve;
    const dx = usableW / (cols - 1);
    const dy = rows > 1 ? usableH / (rows - 1) : 0;

    const trees = [] as { tree_id: string; cx: number; cy: number }[];
    let n = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        trees.push({
          tree_id: treeId(p.plot_id, n),
          cx: x + treeMargin + c * dx,
          cy: y + labelReserve + r * dy,
        });
        n++;
      }
    }

    cells.push({
      plot_id: p.plot_id,
      x, y, w: plotW, h: plotH,
      block: p.block,
      genotype: p.genotype,
      dose_code: p.dose_code,
      trees,
    });
  }

  return { width, height, plots: cells };
}

export const __internals = { BLOCKS, GENOTYPES, DOSES, treeRadiusDefault: DEFAULT_LAYOUT_CONFIG.treeRadius };
