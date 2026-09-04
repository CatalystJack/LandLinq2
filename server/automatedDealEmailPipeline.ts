/**
 * Provider-neutral automation for one row that has already been parsed into
 * email_intake_queue.  Providers enqueue only; this module owns no webhook
 * assumptions and is consequently safe to reuse for Graph, SendGrid, etc.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './db.js';
import { GeocodioService } from './geocodioService.js';
import { HelloDataService } from './hellodataService.js';
import { classifyDealForProfile } from './developerClassificationService.js';
import {
  brokers, deals, developerProductTypes, developerProfiles, emailIntakeQueue, partnerDeveloperSends,
  type DeveloperProfile,
} from '../shared/schema.js';
import { parseForwardedChainIdentities, type OriginalLeadSource, type RoutingSender } from './aiEmailParser.js';

export const AUTOMATION_CONFIDENCE_THRESHOLD = 75;

export interface AutomationRouteProfile {
  id: string;
  companyName: string;
  profileType: string;
  isActive: boolean;
  knownEmailDomains: string[] | null;
  targetCounties: string[];
  targetStates: string[];
}
export interface LocationEvidence {
  county: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  zip: string | null;
}
export type AutomationOutcome = 'created' | 'duplicate' | 'manual';

/** Lowercase, de-duplicate and remove punctuation/@ from tenant domain lists. */
export function normalizeKnownEmailDomains(domains: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((domains || []).map(domain => String(domain).trim().toLowerCase()
    .replace(/^mailto:/, '').replace(/^@/, '').replace(/\.$/, '')).filter(domain => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))));
}

export function normalizeCounty(value: string | null | undefined): string {
  return String(value || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '').trim();
}
export function normalizeState(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}
export function normalizeAddress(value: string | null | undefined): string {
  return String(value || '').toLowerCase().replace(/\b(street)\b/g, 'st').replace(/\b(road)\b/g, 'rd')
    .replace(/\b(avenue)\b/g, 'ave').replace(/\b(drive)\b/g, 'dr').replace(/[^a-z0-9]/g, '');
}

/** Pure, deliberately conservative routing: a domain match never falls back to geography. */
export function routeProfile(
  profiles: readonly AutomationRouteProfile[],
  routingSender: RoutingSender,
  county: string | null | undefined,
  state: string | null | undefined,
): { profile: AutomationRouteProfile | null; reason: string } {
  const active = profiles.filter(p => p.isActive && p.profileType === 'real_estate');
  const domain = routingSender.email?.split('@')[1]?.toLowerCase() || '';
  const domainMatches = domain ? active.filter(p => normalizeKnownEmailDomains(p.knownEmailDomains).includes(domain)) : [];
  if (domainMatches.length === 1) return { profile: domainMatches[0], reason: 'sender_domain' };
  if (domainMatches.length > 1) return { profile: null, reason: 'ambiguous_sender_domain' };
  const normalizedCounty = normalizeCounty(county);
  const normalizedState = normalizeState(state);
  const geographicMatches = active.filter(p => normalizedCounty && normalizedState &&
    (p.targetCounties || []).some(c => normalizeCounty(c) === normalizedCounty) &&
    (p.targetStates || []).some(s => normalizeState(s) === normalizedState));
  return geographicMatches.length === 1
    ? { profile: geographicMatches[0], reason: 'county_state' }
    : { profile: null, reason: geographicMatches.length ? 'ambiguous_geography' : 'no_profile_match' };
}

