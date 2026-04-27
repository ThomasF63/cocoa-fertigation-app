// Dummy dataset generator for end-to-end app test.
// Produces 9 populated CSVs into dummy_data/ matching the filenames the app
// imports. Effect sizes were tuned so that N-dose is statistically significant
// on leaf_n_pct, SPAD, TN and net N mineralisation; genotype has a main effect
// on stem diameter and SPAD; no treatment effect on BD, pH or coarse fragments.
//
// Reproducible: fixed seed (mulberry32).

const fs = require("fs");
const path = require("path");

const OUT = __dirname;

// ---------- seedable RNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260422);
function rnorm(mu, sd) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const round = (x, d = 2) => Number.isFinite(x) ? Number(x.toFixed(d)) : "";

// ---------- design ----------
const BLOCKS = [1, 2, 3, 4, 5, 6, 7, 8];
const GENOS = ["CCN51", "PS1319"];
const GENO_LABEL = { CCN51: "CCN 51", PS1319: "PS 13.19" };
const DOSES = [
  { code: "L", n_kg: 56 },
  { code: "M", n_kg: 226 },
  { code: "H", n_kg: 340 },
];
const DEPTHS = [
  { code: "D1", label: "0-20",  top: 0,  bot: 20 },
  { code: "D2", label: "20-40", top: 20, bot: 40 },
];

const plots = [];
for (const b of BLOCKS)
  for (const g of GENOS)
    for (const d of DOSES)
      plots.push({
        plot_id: `B${b}_${g}_${d.code}`,
        block: b, geno: g, dose: d,
      });

// Block random effects (shared across variables within a block)
const blockRE = Object.fromEntries(BLOCKS.map(b => [b, rnorm(0, 1)]));
// Per-plot random effect (small, to introduce within-block residual)
const plotRE = Object.fromEntries(plots.map(p => [p.plot_id, rnorm(0, 1)]));

// Treatment effect look-ups
const DOSE_IDX = { L: 0, M: 1, H: 2 };
const LEAF_N      = [1.90, 2.30, 2.55];   // %
const SPAD        = [44, 51, 54];
const STEM_BY_G   = { CCN51: 61, PS1319: 58 };
const SOC_D1      = [14.5, 17.0, 19.0];   // g/kg topsoil
const SOC_D2_SCL  = 0.55;                  // subsoil scaling
const TN_D1       = [1.00, 1.30, 1.50];
const TN_D2_SCL   = 0.50;
const PH_D1       = [5.40, 5.25, 5.10];
const NETMIN      = [0.40, 0.85, 1.20];
const POD         = [2.5, 3.2, 3.6];
const VIGOUR      = [2.8, 3.4, 3.7];

// ---------- CSV helpers ----------
function esc(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows) {
  return rows.map(r => r.map(esc).join(",")).join("\n") + "\n";
}
function write(filename, rows) {
  fs.writeFileSync(path.join(OUT, filename), toCsv(rows), "utf8");
  console.log(`wrote ${filename} (${rows.length - 1} data rows)`);
}

const DATE = "2026-04-22";
const SAMPLER = "TFG";
const OBSERVER = "TFG";
const LAB_SOIL = "ESALQ";
const LAB_LEAF = "ESALQ";

// ---------- 1. plot_register.csv ----------
{
  const header = ["plot_id","block","genotype","n_dose_kg_ha_yr","dose_code",
    "scion","rootstock","trees_per_plot","measurement_trees_n",
    "plot_lat","plot_lon","notes"];
  const rows = [header];
  for (const p of plots) {
    rows.push([p.plot_id, p.block, GENO_LABEL[p.geno], p.dose.n_kg, p.dose.code,
      GENO_LABEL[p.geno], "VB 1151", 96, 12, "", "", ""]);
  }
  write("plot_register.csv", rows);
}

// ---------- 2. tree_register.csv ----------
{
  const header = ["tree_id","plot_id","tree_number_in_plot","tag_id","tagged_date","notes"];
  const rows = [header];
  for (const p of plots) {
    for (let t = 1; t <= 12; t++) {
      const tid = `${p.plot_id}_T${String(t).padStart(2, "0")}`;
      rows.push([tid, p.plot_id, t, tid.replace(/_/g, "-"), "2026-03-01", ""]);
    }
  }
  write("tree_register.csv", rows);
}

// ---------- 3. soil_samples.csv ----------
{
  const header = ["sample_id","plot_id","depth_label","depth_top_cm","depth_bottom_cm",
    "n_subsamples","compositing_pattern","coarse_fragments_pct",
    "sampling_date","sampler","moisture_visual","notes"];
  const rows = [header];
  for (const p of plots) {
    for (const d of DEPTHS) {
      const cf = Math.max(0, rnorm(5 + 0.5 * blockRE[p.block], 1.5)); // no treatment effect
      rows.push([
        `${p.plot_id}_${d.code}`, p.plot_id, d.label, d.top, d.bot,
        5, "W", round(cf, 1),
        DATE, SAMPLER, "moist", "",
      ]);
    }
  }
  write("soil_samples.csv", rows);
}

