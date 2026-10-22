// Pack comparison engine: derives full electrical metrics for two user-built
// packs (chemistry × series × parallel) and generates a detailed descriptive
// engineering comparison between them.

import { BATTERY_CHEMISTRIES } from '../data/batteryChemistryData';
import type { BatteryChemistryType } from '../types/battery';

export interface PackBuild {
  chemistry: BatteryChemistryType;
  series: number;
  parallel: number;
}

export interface PackMetrics {
  build: PackBuild;
  chemId: BatteryChemistryType;
  chemName: string;
  fullName: string;
  formFactor: string;
  safetyRating: string;
  costTier: string;
  series: number;
  parallel: number;
  cellCount: number;
  cellNominalV: number;
  cellMaxV: number;
  cellCutoffV: number;
  cellCapacityAh: number;
  cellIRmOhm: number;
  packNominalV: number;
  packMaxV: number;
  packCutoffV: number;
  packCapacityAh: number;
  packEnergyWh: number;
  packIRmOhm: number;
  maxDischargeA: number;
  maxChargeA: number;
  contPowerW: number;
  peakPowerW: number;
  energyDensityWhKg: number;
  estPackKg: number;
  cycleLife: number;
  tempMin: number;
  tempMax: number;
  thermalRunawayTemp: number;
  applications: string[];
  features: string[];
  scores: { energy: number; power: number; longevity: number; safety: number; cost: number; overall: number };
}

export interface CompareSection {
  title: string;
  paragraphs: string[];
}

export interface CompareResult {
  a: PackMetrics;
  b: PackMetrics;
  intro: string;
  sections: CompareSection[];
  verdict: string;
  winnerId: 'a' | 'b' | 'tie';
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const SAFETY_SCORE: Record<string, number> = { 'A+': 98, 'A': 85, 'B+': 72, 'B': 58, 'C': 40 };
const COST_SCORE: Record<string, number> = { '$': 95, '$$': 70, '$$$': 45, '$$$$': 25 };

export function buildPackMetrics(build: PackBuild): PackMetrics {
  const spec = BATTERY_CHEMISTRIES[build.chemistry] ?? BATTERY_CHEMISTRIES['li-ion'];
  const series = clamp(Math.round(num(build.series, 1)), 1, 64);
  const parallel = clamp(Math.round(num(build.parallel, 1)), 1, 16);

  const cellCapacityAh = spec.typicalCapacity / 1000;
  const packNominalV = spec.nominalVoltage * series;
  const packCapacityAh = cellCapacityAh * parallel;
  const packEnergyWh = packNominalV * packCapacityAh;
  // Parallel branches share current (IR / P), groups in series add (× S)
  const packIRmOhm = (spec.typicalIR / parallel) * series;
  const maxDischargeA = cellCapacityAh * spec.maxDischargeC * parallel;
  const maxChargeA = cellCapacityAh * spec.maxChargeC * parallel;
  const contPowerW = packNominalV * maxDischargeA;
  const peakPowerW = spec.maxVoltage * series * maxDischargeA;
  const estPackKg = packEnergyWh / Math.max(1, spec.energyDensity);

  return {
    build: { chemistry: spec.id, series, parallel },
    chemId: spec.id,
    chemName: spec.name,
    fullName: spec.fullName,
    formFactor: spec.formFactorName,
    safetyRating: spec.safetyRating,
    costTier: spec.costTier,
    series,
    parallel,
    cellCount: series * parallel,
    cellNominalV: spec.nominalVoltage,
    cellMaxV: spec.maxVoltage,
    cellCutoffV: spec.cutoffVoltage,
    cellCapacityAh,
    cellIRmOhm: spec.typicalIR,
    packNominalV,
    packMaxV: spec.maxVoltage * series,
    packCutoffV: spec.cutoffVoltage * series,
    packCapacityAh,
    packEnergyWh,
    packIRmOhm,
    maxDischargeA,
    maxChargeA,
    contPowerW,
    peakPowerW,
    energyDensityWhKg: spec.energyDensity,
    estPackKg,
    cycleLife: spec.cycleLife,
    tempMin: spec.tempMin,
    tempMax: spec.tempMax,
    thermalRunawayTemp: spec.thermalRunawayTemp,
    applications: [...spec.primaryApplications],
    features: [...spec.features],
    scores: { energy: 50, power: 50, longevity: 50, safety: 50, cost: 50, overall: 50 },
  };
}

function scorePairs(a: PackMetrics, b: PackMetrics): void {
  const rel = (x: number, y: number): number => {
    const max = Math.max(Math.abs(x), Math.abs(y));
    if (max <= 1e-9) return 50;
    return clamp(50 + ((x - y) / max) * 50, 0, 100);
  };
  const aSafety = SAFETY_SCORE[a.safetyRating] ?? 50;
  const bSafety = SAFETY_SCORE[b.safetyRating] ?? 50;
  const aCost = COST_SCORE[a.costTier] ?? 50;
  const bCost = COST_SCORE[b.costTier] ?? 50;

  a.scores.energy = rel(a.packEnergyWh, b.packEnergyWh);
  b.scores.energy = rel(b.packEnergyWh, a.packEnergyWh);
  a.scores.power = rel(a.contPowerW, b.contPowerW);
  b.scores.power = rel(b.contPowerW, a.contPowerW);
  a.scores.longevity = rel(a.cycleLife, b.cycleLife);
  b.scores.longevity = rel(b.cycleLife, a.cycleLife);
  a.scores.safety = rel(aSafety, bSafety);
  b.scores.safety = rel(bSafety, aSafety);
  a.scores.cost = rel(aCost, bCost);
  b.scores.cost = rel(bCost, aCost);

  a.scores.overall = Math.round(
    a.scores.energy * 0.3 + a.scores.power * 0.25 + a.scores.longevity * 0.15 + a.scores.safety * 0.2 + a.scores.cost * 0.1
  );
  b.scores.overall = Math.round(
    b.scores.energy * 0.3 + b.scores.power * 0.25 + b.scores.longevity * 0.15 + b.scores.safety * 0.2 + b.scores.cost * 0.1
  );
}

const pct = (a: number, b: number): string => {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max <= 1e-9) return 'identical';
  const d = ((a - b) / max) * 100;
  const mag = Math.abs(d) < 0.05 ? 'essentially equal' : `${Math.abs(d).toFixed(1)}% ${d > 0 ? 'higher' : 'lower'}`;
  return mag;
};

