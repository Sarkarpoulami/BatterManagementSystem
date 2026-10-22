// Report History — the record of every report captured while the simulation runs.
//
// Each run of the simulation archives reports here: one at the moment RUN is
// engaged, one when it is stopped, an automatic checkpoint every
// AUTO_CAPTURE_INTERVAL_MS while it runs, plus any critical-alarm or manual
// capture. Entries keep the FULL report context (trimmed of only the longest
// waveform tails), so a past run can still be exported as PDF / CSV / JSON long
// after the simulation stopped. Everything lives in localStorage — no internet.

import type { LoadProfile, SimulationMode } from '../types/battery';
import {
  createStoredReport,
  downloadPackPdf,
  formatClock,
  type ReportContext,
  type StoredReport,
} from './reportGenerator';
import { downloadPackCsv } from './csvExport';
import { deliverText } from './fileDelivery';

export const HISTORY_KEY = 'bms.report.history.v1';
export const HISTORY_PREFS_KEY = 'bms.report.history.prefs.v1';

/** How many reports the archive keeps (newest survive, oldest are dropped). */
export const MAX_HISTORY_ENTRIES = 50;
/** How often a report is auto-archived while the simulation is running. */
export const AUTO_CAPTURE_INTERVAL_MS = 30_000;

// Sizes kept per archived report — bounded so localStorage never overflows.
const MAX_SNAPSHOTS = 120;
const MAX_CELL_POINTS = 90;
const MAX_LOGS = 40;
const MAX_ALARMS = 30;
/**
 * Byte budget for the whole archive. localStorage gives an origin ~5 MB and the
 * live pack state (`bms.offline.state.v1`) needs room too, so the oldest reports
 * are dropped once the archive grows past this.
 */
export const HISTORY_BYTE_BUDGET = 3 * 1024 * 1024;

export type HistoryTrigger = 'run-start' | 'run-stop' | 'checkpoint' | 'fault' | 'manual';

export interface TriggerMeta {
  label: string;
  short: string;
  /** Tailwind classes for the trigger badge. */
  chip: string;
  dot: string;
}

export const TRIGGER_META: Record<HistoryTrigger, TriggerMeta> = {
  'run-start': {
    label: 'Run started',
    short: 'START',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    dot: 'bg-emerald-400',
  },
  'run-stop': {
    label: 'Run stopped',
    short: 'STOP',
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    dot: 'bg-rose-400',
  },
  checkpoint: {
    label: 'Auto checkpoint',
    short: 'AUTO',
    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    dot: 'bg-cyan-400',
  },
  fault: {
    label: 'Critical alarm',
    short: 'FAULT',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    dot: 'bg-amber-400',
  },
  manual: {
    label: 'Saved manually',
    short: 'SAVED',
    chip: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    dot: 'bg-purple-400',
  },
};

export const TRIGGER_ORDER: HistoryTrigger[] = ['run-start', 'run-stop', 'checkpoint', 'fault', 'manual'];

export function triggerMeta(trigger: HistoryTrigger): TriggerMeta {
  return TRIGGER_META[trigger] ?? TRIGGER_META.manual;
}

/** Headline numbers of an archived report — enough to scan the list without opening it. */
export interface HistorySummary {
  cellCount: number;
  packVoltage: number;
  packCurrent: number;
  packPower: number;
  packSoC: number;
  packSoH: number;
  energyRemainingWh: number;
  avgVoltage: number;
  minVoltage: number;
  maxVoltage: number;
  minVoltageCellId: number;
  maxVoltageCellId: number;
  deltaMv: number;
  avgTemperature: number;
  maxTemperature: number;
  maxTempCellId: number;
  faultyCells: number;
  balancingCells: number;
  alarmRecords: number;
  criticalAlarms: number;
  energyOutWh: number;
  energyInWh: number;
  chargeOutAh: number;
  chargeInAh: number;
  peakDischargeA: number;
  peakChargeA: number;
  peakPowerW: number;
  contactor: string;
  efficiencyPct: number | null;
  cRate: number | null;
}

