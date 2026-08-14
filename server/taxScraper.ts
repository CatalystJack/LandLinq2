/**
 * Mecklenburg County Tax Bill Scraper
 * Scrapes 2024 property tax data for parcel IDs from an uploaded Excel file.
 *
 * Two data sources:
 *  1. Assessed Value  → Polaris3G REST API (fast JSON endpoint)
 *  2. Millage, Direct Assessments, Interest, Total Tax Bill
 *     → Direct HTTP fetch + HTML parsing (no Playwright / no headless browser)
 */

import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

// ── Column indices (0-based) ───────────────────────────────────────────────
const COL = {
  PARCEL:   15,  // P
  ASSESSED: 9,   // J
  MILLAGE:  10,  // K
  DIRECT:   11,  // L
  INTEREST: 12,  // M
  TOTAL:    13,  // N
};
const FIRST_DATA_ROW = 2;   // 0-based index → row 3 in Excel
const LAST_DATA_ROW  = 226; // 0-based index → row 227 in Excel
const CONCURRENCY    = 10;  // fetch is lightweight; run 10 in parallel

const TAX_BASE = 'https://taxbill.co.mecklenburg.nc.us/publicwebaccess';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Job store ──────────────────────────────────────────────────────────────
export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface ParcelResult {
  rowIndex: number;
  parcelId: string;
  assessedValue: number | null;
  millageRate: number | null;
  directAssessments: number | null;
  interest: number | null;
  totalTaxBill: number | null;
  error?: string;
  skipped?: boolean;
}

export interface ScrapeJob {
  id: string;
  status: JobStatus;
  total: number;
  completed: number;
  results: ParcelResult[];
  xlsxBuffer: Buffer | null;
  errorMessage?: string;
  startedAt: Date;
  originalFileName: string;
  taxYear: number;
  msaName: string;
}

const jobs = new Map<string, ScrapeJob>();

export function getJob(id: string): ScrapeJob | undefined {
  return jobs.get(id);
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status === 'done' || job.status === 'error') return false;
  job.status = 'cancelled';
  return true;
}

// ── Semaphore for concurrency control ─────────────────────────────────────
class Semaphore {
  private count: number;
  private queue: (() => void)[] = [];

  constructor(count: number) {
    this.count = count;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.count++;
    }
  }
}

// ── Cookie jar helper ──────────────────────────────────────────────────────
function extractCookies(response: Response): string {
  try {
    // Node 18+ getSetCookie() returns string[]
    const setCookies: string[] = (response.headers as any).getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      return setCookies.map((c: string) => c.split(';')[0].trim()).join('; ');
    }
    // Fallback: single Set-Cookie header
    const single = response.headers.get('set-cookie') ?? '';
    if (single) return single.split(';')[0].trim();
  } catch {}
  return '';
}

