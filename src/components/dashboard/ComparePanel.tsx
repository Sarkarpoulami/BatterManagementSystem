import { useMemo, useState } from 'react';
import { GitCompare, Zap, Battery, BatteryCharging, Gauge, Thermometer, Shield, Coins, Cpu, Layers, ArrowLeftRight, CircleAlert } from 'lucide-react';
import { BATTERY_CHEMISTRIES } from '../../data/batteryChemistryData';
import type { BatteryChemistryType, ChemistrySpec } from '../../types/battery';

interface ComparePanelProps {
  seriesCount: number;
  parallelCount: number;
}

const CHEMISTRY_ORDER: BatteryChemistryType[] = ['li-ion', 'lipo', 'solid-state', 'lead-acid', 'lifepo4', 'nimh'];

interface DerivedPack {
  packVoltage: number;
  packMaxVoltage: number;
  packCutoffVoltage: number;
  packCapacityAh: number;
  packEnergyWh: number;
  packWeightKg: number;
  totalCells: number;
  maxContinuousCurrent: number;
  maxChargeCurrent: number;
  maxPowerW: number;
  chargeTimeH: number;
  cycleLife: number;
  tempWindow: string;
  thermalRunaway: number;
  safety: string;
  costTier: string;
}

function derivePack(spec: ChemistrySpec, series: number, parallel: number): DerivedPack {
  const totalCells = series * parallel;
  const packVoltage = spec.nominalVoltage * series;
  const packMaxVoltage = spec.maxVoltage * series;
  const packCutoffVoltage = spec.cutoffVoltage * series;
  const cellCapacityAh = spec.typicalCapacity / 1000;
  const packCapacityAh = cellCapacityAh * parallel;
  const packEnergyWh = packVoltage * packCapacityAh;
  // Cell weight estimated from energy density: weight = energy / energyDensity
  const cellEnergyWh = spec.nominalVoltage * cellCapacityAh;
  const cellWeightKg = cellEnergyWh / Math.max(1, spec.energyDensity);
  const packWeightKg = cellWeightKg * totalCells;
  const maxContinuousCurrent = spec.maxDischargeC * cellCapacityAh * parallel;
  const maxChargeCurrent = spec.maxChargeC * cellCapacityAh * parallel;
  const maxPowerW = packVoltage * maxContinuousCurrent;
  const chargeTimeH = packCapacityAh / Math.max(0.1, maxChargeCurrent);
  return {
    packVoltage,
    packMaxVoltage,
    packCutoffVoltage,
    packCapacityAh,
    packEnergyWh,
    packWeightKg,
    totalCells,
    maxContinuousCurrent,
    maxChargeCurrent,
    maxPowerW,
    chargeTimeH,
    cycleLife: spec.cycleLife,
    tempWindow: `${spec.tempMin}°C to ${spec.tempMax}°C`,
    thermalRunaway: spec.thermalRunawayTemp,
    safety: spec.safetyRating,
    costTier: spec.costTier,
  };
}

interface MetricRow {
  label: string;
  a: string;
  b: string;
  better: 'a' | 'b' | 'tie' | 'info';
  note: string;
}

