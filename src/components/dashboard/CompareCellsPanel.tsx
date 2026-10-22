import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeftRight,
  BatteryCharging,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Coins,
  FileSpreadsheet,
  FileText,
  Flame,
  Gauge,
  Info,
  Layers,
  Lightbulb,
  Link2,
  Minus,
  Plus,
  RefreshCw,
  Ruler,
  Scale,
  ShieldAlert,
  Sigma,
  Target,
  Thermometer,
  TriangleAlert,
  Trophy,
  Zap,
} from 'lucide-react';
import type { BatteryChemistryType } from '../../types/battery';
import { BATTERY_CHEMISTRIES } from '../../data/batteryChemistryData';
import { playCellClickSound } from '../../utils/audio';
import { downloadComparisonCsv, downloadComparisonPdf } from '../../utils/comparisonExport';
import {
  CHEMISTRY_LABELS,
  COMPARE_CHEMISTRIES,
  PARALLEL_MAX,
  PARALLEL_MIN,
  SERIES_MAX,
  SERIES_MIN,
  compareChemistries,
  packMath,
  runtimeText,
  type CompareInput,
  type CompareRow,
  type Comparison,
  type PackMath,
  type Winner,
} from '../../utils/chemistryCompare';

interface CompareCellsPanelProps {
  /** Chemistry currently loaded in the live pack — Side A starts here. */
  liveChemistry: BatteryChemistryType;
  liveSeriesCount: number;
  liveParallelCount: number;
  /** Requested load current from the Control panel; seeds the "working load". */
  liveLoadCurrent: number;
  /** Pushes a compared build onto the live pack (chemistry + series + parallel). */
  onApplyToPack: (input: CompareInput) => void;
  /** Jumps to the electrical overview so the applied build can be run. */
  onOpenOverview: () => void;
}

const LOAD_MIN = 0.1;
const LOAD_MAX = 500;

/** The comparison workspace survives tab switches and reloads. */
const PREFS_KEY = 'bms.compare.inputs.v1';

interface ComparePrefs {
  aChem: BatteryChemistryType;
  bChem: BatteryChemistryType;
  aS: number;
  aP: number;
  bS: number;
  bP: number;
  linked: boolean;
  loadA: number;
}

function isChemistry(value: unknown): value is BatteryChemistryType {
  return typeof value === 'string' && (COMPARE_CHEMISTRIES as string[]).includes(value);
}

/** Saved workspace, falling back to the live pack for anything missing or out of range. */
function readPrefs(live: { chemistry: BatteryChemistryType; series: number; parallel: number; loadA: number }): ComparePrefs {
  const fallback: ComparePrefs = {
    aChem: live.chemistry,
    bChem: defaultOther(live.chemistry),
    aS: clamp(live.series, SERIES_MIN, SERIES_MAX),
    aP: clamp(live.parallel, PARALLEL_MIN, PARALLEL_MAX),
    bS: clamp(live.series, SERIES_MIN, SERIES_MAX),
    bP: clamp(live.parallel, PARALLEL_MIN, PARALLEL_MAX),
    linked: true,
    loadA: clamp(live.loadA, LOAD_MIN, LOAD_MAX),
  };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<ComparePrefs>;
    return {
      aChem: isChemistry(saved.aChem) ? saved.aChem : fallback.aChem,
      bChem: isChemistry(saved.bChem) ? saved.bChem : fallback.bChem,
      aS: clamp(Number(saved.aS) || fallback.aS, SERIES_MIN, SERIES_MAX),
      aP: clamp(Number(saved.aP) || fallback.aP, PARALLEL_MIN, PARALLEL_MAX),
      bS: clamp(Number(saved.bS) || fallback.bS, SERIES_MIN, SERIES_MAX),
      bP: clamp(Number(saved.bP) || fallback.bP, PARALLEL_MIN, PARALLEL_MAX),
      linked: typeof saved.linked === 'boolean' ? saved.linked : fallback.linked,
      loadA: clamp(Number(saved.loadA) || fallback.loadA, LOAD_MIN, LOAD_MAX),
    };
  } catch {
    return fallback; // storage blocked or unreadable — the workspace is best-effort
  }
}

