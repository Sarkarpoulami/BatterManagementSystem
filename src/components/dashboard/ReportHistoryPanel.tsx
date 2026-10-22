import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  Braces,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FileSpreadsheet,
  FileText,
  Gauge,
  Hash,
  History as HistoryIcon,
  ListFilter,
  Play,
  Search,
  Square,
  Thermometer,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { LiveLineChart } from '../charts/LiveLineChart';
import { playCellClickSound } from '../../utils/audio';
import { formatClock } from '../../utils/reportGenerator';
import {
  AUTO_CAPTURE_INTERVAL_MS,
  MAX_HISTORY_ENTRIES,
  TRIGGER_ORDER,
  downloadEntryCsv,
  downloadEntryJson,
  downloadEntryPdf,
  downloadHistoryCsv,
  downloadHistoryJson,
  formatBytes,
  historyBytes,
  triggerMeta,
  type HistoryTrigger,
  type ReportHistoryEntry,
  type ReportHistoryStore,
} from '../../utils/reportHistory';

interface ReportHistoryPanelProps {
  /** The archived reports, newest first. */
  history: ReportHistoryStore;
  autoCapture: boolean;
  isRunning: boolean;
  onToggleAutoCapture: (next: boolean) => void;
  /** Archives the pack state at this instant. */
  onCaptureNow: () => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
  onOpenLiveReport: () => void;
}

