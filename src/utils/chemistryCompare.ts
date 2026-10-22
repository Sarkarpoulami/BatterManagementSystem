// Chemistry comparison engine — builds a detailed, fully numeric head-to-head
// between two cell types at a chosen series/parallel topology.
//
// Everything here is derived from BATTERY_CHEMISTRIES (the same data the
// simulator runs on), so the comparison can never drift from the model: pack
// voltages, capacities, currents, masses, sag, losses, scores and the written
// analysis are all computed, not hard-coded. The only authored text is the
// per-chemistry background profile (blurb / strengths / watch-outs).

import type { BatteryChemistryType, ChemistrySpec } from '../types/battery';
import { BATTERY_CHEMISTRIES, LOAD_PROFILES } from '../data/batteryChemistryData';

// Same bounds the pack builder uses, so a compared topology is also a buildable one.
export const SERIES_MIN = 1;
export const SERIES_MAX = 32;
export const PARALLEL_MIN = 1;
export const PARALLEL_MAX = 12;

/** Order used in the pickers. */
export const COMPARE_CHEMISTRIES: BatteryChemistryType[] = [
  'li-ion',
  'lipo',
  'solid-state',
  'lead-acid',
  'lifepo4',
  'nimh',
];

export const CHEMISTRY_LABELS: Record<BatteryChemistryType, string> = COMPARE_CHEMISTRIES.reduce(
  (acc, id) => ({ ...acc, [id]: BATTERY_CHEMISTRIES[id].name }),
  {} as Record<BatteryChemistryType, string>
);

// ── Authored background (domain facts, not derived numbers) ─────────────────

export interface ChemistryProfile {
  blurb: string;
  strengths: string[];
  watchOuts: string[];
}

export const CHEMISTRY_PROFILES: Record<BatteryChemistryType, ChemistryProfile> = {
  'li-ion': {
    blurb:
      'The general-purpose lithium workhorse: a nickel-manganese-cobalt cathode in a rigid steel can that balances energy density, power and cycle life well enough to become the default for EVs, power tools and portable electronics. It expects a real BMS — cell voltage held inside its window, temperature watched, current limited to the C-rating — but within those limits it is tolerant of a very wide range of duties.',
    strengths: [
      'High volumetric and gravimetric energy density — the best all-round compromise',
      'Rigid steel can with CID vent resists crush and contains moderate abuse',
      'Low self-discharge, so stored packs stay usable',
      'Mature, widely available, well-understood charging (CC/CV) and recycling streams',
      'Comfortable with moderate continuous C-rates and regenerative charging',
    ],
    watchOuts: [
      'NMC cathodes release oxygen once hot, so thermal runaway can propagate cell-to-cell',
      'Never charge below 0 °C — metallic lithium plates onto the anode and shorts later',
      'Calendar ageing accelerates when stored hot or at high state of charge',
      'Requires per-cell voltage, temperature and balancing supervision',
    ],
  },
  lipo: {
    blurb:
      'A high-rate pouch cell built for bursts rather than endurance. The laminated foil package and stacked electrodes give extremely low internal resistance, so the cell can deliver tens of times its capacity in current for short periods while staying cool. That is why FPV drones, RC models and thin wearables use it — and why the trade-offs are cycle life, mechanical delicacy and price.',
    strengths: [
      'Ultra-low internal resistance → enormous burst and continuous discharge capability',
      'Very light packaging: no steel can, so more of the mass is active material',
      'Shape-flexible pouch fits thin and irregular enclosures',
      'Accepts fast charging better than most lithium chemistries here',
      'Swelling gives a visible end-of-life warning before failure',
    ],
    watchOuts: [
      'Short cycle life — a few hundred deep cycles before capacity fades noticeably',
      'Pouches swell if overcharged, over-discharged or charged cold, then must be retired',
      'No rigid case: needs mechanical support, and puncture is a serious event',
      'Lower thermal-runaway onset than prismatic LFP, and less margin on voltage',
      'Premium cost per Wh and careful storage voltage required',
    ],
  },
  'solid-state': {
    blurb:
      'A lithium-metal cell that replaces the liquid carbonate electrolyte with a solid ceramic or sulfide conductor. No flammable solvent means dramatically better abuse tolerance, and the lithium-metal anode roughly doubles gravimetric energy density versus today\u2019s NMC. It is the leading candidate for long-range EVs and electric aviation; the penalties are cost, manufacturing maturity and stack-pressure sensitivity.',
    strengths: [
      'Highest energy density of the set — longest range or lightest pack for the same energy',
      'Non-flammable solid electrolyte: no venting, no oxygen-releasing liquid, A+ safety',
      'Very wide operating temperature range and the highest runaway onset here',
      'High charge acceptance, so genuinely fast charging is feasible',
      'Simpler pack architecture: less cooling, less containment, more volume utilisation',
    ],
    watchOuts: [
      'Top cost tier and limited production volume — supply and price are volatile',
      'Solid/solid interface resistance and dendrite growth at grain boundaries are still being engineered out',
      'Cycle-life figures are largely laboratory-scale; field data is young',
      'Cells need sustained stack pressure and tight manufacturing tolerances',
      'Repair, second-life and recycling routes are not yet established',
    ],
  },
  'lead-acid': {
    blurb:
      'The oldest rechargeable still in mass production: cast lead grids in sulfuric acid, sealed here as an AGM/VRLA monoblock. It is heavy and cycle-limited, but it is cheap, robust to abuse, tolerant of cold, capable of enormous surge currents and recyclable at rates no lithium chemistry approaches — which is why it still starts engines, backs up data centres and powers trolling motors.',
    strengths: [
      'Lowest upfront cost per pack and the simplest charging requirements (float-friendly)',
      'Exceptional surge current — the reason it remains the automotive starter standard',
      'Wide cold-weather tolerance and no low-temperature charge plating risk',
      'Established, near-universal recycling stream with very high recovery rates',
      'Forgiving of electrical abuse; usable without a sophisticated BMS',
    ],
    watchOuts: [
      'Heavy and bulky: roughly a fifth of the gravimetric energy of NMC',
      'Only a few hundred deep cycles — depth of discharge drives life sharply',
      'Sulfation sets in if the pack is left partially discharged',
      'Poor charge acceptance, so recharging a deep discharge takes many hours',
      'Gassing and ventilation requirements; flooded variants need topping up',
    ],
  },
  lifepo4: {
    blurb:
      'Lithium iron phosphate in a prismatic aluminium case. The olivine crystal lattice holds on to its oxygen, which makes the cell extremely difficult to push into thermal runaway, and it survives thousands of deep cycles. The price is a lower cell voltage, lower energy density and a discharge curve so flat that voltage-based state-of-charge estimation stops working — you must count coulombs.',
    strengths: [
      'Outstanding cycle life — several thousand deep cycles, i.e. a decade or more of daily use',
      'Excellent thermal and chemical stability: highest practical safety of the lithium options',
      'Very low internal resistance in prismatic format, so high efficiency and little heat',
      'No cobalt or nickel — cheaper, more stable and more ethical supply chain',
      'The default choice for stationary storage, RV/marine house banks and electric buses',
    ],
    watchOuts: [
      'Heavier and larger per kWh than NMC or pouch lithium',
      'Charging below 0 °C plates lithium — charge current must be temperature-gated',
      'Extremely flat voltage plateau hides state of charge from voltage alone',
      'Top-of-charge balancing is still essential in a series string',
      'Lower cell voltage means more cells in series for the same pack voltage',
    ],
  },
  nimh: {
    blurb:
      'An aqueous alkaline cell at 1.2 V: a nickel oxyhydroxide cathode, a metal-hydride anode and potassium hydroxide electrolyte, sealed with a re-sealable vent. There is no lithium and no flammable organic solvent, which makes it the most abuse-tolerant and one of the cheapest options here, and it powered hybrid vehicles for two decades. Energy density is roughly a third of lithium\u2019s and self-discharge is higher.',
    strengths: [
      'A+ safety: aqueous electrolyte does not burn, and the cell tolerates overcharge and reversal',
      'Low cost and simple, well-proven charging (−ΔV / temperature termination)',
      'Works over a wide temperature range including deep cold',
      'Robust to electrical abuse — no BMS needed for basic packs',
      'No lithium shipping restrictions; easy to transport and recycle',
    ],
    watchOuts: [
      'Low energy density and low cell voltage, so many cells in series for a given pack',
      'Noticeably higher self-discharge than lithium — a stored pack needs refreshing',
      'Voltage sags under load and the discharge curve is less flat than LFP',
      'Fast charging wastes energy as heat and needs careful termination',
      'Capacity fades with repeated deep cycling at high temperature',
    ],
  },
};

