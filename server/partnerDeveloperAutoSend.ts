import { db } from './db';
import { developerProfiles, partnerDevelopers, partnerDeveloperSends } from '../shared/schema';
import type { DeveloperProfile } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { deals } from '../shared/schema';
import { classifyDealForProfile } from './developerClassificationService';

// ──────────────────────────────────────────────────────────────────────────────
// Auto-send engine: matches a newly-classified deal against every active
// partner developer whose buy box criteria it satisfies.
//
// NEW BEHAVIOR (outbox queue):
//  - ALL matching active developers → insert a 'pending' record in
//    partner_developer_sends (if no existing record for this dev+deal)
//  - Developers with autoSendEnabled=true → ALSO email immediately and mark 'sent'
//  - Analysts see 'pending' records in the Outbox tab and can edit/send manually
// ──────────────────────────────────────────────────────────────────────────────

export async function autoSendMatchingDeveloperEmails(deal: any): Promise<void> {
  try {
    // Fetch ALL active developers — not filtered by autoSendEnabled
    const recipients = await db
      .select({
        developer: partnerDevelopers,
        profile: developerProfiles,
      })
      .from(partnerDevelopers)
      .leftJoin(
        developerProfiles,
        eq(partnerDevelopers.developerProfileId, developerProfiles.id),
      )
      .where(eq(partnerDevelopers.isActive, true));

    if (!recipients.length) {
      console.log('⏭️ [AUTO-SEND] No active partner developers registered');
      return;
    }

    console.log(`🔍 [AUTO-SEND] Checking deal ${deal.id} against ${recipients.length} active developers`);

    for (const { developer: dev, profile } of recipients) {
      try {
        if (!doesDealMatchDeveloper(deal, dev)) continue;
        const classification = classifyDealForProfile(
          deal,
          profile || partnerDeveloperToClassificationProfile(dev),
        );

        // Check if a record already exists (pending or sent)
        const existing = await db
          .select({ id: partnerDeveloperSends.id, status: partnerDeveloperSends.status })
          .from(partnerDeveloperSends)
          .where(and(
            eq(partnerDeveloperSends.dealId, deal.id),
            profile?.id || dev.developerProfileId
              ? eq(partnerDeveloperSends.developerProfileId, profile?.id || dev.developerProfileId!)
              : eq(partnerDeveloperSends.developerId, dev.id),
          ))
          .limit(1);

        if (existing.length > 0) {
          console.log(`⏭️ [AUTO-SEND] Deal ${deal.id} already queued/sent for ${dev.companyName} (status: ${existing[0].status}), skipping`);
          continue;
        }

        if (dev.autoSendEnabled) {
          // Send immediately + record as 'sent'
          await sendDeveloperDealEmail(deal, dev);
          await db.insert(partnerDeveloperSends).values({
            developerId: dev.id,
            developerProfileId: profile?.id || dev.developerProfileId || null,
            dealId: deal.id,
            classification,
            address: deal.address,
            status: 'sent',
            sentAt: new Date(),
          }).onConflictDoNothing();
          console.log(`✅ [AUTO-SEND] Deal ${deal.id} auto-sent to ${dev.email} (${dev.companyName})`);
        } else {
          // Queue as pending for manual review
          await db.insert(partnerDeveloperSends).values({
            developerId: dev.id,
            developerProfileId: profile?.id || dev.developerProfileId || null,
            dealId: deal.id,
            classification,
            address: deal.address,
            status: 'pending',
            sentAt: null,
          }).onConflictDoNothing();
          console.log(`📥 [AUTO-SEND] Deal ${deal.id} queued (pending) for ${dev.companyName} — manual send required`);
        }
      } catch (devError) {
        console.error(`❌ [AUTO-SEND] Failed for ${dev.companyName}:`, devError);
      }
    }
  } catch (err) {
    console.error('❌ [AUTO-SEND] Outer error:', err);
  }
}

/**
 * The legacy partner developer directory predates developerProfiles. Keep its
 * dispatch records compatible with the new classifier until those records are
 * linked to a full developer profile.
 */
export function partnerDeveloperToClassificationProfile(dev: any): DeveloperProfile {
  const usesPsf = dev.rentMetric === "psf" || (
    dev.rentMetric == null &&
    dev.minRentPsf != null &&
    dev.minRentPerUnit == null
  );

  return {
    id: dev.id,
    companyName: dev.companyName || "",
    slug: dev.slug || String(dev.id),
    logoUrl: dev.logoUrl ?? null,
    primaryColor: dev.primaryColor ?? "#0A2B4A",
    secondaryColor: dev.secondaryColor ?? "#4A90E2",
    isInternal: dev.isInternal ?? false,
    knownEmailDomains: dev.knownEmailDomains ?? null,
    rentMetric: usesPsf ? "psf" : "per_unit",
    minRentPsf: dev.minRentPsf ?? null,
    minRentPerUnit: dev.minRentPerUnit ?? null,
    minAcres: dev.minAcres ?? null,
    maxAcres: dev.maxAcres ?? null,
    acreageOverridesByProductType: dev.acreageOverridesByProductType ?? {},
    qctOverridesRentMinimum: dev.qctOverridesRentMinimum ?? dev.qctInterest ?? false,
    ddaOverridesRentMinimum: dev.ddaOverridesRentMinimum ?? false,
    ozOverridesRentMinimum: dev.ozOverridesRentMinimum ?? false,
    targetStates: dev.targetStates ?? [],
    targetCounties: dev.targetCounties ?? [],
    isActive: dev.isActive ?? true,
    createdAt: dev.createdAt ?? null,
    updatedAt: dev.updatedAt ?? null,
  } as DeveloperProfile;
}

// ── Matching logic (mirrors the routing endpoint in routes.ts) ─────────────

