import { useMemo, useState } from 'react';
import { BATTERY_CHEMISTRIES } from '../../data/batteryChemistryData';
import type { BatteryChemistryType } from '../../types/battery';
import {
  buildPackMetrics,
  comparePacks,
  compareResultText,
  type CompareResult,
  type PackBuild,
} from '../../utils/packCompare';
import { deliverText } from '../../utils/fileDelivery';
import { playCellClickSound } from '../../utils/audio';
import {
  GitCompareArrows,
  FileText,
  Minus,
  Plus,
  Zap,
  BatteryCharging,
  Gauge,
  Scale,
  Trophy,
  Layers,
} from 'lucide-react';

interface CompareLabProps {
  defaultChemistryA: BatteryChemistryType;
  defaultChemistryB: BatteryChemistryType;
  defaultSeries: number;
  defaultParallel: number;
}

const inputClass =
  'w-full bg-[#0b1220] border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 cursor-pointer';

const chemistries = Object.values(BATTERY_CHEMISTRIES);

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[11px] text-slate-400">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-7 w-7 shrink-0 rounded-md bg-[#0b1220] border border-slate-700 text-slate-300 font-bold text-xs hover:text-white cursor-pointer"
      >
        <Minus className="w-3 h-3 mx-auto" />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className={`flex-1 min-w-0 bg-[#0b1220] border border-slate-700 rounded-md h-7 text-center text-xs font-mono font-bold ${accent}`}
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-7 w-7 shrink-0 rounded-md bg-[#0b1220] border border-slate-700 text-slate-300 font-bold text-xs hover:text-white cursor-pointer"
      >
        <Plus className="w-3 h-3 mx-auto" />
      </button>
    </div>
  );
}

