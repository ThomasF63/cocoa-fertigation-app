# MCCS cocoa fertigation app

Offline-capable field + lab data collection for the MCCS cocoa fertigation
Phase 2 paper. Visualisation, entry and in-app results on one codebase; installs
as a PWA on iPad for field use under sun.

## Dev

```bash
cd app
npm install
npm run dev    # http://localhost:5173
npm run build
npm run preview
```

## iPad offline install

1. Serve the built app over HTTPS (or use `npm run preview` with a trusted local TLS proxy).
2. On the iPad, open the URL in Safari.
3. Share -> Add to Home Screen. The icon installs the PWA; subsequent launches work offline.
4. Field data persists locally in IndexedDB.
5. Back online: Sync tab -> Export and share -> AirDrop / Save to Files / OneDrive -> drop CSVs into the project's `data/` folder.

## Data model

Schemas are one-to-one with the CSVs in `../04_data/` (see `../04_data/README.md`).
IDs follow the same convention:

- `plot_id` = `B{1..8}_{CCN51|PS1319}_{L|M|H}`
- `tree_id` = `{plot_id}_T{01..12}`
- soil `sample_id` = `{plot_id}_{D1..Dn}` (n depends on the chosen depth scheme; planning baseline = 3 layers)
- BD `ring_id` = `BD{01..nn}_{D1..Dn}` (12 plots × depths in the balanced subset at baseline)
- N-min `sample_id` = `{plot_id}_NMIN` (0–10 cm composite only)

## Status

- [x] M1 scaffolding (Vite + React + TS, Ekodama tokens, shell, PWA, iPad + desktop responsive)
- [x] M2 data model + IndexedDB + CSV round-trip + seed-factorial
- [x] M3 field-map visualisation (SVG, plot inspector)
- [x] M4 data entry forms (per-plot, iPad-first single-sample flow with big Prev/Next steppers)
- [x] M5 descriptive results (tables, dose-response, depth profiles)
- [x] M6 fixed-effects ANOVA (sequential Type I, F-test p-values via incomplete beta)
- [x] M7 mixed-effects split-plot / split-split-plot ANOVA (classical balanced formulas; equivalent to `lmer(… + (1|block/wp/sp))` REML for balanced data; variance components via method of moments)
- [x] M8 PDF report builder (completion status + descriptive tables + ANOVA + split-plot F-tests + variance components, auto-assembled)
- [x] M9 sampling-plan power analysis (minimum detectable difference for SOC / TN stocks) on the Sampling plan tab
- [x] M10 stock conventions: fixed-depth and ESM (equivalent soil mass), both reported; coarse-fragment correction in `soil_samples`

Build script lives in `package.json`. See `../.claude/plans/let-s-write-this-in-fancy-owl.md` (plan of record).

## Test coverage

Run `npm test` for the stats and power engine tests (ANOVA decomposition, F-CDF sanity, split-plot balance, SS-sums-to-total invariant, t-quantile round-trip, MDD monotonicity in CV and sub-core count).

## What the stats engine computes

- `describe(values)`: n, mean, SD, SE, t-based 95% CI (df-adjusted critical value via small log-interpolated table), min/max
- `fitAnova({y, factors, terms})`: sequential Type I ANOVA with treatment-contrast dummy coding; OLS via normal equations (Gaussian elimination with partial pivoting); F p-values via regularised incomplete beta (Lanczos lgamma + continued-fraction betacf)
- `fitSplitPlotAnova({y, block, wholePlot, subPlot, subSubPlot?})`: classical balanced SS formulas via Moebius inversion over the factor power set; correct error strata for each term; method-of-moments variance components (match REML for balanced designs)
- `computeMdd(inputs) / sweepMdd(...)`: minimum detectable difference for dose-pair contrasts on SOC / TN stocks, given plot counts, assumed between- and within-plot CVs, and composite sub-core count. Powers the Sampling plan tab's power-analysis card. See `engine/power.ts`.
- `computeSoilStocks()`: fixed-depth and ESM-corrected SOC and TN stocks per (plot × depth), with BD fall-back to the treatment × depth mean when the plot is outside the balanced BD subset. See `engine/derived.ts`.

## What the app intentionally does NOT include

- WebR / lme4: deferred (would add ~30 MB WASM download). For the balanced MCCS design, `fitSplitPlotAnova` gives numerically identical F-tests and variance components to `lmer(... + (1|block/wp/sp))` REML. If you later need unbalanced-data mixed models, lmerTest Satterthwaite df, or continuous covariates, export CSVs and run `lme4::lmer()` externally.
- GHG flux measurements, 15N tracer, natural abundance δ¹⁵N (IRMS capacity not available for this campaign), post-fertigation mineral N time series, long-term temporal ΔSOC: out of scope for the Phase 2 paper, so not in the data model.
- Chart PNGs in the PDF report: currently only tables in the PDF; print the Results tab via the browser to get chart pages.
