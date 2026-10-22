# e-BMS — Electrical Battery Management System

A browser-based battery pack simulator and BMS dashboard. It models a series/parallel
cell string tick by tick (voltage, SoC, SoH, temperature, internal resistance, balancing
bleed), drives a full electrical chain (contactor sequencing, pre-charge, DC link, shunt
metering, fuse, insulation monitor), raises protection alarms with corrective actions, and
produces engineering reports — including a **History** archive of every report captured
while a simulation runs.

Everything runs client-side: **no backend, no API keys, no internet connection required**
after the page loads. Pack state and the report archive persist in `localStorage`.

---

## Quick start

```bash
npm install     # requires Node >= 20.19
npm run dev     # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build → `dist/index.html` (single self-contained file) |
| `npm run preview` | Serves the production build locally on `http://localhost:4173` |
| `npm run typecheck` | `tsc --noEmit` against the whole `src/` tree |
| `npm run check` | Typecheck **and** build — the deployment gate used in CI |

## Using the dashboard

1. Pick a cell chemistry and topology in the setup wizard (or **Home** in the sidebar).
2. Choose a mode / load profile and press **Run**. The tick loop advances every 150 ms.
3. Read the pack from the tabs: electrical overview (single-line diagram), cell string
   (2D/3D/thermal/delta), trends & scope, cell channel, control, compare, history.
4. Reports: **View** opens the live report, **CSV** / **PDF** export the pack at the click
   instant, **History** opens the archive (see below).
5. Deciding between two cells? **Compare** evaluates any two chemistries and topologies
   side by side (see below) and can push the winner into the live pack.

### History — the record of reports

Every simulation run archives whole reports, so a past run can be re-exported later:

| Badge | Captured when |
| --- | --- |
| `START` | the simulation is engaged (Run button, mode switch or auto-balance) |
| `AUTO` | every 30 s while it runs — switchable with **Auto-record** in the History view |
| `FAULT` | a critical alarm trips, preserving the pack state at protection time |
| `STOP` | the run ends |
| `SAVED` | you press **Archive now** or **Save to History** |

Each entry stores the complete snapshot (cells, telemetry, electrical state, energy
counters, alarms, event log, waveforms). From an entry you can download the **report PDF**
(banner-marked as an archive copy and stamped with its capture time), the **report CSV**,
the **raw snapshot JSON**, a one-row-per-report **index CSV** of the whole archive, or the
entire archive as **JSON**. Archived files are named
`BMS_PackReport_<chem>_<topo>_HIST_run0003_20261022_145456.pdf` so they never collide with
live exports.

The archive is capped (50 entries / 3 MB) and drops the oldest reports when it grows past
the browser's storage quota, so it can never break the app.

### Compare — two cells, side by side

The **Compare** tab (scales icon in the Display column) puts two cell chemistries — Li-Ion,
LiPo, solid-state, lead-acid, LiFePO4 and NiMH — through one weighted evaluation.

* **Two sides, two topologies.** Each side has its own chemistry picker plus series (1–32)
  and parallel (1–12) steppers. The chain button links the two topologies so a change on one
  side moves the other too; unlink it to compare, for example, 13S1P Li-Ion against 15S1P
  LiFePO4 on a common 48 V bus. The side cards recompute as you type: pack voltage, capacity,
  stored energy, cell mass, pack resistance, maximum discharge current, peak power, voltage
  sag, runtime, cycle life and service years.
