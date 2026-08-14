import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

const NAVY  = '#07172A';
const TEAL  = '#009BA7';
const GREEN = '#16A34A';
const GRAY  = '#374151';
const LIGHT = '#F5F7F9';

function fmtM(n: number | null | undefined): string {
  if (!n || !isFinite(n)) return '—';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n).toLocaleString();
  return '$' + n.toFixed(0);
}

function fmtPct(n: number | null | undefined, d = 1): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toFixed(d) + '%';
}

function extractBestYoc(yocText: string | null): number {
  if (!yocText) return 0;
  const labeled = yocText.match(/YOC\s*[-:]?\s*(\d+\.?\d*)\s*%/i);
  if (labeled) return parseFloat(labeled[1]);
  const plain = yocText.match(/(\d+\.?\d*)\s*%/);
  return plain ? parseFloat(plain[1]) : 0;
}

function formatProductType(slug: string): string {
  if (!slug) return '';
  if (slug === 'btr-3-story-th' || slug === 'btr-townhome') return 'BTR TH';
  if (slug === 'btr-sfr-detached' || slug === 'btr-sfr') return 'BTR SF';
  return slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Accepts Drizzle camelCase deal row (from db.select().from(deals))
export async function generateMemoBuffer(deal: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const buffers: Buffer[] = [];
    const pass = new PassThrough();
    doc.pipe(pass);
    pass.on('data', (chunk: Buffer) => buffers.push(chunk));
    pass.on('end', () => resolve(Buffer.concat(buffers)));
    pass.on('error', reject);

    const W = 595.28;
    const H = 841.89;
    const M = 40;
    const contentW = W - M * 2;

    // ── Cover header ────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 160).fill(NAVY);
    doc.rect(0, 150, W, 10).fill(TEAL);

    const propName = deal.propertyName || deal.address || 'Property';
    const loc = [deal.city, deal.state, deal.zip].filter(Boolean).join(', ');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text(propName, M, 40, { width: contentW });
    doc.font('Helvetica').fontSize(11).fillColor('#A5C4D4').text(loc, M, doc.y + 4);
    doc.font('Helvetica').fontSize(9).fillColor('#6B9AB8').text('INVESTMENT OPPORTUNITY MEMORANDUM', M, 130);

    // ── Key metrics strip ────────────────────────────────────────────────────
    const yoc     = extractBestYoc(deal.yieldOnCost);
    const rentPSF = parseFloat(deal.topRentPsf || deal.projectedRentPerSf || '0') || null;
    const acres   = parseFloat(deal.sizeAcres || '0') || null;
    const units   = parseInt(String(deal.unitCount || deal.maxUnitsByZoning || '0')) || null;
    const askingP = parseFloat(deal.askingPrice || '0') || null;

    const metrics = [
      { label: 'YIELD ON COST', value: yoc ? fmtPct(yoc)           : '—', color: GREEN },
      { label: 'MARKET RENT',   value: rentPSF ? `$${rentPSF.toFixed(2)}/sf` : '—', color: TEAL },
      { label: 'ACREAGE',       value: acres ? `${acres.toFixed(2)} ac`  : '—', color: NAVY },
      { label: 'UNITS',         value: units ? units.toLocaleString()     : '—', color: NAVY },
      { label: 'ASKING PRICE',  value: askingP ? fmtM(askingP)           : '—', color: NAVY },
    ];

    const cardW = contentW / metrics.length;
    const cardY = 168;
    metrics.forEach((m, i) => {
      const x = M + i * cardW;
      const isHighlight = i < 2;
      doc.rect(x, cardY, cardW - 4, 64).fill(isHighlight ? '#F0FDF4' : LIGHT);
      doc.font('Helvetica').fontSize(7).fillColor(isHighlight ? m.color : '#6B7280')
         .text(m.label, x + 8, cardY + 10, { width: cardW - 16 });
      doc.font('Helvetica-Bold').fontSize(16).fillColor(isHighlight ? m.color : NAVY)
         .text(m.value, x + 8, cardY + 22, { width: cardW - 16 });
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    let cursor = cardY + 76;

    function section(title: string) {
      cursor += 16;
      doc.rect(M, cursor, contentW, 22).fill(LIGHT);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEAL).text(title, M + 8, cursor + 7);
      cursor += 28;
    }

    function row(label: string, value: string, alt = false) {
      const rowH = 20;
      if (alt) doc.rect(M, cursor, contentW, rowH).fill('#F9FAFB');
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(label, M + 8, cursor + 6, { width: contentW * 0.48 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY)
         .text(value, M + contentW * 0.5, cursor + 6, { width: contentW * 0.48, align: 'right' });
      doc.moveTo(M, cursor + rowH).lineTo(M + contentW, cursor + rowH).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      cursor += rowH;
    }

    function twoCol(pairs: [string, string][]) {
      const colW = (contentW - 16) / 2;
      const left  = pairs.filter((_, i) => i % 2 === 0);
      const right = pairs.filter((_, i) => i % 2 === 1);
      const startY = cursor;
      let ly = startY, ry = startY;

      const drawCol = (arr: [string, string][], x: number, y: number) => {
        arr.forEach((p, i) => {
          if (i % 2 === 0) doc.rect(x, y, colW, 20).fill('#F9FAFB');
          doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(p[0], x + 6, y + 6, { width: colW * 0.55 });
          doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY)
             .text(p[1], x + colW * 0.57, y + 6, { width: colW * 0.4, align: 'right' });
          doc.moveTo(x, y + 20).lineTo(x + colW, y + 20).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
          y += 20;
        });
        return y;
      };

      ly = drawCol(left,  M, startY);
      ry = drawCol(right, M + colW + 16, startY);
      cursor = Math.max(ly, ry);
    }

    // ── Location ─────────────────────────────────────────────────────────────
    section('LOCATION');
    [
      ['Address',          deal.address || '—'],
      ['City / State / ZIP', [deal.city, deal.state, deal.zip].filter(Boolean).join(', ') || '—'],
      ['County',           deal.county || '—'],
      ['MSA',              deal.msaName || '—'],
      ...(deal.ozStatus  ? [['Opportunity Zone', deal.ozStatus]]  : []),
      ...(deal.qctStatus ? [['QCT Status', deal.qctStatus]]        : []),
    ].forEach(([l, v], i) => row(l, v, i % 2 === 0));

    // ── Deal Summary ─────────────────────────────────────────────────────────
    section('DEAL SUMMARY');
    const prodTypes = Array.isArray(deal.productTypes) ? deal.productTypes.map(formatProductType).join(', ') : '—';
    twoCol([
      ['Product Type',     prodTypes],
      ['Classification',   deal.classification || deal.dealType || '—'],
      ['Acreage',          acres ? `${acres.toFixed(2)} acres` : '—'],
      ['Estimated Units',  units ? units.toLocaleString() : '—'],
      ['Asking Price',     askingP ? fmtM(askingP) : 'Not Disclosed'],
      ['Entitlements',     deal.hasEntitlements ? 'Yes' : 'No'],
      ...(deal.zoning ? [['Zoning', deal.zoning]] as [string,string][] : []),
    ]);

    // ── Financial Summary ─────────────────────────────────────────────────────
    section('FINANCIAL SUMMARY');
    const noi  = parseFloat(deal.projectedNoi  || '0') || null;
    const tdc  = parseFloat(deal.totalProjectCost || '0') || null;
    const gpr  = parseFloat(deal.projectedGpr  || '0') || null;
    const egi  = parseFloat(deal.projectedEgi  || '0') || null;
    const opex = parseFloat(deal.projectedOpex || '0') || null;

    const finPairs: [string, string][] = [];
    if (gpr)     finPairs.push(['Gross Potential Rent',   fmtM(gpr)]);
    if (egi)     finPairs.push(['Effective Gross Income',  fmtM(egi)]);
    if (opex)    finPairs.push(['Operating Expenses',      fmtM(opex)]);
    if (noi)     finPairs.push(['Net Operating Income',    fmtM(noi)]);
    if (tdc)     finPairs.push(['Total Development Cost',  fmtM(tdc)]);
    if (yoc)     finPairs.push(['Yield on Cost',           fmtPct(yoc)]);
    if (rentPSF) finPairs.push(['Market Rent (top comps)', `$${rentPSF.toFixed(2)}/sf`]);
    if (askingP && acres) finPairs.push(['Land Cost / Acre', fmtM(askingP / acres)]);

    if (finPairs.length >= 2) {
      twoCol(finPairs);
    } else {
      row('Yield on Cost', yoc ? fmtPct(yoc) : '—');
      row('Market Rent',   rentPSF ? `$${rentPSF.toFixed(2)}/sf` : '—', true);
    }

    // ── Analyst Notes ────────────────────────────────────────────────────────
    const notes = deal.analystNotes || deal.brokerNotes || deal.aiExplanatoryNotes;
    if (notes && String(notes).trim()) {
      section('NOTES');
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
         .text(String(notes).trim(), M + 8, cursor, { width: contentW - 16, lineGap: 2 });
      cursor = doc.y + 8;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, H - 40, W, 40).fill(NAVY);
    doc.font('Helvetica').fontSize(8).fillColor('#A5C4D4')
       .text('Catalyst Capital Partners  |  Confidential Investment Memorandum', M, H - 26, { width: contentW, align: 'center' });

    doc.end();
  });
}