export interface ReportHistoryEntry {
  id: string;
  /** ISO timestamp of the capture. */
  capturedAt: string;
  trigger: HistoryTrigger;
  note: string;
  /** Which simulation run this report belongs to (1-based, keeps counting across reloads). */
  runIndex: number;
  runStartedAt: number | null;
  /** Wall-clock length of the run at the moment of capture. */
  runElapsedMs: number;
  label: string;
  chemistry: string;
  topology: string;
  mode: SimulationMode;
  profile: LoadProfile;
  /** Simulation session clock at capture. */
  sessionElapsedMs: number;
  tickCount: number;
  isRunning: boolean;
  summary: HistorySummary;
  /** Full snapshot — re-exportable as PDF / CSV at any later time. */
  report: StoredReport;
}

export interface ReportHistoryStore {
  version: 1;
  /** Newest first. */
  entries: ReportHistoryEntry[];
  runCount: number;
  updatedAt: string | null;
  savedAt: number | null;
}

export interface HistoryPrefs {
  autoCapture: boolean;
}

export interface PersistResult {
  ok: boolean;
  kept: number;
  dropped: number;
  bytes: number;
  savedAt: number;
}

export const EMPTY_HISTORY: ReportHistoryStore = {
  version: 1,
  entries: [],
  runCount: 0,
  updatedAt: null,
  savedAt: null,
};

// ── Storage ────────────────────────────────────────────────────────────────

function isValidEntry(e: unknown): e is ReportHistoryEntry {
  const x = e as ReportHistoryEntry | null;
  return !!x && typeof x.id === 'string' && typeof x.capturedAt === 'string' && !!x.report && !!x.report.ctx;
}

/** Reads the archive from localStorage. Corrupt/older payloads fall back to an empty archive. */
export function loadHistory(): ReportHistoryStore {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { ...EMPTY_HISTORY };
    const parsed = JSON.parse(raw) as ReportHistoryStore;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return { ...EMPTY_HISTORY };
    const entries = parsed.entries.filter(isValidEntry).slice(0, MAX_HISTORY_ENTRIES);
    return {
      version: 1,
      entries,
      runCount: Number.isFinite(parsed.runCount) ? parsed.runCount : 0,
      updatedAt: parsed.updatedAt ?? entries[0]?.capturedAt ?? null,
      savedAt: Number.isFinite(parsed.savedAt as number) ? (parsed.savedAt as number) : null,
    };
  } catch {
    return { ...EMPTY_HISTORY };
  }
}

/** Drops the long waveform tails but keeps the report exportable. */
function stripWaveforms(entry: ReportHistoryEntry): ReportHistoryEntry {
  const ctx = entry.report.ctx;
  const light: ReportContext = {
    ...ctx,
    cells: ctx.cells.map((c) => ({ ...c, history: c.history.slice(-20) })),
    snapshots: ctx.snapshots.slice(-20),
    logs: ctx.logs.slice(0, 10),
  };
  return { ...entry, report: { ...entry.report, ctx: light } };
}

/** Drops the oldest reports until the archive fits the byte budget. */
function trimToBudget(store: ReportHistoryStore): ReportHistoryStore {
  let entries = store.entries;
  let json = JSON.stringify({ ...store, entries });
  while (json.length > HISTORY_BYTE_BUDGET && entries.length > 1) {
    const cut = Math.max(1, Math.ceil(entries.length * 0.1));
    entries = entries.slice(0, entries.length - cut);
    json = JSON.stringify({ ...store, entries });
  }
  return { ...store, entries };
}

/**
 * Writes the archive. localStorage is capped (~5 MB per origin), so the archive
 * is first trimmed to HISTORY_BYTE_BUDGET; if the browser still refuses the
 * write, the waveform tails are stripped and the oldest entries are halved away
 * until it fits. Best-effort: never throws.
 */
export function persistHistory(store: ReportHistoryStore): PersistResult {
  const savedAt = Date.now();
  const budgeted = trimToBudget({ ...store, savedAt });
  let candidate = budgeted;
  let dropped = store.entries.length - candidate.entries.length;

  for (let attempt = 0; attempt < 12; attempt++) {
    // Try the archive as-is, then the same archive without its long waveform tails.
    for (const variant of [candidate, { ...candidate, entries: candidate.entries.map(stripWaveforms) }]) {
      const json = JSON.stringify(variant);
      try {
        localStorage.setItem(HISTORY_KEY, json);
        return { ok: true, kept: variant.entries.length, dropped, bytes: json.length, savedAt };
      } catch {
        /* quota exceeded — shrink and retry */
      }
    }
    const nextLen = Math.floor(candidate.entries.length / 2);
    if (nextLen >= candidate.entries.length) break; // cannot shrink any further
    dropped += candidate.entries.length - nextLen;
    candidate = { ...candidate, entries: candidate.entries.slice(0, nextLen) };
  }

  return { ok: false, kept: 0, dropped: store.entries.length, bytes: 0, savedAt };
}