* **Working load.** One amp value (seeded from the Control panel's load current) drives the
  runtime, C-rate and sag figures on both sides.
* **Generate comparison.** Writes a verdict, a seven-metric weighted scorecard (energy
  density 20 %, cycle life 20 %, safety margin 20 %, power 15 %, temperature range 10 %,
  cost 10 %, internal resistance 5 %), six descriptive analysis sections (voltage / energy /
  mass, power / resistance / efficiency, lifetime and economics, thermal behaviour and
  safety, construction and electrochemistry, fit for purpose), ten use-case picks, 49 spec
  parameters in seven collapsible tables, per-chemistry profiles with strengths and
  watch-outs, and numbered recommendations. Editing an input flags the screen *stale* until
  you regenerate, so a displayed result always says which inputs produced it.
* **Apply to live pack.** Either side can be pushed into the simulator — chemistry and
  topology in one step — then run, watched and archived to History like any other pack.
* **Export.** `CSV` and `PDF` write the whole comparison (scorecard, every parameter group,
  all analysis text, use cases, recommendations and profile fit) as
  `BMS_Compare_NiMH_21S3P_vs_Li-Ion_21S3P_20261022_162347.pdf`. An export regenerates from
  the inputs on screen first, so the file can never describe a stale comparison.

Every number is derived from the same chemistry library the simulator runs on
(`src/data/batteryChemistryData.ts`) by `src/utils/chemistryCompare.ts` — nothing is
hard-coded per pair, and comparing a chemistry with itself turns the report into a topology
study. The workspace (both sides, link state and working load) is kept in `localStorage`
under `bms.compare.inputs.v1`, so it survives tab switches and reloads.

## Deployment

The production build is a **single `dist/index.html`** with all JS and CSS inlined
(`vite-plugin-singlefile`) and relative asset paths (`base: "./"`). It therefore deploys to
any static host, any sub-path, an object store, an intranet share — or opens straight from
disk.

```bash
npm run check    # typecheck + build, exactly what CI runs
ls dist          # → index.html
```

### GitHub Pages (built in)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One-time
setup:

1. Repo **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. Push to `main` (or run the workflow manually from the **Actions** tab).
3. The site lands at `https://<user>.github.io/BatterManagementSystem/`.

Until step 1 is done the workflow stops at *Configure Pages* — that is the action telling
you Pages is not enabled yet, not a build failure.

### Any other static host

| Host | Build command | Publish directory |
| --- | --- | --- |
| Netlify | `npm run build` | `dist` |
| Vercel | `npm run build` | `dist` |
| Cloudflare Pages | `npm run build` | `dist` |
| S3 / nginx / IIS / any folder | `npm run build` | copy `dist/index.html` |

No rewrite rules are needed — the app has no client-side router, so there are no deep links
to fall back to.

## Data, privacy and offline behaviour

| Key | Contents |
| --- | --- |
| `bms.offline.state.v1` | live pack state, restored on reload |
| `bms.report.history.v1` | the History archive |
| `bms.report.history.prefs.v1` | History preferences (auto-record on/off) |

Nothing leaves the browser: no analytics, no telemetry, no network calls. Both stores are
best-effort — if storage is full or blocked (private mode, embedded frames) the app keeps
running and simply does not persist. Downloads use the browser's own save pipeline; inside a
sandboxed iframe that blocks downloads, a helper tab is opened instead, so allow popups if a
download does not appear.

## Project layout

```
index.html                  entry document (inline favicon, no external requests)
vite.config.ts              react + tailwind + singlefile, relative base, host allowlist
src/
  main.tsx                  React root
  App.tsx                   state, simulation loop, alarm engine, History capture points
  index.css                 Tailwind entry + alarm/SLD keyframes
  types/battery.ts          cell, chemistry, telemetry, session models
  data/                     chemistry library and load profiles
  utils/                    simulation, electrical, alarms, reports, CSV, History, storage,
                            chemistry comparison engine + its CSV/PDF export
  components/               header, sidebar, stack views, inspector, modals
    charts/                 canvas line + delta charts
    dashboard/              overview, KPI strip, History panel, Compare panel
    electrical/             single-line diagram
```

## Requirements

Node **20.19+** or **22.12+** (Vite 7). Modern browser with canvas, `localStorage` and
`ResizeObserver` — current Chrome, Edge, Firefox or Safari.