// ── API: Assessed Value ────────────────────────────────────────────────────
async function fetchAssessedValue(parcelId: string): Promise<number | null> {
  try {
    const url = `https://polaris3g.mecklenburgcountync.gov/api/bolt?pid=${parcelId}&page=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.market_value ?? data?.marketValue ?? data?.assessed_value ?? null;
    if (raw === null || raw === undefined) return null;
    const num = typeof raw === 'string' ? parseFloat(raw.replace(/[^0-9.]/g, '')) : Number(raw);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

// ── HTML text-node extractor (replicates browser TreeWalker) ──────────────
function extractTextNodes(html: string): string[] {
  const nodes: string[] = [];
  // Strip scripts and styles entirely
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');

  const pattern = /<[^>]+>|(&[a-zA-Z#0-9]+;)|([^<&]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(clean)) !== null) {
    if (m[2]) {
      const text = m[2].trim();
      if (text) nodes.push(text);
    } else if (m[1]) {
      const entity = m[1];
      const decoded = entity
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .trim();
      if (decoded) nodes.push(decoded);
    }
  }
  return nodes;
}

// ── Parse HTML bill detail page into TaxBillData ──────────────────────────
interface TaxBillData {
  assessedValue: number | null;
  millageRate: number | null;
  directAssessments: number | null;
  interest: number | null;
  totalTaxBill: number | null;
}

function parseHtmlToTaxBill(html: string): TaxBillData | null {
  const textNodes = extractTextNodes(html);
  if (textNodes.length === 0) return null;

  function parseNum(s: string): number | null {
    const cleaned = s.replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  function getTextAfterLabel(labels: string[]): string | null {
    for (let i = 0; i < textNodes.length; i++) {
      const t = textNodes[i].toLowerCase();
      for (const label of labels) {
        if (t.includes(label.toLowerCase())) {
          for (let j = i + 1; j < Math.min(i + 5, textNodes.length); j++) {
            const candidate = textNodes[j].trim();
            if (candidate && /[\d$,.]/.test(candidate)) return candidate;
          }
        }
      }
    }
    return null;
  }

  // Assessed Value
  const assessedRaw = getTextAfterLabel(['Total Assessed Value', 'Assessed Value']);
  const assessedValue = assessedRaw ? parseNum(assessedRaw) : null;

  // Millage Rate: decimal numbers like 0.3581; Direct Assessments: flat dollar amounts
  const ratePattern = /^0\.\d{4}$/;
  const directPattern = /direct|special assessment|stormwater|recycling|solid waste|fire/i;

  let millageSum = 0;
  let directSum = 0;

  for (let i = 0; i < textNodes.length; i++) {
    const t = textNodes[i].trim();
    if (ratePattern.test(t)) {
      millageSum += parseFloat(t);
    }
    if (directPattern.test(t)) {
      for (let j = i + 1; j < Math.min(i + 4, textNodes.length); j++) {
        const candidate = textNodes[j].replace(/[$,\s]/g, '');
        const n = parseFloat(candidate);
        if (!isNaN(n) && n > 0 && n < 100_000 && candidate.includes('.')) {
          directSum += n;
          break;
        }
      }
    }
  }

  // Fallback millage scan using inRateSection heuristic
  if (millageSum === 0) {
    let inRateSection = false;
    let fallbackMillage = 0;
    for (let i = 0; i < textNodes.length; i++) {
      const t = textNodes[i].toLowerCase();
      if (t.includes('rate') && (t.includes('tax') || t.includes('county') || t.includes('city') || t.includes('fire') || t.includes('school') || t.includes('municipal'))) {
        inRateSection = true;
      }
      if (t.includes('total billed') || t.includes('interest') || t.includes('penalties')) {
        inRateSection = false;
      }
      if (inRateSection || t.includes('levy') || t.includes('district')) {
        const num = parseFloat(textNodes[i].replace(/[$,\s]/g, ''));
        if (!isNaN(num) && num < 2 && num > 0) {
          fallbackMillage += num;
        }
      }
    }
    if (fallbackMillage > 0) millageSum = fallbackMillage;
  }

  // Interest
  const interestRaw = getTextAfterLabel(['Interest:', 'Interest Due', 'Penalty & Interest', 'Penalties & Interest']);
  const interest = interestRaw ? parseNum(interestRaw) : 0;

  // Total
  const totalRaw = getTextAfterLabel(['Total Billed:', 'Total Bill', 'Total Tax Bill', 'Amount Due', 'Total Due', 'Total:']);
  const totalTaxBill = totalRaw ? parseNum(totalRaw) : null;

  return {
    assessedValue: assessedValue || null,
    millageRate: millageSum > 0 ? millageSum : null,
    directAssessments: directSum > 0 ? directSum : 0,
    interest: interest !== null ? interest : 0,
    totalTaxBill,
  };
}

// ── Fetch tax bill via HTTP (no browser) ──────────────────────────────────
async function scrapeTaxBillFetch(parcelId: string, taxYear: number): Promise<TaxBillData | null> {
  const listUrl = `${TAX_BASE}/BillSearchResults.aspx?ParcelNum=${parcelId}`;

  // Step 1: Fetch the search results page
  let r1: Response;
  try {
    r1 = await fetch(listUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    });
  } catch {
    return null;
  }
  if (!r1.ok) return null;

  const cookieJar = extractCookies(r1);
  const html1 = await r1.text();

  // Step 2: Find the bill link for the requested year
  const yearStr = String(taxYear);
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let billHref: string | null = null;
  let isPostBack = false;

  while ((m = anchorRegex.exec(html1)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text.includes(`-${yearStr}-`) || (text.includes(yearStr) && text.length < 30)) {
      billHref = href;
      break;
    }
  }

  // Second try: javascript:__doPostBack links
  if (!billHref) {
    const pbRegex = /<a\s+[^>]*href=["']javascript:__doPostBack\('([^']+)','([^']*)'\)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = pbRegex.exec(html1)) !== null) {
      const text = m[3].replace(/<[^>]+>/g, '').trim();
      if (text.includes(`-${yearStr}-`) || (text.includes(yearStr) && text.length < 30)) {
        isPostBack = true;
        billHref = `${m[1]}|${m[2]}`; // encode eventTarget|eventArgument
        break;
      }
    }
  }

  if (!billHref) return null;

  // Step 3: Navigate to bill detail
  let detailHtml: string;

  if (isPostBack) {
    // ASP.NET postback: POST back to the same URL with ViewState
    const [eventTarget, eventArgument] = billHref.split('|');
    const vsMatch  = html1.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
    const evMatch  = html1.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);
    const vsgMatch = html1.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

    const body = new URLSearchParams({
      __EVENTTARGET:        eventTarget ?? '',
      __EVENTARGUMENT:      eventArgument ?? '',
      __VIEWSTATE:          vsMatch?.[1] ?? '',
      __EVENTVALIDATION:    evMatch?.[1] ?? '',
      __VIEWSTATEGENERATOR: vsgMatch?.[1] ?? '',
    });

    let r2: Response;
    try {
      r2 = await fetch(listUrl, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Cookie': cookieJar,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': listUrl,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(20_000),
        redirect: 'follow',
      });
    } catch {
      return null;
    }
    if (!r2.ok) return null;
    detailHtml = await r2.text();
  } else {
    // Regular link
    let detailUrl = billHref;
    if (!detailUrl.startsWith('http')) {
      detailUrl = detailUrl.startsWith('/')
        ? `https://taxbill.co.mecklenburg.nc.us${detailUrl}`
        : `${TAX_BASE}/${detailUrl}`;
    }

    let r2: Response;
    try {
      r2 = await fetch(detailUrl, {
        headers: { 'User-Agent': UA, 'Cookie': cookieJar, 'Referer': listUrl },
        signal: AbortSignal.timeout(20_000),
        redirect: 'follow',
      });
    } catch {
      return null;
    }
    if (!r2.ok) return null;
    detailHtml = await r2.text();
  }

  return parseHtmlToTaxBill(detailHtml);
}