export function doesDealMatchDeveloper(deal: any, dev: any): boolean {
  // ── Apex gate — only apex-flagged deals may be sent to developers ──────────
  if (!deal.apex) return false;

  // State (market)
  if (dev.targetStates?.length) {
    if (!deal.state || !dev.targetStates.includes(deal.state)) return false;
  }

  // MSA (market)
  if (dev.targetMsas?.length) {
    if (!deal.msaName || !dev.targetMsas.includes(deal.msaName)) return false;
  }

  // County (market)
  if (dev.targetCounties?.length) {
    if (!deal.county || !dev.targetCounties.includes(deal.county)) return false;
  }

  // Acreage floor
  if (dev.minAcres && deal.sizeAcres) {
    if (parseFloat(deal.sizeAcres) < parseFloat(dev.minAcres)) return false;
  }

  // Acreage ceiling
  if (dev.maxAcres && deal.sizeAcres) {
    if (parseFloat(deal.sizeAcres) > parseFloat(dev.maxAcres)) return false;
  }

  // Unit floor
  if (dev.minUnits && deal.estimatedUnits) {
    if (deal.estimatedUnits < dev.minUnits) return false;
  }

  // Unit ceiling
  if (dev.maxUnits && deal.estimatedUnits) {
    if (deal.estimatedUnits > dev.maxUnits) return false;
  }

  // Price per acre ceiling
  if (dev.maxAskingPricePerAcre && deal.askingPrice && deal.sizeAcres && parseFloat(deal.sizeAcres) > 0) {
    const pricePerAcre = parseFloat(deal.askingPrice) / parseFloat(deal.sizeAcres);
    if (pricePerAcre > parseFloat(dev.maxAskingPricePerAcre)) return false;
  }

  return true;
}

// ── Email builder ──────────────────────────────────────────────────────────