function buildComparison(a: DerivedPack, b: DerivedPack, specA: ChemistrySpec, specB: ChemistrySpec): MetricRow[] {
  const rows: MetricRow[] = [];
  const push = (label: string, aVal: number, bVal: number, higherBetter: boolean, unit: string, note: string) => {
    let better: 'a' | 'b' | 'tie' = 'tie';
    if (aVal !== bVal) better = higherBetter ? (aVal > bVal ? 'a' : 'b') : (aVal < bVal ? 'a' : 'b');
    rows.push({ label, a: `${aVal.toFixed(aVal >= 100 ? 0 : 1)} ${unit}`, b: `${bVal.toFixed(bVal >= 100 ? 0 : 1)} ${unit}`, better, note });
  };

  push('Nominal pack voltage', a.packVoltage, b.packVoltage, true, 'V', 'Higher voltage reduces current for the same power, thinning busbar losses.');
  push('Energy capacity', a.packEnergyWh, b.packEnergyWh, true, 'Wh', 'Total usable energy stored — the fundamental range/runtime budget.');
  push('Usable capacity', a.packCapacityAh, b.packCapacityAh, true, 'Ah', 'Charge the pack can deliver at its nominal voltage.');
  push('Peak continuous current', a.maxContinuousCurrent, b.maxContinuousCurrent, true, 'A', 'Sustained discharge ceiling before thermal/IR limits bite.');
  push('Peak continuous power', a.maxPowerW, b.maxPowerW, true, 'W', 'V × I ceiling; the acceleration/climb envelope of the pack.');
  push('Specific energy', a.packEnergyWh / Math.max(0.01, a.packWeightKg), b.packEnergyWh / Math.max(0.01, b.packWeightKg), true, 'Wh/kg', 'Energy per kg — dominates vehicle range and payload margins.');
  push('Cycle life', a.cycleLife, b.cycleLife, true, 'cyc', 'Expected full charge/discharge cycles before 80% capacity fade.');
  push('Full-charge time (max rate)', a.chargeTimeH, b.chargeTimeH, false, 'h', 'Time to full at the chemistry’s max charge C-rate.');
  push('Total cell count', a.totalCells, b.totalCells, false, '', 'More cells mean more welds, sensing channels and failure points.');
  push('Pack weight', a.packWeightKg, b.packWeightKg, false, 'kg', 'Structural and vehicle-mass penalty of the chosen chemistry.');

  rows.push({
    label: 'Operating temperature window',
    a: a.tempWindow,
    b: b.tempWindow,
    better: specA.tempMin < specB.tempMin && specA.tempMax > specB.tempMax ? 'a' : specB.tempMin < specB.tempMin ? 'b' : 'tie',
    note: 'Wider thermal window means better cold-crank and hot-climate tolerance.',
  });
  rows.push({
    label: 'Thermal runaway onset',
    a: `${a.thermalRunaway} °C`,
    b: `${b.thermalRunaway} °C`,
    better: a.thermalRunaway > b.thermalRunaway ? 'a' : 'b',
    note: 'Higher onset temperature gives the BMS more reaction time before propagation.',
  });
  rows.push({
    label: 'Safety rating',
    a: a.safety,
    b: b.safety,
    better: a.safety === b.safety ? 'tie' : a.safety.localeCompare(b.safety) < 0 ? 'a' : 'b',
    note: 'A+ = inherently safest chemistry behaviour under abuse.',
  });
  rows.push({
    label: 'Relative cost',
    a: a.costTier,
    b: b.costTier,
    better: 'info',
    note: '$ = cheapest, $$$$ = most expensive per kWh of pack build.',
  });

  return rows;
}

function narrative(
  specA: ChemistrySpec,
  specB: ChemistrySpec,
  a: DerivedPack,
  b: DerivedPack,
  series: number,
  parallel: number
): string {
  const totalCells = series * parallel;
  const energyDelta = a.packEnergyWh - b.packEnergyWh;
  const energyWinner = energyDelta > 0 ? specA.name : specB.name;
  const energyLoser = energyDelta > 0 ? specB.name : specA.name;
  const energyPct = Math.abs((energyDelta / Math.max(1, Math.min(a.packEnergyWh, b.packEnergyWh))) * 100);
  const powerDelta = a.maxPowerW - b.maxPowerW;
  const powerWinner = powerDelta > 0 ? specA.name : specB.name;
  const lifeWinner = a.cycleLife >= b.cycleLife ? specA.name : specB.name;
  const safeWinner = a.thermalRunaway >= b.thermalRunaway ? specA.name : specB.name;
  const heavyWinner = a.packWeightKg <= b.packWeightKg ? specA.name : specB.name;

  return [
    `A ${series}S${parallel}P configuration places ${totalCells} cells in the string — every series group of ${parallel} parallel cell(s) shares current, so the ${parallel}P branches multiply capacity by ${parallel}x while the ${series} series groups stack voltage to ${a.packVoltage.toFixed(1)} V (option A) versus ${b.packVoltage.toFixed(1)} V (option B).`,
    ``,
    `Energy: at this topology, ${energyWinner} stores ${energyPct.toFixed(0)}% more energy (${Math.max(a.packEnergyWh, b.packEnergyWh).toFixed(0)} Wh) than ${energyLoser} (${Math.min(a.packEnergyWh, b.packEnergyWh).toFixed(0)} Wh), which translates directly into extra runtime or driving range for identical loads.`,
    ``,
    `Power: ${powerWinner} sustains the higher continuous discharge ceiling (${Math.max(a.maxPowerW, b.maxPowerW).toFixed(0)} W vs ${Math.min(a.maxPowerW, b.maxPowerW).toFixed(0)} W), because its ${Math.max(specA.maxDischargeC, specB.maxDischargeC).toFixed(0)}C cell rating multiplied by the ${parallel} parallel branches and pack voltage outweighs the alternative. This matters for acceleration, climbing and pulse loads.`,
    ``,
    `Longevity: ${lifeWinner} is rated for ${Math.max(a.cycleLife, b.cycleLife).toLocaleString()} full cycles versus ${Math.min(a.cycleLife, b.cycleLife).toLocaleString()}, so over the pack's life ${lifeWinner} delivers more total kWh throughput before its 80% capacity threshold.`,
    ``,
    `Safety: ${safeWinner} tolerates a higher onset temperature before thermal runaway (${safeWinner === specA.name ? a.thermalRunaway : b.thermalRunaway}°C), giving the BMS a wider intervention margin. Both chemistries remain within their ${series}S voltage limits provided cell balancing keeps group deltas under the configured threshold.`,
    ``,
    `Mass & cost: ${heavyWinner} yields the lighter pack (${Math.min(a.packWeightKg, b.packWeightKg).toFixed(1)} kg vs ${Math.max(a.packWeightKg, b.packWeightKg).toFixed(1)} kg) for the same topology, directly improving energy density; relative cell cost tiers are ${a.costTier} (${specA.name}) versus ${b.costTier} (${specB.name}), which dominates bill-of-materials at scale.`,
    ``,
    `Verdict: choose ${energyWinner} when runtime/range per charge is the priority; choose ${powerWinner} when burst power and fast charging dominate; choose ${lifeWinner} for long-service installations where replacement cycles drive total cost of ownership.`,
  ].join('\n');
}