// ── Pack engineering maths ─────────────────────────────────────────────────

export interface PackMath {
  seriesCount: number;
  parallelCount: number;
  cellCount: number;
  cellNominalV: number;
  cellMaxV: number;
  cellCutoffV: number;
  cellCapacityMah: number;
  packNominalV: number;
  packChargeV: number;
  packCutoffV: number;
  voltageWindowV: number;
  capacityAh: number;
  energyWh: number;
  energyKwh: number;
  windowEnergyWh: number;
  packResistanceMohm: number;
  maxDischargeA: number;
  maxChargeA: number;
  peakDischargeW: number;
  sagAtMaxDischargeV: number;
  sagPct: number;
  ohmicLossW: number;
  efficiencyPct: number;
  massKg: number;
  whPerKg: number;
  dischargeMinutesAtMaxC: number;
  chargeHoursCC: number;
  cycleLife: number;
  serviceYearsPerDay: number;
  costTier: string;
  costTierValue: number;
  costIndex: number;
  costIndexPerKwh: number;
}

const SAFETY_POINTS: Record<ChemistrySpec['safetyRating'], number> = {
  'A+': 100,
  A: 85,
  'B+': 70,
  B: 55,
  C: 35,
};

const COST_POINTS: Record<ChemistrySpec['costTier'], number> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };

/** Charging is CC then a CV tail; ~25 % extra time is the usual rule of thumb. */
const CV_TAIL_FACTOR = 1.25;

export function packMath(spec: ChemistrySpec, seriesCount: number, parallelCount: number): PackMath {
  const s = Math.max(SERIES_MIN, Math.min(SERIES_MAX, Math.round(seriesCount) || 1));
  const p = Math.max(PARALLEL_MIN, Math.min(PARALLEL_MAX, Math.round(parallelCount) || 1));
  const cellAh = spec.typicalCapacity / 1000;
  const capacityAh = cellAh * p;
  const packNominalV = spec.nominalVoltage * s;
  const packChargeV = spec.maxVoltage * s;
  const packCutoffV = spec.cutoffVoltage * s;
  const energyWh = packNominalV * capacityAh;
  const packResistanceMohm = (spec.typicalIR * s) / p;
  const maxDischargeA = capacityAh * spec.maxDischargeC;
  const maxChargeA = capacityAh * spec.maxChargeC;
  const sagAtMaxDischargeV = (maxDischargeA * packResistanceMohm) / 1000;
  const ohmicLossW = maxDischargeA * maxDischargeA * (packResistanceMohm / 1000);
  const costTierValue = COST_POINTS[spec.costTier] ?? 2;

  return {
    seriesCount: s,
    parallelCount: p,
    cellCount: s * p,
    cellNominalV: spec.nominalVoltage,
    cellMaxV: spec.maxVoltage,
    cellCutoffV: spec.cutoffVoltage,
    cellCapacityMah: spec.typicalCapacity,
    packNominalV,
    packChargeV,
    packCutoffV,
    voltageWindowV: packChargeV - packCutoffV,
    capacityAh,
    energyWh,
    energyKwh: energyWh / 1000,
    windowEnergyWh: ((packChargeV + packCutoffV) / 2) * capacityAh,
    packResistanceMohm,
    maxDischargeA,
    maxChargeA,
    peakDischargeW: packNominalV * maxDischargeA,
    sagAtMaxDischargeV,
    sagPct: (sagAtMaxDischargeV / Math.max(0.001, packNominalV)) * 100,
    ohmicLossW,
    efficiencyPct: Math.max(0, 100 - (sagAtMaxDischargeV / Math.max(0.001, packNominalV)) * 100),
    massKg: energyWh / Math.max(1, spec.energyDensity),
    whPerKg: spec.energyDensity,
    dischargeMinutesAtMaxC: (1 / Math.max(0.01, spec.maxDischargeC)) * 60,
    chargeHoursCC: (1 / Math.max(0.01, spec.maxChargeC)) * CV_TAIL_FACTOR,
    cycleLife: spec.cycleLife,
    serviceYearsPerDay: spec.cycleLife / 365,
    costTier: spec.costTier,
    costTierValue,
    costIndex: costTierValue * s * p,
    costIndexPerKwh: (costTierValue * s * p) / Math.max(0.001, energyWh / 1000),
  };
}

/** How long the compared pack would last at a given constant load. */
export function runtimeHours(pack: PackMath, loadA: number): number {
  if (!Number.isFinite(loadA) || loadA <= 0.01) return 0;
  return pack.capacityAh / loadA;
}

