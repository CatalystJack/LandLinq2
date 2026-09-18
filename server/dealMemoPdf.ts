import { createRequire } from "module";
import fs from "fs";
import { chromium } from "playwright-core";
import {
  ObjectStorageService,
  objectStorageClient,
  parseObjectPath,
} from "./objectStorage";

type DealMemoBranding = {
  companyName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  whiteLabeled: boolean;
};

type DealMemoInput = Record<string, unknown>;

const require = createRequire(import.meta.url);
const FONT_WEIGHTS = [400, 500, 600, 700] as const;
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;

function loadNewsreaderFonts(): string {
  return FONT_WEIGHTS.map((weight) => {
    const fontPath = require.resolve(`@fontsource/newsreader/files/newsreader-latin-${weight}-normal.woff2`);
    const base64 = fs.readFileSync(fontPath).toString("base64");
    return `@font-face{font-family:"Newsreader";font-style:normal;font-display:block;font-weight:${weight};src:url(data:font/woff2;base64,${base64}) format("woff2");}`;
  }).join("");
}

const newsreaderFontFaces = loadNewsreaderFonts();

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text && text !== "null" && text !== "undefined" ? text : null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown): string {
  const parsed = numberValue(value);
  if (parsed === null) return "—";
  if (Math.abs(parsed) >= 1_000_000) {
    return `$${(parsed / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  return `$${parsed.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: unknown): string {
  const text = textValue(value);
  if (!text) return "—";
  const bestYoc = text.match(/BEST:\s*~?(\d+(?:\.\d+)?)\s*%/i);
  if (bestYoc) return `${bestYoc[1]}%`;
  const percent = text.match(/-?\d+(?:\.\d+)?\s*%/);
  if (percent) return percent[0].replace(/\s+/g, "");
  const parsed = numberValue(text);
  if (parsed === null) return "—";
  return `${parsed.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function formatAddress(deal: DealMemoInput): string {
  const street = textValue(deal.address) || "Property address unavailable";
  const normalizedStreet = street.toLowerCase();
  const city = textValue(deal.city);
  const state = textValue(deal.state);
  const zip = textValue(deal.zip);
  const parts = [street];

  if (city && !normalizedStreet.includes(city.toLowerCase())) parts.push(city);
  const stateZip = [state, zip].filter(Boolean).join(" ");
  if (stateZip && !normalizedStreet.includes(stateZip.toLowerCase())) parts.push(stateZip);
  return parts.join(", ");
}

function safeColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeEmbeddedLogo(value: string | null | undefined): string | null {
  if (!value || value.length > 2_000_000) return null;
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)
    ? value
    : null;
}

export async function resolveDealMemoLogo(logoUrl: string | null | undefined): Promise<string | null> {
  const embedded = safeEmbeddedLogo(logoUrl);
  if (embedded) return embedded;
  if (!logoUrl) return null;

  let url: URL;
  try {
    url = new URL(logoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "storage.googleapis.com") return null;

  const pathParts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const bucketName = pathParts.shift();
  const objectName = pathParts.join("/");
  if (!bucketName || !objectName) return null;

  const publicDir = new ObjectStorageService().getPublicObjectDir();
  const trusted = parseObjectPath(publicDir);
  const trustedPrefix = trusted.objectName.replace(/\/+$/, "");
  if (
    bucketName !== trusted.bucketName ||
    (objectName !== trustedPrefix && !objectName.startsWith(`${trustedPrefix}/`))
  ) {
    return null;
  }

  const file = objectStorageClient.bucket(bucketName).file(objectName);
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || "").toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType)) return null;
  const size = Number(metadata.size);
  if (!Number.isFinite(size) || size <= 0 || size > 2_000_000) return null;

  const [buffer] = await file.download();
  if (buffer.length > 2_000_000) return null;
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function rgba(hex: string, alpha: number): string {
  const normalized = hex.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function buildInvestmentThesis(deal: DealMemoInput): string {
  const address = formatAddress(deal);
  const market = textValue(deal.msaName) || textValue(deal.city) || "the local market";
  const growth = formatPercent(deal.censusPopGrowth);
  const autoYoc = formatPercent(deal.automatedYoc || deal.yieldOnCost);
  const exitCap = formatPercent(deal.marketCapRate);
  const unitCount = numberValue(deal.unitCount);
  const tdc = formatMoney(deal.totalProjectCost);

  const opening = `${address} presents a planning-level real estate investment opportunity in ${market}`;
  const scale = unitCount
    ? ` with ${unitCount.toLocaleString("en-US")} units${tdc !== "—" ? ` and estimated total development cost of ${tdc}` : ""}`
    : tdc !== "—"
      ? ` with estimated total development cost of ${tdc}`
      : "";
  const marketSentence = growth !== "—"
    ? ` The submarket's recorded population growth is ${growth}, providing a measurable demand indicator for the underwriting.`
    : " Available location and market data provide the demand basis for the current planning assumptions.";
  const returnParts = [
    autoYoc !== "—" ? `an automated yield on cost of ${autoYoc}` : null,
    exitCap !== "—" ? `an exit capitalization rate of ${exitCap}` : null,
  ].filter(Boolean);
  const returnsSentence = returnParts.length
    ? ` The current model indicates ${returnParts.join(" and ")}, subject to validation of rents, costs, timing, and financing assumptions.`
    : " Return metrics remain subject to validation of rents, costs, timing, and financing assumptions.";

  return `${opening}${scale}.${marketSentence}${returnsSentence}`;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getComputedFiveYearIrr(deal: DealMemoInput): string {
  const calculated = parseJsonObject(deal.calculatedFields);
  const underwriting = parseJsonObject(deal.underwritingState);
  const candidates = [
    calculated.autoIrr5Year,
    calculated.fiveYearAutoIrr,
    calculated.irr5Year,
    underwriting.autoIrr5Year,
    underwriting.fiveYearAutoIrr,
    underwriting.irr5Year,
  ];
  for (const candidate of candidates) {
    const formatted = formatPercent(candidate);
    if (formatted !== "—") return formatted;
  }
  return "—";
}

function resolveChromiumExecutable(): string {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error("Chromium executable is not available for Deal Memo PDF rendering");
  }
  return executable;
}

export function renderDealMemoHtml(deal: DealMemoInput, branding: DealMemoBranding): string {
  const primary = safeColor(branding.primaryColor, "#081729");
  const secondary = safeColor(branding.secondaryColor, "#4A90E2");
  const address = formatAddress(deal);
  const locationDetail = [textValue(deal.county), textValue(deal.msaName)].filter(Boolean).join(" ◆ ");
  const totalProjectCost = numberValue(deal.totalProjectCost);
  const unitCount = numberValue(deal.unitCount);
  const costPerUnit = totalProjectCost !== null && unitCount
    ? formatMoney(totalProjectCost / unitCount)
    : "—";
  const computedIrr = getComputedFiveYearIrr(deal);
  const fifthMetric = computedIrr !== "—"
    ? { label: "5-Yr Auto-IRR", value: computedIrr }
    : { label: "Exit Cap", value: formatPercent(deal.marketCapRate) };
  const metrics = [
    { label: "Total Development Cost", value: formatMoney(deal.totalProjectCost) },
    { label: "Cost / Unit", value: costPerUnit },
    { label: "Year-1 NOI", value: formatMoney(deal.projectedNOI) },
    { label: "Auto-YOC", value: formatPercent(deal.automatedYoc || deal.yieldOnCost) },
    fifthMetric,
  ];
  const embeddedLogo = safeEmbeddedLogo(branding.logoUrl);
  const logo = branding.whiteLabeled && embeddedLogo
    ? `<img class="brand-logo" src="${escapeHtml(embeddedLogo)}" alt="${escapeHtml(branding.companyName)}">`
    : `<div class="wordmark">${escapeHtml(branding.whiteLabeled ? branding.companyName : "LandLinq")}</div>`;
  const footer = branding.whiteLabeled
    ? "Powered by LandLinq"
    : "Planning-level estimate — not an appraisal, and not investment, legal, or tax advice.";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${newsreaderFontFaces}
@page{size:8.5in 11in;margin:0}
*{box-sizing:border-box}
html,body{width:8.5in;height:11in;margin:0;padding:0}
body{font-family:"Newsreader",Georgia,serif;color:#152231;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:8.5in;height:11in;overflow:hidden;padding:.58in .62in .42in}
.top-rule{position:absolute;inset:0 0 auto;height:.14in;background:linear-gradient(90deg,${primary},${secondary})}
.header{display:flex;align-items:flex-start;justify-content:space-between;gap:.35in;padding-top:.17in}
.brand{display:flex;align-items:center;min-height:.42in;max-width:2.2in}
.brand-logo{display:block;max-width:2.15in;max-height:.48in;object-fit:contain;object-position:left center}
.wordmark{font-size:25px;font-weight:700;letter-spacing:-.04em;color:${primary}}
.eyebrow{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${secondary};padding-top:.13in}
.title-block{margin-top:.48in;border-bottom:1px solid ${rgba(primary, .18)};padding-bottom:.32in}
h1{max-width:6.8in;margin:0;color:${primary};font-size:32px;font-weight:600;line-height:1.03;letter-spacing:-.035em}
.location-detail{margin-top:.12in;font-family:Arial,sans-serif;font-size:9px;font-weight:600;letter-spacing:.055em;text-transform:uppercase;color:#687789}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:.11in;margin-top:.38in}
.stat{min-height:1.05in;padding:.17in .13in .12in;border:1px solid ${rgba(primary, .13)};border-top:3px solid ${secondary};border-radius:5px;background:${rgba(secondary, .045)}}
.stat-label{min-height:.3in;font-family:Arial,sans-serif;font-size:7.5px;font-weight:700;line-height:1.25;letter-spacing:.07em;text-transform:uppercase;color:#6e7a87}
.stat-value{margin-top:.09in;color:${primary};font-size:20px;font-weight:600;line-height:1}
.thesis{margin-top:.42in;padding:.35in .38in .38in;border-left:4px solid ${secondary};background:${rgba(primary, .045)}}
.section-label{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${secondary}}
.thesis h2{margin:.11in 0 .12in;color:${primary};font-size:24px;font-weight:600;line-height:1.05}
.thesis p{margin:0;color:#354354;font-size:13px;font-weight:400;line-height:1.62}
.footer{position:absolute;left:.62in;right:.62in;bottom:.29in;border-top:1px solid ${rgba(primary, .16)};padding-top:.13in;font-family:Arial,sans-serif;font-size:7.5px;line-height:1.3;color:#778290;${branding.whiteLabeled ? "text-align:right" : ""}}
</style>
</head>
<body>
<main class="page">
  <div class="top-rule"></div>
  <header class="header">
    <div class="brand">${logo}</div>
    <div class="eyebrow">Deal Memo</div>
  </header>
  <section class="title-block">
    <h1>${escapeHtml(address)}</h1>
    ${locationDetail ? `<div class="location-detail">${escapeHtml(locationDetail)}</div>` : ""}
  </section>
  <section class="stats">
    ${metrics.map((metric) => `<article class="stat"><div class="stat-label">${escapeHtml(metric.label)}</div><div class="stat-value">${escapeHtml(metric.value)}</div></article>`).join("")}
  </section>
  <section class="thesis">
    <div class="section-label">Investment Thesis</div>
    <h2>Planning case overview</h2>
    <p>${escapeHtml(buildInvestmentThesis(deal))}</p>
  </section>
  <footer class="footer">${escapeHtml(footer)}</footer>
</main>
</body>
</html>`;
}

export async function generateDealMemoPdf(
  deal: DealMemoInput,
  branding: DealMemoBranding,
): Promise<Buffer> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    const error = new Error("Deal Memo rendering is busy; please try again shortly");
    (error as Error & { code?: string }).code = "DEAL_MEMO_BUSY";
    throw error;
  }
  activeRenders += 1;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({
      executablePath: resolveChromiumExecutable(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      timeout: 30_000,
    });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.route("**/*", (route) => route.abort());
    page.setDefaultTimeout(15_000);
    await page.setContent(renderDealMemoHtml(deal, branding), { waitUntil: "load", timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      width: "8.5in",
      height: "11in",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    activeRenders -= 1;
    await browser?.close();
  }
}