import OpenAI from "openai";
import { db } from "./db";
import {
  zoningAgendaItems,
  marketListings,
  permitSignals,
  marketNewsItems,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── NC Market Configuration ─────────────────────────────────────────────────

export const NC_MARKETS = {
  wilmington: {
    displayName: "Wilmington",
    county: "New Hanover County",
    cities: ["Wilmington", "Leland", "Hampstead", "Wrightsville Beach"],
    zoningPortals: [
      {
        label: "Wilmington Planning Commission",
        url: "https://www.wilmingtonnc.gov/government/boards-and-commissions/planning-commission",
      },
      {
        label: "New Hanover County Planning Board",
        url: "https://www.nhcgov.com/241/Planning-Board",
      },
      {
        label: "New Hanover iROCS Permits",
        url: "https://nhcpermitting.nhcgov.com/EnerGov_Prod/SelfService",
      },
    ],
    permitPortalUrl: "https://nhcpermitting.nhcgov.com/EnerGov_Prod/SelfService",
    permitPortalLabel: "New Hanover County Permit Portal",
    newsKeywords: ["Wilmington NC", "New Hanover County", "Cape Fear"],
    loopnetState: "NC",
    googleNewsQuery: "zoning rezoning \"planning commission\" Wilmington NC development",
    googleMarketQuery: "real estate land multifamily development Wilmington NC",
  },
  raleigh_durham: {
    displayName: "Raleigh / Durham",
    county: "Wake County, Durham County",
    cities: ["Raleigh", "Durham", "Cary", "Apex", "Chapel Hill", "Morrisville"],
    zoningPortals: [
      {
        label: "Raleigh Development Activity",
        url: "https://raleighnc.gov/planning/planning-commission",
      },
      {
        label: "Durham Planning Commission",
        url: "https://durham.legistar.com/Calendar.aspx",
      },
      {
        label: "Wake County Rezoning Cases",
        url: "https://www.wake.gov/departments-government/planning-development-inspections/rezoning",
      },
    ],
    permitPortalUrl: "https://services.wakegov.com/permits",
    permitPortalLabel: "Wake County Permits Online",
    newsKeywords: ["Raleigh NC", "Durham NC", "Wake County", "Research Triangle"],
    loopnetState: "NC",
    googleNewsQuery: "zoning rezoning \"planning commission\" Raleigh Durham NC development",
    googleMarketQuery: "real estate land multifamily development Raleigh Durham NC Triangle",
  },
  charlotte: {
    displayName: "Charlotte",
    county: "Mecklenburg County",
    cities: ["Charlotte", "Huntersville", "Concord", "Gastonia", "Mooresville", "Matthews"],
    zoningPortals: [
      {
        label: "Charlotte Legistar Meeting Portal",
        url: "https://charlotte.legistar.com/Calendar.aspx",
      },
      {
        label: "Charlotte Development Activity",
        url: "https://charlottenc.gov/Services/permit-and-development/Planning/development-activity",
      },
      {
        label: "Mecklenburg Planning",
        url: "https://www.mecknc.gov/LUESA/PlanningDepartment/Pages/Home.aspx",
      },
    ],
    permitPortalUrl: "https://clt.permits.online",
    permitPortalLabel: "Charlotte Permits Online",
    newsKeywords: ["Charlotte NC", "Mecklenburg County", "CLT growth"],
    loopnetState: "NC",
    googleNewsQuery: "zoning rezoning \"planning commission\" Charlotte NC development",
    googleMarketQuery: "real estate land multifamily development Charlotte NC Mecklenburg",
  },
  asheville: {
    displayName: "Asheville",
    county: "Buncombe County",
    cities: ["Asheville", "Hendersonville", "Waynesville", "Black Mountain", "Weaverville"],
    zoningPortals: [
      {
        label: "Asheville Planning & Zoning Commission",
        url: "https://www.ashevillenc.gov/government/boards-and-commissions/planning-and-zoning-commission/",
      },
      {
        label: "Buncombe County Planning",
        url: "https://www.buncombecounty.org/governing/depts/planning/planning.aspx",
      },
      {
        label: "Asheville Development Services",
        url: "https://www.ashevillenc.gov/department/development-services/",
      },
    ],
    permitPortalUrl: "https://www.ashevillenc.gov/department/development-services/building-safety/permits-inspections/",
    permitPortalLabel: "Asheville Development Services",
    newsKeywords: ["Asheville NC", "Buncombe County", "WNC growth"],
    loopnetState: "NC",
    googleNewsQuery: "zoning rezoning \"planning commission\" Asheville NC development",
    googleMarketQuery: "real estate land multifamily development Asheville NC Buncombe",
  },
} as const;

export type MarketKey = keyof typeof NC_MARKETS;

// ─── Google News RSS Fetch (reliable, no auth needed) ─────────────────────────

async function fetchGoogleNewsRss(query: string): Promise<Array<{ title: string; link: string; pubDate: string; description: string }>> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LandLinqBot/1.0; +https://landlinq.ai)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`⚠️ [NEWS-RSS] Google News returned ${res.status} for query: ${query}`);
      return [];
    }
    const xml = await res.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 25);
    return itemMatches.map((match) => {
      const itemXml = match[1];
      const title = (itemXml.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]>/i) ||
        itemXml.match(/<title[^>]*>(.*?)<\/title>/i))?.[1]?.trim() || "";
      const link = (itemXml.match(/<link>(.*?)<\/link>/i) ||
        itemXml.match(/<guid[^>]*>(.*?)<\/guid>/i))?.[1]?.trim() || "";
      const pubDate = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i)?.[1]?.trim() || "";
      const description = (itemXml.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]>/i) ||
        itemXml.match(/<description[^>]*>(.*?)<\/description>/is))?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400) || "";
      return { title, link, pubDate, description };
    }).filter((item) => item.title.length > 0);
  } catch (err: any) {
    console.error(`❌ [NEWS-RSS] Failed to fetch Google News RSS:`, err.message);
    return [];
  }
}