export function loadHistoryPrefs(): HistoryPrefs {
  try {
    const raw = localStorage.getItem(HISTORY_PREFS_KEY);
    if (!raw) return { autoCapture: true };
    const parsed = JSON.parse(raw) as Partial<HistoryPrefs>;
    return { autoCapture: typeof parsed.autoCapture === 'boolean' ? parsed.autoCapture : true };
  } catch {
    return { autoCapture: true };
  }
}

export function saveHistoryPrefs(prefs: HistoryPrefs): void {
  try {
    localStorage.setItem(HISTORY_PREFS_KEY, JSON.stringify({ version: 1, ...prefs }));
  } catch {
    /* preferences are best-effort */
  }
}

// ── Archive mutations (pure — the caller persists the result) ───────────────

export function appendHistoryEntry(
  store: ReportHistoryStore,
  entry: ReportHistoryEntry,
  max: number = MAX_HISTORY_ENTRIES
): ReportHistoryStore {
  const entries = [entry, ...store.entries.filter((e) => e.id !== entry.id)].slice(0, max);
  return {
    version: 1,
    entries,
    runCount: Math.max(store.runCount, Number.isFinite(entry.runIndex) ? entry.runIndex : 0),
    updatedAt: entry.capturedAt,
    savedAt: store.savedAt,
  };
}

export function removeHistoryEntry(store: ReportHistoryStore, id: string): ReportHistoryStore {
  return { ...store, entries: store.entries.filter((e) => e.id !== id) };
}

/** Empties the archive in storage and returns the empty store. */
export function clearHistory(): ReportHistoryStore {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return { ...EMPTY_HISTORY };
}

// ── Capture ────────────────────────────────────────────────────────────────

/** Rounds to `d` decimals — reports print at most 4, and it keeps the JSON small. */
function r(value: number, d: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(d)) : value;
}

function trimContext(ctx: ReportContext): ReportContext {
  return {
    ...ctx,
    cells: ctx.cells.map((c) => ({
      ...c,
      voltage: r(c.voltage, 4),
      soc: r(c.soc, 3),
      soh: r(c.soh, 2),
      temperature: r(c.temperature, 2),
      internalResistance: r(c.internalResistance, 2),
      balanceBleedCurrent: r(c.balanceBleedCurrent, 2),
      history: c.history.slice(-MAX_CELL_POINTS).map((h) => ({
        ...h,
        voltage: r(h.voltage, 4),
        current: r(h.current, 3),
        temperature: r(h.temperature, 2),
        soc: r(h.soc, 3),
      })),
    })),
    snapshots: ctx.snapshots.slice(-MAX_SNAPSHOTS).map((s) => ({
      ...s,
      packVoltage: r(s.packVoltage, 3),
      packCurrent: r(s.packCurrent, 3),
      packPower: r(s.packPower, 2),
      packSoC: r(s.packSoC, 3),
      avgTemp: r(s.avgTemp, 2),
      maxTemp: r(s.maxTemp, 2),
      deltaMv: r(s.deltaMv, 2),
      minVoltage: r(s.minVoltage, 4),
      maxVoltage: r(s.maxVoltage, 4),
    })),
    logs: ctx.logs.slice(0, MAX_LOGS),
    alarmHistory: ctx.alarmHistory ? ctx.alarmHistory.slice(0, MAX_ALARMS) : ctx.alarmHistory,
  };
}