function Stat({ label, value, sub, accent = 'text-white' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500 font-bold">{label}</div>
      <div className={`text-sm font-mono font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-[9.5px] text-slate-500 font-mono truncate">{sub}</div>}
    </div>
  );
}

function TriggerBadge({ trigger }: { trigger: HistoryTrigger }) {
  const meta = triggerMeta(trigger);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-bold font-mono ${meta.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.short}
    </span>
  );
}

function Metric({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-[0.1em] text-slate-500 font-bold">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-base font-mono font-bold ${accent}`}>{value}</span>
        {unit && <span className="text-[9.5px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function EntryDetail({ entry, onDelete }: { entry: ReportHistoryEntry; onDelete: (id: string) => void }) {
  const ctx = entry.report.ctx;
  const snaps = ctx.snapshots;
  const s = entry.summary;
  const alarms = ctx.alarmHistory ?? [];

  return (
    <div className="border-t border-slate-800 bg-[#070d1a] px-3 py-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Pack voltage" value={s.packVoltage.toFixed(2)} unit="V" accent="text-cyan-300" />
        <Metric label="Pack current" value={`${s.packCurrent > 0 ? '+' : ''}${s.packCurrent.toFixed(2)}`} unit="A" accent="text-amber-300" />
        <Metric label="SoC" value={s.packSoC.toFixed(1)} unit="%" accent="text-emerald-300" />
        <Metric label="SoH" value={s.packSoH.toFixed(1)} unit="%" accent="text-purple-300" />
        <Metric label="Cell delta" value={s.deltaMv.toFixed(1)} unit="mV" accent={s.deltaMv > 50 ? 'text-rose-400' : 'text-slate-200'} />
        <Metric label="Peak temp" value={s.maxTemperature.toFixed(1)} unit={`°C · #${s.maxTempCellId}`} accent={s.maxTemperature > 50 ? 'text-rose-400' : 'text-slate-200'} />
        <Metric label="Energy out" value={s.energyOutWh.toFixed(2)} unit="Wh" accent="text-slate-200" />
        <Metric label="Energy in" value={s.energyInWh.toFixed(2)} unit="Wh" accent="text-slate-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-bold text-white">Pack voltage & current</span>
            <span className="text-[9.5px] font-mono text-slate-500">{snaps.length} stored samples</span>
          </div>
          <LiveLineChart
            compact
            height={150}
            emptyHint="No waveform samples in this archived report"
            series={[
              { id: 'v', label: 'Vpack', color: '#22d3ee', values: snaps.map((p) => p.packVoltage), fill: true, unit: 'V', minSpan: 0.05, digits: 3 },
              { id: 'i', label: 'Ipack', color: '#fbbf24', values: snaps.map((p) => p.packCurrent), axis: 'right', dashed: true, unit: 'A', minSpan: 1, digits: 2 },
            ]}
          />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-bold text-white">SoC & peak temperature</span>
            <span className="text-[9.5px] font-mono text-slate-500">{snaps.length} stored samples</span>
          </div>
          <LiveLineChart
            compact
            height={150}
            emptyHint="No waveform samples in this archived report"
            series={[
              { id: 'soc', label: 'SoC', color: '#34d399', values: snaps.map((p) => p.packSoC), fill: true, unit: '%', minSpan: 0.5, digits: 2 },
              { id: 'tmax', label: 'Tmax', color: '#fb7185', values: snaps.map((p) => p.maxTemp), axis: 'right', dashed: true, unit: '°C', minSpan: 1, digits: 1 },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-bold text-white">Cell snapshot at capture</span>
            <span className="text-[9.5px] font-mono text-slate-500">{ctx.cells.length} cells · {s.faultyCells} faulty · {s.balancingCells} balancing</span>
          </div>
          <div className="overflow-auto max-h-52 rounded-lg border border-slate-800">
            <table className="w-full text-[10.5px] font-mono">
              <thead className="bg-slate-900 text-slate-400 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1">#</th>
                  <th className="text-right px-2 py-1">Voltage</th>
                  <th className="text-right px-2 py-1">SoC</th>
                  <th className="text-right px-2 py-1">Temp</th>
                  <th className="text-right px-2 py-1">IR</th>
                  <th className="text-left px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {ctx.cells.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-2 py-1 text-white font-bold">{c.id}</td>
                    <td className="px-2 py-1 text-right text-cyan-300">{c.voltage.toFixed(3)} V</td>
                    <td className="px-2 py-1 text-right text-emerald-300">{c.soc.toFixed(2)}%</td>
                    <td className={`px-2 py-1 text-right ${c.temperature > 50 ? 'text-rose-400' : ''}`}>{c.temperature.toFixed(1)}°C</td>
                    <td className="px-2 py-1 text-right text-purple-300">{c.internalResistance.toFixed(1)}</td>
                    <td className="px-2 py-1 text-slate-400">{c.faultType !== 'none' ? c.faultType.replace(/_/g, ' ') : c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-bold text-white">Alarms recorded</span>
              <span className="text-[9.5px] font-mono text-slate-500">{alarms.length} total · {s.criticalAlarms} critical</span>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {alarms.length === 0 && <div className="text-[10.5px] text-slate-500 font-mono">No alarms in the log at this capture.</div>}
              {alarms.slice(0, 12).map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 text-[10px] font-mono bg-slate-900/70 border border-slate-800 rounded px-1.5 py-1">
                  <span className={a.severity === 'critical' ? 'text-rose-400 font-bold' : 'text-amber-400'}>{a.severity === 'critical' ? 'CRIT' : 'WARN'}</span>
                  <span className="text-slate-300 truncate">{a.title}</span>
                  <span className="text-slate-500 ml-auto shrink-0">{a.outcome}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
            <div className="text-[10.5px] font-bold text-white mb-1.5">Event log at capture</div>
            <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[10px]">
              {ctx.logs.length === 0 && <div className="text-slate-500">Empty log.</div>}
              {ctx.logs.slice(0, 12).map((l) => (
                <div key={l.id} className="bg-slate-900/70 border border-slate-800 rounded px-1.5 py-1">
                  <span className="text-slate-500">{l.timestamp}</span>{' '}
                  <span className={l.type === 'fault' ? 'text-rose-400' : l.type === 'warning' ? 'text-amber-400' : 'text-slate-300'}>{l.type}</span>{' '}
                  <span className="text-slate-300">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => downloadEntryPdf(entry)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-700 text-white cursor-pointer hover:bg-rose-600"
        >
          <FileText className="w-3.5 h-3.5" /> Report PDF
        </button>
        <button
          onClick={() => downloadEntryCsv(entry)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-700 text-white cursor-pointer hover:bg-emerald-600"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Report CSV
        </button>
        <button
          onClick={() => downloadEntryJson(entry)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-700 text-white cursor-pointer hover:bg-slate-600"
        >
          <Braces className="w-3.5 h-3.5" /> Snapshot JSON
        </button>
        <span className="text-[10px] font-mono text-slate-500">Re-built from the stored snapshot, not the live pack</span>
        <button
          onClick={() => onDelete(entry.id)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 border border-rose-900/70 text-rose-300 cursor-pointer hover:bg-rose-950/50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete entry
        </button>
      </div>
    </div>
  );
}

export function ReportHistoryPanel({
  history,
  autoCapture,
  isRunning,
  onToggleAutoCapture,
  onCaptureNow,
  onDeleteEntry,
  onClearHistory,
  onOpenLiveReport,
}: ReportHistoryPanelProps) {
  const [trigger, setTrigger] = useState<HistoryTrigger | 'all'>('all');
  const [runFilter, setRunFilter] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [flash]);

  const runs = useMemo(() => {
    const set = new Set<number>();
    history.entries.forEach((e) => set.add(e.runIndex));
    return [...set].sort((a, b) => b - a);
  }, [history.entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.entries.filter((e) => {
      if (trigger !== 'all' && e.trigger !== trigger) return false;
      if (runFilter !== 'all' && e.runIndex !== runFilter) return false;
      if (!q) return true;
      return [e.id, e.note, e.label, e.chemistry, e.topology, e.mode, e.profile, triggerMeta(e.trigger).label]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [history.entries, trigger, runFilter, query]);

  const bytes = useMemo(() => historyBytes(history), [history]);
  const lastCapture = history.entries[0]?.capturedAt ?? null;

  // Downloads run synchronously inside the click handler so the browser keeps the user gesture.
  const runExport = (fn: () => string, label: string) => {
    setError(null);
    try {
      const name = fn();
      playCellClickSound(820);
      setFlash(`${label} → ${name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleRow = (id: string) => {
    playCellClickSound(620);
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      {/* Title bar */}
      <div className="rounded-2xl border border-slate-800 bg-[#08101f] p-3.5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              History
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-800 text-slate-300 border-slate-700">
                <Archive className="w-3 h-3" /> {history.entries.length} / {MAX_HISTORY_ENTRIES} reports
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                isRunning ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {isRunning ? <Play className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                {isRunning ? 'recording' : 'idle'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Every report captured while the simulation runs — archived in this browser, offline, and re-exportable as PDF / CSV / JSON at any time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { onCaptureNow(); playCellClickSound(760); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-cyan-700 text-white cursor-pointer hover:bg-cyan-600"
            >
              <Camera className="w-3.5 h-3.5" /> Record report now
            </button>
            <button
              onClick={onOpenLiveReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer hover:bg-slate-700"
            >
              <Activity className="w-3.5 h-3.5" /> Live report
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat label="Reports" value={String(history.entries.length)} sub={`cap ${MAX_HISTORY_ENTRIES}`} accent="text-purple-300" />
          <Stat label="Runs recorded" value={String(history.runCount)} sub={`${runs.length} in view`} accent="text-cyan-300" />
          <Stat label="Last capture" value={lastCapture ? new Date(lastCapture).toLocaleTimeString() : '—'} sub={lastCapture ? new Date(lastCapture).toLocaleDateString() : 'nothing yet'} />
          <Stat label="Storage used" value={formatBytes(bytes)} sub="localStorage" accent="text-emerald-300" />
          <Stat label="Auto-record" value={autoCapture ? 'ON' : 'OFF'} sub={`every ${AUTO_CAPTURE_INTERVAL_MS / 1000} s while running`} accent={autoCapture ? 'text-emerald-300' : 'text-slate-400'} />
          <Stat label="Saved" value={history.savedAt ? new Date(history.savedAt).toLocaleTimeString() : '—'} sub={history.savedAt ? 'archive written' : 'not written yet'} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCapture}
              onChange={(e) => onToggleAutoCapture(e.target.checked)}
              className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
            />
            Auto-record checkpoints while the simulation runs
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => runExport(() => downloadHistoryCsv(history), 'History index exported')}
              disabled={!history.entries.length}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-800/70 border border-emerald-700 text-emerald-100 cursor-pointer hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export index CSV
            </button>
            <button
              onClick={() => runExport(() => downloadHistoryJson(history), 'History archive exported')}
              disabled={!history.entries.length}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Braces className="w-3.5 h-3.5" /> Export all JSON
            </button>
            {confirmClear ? (
              <span className="inline-flex items-center gap-1.5">
                <button
                  onClick={() => { onClearHistory(); setConfirmClear(false); playCellClickSound(520); }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-700 text-white cursor-pointer"
                >
                  Confirm clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={!history.entries.length}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 border border-rose-900/70 text-rose-300 cursor-pointer hover:bg-rose-950/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear history
              </button>
            )}
          </div>
        </div>

        {flash && (
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 font-mono">
            <Database className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{flash}</span>
          </div>
        )}
        {error && (
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            <X className="w-3.5 h-3.5 shrink-0" /> Export failed: {error}
          </div>
        )}
      </div>

      {/* Filters */}
      {history.entries.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[#08101f] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              <ListFilter className="w-3.5 h-3.5" /> Filter
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setTrigger('all')}
                className={`px-2 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer ${
                  trigger === 'all' ? 'bg-cyan-500 text-slate-950 border-cyan-300' : 'bg-[#0b1220] text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                All {history.entries.length}
              </button>
              {TRIGGER_ORDER.map((t) => {
                const count = history.entries.filter((e) => e.trigger === t).length;
                if (!count) return null;
                const meta = triggerMeta(t);
                return (
                  <button
                    key={t}
                    onClick={() => setTrigger(t)}
                    className={`px-2 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer ${
                      trigger === t ? meta.chip : 'bg-[#0b1220] text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {meta.label} {count}
                  </button>
                );
              })}
            </div>
            <label className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-400">
              <Hash className="w-3 h-3" /> Run
              <select
                value={runFilter}
                onChange={(e) => setRunFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-md px-1.5 py-1 text-[10.5px] font-mono text-slate-100 cursor-pointer"
              >
                <option value="all">All runs</option>
                {runs.map((r) => (
                  <option key={r} value={r}>Run #{r}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 ml-auto text-[10.5px] text-slate-400 bg-[#0b1220] border border-slate-700 rounded-md px-2 py-1">
              <Search className="w-3 h-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search chemistry, mode, note…"
                className="bg-transparent outline-none text-[10.5px] font-mono text-slate-100 placeholder:text-slate-600 w-44"
              />
            </label>
          </div>
        </div>
      )}

      {/* Empty state */}
      {history.entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-[#070d1a] p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-800/70 border border-slate-700 flex items-center justify-center text-slate-400">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <div className="mt-3 text-sm font-bold text-white">No reports recorded yet</div>
          <p className="mt-1 text-[11.5px] text-slate-400 max-w-xl mx-auto">
            Press <span className="text-emerald-300 font-bold">RUN</span> — a report is archived the moment the simulation starts, again when it stops,
            and every {AUTO_CAPTURE_INTERVAL_MS / 1000} s in between. The archive survives reloads and keeps up to {MAX_HISTORY_ENTRIES} reports.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => { onCaptureNow(); playCellClickSound(760); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-cyan-700 text-white cursor-pointer hover:bg-cyan-600"
            >
              <Camera className="w-3.5 h-3.5" /> Record the current pack now
            </button>
            <button
              onClick={onOpenLiveReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer hover:bg-slate-700"
            >
              <Activity className="w-3.5 h-3.5" /> Open live report
            </button>
          </div>
        </div>
      )}

      {/* Entry list */}
      {history.entries.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[#08101f] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-[#0c1424]">
            <span className="text-[11px] font-bold text-white">
              Archived reports <span className="text-slate-500 font-mono">({filtered.length} shown)</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">newest first · click a row to open the snapshot</span>
          </div>

          {filtered.length === 0 && (
            <div className="p-6 text-center text-[11.5px] text-slate-400">No report matches these filters.</div>
          )}

          <div className="divide-y divide-slate-800/80">
            {filtered.map((entry) => {
              const open = openId === entry.id;
              const s = entry.summary;
              return (
                <div key={entry.id} className={open ? 'bg-[#0a1322]' : ''}>
                  <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-900/50 cursor-pointer" onClick={() => toggleRow(entry.id)}>
                    {open ? <ChevronDown className="w-4 h-4 text-cyan-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TriggerBadge trigger={entry.trigger} />
                        <span className="text-[11px] font-mono font-bold text-white">{new Date(entry.capturedAt).toLocaleTimeString()}</span>
                        <span className="text-[10px] font-mono text-slate-500">{new Date(entry.capturedAt).toLocaleDateString()}</span>
                        <span className="text-[10px] font-mono text-slate-400">run #{entry.runIndex}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
                          <Timer className="w-3 h-3" /> {formatClock(entry.runElapsedMs)} run · {formatClock(entry.sessionElapsedMs)} session
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{entry.tickCount} ticks</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-mono text-slate-400">
                        <span className="text-slate-200 font-bold">{entry.label}</span>
                        <span>{entry.mode.replace(/_/g, ' ')}</span>
                        <span className="text-slate-600">·</span>
                        <span>{entry.profile.replace(/_/g, ' ')}</span>
                        <span className="text-slate-600">·</span>
                        <span className="truncate text-slate-500">{entry.note}</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-[10.5px] font-mono shrink-0">
                      <span className="inline-flex items-center gap-1 text-cyan-300"><Zap className="w-3 h-3" />{s.packVoltage.toFixed(2)} V</span>
                      <span className="inline-flex items-center gap-1 text-amber-300"><Gauge className="w-3 h-3" />{s.packCurrent.toFixed(1)} A</span>
                      <span className="inline-flex items-center gap-1 text-emerald-300"><Activity className="w-3 h-3" />{s.packSoC.toFixed(1)}%</span>
                      <span className={`inline-flex items-center gap-1 ${s.maxTemperature > 50 ? 'text-rose-400' : 'text-slate-400'}`}>
                        <Thermometer className="w-3 h-3" />{s.maxTemperature.toFixed(1)}°C
                      </span>
                      <span className={`inline-flex items-center gap-1 ${s.deltaMv > 50 ? 'text-rose-400' : 'text-slate-400'}`}><Clock3 className="w-3 h-3" />Δ{s.deltaMv.toFixed(0)}mV</span>
                      {s.alarmRecords > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold">
                          {s.alarmRecords} alarm{s.alarmRecords > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => runExport(() => downloadEntryPdf(entry), 'Archived PDF exported')}
                        title="Download this archived report as PDF"
                        className="p-1.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 cursor-pointer hover:bg-rose-500/20"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => runExport(() => downloadEntryCsv(entry), 'Archived CSV exported')}
                        title="Download this archived report as CSV"
                        className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 cursor-pointer hover:bg-emerald-500/20"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { onDeleteEntry(entry.id); if (openId === entry.id) setOpenId(null); playCellClickSound(520); }}
                        title="Delete this entry"
                        className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 cursor-pointer hover:text-rose-300 hover:border-rose-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {open && <EntryDetail entry={entry} onDelete={(id) => { onDeleteEntry(id); setOpenId(null); }} />}
                </div>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-slate-800 bg-[#0c1424] text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>archive id: bms.report.history.v1</span>
            <span>{formatBytes(bytes)} stored</span>
            {history.savedAt && <span>written {new Date(history.savedAt).toLocaleString()}</span>}
            <span className="ml-auto">oldest entries are dropped automatically once the cap is reached</span>
          </div>
        </div>
      )}
    </div>
  );
}