// ─── Zoning Agenda Fetching via Google News ───────────────────────────────────

export async function fetchAndParseZoningPage(market: MarketKey): Promise<{ saved: number; errors: string[] }> {
  const config = NC_MARKETS[market];
  console.log(`🏛️ [ZONING] Scanning Google News for zoning activity in ${config.displayName}`);

  const errors: string[] = [];
  const articles = await fetchGoogleNewsRss(config.googleNewsQuery);

  if (articles.length === 0) {
    const msg = `No recent zoning news found for ${config.displayName}`;
    console.log(`📭 [ZONING] ${msg}`);
    errors.push(msg);
    return { saved: 0, errors };
  }

  console.log(`📰 [ZONING] Found ${articles.length} news articles, extracting zoning cases...`);

  const prompt = `You are a real estate land acquisition assistant. The following are news article headlines and snippets about zoning/planning activity in ${config.displayName}, NC.

Extract any specific rezoning cases, site plan reviews, variance requests, or development applications mentioned.
For EACH distinct case or project mentioned, extract:
- caseNumber: official case/petition number if mentioned (e.g. "MUSP-001-25", "ZAP-2025-001"), or null
- applicantName: applicant or petitioner name if mentioned, or null
- developerName: developer/company name if mentioned, or null
- propertyAddress: specific property address if mentioned, or null
- requestType: one of "rezoning", "site_plan", "variance", "conditional_use", "annexation", "other"
- currentZoning: current zoning if mentioned, or null
- proposedZoning: proposed zoning if mentioned, or null
- acreage: numeric acreage if mentioned (number or null)
- projectDescription: brief description of the project (1-2 sentences)
- meetingDate: meeting date in YYYY-MM-DD format if mentioned, or null
- status: one of "pending", "approved", "denied", "tabled", "withdrawn", "hearing_scheduled"
- staffRecommendation: staff recommendation if mentioned, or null
- sourceTitle: the headline of the article this came from
- sourceUrl: the URL of the article

Return JSON: { "items": [...] }
Return empty items array if no specific zoning cases are mentioned (just general news).

Articles:
${articles.map((a, i) => `[${i + 1}] TITLE: ${a.title}\nURL: ${a.link}\nDATE: ${a.pubDate}\nSNIPPET: ${a.description}`).join("\n\n")}`;

  let items: any[] = [];
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const result = JSON.parse(response.choices[0].message.content || "{}");
    items = result.items || [];
  } catch (err: any) {
    const msg = `AI extraction failed: ${err.message}`;
    console.error(`❌ [ZONING] ${msg}`);
    errors.push(msg);
    return { saved: 0, errors };
  }

  if (items.length === 0) {
    console.log(`📭 [ZONING] News articles found but no specific cases extracted for ${config.displayName}`);
    errors.push(`${articles.length} news articles scanned but no specific zoning cases found — try pasting an agenda directly`);
    return { saved: 0, errors };
  }

  let saved = 0;
  for (const item of items) {
    if (!item.projectDescription && !item.caseNumber && !item.propertyAddress) continue;
    try {
      await db.insert(zoningAgendaItems).values({
        market,
        meetingDate: item.meetingDate || null,
        caseNumber: item.caseNumber || null,
        applicantName: item.applicantName || null,
        developerName: item.developerName || null,
        propertyAddress: item.propertyAddress || null,
        requestType: item.requestType || "other",
        currentZoning: item.currentZoning || null,
        proposedZoning: item.proposedZoning || null,
        acreage: item.acreage ? String(item.acreage) : null,
        projectDescription: item.projectDescription || null,
        staffRecommendation: item.staffRecommendation || null,
        status: item.status || "pending",
        sourceUrl: item.sourceUrl || null,
        aiSummary: buildZoningSummary(item),
        alertLevel: deriveZoningAlertLevel(item),
        rawText: item.sourceTitle || null,
      });
      saved++;
    } catch (_e) {}
  }

  console.log(`✅ [ZONING] Saved ${saved} agenda items for ${config.displayName}`);
  return { saved, errors };
}