function PackCard({ spec, series, parallel, tag }: { spec: ChemistrySpec; series: number; parallel: number; tag: string }) {
  const d = derivePack(spec, series, parallel);
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-[#0b1220] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4" style={{ color: spec.accentColor }} />
          <div>
            <div className="text-sm font-bold text-white">{spec.name}</div>
            <div className="text-[10px] text-slate-500">{spec.fullName}</div>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300">{tag}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-[#081020] border border-slate-800 p-2">
          <div className="text-slate-500">Nominal voltage</div>
          <div className="text-cyan-300 font-mono font-bold">{d.packVoltage.toFixed(1)} V</div>
        </div>
        <div className="rounded-md bg-[#081020] border border-slate-800 p-2">
          <div className="text-slate-500">Energy</div>
          <div className="text-emerald-300 font-mono font-bold">{d.packEnergyWh.toFixed(0)} Wh</div>
        </div>
        <div className="rounded-md bg-[#081020] border border-slate-800 p-2">
          <div className="text-slate-500">Capacity</div>
          <div className="text-violet-300 font-mono font-bold">{d.packCapacityAh.toFixed(1)} Ah</div>
        </div>
        <div className="rounded-md bg-[#081020] border border-slate-800 p-2">
          <div className="text-slate-500">Peak power</div>
          <div className="text-amber-300 font-mono font-bold">{(d.maxPowerW / 1000).toFixed(1)} kW</div>
        </div>
        <div className="rounded-md bg-[#081020] border border-slate-800 p-2">
          <div className="text-slate-500">Weight</div>
          <div className="text-slate-200 font-mono font-bold">{d.packWeightKg.toFixed(1)} kg</div>
        </div>
        <div className="rounded-md bg-[#081020] border border-slate-800 p-2">
          <div className="text-slate-500">Cell count</div>
          <div className="text-slate-200 font-mono font-bold">{d.totalCells}</div>
        </div>
      </div>
    </div>
  );
}