function savePrefs(prefs: ComparePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore — persistence is best-effort */
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A different chemistry than `id`, so the two sides never start identical. */
function defaultOther(id: BatteryChemistryType): BatteryChemistryType {
  return COMPARE_CHEMISTRIES.find((c) => c !== id) ?? COMPARE_CHEMISTRIES[0];
}

function accentClasses(which: 'a' | 'b') {
  return which === 'a'
    ? {
        text: 'text-cyan-300',
        chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
        bar: 'bg-cyan-400',
        ring: 'border-cyan-500/40',
        soft: 'bg-cyan-500/10',
        solid: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      }
    : {
        text: 'text-violet-300',
        chip: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
        bar: 'bg-violet-400',
        ring: 'border-violet-500/40',
        soft: 'bg-violet-500/10',
        solid: 'bg-violet-600 hover:bg-violet-500 text-white',
      };
}

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  Cell: CircleDot,
  Electrical: Zap,
  'Pack build': Boxes,
  Thermal: Thermometer,
  'Life & cost': Coins,
  Construction: Layers,
  Application: Target,
};

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  hint: string;
  accent: 'a' | 'b';
}) {
  const a = accentClasses(accent);
  const step = (delta: number) => onChange(clamp(value + delta, min, max));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-400">{label}</span>
        <span className="text-[9.5px] font-mono text-slate-600">
          {min}–{max}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            playCellClickSound(accent === 'a' ? 480 : 420);
            step(-1);
          }}
          disabled={value <= min}
          title={`Decrease ${label}`}
          className="h-8 w-8 shrink-0 rounded-md bg-[#0b1220] border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed hover:text-white"
        >
          <Minus className="w-3.5 h-3.5 mx-auto" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min, min, max))}
          className={`w-full min-w-0 h-8 rounded-md bg-[#0b1220] border px-2 text-center text-sm font-mono font-bold outline-none focus:ring-1 ${a.text} ${a.ring} border-slate-700`}
        />
        <button
          onClick={() => {
            playCellClickSound(accent === 'a' ? 560 : 500);
            step(1);
          }}
          disabled={value >= max}
          title={`Increase ${label}`}
          className="h-8 w-8 shrink-0 rounded-md bg-[#0b1220] border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed hover:text-white"
        >
          <Plus className="w-3.5 h-3.5 mx-auto" />
        </button>
      </div>
      <div className="mt-1 text-[9.5px] text-slate-500 leading-tight">{hint}</div>
    </div>
  );
}

function Readout({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-[#070d1a] px-1.5 py-1">
      <div className="text-[8.5px] uppercase tracking-[0.08em] text-slate-500 font-bold truncate" title={label}>
        {label}
      </div>
      <div className={`text-[11px] font-mono font-bold truncate ${accent ?? 'text-slate-100'}`} title={`${value}${unit ? ` ${unit}` : ''}`}>
        {value}
        {unit && <span className="text-[9px] text-slate-500 font-normal"> {unit}</span>}
      </div>
    </div>
  );
}

function WinnerChip({ winner, aName, bName, small }: { winner: Winner; aName: string; bName: string; small?: boolean }) {
  if (winner === 'tie') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 text-slate-300 font-bold font-mono ${
          small ? 'px-1 py-px text-[8.5px]' : 'px-1.5 py-0.5 text-[9.5px]'
        }`}
        title="Effectively level"
      >
        <Scale className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> tie
      </span>
    );
  }
  const a = accentClasses(winner);
  const name = winner === 'a' ? aName : bName;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-bold font-mono ${a.chip} ${
        small ? 'px-1 py-px text-[8.5px]' : 'px-1.5 py-0.5 text-[9.5px]'
      }`}
      title={`${winner.toUpperCase()} leads`}
    >
      <Trophy className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> {name}
    </span>
  );
}