export function runtimeText(pack: PackMath, loadA: number): string {
  const h = runtimeHours(pack, loadA);
  if (h <= 0) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

// ── Scoring (normalised across the whole chemistry library) ─────────────────

export interface ScoreDefinition {
  key: string;
  label: string;
  hint: string;
  weight: number;
  better: 'high' | 'low';
  unit: string;
  value: (spec: ChemistrySpec) => number;
}

export const SCORE_DEFINITIONS: ScoreDefinition[] = [
  {
    key: 'energy',
    label: 'Energy density',
    hint: 'Wh per kg of cell — how light the pack is for the energy stored',
    weight: 20,
    better: 'high',
    unit: 'Wh/kg',
    value: (s) => s.energyDensity,
  },
  {
    key: 'power',
    label: 'Power capability',
    hint: 'Continuous discharge C-rate — burst and surge headroom',
    weight: 15,
    better: 'high',
    unit: 'C',
    value: (s) => s.maxDischargeC,
  },
  {
    key: 'life',
    label: 'Cycle life',
    hint: 'Full equivalent cycles to end of life',
    weight: 20,
    better: 'high',
    unit: 'cycles',
    value: (s) => s.cycleLife,
  },
  {
    key: 'safety',
    label: 'Safety margin',
    hint: 'Safety rating blended with thermal-runaway onset temperature',
    weight: 20,
    better: 'high',
    unit: 'index',
    value: (s) => (SAFETY_POINTS[s.safetyRating] ?? 50) * 0.55 + ((s.thermalRunawayTemp - 60) / 3) * 0.45,
  },
  {
    key: 'thermal',
    label: 'Temperature range',
    hint: 'Width of the operating window plus deep-cold capability',
    weight: 10,
    better: 'high',
    unit: '°C',
    value: (s) => (s.tempMax - s.tempMin) * 0.6 + (30 - s.tempMin) * 0.4,
  },
  {
    key: 'cost',
    label: 'Cost',
    hint: 'Indicative cost tier — lower is better',
    weight: 10,
    better: 'low',
    unit: 'tier',
    value: (s) => COST_POINTS[s.costTier] ?? 2,
  },
  {
    key: 'resistance',
    label: 'Internal resistance',
    hint: 'Milliohms per cell — losses, heat and voltage sag',
    weight: 5,
    better: 'low',
    unit: 'mΩ',
    value: (s) => s.typicalIR,
  },
];

const LIBRARY = Object.values(BATTERY_CHEMISTRIES);

function libraryRange(def: ScoreDefinition): { min: number; max: number } {
  const values = LIBRARY.map(def.value);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** 0–100 score for one definition, normalised against all six chemistries. */
export function scoreOf(def: ScoreDefinition, spec: ChemistrySpec): number {
  const { min, max } = libraryRange(def);
  if (!Number.isFinite(max) || max === min) return 50;
  const raw = (def.value(spec) - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, raw));
  const oriented = def.better === 'high' ? clamped : 1 - clamped;
  // Keep every chemistry visibly on the scale instead of pinned to 0.
  return Math.round((12 + oriented * 88) * 10) / 10;
}

export interface ScoreRow {
  key: string;
  label: string;
  hint: string;
  weight: number;
  unit: string;
  better: 'high' | 'low';
  aValue: number;
  bValue: number;
  aText: string;
  bText: string;
  aScore: number;
  bScore: number;
  winner: 'a' | 'b' | 'tie';
}

export function scoreRows(a: ChemistrySpec, b: ChemistrySpec): ScoreRow[] {
  return SCORE_DEFINITIONS.map((def) => {
    const av = def.value(a);
    const bv = def.value(b);
    const aScore = scoreOf(def, a);
    const bScore = scoreOf(def, b);
    const diff = Math.abs(aScore - bScore);
    return {
      key: def.key,
      label: def.label,
      hint: def.hint,
      weight: def.weight,
      unit: def.unit,
      better: def.better,
      aValue: av,
      bValue: bv,
      aText: formatScoreValue(def, av),
      bText: formatScoreValue(def, bv),
      aScore,
      bScore,
      winner: diff < 3 ? 'tie' : aScore > bScore ? 'a' : 'b',
    };
  });
}

function formatScoreValue(def: ScoreDefinition, value: number): string {
  if (def.key === 'safety') return `${value.toFixed(0)} / 100`;
  if (def.key === 'cost') return costTierOf(value);
  if (def.key === 'thermal') return `${value.toFixed(0)} index`;
  if (def.key === 'life') return `${Math.round(value).toLocaleString()} cycles`;
  if (def.key === 'power') return `${value.toFixed(value < 10 ? 1 : 0)} C`;
  return `${Number(value.toFixed(2))} ${def.unit}`;
}

function costTierOf(value: number): string {
  const entry = Object.entries(COST_POINTS).find(([, v]) => v === value);
  return entry ? entry[0] : '$$';
}

export function overallScore(spec: ChemistrySpec): number {
  const rows = SCORE_DEFINITIONS.map((def) => ({ def, score: scoreOf(def, spec) }));
  const totalWeight = rows.reduce((sum, r) => sum + r.def.weight, 0);
  const weighted = rows.reduce((sum, r) => sum + r.score * r.def.weight, 0);
  return Math.round((weighted / Math.max(1, totalWeight)) * 10) / 10;
}

export function scoreBreakdown(spec: ChemistrySpec): { key: string; label: string; score: number }[] {
  return SCORE_DEFINITIONS.map((def) => ({ key: def.key, label: def.label, score: scoreOf(def, spec) }));
}

// ── Comparison rows ────────────────────────────────────────────────────────

export interface CompareRow {
  category: string;
  label: string;
  a: string;
  b: string;
  winner: 'a' | 'b' | 'tie';
  note?: string;
}

export type Winner = 'a' | 'b' | 'tie';

function pick(av: number, bv: number, better: 'high' | 'low', tolPct = 1): Winner {
  if (!Number.isFinite(av) || !Number.isFinite(bv)) return 'tie';
  const tol = Math.max(Math.abs(av), Math.abs(bv)) * (tolPct / 100);
  if (Math.abs(av - bv) <= tol) return 'tie';
  const aWins = better === 'high' ? av > bv : av < bv;
  return aWins ? 'a' : 'b';
}

function row(category: string, label: string, a: string, b: string, winner: Winner, note?: string): CompareRow {
  return { category, label, a, b, winner, note };
}

const num = (v: number, d = 2) => Number(v.toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d });

// ── Language helpers ───────────────────────────────────────────────────────

function deltaPct(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return ((a - b) / Math.abs(b)) * 100;
}