export async function sendDeveloperDealEmail(deal: any, dev: any, overrides?: { zoning?: string; summary?: string; wetlandNotes?: string }): Promise<void> {
  const { sendNotificationEmail } = await import('./emailService');

  // ── Core fields ────────────────────────────────────────────────────────────
  const addr = [deal.address, deal.city, deal.state].filter(Boolean).join(', ');
  const locationLine = [deal.county ? `${deal.county} County` : null, deal.state].filter(Boolean).join(', ');
  const size = deal.sizeAcres ? `${parseFloat(deal.sizeAcres).toFixed(2)} acres` : null;
  const price = deal.askingPrice ? `$${parseInt(deal.askingPrice).toLocaleString()}` : null;
  const pricePerAcre = (deal.askingPrice && deal.sizeAcres && parseFloat(deal.sizeAcres) > 0)
    ? `$${Math.round(parseFloat(deal.askingPrice) / parseFloat(deal.sizeAcres)).toLocaleString()}/acre`
    : null;
  const units = deal.estimatedUnits ? `${deal.estimatedUnits} units` : null;
  const vintage = deal.vintage ? `${deal.vintage}` : null;
  const zoningDisplay = overrides?.zoning ?? deal.zoning ?? null;

  const dealProductTypes: string[] = Array.isArray(deal.productTypes)
    ? deal.productTypes
    : (typeof deal.productTypes === 'string'
        ? (() => { try { return JSON.parse(deal.productTypes); } catch { return [deal.productTypes]; } })()
        : []);
  const productTypesDisplay = dealProductTypes.join(', ') || null;
  const summaryText = overrides?.summary ?? deal.developerSummary ?? null;
  const wetlandText = overrides?.wetlandNotes ?? deal.wetlandNotes ?? null;
  // Extract numeric YOC from strings like "BEST: ~6.2% | 3-Story SP: 6.2% (top comp)"
  const extractYocNum = (s: string | null | undefined): number | null => {
    if (!s) return null;
    const best = s.match(/BEST:\s*~?(\d+\.?\d*)\s*%/i);
    if (best) return parseFloat(best[1]);
    const plain = s.match(/(\d+\.?\d*)\s*%/);
    return plain ? parseFloat(plain[1]) : null;
  };
  const yocNum = extractYocNum(deal.automatedYoc);
  const yocDisplay = yocNum != null && !isNaN(yocNum) ? `${yocNum.toFixed(2)}%` : null;

  // ── Property images ────────────────────────────────────────────────────────
  const dealImageUrls: string[] = Array.isArray(deal.imageUrls)
    ? deal.imageUrls
    : (typeof deal.imageUrls === 'string'
        ? (() => { try { return JSON.parse(deal.imageUrls); } catch { return []; } })()
        : []);

  // ── Rent comps ─────────────────────────────────────────────────────────────
  const topRentPerUnit = deal.topRentPerUnit && deal.topRentPerUnit !== '0'
    ? `$${parseFloat(deal.topRentPerUnit).toFixed(0)}/unit`
    : null;
  const avgRentPerUnit = deal.avgRentPerUnit && deal.avgRentPerUnit !== '0'
    ? `$${parseFloat(deal.avgRentPerUnit).toFixed(0)}/unit`
    : null;
  const topRentPSF = deal.topRentPSF && deal.topRentPSF !== '0'
    ? `$${parseFloat(deal.topRentPSF).toFixed(2)}/SF`
    : null;
  const avgRentPSF = deal.avgRentPSF && deal.avgRentPSF !== '0'
    ? `$${parseFloat(deal.avgRentPSF).toFixed(2)}/SF`
    : null;
  const compCount = deal.comparableCount ? `${deal.comparableCount}` : null;


  // ── QCT / OZ / DDA badges ─────────────────────────────────────────────────
  const badgeStyle = (bg: string, color: string) =>
    `display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${bg};color:${color};`;

  const qctBadge = deal.qctStatus === 'YES'
    ? `<span style="${badgeStyle('#fef9c3','#854d0e')}">QCT</span>`
    : '';

  const ozBadge = deal.ozStatus === 'YES'
    ? `<span style="${badgeStyle('#ede9fe','#5b21b6')}">Opportunity Zone</span>`
    : '';

  const ddaLabel = deal.ddaStatus === 'MDDA' ? 'Metro DDA'
    : deal.ddaStatus === 'NMDDA' ? 'Non-Metro DDA'
    : '';
  const ddaBadge = ddaLabel
    ? `<span style="${badgeStyle('#fce7f3','#9d174d')}">${ddaLabel}</span>`
    : '';

  const nmtcBadge = deal.nmtcStatus === 'YES'
    ? `<span style="${badgeStyle('#ecfdf5','#065f46')}">NMTC</span>`
    : '';

  const badges = [qctBadge, ozBadge, ddaBadge, nmtcBadge].filter(Boolean).join(' ');
  const badgesBlock = badges
    ? `<div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${badges}</div>`
    : '';

  // ── DDA details row ────────────────────────────────────────────────────────
  const ddaDetails = ddaLabel && (deal.ddaVlil || deal.ddaFmr || deal.ddaLihtcMaxRent)
    ? [
        deal.ddaVlil ? `VLIL: $${parseInt(deal.ddaVlil).toLocaleString()}` : '',
        deal.ddaFmr ? `FMR: $${parseInt(deal.ddaFmr).toLocaleString()}/mo` : '',
        deal.ddaLihtcMaxRent ? `Max LIHTC Rent: $${parseInt(deal.ddaLihtcMaxRent).toLocaleString()}/mo` : '',
      ].filter(Boolean).join(' · ')
    : null;

  // ── Comparable properties table ────────────────────────────────────────────
  let compsTable = '';
  if (deal.comparablesJson) {
    const comps: any[] = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
    if (comps.length > 0) {
      const fmtVacancy = (c: any): string => {
        const v = c.vacancy_rate ?? c.vacancy ?? c.vacancyRate;
        if (v == null) return '—';
        const n = parseFloat(v);
        return isNaN(n) ? '—' : `${n.toFixed(1)}%`;
      };
      const fmtUnitMix = (c: any): string => {
        const mix: any[] = Array.isArray(c.unit_mix) ? c.unit_mix
          : Array.isArray(c.unitMix) ? c.unitMix : [];
        if (!mix.length) return '';
        return mix.map(m => {
          const type = m.type || m.bed_type || '';
          const cnt  = m.units != null ? m.units : (m.count ?? '');
          const rent = m.avg_rent != null ? `$${parseInt(m.avg_rent).toLocaleString()}` : (m.rent != null ? `$${parseInt(m.rent).toLocaleString()}` : '');
          return [type, cnt ? `${cnt}u` : '', rent].filter(Boolean).join(' ');
        }).join(' | ');
      };

      const compRows = comps.slice(0, 10).map((c: any, i: number) => {
        const name = c.name || c.property_name || `Comp ${i + 1}`;
        const addrParts = [c.address, c.city, c.state].filter(Boolean);
        const compAddr = addrParts.length ? addrParts.join(', ') : '';
        const compVintage = c.vintage || c.year_built || '—';
        const compUnits = c.units || c.unit_count || '—';
        const dist = c.distance_miles != null ? `${parseFloat(c.distance_miles).toFixed(1)} mi`
          : (c.distance != null ? `${parseFloat(c.distance).toFixed(1)} mi` : '—');
        const rentPsfVal = c.rent_psf != null ? `$${parseFloat(c.rent_psf).toFixed(2)}`
          : (c.rentPsf != null ? `$${parseFloat(c.rentPsf).toFixed(2)}` : '—');
        const rentUnit = c.rent_per_unit != null ? `$${parseInt(c.rent_per_unit).toLocaleString()}`
          : (c.rentPerUnit != null ? `$${parseInt(c.rentPerUnit).toLocaleString()}` : '—');
        const vacancy = fmtVacancy(c);
        const owner = c.ownership || c.owner || '—';
        const unitMix = fmtUnitMix(c);
        const bg = i % 2 === 0 ? '#fff' : '#f9fafb';
        return `<tr style="background:${bg};">
          <td style="padding:7px 8px;font-size:12px;color:#111827;border-bottom:1px solid #f3f4f6;">
            <span style="font-weight:600;">${name}</span>
            ${compAddr ? `<br><span style="font-size:10px;color:#6b7280;">${compAddr}</span>` : ''}
            ${unitMix ? `<br><span style="font-size:10px;color:#9ab8c4;">${unitMix}</span>` : ''}
          </td>
          <td style="padding:7px 8px;font-size:12px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${compVintage}</td>
          <td style="padding:7px 8px;font-size:12px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${compUnits}</td>
          <td style="padding:7px 8px;font-size:12px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${dist}</td>
          <td style="padding:7px 8px;font-size:12px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${vacancy}</td>
          <td style="padding:7px 8px;font-size:12px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">${rentPsfVal}</td>
          <td style="padding:7px 8px;font-size:12px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">${rentUnit}</td>
          <td style="padding:7px 8px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${owner}</td>
        </tr>`;
      }).join('');
      compsTable = `
        <div style="margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#07172A;text-transform:uppercase;letter-spacing:0.05em;">Comparable Properties (${comps.length})</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#07172A;">
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:left;font-weight:600;">Property / Address / Unit Mix</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:center;font-weight:600;">Vintage</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:center;font-weight:600;">Units</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:center;font-weight:600;">Distance</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:center;font-weight:600;">Vacancy</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:right;font-weight:600;">Rent PSF</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:right;font-weight:600;">Rent/Unit</th>
                <th style="padding:8px;font-size:11px;color:#9ab8c4;text-align:left;font-weight:600;">Owner</th>
              </tr>
            </thead>
            <tbody>${compRows}</tbody>
          </table>
        </div>`;
    }
  }

  // ── Buy box match reasons ──────────────────────────────────────────────────
  const matchReasons: string[] = [];
  if (dev.targetStates?.length && deal.state) {
    matchReasons.push(`<strong>Location:</strong> ${deal.state} is in your target market${dev.targetStates.length > 1 ? 's' : ''} (${dev.targetStates.join(', ')})`);
  }
  if (dev.productTypes?.length && dealProductTypes.length) {
    const matched = dev.productTypes.filter((pt: string) =>
      dealProductTypes.some((dt: string) =>
        dt.toLowerCase().includes(pt.toLowerCase().split(' ')[0]) ||
        pt.toLowerCase().includes(dt.toLowerCase().split(' ')[0])
      )
    );
    if (matched.length) {
      matchReasons.push(`<strong>Product Type:</strong> ${matched.join(', ')} aligns with your buy box`);
    }
  }
  if (dev.minAcres && deal.sizeAcres) {
    matchReasons.push(`<strong>Acreage:</strong> ${parseFloat(deal.sizeAcres).toFixed(2)} ac meets your minimum of ${parseFloat(dev.minAcres).toFixed(2)} ac`);
  }
  if (dev.minUnits && deal.estimatedUnits) {
    matchReasons.push(`<strong>Units:</strong> ${deal.estimatedUnits} units meets your minimum of ${dev.minUnits}`);
  }
  if (dev.maxAskingPricePerAcre && deal.askingPrice && deal.sizeAcres && parseFloat(deal.sizeAcres) > 0) {
    const ppa = parseFloat(deal.askingPrice) / parseFloat(deal.sizeAcres);
    matchReasons.push(`<strong>Price/Acre:</strong> $${Math.round(ppa).toLocaleString()}/ac is within your ceiling of $${parseInt(dev.maxAskingPricePerAcre).toLocaleString()}/ac`);
  }
  if (dev.qctInterest && deal.qctStatus === 'YES') {
    matchReasons.push(`<strong>QCT:</strong> Property is in a Qualified Census Tract — matches your affordable housing interest`);
  }

  const matchBlock = matchReasons.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 22px;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.12em;">Why This Matches Your Buy Box</p>
            ${matchReasons.map(r => `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:7px;">
              <tr>
                <td style="width:18px;vertical-align:top;padding-top:1px;font-size:14px;color:#22c55e;font-weight:700;">&#10003;</td>
                <td style="font-size:13px;color:#374151;line-height:1.55;">${r}</td>
              </tr>
            </table>`).join('')}
          </td>
        </tr>
      </table>`
    : '';

  // ── Helpers ────────────────────────────────────────────────────────────────
  const row = (label: string, value: string | null, highlight = false) =>
    value
      ? `<tr>
          <td style="padding:9px 0;font-size:12.5px;color:#64748b;width:45%;vertical-align:top;border-bottom:1px solid #f1f5f9;">${label}</td>
          <td style="padding:9px 0;font-size:12.5px;color:${highlight ? '#d97706' : '#07172A'};font-weight:${highlight ? '700' : '600'};border-bottom:1px solid #f1f5f9;">${value}</td>
        </tr>`
      : '';

  const sectionHeader = (label: string) =>
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;margin-bottom:12px;">
      <tr><td style="background:#07172A;padding:8px 14px;border-radius:5px;">
        <span style="font-size:10px;font-weight:700;color:#9ab8c4;text-transform:uppercase;letter-spacing:0.12em;">${label}</span>
      </td></tr>
    </table>`;

  const appDomain = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'https://catalyst.landlinq.ai';
  const logoUrl = `${appDomain}/attached_assets/Add_a_heading_1762187075044-G_X48reO_1767659017155.png`;

  // ── Action buttons ─────────────────────────────────────────────────────────
  const excelBtn = deal.excelModelUrl
    ? `<a href="${deal.excelModelUrl}" style="display:inline-block;background:#166534;color:#fff;font-size:12px;font-weight:700;padding:11px 22px;border-radius:7px;text-decoration:none;margin-right:10px;margin-bottom:8px;letter-spacing:0.02em;">View Underwriting Model</a>`
    : '';
  const memoBtn = deal.investmentMemoUrl
    ? `<a href="${deal.investmentMemoUrl}" style="display:inline-block;background:#07172A;color:#fff;font-size:12px;font-weight:700;padding:11px 22px;border-radius:7px;text-decoration:none;margin-bottom:8px;letter-spacing:0.02em;">Investment Memo (PDF)</a>`
    : '';
  const buttonsBlock = (excelBtn || memoBtn)
    ? `<div style="margin-bottom:24px;">${excelBtn}${memoBtn}</div>`
    : '';

  // ── Demographics ───────────────────────────────────────────────────────────
  const hasDemo = deal.censusMedianIncome || deal.censusTotalPopulation || deal.censusRenterRate || deal.censusMedianAge;
  const demoSection = hasDemo
    ? `${sectionHeader('Market Demographics')}
       <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
         ${deal.censusMedianIncome ? row('Median HH Income', `$${parseInt(deal.censusMedianIncome).toLocaleString()}`) : ''}
         ${deal.censusTotalPopulation ? row('Total Population', parseInt(deal.censusTotalPopulation).toLocaleString()) : ''}
         ${deal.censusRenterRate ? row('Renter Rate', `${parseFloat(deal.censusRenterRate).toFixed(1)}%`) : ''}
         ${deal.censusMedianAge ? row('Median Age', `${parseFloat(deal.censusMedianAge).toFixed(1)} yrs`) : ''}
       </table>`
    : '';

  // ── AI classification notes ────────────────────────────────────────────────
  const classificationNotes = deal.aiExplanatoryNotes
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
        <tr><td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:14px 18px;">
          <p style="margin:0 0 5px;font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.12em;">AI Classification Notes</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.65;white-space:pre-wrap;">${deal.aiExplanatoryNotes}</p>
        </td></tr>
      </table>`
    : '';

  // ── Summary block ──────────────────────────────────────────────────────────
  const summaryBlock = summaryText
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
        <tr><td style="background:#f0fdfe;border-left:4px solid #009BA7;border-radius:0 6px 6px 0;padding:14px 18px;">
          <p style="margin:0 0 5px;font-size:10px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.12em;">Deal Summary</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.65;white-space:pre-wrap;">${summaryText}</p>
        </td></tr>
      </table>`
    : '';

  // ── Wetland / environmental block ─────────────────────────────────────────
  const wetlandBlock = wetlandText
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
        <tr><td style="background:#f0fdfa;border-left:4px solid #0d9488;border-radius:0 6px 6px 0;padding:14px 18px;">
          <p style="margin:0 0 5px;font-size:10px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.12em;">Wetland / Environmental Notes</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.65;white-space:pre-wrap;">${wetlandText}</p>
        </td></tr>
      </table>`
    : '';

  // ── Property image gallery ────────────────────────────────────────────────
  const imageGallery = dealImageUrls.length
    ? `${sectionHeader('Property Images')}
       <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
         <tr>
           ${dealImageUrls.slice(0, 3).map(url => `<td style="padding:0 4px;width:33%;">
             <img src="${url}" alt="Property photo" style="width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;display:block;" />
           </td>`).join('')}
         </tr>
         ${dealImageUrls.length > 3 ? `<tr style="padding-top:6px;">
           ${dealImageUrls.slice(3, 6).map(url => `<td style="padding:6px 4px 0;width:33%;">
             <img src="${url}" alt="Property photo" style="width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;display:block;" />
           </td>`).join('')}
         </tr>` : ''}
       </table>`
    : '';

  // ── Classification badge ───────────────────────────────────────────────────
  const classLabel = deal.classification === 'green' ? 'High Priority'
    : deal.classification === 'yellow' ? 'Potential'
    : deal.classification || '';
  const classBadgeBg  = deal.classification === 'green' ? '#22c55e' : deal.classification === 'yellow' ? '#f59e0b' : '#94a3b8';
  const classBadge = classLabel
    ? `<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:10.5px;font-weight:700;background:${classBadgeBg};color:#ffffff;letter-spacing:0.07em;">${classLabel.toUpperCase()}</span>`
    : '';

  // Build key metric cards (price, acreage, units, YOC)
  const metricCards = [
    price      ? { label: 'Asking Price',  value: price,      accent: '#009BA7' } : null,
    size       ? { label: 'Acreage',       value: size,       accent: '#009BA7' } : null,
    units      ? { label: 'Est. Units',    value: units,      accent: '#009BA7' } : null,
    yocDisplay ? { label: 'Yield on Cost', value: yocDisplay, accent: '#d97706' } : null,
  ].filter(Boolean) as { label: string; value: string; accent: string }[];

  const rentCards = [
    topRentPerUnit ? { label: 'Top Rent / Unit', value: topRentPerUnit } : null,
    avgRentPerUnit ? { label: 'Avg Rent / Unit', value: avgRentPerUnit } : null,
    topRentPSF     ? { label: 'Top Rent PSF',    value: topRentPSF    } : null,
    avgRentPSF     ? { label: 'Avg Rent PSF',    value: avgRentPSF    } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const cardWidth = (n: number) => `${Math.floor(100 / n)}%`;
  const makeMetricCard = (label: string, value: string, accent: string, idx: number, total: number) =>
    `<td width="${cardWidth(total)}" style="padding:0 ${idx < total - 1 ? '5px' : '0'} 0 ${idx > 0 ? '5px' : '0'};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid ${accent};border-radius:0 0 8px 8px;padding:14px 10px;text-align:center;">
          <span style="display:block;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${label}</span>
          <span style="display:block;margin-top:7px;font-size:17px;font-weight:700;color:#07172A;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${value}</span>
        </td>
      </tr></table>
    </td>`;
  const makeRentCard = (label: string, value: string, idx: number, total: number) =>
    `<td width="${cardWidth(total)}" style="padding:0 ${idx < total - 1 ? '5px' : '0'} 0 ${idx > 0 ? '5px' : '0'};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#f0fdfe;border:1px solid #a5f3fb;border-top:3px solid #009BA7;border-radius:0 0 8px 8px;padding:12px 10px;text-align:center;">
          <span style="display:block;font-size:9px;color:#0e7490;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${label}</span>
          <span style="display:block;margin-top:6px;font-size:16px;font-weight:700;color:#07172A;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${value}</span>
        </td>
      </tr></table>
    </td>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#e8edf3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8edf3;padding:28px 12px;">
<tr><td align="center">
<table width="660" cellpadding="0" cellspacing="0" style="max-width:660px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,0.14);">

  <!-- ═══ HEADER ═══ -->
  <tr>
    <td style="background:#07172A;padding:28px 36px 24px;">
      <img src="${logoUrl}" alt="Catalyst Capital Partners" style="height:38px;width:auto;display:block;margin-bottom:18px;" />
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#009BA7;text-transform:uppercase;letter-spacing:0.16em;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Exclusive Acquisition Opportunity</p>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${addr}</h1>
            <p style="margin:0;font-size:13px;color:#9ab8c4;line-height:1.5;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${[locationLine, productTypesDisplay].filter(Boolean).join(' &nbsp;&bull;&nbsp; ')}</p>
          </td>
          ${classBadge ? `<td style="text-align:right;vertical-align:top;white-space:nowrap;padding-left:16px;padding-top:6px;">${classBadge}</td>` : ''}
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ PROGRAM BADGES BAR ═══ -->
  ${badges ? `<tr>
    <td style="background:#0a1e33;padding:10px 36px;border-top:1px solid rgba(255,255,255,0.07);">
      <span style="font-size:9.5px;font-weight:700;color:#4e7a93;text-transform:uppercase;letter-spacing:0.12em;margin-right:10px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Programs:</span>
      ${badges}
    </td>
  </tr>` : ''}

  <!-- ═══ BODY ═══ -->
  <tr>
    <td style="background:#ffffff;padding:32px 36px;">

      <!-- KEY METRIC CARDS -->
      ${metricCards.length ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>${metricCards.map((m, i) => makeMetricCard(m.label, m.value, m.accent, i, metricCards.length)).join('')}</tr>
      </table>` : ''}

      <!-- WHY THIS MATCHES YOUR BUY BOX -->
      ${matchBlock}

      <!-- ACTION BUTTONS -->
      ${buttonsBlock}

      <!-- PROPERTY DETAILS -->
      ${sectionHeader('Property Details')}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
        ${row('Acreage', size)}
        ${row('Asking Price', price)}
        ${row('Price / Acre', pricePerAcre)}
        ${row('Est. Units', units)}
        ${row('Year Built (Vintage)', vintage)}
        ${row('Zoning', zoningDisplay)}
        ${row('Yield on Cost (YOC)', yocDisplay, true)}
        ${row('Deal Type', deal.dealType ? deal.dealType.charAt(0).toUpperCase() + deal.dealType.slice(1) : null)}
        ${row('Under Contract', deal.underContract ? 'Yes' : null)}
      </table>

      <!-- PROPERTY IMAGES -->
      ${imageGallery}

      <!-- MARKET RENT COMPS SUMMARY -->
      ${rentCards.length ? `
      ${sectionHeader('Market Rent Comps')}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>${rentCards.map((m, i) => makeRentCard(m.label, m.value, i, rentCards.length)).join('')}</tr>
      </table>
      ` : ''}

      <!-- COMPARABLE PROPERTIES TABLE -->
      ${compsTable}

      <!-- AFFORDABLE HOUSING DETAILS -->
      ${ddaDetails ? `
      ${sectionHeader('Affordable Housing Details')}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
        ${row('DDA Status', ddaLabel || null)}
        ${deal.ddaAreaName ? row('HUD Area', deal.ddaAreaName) : ''}
        ${deal.ddaVlil ? row('Very Low Income Limit (4-Person)', `$${parseInt(deal.ddaVlil).toLocaleString()}`) : ''}
        ${deal.ddaFmr ? row('Fair Market Rent (2-BR)', `$${parseInt(deal.ddaFmr).toLocaleString()}/mo`) : ''}
        ${deal.ddaLihtcMaxRent ? row('Max LIHTC Rent', `$${parseInt(deal.ddaLihtcMaxRent).toLocaleString()}/mo`) : ''}
      </table>` : ''}

      <!-- MARKET DEMOGRAPHICS -->
      ${demoSection}

      <!-- AI CLASSIFICATION NOTES -->
      ${classificationNotes}

      <!-- DEAL SUMMARY -->
      ${summaryBlock}

      <!-- WETLAND / ENVIRONMENTAL NOTES -->
      ${wetlandBlock}

      <!-- DIVIDER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 22px;">
        <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
      </table>

      <!-- CTA SECTION -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:10px;padding:24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#07172A;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Interested in this opportunity?</p>
            <p style="margin:0 0 18px;font-size:13px;color:#64748b;line-height:1.5;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Our acquisitions team is available to discuss this deal in detail and coordinate site visits.</p>
            <a href="mailto:deals@landlinq.ai" style="display:inline-block;background:#009BA7;color:#ffffff;font-size:13px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.04em;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Contact Acquisitions Team</a>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="background:#07172A;padding:20px 36px;text-align:center;">
      <p style="margin:0 0 5px;font-size:11.5px;font-weight:700;color:#9ab8c4;letter-spacing:0.06em;text-transform:uppercase;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Catalyst Capital Partners</p>
      <p style="margin:0 0 5px;font-size:10.5px;color:#475569;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">1600 Camden Road Suite 200 &nbsp;&bull;&nbsp; Charlotte, NC 28203</p>
      <p style="margin:0;font-size:10.5px;color:#475569;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;"><a href="mailto:deals@landlinq.ai" style="color:#009BA7;text-decoration:none;">deals@landlinq.ai</a> &nbsp;&bull;&nbsp; Powered by LandLinq&#8482;</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // ── Plain-text fallback ────────────────────────────────────────────────────
  const textMatchLines = matchReasons.map(r => r.replace(/<[^>]+>/g, ''));

  const hasPropertyDetails = !!(size || price || pricePerAcre || units || vintage || zoningDisplay || yocDisplay || deal.dealType || deal.underContract);
  const hasRentComps = !!(topRentPerUnit || avgRentPerUnit || topRentPSF || avgRentPSF || compCount);
  const hasAffordableHousing = !!(deal.qctStatus === 'YES' || deal.ozStatus === 'YES' || (deal.ddaStatus && deal.ddaStatus !== 'NO'));

  const textLines = [
    `NEW DEAL OPPORTUNITY${classLabel ? ` — ${classLabel}` : ''}`,
    `${addr}`,
    locationLine ? `Location: ${locationLine}` : '',
    productTypesDisplay ? `Product Type: ${productTypesDisplay}` : '',
    '',
    matchReasons.length ? 'WHY THIS MATCHES YOUR BUY BOX:' : '',
    ...textMatchLines,
    matchReasons.length ? '' : '',

    hasPropertyDetails ? '--- PROPERTY DETAILS ---' : '',
    size ? `Acreage: ${size}` : '',
    price ? `Asking Price: ${price}` : '',
    pricePerAcre ? `Price/Acre: ${pricePerAcre}` : '',
    units ? `Est. Units: ${units}` : '',
    vintage ? `Vintage: ${vintage}` : '',
    zoningDisplay ? `Zoning: ${zoningDisplay}` : '',
    yocDisplay ? `Yield on Cost (YOC): ${yocDisplay}` : '',
    deal.dealType ? `Deal Type: ${deal.dealType}` : '',
    deal.underContract ? 'Under Contract: Yes' : '',
    hasPropertyDetails ? '' : '',

    hasRentComps ? '--- MARKET RENT COMPS ---' : '',
    topRentPerUnit ? `Top Rent/Unit: ${topRentPerUnit}` : '',
    avgRentPerUnit ? `Avg Rent/Unit: ${avgRentPerUnit}` : '',
    topRentPSF ? `Top Rent PSF: ${topRentPSF}` : '',
    avgRentPSF ? `Avg Rent PSF: ${avgRentPSF}` : '',
    compCount ? `Number of Comps: ${compCount}` : '',
    hasRentComps ? '' : '',

    hasAffordableHousing ? '--- AFFORDABLE HOUSING STATUS ---' : '',
    deal.qctStatus === 'YES' ? 'QCT: Yes' : '',
    deal.ozStatus === 'YES' ? 'Opportunity Zone: Yes' : '',
    (deal.ddaStatus && deal.ddaStatus !== 'NO') ? `DDA: ${deal.ddaStatus}` : '',
    ddaDetails ? ddaDetails : '',
    hasAffordableHousing ? '' : '',

    hasDemo ? '--- MARKET DEMOGRAPHICS ---' : '',
    deal.censusMedianIncome ? `Median HH Income: $${parseInt(deal.censusMedianIncome).toLocaleString()}` : '',
    deal.censusTotalPopulation ? `Total Population: ${parseInt(deal.censusTotalPopulation).toLocaleString()}` : '',
    deal.censusRenterRate ? `Renter Rate: ${parseFloat(deal.censusRenterRate).toFixed(1)}%` : '',
    deal.censusMedianAge ? `Median Age: ${parseFloat(deal.censusMedianAge).toFixed(1)} yrs` : '',
    hasDemo ? '' : '',

    deal.aiExplanatoryNotes ? `CLASSIFICATION NOTES:\n${deal.aiExplanatoryNotes}\n` : '',
    summaryText ? `DEAL SUMMARY:\n${summaryText}\n` : '',
    wetlandText ? `WETLAND / ENVIRONMENTAL NOTES:\n${wetlandText}\n` : '',

    deal.excelModelUrl ? `Underwriting: ${deal.excelModelUrl}` : '',
    deal.investmentMemoUrl ? `Investment Memo (PDF): ${deal.investmentMemoUrl}` : '',
    '',
    'Contact: deals@landlinq.ai',
  ].filter(s => s !== undefined && s !== null && s !== '').join('\n');

  // ── Generate IC Memo PDF attachment ────────────────────────────────────────
  let pdfAttachment: import('./types').EmailAttachment | null = null;
  try {
    pdfAttachment = await generateICMemoPDF({ deal, dev, addr, size, price, pricePerAcre, units, vintage, zoningDisplay, yocDisplay, topRentPerUnit, avgRentPerUnit, topRentPSF, avgRentPSF, classLabel, ddaDetails });
  } catch (pdfErr) {
    console.error('⚠️ [DEV-EMAIL] IC Memo PDF generation failed (email will still send):', pdfErr);
  }

  await sendNotificationEmail({
    to: dev.email,
    subject: `New Deal Opportunity: ${addr}`,
    html,
    text: textLines,
    fromEmail: 'deals@landlinq.ai',
    fromName: 'Catalyst Acquisitions',
    type: 'developer-deal',
    ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
  });
}