function summarize(ctx: ReportContext): HistorySummary {
  const t = ctx.telemetry;
  const e = ctx.energy;
  const el = ctx.electrical;
  const alarms = ctx.alarmHistory ?? [];
  return {
    cellCount: ctx.cells.length,
    packVoltage: t.packVoltage,
    packCurrent: t.packCurrent,
    packPower: t.packPower,
    packSoC: t.packSoC,
    packSoH: t.packSoH,
    energyRemainingWh: t.packEnergyRemaining,
    avgVoltage: t.avgVoltage,
    minVoltage: t.minVoltage,
    maxVoltage: t.maxVoltage,
    minVoltageCellId: t.minVoltageCellId,
    maxVoltageCellId: t.maxVoltageCellId,
    deltaMv: t.deltaVoltage,
    avgTemperature: t.avgTemperature,
    maxTemperature: t.maxTemperature,
    maxTempCellId: t.maxTempCellId,
    faultyCells: ctx.cells.filter((c) => c.faultType !== 'none').length,
    balancingCells: ctx.cells.filter((c) => c.isBalancing).length,
    alarmRecords: alarms.length,
    criticalAlarms: alarms.filter((a) => a.severity === 'critical').length,
    energyOutWh: e?.whOut ?? 0,
    energyInWh: e?.whIn ?? 0,
    chargeOutAh: e?.ahOut ?? 0,
    chargeInAh: e?.ahIn ?? 0,
    peakDischargeA: e?.peakDischargeA ?? 0,
    peakChargeA: e?.peakChargeA ?? 0,
    peakPowerW: e?.peakPowerW ?? 0,
    contactor: el?.contactor ?? 'open',
    efficiencyPct: el ? Number(el.efficiencyPct.toFixed(2)) : null,
    cRate: el ? Number(el.cRate.toFixed(3)) : null,
  };
}

export interface CaptureOptions {
  trigger: HistoryTrigger;
  note?: string;
  runIndex?: number;
  runStartedAt?: number | null;
}

/** Builds an archive entry from the pack state at this exact instant. */
export function captureHistoryEntry(ctx: ReportContext, opts: CaptureOptions): ReportHistoryEntry {
  const report = createStoredReport(trimContext(ctx));
  const runStartedAt = opts.runStartedAt ?? ctx.sessionStartedAt;
  const capturedMs = Date.now();
  return {
    id: report.id,
    capturedAt: report.createdAt,
    trigger: opts.trigger,
    note: opts.note ?? triggerMeta(opts.trigger).label,
    runIndex: opts.runIndex ?? 0,
    runStartedAt,
    runElapsedMs: runStartedAt ? Math.max(0, capturedMs - runStartedAt) : 0,
    label: report.label,
    chemistry: report.session.chemistry,
    topology: report.session.topology,
    mode: ctx.simulationMode,
    profile: ctx.loadProfile,
    sessionElapsedMs: ctx.elapsedMs,
    tickCount: ctx.tickCount,
    isRunning: ctx.isRunning,
    summary: summarize(ctx),
    report,
  };
}

// ── Export of archived reports ─────────────────────────────────────────────

function stampOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** "run-0003" style tag so archived files sort together and never clash with live ones. */
export function entryTag(entry: ReportHistoryEntry): string {
  return `HIST_run${String(entry.runIndex).padStart(4, '0')}_${stampOf(entry.capturedAt)}`;
}

/** Re-exports the archived pack PDF (built from the stored snapshot, not the live pack). */
export function downloadEntryPdf(entry: ReportHistoryEntry): string {
  return downloadPackPdf(entry.report.ctx, {
    tag: entryTag(entry),
    generatedLabel: `${new Date(entry.capturedAt).toLocaleString()} · archived ${triggerMeta(entry.trigger).label.toLowerCase()}`,
    archiveNote: `History entry ${entry.id} · run #${entry.runIndex} · ${formatClock(entry.sessionElapsedMs)} on the session clock`,
  });
}

/** Re-exports the archived pack CSV (summary + every cell of that snapshot). */
export function downloadEntryCsv(entry: ReportHistoryEntry): string {
  return downloadPackCsv(entry.report.ctx, entryTag(entry));
}

/** The raw archived snapshot as JSON — cells, telemetry, energy, alarms and waveforms. */
export function downloadEntryJson(entry: ReportHistoryEntry): string {
  const filename = `BMS_HistoryEntry_${entryTag(entry)}.json`;
  deliverText(JSON.stringify(entry, null, 2), filename, 'application/json');
  return filename;
}

