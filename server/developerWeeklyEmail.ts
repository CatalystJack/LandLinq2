import * as cron from 'node-cron';
import { db } from './db';
import { deals, partnerDevelopers } from '@shared/schema';
import { desc, sql, gte } from 'drizzle-orm';
import { sendNotificationEmail } from './emailService';
import { objectStorageService } from './objectStorage';

const DEVELOPER_TYPE_TO_DEAL_SLUGS: Record<string, string[]> = {
  'Conventional 3-Story Walk-Up':       ['3-story-surface-park'],
  'Conventional 4-Story Mid-Rise':      ['4-story-surface-park'],
  'Attainable / Workforce Housing':     ['3-story-attainable'],
  'Active Adult 3-Story Flats (55+)':   ['aa-3-story-flats'],
  'Active Adult 4-Story Flats (55+)':   ['aa-4-story-flats'],
  'Active Adult Cottages (55+)':        ['aa-cottages'],
  'BTR Townhomes':                      ['btr-3-story-th', 'btr-th-2-3br'],
  'BTR Single-Family Detached':         ['btr-sfr-detached'],
  'Build-to-Rent':                      ['btr-3-story-th', 'btr-sfr-detached', 'btr-th-2-3br'],
  'Build-to-Rent (BTR)':               ['btr-3-story-th', 'btr-sfr-detached', 'btr-th-2-3br'],
  'Conventional Multifamily':           ['3-story-surface-park', '4-story-surface-park'],
  'Multifamily':                        ['3-story-surface-park', '4-story-surface-park'],
  'Active Adult (55+)':                 ['aa-3-story-flats', 'aa-4-story-flats', 'aa-cottages'],
  'Senior Housing':                     ['aa-3-story-flats', 'aa-4-story-flats', 'aa-cottages'],
};

function dealMatchesDeveloper(deal: any, dev: any): boolean {
  const dealTypes: string[] = Array.isArray(deal.productTypes)
    ? deal.productTypes
    : (typeof deal.productTypes === 'string' ? (() => { try { return JSON.parse(deal.productTypes); } catch { return []; } })() : []);

  if (dev.targetStates?.length > 0) {
    if (!deal.state || !dev.targetStates.includes(deal.state)) return false;
  }

  if (dev.productTypes?.length > 0) {
    const devSlugs = dev.productTypes.flatMap((pt: string) => DEVELOPER_TYPE_TO_DEAL_SLUGS[pt] || []);
    const hasOverlap = devSlugs.length > 0
      ? dealTypes.some((dt: string) => devSlugs.includes(dt))
      : dev.productTypes.some((pt: string) =>
          dealTypes.some((dt: string) =>
            dt.toLowerCase().includes(pt.toLowerCase().split(' ')[0]) ||
            pt.toLowerCase().includes(dt.toLowerCase().split(' ')[0])
          )
        );
    if (!hasOverlap) return false;
  }

  if (dev.minAcres && deal.sizeAcres && parseFloat(deal.sizeAcres) < parseFloat(dev.minAcres)) return false;
  if (dev.maxAcres && deal.sizeAcres && parseFloat(deal.sizeAcres) > parseFloat(dev.maxAcres)) return false;
  if (dev.minUnits && deal.estimatedUnits && deal.estimatedUnits < dev.minUnits) return false;

  return true;
}

function extractBestYoc(yocText: string | null | undefined): string {
  if (!yocText) return '';
  const best = yocText.match(/BEST:\s*~?(\d+\.?\d*)\s*%/i);
  if (best) return best[1] + '%';
  const plain = yocText.match(/(\d+\.?\d*)\s*%/);
  return plain ? plain[1] + '%' : '';
}

function classificationLabel(c: string): string {
  if (c === 'green') return 'High Priority';
  if (c === 'yellow') return 'Potential';
  if (c === 'red') return 'Clear No';
  return c;
}