function BuildCard({
  title,
  accentText,
  border,
  build,
  onChange,
}: {
  title: string;
  accentText: string;
  border: string;
  build: PackBuild;
  onChange: (b: PackBuild) => void;
}) {
  const spec = BATTERY_CHEMISTRIES[build.chemistry];
  const live = useMemo(() => buildPackMetrics(build), [build]);

  return (
    <div className={`rounded-xl border ${border} bg-[#0a1222] p-3 space-y-2.5`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${accentText}`}>{title}</span>
        <span className="text-[10px] font-mono text-slate-500">{build.series}S{build.parallel}P · {live.cellCount} cells</span>
      </div>
      <div>
        <div className="text-[10px] text-slate-500 mb-1">Cell type</div>
        <select
          className={inputClass}
          value={build.chemistry}
          onChange={(e) => onChange({ ...build, chemistry: e.target.value as BatteryChemistryType })}
        >
          {chemistries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.nominalVoltage.toFixed(2)} V · {(c.typicalCapacity / 1000).toFixed(1)} Ah
            </option>
          ))}
        </select>
      </div>
      <Stepper label="Series (S)" value={build.series} min={1} max={32} accent="text-cyan-300" onChange={(n) => onChange({ ...build, series: n })} />
      <Stepper label="Parallel (P)" value={build.parallel} min={1} max={12} accent="text-indigo-300" onChange={(n) => onChange({ ...build, parallel: n })} />
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        <div className="rounded-md border border-slate-800 bg-[#0b1220] px-1.5 py-1 text-center">
          <div className="text-[9px] text-slate-500">Pack V</div>
          <div className="text-[11px] font-mono font-bold text-cyan-300">{live.packNominalV.toFixed(1)}</div>
        </div>
        <div className="rounded-md border border-slate-800 bg-[#0b1220] px-1.5 py-1 text-center">
          <div className="text-[9px] text-slate-500">Energy</div>
          <div className="text-[11px] font-mono font-bold text-emerald-300">{live.packEnergyWh.toFixed(0)} Wh</div>
        </div>
        <div className="rounded-md border border-slate-800 bg-[#0b1220] px-1.5 py-1 text-center">
          <div className="text-[9px] text-slate-500">Power</div>
          <div className="text-[11px] font-mono font-bold text-amber-300">{(live.contPowerW / 1000).toFixed(1)} kW</div>
        </div>
      </div>
      <div className="text-[10px] text-slate-500 font-mono leading-snug">{spec.fullName}</div>
      <div className="flex flex-wrap gap-1">
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300">Safety {spec.safetyRating}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300">Cost {spec.costTier}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300">{spec.cycleLife.toLocaleString()} cycles</span>
      </div>
    </div>
  );
}

interface MetricRow {
  label: string;
  get: (m: ReturnType<typeof buildPackMetrics>) => number;
  unit: string;
  digits: number;
  better: 'higher' | 'lower';
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Pack nominal voltage', get: (m) => m.packNominalV, unit: 'V', digits: 2, better: 'higher' },
  { label: 'Pack cutoff voltage', get: (m) => m.packCutoffV, unit: 'V', digits: 2, better: 'higher' },
  { label: 'Pack capacity', get: (m) => m.packCapacityAh, unit: 'Ah', digits: 2, better: 'higher' },
  { label: 'Pack energy', get: (m) => m.packEnergyWh, unit: 'Wh', digits: 0, better: 'higher' },
  { label: 'Internal resistance', get: (m) => m.packIRmOhm, unit: 'mΩ', digits: 2, better: 'lower' },
  { label: 'Max continuous discharge', get: (m) => m.maxDischargeA, unit: 'A', digits: 1, better: 'higher' },
  { label: 'Max charge current', get: (m) => m.maxChargeA, unit: 'A', digits: 1, better: 'higher' },
  { label: 'Continuous power', get: (m) => m.contPowerW, unit: 'W', digits: 0, better: 'higher' },
  { label: 'Est. cell mass', get: (m) => m.estPackKg, unit: 'kg', digits: 2, better: 'lower' },
  { label: 'Energy density', get: (m) => m.energyDensityWhKg, unit: 'Wh/kg', digits: 0, better: 'higher' },
  { label: 'Cycle life', get: (m) => m.cycleLife, unit: 'cyc', digits: 0, better: 'higher' },
  { label: 'Temp window top', get: (m) => m.tempMax, unit: '°C', digits: 0, better: 'higher' },
  { label: 'Thermal runaway onset', get: (m) => m.thermalRunawayTemp, unit: '°C', digits: 0, better: 'higher' },
];

export function CompareLab({ defaultChemistryA, defaultChemistryB, defaultSeries, defaultParallel }: CompareLabProps) {
  const [buildA, setBuildA] = useState<PackBuild>({ chemistry: defaultChemistryA, series: defaultSeries, parallel: defaultParallel });
  const [buildB, setBuildB] = useState<PackBuild>({ chemistry: defaultChemistryB, series: defaultSeries, parallel: defaultParallel });
  const [result, setResult] = useState<CompareResult | null>(null);

  const runCompare = () => {
    playCellClickSound(880);
    setResult(comparePacks(buildPackMetrics(buildA), buildPackMetrics(buildB)));
  };

  const downloadTxt = () => {
    if (!result) return;
    playCellClickSound(820);
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    deliverText(
      compareResultText(result),
      `eBMS-compare-${result.a.chemName.replace(/\s+/g, '')}${result.a.series}S${result.a.parallel}P-vs-${result.b.chemName.replace(/\s+/g, '')}${result.b.series}S${result.b.parallel}P-${stamp}.txt`,
      'text/plain'
    );
  };

  const swap = () => {
    playCellClickSound(600);
    setBuildA(buildB);
    setBuildB(buildA);
    setResult(null);
  };

  const scoreBar = (v: number, accent: string) => (
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(2, Math.min(100, v))}%` }} />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <GitCompareArrows className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-bold text-white">Cell & pack comparison lab</h2>
        <span className="text-[11px] text-slate-500 font-mono">
          Pick two cell types, set series/parallel for each, and generate a detailed engineering comparison.
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <BuildCard
          title="Pack A"
          accentText="text-cyan-400"
          border="border-cyan-800/50"
          build={buildA}
          onChange={setBuildA}
        />
        <BuildCard
          title="Pack B"
          accentText="text-indigo-400"
          border="border-indigo-800/50"
          build={buildB}
          onChange={setBuildB}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runCompare}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
        >
          <GitCompareArrows className="w-4 h-4" /> Generate comparison
        </button>
        <button
          onClick={swap}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer hover:text-white"
        >
          <Scale className="w-3.5 h-3.5" /> Swap sides
        </button>
        {result && (
          <button
            onClick={downloadTxt}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> Download report (.txt)
          </button>
        )}
      </div>

      {!result && (
        <div className="rounded-xl border border-slate-800 bg-[#0a1222] p-6 text-center">
          <Layers className="w-6 h-6 mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">
            Configure Pack A and Pack B above, then press <span className="text-cyan-300 font-bold">Generate comparison</span>.
            The lab derives full pack metrics (voltage, capacity, energy, resistance, power, mass, thermal limits, cycle life,
            safety and cost) and writes a descriptive engineering comparison with a weighted verdict.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Verdict banner */}
          <div className={`rounded-xl border p-4 ${result.winnerId === 'tie' ? 'border-slate-700 bg-slate-900/60' : result.winnerId === 'a' ? 'border-cyan-700/60 bg-cyan-950/30' : 'border-indigo-700/60 bg-indigo-950/30'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">Verdict</span>
              <span className="ml-auto text-[10px] font-mono text-slate-500">energy 30% · power 25% · safety 20% · longevity 15% · cost 10%</span>
            </div>
            <p className="text-[12px] text-slate-200 leading-relaxed">{result.verdict}</p>
          </div>

          {/* Score cards */}
          <div className="grid md:grid-cols-2 gap-3">
            {([['A', result.a, 'text-cyan-300', 'bg-cyan-500'], ['B', result.b, 'text-indigo-300', 'bg-indigo-500']] as const).map(([side, m, text, bar]) => (
              <div key={side} className="rounded-xl border border-slate-800 bg-[#0a1222] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">Pack {side} · {m.chemName} {m.series}S{m.parallel}P</span>
                  <span className={`text-sm font-mono font-bold ${text}`}>{m.scores.overall}/100</span>
                </div>
                <div className="space-y-1.5">
                  {([['Energy', m.scores.energy], ['Power', m.scores.power], ['Safety', m.scores.safety], ['Longevity', m.scores.longevity], ['Cost', m.scores.cost]] as const).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-16 text-[10px] text-slate-500">{k}</span>
                      <div className="flex-1">{scoreBar(v, bar)}</div>
                      <span className="w-8 text-right text-[10px] font-mono text-slate-400">{Math.round(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Spec table */}
          <div className="rounded-xl border border-slate-800 bg-[#0a1222] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-800 text-xs font-bold text-white">Side-by-side metrics</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="text-left px-3 py-1.5">Metric</th>
                    <th className="text-right px-3 py-1.5">Pack A ({result.a.chemName} {result.a.series}S{result.a.parallel}P)</th>
                    <th className="text-right px-3 py-1.5">Pack B ({result.b.chemName} {result.b.series}S{result.b.parallel}P)</th>
                    <th className="text-center px-3 py-1.5">Better</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map((row) => {
                    const va = row.get(result.a);
                    const vb = row.get(result.b);
                    const eq = Math.abs(va - vb) < 1e-9;
                    const aWins = !eq && (row.better === 'higher' ? va > vb : va < vb);
                    return (
                      <tr key={row.label} className="border-t border-slate-800 text-slate-300">
                        <td className="px-3 py-1.5 text-slate-400">{row.label}</td>
                        <td className={`px-3 py-1.5 text-right ${aWins ? 'text-cyan-300 font-bold' : ''}`}>
                          {va.toLocaleString(undefined, { minimumFractionDigits: row.digits, maximumFractionDigits: row.digits })} {row.unit}
                        </td>
                        <td className={`px-3 py-1.5 text-right ${!aWins && !eq ? 'text-indigo-300 font-bold' : ''}`}>
                          {vb.toLocaleString(undefined, { minimumFractionDigits: row.digits, maximumFractionDigits: row.digits })} {row.unit}
                        </td>
                        <td className={`px-3 py-1.5 text-center text-[10px] ${eq ? 'text-slate-500' : aWins ? 'text-cyan-400' : 'text-indigo-400'}`}>
                          {eq ? '—' : aWins ? 'A' : 'B'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-800 text-slate-300">
                    <td className="px-3 py-1.5 text-slate-400">Safety rating</td>
                    <td className="px-3 py-1.5 text-right text-cyan-300">{result.a.safetyRating}</td>
                    <td className="px-3 py-1.5 text-right text-indigo-300">{result.b.safetyRating}</td>
                    <td className="px-3 py-1.5 text-center text-[10px] text-slate-500">see narrative</td>
                  </tr>
                  <tr className="border-t border-slate-800 text-slate-300">
                    <td className="px-3 py-1.5 text-slate-400">Cost class</td>
                    <td className="px-3 py-1.5 text-right text-cyan-300">{result.a.costTier}</td>
                    <td className="px-3 py-1.5 text-right text-indigo-300">{result.b.costTier}</td>
                    <td className="px-3 py-1.5 text-center text-[10px] text-slate-500">see narrative</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI glance */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {([
              ['Energy', `${result.a.packEnergyWh.toFixed(0)} / ${result.b.packEnergyWh.toFixed(0)}`, 'Wh', <Zap key="z" className="w-3.5 h-3.5" />, 'text-cyan-400'],
              ['Capacity', `${result.a.packCapacityAh.toFixed(1)} / ${result.b.packCapacityAh.toFixed(1)}`, 'Ah', <BatteryCharging key="b" className="w-3.5 h-3.5" />, 'text-emerald-400'],
              ['Cont. power', `${(result.a.contPowerW / 1000).toFixed(1)} / ${(result.b.contPowerW / 1000).toFixed(1)}`, 'kW', <Gauge key="g" className="w-3.5 h-3.5" />, 'text-amber-400'],
              ['Mass', `${result.a.estPackKg.toFixed(1)} / ${result.b.estPackKg.toFixed(1)}`, 'kg', <Scale key="s" className="w-3.5 h-3.5" />, 'text-rose-400'],
            ] as const).map(([label, value, unit, icon, accent]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-[#0a1222] p-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  <span>{label} A / B</span>
                  <span className={accent}>{icon}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-base font-mono font-bold ${accent}`}>{value}</span>
                  <span className="text-[10px] text-slate-500">{unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Narrative */}
          <div className="rounded-xl border border-slate-800 bg-[#0a1222] p-4 space-y-3">
            <div className="text-xs font-bold text-white">Detailed descriptive comparison</div>
            <p className="text-[12px] text-slate-300 leading-relaxed">{result.intro}</p>
            {result.sections.map((s) => (
              <div key={s.title} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-500/90 mb-1.5">{s.title}</div>
                <div className="space-y-1.5">
                  {s.paragraphs.map((p, i) => (
                    <p key={i} className="text-[12px] text-slate-300 leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