export function extractCoordinates(text: string | null | undefined): { latitude: number; longitude: number } | null {
  const match = String(text || '').match(/(?:lat(?:itude)?\s*[:=,]?\s*)(-?\d{1,2}\.\d+)\D{1,24}(?:lng|lon|longitude)\s*[:=,]?\s*(-?\d{1,3}\.\d+)/i)
    || String(text || '').match(/\b(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})\b/);
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}
export function extractCountyState(text: string | null | undefined): { county: string | null; state: string | null } {
  const match = String(text || '').match(/\b([A-Za-z][A-Za-z .'-]{1,60}?)\s+County\s*,?\s+([A-Z]{2})\b/i);
  return { county: match?.[1]?.trim() || null, state: match?.[2]?.toUpperCase() || null };
}
export function extractStatedRent(text: string | null | undefined): number | null {
  const match = String(text || '').match(/(?:rent|lease)\D{0,30}\$\s*([\d,]+(?:\.\d+)?)(?:\s*\/\s*(?:mo|month))?/i);
  return match ? Number(match[1].replace(/,/g, '')) || null : null;
}
export function isCompleteConfidentIntake(input: {
  confidence: unknown; county: string | null; state: string | null; acres: unknown; price: unknown; rent: unknown;
}): boolean {
  const numeric = (value: unknown) => Number(value);
  return numeric(input.confidence) >= AUTOMATION_CONFIDENCE_THRESHOLD && !!input.county && !!input.state &&
    Number.isFinite(numeric(input.acres)) && numeric(input.acres) > 0 &&
    ((Number.isFinite(numeric(input.price)) && numeric(input.price) > 0) ||
      (Number.isFinite(numeric(input.rent)) && numeric(input.rent) > 0));
}
export function haversineMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (n: number) => n * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude), dLng = radians(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function findDuplicateDeal<T extends { address: string; latitude?: unknown; longitude?: unknown }>(
  candidates: readonly T[], address: string, coordinates: { latitude: number; longitude: number } | null,
): T | null {
  const exact = candidates.find(deal => normalizeAddress(deal.address) === normalizeAddress(address));
  if (exact) return exact;
  if (!coordinates) return null;
  return candidates.find(deal => {
    const latitude = Number(deal.latitude), longitude = Number(deal.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) &&
      haversineMiles(coordinates, { latitude, longitude }) <= 0.1;
  }) || null;
}

function sourceIsConfident(source: OriginalLeadSource | null): source is OriginalLeadSource & { email: string } {
  return !!source?.email && !/(noreply|no-reply|mailer|notification)@/i.test(source.email);
}
function names(name: string | null | undefined) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || 'Unknown', lastName: parts.slice(1).join(' ') || 'Broker' };
}

/** Process a single pending queue item. Manual outcomes remain durable pending items and are handled. */
export async function processAutomatedDealEmailIntake(intakeId: string): Promise<{ outcome: AutomationOutcome; handled: true; dealId?: string; reason: string }> {
  const [intake] = await db.select().from(emailIntakeQueue).where(eq(emailIntakeQueue.id, intakeId)).limit(1);
  if (!intake) throw new Error(`Email intake ${intakeId} was not found`);
  if (intake.status === 'approved' && intake.dealId) {
    return { outcome: 'duplicate', handled: true, dealId: intake.dealId, reason: 'already_processed' };
  }
  const identities = parseForwardedChainIdentities({ name: intake.fromName, email: intake.fromEmail }, intake.emailBody);
  const looksForwarded = /^(?:fw|fwd):|forwarded message|original message/i.test(
    `${intake.subject || ''}\n${intake.emailBody || ''}`,
  );
  const originalLeadSource = identities.originalLeadSource ||
    (!looksForwarded && identities.routingSender.email
      ? { ...identities.routingSender, fromForwardedChain: false }
      : null);
  const coordinates = extractCoordinates(intake.emailBody);
  let location: LocationEvidence = {
    county: extractCountyState(intake.emailBody).county, state: intake.parsedState || extractCountyState(intake.emailBody).state,
    latitude: coordinates?.latitude || null, longitude: coordinates?.longitude || null,
    address: intake.parsedAddress, city: intake.parsedCity, zip: intake.parsedZip,
  };
  // API calls intentionally happen before any write transaction (there is no long-held transaction here).
  const geocoder = new GeocodioService();
  if (coordinates) {
    const reverse = await geocoder.reverseGeocode(coordinates.latitude, coordinates.longitude);
    if (reverse.success) location = { ...location, county: reverse.county || location.county, state: reverse.state || location.state, city: reverse.city || location.city, zip: reverse.zipCode || location.zip };
  } else if (intake.parsedAddress) {
    const geo = await geocoder.geocodeAddress(intake.parsedAddress, [intake.parsedCity, intake.parsedState, intake.parsedZip].filter(Boolean).join(', '));
    if (geo.success) location = { ...location, county: geo.county || location.county, state: geo.state || location.state, city: geo.city || location.city, zip: geo.zipCode || location.zip, latitude: geo.lat || null, longitude: geo.lng || null };
  }
  const rent = extractStatedRent(intake.emailBody);
  const profiles = await db.select().from(developerProfiles).where(eq(developerProfiles.isActive, true));
  const route = routeProfile(profiles as AutomationRouteProfile[], identities.routingSender, location.county, location.state);
  const manual = async (reason: string) => {
    await db.update(emailIntakeQueue).set({ status: 'pending', reviewNotes: `Automation held: ${reason}` }).where(eq(emailIntakeQueue.id, intake.id));
    return { outcome: 'manual' as const, handled: true as const, reason };
  };
  if (!route.profile) return manual(route.reason);
  if (!isCompleteConfidentIntake({ confidence: intake.overallConfidence, county: location.county, state: location.state, acres: intake.parsedAcres, price: intake.parsedPrice, rent })) return manual('incomplete_or_low_confidence');
  if (!intake.parsedAddress) return manual('missing_address');
  const profile = route.profile;
  let broker: typeof brokers.$inferSelect | null = null;
  if (sourceIsConfident(originalLeadSource)) {
    const [ownedBroker] = await db.select().from(brokers).where(and(
      eq(brokers.email, originalLeadSource.email.toLowerCase()),
      eq(brokers.ownerDeveloperProfileId, profile.id),
    )).limit(1);
    const [sharedBroker] = ownedBroker ? [] : await db.select().from(brokers).where(and(
      eq(brokers.email, originalLeadSource.email.toLowerCase()),
      isNull(brokers.ownerDeveloperProfileId),
    )).limit(1);
    broker = ownedBroker || sharedBroker || (await db.insert(brokers).values({
      ...names(originalLeadSource.name || intake.parsedBrokerName),
      email: originalLeadSource.email.toLowerCase(),
      phone: intake.parsedBrokerPhone,
      company: originalLeadSource.company || null,
      ownerDeveloperProfileId: profile.id,
      isActive: true,
    }).returning())[0];
  }
  const profileDealRows = await db.select({ deal: deals }).from(deals).innerJoin(
    partnerDeveloperSends,
    and(
      eq(partnerDeveloperSends.dealId, deals.id),
      eq(partnerDeveloperSends.developerProfileId, profile.id),
    ),
  );
  const profileDeals = profileDealRows.map(row => row.deal);
  const duplicate = findDuplicateDeal(profileDeals, intake.parsedAddress, location.latitude !== null && location.longitude !== null ? { latitude: location.latitude, longitude: location.longitude } : null);
  if (duplicate) {
    await db.update(deals).set({
      brokerId: broker?.id || duplicate.brokerId,
      askingPrice: intake.parsedPrice == null ? duplicate.askingPrice : String(intake.parsedPrice),
      sizeAcres: intake.parsedAcres == null ? duplicate.sizeAcres : String(intake.parsedAcres),
      unitCount: intake.parsedUnitCount ?? duplicate.unitCount,
      zoning: intake.parsedZoning || duplicate.zoning,
      brokerNotes: intake.parsedNotes || duplicate.brokerNotes,
      latitude: location.latitude == null ? duplicate.latitude : String(location.latitude),
      longitude: location.longitude == null ? duplicate.longitude : String(location.longitude),
      county: location.county || duplicate.county,
      submissionCount: (duplicate.submissionCount || 1) + 1,
      lastResubmittedAt: new Date(),
      ingestionNotes: `${duplicate.ingestionNotes || ''}\nResubmitted from intake ${intake.id}.`.trim(),
    }).where(eq(deals.id, duplicate.id));
    await db.update(emailIntakeQueue).set({ status: 'approved', dealId: duplicate.id, reviewedAt: new Date(), reviewNotes: 'Automation: duplicate submission merged.' }).where(eq(emailIntakeQueue.id, intake.id));
    return { outcome: 'duplicate', handled: true, dealId: duplicate.id, reason: 'duplicate_address_or_coordinates' };
  }
  let deal = intake.dealId
    ? (await db.select().from(deals).where(eq(deals.id, intake.dealId)).limit(1))[0]
    : null;
  if (!deal) {
    [deal] = await db.insert(deals).values({
      brokerId: broker?.id || null, dealType: intake.parsedDealType === 'existing_multifamily' ? 'acquisition' : 'land',
      address: intake.parsedAddress, city: location.city, state: location.state, zip: location.zip,
      latitude: location.latitude === null ? null : String(location.latitude), longitude: location.longitude === null ? null : String(location.longitude),
      county: location.county, askingPrice: intake.parsedPrice === null ? null : String(intake.parsedPrice), sizeAcres: String(intake.parsedAcres),
      unitCount: intake.parsedUnitCount, vintage: intake.parsedVintage, zoning: intake.parsedZoning, propertyName: intake.parsedPropertyName,
      brokerPhone: intake.parsedBrokerPhone, brokerNotes: intake.parsedNotes, assignedDeveloper: profile.companyName,
      submissionMethod: 'email', source: 'email_automation', confidenceScore: String(intake.overallConfidence || 0),
      ingestionNotes: `Automated intake ${intake.id}; routing sender=${identities.routingSender.email || 'unknown'}; original source=${originalLeadSource?.email || 'unidentified'}.`,
    }).returning();
    // This write is the retry anchor: if enrichment/classification fails, the
    // unread Graph message resumes this deal instead of inserting another.
    await db.update(emailIntakeQueue).set({ dealId: deal.id }).where(eq(emailIntakeQueue.id, intake.id));
  }
  const activeTypes = await db.select().from(developerProductTypes).where(and(eq(developerProductTypes.developerProfileId, profile.id), eq(developerProductTypes.isActive, true)));
  // HelloData's qualifying-comparable method checks its warehouse before making a live request.
  const comps = await new HelloDataService().searchQualifyingComparables(deal.address, {
    latitude: location.latitude || undefined, longitude: location.longitude || undefined,
    radiusMiles: Number((profile as DeveloperProfile).compSearchRadiusMiles || 3), sourceDeveloperProfileId: profile.id,
  });
  await db.update(deals).set({
    topRentPSF: comps.topRentPSF === undefined ? null : String(comps.topRentPSF), avgRentPSF: comps.avgRentPSF === undefined ? null : String(comps.avgRentPSF),
    topRentPerUnit: comps.topRentPerUnit === undefined ? null : String(comps.topRentPerUnit), avgRentPerUnit: comps.avgRentPerUnit === undefined ? null : String(comps.avgRentPerUnit),
  }).where(eq(deals.id, deal.id));
  const classifiedDeal = { ...deal, topRentPSF: comps.topRentPSF, avgRentPerUnit: comps.avgRentPerUnit, county: location.county, state: location.state };
  const classification = classifyDealForProfile(classifiedDeal, profile as DeveloperProfile, activeTypes);
  await db.insert(partnerDeveloperSends).values({
    developerId: profile.id, developerProfileId: profile.id, dealId: deal.id, address: deal.address,
    classification: classification.classification, matchedProductTypes: classification.matchedProductTypes, status: 'pending',
  }).onConflictDoUpdate({ target: [partnerDeveloperSends.developerProfileId, partnerDeveloperSends.dealId], set: { classification: classification.classification, matchedProductTypes: classification.matchedProductTypes, matchedAt: new Date() } });
  await db.update(emailIntakeQueue).set({ status: 'approved', dealId: deal.id, reviewedAt: new Date(), reviewNotes: 'Automation: confident intake created.' }).where(eq(emailIntakeQueue.id, intake.id));
  return { outcome: 'created', handled: true, dealId: deal.id, reason: route.reason };
}