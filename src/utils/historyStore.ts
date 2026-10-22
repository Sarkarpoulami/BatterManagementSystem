// Run-history store: keeps a durable record of every simulation report so users
// can revisit, export or delete past runs. Persisted offline in localStorage.

import type { StoredReport, ReportContext } from './reportGenerator';

export interface HistoryEntrySummary {
  chemistryId: string;
  chemistry: string;
  topology: string;
  mode: string;
  profile: string;
  runMs: number;
  ticks: number;
  socStart: number | null;
  socEnd: number;
  packVoltageEnd: number;
  deltaMvEnd: number;
  maxTempEnd: number;
  energyOutWh: number;
  energyInWh: number;
  peakDischargeA: number;
  peakChargeA: number;
  alarmCount: number;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  trigger: 'run-end' | 'manual';
  label: string;
  report: StoredReport;
  summary: HistoryEntrySummary;
}

const KEY = 'bms.history.v1';
const MAX_ENTRIES = 60;

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function buildHistoryEntry(
  report: StoredReport,
  trigger: 'run-end' | 'manual',
  runMs: number,
  socStart: number | null,
  alarmCount: number
): HistoryEntry {
  const trimmed = trimReport(report);
  const t = trimmed.ctx.telemetry;
  const e = trimmed.ctx.energy;
  return {
    id: trimmed.id,
    createdAt: trimmed.createdAt,
    trigger,
    label: trimmed.label,
    report: trimmed,
    summary: {
      chemistryId: trimmed.ctx.chemistrySpec.id,
      chemistry: trimmed.session.chemistry,
      topology: trimmed.session.topology,
      mode: trimmed.session.mode,
      profile: trimmed.session.profile,
      runMs: Math.max(0, num(runMs, 0)),
      ticks: Math.max(0, num(trimmed.session.tickCount, 0)),
      socStart: socStart === null ? null : Math.max(0, Math.min(100, num(socStart, 0))),
      socEnd: Math.max(0, Math.min(100, num(t.packSoC, 0))),
      packVoltageEnd: num(t.packVoltage, 0),
      deltaMvEnd: num(t.deltaVoltage, 0),
      maxTempEnd: num(t.maxTemperature, 25),
      energyOutWh: e ? Math.max(0, num(e.whOut, 0)) : 0,
      energyInWh: e ? Math.max(0, num(e.whIn, 0)) : 0,
      peakDischargeA: e ? Math.max(0, num(e.peakDischargeA, 0)) : 0,
      peakChargeA: e ? Math.max(0, num(e.peakChargeA, 0)) : 0,
      alarmCount: Math.max(0, num(alarmCount, 0)),
    },
  };
}

/**
 * Shrinks a stored report for archival: per-cell voltage/temperature history and
 * long event logs dominate the payload. Clones everything — never mutates the
 * live report or pack state. Charts and tables stay fully functional with these
 * windows (60 points/cell, 120 pack samples, 40 log lines).
 */
function trimReport(report: StoredReport): StoredReport {
  const ctx: ReportContext = {
    ...report.ctx,
    cells: report.ctx.cells.map((c) => ({ ...c, history: c.history.slice(-60) })),
    snapshots: report.ctx.snapshots.slice(-120),
    logs: report.ctx.logs.slice(0, 40),
  };
  return { ...report, ctx };
}

/** ~3.5 MB budget leaves headroom under the typical 5 MB localStorage quota. */
const QUOTA_BYTES = 3_500_000;

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    let list = entries.slice(0, MAX_ENTRIES);
    // Drop oldest entries until the serialized payload fits the quota
    while (list.length > 1) {
      const payload = JSON.stringify(list);
      if (payload.length <= QUOTA_BYTES) {
        localStorage.setItem(KEY, payload);
        return;
      }
      list = list.slice(0, list.length - 1);
    }
    if (list.length > 0) localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked — history is best-effort */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e === 'object' && e.report && e.summary && typeof e.id === 'string')
      .slice(0, MAX_ENTRIES) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function appendHistoryEntry(entry: HistoryEntry, existing: HistoryEntry[]): HistoryEntry[] {
  return [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
}

export function clearHistoryStorage(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
