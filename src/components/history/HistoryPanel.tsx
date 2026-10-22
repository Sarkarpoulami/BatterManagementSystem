import { useState } from 'react';
import type { HistoryEntry } from '../../utils/historyStore';
import { formatClock, formatDuration } from '../../utils/reportGenerator';
import {
  History as HistoryIcon,
  Eye,
  FileSpreadsheet,
  FileText,
  Trash2,
  PlusCircle,
  Info,
  BatteryCharging,
  Zap,
  Thermometer,
  Siren,
} from 'lucide-react';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  isRunning: boolean;
  onView: (e: HistoryEntry) => void;
  onPdf: (e: HistoryEntry) => void;
  onCsv: (e: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onCapture: () => void;
}

function SoCCursor({ start, end }: { start: number | null; end: number }) {
  const s = start === null ? null : Math.max(0, Math.min(100, start));
  return (
    <div className="flex items-center gap-1 text-[10px] font-mono">
      {s !== null && (
        <>
          <span className="text-slate-500">{s.toFixed(1)}%</span>
          <span className="text-slate-600">→</span>
        </>
      )}
      <span className="text-emerald-300 font-bold">{end.toFixed(1)}%</span>
      <span className="text-slate-500">SoC</span>
    </div>
  );
}

export function HistoryPanel({ entries, isRunning, onView, onPdf, onCsv, onDelete, onClear, onCapture }: HistoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const armClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    setConfirmClear(false);
    onClear();
  };

  const totalRuns = entries.length;
  const latest = entries[0];

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <HistoryIcon className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-bold text-white">Run history</h2>
        <span className="text-[11px] text-slate-500 font-mono">
          Every simulation run is recorded here as a full report — open, export or delete past runs.
        </span>
      </div>

      {/* Summary + actions */}
      <div className="rounded-xl border border-slate-800 bg-[#0a1222] p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="text-slate-400">
            Runs recorded <span className="text-cyan-300 font-bold">{totalRuns}</span>
          </span>
          {latest && (
            <span className="text-slate-500">
              Latest <span className="text-slate-300">{new Date(latest.createdAt).toLocaleString()}</span> · {latest.summary.chemistry} {latest.summary.topology} · run {formatDuration(latest.summary.runMs)}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onCapture}
            disabled={isRunning}
            title={isRunning ? 'Stop the simulation first — a report is recorded automatically when you stop' : 'Record the current pack state as a report in history'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              isRunning
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-700 hover:bg-cyan-600 text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" /> Record current state
          </button>
          <button
            onClick={armClear}
            disabled={entries.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
              confirmClear
                ? 'bg-rose-600 border-rose-500 text-white'
                : 'bg-[#0b1220] border-slate-700 text-slate-300 hover:text-white'
            } ${entries.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Trash2 className="w-3.5 h-3.5" /> {confirmClear ? 'Confirm clear' : 'Clear history'}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-500/70" />
        <span>
          Reports are captured automatically the moment a simulation run is stopped, and stored offline in this browser —
          they survive reloads and work with no internet. Use <span className="text-slate-300">Record current state</span> to
          snapshot the pack manually at any time.
        </span>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0a1222] p-6 text-center">
          <BatteryCharging className="w-6 h-6 mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">
            No runs recorded yet. Press <span className="text-emerald-400 font-bold">Run</span> in the control panel, then{' '}
            <span className="text-rose-400 font-bold">Stop</span> — the generated report will be archived here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div
              key={e.id}
              className="rounded-xl border border-slate-800 bg-[#0a1222] p-3 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <div className="w-10 shrink-0 text-center">
                <div className={`text-sm font-mono font-bold ${i === 0 ? 'text-cyan-300' : 'text-slate-500'}`}>#{totalRuns - i}</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-600">{e.trigger === 'run-end' ? 'run end' : 'manual'}</div>
              </div>
              <div className="min-w-[190px]">
                <div className="text-xs font-bold text-white">
                  {e.summary.chemistry} · {e.summary.topology}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {new Date(e.createdAt).toLocaleString()} · mode {e.summary.mode.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono">
                <span className="text-slate-400">
                  ⏱ {formatDuration(e.summary.runMs)} · {e.summary.ticks} ticks
                </span>
                <SoCCursor start={e.summary.socStart} end={e.summary.socEnd} />
                <span className="text-cyan-300 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {e.summary.packVoltageEnd.toFixed(1)} V
                </span>
                <span className="text-amber-300 flex items-center gap-1">
                  <Thermometer className="w-3 h-3" /> {e.summary.maxTempEnd.toFixed(0)}°C
                </span>
                <span className="text-slate-400">Δ {e.summary.deltaMvEnd.toFixed(0)} mV</span>
                {(e.summary.energyOutWh > 0 || e.summary.energyInWh > 0) && (
                  <span className="text-emerald-300">
                    {e.summary.energyOutWh.toFixed(1)} Wh out / {e.summary.energyInWh.toFixed(1)} Wh in
                  </span>
                )}
                <span className={`flex items-center gap-1 ${e.summary.alarmCount > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  <Siren className="w-3 h-3" /> {e.summary.alarmCount} alarm{e.summary.alarmCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => onView(e)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  <Eye className="w-3 h-3" /> View
                </button>
                <button
                  onClick={() => onCsv(e)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3 h-3" /> CSV
                </button>
                <button
                  onClick={() => onPdf(e)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  <FileText className="w-3 h-3" /> PDF
                </button>
                <button
                  onClick={() => onDelete(e.id)}
                  title="Delete this record"
                  className="p-1.5 rounded-md bg-[#0b1220] border border-slate-700 text-slate-400 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="text-[10px] text-slate-600 font-mono text-right">
          Keeping the {entries.length} most recent run report{entries.length === 1 ? '' : 's'} · stored offline in this browser
          {latest ? ` · last run ${formatClock(latest.summary.runMs)}` : ''}
        </div>
      )}
    </div>
  );
}