function ScoreBar({ score, accent, label }: { score: number; accent: 'a' | 'b'; label: string }) {
  const a = accentClasses(accent);
  const pct = clamp(score, 0, 100);
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${fmt(score, 1)} / 100`}>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-9 text-right text-[10.5px] font-mono font-bold ${a.text}`}>{fmt(score, 0)}</span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  aside,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#0b1220]">
        <span className="text-cyan-400">{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white">{title}</h3>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </header>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

function SpecTable({
  category,
  rows,
  aName,
  bName,
  defaultOpen,
}: {
  category: string;
  rows: CompareRow[];
  aName: string;
  bName: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = CATEGORY_ICONS[category] ?? Info;
  const leads = { a: 0, b: 0, tie: 0 };
  for (const r of rows) leads[r.winner] += 1;
  return (
    <div className="rounded-lg border border-slate-800 bg-[#070d1a] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-900/60"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        <Icon className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[11px] font-bold text-white">{category}</span>
        <span className="text-[9.5px] font-mono text-slate-500">{rows.length} parameters</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="text-[9px] font-mono text-cyan-300/90">{aName} {leads.a}</span>
          <span className="text-slate-600 text-[9px]">·</span>
          <span className="text-[9px] font-mono text-violet-300/90">{bName} {leads.b}</span>
          {leads.tie > 0 && <span className="text-[9px] font-mono text-slate-500">· tie {leads.tie}</span>}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-slate-800">
          <table className="w-full text-[10.5px]">
            <thead>
              <tr className="bg-[#0b1220] text-slate-500">
                <th className="text-left font-bold px-2.5 py-1.5 w-[26%]">Parameter</th>
                <th className="text-left font-bold px-2 py-1.5 text-cyan-300/90">A · {aName}</th>
                <th className="text-left font-bold px-2 py-1.5 text-violet-300/90">B · {bName}</th>
                <th className="text-center font-bold px-2 py-1.5 w-[13%]">Leads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.category}-${r.label}`} className="border-t border-slate-800/70 align-top">
                  <td className="px-2.5 py-1.5">
                    <div className="font-bold text-slate-200">{r.label}</div>
                    {r.note && <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{r.note}</div>}
                  </td>
                  <td
                    className={`px-2 py-1.5 font-mono ${
                      r.winner === 'a' ? 'text-cyan-200 bg-cyan-500/[0.07] font-bold' : 'text-slate-300'
                    }`}
                  >
                    {r.a}
                  </td>
                  <td
                    className={`px-2 py-1.5 font-mono ${
                      r.winner === 'b' ? 'text-violet-200 bg-violet-500/[0.07] font-bold' : 'text-slate-300'
                    }`}
                  >
                    {r.b}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <WinnerChip winner={r.winner} aName={aName} bName={bName} small />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SideCard({
  which,
  chem,
  onChem,
  seriesCount,
  parallelCount,
  onSeries,
  onParallel,
  pack,
  loadA,
  linked,
  onApply,
  applied,
}: {
  which: 'a' | 'b';
  chem: BatteryChemistryType;
  onChem: (c: BatteryChemistryType) => void;
  seriesCount: number;
  parallelCount: number;
  onSeries: (n: number) => void;
  onParallel: (n: number) => void;
  pack: PackMath;
  loadA: number;
  linked: boolean;
  onApply: () => void;
  applied: boolean;
}) {
  const spec = BATTERY_CHEMISTRIES[chem];
  const a = accentClasses(which);
  return (
    <div className={`rounded-xl border bg-slate-950/70 overflow-hidden ${a.ring}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${a.soft} border-b border-slate-800`}>
        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold font-mono ${a.chip}`}>SIDE {which.toUpperCase()}</span>
        <span className="text-[11px] font-bold text-white truncate">{spec.shortName}</span>
        <span className={`ml-auto text-[10px] font-mono font-bold ${a.text}`}>
          {seriesCount}S{parallelCount}P
        </span>
      </div>

      <div className="p-3 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-400">Cell chemistry</span>
          <select
            value={chem}
            onChange={(e) => onChem(e.target.value as BatteryChemistryType)}
            className="mt-1 w-full bg-[#0b1220] border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 cursor-pointer"
          >
            {COMPARE_CHEMISTRIES.map((id) => (
              <option key={id} value={id}>
                {BATTERY_CHEMISTRIES[id].shortName} — {CHEMISTRY_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-mono ${spec.badgeBg}`}>{spec.formFactorType}</span>
          <span className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-[9.5px] font-mono text-slate-300">
            {spec.nominalVoltage.toFixed(2)} V nominal
          </span>
          <span className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-[9.5px] font-mono text-slate-300">
            safety {spec.safetyRating}
          </span>
          <span className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-[9.5px] font-mono text-slate-300">
            cost {spec.costTier}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stepper
            label="Series"
            value={seriesCount}
            min={SERIES_MIN}
            max={SERIES_MAX}
            onChange={onSeries}
            accent={which}
            hint={linked ? `Sets pack voltage · linked to the other side` : `Sets pack voltage · ${seriesCount} × ${spec.nominalVoltage.toFixed(2)} V`}
          />
          <Stepper
            label="Parallel"
            value={parallelCount}
            min={PARALLEL_MIN}
            max={PARALLEL_MAX}
            onChange={onParallel}
            accent={which}
            hint={linked ? 'Sets capacity and current · linked' : `Sets capacity and current · ${parallelCount} branch${parallelCount === 1 ? '' : 'es'}`}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Pack nominal" value={fmt(pack.packNominalV, 1)} unit="V" accent={a.text} />
          <Readout label="Cells" value={String(pack.cellCount)} />
          <Readout label="Capacity" value={fmt(pack.capacityAh, pack.capacityAh < 10 ? 2 : 1)} unit="Ah" />
          <Readout label="Energy" value={fmt(pack.energyWh, pack.energyWh < 1000 ? 1 : 0)} unit="Wh" />
          <Readout label="Cell mass" value={fmt(pack.massKg, pack.massKg < 10 ? 2 : 1)} unit="kg" />
          <Readout label="Pack resistance" value={fmt(pack.packResistanceMohm, pack.packResistanceMohm < 10 ? 2 : 1)} unit="mΩ" />
          <Readout label="Max discharge" value={fmt(pack.maxDischargeA, pack.maxDischargeA < 100 ? 1 : 0)} unit="A" />
          <Readout label="Peak power" value={fmt(pack.peakDischargeW / 1000, pack.peakDischargeW < 10000 ? 2 : 1)} unit="kW" />
          <Readout label="Sag at max" value={fmt(pack.sagPct, 1)} unit="%" />
          <Readout label={`Runtime @ ${fmt(loadA, loadA < 10 ? 1 : 0)} A`} value={runtimeText(pack, loadA)} />
          <Readout label="Cycle life" value={pack.cycleLife.toLocaleString()} />
          <Readout label="Service @1/day" value={fmt(pack.serviceYearsPerDay, 1)} unit="yr" />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onApply}
            className={`flex-1 h-8 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${a.solid}`}
            title={`Load ${spec.shortName} at ${seriesCount}S${parallelCount}P into the live pack`}
          >
            {applied ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            {applied ? 'Applied to live pack' : 'Apply to live pack'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompareCellsPanel(props: CompareCellsPanelProps) {
  const { liveChemistry, liveSeriesCount, liveParallelCount, liveLoadCurrent, onApplyToPack, onOpenOverview } = props;

  // read the saved workspace once, on the first mount only
  const [initial] = useState(() =>
    readPrefs({
      chemistry: liveChemistry,
      series: liveSeriesCount,
      parallel: liveParallelCount,
      loadA: liveLoadCurrent || 12,
    })
  );

  const [aChem, setAChem] = useState<BatteryChemistryType>(initial.aChem);
  const [bChem, setBChem] = useState<BatteryChemistryType>(initial.bChem);
  const [aS, setAS] = useState<number>(initial.aS);
  const [aP, setAP] = useState<number>(initial.aP);
  const [bS, setBS] = useState<number>(initial.bS);
  const [bP, setBP] = useState<number>(initial.bP);
  const [linked, setLinked] = useState<boolean>(initial.linked);
  const [loadA, setLoadA] = useState<number>(initial.loadA);
  const [result, setResult] = useState<Comparison | null>(null);
  const [applied, setApplied] = useState<'a' | 'b' | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const aInput = useMemo<CompareInput>(() => ({ chemistry: aChem, seriesCount: aS, parallelCount: aP }), [aChem, aS, aP]);
  const bInput = useMemo<CompareInput>(() => ({ chemistry: bChem, seriesCount: bS, parallelCount: bP }), [bChem, bS, bP]);

  const aPack = useMemo(() => packMath(BATTERY_CHEMISTRIES[aChem], aS, aP), [aChem, aS, aP]);
  const bPack = useMemo(() => packMath(BATTERY_CHEMISTRIES[bChem], bS, bP), [bChem, bS, bP]);



  // The first comparison is ready as soon as the tab opens; later runs are explicit.
  useEffect(() => {
    setResult((prev) => prev ?? compareChemistries(aInput, bInput, loadA));
  }, []); // first paint only — later comparisons are generated on purpose

  useEffect(() => {
    savePrefs({ aChem, bChem, aS, aP, bS, bP, linked, loadA });
  }, [aChem, bChem, aS, aP, bS, bP, linked, loadA]);

  const generate = useCallback(() => {
    playCellClickSound(660);
    setResult(compareChemistries(aInput, bInput, loadA));
    setApplied(null);
    setLastExport(null);
  }, [aInput, bInput, loadA]);

  const stale =
    !!result &&
    (result.a.input.chemistry !== aChem ||
      result.a.input.seriesCount !== aS ||
      result.a.input.parallelCount !== aP ||
      result.b.input.chemistry !== bChem ||
      result.b.input.seriesCount !== bS ||
      result.b.input.parallelCount !== bP ||
      Math.abs(result.loadA - loadA) > 1e-6);

  const setSeries = (which: 'a' | 'b', n: number) => {
    const v = clamp(n, SERIES_MIN, SERIES_MAX);
    if (which === 'a') {
      setAS(v);
      if (linked) setBS(v);
    } else {
      setBS(v);
      if (linked) setAS(v);
    }
  };
  const setParallel = (which: 'a' | 'b', n: number) => {
    const v = clamp(n, PARALLEL_MIN, PARALLEL_MAX);
    if (which === 'a') {
      setAP(v);
      if (linked) setBP(v);
    } else {
      setBP(v);
      if (linked) setAP(v);
    }
  };

  const swap = () => {
    playCellClickSound(520);
    setAChem(bChem);
    setBChem(aChem);
    setAS(bS);
    setBS(aS);
    setAP(bP);
    setBP(aP);
    setApplied(null);
  };

  /** Copies the live pack's chemistry and topology onto one side (both, when linked). */
  const matchLive = (which: 'a' | 'b') => {
    playCellClickSound(600);
    const s = clamp(liveSeriesCount, SERIES_MIN, SERIES_MAX);
    const par = clamp(liveParallelCount, PARALLEL_MIN, PARALLEL_MAX);
    if (which === 'a' || linked) {
      setAChem(liveChemistry);
      setAS(s);
      setAP(par);
    }
    if (which === 'b' || linked) {
      setBChem(liveChemistry);
      setBS(s);
      setBP(par);
    }
  };

  const applySide = (which: 'a' | 'b') => {
    const input = which === 'a' ? aInput : bInput;
    playCellClickSound(720);
    onApplyToPack(input);
    setApplied(which);
  };

  /** Rebuilds the comparison from the inputs on screen right now. */
  const refresh = useCallback((): Comparison => {
    const next = compareChemistries(aInput, bInput, loadA);
    setResult(next);
    return next;
  }, [aInput, bInput, loadA]);

  /** Exports never describe a stale screen — regenerate first if the inputs moved. */
  const exportWith = (run: (cmp: Comparison) => string) => {
    const cmp = stale || !result ? refresh() : result;
    playCellClickSound(640);
    setLastExport(run(cmp));
  };
  const exportCsv = () => exportWith(downloadComparisonCsv);
  const exportPdf = () => exportWith(downloadComparisonPdf);

  const categories = useMemo(() => {
    if (!result) return [] as string[];
    const list: string[] = [];
    for (const row of result.rows) if (!list.includes(row.category)) list.push(row.category);
    return list;
  }, [result]);

  return (
    <div className="space-y-4 pb-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-[0.14em]">Cell comparison</h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-snug max-w-3xl">
            Pick two cell chemistries, set the series and parallel count on each side, and generate a weighted, descriptive
            comparison — scorecard, pack engineering, thermal and safety behaviour, life-cycle cost, use-case picks and
            recommendations. Numbers come from the same library the live simulator runs on.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            onClick={generate}
            className={`h-8 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border ${
              stale ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-cyan-600 text-white border-cyan-400 hover:bg-cyan-500'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${stale ? 'animate-spin' : ''}`} />
            {result ? (stale ? 'Update comparison' : 'Regenerate') : 'Generate comparison'}
          </button>
          <button
            onClick={exportCsv}
            disabled={!result}
            title="Download this comparison as CSV"
            className="h-8 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={exportPdf}
            disabled={!result}
            title="Download this comparison as a PDF report"
            className="h-8 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer bg-rose-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* ── Side A vs Side B ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-start">
        <SideCard
          which="a"
          chem={aChem}
          onChem={setAChem}
          seriesCount={aS}
          parallelCount={aP}
          onSeries={(n) => setSeries('a', n)}
          onParallel={(n) => setParallel('a', n)}
          pack={aPack}
          loadA={loadA}
          linked={linked}
          onApply={() => applySide('a')}
          applied={applied === 'a'}
        />

        <div className="xl:flex-col flex items-center justify-center gap-2 py-1">
          <button
            onClick={swap}
            title="Swap side A and side B"
            className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-700"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              playCellClickSound(440);
              setLinked((v) => !v);
            }}
            title={linked ? 'Topology is linked — both sides change together' : 'Topology is independent per side'}
            className={`h-9 w-9 rounded-full border flex items-center justify-center cursor-pointer ${
              linked ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Link2 className="w-4 h-4" />
          </button>
          <span className="hidden xl:block text-[9px] font-mono text-slate-500 text-center leading-tight max-w-[64px]">
            {linked ? 'topology linked' : 'independent'}
          </span>
        </div>

        <SideCard
          which="b"
          chem={bChem}
          onChem={setBChem}
          seriesCount={bS}
          parallelCount={bP}
          onSeries={(n) => setSeries('b', n)}
          onParallel={(n) => setParallel('b', n)}
          pack={bPack}
          loadA={loadA}
          linked={linked}
          onApply={() => applySide('b')}
          applied={applied === 'b'}
        />
      </div>

      {/* ── Working load + status ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-400">Working load</span>
          <input
            type="number"
            min={LOAD_MIN}
            max={LOAD_MAX}
            step={0.5}
            value={loadA}
            aria-label="Working load in amps"
            onChange={(e) => setLoadA(clamp(Number(e.target.value) || LOAD_MIN, LOAD_MIN, LOAD_MAX))}
            className="w-20 h-7 rounded-md bg-[#0b1220] border border-slate-700 px-2 text-[11px] text-right text-amber-300 font-mono outline-none focus:border-amber-400"
          />
          <span className="text-[10px] text-slate-500">A</span>
          <input
            type="range"
            min={LOAD_MIN}
            max={100}
            step={0.5}
            value={Math.min(loadA, 100)}
            aria-label="Working load slider"
            onChange={(e) => setLoadA(clamp(Number(e.target.value), LOAD_MIN, LOAD_MAX))}
            className="w-28 accent-amber-400 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => matchLive('a')}
            className="h-7 px-2 rounded-md text-[10px] font-bold bg-[#0b1220] border border-slate-700 text-cyan-300 cursor-pointer hover:bg-slate-800"
            title={`Set side A to the live pack (${BATTERY_CHEMISTRIES[liveChemistry].shortName} ${liveSeriesCount}S${liveParallelCount}P)`}
          >
            A = live pack
          </button>
          <button
            onClick={() => matchLive('b')}
            className="h-7 px-2 rounded-md text-[10px] font-bold bg-[#0b1220] border border-slate-700 text-violet-300 cursor-pointer hover:bg-slate-800"
            title={`Set side B to the live pack (${BATTERY_CHEMISTRIES[liveChemistry].shortName} ${liveSeriesCount}S${liveParallelCount}P)`}
          >
            B = live pack
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] font-mono">
          {applied && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <Check className="w-3 h-3" /> Side {applied.toUpperCase()} applied
              <button onClick={onOpenOverview} className="underline cursor-pointer hover:text-emerald-200">
                open live pack
              </button>
            </span>
          )}
          {stale && !applied && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <TriangleAlert className="w-3 h-3" /> inputs changed — showing the previous comparison
            </span>
          )}
          {lastExport && <span className="text-slate-500 truncate max-w-[260px]">saved {lastExport}</span>}
          {result && (
            <span className="text-slate-500">
              {new Date(result.generatedAt).toLocaleTimeString()} · {result.rows.length} parameters · {result.dimensions.length} sections
            </span>
          )}
        </div>
      </div>

      {!result && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
          <Scale className="w-5 h-5 text-slate-500 mx-auto" />
          <p className="mt-2 text-xs text-slate-400">Choose two chemistries and press “Generate comparison”.</p>
        </div>
      )}

      {result && (
        <>
          {/* ── Verdict ──────────────────────────────────────── */}
          <div
            className="rounded-xl border bg-slate-950/70 p-3"
            style={{
              borderColor:
                result.verdictWinner === 'tie'
                  ? '#334155'
                  : (result.verdictWinner === 'a' ? result.a : result.b).spec.accentColor,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">Verdict</h3>
              <WinnerChip winner={result.verdictWinner} aName={result.a.spec.shortName} bName={result.b.spec.shortName} />
              <span className="ml-auto flex items-center gap-2 text-[10px] font-mono">
                <span className="text-cyan-300">
                  A {result.a.spec.shortName} {fmt(result.a.overall, 1)}/100
                </span>
                <span className="text-slate-600">vs</span>
                <span className="text-violet-300">
                  B {result.b.spec.shortName} {fmt(result.b.overall, 1)}/100
                </span>
              </span>
            </div>
            <p className="mt-2 text-[11.5px] text-slate-300 leading-relaxed">{result.verdict}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-800 bg-[#070d1a] px-2 py-1.5">
                <ScoreBar score={result.a.overall} accent="a" label={`Overall ${result.a.spec.shortName}`} />
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#070d1a] px-2 py-1.5">
                <ScoreBar score={result.b.overall} accent="b" label={`Overall ${result.b.spec.shortName}`} />
              </div>
            </div>
          </div>

          {/* ── Scorecard ────────────────────────────────────── */}
          <Section
            title="Weighted scorecard"
            icon={<Sigma className="w-3.5 h-3.5" />}
            aside={
              <span className="text-[9.5px] font-mono text-slate-500">
                each metric normalised across all six chemistries · weights sum to 100%
              </span>
            }
          >
            <div className="space-y-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)_70px] gap-2 px-1 text-[9px] uppercase tracking-[0.1em] font-bold text-slate-500">
                <span className="text-right text-cyan-400/90">A · {result.a.spec.shortName}</span>
                <span className="text-center">Metric</span>
                <span className="text-violet-400/90">B · {result.b.spec.shortName}</span>
                <span className="text-center">Leads</span>
              </div>
              {result.scores.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)_70px] gap-2 items-center rounded-lg border border-slate-800/70 bg-[#070d1a] px-2 py-1.5"
                  title={row.hint}
                >
                  <div className="min-w-0">
                    <ScoreBar score={row.aScore} accent="a" label={`${row.label} — A`} />
                    <div className="mt-0.5 text-right text-[9.5px] font-mono text-slate-400 truncate">{row.aText}</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-[10px] font-bold text-slate-200 leading-tight">{row.label}</div>
                    <div className="text-[8.5px] font-mono text-slate-500">
                      wt {Math.round(row.weight)}% · {row.better === 'high' ? 'higher better' : 'lower better'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <ScoreBar score={row.bScore} accent="b" label={`${row.label} — B`} />
                    <div className="mt-0.5 text-[9.5px] font-mono text-slate-400 truncate">{row.bText}</div>
                  </div>
                  <div className="flex justify-center">
                    <WinnerChip winner={row.winner} aName={result.a.spec.shortName} bName={result.b.spec.shortName} small />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-snug flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-px" />
              Scores are relative to the six chemistries in the library, mapped onto a 12–100 scale so no metric reads as zero.
              A lead smaller than 3 points is called a tie.
            </p>
          </Section>

          {/* ── Descriptive analysis ─────────────────────────── */}
          <Section title="Descriptive analysis" icon={<Lightbulb className="w-3.5 h-3.5" />}>
            <div className="space-y-2.5">
              {result.dimensions.map((dim) => (
                <article key={dim.title} className="rounded-lg border border-slate-800 bg-[#070d1a] p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[11px] font-bold text-white">{dim.title}</h4>
                    <WinnerChip winner={dim.winner} aName={result.a.spec.shortName} bName={result.b.spec.shortName} small />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-slate-300 leading-relaxed">{dim.text}</p>
                </article>
              ))}
            </div>
          </Section>

          {/* ── Use cases ────────────────────────────────────── */}
          <Section
            title="Use-case picks"
            icon={<Target className="w-3.5 h-3.5" />}
            aside={
              <span className="text-[9.5px] font-mono text-slate-500">
                {result.useCases.filter((u) => u.pick === 'a').length} A ·{' '}
                {result.useCases.filter((u) => u.pick === 'b').length} B ·{' '}
                {result.useCases.filter((u) => u.pick === 'tie').length} tie
              </span>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.useCases.map((u) => (
                <div
                  key={u.use}
                  className={`rounded-lg border bg-[#070d1a] p-2.5 ${
                    u.pick === 'a' ? 'border-cyan-500/30' : u.pick === 'b' ? 'border-violet-500/30' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-px">
                      <WinnerChip winner={u.pick} aName={result.a.spec.shortName} bName={result.b.spec.shortName} small />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-100 leading-tight">{u.use}</div>
                      <p className="mt-1 text-[10.5px] text-slate-400 leading-snug">{u.why}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Specification tables ─────────────────────────── */}
          <Section
            title="Specification tables"
            icon={<Ruler className="w-3.5 h-3.5" />}
            aside={<span className="text-[9.5px] font-mono text-slate-500">{result.rows.length} parameters · {categories.length} groups</span>}
          >
            <div className="space-y-2">
              {categories.map((category, i) => (
                <SpecTable
                  key={category}
                  category={category}
                  rows={result.rows.filter((r) => r.category === category)}
                  aName={result.a.spec.shortName}
                  bName={result.b.spec.shortName}
                  defaultOpen={i < 2}
                />
              ))}
            </div>
          </Section>

          {/* ── Chemistry profiles ───────────────────────────── */}
          <Section title="Chemistry profiles" icon={<BatteryCharging className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {(['a', 'b'] as const).map((which) => {
                const side = result[which];
                const a = accentClasses(which);
                return (
                  <article key={which} className={`rounded-lg border bg-[#070d1a] p-2.5 ${a.ring}`}>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold font-mono ${a.chip}`}>
                        SIDE {which.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-bold text-white">{side.spec.name}</span>
                      <span className="ml-auto text-[9.5px] font-mono text-slate-500">
                        {side.input.seriesCount}S{side.input.parallelCount}P
                      </span>
                    </div>
                    <p className="mt-2 text-[10.5px] text-slate-300 leading-relaxed">{side.profile.blurb}</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.12em] font-bold text-emerald-400/90 mb-1">Strengths</div>
                        <ul className="space-y-1">
                          {side.profile.strengths.map((s) => (
                            <li key={s} className="flex items-start gap-1.5 text-[10px] text-slate-300 leading-snug">
                              <Check className="w-3 h-3 shrink-0 mt-px text-emerald-400" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.12em] font-bold text-amber-400/90 mb-1">Watch out for</div>
                        <ul className="space-y-1">
                          {side.profile.watchOuts.map((s) => (
                            <li key={s} className="flex items-start gap-1.5 text-[10px] text-slate-300 leading-snug">
                              <TriangleAlert className="w-3 h-3 shrink-0 mt-px text-amber-400" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>

          {/* ── Recommendations + profile fit ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
            <Section title="Recommendations" icon={<ShieldAlert className="w-3.5 h-3.5" />}>
              <ol className="space-y-1.5">
                {result.recommendations.map((rec, i) => (
                  <li key={rec.slice(0, 40)} className="flex items-start gap-2 rounded-lg border border-slate-800 bg-[#070d1a] px-2.5 py-2">
                    <span className="mt-px w-4 h-4 shrink-0 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[9px] font-bold font-mono flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-[11px] text-slate-300 leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="Load-profile fit" icon={<Flame className="w-3.5 h-3.5" />}>
              <div className="space-y-2.5">
                <ProfileChips label="Recommended for both" tone="slate" items={result.sharedProfiles} />
                <ProfileChips label={`${result.a.spec.shortName} only`} tone="a" items={result.onlyAProfiles} />
                <ProfileChips label={`${result.b.spec.shortName} only`} tone="b" items={result.onlyBProfiles} />
                <p className="text-[10px] text-slate-500 leading-snug">
                  Profiles come from the simulator’s own load library — apply a side to the live pack and run the matching
                  profile to see these figures tick by tick, then archive the report to History.
                </p>
              </div>
            </Section>
          </div>

          {/* ── Footer actions ───────────────────────────────── */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] text-slate-400">
              Run this build in the simulator: apply either side, then start the pack and archive the report to History.
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => applySide('a')}
                className="h-8 px-2.5 rounded-md text-[11px] font-bold bg-cyan-600 text-white cursor-pointer hover:bg-cyan-500 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Apply A · {result.a.spec.shortName} {result.a.input.seriesCount}S{result.a.input.parallelCount}P
              </button>
              <button
                onClick={() => applySide('b')}
                className="h-8 px-2.5 rounded-md text-[11px] font-bold bg-violet-600 text-white cursor-pointer hover:bg-violet-500 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Apply B · {result.b.spec.shortName} {result.b.input.seriesCount}S{result.b.input.parallelCount}P
              </button>
              <button
                onClick={onOpenOverview}
                className="h-8 px-2.5 rounded-md text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer hover:bg-slate-700"
              >
                Live pack
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileChips({ label, items, tone }: { label: string; items: string[]; tone: 'a' | 'b' | 'slate' }) {
  const chip =
    tone === 'a'
      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
      : tone === 'b'
        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
        : 'border-slate-700 bg-slate-800/60 text-slate-300';
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-1">{label}</div>
      {items.length === 0 ? (
        <div className="text-[10px] text-slate-600 font-mono">none</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span key={item} className={`px-1.5 py-0.5 rounded border text-[9.5px] font-mono ${chip}`}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