export function ComparePanel({ seriesCount, parallelCount }: ComparePanelProps) {
  const [chemA, setChemA] = useState<BatteryChemistryType>('li-ion');
  const [chemB, setChemB] = useState<BatteryChemistryType>('lifepo4');
  const [series, setSeries] = useState(seriesCount);
  const [parallel, setParallel] = useState(parallelCount);

  const specA = BATTERY_CHEMISTRIES[chemA];
  const specB = BATTERY_CHEMISTRIES[chemB];
  const packA = useMemo(() => derivePack(specA, series, parallel), [specA, series, parallel]);
  const packB = useMemo(() => derivePack(specB, series, parallel), [specB, series, parallel]);
  const rows = useMemo(() => buildComparison(packA, packB, specA, specB), [packA, packB, specA, specB]);
  const narrativeText = useMemo(() => narrative(specA, specB, packA, packB, series, parallel), [specA, specB, packA, packB, series, parallel]);

  const swap = () => {
    setChemA(chemB);
    setChemB(chemA);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white">
        <GitCompare className="w-5 h-5 text-cyan-400" />
        <h2 className="text-base font-bold">Cell Comparison</h2>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0c1424] p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-cyan-500/80 font-bold">Cell A</label>
            <select
              value={chemA}
              onChange={(e) => setChemA(e.target.value as BatteryChemistryType)}
              className="mt-1 w-full bg-[#0b1220] border border-slate-700 rounded-md px-2 py-2 text-xs text-slate-100 font-mono outline-none focus:border-cyan-400 cursor-pointer"
            >
              {CHEMISTRY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {BATTERY_CHEMISTRIES[c].name} — {BATTERY_CHEMISTRIES[c].fullName}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={swap}
            title="Swap A and B"
            className="h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 cursor-pointer self-end"
          >
            <ArrowLeftRight className="w-4 h-4 mx-auto" />
          </button>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-cyan-500/80 font-bold">Cell B</label>
            <select
              value={chemB}
              onChange={(e) => setChemB(e.target.value as BatteryChemistryType)}
              className="mt-1 w-full bg-[#0b1220] border border-slate-700 rounded-md px-2 py-2 text-xs text-slate-100 font-mono outline-none focus:border-cyan-400 cursor-pointer"
            >
              {CHEMISTRY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {BATTERY_CHEMISTRIES[c].name} — {BATTERY_CHEMISTRIES[c].fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-cyan-500/80 font-bold">
              <Layers className="w-3 h-3" /> Series count: {series}S
            </label>
            <input
              type="range"
              min={1}
              max={32}
              value={series}
              onChange={(e) => setSeries(Number(e.target.value))}
              className="w-full mt-1 accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono"><span>1S</span><span>16S</span><span>32S</span></div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-cyan-500/80 font-bold">
              <Layers className="w-3 h-3 rotate-90" /> Parallel branches: {parallel}P
            </label>
            <input
              type="range"
              min={1}
              max={12}
              value={parallel}
              onChange={(e) => setParallel(Number(e.target.value))}
              className="w-full mt-1 accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono"><span>1P</span><span>6P</span><span>12P</span></div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <PackCard spec={specA} series={series} parallel={parallel} tag="A" />
        <PackCard spec={specB} series={series} parallel={parallel} tag="B" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0c1424] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-500/80 flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5" /> Metric-by-metric comparison
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left px-4 py-2 font-semibold">Metric</th>
                <th className="text-right px-4 py-2 font-semibold" style={{ color: specA.accentColor }}>{specA.name} (A)</th>
                <th className="text-right px-4 py-2 font-semibold" style={{ color: specB.accentColor }}>{specB.name} (B)</th>
                <th className="text-left px-4 py-2 font-semibold w-[38%]">Engineering note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-200 font-medium">{r.label}</td>
                  <td className={`px-4 py-2 text-right font-mono ${r.better === 'a' ? 'text-emerald-400 font-bold' : r.better === 'b' ? 'text-slate-500' : 'text-slate-300'}`}>
                    {r.a}{r.better === 'a' ? ' ✓' : ''}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${r.better === 'b' ? 'text-emerald-400 font-bold' : r.better === 'a' ? 'text-slate-500' : 'text-slate-300'}`}>
                    {r.b}{r.better === 'b' ? ' ✓' : ''}
                  </td>
                  <td className="px-4 py-2 text-slate-500 leading-snug">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0c1424] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-500/80 flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5" /> Detailed descriptive analysis
        </div>
        <div className="px-4 py-3 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-[system-ui]">
          {narrativeText}
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> {specA.formula} vs {specB.formula}</span>
          <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-rose-400" /> {specA.tempMin}–{specA.tempMax}°C vs {specB.tempMin}–{specB.tempMax}°C</span>
          <span className="flex items-center gap-1"><BatteryCharging className="w-3 h-3 text-emerald-400" /> {specA.maxChargeC}C vs {specB.maxChargeC}C max charge</span>
          <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-cyan-400" /> {specA.safetyRating} vs {specB.safetyRating} safety</span>
          <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-violet-400" /> {specA.costTier} vs {specB.costTier} cost tier</span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/90 flex items-start gap-2">
        <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Comparison assumes a fresh pack at nominal conditions. Real-world usable energy depends on load profile, temperature and SoC window.
      </div>
    </div>
  );
}