const fmt = (v: number, digits = 1): string => v.toFixed(digits);

export function comparePacks(a: PackMetrics, b: PackMetrics): CompareResult {
  scorePairs(a, b);

  const labelA = `Pack A — ${a.chemName} ${a.series}S${a.parallel}P (${a.cellCount} cells)`;
  const labelB = `Pack B — ${b.chemName} ${b.series}S${b.parallel}P (${b.cellCount} cells)`;

  const intro =
    `This comparison evaluates ${labelA} against ${labelB}. ` +
    `${a.chemName} cells are ${fmt(a.cellNominalV, 2)} V nominal with ${fmt(a.cellIRmOhm, 1)} mΩ internal resistance, while ` +
    `${b.chemName} cells are ${fmt(b.cellNominalV, 2)} V nominal with ${fmt(b.cellIRmOhm, 1)} mΩ internal resistance. ` +
    `The configured topology places ${a.series} cell groups in series with ${a.parallel} parallel branch(es) for Pack A, and ` +
    `${b.series} series groups with ${b.parallel} parallel branch(es) for Pack B, giving ${a.cellCount} and ${b.cellCount} installed cells respectively.`;

  const vDiff = pct(a.packNominalV, b.packNominalV);
  const sections: CompareSection[] = [
    {
      title: 'Voltage & topology',
      paragraphs: [
        `Pack A delivers ${fmt(a.packNominalV, 2)} V nominal (${fmt(a.packMaxV, 2)} V fully charged, cutting off at ${fmt(a.packCutoffV, 2)} V), ` +
          `whereas Pack B delivers ${fmt(b.packNominalV, 2)} V nominal (${fmt(b.packMaxV, 2)} V charged, ${fmt(b.packCutoffV, 2)} V cutoff) — ` +
          `the nominal bus voltage of Pack A is ${vDiff} than Pack B.`,
        a.series === b.series && a.parallel === b.parallel
          ? `Both packs share the identical ${a.series}S${a.parallel}P topology, so every difference in the results below comes purely from the cell chemistry itself.`
          : `Because the topologies differ (${a.series}S${a.parallel}P vs ${b.series}S${b.parallel}P), the higher series count also sets a different protection and sensing burden: each series group needs its own voltage monitor and balance tap, so Pack ${a.series > b.series ? 'A' : 'B'} carries ${Math.abs(a.series - b.series)} more balance channel(s) than Pack ${a.parallel > b.parallel && a.series === b.series ? 'B' : a.series > b.series ? 'B' : 'A'}.`,
      ],
    },
    {
      title: 'Energy & capacity',
      paragraphs: [
        `On stored energy, Pack A holds ${fmt(a.packEnergyWh, 0)} Wh (${fmt(a.packCapacityAh, 2)} Ah at ${fmt(a.packNominalV, 2)} V) against ` +
          `${fmt(b.packEnergyWh, 0)} Wh (${fmt(b.packCapacityAh, 2)} Ah at ${fmt(b.packNominalV, 2)} V) for Pack B — an energy advantage of ${pct(a.packEnergyWh, b.packEnergyWh)} for Pack A.`,
        `Per unit of mass, ${a.chemName} stores about ${fmt(a.energyDensityWhKg, 0)} Wh/kg versus ${fmt(b.energyDensityWhKg, 0)} Wh/kg for ${b.chemName}; ` +
          `scaling that to the configured packs, Pack A weighs an estimated ${fmt(a.estPackKg, 2)} kg of cell mass while Pack B comes to about ${fmt(b.estPackKg, 2)} kg — ` +
          `${pct(b.estPackKg, a.estPackKg)} in favour of Pack ${a.estPackKg < b.estPackKg ? 'A' : 'B'} where weight matters (EV range, drones, portable gear).`,
      ],
    },
    {
      title: 'Power delivery',
      paragraphs: [
        `Continuous discharge capability at the pack terminals is ${fmt(a.maxDischargeA, 1)} A (${fmt(a.contPowerW, 0)} W at nominal voltage) for Pack A, ` +
          `versus ${fmt(b.maxDischargeA, 1)} A (${fmt(b.contPowerW, 0)} W) for Pack B — a continuous power margin of ${pct(a.contPowerW, b.contPowerW)} in favour of Pack ${a.contPowerW >= b.contPowerW ? 'A' : 'B'}.`,
        `Charge acceptance follows the same pattern: ${fmt(a.maxChargeA, 1)} A recommended maximum for Pack A against ${fmt(b.maxChargeA, 1)} A for Pack B, ` +
          `so a full charge from empty takes roughly ${fmt(a.packCapacityAh / Math.max(0.01, a.maxChargeA), 1)} h for Pack A and ${fmt(b.packCapacityAh / Math.max(0.01, b.maxChargeA), 1)} h for Pack B at those limits.`,
      ],
    },
    {
      title: 'Internal resistance & efficiency',
      paragraphs: [
        `Reflected to the pack terminals, internal resistance works out to ${fmt(a.packIRmOhm, 2)} mΩ for Pack A and ${fmt(b.packIRmOhm, 2)} mΩ for Pack B ` +
          `(per-cell ${fmt(a.cellIRmOhm, 1)} mΩ / ${fmt(b.cellIRmOhm, 1)} mΩ, divided by the parallel count and multiplied by the series count).`,
        `At the continuous current each pack can legally deliver, ohmic heating reaches I²R ≈ ${fmt((a.maxDischargeA ** 2 * a.packIRmOhm) / 1000, 1)} W inside Pack A and ` +
          `${fmt((b.maxDischargeA ** 2 * b.packIRmOhm) / 1000, 1)} W inside Pack B. The pack with the lower terminal resistance holds its voltage flatter under load, wastes less energy as heat, ` +
          `and reads higher coulombic efficiency — here that is Pack ${a.packIRmOhm <= b.packIRmOhm ? 'A' : 'B'}.`,
      ],
    },
    {
      title: 'Thermal behaviour & safety',
      paragraphs: [
        `Operating windows are ${fmt(a.tempMin, 0)} °C to ${fmt(a.tempMax, 0)} °C for ${a.chemName} versus ${fmt(b.tempMin, 0)} °C to ${fmt(b.tempMax, 0)} °C for ${b.chemName}. ` +
          `The thermal-runaway onset sits at about ${fmt(a.thermalRunawayTemp, 0)} °C for ${a.chemName} and ${fmt(b.thermalRunawayTemp, 0)} °C for ${b.chemName} — ` +
          `the higher that figure, the larger the thermal margin before a cell failure propagates.`,
        `From a safety standpoint ${a.chemName} carries a rating of ${a.safetyRating} while ${b.chemName} is rated ${b.safetyRating}. ` +
          (a.safetyRating === b.safetyRating
            ? 'Both chemistries are in the same safety class, so integration details (fusing, venting, spacing) decide the real-world risk.'
            : `Pack ${SAFETY_SCORE[a.safetyRating] >= SAFETY_SCORE[b.safetyRating] ? 'A' : 'B'} is therefore the safer choice for fault-prone or human-proximate installations — the other chemistry compensates with performance elsewhere.`),
      ],
    },
    {
      title: 'Cycle life & economics',
      paragraphs: [
        `Longevity: ${a.chemName} is typically rated for about ${a.cycleLife.toLocaleString()} full cycles, while ${b.chemName} manages roughly ${b.cycleLife.toLocaleString()}. ` +
          `Over the pack lifetime that translates to approximately ${fmt(a.cycleLife * a.packEnergyWh / 1000, 0)} kWh and ${fmt(b.cycleLife * b.packEnergyWh / 1000, 0)} kWh of delivered energy respectively — ` +
          `${pct(a.cycleLife * a.packEnergyWh, b.cycleLife * b.packEnergyWh)} lifetime throughput advantage for Pack ${a.cycleLife * a.packEnergyWh >= b.cycleLife * b.packEnergyWh ? 'A' : 'B'}.`,
        `Purchase cost class: ${a.chemName} is ${a.costTier} versus ${b.costTier} for ${b.chemName}. Combining price class, cycle life and maintenance demands, ` +
          `Pack ${a.scores.cost >= b.scores.cost ? 'A' : 'B'} is the more economical option for budget-driven projects, while the alternative justifies its premium through ${a.scores.energy >= b.scores.energy ? 'energy density and runtime' : 'runtime and power capability'}.`,
      ],
    },
  ];

  const winnerId: 'a' | 'b' | 'tie' = a.scores.overall === b.scores.overall ? 'tie' : a.scores.overall > b.scores.overall ? 'a' : 'b';
  const win = winnerId === 'a' ? a : b;
  const lose = winnerId === 'a' ? b : a;

  const verdict =
    winnerId === 'tie'
      ? `Overall the two configurations are dead even (weighted score ${a.scores.overall}/100 each). Choose on secondary criteria: ${a.chemName} for ${a.applications[0]?.toLowerCase() ?? 'general use'}, ${b.chemName} for ${b.applications[0]?.toLowerCase() ?? 'alternate duty'}.`
      : `Weighted verdict: ${winnerId === 'a' ? labelA : labelB} wins with a score of ${win.scores.overall}/100 versus ${lose.scores.overall}/100 (weights: energy 30%, power 25%, safety 20%, longevity 15%, cost 10%). ` +
        `${win.chemName} is the stronger all-round choice for this configuration — strongest where it counts: ${[
          win.scores.energy >= lose.scores.energy + 10 ? 'energy density' : null,
          win.scores.power >= lose.scores.power + 10 ? 'power delivery' : null,
          win.scores.safety >= lose.scores.safety + 10 ? 'safety margin' : null,
          win.scores.longevity >= lose.scores.longevity + 10 ? 'cycle life' : null,
          win.scores.cost >= lose.scores.cost + 10 ? 'cost efficiency' : null,
        ]
          .filter(Boolean)
          .join(', ') || 'a balanced spread of criteria'}. Typical deployments: ${win.applications.slice(0, 2).join('; ')}.`;

  return { a, b, intro, sections, verdict, winnerId };
}