function buildZoningSummary(item: any): string {
  const parts = [];
  if (item.requestType) parts.push(`${item.requestType.replace("_", " ").toUpperCase()}`);
  if (item.propertyAddress) parts.push(`at ${item.propertyAddress}`);
  if (item.acreage) parts.push(`(${item.acreage} acres)`);
  if (item.applicantName) parts.push(`— ${item.applicantName}`);
  if (item.currentZoning && item.proposedZoning)
    parts.push(`— ${item.currentZoning} → ${item.proposedZoning}`);
  if (item.projectDescription) parts.push(`| ${String(item.projectDescription).slice(0, 120)}`);
  return parts.join(" ");
}

function deriveZoningAlertLevel(item: any): string {
  const highKeywords = ["multifamily", "apartment", "mixed use", "planned development", "PD", "rezoning", "100 units", "200 units"];
  const desc = `${item.requestType || ""} ${item.projectDescription || ""}`.toLowerCase();
  if (highKeywords.some((k) => desc.includes(k.toLowerCase()))) return "high";
  if (item.acreage && parseFloat(item.acreage) >= 10) return "high";
  if (item.acreage && parseFloat(item.acreage) >= 3) return "medium";
  return "low";
}

// ─── Manual Zoning Text / PDF Parsing ────────────────────────────────────────

