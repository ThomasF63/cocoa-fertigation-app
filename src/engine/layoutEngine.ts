// Deterministic generation of the 48-plot factorial and 1152 central trees.
// Each plot holds 24 central cocoa trees in a 12 x 2 double row running
// north–south (mirrors the field planting pattern). Blocks are arranged
// 4 x 2 on wide screens.

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
// Blocks are arranged in a 4 x 2 grid on wide screens. Inside each block,
// the six treatment plots are arranged as 3 rows (dose) x 2 cols (genotype),
// with genotype flipped between adjacent dose rows so each N–S column
// alternates CCN 51 / PS 13.19 while each W–E row stays on a single dose
// (single fertigation manifold). Within each plot, 24 central trees form a
// 12 x 2 grid so the double rows run vertically (north–south), matching the
// field planting orientation.

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
  blockGridCols: 4,
  plotsPerBlockCols: 2,   // genotypes across columns
  plotsPerBlockRows: 3,   // doses down rows
  plotW: 120,
  plotH: 300,
  blockGap: 30,
  plotGap: 8,
  treeMargin: 30,
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

    const doseRow = p.dose_code === "L" ? 0 : p.dose_code === "M" ? 1 : 2;
    // Flip the CCN 51 / PS 13.19 positions between dose rows so each
    // vertical double row alternates genotype N→S, while every W–E row
    // keeps a single dose for fertigation.
    const ccnCol = doseRow % 2 === 0 ? 0 : 1;
    const genotypeCol = p.genotype === "CCN51" ? ccnCol : 1 - ccnCol;

    const x = blockOriginX + genotypeCol * (plotW + plotGap);
    const y = blockOriginY + doseRow * (plotH + plotGap);

    // 24 trees: 12 rows x 2 cols (double row running north–south, as
    // planted in the field). Rows are shifted downward to leave headroom at
    // the top of the plot for the plot label.
    const rows = 12, cols = 2;
    const labelReserve = 36;
    const usableW = plotW - 2 * treeMargin;
    const usableH = plotH - treeMargin - labelReserve;
    const dx = cols > 1 ? usableW / (cols - 1) : 0;
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