const HISTORY_CSV_HEADERS = [
  'index',
  'report_id',
  'captured_at_local',
  'captured_at_utc',
  'trigger',
  'note',
  'run_index',
  'run_duration',
  'session_clock',
  'ticks',
  'was_running',
  'chemistry',
  'topology',
  'cells',
  'mode',
  'load_profile',
  'pack_voltage_V',
  'pack_current_A',
  'pack_power_W',
  'pack_soc_percent',
  'pack_soh_percent',
  'energy_remaining_Wh',
  'avg_cell_V',
  'min_cell_V',
  'max_cell_V',
  'delta_mV',
  'avg_temp_C',
  'max_temp_C',
  'max_temp_cell',
  'faulty_cells',
  'balancing_cells',
  'alarm_records',
  'critical_alarms',
  'energy_out_Wh',
  'energy_in_Wh',
  'charge_out_Ah',
  'charge_in_Ah',
  'peak_discharge_A',
  'peak_charge_A',
  'peak_power_W',
  'contactor',
  'efficiency_percent',
  'c_rate',
];

function esc(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function entryRow(entry: ReportHistoryEntry, index: number): string[] {
  const s = entry.summary;
  return [
    String(index + 1),
    entry.id,
    new Date(entry.capturedAt).toLocaleString(),
    entry.capturedAt,
    triggerMeta(entry.trigger).label,
    entry.note,
    String(entry.runIndex),
    formatClock(entry.runElapsedMs),
    formatClock(entry.sessionElapsedMs),
    String(entry.tickCount),
    entry.isRunning ? 'yes' : 'no',
    entry.chemistry,
    entry.topology,
    String(s.cellCount),
    entry.mode,
    entry.profile,
    s.packVoltage.toFixed(4),
    s.packCurrent.toFixed(3),
    s.packPower.toFixed(2),
    s.packSoC.toFixed(2),
    s.packSoH.toFixed(2),
    s.energyRemainingWh.toFixed(2),
    s.avgVoltage.toFixed(4),
    s.minVoltage.toFixed(4),
    s.maxVoltage.toFixed(4),
    s.deltaMv.toFixed(2),
    s.avgTemperature.toFixed(2),
    s.maxTemperature.toFixed(2),
    String(s.maxTempCellId),
    String(s.faultyCells),
    String(s.balancingCells),
    String(s.alarmRecords),
    String(s.criticalAlarms),
    s.energyOutWh.toFixed(4),
    s.energyInWh.toFixed(4),
    s.chargeOutAh.toFixed(5),
    s.chargeInAh.toFixed(5),
    s.peakDischargeA.toFixed(3),
    s.peakChargeA.toFixed(3),
    s.peakPowerW.toFixed(2),
    s.contactor,
    s.efficiencyPct === null ? '' : s.efficiencyPct.toFixed(2),
    s.cRate === null ? '' : s.cRate.toFixed(3),
  ];
}

/** One row per archived report — the whole History as an Excel-ready index. */
export function downloadHistoryCsv(store: ReportHistoryStore): string {
  const lines: string[][] = [
    ['BMS Report History'],
    ['Exported (UTC)', new Date().toISOString()],
    ['Reports archived', String(store.entries.length)],
    ['Simulation runs recorded', String(store.runCount)],
    [],
    HISTORY_CSV_HEADERS,
    ...store.entries.map(entryRow),
  ];
  const filename = `BMS_ReportHistory_${store.entries.length}reports_${stampOf(new Date().toISOString())}.csv`;
  deliverText(`\uFEFF${lines.map((l) => l.map(esc).join(',')).join('\r\n')}`, filename, 'text/csv');
  return filename;
}

/** Whole archive (metadata + every stored snapshot) as JSON. */
export function downloadHistoryJson(store: ReportHistoryStore): string {
  const filename = `BMS_ReportHistory_${store.entries.length}reports_${stampOf(new Date().toISOString())}.json`;
  deliverText(
    JSON.stringify({ ...store, exportedAt: new Date().toISOString() }, null, 2),
    filename,
    'application/json'
  );
  return filename;
}

/** Approximate on-disk size of the archive, for the storage read-out. */
export function historyBytes(store: ReportHistoryStore): number {
  try {
    return JSON.stringify(store).length;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Group entries by the simulation run they belong to (newest run first). */
export function groupByRun(store: ReportHistoryStore): { runIndex: number; entries: ReportHistoryEntry[] }[] {
  const map = new Map<number, ReportHistoryEntry[]>();
  for (const e of store.entries) {
    const list = map.get(e.runIndex);
    if (list) list.push(e);
    else map.set(e.runIndex, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([runIndex, entries]) => ({ runIndex, entries }));
}