export function compareResultText(r: CompareResult): string {
  const row = (label: string, ua: string, ub: string, unit: string): string =>
    `${label.padEnd(30, ' ')} ${ua.padStart(12)} ${unit.padEnd(6)} ${ub.padStart(12)} ${unit}`;

  const a = r.a;
  const b = r.b;
  const lines: string[] = [];
  lines.push('e-BMS — Pack & Cell Comparison');
  lines.push(`Generated ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(`${'Metric'.padEnd(30, ' ')} ${'Pack A'.padStart(18)} ${'Pack B'.padStart(18)}`);
  lines.push('-'.repeat(66));
  lines.push(row('Chemistry', a.chemName, b.chemName, ''));
  lines.push(row('Topology', `${a.series}S${a.parallel}P`, `${b.series}S${b.parallel}P`, ''));
  lines.push(row('Installed cells', String(a.cellCount), String(b.cellCount), ''));
  lines.push(row('Cell nominal voltage', fmt(a.cellNominalV, 2), fmt(b.cellNominalV, 2), 'V'));
  lines.push(row('Pack nominal voltage', fmt(a.packNominalV, 2), fmt(b.packNominalV, 2), 'V'));
  lines.push(row('Pack max / cutoff', `${fmt(a.packMaxV, 2)}/${fmt(a.packCutoffV, 2)}`, `${fmt(b.packMaxV, 2)}/${fmt(b.packCutoffV, 2)}`, 'V'));
  lines.push(row('Pack capacity', fmt(a.packCapacityAh, 2), fmt(b.packCapacityAh, 2), 'Ah'));
  lines.push(row('Pack energy', fmt(a.packEnergyWh, 0), fmt(b.packEnergyWh, 0), 'Wh'));
  lines.push(row('Pack internal resistance', fmt(a.packIRmOhm, 2), fmt(b.packIRmOhm, 2), 'mΩ'));
  lines.push(row('Max continuous discharge', fmt(a.maxDischargeA, 1), fmt(b.maxDischargeA, 1), 'A'));
  lines.push(row('Max charge current', fmt(a.maxChargeA, 1), fmt(b.maxChargeA, 1), 'A'));
  lines.push(row('Continuous power', fmt(a.contPowerW, 0), fmt(b.contPowerW, 0), 'W'));
  lines.push(row('Estimated cell mass', fmt(a.estPackKg, 2), fmt(b.estPackKg, 2), 'kg'));
  lines.push(row('Energy density', fmt(a.energyDensityWhKg, 0), fmt(b.energyDensityWhKg, 0), 'Wh/kg'));
  lines.push(row('Cycle life', String(a.cycleLife), String(b.cycleLife), 'cyc'));
  lines.push(row('Operating window', `${a.tempMin}…${a.tempMax}`, `${b.tempMin}…${b.tempMax}`, '°C'));
  lines.push(row('Thermal runaway onset', fmt(a.thermalRunawayTemp, 0), fmt(b.thermalRunawayTemp, 0), '°C'));
  lines.push(row('Safety rating', a.safetyRating, b.safetyRating, ''));
  lines.push(row('Cost class', a.costTier, b.costTier, ''));
  lines.push(row('Weighted score', `${a.scores.overall}/100`, `${b.scores.overall}/100`, ''));
  lines.push('');
  lines.push(`DETAILED COMPARISON`);
  lines.push('');
  lines.push(r.intro);
  for (const s of r.sections) {
    lines.push('');
    lines.push(`— ${s.title.toUpperCase()} —`);
    for (const p of s.paragraphs) lines.push(p);
  }
  lines.push('');
  lines.push('VERDICT');
  lines.push(r.verdict);
  return lines.join('\n');
}