function buildEmailHtml(dev: any, matchingDeals: any[]): string {
  const dealRows = matchingDeals.map(deal => {
    const addr = [deal.address, deal.city, deal.state].filter(Boolean).join(', ');
    const yoc = extractBestYoc(deal.automatedYoc);
    const size = deal.sizeAcres ? `${parseFloat(deal.sizeAcres).toFixed(1)} ac` : '—';
    const units = deal.estimatedUnits ? `${deal.estimatedUnits} units` : '—';
    const price = deal.askingPrice ? `$${parseInt(deal.askingPrice).toLocaleString()}` : '—';
    const cls = classificationLabel(deal.classification);
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:13px;color:#07172A;font-weight:500;">${addr}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center;">${cls}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center;">${size}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center;">${units}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center;">${price}</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${deal.classification === 'red' ? '#dc2626' : '#d97706'};text-align:center;">${yoc || '—'}</td>
      </tr>`;
  }).join('');

  const firstName = dev.contactName?.split(' ')[0] || 'there';
  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7f9;font-family:Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#07172A;padding:24px 32px;">
      <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">LandLinq</p>
      <p style="margin:4px 0 0;font-size:13px;color:#9ab8c4;">Weekly Deal Pipeline — ${weekOf}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 6px;font-size:16px;color:#07172A;font-weight:600;">Hi ${firstName},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
        Here are the <strong>${matchingDeals.length} new deal${matchingDeals.length !== 1 ? 's' : ''}</strong> added to our pipeline this week that match your acquisition criteria.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f5f7f9;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Property</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Size</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Units</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Asking</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">YOC</th>
          </tr>
        </thead>
        <tbody>${dealRows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
        Investment memos for deals showing strong returns will be emailed separately as they are finalized. 
        Reply to this email or contact us at <a href="mailto:acquisitions@catalystcp.com" style="color:#009BA7;">acquisitions@catalystcp.com</a> to discuss any of these opportunities.
      </p>
    </div>
    <div style="background:#07172A;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#6b7280;">LandLinq · 1600 Camden Road Suite 200, Charlotte NC 28203</p>
      <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">You're receiving this because you registered as a partner developer. <a href="mailto:acquisitions@catalystcp.com?subject=Unsubscribe" style="color:#9ab8c4;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendWeeklyDeveloperEmails(): Promise<void> {
  console.log('📧 [DEV-WEEKLY] Starting weekly developer deal digest...');
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [recentDeals, activeDevelopers] = await Promise.all([
    db.select({
      id: deals.id,
      address: deals.address,
      city: deals.city,
      state: deals.state,
      classification: deals.classification,
      productTypes: deals.productTypes,
      sizeAcres: deals.sizeAcres,
      estimatedUnits: deals.estimatedUnits,
      askingPrice: deals.askingPrice,
      automatedYoc: deals.automatedYoc,
      createdAt: deals.createdAt,
    })
      .from(deals)
      .where(sql`classification != 'unclassified' AND created_at >= ${oneWeekAgo.toISOString()}`)
      .orderBy(sql`CASE WHEN classification = 'red' THEN 0 WHEN classification = 'yellow' THEN 1 ELSE 2 END`),
    db.select().from(partnerDevelopers).where(sql`is_active = true`),
  ]);

  console.log(`📧 [DEV-WEEKLY] Found ${recentDeals.length} recent deals, ${activeDevelopers.length} active developers`);

  let sent = 0, skipped = 0;
  for (const dev of activeDevelopers) {
    const matchingDeals = recentDeals.filter(deal => dealMatchesDeveloper(deal, dev));
    if (matchingDeals.length === 0) { skipped++; continue; }

    try {
      await sendNotificationEmail({
        to: dev.email,
        subject: `${matchingDeals.length} New Deal${matchingDeals.length !== 1 ? 's' : ''} This Week — LandLinq Pipeline`,
        html: buildEmailHtml(dev, matchingDeals),
        text: `Hi ${dev.contactName?.split(' ')[0] || 'there'},\n\n${matchingDeals.length} new deal(s) matching your criteria were added this week.\n\n${matchingDeals.map(d => `- ${[d.address, d.city, d.state].filter(Boolean).join(', ')} — ${classificationLabel(d.classification)}${extractBestYoc(d.automatedYoc) ? ` — YOC ${extractBestYoc(d.automatedYoc)}` : ''}`).join('\n')}\n\nReply to discuss any of these opportunities.\n\nLandLinq Team`,
        type: 'developer_weekly_digest',
        priority: 'normal',
      });
      sent++;
      console.log(`✅ [DEV-WEEKLY] Sent to ${dev.email} (${matchingDeals.length} deals)`);
    } catch (err: any) {
      console.error(`❌ [DEV-WEEKLY] Failed to send to ${dev.email}:`, err.message);
    }
  }
  console.log(`📧 [DEV-WEEKLY] Done — ${sent} sent, ${skipped} skipped (no matching deals)`);
}

export function startDeveloperWeeklyEmailScheduler(): void {
  cron.schedule('0 8 * * 1', async () => {
    console.log('📅 [DEV-WEEKLY] Monday 8:00 AM ET — sending weekly deal digests to developers...');
    try {
      await sendWeeklyDeveloperEmails();
    } catch (err: any) {
      console.error('❌ [DEV-WEEKLY] Weekly email job failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('📅 Developer weekly email scheduler started — Mondays at 8:00 AM ET');
}
