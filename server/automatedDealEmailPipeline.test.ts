import assert from 'node:assert/strict';
import { parseForwardedChainIdentities } from './aiEmailParser.js';
import { isVolumeThresholdExceeded } from './emailIntakeVolumeAlert.js';
import {
  extractCoordinates,
  extractCoordinatePairs,
  findDuplicateDeal,
  hasGeographyConflict,
  isCompleteConfidentIntake,
  normalizeState,
  routeProfile,
} from './automatedDealEmailPipeline.js';

const profile = (id: string, county = 'Wake') => ({
  id, companyName: id, profileType: 'real_estate', isActive: true,
  knownEmailDomains: null, targetCounties: [county], targetStates: ['NC'],
});

// Clean forwarding preserves the mailbox sender for routing and the author for attribution.
{
  const identities = parseForwardedChainIdentities('Analyst <analyst@tenant.com>',
    '---------- Forwarded message ----------\nFrom: Jane Broker <jane@broker.com>');
  assert.equal(identities.routingSender.email, 'analyst@tenant.com');
  assert.equal(identities.originalLeadSource?.email, 'jane@broker.com');
}
// The innermost/earliest message wins when a forward is nested.
{
  const identities = parseForwardedChainIdentities('outer@tenant.com',
    'From: Middle <middle@tenant.com>\n--- Forwarded ---\nFrom: Original <source@broker.com>');
  assert.equal(identities.originalLeadSource?.email, 'source@broker.com');
}
// More than one exact county/state route is intentionally manual.
{
  assert.equal(routeProfile([profile('a'), profile('b')], { name: null, email: null }, 'Wake', 'NC').reason, 'ambiguous_geography');
}
// Exact normalized address is preferred, with a coordinate fallback capped at 0.1 miles.
{
  const duplicate = findDuplicateDeal([{ address: '100 Main Street', latitude: '35.0000', longitude: '-78.0000' }],
    '100 Main St.', { latitude: 35.0005, longitude: -78.0005 });
  assert.ok(duplicate);
}

// Coordinate-only submissions retain valid latitude/longitude for reverse geocoding.
{
  assert.deepEqual(extractCoordinates('Site pin: 35.7796, -78.6382'), {
    latitude: 35.7796,
    longitude: -78.6382,
  });
}

// The alert threshold is strictly greater than 20 outcomes per rolling hour.
{
  assert.equal(isVolumeThresholdExceeded(20), false);
  assert.equal(isVolumeThresholdExceeded(21), true);
}

// Full state names and postal abbreviations are equivalent when checking a pin.
{
  assert.equal(normalizeState('North Carolina'), 'NC');
  assert.equal(hasGeographyConflict(
    { county: 'Wake County', state: 'North Carolina' },
    { county: 'Wake', state: 'NC' },
  ), false);
  assert.equal(hasGeographyConflict(
    { county: 'Wake County', state: 'NC' },
    { county: 'Durham County', state: 'NC' },
  ), true);
}

// Grouped rows must not inherit an arbitrary first coordinate from a body with
// several property pins; callers can use this complete list to hold review.
{
  assert.deepEqual(extractCoordinatePairs('A: 35.7796, -78.6382; B: 36.0012, -78.9001'), [
    { latitude: 35.7796, longitude: -78.6382 },
    { latitude: 36.0012, longitude: -78.9001 },
  ]);
}

// Low confidence and missing acreage both stay behind the manual-review gate.
{
  assert.equal(isCompleteConfidentIntake({
    confidence: 74,
    county: 'Wake',
    state: 'NC',
    acres: 10,
    price: 2_000_000,
    rent: null,
  }), false);
  assert.equal(isCompleteConfidentIntake({
    confidence: 90,
    county: 'Wake',
    state: 'NC',
    acres: null,
    price: 2_000_000,
    rent: null,
  }), false);
}

console.log('automatedDealEmailPipeline fixture assertions passed');
process.exit(0);