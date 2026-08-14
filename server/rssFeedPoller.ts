import { db } from './db';
import { rssFeedSources, rssProcessedListings } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { parsePropertyDataWithAI } from './aiEmailParser';
import { UnifiedDealPipeline } from './unifiedDealPipeline';

interface RSSItem {
  title: string;
  link: string;
  description: string;
  guid: string;
  pubDate: string;
}

function parseRSSXML(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  for (const match of itemMatches) {
    const content = match[1];
    const get = (tag: string): string => {
      const m = content.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const link = get('link') || get('enclosure') || '';
    const guid = get('guid') || link;
    if (!guid) continue;
    items.push({
      title: get('title'),
      link,
      description: get('description'),
      guid,
      pubDate: get('pubDate'),
    });
  }
  return items;
}

async function isAlreadyProcessed(feedSourceId: string, listingGuid: string): Promise<boolean> {
  const existing = await db
    .select({ id: rssProcessedListings.id })
    .from(rssProcessedListings)
    .where(
      and(
        eq(rssProcessedListings.feedSourceId, feedSourceId),
        eq(rssProcessedListings.listingGuid, listingGuid)
      )
    )
    .limit(1);
  return existing.length > 0;
}

async function recordProcessed(data: {
  feedSourceId: string;
  listingGuid: string;
  status: string;
  dealId?: string;
  skipReason?: string;
  listingTitle?: string;
  listingUrl?: string;
}) {
  await db.insert(rssProcessedListings).values({
    feedSourceId: data.feedSourceId,
    listingGuid: data.listingGuid,
    status: data.status,
    dealId: data.dealId || null,
    skipReason: data.skipReason || null,
    listingTitle: data.listingTitle || null,
    listingUrl: data.listingUrl || null,
  });
}

export async function pollFeed(feedId: string): Promise<{
  newItems: number;
  dealsCreated: number;
  skipped: number;
  errors: number;
}> {
  const [feed] = await db
    .select()
    .from(rssFeedSources)
    .where(eq(rssFeedSources.id, feedId))
    .limit(1);

  if (!feed) throw new Error(`RSS feed source ${feedId} not found`);

  console.log(`[RSS Poller] Polling feed: ${feed.name} (${feed.url})`);

  let newItems = 0;
  let dealsCreated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LandLinqBot/1.0; +https://landlinq.ai)' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching feed ${feed.url}`);
    }

    const xml = await response.text();
    const items = parseRSSXML(xml);

    console.log(`[RSS Poller] ${feed.name}: found ${items.length} items in feed`);

    await db.update(rssFeedSources)
      .set({ lastPolledAt: new Date(), lastItemCount: items.length })
      .where(eq(rssFeedSources.id, feed.id));

    for (const item of items) {
      try {
        // Skip already-seen listings
        const seen = await isAlreadyProcessed(feed.id, item.guid);
        if (seen) continue;

        newItems++;
        const rawText = `${item.title}\n\n${item.description}\n\nListing URL: ${item.link}`;

        // AI extraction
        let parsed: any;
        try {
          parsed = await parsePropertyDataWithAI(rawText);
        } catch (err) {
          console.warn(`[RSS Poller] AI parse failed for item "${item.title}":`, err);
          await recordProcessed({
            feedSourceId: feed.id,
            listingGuid: item.guid,
            status: 'error',
            skipReason: 'AI extraction failed',
            listingTitle: item.title,
            listingUrl: item.link,
          });
          errors++;
          continue;
        }

        // Filter: minimum acreage
        const acres = parseFloat(parsed.sizeAcres || '0');
        const minAcres = parseFloat(feed.minAcres || '0');
        if (minAcres > 0 && acres > 0 && acres < minAcres) {
          await recordProcessed({
            feedSourceId: feed.id,
            listingGuid: item.guid,
            status: 'skipped',
            skipReason: `Acreage ${acres} < minimum ${minAcres}`,
            listingTitle: item.title,
            listingUrl: item.link,
          });
          skipped++;
          continue;
        }

        // Filter: target states
        const states: string[] = feed.targetStates || [];
        if (states.length > 0 && parsed.state) {
          const normalizedState = (parsed.state || '').trim().toUpperCase();
          const match = states.some(s => s.toUpperCase() === normalizedState);
          if (!match) {
            await recordProcessed({
              feedSourceId: feed.id,
              listingGuid: item.guid,
              status: 'skipped',
              skipReason: `State "${parsed.state}" not in target list: ${states.join(', ')}`,
              listingTitle: item.title,
              listingUrl: item.link,
            });
            skipped++;
            continue;
          }
        }

        // Need at least a state or city to proceed
        if (!parsed.state && !parsed.city && !parsed.address) {
          await recordProcessed({
            feedSourceId: feed.id,
            listingGuid: item.guid,
            status: 'skipped',
            skipReason: 'Could not extract location from listing',
            listingTitle: item.title,
            listingUrl: item.link,
          });
          skipped++;
          continue;
        }

        // Submit deal through the unified pipeline
        try {
          const result = await UnifiedDealPipeline.processDealSubmission({
            address: parsed.address || '',
            city: parsed.city || '',
            state: parsed.state || '',
            zip: parsed.zip || '',
            county: parsed.county || '',
            askingPrice: parsed.askingPrice || '',
            sizeAcres: parsed.sizeAcres || '',
            unitCount: parsed.unitCount || '',
            vintage: parsed.vintage || '',
            submissionMethod: 'rss',
            source: `RSS: ${feed.name}`,
            notes: `Imported from RSS feed: ${feed.name}\nListing URL: ${item.link}\n\nOriginal listing:\n${item.title}`,
            rawEmailContent: rawText,
          });

          const dealId = result?.dealId || result?.id || null;
          await recordProcessed({
            feedSourceId: feed.id,
            listingGuid: item.guid,
            status: 'deal_created',
            dealId: dealId ? String(dealId) : undefined,
            listingTitle: item.title,
            listingUrl: item.link,
          });

          // Update deal count on the feed
          await db.update(rssFeedSources)
            .set({ totalDealsCreated: (feed.totalDealsCreated || 0) + dealsCreated + 1 })
            .where(eq(rssFeedSources.id, feed.id));

          dealsCreated++;
          console.log(`[RSS Poller] ✅ Deal created from "${item.title}" (feed: ${feed.name})`);
        } catch (err: any) {
          console.error(`[RSS Poller] Pipeline error for "${item.title}":`, err?.message || err);
          await recordProcessed({
            feedSourceId: feed.id,
            listingGuid: item.guid,
            status: 'error',
            skipReason: `Pipeline error: ${err?.message || 'Unknown error'}`,
            listingTitle: item.title,
            listingUrl: item.link,
          });
          errors++;
        }
      } catch (itemErr: any) {
        console.error(`[RSS Poller] Unexpected error on item:`, itemErr?.message || itemErr);
        errors++;
      }
    }
  } catch (fetchErr: any) {
    console.error(`[RSS Poller] Failed to fetch feed ${feed.name}:`, fetchErr?.message || fetchErr);
    throw fetchErr;
  }

  console.log(`[RSS Poller] ${feed.name} done — new: ${newItems}, deals: ${dealsCreated}, skipped: ${skipped}, errors: ${errors}`);
  return { newItems, dealsCreated, skipped, errors };
}

export async function pollAllEnabledFeeds(): Promise<void> {
  const feeds = await db
    .select()
    .from(rssFeedSources)
    .where(eq(rssFeedSources.enabled, true));

  if (feeds.length === 0) {
    console.log('[RSS Poller] No enabled feeds configured.');
    return;
  }

  console.log(`[RSS Poller] Polling ${feeds.length} enabled feed(s)...`);

  for (const feed of feeds) {
    try {
      await pollFeed(feed.id);
    } catch (err: any) {
      console.error(`[RSS Poller] Error polling feed "${feed.name}":`, err?.message || err);
    }
  }
}

export async function getRecentResults(feedId?: string, limit = 50): Promise<any[]> {
  const query = db
    .select()
    .from(rssProcessedListings)
    .orderBy(desc(rssProcessedListings.processedAt))
    .limit(limit);

  if (feedId) {
    return await db
      .select()
      .from(rssProcessedListings)
      .where(eq(rssProcessedListings.feedSourceId, feedId))
      .orderBy(desc(rssProcessedListings.processedAt))
      .limit(limit);
  }
  return await query;
}
