import { useEffect, useState } from 'react';
import { History, Trash2, Eye, RefreshCw, FileText } from 'lucide-react';
import type { ChemistrySpec } from '../../types/battery';

export interface HistoryReport {
  id: number;
  createdAt: string;
  title: string;
  chemistry: string;
  seriesCount: number;
  parallelCount: number;
  simulationMode: string;
  loadProfile: string;
  elapsedMs: number;
  tickCount: number;
  packVoltage: number | null;
  packCurrent: number | null;
  packPower: number | null;
  packSoC: number | null;
  packSoH: number | null;
  reportData: Record<string, unknown>;
}

interface HistoryPanelProps {
  spec: ChemistrySpec;
  onViewReport: (report: HistoryReport) => void;
}

function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function HistoryPanel({ onViewReport }: HistoryPanelProps) {
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: number) => {
    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* best effort */
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const viewJson = async (report: HistoryReport) => {
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bms-report-${report.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    onViewReport(report);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <History className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold">Simulation History</h2>
        </div>
        <button
          onClick={fetchHistory}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 hover:bg-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0c1424] p-3 text-xs text-slate-400">
        Every Run/Stop cycle is archived here with the full electrical snapshot: pack voltage, current, power,
        SoC/SoH, topology and the complete report payload.
      </div>

      {loading && <div className="text-slate-400 text-sm py-8 text-center">Loading history…</div>}
      {error && (
        <div className="rounded-md border border-rose-900 bg-rose-950/40 text-rose-300 text-xs px-3 py-2">
          {error} — the archive will be available once the database is provisioned on deploy.
        </div>
      )}
      {!loading && !error && reports.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center border border-dashed border-slate-800 rounded-lg">
          No simulation reports saved yet. Run a simulation and press Stop to archive a report.
        </div>
      )}

      <div className="space-y-2">
        {reports.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border border-slate-800 bg-[#0b1220] p-3 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{r.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(r.createdAt).toLocaleString()} · {r.chemistry.toUpperCase()} · {r.seriesCount}S{r.parallelCount}P ·{' '}
                  {r.simulationMode.replace('_', ' ')} · {formatClock(r.elapsedMs)} · {r.tickCount} ticks
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px] font-mono">
                  <span className="text-cyan-300">{r.packVoltage?.toFixed(2) ?? '—'} V</span>
                  <span className="text-amber-300">{r.packCurrent?.toFixed(2) ?? '—'} A</span>
                  <span className="text-emerald-300">{r.packPower?.toFixed(1) ?? '—'} W</span>
                  <span className="text-violet-300">{r.packSoC?.toFixed(1) ?? '—'} % SoC</span>
                  <span className="text-slate-300">{r.packSoH?.toFixed(1) ?? '—'} % SoH</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onViewReport(r)}
                  title="View report details"
                  className="p-1.5 rounded-md bg-cyan-900/50 text-cyan-300 border border-cyan-800 hover:bg-cyan-800/60 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => viewJson(r)}
                  title="Download JSON"
                  className="p-1.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteReport(r.id)}
                  title="Delete record"
                  className="p-1.5 rounded-md bg-rose-900/50 text-rose-300 border border-rose-800 hover:bg-rose-800/60 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