// ---------- 4. bulk_density_rings.csv ----------
// 2 BD blocks (first two), all 6 (geno x dose) plots per block, 2 depths.
{
  const header = ["ring_id","plot_id","depth_label","depth_top_cm","depth_bottom_cm",
    "ring_volume_cm3","fresh_weight_g","oven_dry_weight_g","bulk_density_g_cm3",
    "sampling_date","sampler","notes"];
  const rows = [header];
  const bdPlots = plots.filter(p => p.block === 1 || p.block === 2);
  bdPlots.forEach((p, i) => {
    for (const d of DEPTHS) {
      const ringId = `BD${String(i + 1).padStart(2, "0")}_${d.code}`;
      // BD: ~1.25 topsoil, ~1.38 subsoil; slight block noise; no treatment effect.
      const bdTrue = (d.code === "D1" ? 1.25 : 1.38) + 0.03 * blockRE[p.block] + rnorm(0, 0.04);
      const volume = 100; // cm3 Kopecky ring
      // moisture ~18% topsoil, 16% subsoil
      const moist = d.code === "D1" ? 0.18 : 0.16;
      const ovenDry = bdTrue * volume;
      const fresh = ovenDry * (1 + moist);
      rows.push([
        ringId, p.plot_id, d.label, d.top, d.bot,
        volume, round(fresh, 1), round(ovenDry, 1), round(bdTrue, 3),
        DATE, SAMPLER, "",
      ]);
    }
  });
  write("bulk_density_rings.csv", rows);
}

// ---------- 5. tree_measurements.csv ----------
// Per-tree SPAD (three leaves + mean), stem diameter, pod load, vigour.
{
  const header = ["tree_id","plot_id","measurement_date",
    "spad_leaf_1","spad_leaf_2","spad_leaf_3","spad_mean",
    "stem_diameter_30cm_mm","pod_load_score","vigour_score",
    "observer","notes"];
  const rows = [header];
  for (const p of plots) {
    const di = DOSE_IDX[p.dose.code];
    for (let t = 1; t <= 12; t++) {
      const tid = `${p.plot_id}_T${String(t).padStart(2, "0")}`;
      // SPAD: dose effect + block RE + plot RE + tree residual.
      const spadMu = SPAD[di] + 1.5 * blockRE[p.block] + 1.0 * plotRE[p.plot_id];
      const s1 = rnorm(spadMu, 2.5);
      const s2 = rnorm(spadMu, 2.5);
      const s3 = rnorm(spadMu, 2.5);
      const smean = (s1 + s2 + s3) / 3;

      // Stem diameter: genotype main effect + dose effect + block + tree resid.
      const stemMu = STEM_BY_G[p.geno] + (di === 0 ? -2 : di === 1 ? 0 : 1.5)
                   + 1.3 * blockRE[p.block] + 0.6 * plotRE[p.plot_id];
      const stem = rnorm(stemMu, 5);

      // Pod load + vigour: modest dose effect, ordinal 0..5
      const pod = Math.max(0, Math.min(5, Math.round(rnorm(POD[di] + 0.3 * blockRE[p.block], 0.6))));
      const vig = Math.max(0, Math.min(5, Math.round(rnorm(VIGOUR[di] + 0.2 * blockRE[p.block], 0.5))));

      rows.push([
        tid, p.plot_id, DATE,
        round(s1, 1), round(s2, 1), round(s3, 1), round(smean, 2),
        round(stem, 1), pod, vig,
        OBSERVER, "",
      ]);
    }
  }
  write("tree_measurements.csv", rows);
}

// ---------- 6. leaf_tissue_composites.csv ----------
{
  const header = ["sample_id","plot_id","sampling_date",
    "n_trees_sampled","n_leaves_combined","fresh_weight_g","dry_weight_g",
    "observer","notes"];
  const rows = [header];
  for (const p of plots) {
    const fresh = rnorm(120 + 3 * blockRE[p.block], 8);
    const dry   = fresh * (0.40 + rnorm(0, 0.02));
    rows.push([
      `${p.plot_id}_LEAF`, p.plot_id, DATE,
      5, 25, round(fresh, 1), round(dry, 1),
      OBSERVER, "",
    ]);
  }
  write("leaf_tissue_composites.csv", rows);
}