// ── IC Memo PDF generator ───────────────────────────────────────────────────

async function generateICMemoPDF(ctx: {
  deal: any;
  dev: any;
  addr: string;
  size: string | null;
  price: string | null;
  pricePerAcre: string | null;
  units: string | null;
  vintage: string | null;
  zoningDisplay: string | null;
  yocDisplay: string | null;
  topRentPerUnit: string | null;
  avgRentPerUnit: string | null;
  topRentPSF: string | null;
  avgRentPSF: string | null;
  classLabel: string;
  ddaDetails: string | null;
}): Promise<import('./types').EmailAttachment> {
  const PDFDocument = (await import('pdfkit')).default;
  const { deal, addr, size, price, pricePerAcre, units, vintage, zoningDisplay, yocDisplay, topRentPerUnit, avgRentPerUnit, topRentPSF, avgRentPSF, classLabel, ddaDetails } = ctx;

  const doc = new PDFDocument({ size: 'LETTER', margin: 50, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const endPromise = new Promise<void>(resolve => doc.on('end', resolve));

  const NAVY = '#07172A';
  const TEAL = '#009BA7';
  const GRAY = '#374151';
  const LGRAY = '#6b7280';
  const WIDTH = doc.page.width - 100; // page width minus margins

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.rect(50, 50, doc.page.width - 100, 70).fill(NAVY);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
    .text('IC MEMO', 70, 68, { width: WIDTH - 100 });
  doc.font('Helvetica').fontSize(11)
    .text(addr, 70, 92, { width: WIDTH - 100 });
  if (classLabel) {
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(10)
      .text(classLabel.toUpperCase(), doc.page.width - 200, 75, { width: 140, align: 'right' });
  }
  doc.moveDown(0.5);
  doc.y = 140;

  // ── Helper: two-column row ─────────────────────────────────────────────────
  const infoRow = (label: string, value: string) => {
    const startY = doc.y;
    doc.fillColor(LGRAY).font('Helvetica').fontSize(9).text(label, 50, startY, { width: 160 });
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(9).text(value, 215, startY, { width: WIDTH - 165 });
    doc.y = startY + 16;
  };

  const sectionTitle = (title: string) => {
    doc.y += 8;
    doc.rect(50, doc.y, WIDTH, 18).fill('#f3f4f6');
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
      .text(title.toUpperCase(), 55, doc.y + 5, { width: WIDTH - 10 });
    doc.y += 24;
  };

  // ── Property Details ────────────────────────────────────────────────────────
  sectionTitle('Property Details');
  if (deal.state || deal.county || deal.msaName) {
    const loc = [deal.city, deal.county ? `${deal.county} County` : null, deal.state, deal.msaName ? `(${deal.msaName} MSA)` : null].filter(Boolean).join(', ');
    if (loc) infoRow('Location', loc);
  }
  if (size) infoRow('Acreage', size);
  if (price) infoRow('Asking Price', price);
  if (pricePerAcre) infoRow('Price / Acre', pricePerAcre);
  if (units) infoRow('Est. Units', units);
  if (vintage) infoRow('Vintage', vintage);
  if (zoningDisplay) infoRow('Zoning', zoningDisplay);
  if (yocDisplay) infoRow('Yield on Cost (YOC)', yocDisplay);
  if (deal.dealType) infoRow('Deal Type', deal.dealType);
  if (deal.underContract) infoRow('Under Contract', 'Yes');

  const productTypes: string[] = Array.isArray(deal.productTypes) ? deal.productTypes
    : (deal.productTypes ? [deal.productTypes] : []);
  if (productTypes.length) infoRow('Product Type', productTypes.join(', '));

  // ── Affordable Housing Status ───────────────────────────────────────────────
  const isQct = deal.qctStatus === 'YES';
  const isOz  = deal.ozStatus === 'YES';
  const isDda = deal.ddaStatus && deal.ddaStatus !== 'NO';
  if (isQct || isOz || isDda) {
    sectionTitle('Affordable Housing Status');
    if (isQct) infoRow('QCT', 'Yes — Qualified Census Tract');
    if (isOz)  infoRow('Opportunity Zone', 'Yes');
    if (isDda) infoRow('DDA', deal.ddaStatus);
    if (ddaDetails) infoRow('DDA Details', ddaDetails);
  }

  // ── Market Rent Comps ───────────────────────────────────────────────────────
  const hasRent = !!(topRentPerUnit || avgRentPerUnit || topRentPSF || avgRentPSF);
  if (hasRent) {
    sectionTitle('Market Rent Comps Summary');
    if (topRentPerUnit) infoRow('Top Rent / Unit', topRentPerUnit);
    if (avgRentPerUnit) infoRow('Avg Rent / Unit', avgRentPerUnit);
    if (topRentPSF)     infoRow('Top Rent PSF', topRentPSF);
    if (avgRentPSF)     infoRow('Avg Rent PSF', avgRentPSF);
  }

  // ── Comparable Properties Table ─────────────────────────────────────────────
  const comps: any[] = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
  if (comps.length > 0) {
    sectionTitle(`Comparable Properties (${comps.length})`);

    const colWidths = [160, 38, 36, 44, 44, 46, 42];
    const headers   = ['Property / Address', 'Yr', 'Units', 'Dist', 'Vacancy', 'Rent/U', 'PSF'];
    let cx = 50;

    // Table header
    doc.rect(50, doc.y, WIDTH, 16).fill(NAVY);
    headers.forEach((h, hi) => {
      doc.fillColor('#9ab8c4').font('Helvetica-Bold').fontSize(7.5)
        .text(h, cx + 2, doc.y - 14, { width: colWidths[hi] - 2, align: hi > 0 ? 'center' : 'left' });
      cx += colWidths[hi];
    });
    doc.y += 4;

    comps.slice(0, 10).forEach((c: any, ci: number) => {
      if (doc.y > 680) { doc.addPage(); }
      const rowY = doc.y;
      const rowBg = ci % 2 === 0 ? '#ffffff' : '#f9fafb';
      const rowH = 28;
      doc.rect(50, rowY, WIDTH, rowH).fill(rowBg);

      const name = (c.name || c.property_name || `Comp ${ci + 1}`).substring(0, 35);
      const addr2 = [c.address, c.city, c.state].filter(Boolean).join(', ').substring(0, 40);
      const yr    = String(c.vintage || c.year_built || '—');
      const u     = String(c.units || c.unit_count || '—');
      const dist  = c.distance_miles != null ? `${parseFloat(c.distance_miles).toFixed(1)}mi`
        : (c.distance != null ? `${parseFloat(c.distance).toFixed(1)}mi` : '—');
      const vac   = (() => { const v = c.vacancy_rate ?? c.vacancy ?? c.vacancyRate; return v != null && !isNaN(parseFloat(v)) ? `${parseFloat(v).toFixed(1)}%` : '—'; })();
      const ru    = c.rent_per_unit != null ? `$${parseInt(c.rent_per_unit).toLocaleString()}`
        : (c.rentPerUnit != null ? `$${parseInt(c.rentPerUnit).toLocaleString()}` : '—');
      const psf   = c.rent_psf != null ? `$${parseFloat(c.rent_psf).toFixed(2)}`
        : (c.rentPsf != null ? `$${parseFloat(c.rentPsf).toFixed(2)}` : '—');

      const cells = [null, yr, u, dist, vac, ru, psf];
      cx = 50;
      cells.forEach((cell, ci2) => {
        if (ci2 === 0) {
          doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(7.5).text(name, cx + 2, rowY + 4, { width: colWidths[0] - 4 });
          if (addr2) doc.fillColor(LGRAY).font('Helvetica').fontSize(6.5).text(addr2, cx + 2, rowY + 14, { width: colWidths[0] - 4 });
        } else if (cell) {
          doc.fillColor(GRAY).font('Helvetica').fontSize(7.5).text(cell, cx + 2, rowY + 9, { width: colWidths[ci2] - 4, align: 'center' });
        }
        cx += colWidths[ci2];
      });
      doc.y = rowY + rowH;
    });
  }

  // ── Market Demographics ─────────────────────────────────────────────────────
  const hasDemo = !!(deal.censusMedianIncome || deal.censusTotalPopulation || deal.censusRenterRate || deal.censusMedianAge);
  if (hasDemo) {
    if (doc.y > 620) doc.addPage();
    sectionTitle('Market Demographics');
    if (deal.censusMedianIncome)    infoRow('Median HH Income', `$${parseInt(deal.censusMedianIncome).toLocaleString()}`);
    if (deal.censusTotalPopulation) infoRow('Total Population', parseInt(deal.censusTotalPopulation).toLocaleString());
    if (deal.censusRenterRate)      infoRow('Renter Rate', `${parseFloat(deal.censusRenterRate).toFixed(1)}%`);
    if (deal.censusMedianAge)       infoRow('Median Age', `${parseFloat(deal.censusMedianAge).toFixed(1)} yrs`);
  }

  // ── Classification Notes ────────────────────────────────────────────────────
  if (deal.aiExplanatoryNotes) {
    if (doc.y > 620) doc.addPage();
    sectionTitle('Classification Notes');
    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
      .text(deal.aiExplanatoryNotes, 50, doc.y, { width: WIDTH, lineGap: 2 });
    doc.y += 8;
  }

  // ── Deal Summary ────────────────────────────────────────────────────────────
  const summary = deal.developerSummary || deal.aiSummary;
  if (summary) {
    if (doc.y > 640) doc.addPage();
    sectionTitle('Deal Summary');
    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
      .text(summary, 50, doc.y, { width: WIDTH, lineGap: 2 });
    doc.y += 8;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageCount = (doc as any).bufferedPageRange?.()?.count ?? 1;
  doc.rect(50, doc.page.height - 60, WIDTH, 30).fill(NAVY);
  doc.fillColor('#9ab8c4').font('Helvetica').fontSize(8)
    .text(`Catalyst Capital Partners · deals@landlinq.ai · Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Page ${pageCount}`,
      55, doc.page.height - 49, { width: WIDTH - 10, align: 'center' });

  doc.end();
  await endPromise;

  const pdfBuffer = Buffer.concat(chunks);
  return {
    content: pdfBuffer.toString('base64'),
    filename: `IC_Memo_${addr.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment',
  };
}