/** One decimal place below 10, none above, and no trailing ".0". */
function trimRatio(ratio: number): string {
  const text = ratio.toFixed(ratio < 10 ? 1 : 0);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

/** "LFP holds 28.5× the energy of Li-Ion" — direction-aware and tie/zero safe. */
function ratioPhrase(aName: string, av: number, bName: string, bv: number, noun: string): string {
  if (!Number.isFinite(av) || !Number.isFinite(bv) || av <= 0 || bv <= 0) return '';
  const ratio = Math.max(av, bv) / Math.min(av, bv);
  if (ratio < 1.05) return `${aName} and ${bName} are effectively level on ${noun}`;
  const leadName = av > bv ? aName : bName;
  const otherName = av > bv ? bName : aName;
  return `${leadName} offers ${trimRatio(ratio)}× the ${noun} of ${otherName}`;
}

/** Percentage difference, switching to a ratio once it gets silly-large. */
function moreLess(a: number, b: number): string {
  const d = deltaPct(a, b);
  const abs = Math.abs(d);
  if (abs > 300) {
    const ratio = Math.max(a, b) / Math.max(1e-6, Math.min(a, b));
    return `${ratio.toFixed(1)}× as much`;
  }
  return `${abs < 10 ? abs.toFixed(1) : abs.toFixed(0)}% ${d >= 0 ? 'more' : 'less'}`;
}

function nameOf(side: Side): string {
  return side.spec.shortName;
}

/** "LFP is 46× heavier than Li-Ion" — for metrics where less is better. */
function heavierPhrase(aName: string, av: number, bName: string, bv: number): string {
  if (!Number.isFinite(av) || !Number.isFinite(bv) || av <= 0 || bv <= 0) return '';
  const ratio = Math.max(av, bv) / Math.min(av, bv);
  if (ratio < 1.05) return 'the two weigh about the same';
  const heavyName = av > bv ? aName : bName;
  const lightName = av > bv ? bName : aName;
  return `${heavyName} is ${trimRatio(ratio)}× heavier than ${lightName}`;
}

// ── The comparison itself ──────────────────────────────────────────────────

export interface CompareInput {
  chemistry: BatteryChemistryType;
  seriesCount: number;
  parallelCount: number;
}

export interface Side {
  input: CompareInput;
  spec: ChemistrySpec;
  pack: PackMath;
  profile: ChemistryProfile;
  breakdown: { key: string; label: string; score: number }[];
  overall: number;
}

export interface Dimension {
  title: string;
  text: string;
  winner: Winner;
}

export interface UseCasePick {
  use: string;
  pick: Winner;
  why: string;
}

export interface Comparison {
  id: string;
  generatedAt: string;
  loadA: number;
  a: Side;
  b: Side;
  scores: ScoreRow[];
  rows: CompareRow[];
  dimensions: Dimension[];
  verdict: string;
  verdictWinner: Winner;
  useCases: UseCasePick[];
  recommendations: string[];
  sharedProfiles: string[];
  onlyAProfiles: string[];
  onlyBProfiles: string[];
}

function buildSide(input: CompareInput): Side {
  const spec = BATTERY_CHEMISTRIES[input.chemistry];
  return {
    input,
    spec,
    pack: packMath(spec, input.seriesCount, input.parallelCount),
    profile: CHEMISTRY_PROFILES[input.chemistry],
    breakdown: scoreBreakdown(spec),
    overall: overallScore(spec),
  };
}

/** Every simulator load profile that recommends a chemistry. */
function profileFit(chemistry: BatteryChemistryType): string[] {
  return Object.values(LOAD_PROFILES)
    .filter((p) => p.chemistryRecommendation.includes(chemistry))
    .map((p) => p.name);
}

export function compareChemistries(aInput: CompareInput, bInput: CompareInput, loadA = 12): Comparison {
  const a = buildSide(aInput);
  const b = buildSide(bInput);
  const an = nameOf(a);
  const bn = nameOf(b);
  const same = aInput.chemistry === bInput.chemistry;

  const scores = scoreRows(a.spec, b.spec);

  // ── Spec + derived rows ──
  const rows: CompareRow[] = [
    row('Cell', 'Chemistry', a.spec.fullName, b.spec.fullName, 'tie'),
    row('Cell', 'Cell formula', a.spec.formula, b.spec.formula, 'tie'),
    row('Cell', 'Form factor', a.spec.formFactorName, b.spec.formFactorName, 'tie'),
    row('Electrical', 'Nominal cell voltage', `${num(a.spec.nominalVoltage)} V`, `${num(b.spec.nominalVoltage)} V`, pick(a.spec.nominalVoltage, b.spec.nominalVoltage, 'high'), 'Higher means fewer cells in series for a target pack voltage'),
    row('Electrical', 'Charge (max) cell voltage', `${num(a.spec.maxVoltage)} V`, `${num(b.spec.maxVoltage)} V`, 'tie'),
    row('Electrical', 'Cutoff cell voltage', `${num(a.spec.cutoffVoltage)} V`, `${num(b.spec.cutoffVoltage)} V`, 'tie'),
    row('Electrical', 'Voltage window per cell', `${num(a.spec.maxVoltage - a.spec.cutoffVoltage)} V`, `${num(b.spec.maxVoltage - b.spec.cutoffVoltage)} V`, pick(a.spec.maxVoltage - a.spec.cutoffVoltage, b.spec.maxVoltage - b.spec.cutoffVoltage, 'high')),
    row('Electrical', 'Typical cell capacity', `${num(a.spec.typicalCapacity, 0)} mAh`, `${num(b.spec.typicalCapacity, 0)} mAh`, pick(a.spec.typicalCapacity, b.spec.typicalCapacity, 'high')),
    row('Electrical', 'Typical internal resistance', `${num(a.spec.typicalIR)} mΩ`, `${num(b.spec.typicalIR)} mΩ`, pick(a.spec.typicalIR, b.spec.typicalIR, 'low'), 'Lower means less heat and less voltage sag under load'),
    row('Electrical', 'Energy density', `${num(a.spec.energyDensity, 0)} Wh/kg`, `${num(b.spec.energyDensity, 0)} Wh/kg`, pick(a.spec.energyDensity, b.spec.energyDensity, 'high')),
    row('Electrical', 'Max continuous discharge', `${num(a.spec.maxDischargeC, 1)} C`, `${num(b.spec.maxDischargeC, 1)} C`, pick(a.spec.maxDischargeC, b.spec.maxDischargeC, 'high')),
    row('Electrical', 'Max charge rate', `${num(a.spec.maxChargeC, 1)} C`, `${num(b.spec.maxChargeC, 1)} C`, pick(a.spec.maxChargeC, b.spec.maxChargeC, 'high')),

    row('Pack build', 'Series / parallel', `${a.pack.seriesCount}S${a.pack.parallelCount}P`, `${b.pack.seriesCount}S${b.pack.parallelCount}P`, 'tie'),
    row('Pack build', 'Cell count', String(a.pack.cellCount), String(b.pack.cellCount), 'tie'),
    row('Pack build', 'Pack nominal voltage', `${num(a.pack.packNominalV, 1)} V`, `${num(b.pack.packNominalV, 1)} V`, 'tie', 'Set by the series count you chose'),
    row('Pack build', 'Pack charge voltage (CV set point)', `${num(a.pack.packChargeV, 1)} V`, `${num(b.pack.packChargeV, 1)} V`, 'tie'),
    row('Pack build', 'Pack cutoff voltage', `${num(a.pack.packCutoffV, 1)} V`, `${num(b.pack.packCutoffV, 1)} V`, 'tie'),
    row('Pack build', 'Pack capacity', `${num(a.pack.capacityAh, 2)} Ah`, `${num(b.pack.capacityAh, 2)} Ah`, 'tie', 'Set by the parallel count you chose'),
    row('Pack build', 'Stored energy', `${num(a.pack.energyWh, 0)} Wh`, `${num(b.pack.energyWh, 0)} Wh`, pick(a.pack.energyWh, b.pack.energyWh, 'high')),
    row('Pack build', 'Energy across the voltage window', `${num(a.pack.windowEnergyWh, 0)} Wh`, `${num(b.pack.windowEnergyWh, 0)} Wh`, pick(a.pack.windowEnergyWh, b.pack.windowEnergyWh, 'high'), 'Mean of charge and cutoff voltage × Ah'),
    row('Pack build', 'Estimated pack mass', `${num(a.pack.massKg, 2)} kg`, `${num(b.pack.massKg, 2)} kg`, pick(a.pack.massKg, b.pack.massKg, 'low'), 'Stored energy ÷ energy density (cells only)'),
    row('Pack build', 'Pack DC resistance', `${num(a.pack.packResistanceMohm, 2)} mΩ`, `${num(b.pack.packResistanceMohm, 2)} mΩ`, pick(a.pack.packResistanceMohm, b.pack.packResistanceMohm, 'low'), 'Cell IR × series ÷ parallel'),
    row('Pack build', 'Max continuous discharge current', `${num(a.pack.maxDischargeA, 1)} A`, `${num(b.pack.maxDischargeA, 1)} A`, pick(a.pack.maxDischargeA, b.pack.maxDischargeA, 'high')),
    row('Pack build', 'Peak discharge power', `${num(a.pack.peakDischargeW, 0)} W`, `${num(b.pack.peakDischargeW, 0)} W`, pick(a.pack.peakDischargeW, b.pack.peakDischargeW, 'high')),
    row('Pack build', 'Max charge current', `${num(a.pack.maxChargeA, 1)} A`, `${num(b.pack.maxChargeA, 1)} A`, pick(a.pack.maxChargeA, b.pack.maxChargeA, 'high')),
    row('Pack build', 'Voltage sag at max current', `${num(a.pack.sagAtMaxDischargeV, 2)} V (${num(a.pack.sagPct, 1)}%)`, `${num(b.pack.sagAtMaxDischargeV, 2)} V (${num(b.pack.sagPct, 1)}%)`, pick(a.pack.sagPct, b.pack.sagPct, 'low'), 'Percentage of nominal — lower holds voltage better'),
    row('Pack build', 'Ohmic loss at max current', `${num(a.pack.ohmicLossW, 1)} W`, `${num(b.pack.ohmicLossW, 1)} W`, 'tie', 'Absolute I²R heat scales with the size of the pack'),
    row('Pack build', `Runtime at ${num(loadA, 1)} A`, runtimeText(a.pack, loadA), runtimeText(b.pack, loadA), pick(a.pack.capacityAh, b.pack.capacityAh, 'high')),
    row('Pack build', 'Empty time at max discharge', `${num(a.pack.dischargeMinutesAtMaxC, 0)} min`, `${num(b.pack.dischargeMinutesAtMaxC, 0)} min`, pick(a.pack.dischargeMinutesAtMaxC, b.pack.dischargeMinutesAtMaxC, 'high'), 'Longer means the C-rating is gentler'),
    row('Pack build', 'Charge time (CC + CV tail)', `${num(a.pack.chargeHoursCC, 1)} h`, `${num(b.pack.chargeHoursCC, 1)} h`, pick(a.pack.chargeHoursCC, b.pack.chargeHoursCC, 'low')),

    row('Thermal', 'Operating range', `${num(a.spec.tempMin, 0)} … ${num(a.spec.tempMax, 0)} °C`, `${num(b.spec.tempMin, 0)} … ${num(b.spec.tempMax, 0)} °C`, pick(a.spec.tempMax - a.spec.tempMin, b.spec.tempMax - b.spec.tempMin, 'high')),
    row('Thermal', 'Cold limit', `${num(a.spec.tempMin, 0)} °C`, `${num(b.spec.tempMin, 0)} °C`, pick(a.spec.tempMin, b.spec.tempMin, 'low')),
    row('Thermal', 'Hot limit', `${num(a.spec.tempMax, 0)} °C`, `${num(b.spec.tempMax, 0)} °C`, pick(a.spec.tempMax, b.spec.tempMax, 'high')),
    row('Thermal', 'Thermal runaway onset', `${num(a.spec.thermalRunawayTemp, 0)} °C`, `${num(b.spec.thermalRunawayTemp, 0)} °C`, pick(a.spec.thermalRunawayTemp, b.spec.thermalRunawayTemp, 'high'), 'Higher means more margin before a thermal event'),

    row('Life & cost', 'Cycle life', `${num(a.spec.cycleLife, 0)} cycles`, `${num(b.spec.cycleLife, 0)} cycles`, pick(a.spec.cycleLife, b.spec.cycleLife, 'high')),
    row('Life & cost', 'Service life at 1 cycle/day', `${num(a.pack.serviceYearsPerDay, 1)} years`, `${num(b.pack.serviceYearsPerDay, 1)} years`, pick(a.pack.serviceYearsPerDay, b.pack.serviceYearsPerDay, 'high')),
    row('Life & cost', 'Cost tier', a.spec.costTier, b.spec.costTier, pick(a.pack.costTierValue, b.pack.costTierValue, 'low'), 'Indicative unit-cost band: $ low → $$$$ premium'),
    row('Life & cost', 'Relative pack cost index', num(a.pack.costIndex, 0), num(b.pack.costIndex, 0), pick(a.pack.costIndex, b.pack.costIndex, 'low'), 'Cost tier × cell count — relative, not a price'),
    row('Life & cost', 'Cost index per kWh', num(a.pack.costIndexPerKwh, 1), num(b.pack.costIndexPerKwh, 1), pick(a.pack.costIndexPerKwh, b.pack.costIndexPerKwh, 'low')),
    row('Life & cost', 'Safety rating', a.spec.safetyRating, b.spec.safetyRating, pick(SAFETY_POINTS[a.spec.safetyRating], SAFETY_POINTS[b.spec.safetyRating], 'high')),

    row('Construction', 'Cathode', a.spec.cathodeMaterial, b.spec.cathodeMaterial, 'tie'),
    row('Construction', 'Anode', a.spec.anodeMaterial, b.spec.anodeMaterial, 'tie'),
    row('Construction', 'Electrolyte', a.spec.electrolyteType, b.spec.electrolyteType, 'tie'),
    row('Construction', 'Separator', a.spec.separatorType, b.spec.separatorType, 'tie'),
    row('Construction', 'Housing', a.spec.housingMaterial, b.spec.housingMaterial, 'tie'),
    row('Construction', 'Charge reaction', a.spec.chemicalReaction.charge, b.spec.chemicalReaction.charge, 'tie'),
    row('Construction', 'Discharge reaction', a.spec.chemicalReaction.discharge, b.spec.chemicalReaction.discharge, 'tie'),

    row('Application', 'Typical uses', a.spec.primaryApplications.join('; '), b.spec.primaryApplications.join('; '), 'tie'),
    row('Application', 'Simulator profiles that recommend it', profileFit(a.input.chemistry).join('; ') || '—', profileFit(b.input.chemistry).join('; ') || '—', 'tie'),
  ];

  // ── Written analysis ──
  const dimensions: Dimension[] = same
    ? sameChemistryDimensions(a, b, loadA)
    : [
        voltageEnergyDimension(a, b),
        powerDimension(a, b, loadA),
        lifeCostDimension(a, b),
        thermalSafetyDimension(a, b),
        constructionDimension(a, b),
        fitDimension(a, b, loadA),
      ];

  // ── Use-case picks ──
  const useCases: UseCasePick[] = [
    {
      use: 'Longest service life / daily deep cycling',
      pick: pick(a.spec.cycleLife, b.spec.cycleLife, 'high', 0.5),
      why: `${an} is rated ${num(a.spec.cycleLife, 0)} cycles (${num(a.pack.serviceYearsPerDay, 1)} years at one cycle a day) against ${num(b.spec.cycleLife, 0)} for ${bn} (${num(b.pack.serviceYearsPerDay, 1)} years) — ${ratioPhrase(an, a.spec.cycleLife, bn, b.spec.cycleLife, 'cycle life')}.`,
    },
    {
      use: 'Lightest pack for the same energy',
      pick: pick(a.spec.energyDensity, b.spec.energyDensity, 'high', 0.5),
      why: `${num(a.spec.energyDensity, 0)} Wh/kg vs ${num(b.spec.energyDensity, 0)} Wh/kg — at the chosen topology that is ${num(a.pack.massKg, 2)} kg vs ${num(b.pack.massKg, 2)} kg of cells.`,
    },
    {
      use: 'Highest burst / surge power from the pack',
      pick: pick(a.pack.peakDischargeW, b.pack.peakDischargeW, 'high', 0.5),
      why: `${num(a.pack.peakDischargeW / 1000, 1)} kW (${num(a.pack.maxDischargeA, 0)} A at ${num(a.spec.maxDischargeC, 1)} C) vs ${num(b.pack.peakDischargeW / 1000, 1)} kW (${num(b.pack.maxDischargeA, 0)} A at ${num(b.spec.maxDischargeC, 1)} C).`,
    },
    {
      use: 'Highest cell-level rate capability',
      pick: pick(a.spec.maxDischargeC, b.spec.maxDischargeC, 'high', 0.5),
      why: `${num(a.spec.maxDischargeC, 1)} C continuous for ${an} vs ${num(b.spec.maxDischargeC, 1)} C for ${bn} — independent of how many cells you put in parallel.`,
    },
    {
      use: 'Lowest fire risk / harshest environment',
      pick: pick(
        a.spec.thermalRunawayTemp * 0.5 + (SAFETY_POINTS[a.spec.safetyRating] ?? 0) * 2,
        b.spec.thermalRunawayTemp * 0.5 + (SAFETY_POINTS[b.spec.safetyRating] ?? 0) * 2,
        'high',
        0.5
      ),
      why: `Runaway onset ${num(a.spec.thermalRunawayTemp, 0)} °C (safety rating ${a.spec.safetyRating}) vs ${num(b.spec.thermalRunawayTemp, 0)} °C (safety rating ${b.spec.safetyRating}).`,
    },
    {
      use: 'Lowest upfront cost',
      pick: pick(a.pack.costIndex, b.pack.costIndex, 'low', 0.5),
      why: `Cost tier ${a.spec.costTier} × ${a.pack.cellCount} cells (index ${num(a.pack.costIndex, 0)}) vs ${b.spec.costTier} × ${b.pack.cellCount} (index ${num(b.pack.costIndex, 0)}); per kWh stored it is ${num(a.pack.costIndexPerKwh, 1)} vs ${num(b.pack.costIndexPerKwh, 1)}.`,
    },
    {
      use: 'Cold-climate operation',
      pick: pick(a.spec.tempMin, b.spec.tempMin, 'low', 0.5),
      why: `Rated down to ${num(a.spec.tempMin, 0)} °C vs ${num(b.spec.tempMin, 0)} °C; hot limits are ${num(a.spec.tempMax, 0)} °C and ${num(b.spec.tempMax, 0)} °C.`,
    },
    {
      use: 'Fastest recharge',
      pick: pick(a.pack.chargeHoursCC, b.pack.chargeHoursCC, 'low', 0.5),
      why: `${num(a.spec.maxChargeC, 1)} C charge (${num(a.pack.maxChargeA, 1)} A here) → about ${num(a.pack.chargeHoursCC, 1)} h vs ${num(b.spec.maxChargeC, 1)} C (${num(b.pack.maxChargeA, 1)} A) → about ${num(b.pack.chargeHoursCC, 1)} h including the CV tail.`,
    },
    {
      use: `Longest runtime at ${num(loadA, 1)} A`,
      pick: pick(a.pack.capacityAh, b.pack.capacityAh, 'high', 0.5),
      why: `${num(a.pack.capacityAh, 2)} Ah → ${runtimeText(a.pack, loadA)} vs ${num(b.pack.capacityAh, 2)} Ah → ${runtimeText(b.pack, loadA)}.`,
    },
    {
      use: 'Best voltage hold under load',
      pick: pick(a.pack.sagPct, b.pack.sagPct, 'low', 0.5),
      why: `${num(a.pack.sagPct, 1)}% sag at rated maximum current (${num(a.pack.sagAtMaxDischargeV, 2)} V of ${num(a.pack.packNominalV, 1)} V) vs ${num(b.pack.sagPct, 1)}% (${num(b.pack.sagAtMaxDischargeV, 2)} V of ${num(b.pack.packNominalV, 1)} V).`,
    },
  ];

  const aWins = useCases.filter((u) => u.pick === 'a').length;
  const bWins = useCases.filter((u) => u.pick === 'b').length;
  const ties = useCases.filter((u) => u.pick === 'tie').length;
  const verdictWinner: Winner = Math.abs(a.overall - b.overall) < 2 ? 'tie' : a.overall > b.overall ? 'a' : 'b';

  const verdict = same
    ? `Both sides are ${an}, so this is a topology study rather than a chemistry choice: ${a.pack.seriesCount}S${a.pack.parallelCount}P against ${b.pack.seriesCount}S${b.pack.parallelCount}P. Series count sets the pack voltage, parallel count sets capacity and current capability, and the cell count drives mass and cost.`
    : `${an} versus ${bn}, built as ${a.pack.seriesCount}S${a.pack.parallelCount}P and ${b.pack.seriesCount}S${b.pack.parallelCount}P. ` +
      `On the weighted scorecard ${verdictWinner === 'tie' ? 'the two are effectively level' : `${verdictWinner === 'a' ? an : bn} leads`} (${num(a.overall, 1)} vs ${num(b.overall, 1)} of 100), ` +
      `and across the ${useCases.length} use cases below ${an} wins ${aWins}, ${bn} wins ${bWins}${ties ? ` and ${ties} tie` : ''}. ` +
      `${headlineStrength(a, b)} ${headlineStrength(b, a)}`;

  const recommendations = buildRecommendations(a, b, loadA, verdictWinner, scores);

  const aProfiles = new Set(profileFit(a.input.chemistry));
  const bProfiles = new Set(profileFit(b.input.chemistry));

  return {
    id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    generatedAt: new Date().toISOString(),
    loadA,
    a,
    b,
    scores,
    rows,
    dimensions,
    verdict,
    verdictWinner,
    useCases,
    recommendations,
    sharedProfiles: [...aProfiles].filter((p) => bProfiles.has(p)),
    onlyAProfiles: [...aProfiles].filter((p) => !bProfiles.has(p)),
    onlyBProfiles: [...bProfiles].filter((p) => !aProfiles.has(p)),
  };
}

function headlineStrength(side: Side, other: Side): string {
  const scored = SCORE_DEFINITIONS.map((def) => ({
    def,
    mine: scoreOf(def, side.spec),
    theirs: scoreOf(def, other.spec),
  })).sort((x, y) => y.mine - y.theirs - (x.mine - x.theirs));
  const top = scored[0];
  if (!top) return '';
  const margin = top.mine - top.theirs;
  if (margin < 4) return `${nameOf(side)} has no clear advantage on the weighted dimensions at this topology.`;
  return `${nameOf(side)}'s clearest advantage is ${top.def.label.toLowerCase()} (${top.mine.toFixed(0)} vs ${top.theirs.toFixed(0)} on the normalised scale).`;
}

// ── Narrative builders ─────────────────────────────────────────────────────

function voltageEnergyDimension(a: Side, b: Side): Dimension {
  const an = nameOf(a);
  const bn = nameOf(b);
  const winner = pick(a.pack.energyWh, b.pack.energyWh, 'high');
  const massWinner = pick(a.pack.massKg, b.pack.massKg, 'low');
  const text =
    `${an} works at ${num(a.spec.nominalVoltage)} V per cell and ${bn} at ${num(b.spec.nominalVoltage)} V, so the same series count yields ` +
    `${num(a.pack.packNominalV, 1)} V against ${num(b.pack.packNominalV, 1)} V nominal — reaching a common 48 V bus takes ` +
    `${Math.ceil(48 / a.spec.nominalVoltage)} ${an} cells in series but ${Math.ceil(48 / b.spec.nominalVoltage)} of ${bn}. ` +
    `At the topology chosen here the packs store ${num(a.pack.energyWh, 0)} Wh and ${num(b.pack.energyWh, 0)} Wh ` +
    `(${winner === 'tie' ? 'effectively the same' : `${winner === 'a' ? an : bn} holds ${moreLess(Math.max(a.pack.energyWh, b.pack.energyWh), Math.min(a.pack.energyWh, b.pack.energyWh))}`}), ` +
    `or ${num(a.pack.windowEnergyWh, 0)} Wh and ${num(b.pack.windowEnergyWh, 0)} Wh measured across the usable voltage window. ` +
    `Gravimetric density is ${num(a.spec.energyDensity, 0)} Wh/kg against ${num(b.spec.energyDensity, 0)} Wh/kg, so the cells for these packs weigh ` +
    `${num(a.pack.massKg, 2)} kg versus ${num(b.pack.massKg, 2)} kg — ${massWinner === 'tie' ? 'a wash on mass' : `${massWinner === 'a' ? an : bn} is the lighter build — ${heavierPhrase(an, a.pack.massKg, bn, b.pack.massKg)}`}.`;
  return { title: 'Voltage, energy and mass', text, winner };
}

function powerDimension(a: Side, b: Side, loadA: number): Dimension {
  const an = nameOf(a);
  const bn = nameOf(b);
  const winner = pick(a.pack.maxDischargeA, b.pack.maxDischargeA, 'high');
  const effWinner = pick(a.pack.sagPct, b.pack.sagPct, 'low');
  const cRateA = loadA / Math.max(0.001, a.pack.capacityAh);
  const cRateB = loadA / Math.max(0.001, b.pack.capacityAh);
  const text =
    `Cell rate capability is ${num(a.spec.maxDischargeC, 1)} C for ${an} and ${num(b.spec.maxDischargeC, 1)} C for ${bn}. ` +
    `Multiplied by the capacity each topology gives, the packs can deliver ${num(a.pack.maxDischargeA, 1)} A (${num(a.pack.peakDischargeW / 1000, 1)} kW) versus ` +
    `${num(b.pack.maxDischargeA, 1)} A (${num(b.pack.peakDischargeW / 1000, 1)} kW) — ${ratioPhrase(an, a.pack.peakDischargeW, bn, b.pack.peakDischargeW, 'peak power')}. ` +
    `Cell resistance is ${num(a.spec.typicalIR)} mΩ versus ${num(b.spec.typicalIR)} mΩ, which at ${a.pack.seriesCount}S${a.pack.parallelCount}P / ${b.pack.seriesCount}S${b.pack.parallelCount}P becomes ` +
    `${num(a.pack.packResistanceMohm, 2)} mΩ and ${num(b.pack.packResistanceMohm, 2)} mΩ of pack resistance. ` +
    `At its own rated maximum current ${an} sags ${num(a.pack.sagAtMaxDischargeV, 2)} V (${num(a.pack.sagPct, 1)}% of nominal, ${num(a.pack.ohmicLossW, 1)} W of I²R heat) while ${bn} sags ` +
    `${num(b.pack.sagAtMaxDischargeV, 2)} V (${num(b.pack.sagPct, 1)}%, ${num(b.pack.ohmicLossW, 1)} W), so ${effWinner === 'tie' ? 'both hold voltage about equally well' : `${effWinner === 'a' ? an : bn} is the more efficient build in percentage terms`} ` +
    `(absolute heat always scales with how big the pack is, so compare the percentages, not the watts). ` +
    `At your ${num(loadA, 1)} A working load that is a ${num(cRateA, 2)} C draw on ${an} and ${num(cRateB, 2)} C on ${bn}, giving ${runtimeText(a.pack, loadA)} and ${runtimeText(b.pack, loadA)} of runtime.`;
  return { title: 'Power delivery, resistance and efficiency', text, winner };
}

function lifeCostDimension(a: Side, b: Side): Dimension {
  const an = nameOf(a);
  const bn = nameOf(b);
  const winner = pick(a.spec.cycleLife, b.spec.cycleLife, 'high');
  const costWinner = pick(a.pack.costIndexPerKwh, b.pack.costIndexPerKwh, 'low');
  const text =
    `${an} is rated ${num(a.spec.cycleLife, 0)} full cycles and ${bn} ${num(b.spec.cycleLife, 0)} — at one equivalent cycle per day that is ` +
    `${num(a.pack.serviceYearsPerDay, 1)} years versus ${num(b.pack.serviceYearsPerDay, 1)} years of service (${ratioPhrase(an, a.spec.cycleLife, bn, b.spec.cycleLife, 'cycle life')}). ` +
    `Upfront cost sits in tier ${a.spec.costTier} for ${an} and ${b.spec.costTier} for ${bn}; scaled by the ${a.pack.cellCount} and ${b.pack.cellCount} cells in these builds the relative cost index is ` +
    `${num(a.pack.costIndex, 0)} versus ${num(b.pack.costIndex, 0)}, and per kWh stored ${num(a.pack.costIndexPerKwh, 1)} versus ${num(b.pack.costIndexPerKwh, 1)} index units. ` +
    (costWinner === 'tie'
      ? `Cost per kWh is close enough that lifetime should decide.`
      : `${costWinner === 'a' ? an : bn} is the cheaper build per kWh stored today${winner === 'tie' ? '.' : `, while ${winner === 'a' ? an : bn} lasts longer — divide the cost index by the cycle life to compare cost per Wh delivered over the whole service life.`}`);
  return { title: 'Lifetime, cycles and economics', text, winner };
}

function thermalSafetyDimension(a: Side, b: Side): Dimension {
  const an = nameOf(a);
  const bn = nameOf(b);
  const winner = pick(a.spec.thermalRunawayTemp, b.spec.thermalRunawayTemp, 'high');
  const text =
    `The operating window is ${num(a.spec.tempMin, 0)} °C to ${num(a.spec.tempMax, 0)} °C for ${an} and ${num(b.spec.tempMin, 0)} °C to ${num(b.spec.tempMax, 0)} °C for ${bn} ` +
    `(${num(a.spec.tempMax - a.spec.tempMin, 0)} °C wide versus ${num(b.spec.tempMax - b.spec.tempMin, 0)} °C). ` +
    `Thermal-runaway onset is the headline safety number: ${num(a.spec.thermalRunawayTemp, 0)} °C for ${an} against ${num(b.spec.thermalRunawayTemp, 0)} °C for ${bn}, ` +
    `with library safety ratings of ${a.spec.safetyRating} and ${b.spec.safetyRating}. ` +
    `Packaging follows the chemistry — ${a.spec.housingMaterial} on one side, ${b.spec.housingMaterial} on the other — and that decides how a cell vents, ` +
    `whether an event can be contained, and how much mechanical protection the module needs. ` +
    (winner === 'tie'
      ? `Both need the same discipline: temperature-gated charging, per-cell voltage limits and balancing.`
      : `${winner === 'a' ? an : bn} gives more thermal margin, but neither chemistry removes the need for temperature-gated charging, per-cell voltage limits and balancing.`);
  return { title: 'Thermal behaviour and safety', text, winner };
}

function constructionDimension(a: Side, b: Side): Dimension {
  const an = nameOf(a);
  const bn = nameOf(b);
  const text =
    `${an} — form factor: ${a.spec.formFactorName}. Cathode: ${a.spec.cathodeMaterial}. Anode: ${a.spec.anodeMaterial}. ` +
    `Electrolyte: ${a.spec.electrolyteType}. Separator: ${a.spec.separatorType}. Housing: ${a.spec.housingMaterial}. ` +
    `${bn} — form factor: ${b.spec.formFactorName}. Cathode: ${b.spec.cathodeMaterial}. Anode: ${b.spec.anodeMaterial}. ` +
    `Electrolyte: ${b.spec.electrolyteType}. Separator: ${b.spec.separatorType}. Housing: ${b.spec.housingMaterial}. ` +
    `Form factor drives the mechanical design of the pack: cylindrical cans are strong and easy to cool in a staggered array but waste volume between cells, ` +
    `prismatic blocks pack densely and carry stud terminals, pouches are the lightest and most shape-flexible but need external support, and monoblocks are heavy and simple. ` +
    `On the electrochemistry, ${an} discharges as ${a.spec.chemicalReaction.discharge} whereas ${bn} discharges as ${b.spec.chemicalReaction.discharge}.`;
  return { title: 'Construction, materials and electrochemistry', text, winner: 'tie' };
}

function fitDimension(a: Side, b: Side, loadA: number): Dimension {
  const an = nameOf(a);
  const bn = nameOf(b);
  const aProfiles = profileFit(a.input.chemistry);
  const bProfiles = profileFit(b.input.chemistry);
  const both = aProfiles.filter((p) => bProfiles.includes(p));
  const longer = runtimeHours(a.pack, loadA) >= runtimeHours(b.pack, loadA) ? a : b;
  const surges = a.spec.maxDischargeC >= b.spec.maxDischargeC ? a : b;
  const text =
    `${an} is what this simulator's profile library recommends for ${aProfiles.length ? aProfiles.join(', ') : 'none of the built-in profiles'}; ` +
    `${bn} for ${bProfiles.length ? bProfiles.join(', ') : 'none'}. ` +
    `${both.length ? `Both are suggested for ${both.join(', ')}. ` : ''}` +
    `For a ${num(loadA, 1)} A duty — the steady draw of an EV cruise or a solar inverter — ${nameOf(longer)} gives the longer runtime at the chosen topology ` +
    `(${runtimeText(a.pack, loadA)} vs ${runtimeText(b.pack, loadA)}), while ${nameOf(surges)} is the one to reach for when that duty turns into surges ` +
    `(${num(a.spec.maxDischargeC, 1)} C vs ${num(b.spec.maxDischargeC, 1)} C). ` +
    `Either choice can be applied to the live pack and run through the matching profile — the simulator reproduces these numbers tick by tick and archives the report to History.`;
  return { title: 'Fit for purpose in this simulator', text, winner: 'tie' };
}

function sameChemistryDimensions(a: Side, b: Side, loadA: number): Dimension[] {
  const an = nameOf(a);
  return [
    {
      title: 'Topology effect on voltage and energy',
      winner: pick(a.pack.energyWh, b.pack.energyWh, 'high'),
      text:
        `Both sides are ${an}, so this is a pure series/parallel study. ${a.pack.seriesCount}S${a.pack.parallelCount}P gives ${num(a.pack.packNominalV, 1)} V and ${num(a.pack.capacityAh, 2)} Ah ` +
        `(${num(a.pack.energyWh, 0)} Wh from ${a.pack.cellCount} cells), while ${b.pack.seriesCount}S${b.pack.parallelCount}P gives ${num(b.pack.packNominalV, 1)} V and ${num(b.pack.capacityAh, 2)} Ah ` +
        `(${num(b.pack.energyWh, 0)} Wh from ${b.pack.cellCount} cells). Series raises voltage and leaves capacity alone; parallel raises capacity and current capability and leaves voltage alone; ` +
        `stored energy tracks the cell count either way.`,
    },
    {
      title: 'Topology effect on current, resistance and sag',
      winner: pick(a.pack.sagPct, b.pack.sagPct, 'low'),
      text:
        `Pack resistance is cell IR × series ÷ parallel: ${num(a.pack.packResistanceMohm, 2)} mΩ versus ${num(b.pack.packResistanceMohm, 2)} mΩ. ` +
        `Maximum continuous current is ${num(a.pack.maxDischargeA, 1)} A versus ${num(b.pack.maxDischargeA, 1)} A, and at that current the sag is ${num(a.pack.sagAtMaxDischargeV, 2)} V (${num(a.pack.sagPct, 1)}%) ` +
        `versus ${num(b.pack.sagAtMaxDischargeV, 2)} V (${num(b.pack.sagPct, 1)}%), with ${num(a.pack.ohmicLossW, 1)} W and ${num(b.pack.ohmicLossW, 1)} W lost as heat. ` +
        `Parallel strings share the current, so adding parallel groups is the cheapest way to cut loss and sag; adding series groups raises both voltage and resistance.`,
    },
    {
      title: 'Topology effect on mass, cost and runtime',
      winner: pick(a.pack.capacityAh, b.pack.capacityAh, 'high'),
      text:
        `Estimated cell mass is ${num(a.pack.massKg, 2)} kg versus ${num(b.pack.massKg, 2)} kg and the relative cost index is ${num(a.pack.costIndex, 0)} versus ${num(b.pack.costIndex, 0)} — ` +
        `both track the cell count directly (${a.pack.cellCount} vs ${b.pack.cellCount}). At ${num(loadA, 1)} A the runtime is ${runtimeText(a.pack, loadA)} against ${runtimeText(b.pack, loadA)}. ` +
        `Set the series count from the bus voltage the load needs, then set the parallel count from the runtime and peak current the duty demands.`,
    },
  ];
}

function buildRecommendations(a: Side, b: Side, loadA: number, verdictWinner: Winner, scores: ScoreRow[]): string[] {
  const an = nameOf(a);
  const bn = nameOf(b);
  const out: string[] = [];

  if (verdictWinner !== 'tie') {
    const w = verdictWinner === 'a' ? a : b;
    const l = verdictWinner === 'a' ? b : a;
    const won = scores.filter((s) => s.winner === verdictWinner).map((s) => s.label.toLowerCase());
    const lost = scores.filter((s) => s.winner === (verdictWinner === 'a' ? 'b' : 'a')).map((s) => s.label.toLowerCase());
    out.push(
      `Overall pick on the weighted scorecard: ${nameOf(w)} at ${num(w.overall, 1)}/100 against ${num(l.overall, 1)}/100. ` +
        `It leads on ${won.length ? won.join(', ') : 'nothing outright'}${lost.length ? ` and trails on ${lost.join(', ')}` : ''}. ` +
        `Weights used: ${SCORE_DEFINITIONS.map((d) => `${d.label.toLowerCase()} ${d.weight}%`).join(', ')}.`
    );
  } else {
    out.push(
      `The weighted scorecard is a tie (${num(a.overall, 1)} vs ${num(b.overall, 1)} of 100) — decide on the use cases below rather than on the total.`
    );
  }

  out.push(`Choose ${an} for: ${a.profile.strengths.slice(0, 2).join('; ')}. Watch for: ${a.profile.watchOuts[0]}.`);
  out.push(`Choose ${bn} for: ${b.profile.strengths.slice(0, 2).join('; ')}. Watch for: ${b.profile.watchOuts[0]}.`);

  const saggy = a.pack.sagPct > b.pack.sagPct ? a : b;
  if (saggy.pack.sagPct > 5) {
    out.push(
      `${nameOf(saggy)} at this topology sags ${num(saggy.pack.sagPct, 1)}% at its rated maximum current — add parallel groups, or choose a larger cell, if the duty is surge-heavy.`
    );
  }

  const small = a.pack.capacityAh < b.pack.capacityAh ? a : b;
  if (loadA > 0.01 && runtimeHours(small.pack, loadA) < 1) {
    out.push(
      `At ${num(loadA, 1)} A the ${nameOf(small)} build only lasts ${runtimeText(small.pack, loadA)} — raise the parallel count to reach the runtime the duty needs.`
    );
  }

  const cold = a.spec.tempMin > b.spec.tempMin ? a : b;
  if (cold.spec.tempMin > -10) {
    out.push(
      `${nameOf(cold)} is the weaker cold-weather choice (rated from ${num(cold.spec.tempMin, 0)} °C) — gate charge current on cell temperature and pre-heat below that limit.`
    );
  }

  const shortLife = a.spec.cycleLife < b.spec.cycleLife ? a : b;
  if (shortLife.spec.cycleLife < 1000) {
    out.push(
      `${nameOf(shortLife)} is rated ${num(shortLife.spec.cycleLife, 0)} cycles — plan a replacement interval, or reduce depth of discharge, if the duty is daily deep cycling.`
    );
  }

  const heavy = a.pack.massKg > b.pack.massKg ? a : b;
  if (heavy.pack.massKg > 2 * Math.min(a.pack.massKg, b.pack.massKg)) {
    out.push(
      `${nameOf(heavy)} is the heavier build here (${num(heavy.pack.massKg, 2)} kg of cells) — check the enclosure, mounting and any weight-limited application before committing.`
    );
  }

  out.push(
    `Apply either side to the live pack with the Apply button and run the matching load profile: the simulator reproduces these figures tick by tick and archives the report to History.`
  );

  return out;
}