// ---------- 7. soil_analytics.csv ----------
{
  const header = ["sample_id","plot_id","depth_label","analysis_lab","analysis_date",
    "soc_g_kg","tn_g_kg","c_n_ratio","ph_h2o",
    "ca_mmolc_dm3","mg_mmolc_dm3","k_mmolc_dm3",
    "al3_mmolc_dm3","h_al_mmolc_dm3","base_saturation_pct",
    "notes"];
  const rows = [header];
  for (const p of plots) {
    const di = DOSE_IDX[p.dose.code];
    for (const d of DEPTHS) {
      const isTop = d.code === "D1";
      // SOC
      const socMean = isTop ? SOC_D1[di] : SOC_D1[di] * SOC_D2_SCL;
      const soc = rnorm(socMean + 0.8 * blockRE[p.block] + 0.4 * plotRE[p.plot_id], 1.1);
      // TN
      const tnMean = isTop ? TN_D1[di] : TN_D1[di] * TN_D2_SCL;
      const tn = rnorm(tnMean + 0.08 * blockRE[p.block] + 0.04 * plotRE[p.plot_id], 0.10);
      const cn = tn > 0 ? soc / tn : "";
      // pH
      const phMean = isTop ? PH_D1[di] : PH_D1[di] + 0.1;
      const ph = rnorm(phMean + 0.08 * blockRE[p.block], 0.15);
      // cation exchange figures (not core to the Q, but populate realistically)
      const ca = round(rnorm(isTop ? 25 : 15, 4), 1);
      const mg = round(rnorm(isTop ? 8 : 5, 2), 1);
      const k  = round(rnorm(isTop ? 2.5 : 1.5, 0.5), 2);
      const al = round(Math.max(0, rnorm(isTop ? 2 : 5, 1.5)), 2);
      const hal = round(Math.max(0, rnorm(isTop ? 28 : 34, 4)), 1);
      const baseSum = Math.max(0, ca + mg + k);
      const totalCEC = baseSum + hal;
      const bsPct = round((baseSum / totalCEC) * 100, 1);

      rows.push([
        `${p.plot_id}_${d.code}`, p.plot_id, d.label, LAB_SOIL, DATE,
        round(Math.max(0, soc), 2), round(Math.max(0, tn), 3),
        round(cn, 1), round(ph, 2),
        ca, mg, k, al, hal, bsPct,
        "",
      ]);
    }
  }
  write("soil_analytics.csv", rows);
}

// ---------- 8. n_mineralisation.csv ----------
// 0 to 10 cm composite per plot (N-min spec in plan); 56-day aerobic incubation.
{
  const header = ["sample_id","plot_id","lab","incubation_start_date","incubation_end_date",
    "day0_nh4_mg_kg","day0_no3_mg_kg","day56_nh4_mg_kg","day56_no3_mg_kg",
    "net_min_rate_mg_kg_d","notes"];
  const rows = [header];
  for (const p of plots) {
    const di = DOSE_IDX[p.dose.code];
    const netMin = rnorm(NETMIN[di] + 0.1 * blockRE[p.block] + 0.05 * plotRE[p.plot_id], 0.18);
    // Back-compute plausible day0 / day56 pools consistent with netMin over 56 days.
    const day0NH4 = Math.max(0.5, rnorm(6, 1.2));
    const day0NO3 = Math.max(0.5, rnorm(4, 1.0));
    const day0Total = day0NH4 + day0NO3;
    const day56Total = Math.max(0.1, day0Total + netMin * 56);
    // Split into NH4 / NO3 proportions (more NO3 at end of incubation)
    const day56NH4 = day56Total * (0.15 + rnorm(0, 0.03));
    const day56NO3 = day56Total - day56NH4;
    rows.push([
      `${p.plot_id}_NMIN`, p.plot_id, LAB_SOIL, "2026-04-23", "2026-06-18",
      round(day0NH4, 2), round(day0NO3, 2),
      round(day56NH4, 2), round(day56NO3, 2),
      round(netMin, 3), "",
    ]);
  }
  write("n_mineralisation.csv", rows);
}

// ---------- 9. leaf_tissue_analytics.csv ----------
{
  const header = ["sample_id","plot_id","lab","analysis_date",
    "n_concentration_pct","notes"];
  const rows = [header];
  for (const p of plots) {
    const di = DOSE_IDX[p.dose.code];
    const leafN = rnorm(LEAF_N[di] + 0.05 * blockRE[p.block] + 0.03 * plotRE[p.plot_id], 0.08);
    rows.push([
      `${p.plot_id}_LEAF`, p.plot_id, LAB_LEAF, "2026-05-20",
      round(Math.max(0.5, leafN), 3), "",
    ]);
  }
  write("leaf_tissue_analytics.csv", rows);
}

console.log("\ndone.");