export async function parseZoningText(market: MarketKey, rawText: string, sourceUrl?: string): Promise<number> {
  try {
    const prompt = `You are a real estate land acquisition assistant. Parse this zoning/planning meeting agenda text and extract ALL case items.

For each item, extract:
- caseNumber, applicantName, developerName, propertyAddress, requestType (one of: rezoning/site_plan/variance/conditional_use/annexation/other)
- currentZoning, proposedZoning, acreage (number or null), projectDescription, meetingDate (YYYY-MM-DD or null)
- status: one of pending/approved/denied/tabled/withdrawn/hearing_scheduled
- staffRecommendation

Return JSON: { "items": [...] }

Text:
${rawText.slice(0, 15000)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const items: any[] = result.items || [];
    let saved = 0;

    for (const item of items) {
      if (!item.propertyAddress && !item.caseNumber) continue;
      await db.insert(zoningAgendaItems).values({
        market,
        meetingDate: item.meetingDate || null,
        caseNumber: item.caseNumber || null,
        applicantName: item.applicantName || null,
        developerName: item.developerName || null,
        propertyAddress: item.propertyAddress || null,
        requestType: item.requestType || "other",
        currentZoning: item.currentZoning || null,
        proposedZoning: item.proposedZoning || null,
        acreage: item.acreage ? String(item.acreage) : null,
        projectDescription: item.projectDescription || null,
        staffRecommendation: item.staffRecommendation || null,
        status: item.status || "pending",
        sourceUrl: sourceUrl || null,
        aiSummary: buildZoningSummary(item),
        alertLevel: deriveZoningAlertLevel(item),
        rawText,
      });
      saved++;
    }

    return saved;
  } catch (err: any) {
    console.error(`❌ [ZONING-PARSE] Error:`, err.message);
    throw err;
  }
}

// ─── LoopNet Listings ─────────────────────────────────────────────────────────

export async function fetchLoopNetListings(market: MarketKey): Promise<{ saved: number; error?: string }> {
  const apiKey = process.env.LOOPNET_RAPIDAPI_KEY;
  if (!apiKey) {
    return { saved: 0, error: "LOOPNET_RAPIDAPI_KEY not configured" };
  }

  const config = NC_MARKETS[market];
  console.log(`🔍 [LISTINGS] Searching LoopNet for NC land listings (market: ${config.displayName})`);

  try {
    // Use searchByState with NC — the RapidAPI endpoint supports state-level search
    const response = await fetch(
      `https://loopnet-api.p.rapidapi.com/loopnet/searchByState?state=NC&propertyType=land&pageSize=50`,
      {
        headers: {
          "x-rapidapi-host": "loopnet-api.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      const msg = `LoopNet API returned ${response.status}`;
      console.warn(`⚠️ [LISTINGS] ${msg}`);
      return { saved: 0, error: msg };
    }

    const data = await response.json();
    const allListings: any[] = data?.data || data?.listings || data?.results || [];

    if (!allListings.length) {
      console.log(`📭 [LISTINGS] No listings returned from LoopNet API`);
      return { saved: 0, error: "LoopNet returned no listings for NC" };
    }

    // Filter to cities relevant to this market
    const marketCities = config.cities.map((c) => c.toLowerCase());
    const filtered = allListings.filter((l: any) => {
      const city = (l.city || l.cityName || "").toLowerCase();
      const state = (l.state || l.stateCode || "").toUpperCase();
      const isNC = state === "NC" || state === "" || state === "NORTH CAROLINA";
      const inMarket = marketCities.some((mc) => city.includes(mc) || mc.includes(city));
      return isNC && (inMarket || city === "");
    });

    const toSave = filtered.length > 0 ? filtered : allListings.slice(0, 20);
    let saved = 0;

    for (const listing of toSave.slice(0, 30)) {
      try {
        const askingPrice = listing.price || listing.askingPrice || listing.listingPrice || null;
        const acreage = listing.lotSize || listing.acreage || listing.landArea || null;

        await db.insert(marketListings).values({
          market,
          source: "loopnet",
          externalId: String(listing.listingId || listing.id || Math.random()),
          address: listing.address || listing.streetAddress || null,
          city: listing.city || listing.cityName || config.displayName,
          state: "NC",
          zipCode: listing.zipCode || listing.zip || null,
          askingPrice: askingPrice ? Math.round(Number(askingPrice)) : null,
          acreage: acreage ? String(parseFloat(String(acreage)).toFixed(2)) : null,
          pricePerAcre:
            askingPrice && acreage && parseFloat(String(acreage)) > 0
              ? Math.round(Number(askingPrice) / parseFloat(String(acreage)))
              : null,
          propertyType: "land",
          zoning: listing.zoning || null,
          daysOnMarket: listing.daysOnMarket || null,
          listingDate: listing.listingDate || null,
          isExpired: (listing.daysOnMarket || 0) > 180,
          description: listing.description || null,
          brokerName: listing.brokerName || listing.listingAgent || null,
          brokerPhone: listing.brokerPhone || null,
          sourceUrl: listing.url || `https://www.loopnet.com/Listing/${listing.listingId || listing.id}/`,
          aiSignal: deriveListingSignal(listing),
        });
        saved++;
      } catch (_e) {}
    }

    console.log(`✅ [LISTINGS] Saved ${saved} listings for ${config.displayName}`);
    return { saved };
  } catch (err: any) {
    console.error(`❌ [LISTINGS] LoopNet fetch failed:`, err.message);
    return { saved: 0, error: err.message };
  }
}

function deriveListingSignal(listing: any): string {
  const dom = listing.daysOnMarket || 0;
  const signals = [];
  if (dom > 180) signals.push("⚠️ 180+ days on market — seller likely motivated");
  else if (dom > 90) signals.push("📌 90+ days on market — worth reaching out");
  else if (dom < 14) signals.push("🆕 New listing — act quickly");
  const price = listing.price || listing.askingPrice;
  const acreage = listing.lotSize || listing.acreage;
  if (price && acreage && parseFloat(String(acreage)) > 0) {
    const ppa = Number(price) / parseFloat(String(acreage));
    if (ppa < 20000) signals.push("💰 Low price/acre — below market");
  }
  return signals.join(" | ") || "Active listing";
}

// ─── Permit Signal Processing ─────────────────────────────────────────────────

export async function processPermitRows(
  market: MarketKey,
  rows: any[],
  sourceFilename: string
): Promise<number> {
  console.log(`🔧 [PERMITS] Processing ${rows.length} permit rows for ${NC_MARKETS[market].displayName}`);

  const today = new Date();
  let saved = 0;

  for (const row of rows) {
    const permitNumber =
      row["Permit Number"] || row["PermitNumber"] || row["permit_number"] || row["Permit #"] || "";
    const address =
      row["Address"] || row["Property Address"] || row["Site Address"] || row["address"] || "";
    const permitType =
      row["Permit Type"] || row["Type"] || row["permit_type"] || row["Work Type"] || "";
    const issueDate = row["Issue Date"] || row["Issued"] || row["issue_date"] || row["Date Issued"] || "";
    const lastActivity =
      row["Last Activity"] ||
      row["Last Inspection"] ||
      row["last_activity"] ||
      row["Updated"] ||
      row["Last Updated"] ||
      issueDate;
    const owner = row["Owner"] || row["Owner Name"] || row["owner_name"] || "";
    const applicant = row["Applicant"] || row["Contractor"] || row["applicant_name"] || "";
    const cost = row["Cost"] || row["Estimated Cost"] || row["Value"] || row["Valuation"] || "";
    const description = row["Description"] || row["Work Description"] || row["desc"] || "";

    if (!address && !permitNumber) continue;

    let daysInactive = 0;
    if (lastActivity) {
      const lastDate = new Date(lastActivity);
      if (!isNaN(lastDate.getTime())) {
        daysInactive = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const isResidential =
      /residential|multifamily|apartment|dwelling|housing|land|grading|site|development/i.test(
        `${permitType} ${description}`
      );

    let signalType: string | null = null;
    if (daysInactive >= 180) signalType = "stalled_180d";
    else if (daysInactive >= 90) signalType = "stalled_90d";
    else if (daysInactive <= 14 && isResidential) signalType = "new_issued";

    if (!signalType) continue;

    try {
      await db.insert(permitSignals).values({
        market,
        permitNumber: permitNumber || null,
        propertyAddress: address || null,
        ownerName: owner || null,
        applicantName: applicant || null,
        permitType: permitType || null,
        description: description ? String(description).slice(0, 500) : null,
        issueDate: issueDate || null,
        lastActivityDate: lastActivity || null,
        daysInactive,
        estimatedCost: cost ? Math.round(parseFloat(String(cost).replace(/[$,]/g, ""))) || null : null,
        signalType,
        county: NC_MARKETS[market].county,
        aiSummary: buildPermitSummary(signalType, daysInactive, permitType, description, address),
        sourceUrl: `Uploaded: ${sourceFilename}`,
      });
      saved++;
    } catch (_e) {}
  }

  console.log(`✅ [PERMITS] Flagged ${saved} permit signals for ${NC_MARKETS[market].displayName}`);
  return saved;
}

function buildPermitSummary(
  signalType: string,
  daysInactive: number,
  permitType: string,
  description: string,
  address: string
): string {
  if (signalType === "stalled_180d")
    return `🚨 STALLED ${daysInactive} days — ${permitType || "permit"} at ${address}. ${description?.slice(0, 100) || ""}`;
  if (signalType === "stalled_90d")
    return `⚠️ Inactive ${daysInactive} days — ${permitType || "permit"} at ${address}. ${description?.slice(0, 100) || ""}`;
  if (signalType === "new_issued")
    return `🆕 New ${permitType || "permit"} issued at ${address}. ${description?.slice(0, 100) || ""}`;
  return `${permitType || "Permit"} signal at ${address}`;
}

// ─── Market News via Google News RSS ─────────────────────────────────────────

export async function fetchAndScoreMarketNews(market: MarketKey): Promise<{ saved: number; error?: string }> {
  const config = NC_MARKETS[market];
  console.log(`📰 [NEWS] Fetching Google News RSS for ${config.displayName}`);

  const articles = await fetchGoogleNewsRss(config.googleMarketQuery);

  if (articles.length === 0) {
    console.log(`📭 [NEWS] No articles returned for ${config.displayName}`);
    return { saved: 0, error: "No news articles found for this market right now" };
  }

  console.log(`📰 [NEWS] Scoring ${articles.length} articles for ${config.displayName}`);

  let saved = 0;
  for (const article of articles) {
    if (!article.title) continue;
    try {
      const score = await scoreNewsItem(article.title, article.description, config.displayName);
      if (score.relevanceScore < 30) continue;

      await db.insert(marketNewsItems).values({
        market,
        headline: article.title.slice(0, 500),
        summary: article.description || null,
        sourceUrl: article.link || null,
        sourceName: "Google News",
        publishedAt: article.pubDate ? new Date(article.pubDate) : null,
        relevanceScore: score.relevanceScore,
        signalType: score.signalType,
        aiInsight: score.insight,
        isRead: false,
      });
      saved++;
    } catch (_e) {}
  }

  console.log(`✅ [NEWS] Saved ${saved} relevant news items for ${config.displayName}`);
  if (saved === 0) {
    return { saved: 0, error: `${articles.length} articles checked but none scored ≥30 relevance for land acquisition` };
  }
  return { saved };
}

async function scoreNewsItem(title: string, description: string, marketName: string): Promise<{ relevanceScore: number; signalType: string; insight: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Score this news article for land acquisition relevance in ${marketName}, NC (0-100).
Consider: rezoning approvals, new development projects, land sales, multifamily housing, infrastructure projects, population growth news, developer activity.

Title: ${title}
Description: ${description}

Return JSON: {
  "relevanceScore": 0-100,
  "signalType": one of "zoning_activity", "new_development", "land_sale", "infrastructure", "market_growth", "policy_change", "general",
  "insight": "1 sentence on why this matters for land acquisition"
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch {
    return { relevanceScore: 0, signalType: "general", insight: "" };
  }
}