// ── Main job runner ────────────────────────────────────────────────────────
export async function startScrapeJob(fileBuffer: Buffer, fileName: string, taxYear = 2024, msaName = ''): Promise<string> {
  const jobId = randomUUID();

  // Parse parcel IDs — use sheetRows + direct cell access for instant parsing
  const wb = XLSX.read(fileBuffer, { type: 'buffer', sheetRows: LAST_DATA_ROW + 1 });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const parcels: Array<{ rowIndex: number; parcelId: string }> = [];
  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: COL.PARCEL })];
    if (!cell || cell.v == null) continue;
    const parcelId = String(cell.v).trim().replace(/\.0$/, '').padStart(8, '0');
    if (parcelId && parcelId !== '00000000') {
      parcels.push({ rowIndex: r, parcelId });
    }
  }

  const job: ScrapeJob = {
    id: jobId,
    status: 'pending',
    total: parcels.length,
    completed: 0,
    results: [],
    xlsxBuffer: null,
    startedAt: new Date(),
    originalFileName: fileName,
    taxYear,
    msaName,
  };
  jobs.set(jobId, job);

  runJobInBackground(job, fileBuffer, parcels).catch((err) => {
    job.status = 'error';
    job.errorMessage = err.message;
  });

  return jobId;
}

async function runJobInBackground(
  job: ScrapeJob,
  originalBuffer: Buffer,
  parcels: Array<{ rowIndex: number; parcelId: string }>
): Promise<void> {
  job.status = 'running';

  const semaphore = new Semaphore(CONCURRENCY);

  const tasks = parcels.map(({ rowIndex, parcelId }) =>
    (async () => {
      await semaphore.acquire();
      try {
        if (job.status === 'cancelled') {
          job.results.push({ rowIndex, parcelId, assessedValue: null, millageRate: null, directAssessments: null, interest: null, totalTaxBill: null, skipped: true });
          return;
        }

        let assessedValue: number | null = null;
        let millageRate: number | null = null;
        let directAssessments: number | null = null;
        let interest: number | null = null;
        let totalTaxBill: number | null = null;
        let error: string | undefined;

        try {
          // Source 1: Assessed Value from Polaris3G API
          assessedValue = await fetchAssessedValue(parcelId);

          // Source 2: Tax bill via HTTP fetch (no Playwright)
          const bill = await scrapeTaxBillFetch(parcelId, job.taxYear);
          if (bill) {
            if (!assessedValue && bill.assessedValue) assessedValue = bill.assessedValue;
            millageRate       = bill.millageRate;
            directAssessments = bill.directAssessments;
            interest          = bill.interest;
            totalTaxBill      = bill.totalTaxBill;
          } else {
            error = `No ${job.taxYear} tax bill found`;
          }
        } catch (e: any) {
          error = e.message;
        }

        job.results.push({ rowIndex, parcelId, assessedValue, millageRate, directAssessments, interest, totalTaxBill, error });
        job.completed++;
      } finally {
        semaphore.release();
      }
    })()
  );

  await Promise.all(tasks);

  if (job.status === 'cancelled') return;

  job.xlsxBuffer = buildResultXlsx(originalBuffer, job.results);
  job.status = 'done';
}

function buildResultXlsx(originalBuffer: Buffer, results: ParcelResult[]): Buffer {
  const wb = XLSX.read(originalBuffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  for (const r of results) {
    if (r.skipped) continue;

    function writeCell(col: number, value: number | null) {
      if (value === null) return;
      const addr = XLSX.utils.encode_cell({ r: r.rowIndex, c: col });
      ws[addr] = { t: 'n', v: value };
    }

    writeCell(COL.ASSESSED, r.assessedValue);
    writeCell(COL.MILLAGE,  r.millageRate);
    writeCell(COL.DIRECT,   r.directAssessments);
    writeCell(COL.INTEREST, r.interest);
    writeCell(COL.TOTAL,    r.totalTaxBill);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
