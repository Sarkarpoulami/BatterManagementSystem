// Exports for the chemistry Compare view: CSV for spreadsheets, PDF for the report pack.
// Both follow the same vocabulary as reportGenerator.ts / csvExport.ts so a comparison
// can be filed next to a pack report.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { deliverFile, deliverText } from './fileDelivery';
import type { Comparison, ScoreRow, Winner } from './chemistryCompare';

const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [37, 99, 235];
const SLATE: [number, number, number] = [71, 85, 105];
const ACCENT_A: [number, number, number] = [8, 145, 178];
const ACCENT_B: [number, number, number] = [124, 58, 237];

/** jsPDF's built-in helvetica uses WinAnsi encoding; map the glyphs it cannot render. */
const PDF_GLYPHS: Record<string, string> = {
  '\u03a9': 'Ohm', // Ω
  '\u0394': 'Delta', // Δ
  '\u2192': '->', // →
  '\u21cc': '<->', // ⇌
  '\u207b': '-', // ⁻
  '\u2212': '-', // − (mathematical minus)
  '\u2500': '-', // ─
  '\u2026': '...', // …
};

export function pdfText(value: string): string {
  return String(value ?? '').replace(/[\u03a9\u0394\u2192\u21cc\u207b\u2212\u2500\u2026]/g, (ch) => PDF_GLYPHS[ch] ?? ch);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function sideTag(cmp: Comparison, which: 'a' | 'b'): string {
  const s = cmp[which];
  return `${s.spec.shortName.replace(/\s+/g, '')}_${s.input.seriesCount}S${s.input.parallelCount}P`;
}

/** `Li-Ion_13S1P_vs_LFP_15S1P` — used in both export filenames. */
export function comparisonSlug(cmp: Comparison): string {
  return `${sideTag(cmp, 'a')}_vs_${sideTag(cmp, 'b')}`;
}

function winnerText(w: Winner, cmp: Comparison): string {
  if (w === 'tie') return 'tie';
  return cmp[w].spec.shortName;
}

function esc(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(lines: string[][]): string {
  return `${'\uFEFF'}${lines.map((line) => line.map(esc).join(',')).join('\r\n')}`;
}

function scoreLine(row: ScoreRow): string[] {
  return [
    row.label,
    String(Math.round(row.weight)),
    row.aText,
    row.aScore.toFixed(1),
    row.bText,
    row.bScore.toFixed(1),
    row.winner === 'tie' ? 'tie' : row.winner === 'a' ? 'A' : 'B',
  ];
}

export function buildComparisonCsv(cmp: Comparison): string {
  const a = cmp.a;
  const b = cmp.b;
  const categories: string[] = [];
  for (const row of cmp.rows) if (!categories.includes(row.category)) categories.push(row.category);

  const lines: string[][] = [
    ['BMS Chemistry Comparison'],
    ['Generated (UTC)', new Date().toISOString()],
    ['Working load (A)', cmp.loadA.toFixed(2)],
    ['Side A', `${a.spec.name} · ${a.input.seriesCount}S${a.input.parallelCount}P · ${a.pack.cellCount} cells`],
    ['Side B', `${b.spec.name} · ${b.input.seriesCount}S${b.input.parallelCount}P · ${b.pack.cellCount} cells`],
    [],
    ['VERDICT'],
    [cmp.verdict],
    [],
    ['WEIGHTED SCORECARD'],
    ['metric', 'weight_percent', 'A_value', 'A_score', 'B_value', 'B_score', 'leads'],
    ...cmp.scores.map(scoreLine),
    ['Overall weighted score', '100', a.overall.toFixed(1), '', b.overall.toFixed(1), '', winnerText(cmp.verdictWinner, cmp)],
    [],
    ['SPECIFICATION TABLE'],
    ['category', 'parameter', 'A', 'B', 'leads', 'note'],
    ...cmp.rows.map((r) => [r.category, r.label, r.a, r.b, r.winner === 'tie' ? 'tie' : r.winner === 'a' ? 'A' : 'B', r.note ?? '']),
    [],
    ['DESCRIPTIVE ANALYSIS'],
    ['section', 'leads', 'analysis'],
    ...cmp.dimensions.map((d) => [d.title, d.winner === 'tie' ? 'tie' : d.winner === 'a' ? 'A' : 'B', d.text]),
    [],
    ['USE CASES'],
    ['use case', 'pick', 'why'],
    ...cmp.useCases.map((u) => [u.use, u.pick === 'tie' ? 'tie' : u.pick === 'a' ? 'A' : 'B', u.why]),
    [],
    ['RECOMMENDATIONS'],
    ['#', 'recommendation'],
    ...cmp.recommendations.map((r, i) => [String(i + 1), r]),
    [],
    ['LOAD PROFILE FIT'],
    ['recommended for both', cmp.sharedProfiles.join('; ')],
    ['A only', cmp.onlyAProfiles.join('; ')],
    ['B only', cmp.onlyBProfiles.join('; ')],
    [],
    ['CHEMISTRY PROFILES'],
    ['side', 'chemistry', 'summary', 'strengths', 'watch out for'],
    ['A', a.spec.name, a.profile.blurb, a.profile.strengths.join(' | '), a.profile.watchOuts.join(' | ')],
    ['B', b.spec.name, b.profile.blurb, b.profile.strengths.join(' | '), b.profile.watchOuts.join(' | ')],
    [],
    ['CATEGORY ORDER'],
    ...categories.map((c) => [c]),
  ];

  return toCsv(lines);
}

export function downloadComparisonCsv(cmp: Comparison): string {
  const filename = `BMS_Compare_${comparisonSlug(cmp)}_${stamp()}.csv`;
  deliverText(buildComparisonCsv(cmp), filename, 'text/csv');
  return filename;
}

function addPageChrome(doc: jsPDF, title: string, subtitle: string, page: number, total: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 18, 'F');
  doc.setFillColor(...BLUE);
  doc.rect(0, 18, w, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('e-BMS  |  CHEMISTRY COMPARISON REPORT', 14, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(title, 14, 14);
  doc.text(`Page ${page} / ${total}`, w - 14, 8, { align: 'right' });
  doc.text(subtitle, w - 14, 14, { align: 'right', maxWidth: 120 });
  doc.setFillColor(...NAVY);
  doc.rect(0, h - 10, w, 10, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text('Diagnostic use only  |  e-BMS Electrical Battery Management System', 14, h - 4);
  doc.text(new Date().toLocaleString(), w - 14, h - 4, { align: 'right' });
}

function finalizePages(doc: jsPDF, title: string, subtitle: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    addPageChrome(doc, title, subtitle, i, total);
  }
}

function lastY(doc: jsPDF, fallback: number, gap = 6): number {
  const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return (y ?? fallback) + gap;
}

function heading(doc: jsPDF, y: number, text: string, color: [number, number, number] = NAVY): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.text(pdfText(text), 14, y);
  return y + 4;
}

function paragraph(doc: jsPDF, y: number, text: string, size = 8, color: [number, number, number] = SLATE, width = 182): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(pdfText(text), width) as string[];
  doc.text(lines, 14, y);
  return y + lines.length * (size * 0.46) + 2;
}

function scoreBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  name: string,
  topology: string,
  score: number,
  accent: [number, number, number]
) {
  const h = 22;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
  doc.setFillColor(...accent);
  doc.rect(x, y, 1.6, h, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(pdfText(label.toUpperCase()), x + 4, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(pdfText(`${name}  ·  ${topology}`), x + 4, y + 11.5);
  doc.setFontSize(9);
  doc.setTextColor(...accent);
  doc.text(`Weighted score ${score.toFixed(1)} / 100`, x + 4, y + 17.5);
}

export function downloadComparisonPdf(cmp: Comparison): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const a = cmp.a;
  const b = cmp.b;
  const title = `Comparison — ${a.spec.shortName} ${a.input.seriesCount}S${a.input.parallelCount}P vs ${b.spec.shortName} ${b.input.seriesCount}S${b.input.parallelCount}P`;
  const subtitle = `Working load ${cmp.loadA.toFixed(1)} A`;

  let y = 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('CELL CHEMISTRY COMPARISON', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(`Generated ${new Date().toLocaleString()}  ·  A: ${pdfText(a.spec.name)}  ·  B: ${pdfText(b.spec.name)}`, 14, y);
  y += 6;

  const boxW = (w - 28 - 4) / 2;
  scoreBox(doc, 14, y, boxW, 'Side A', a.spec.shortName, `${a.input.seriesCount}S${a.input.parallelCount}P`, a.overall, ACCENT_A);
  scoreBox(doc, 14 + boxW + 4, y, boxW, 'Side B', b.spec.shortName, `${b.input.seriesCount}S${b.input.parallelCount}P`, b.overall, ACCENT_B);
  y += 28;

  y = heading(doc, y, 'Verdict');
  y = paragraph(doc, y, cmp.verdict, 8.5, NAVY);
  y += 2;

  y = heading(doc, y, 'Weighted scorecard');
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.4, textColor: NAVY, lineColor: [226, 232, 240] },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
    // explicit widths must sum to the printable width (210 - 2 x 14 = 182 mm) or
    // autoTable warns that the content does not fill the page
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 44 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 40 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 40 },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
    },
    head: [['METRIC', 'WT %', `A · ${a.spec.shortName}`, 'SCORE', `B · ${b.spec.shortName}`, 'SCORE', 'LEADS']],
    body: cmp.scores.map((r) => [
      r.label,
      String(Math.round(r.weight)),
      r.aText,
      r.aScore.toFixed(1),
      r.bText,
      r.bScore.toFixed(1),
      r.winner === 'tie' ? 'tie' : r.winner === 'a' ? 'A' : 'B',
    ]),
    foot: [[
      { content: 'Overall weighted score', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: a.overall.toFixed(1), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: `${b.spec.shortName} overall`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: b.overall.toFixed(1), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: winnerText(cmp.verdictWinner, cmp), styles: { fontStyle: 'bold', halign: 'center' } },
    ]],
    margin: { left: 14, right: 14, top: 22, bottom: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const v = String(data.cell.raw);
        if (v === 'A') data.cell.styles.textColor = ACCENT_A;
        else if (v === 'B') data.cell.styles.textColor = ACCENT_B;
        else data.cell.styles.textColor = SLATE;
      }
    },
  });
  y = lastY(doc, y);

  const categories: string[] = [];
  for (const row of cmp.rows) if (!categories.includes(row.category)) categories.push(row.category);

  for (const category of categories) {
    const rows = cmp.rows.filter((r) => r.category === category);
    if (y > 250) {
      doc.addPage();
      y = 26;
    }
    y = heading(doc, y, category);
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.4, textColor: NAVY, lineColor: [226, 232, 240] },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 46 },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 },
        3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      },
      head: [['PARAMETER', `A · ${a.spec.shortName}`, `B · ${b.spec.shortName}`, 'LEADS']],
      body: rows.map((r) => [r.label, r.a, r.b, r.winner === 'tie' ? 'tie' : r.winner === 'a' ? 'A' : 'B']),
      foot: rows.some((r) => r.note)
        ? [[{ content: rows.filter((r) => r.note).map((r) => `${r.label}: ${r.note}`).join('  ·  '), colSpan: 4, styles: { fontSize: 6.5, textColor: SLATE, fillColor: [248, 250, 252] } }]]
        : undefined,
      margin: { left: 14, right: 14, top: 22, bottom: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const v = String(data.cell.raw);
          if (v === 'A') data.cell.styles.textColor = ACCENT_A;
          else if (v === 'B') data.cell.styles.textColor = ACCENT_B;
          else data.cell.styles.textColor = SLATE;
        }
      },
    });
    y = lastY(doc, y, 7);
  }

  doc.addPage();
  y = 26;
  y = heading(doc, y, 'Descriptive analysis');
  for (const dim of cmp.dimensions) {
    if (y > 245) {
      doc.addPage();
      y = 26;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(pdfText(dim.title), 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...(dim.winner === 'tie' ? SLATE : dim.winner === 'a' ? ACCENT_A : ACCENT_B));
    doc.text(dim.winner === 'tie' ? 'level' : `leads: ${dim.winner.toUpperCase()}`, w - 14, y, { align: 'right' });
    y += 4;
    y = paragraph(doc, y, dim.text, 8, SLATE) + 2;
  }

  if (y > 230) {
    doc.addPage();
    y = 26;
  }
  y = heading(doc, y, 'Use-case picks');
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.4, textColor: NAVY, lineColor: [226, 232, 240] },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 }, 1: { cellWidth: 12, halign: 'center' } },
    head: [['IF YOU NEED', 'PICK', 'WHY']],
    body: cmp.useCases.map((u) => [u.use, u.pick === 'tie' ? 'tie' : u.pick === 'a' ? 'A' : 'B', u.why]),
    margin: { left: 14, right: 14, top: 22, bottom: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const v = String(data.cell.raw);
        if (v === 'A') data.cell.styles.textColor = ACCENT_A;
        else if (v === 'B') data.cell.styles.textColor = ACCENT_B;
        else data.cell.styles.textColor = SLATE;
      }
    },
  });
  y = lastY(doc, y, 7);

  y = heading(doc, y, 'Recommendations');
  cmp.recommendations.forEach((rec, i) => {
    if (y > 268) {
      doc.addPage();
      y = 26;
    }
    y = paragraph(doc, y, `${i + 1}. ${rec}`, 8, SLATE);
  });
  y += 2;

  y = heading(doc, y, 'Load-profile fit');
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.4, textColor: NAVY, lineColor: [226, 232, 240] },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 34 } },
    head: [['SIDE', 'SIMULATOR PROFILES THAT RECOMMEND IT']],
    body: [
      ['Both', cmp.sharedProfiles.join('; ') || 'none'],
      ['A only', cmp.onlyAProfiles.join('; ') || 'none'],
      ['B only', cmp.onlyBProfiles.join('; ') || 'none'],
    ],
    margin: { left: 14, right: 14, top: 22, bottom: 14 },
  });
  y = lastY(doc, y, 7);

  y = heading(doc, y, 'Chemistry profiles');
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.4, textColor: NAVY, lineColor: [226, 232, 240] },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 26 } },
    head: [['SIDE', 'SUMMARY', 'STRENGTHS', 'WATCH OUT FOR']],
    body: [
      ['A', pdfText(a.profile.blurb), pdfText(a.profile.strengths.join(' | ')), pdfText(a.profile.watchOuts.join(' | '))],
      ['B', pdfText(b.profile.blurb), pdfText(b.profile.strengths.join(' | ')), pdfText(b.profile.watchOuts.join(' | '))],
    ],
    margin: { left: 14, right: 14, top: 22, bottom: 14 },
  });

  finalizePages(doc, title, subtitle);

  const filename = `BMS_Compare_${comparisonSlug(cmp)}_${stamp()}.pdf`;
  deliverFile(doc.output('blob'), filename);
  return filename;
}

/** Colour token used by the UI for the "leads" chips, kept here so exports and screen agree. */
export const WINNER_ACCENT: Record<Winner, string> = {
  a: 'text-cyan-300',
  b: 'text-violet-300',
  tie: 'text-slate-400',
};
