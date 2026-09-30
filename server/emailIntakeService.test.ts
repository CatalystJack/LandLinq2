import assert from 'node:assert/strict';
import {
  formatFewShotBlock,
  prioritizeFewShotExamples,
  processIntakeIdsIndependently,
  queueCorrectionToFewShotExample,
  extractForwardedListingDetails,
  normalizeForwardedBrokerName,
} from './emailIntakeService.js';

// A failed property must not prevent its grouped siblings from being routed.
{
  const attempted: string[] = [];
  const durable = await processIntakeIdsIndependently(
    ['first', 'second', 'third'],
    async (id) => {
      attempted.push(id);
      if (id === 'first') throw new Error('pipeline failure');
      return { handled: id === 'third' };
    },
  );
  assert.equal(durable, false);
  assert.deepEqual(attempted, ['first', 'second', 'third']);
}

// Queue correction rows are converted directly into prompt-ready examples.
{
  const example = queueCorrectionToFewShotExample({
    subject: 'Recurring broker format', fromEmail: 'broker@example.com', emailBody: '10 acres in Raleigh',
    parsedCity: 'Durham', parsedAcres: 10,
    correctionDiff: { city: { ai: 'Durham', analyst: 'Raleigh' } },
  });
  assert.deepEqual((example.correctedOutput as any).city, 'Raleigh');
  assert.deepEqual((example.parsedOutput as any).city, 'Durham');
  assert.equal(example.label, 'correction');
}

// Corrections take the limited prompt slots before newer ordinary approvals.
{
  const selected = prioritizeFewShotExamples([
    { subject: 'new positive', parsedOutput: { address: '1 Positive Way' }, label: 'positive' },
    { subject: 'recent correction', parsedOutput: { city: 'Wrong' }, correctedOutput: { city: 'Right' }, label: 'correction' },
    { subject: 'legacy correction', parsedOutput: { acres: 1 }, correctedOutput: { acres: 2 }, label: 'positive' },
  ], 2);
  assert.deepEqual(selected.map(example => example.subject), ['recent correction', 'legacy correction']);

  const block = formatFewShotBlock(selected);
  assert.match(block, /EXAMPLE 1[\s\S]*recent correction/);
  assert.match(block, /"city": AI said "Wrong" → CORRECT is "Right"/);
  assert.match(block, /Never copy names, addresses, prices/);
  assert.match(block, /CORRECT JSON OUTPUT: {"acres":2}/);
}

// Forwarded Outlook listing facts survive HTML conversion and populate Broker Notes.
{
  const subject = 'Fw: New Multifamily Listing in Jefferson City, TN | 16-Units';
  const text = [
    'From: Johnson, Harrison <harrison.johnson@example.com>',
    'Year Built | 1996-1997',
    'List Price | $2,043,000',
    'Current Rents | $1,058',
    'Pro-Forma Rents | $1,213',
    'Current Cap Rate | 6.34%',
    'Pro-Forma Cap Rate | 7.61%',
    'Marcus & Millichap Deal Room (https://www.marcusmillichap.com/properties/654321?source=email)',
  ].join('\n');
  const details = extractForwardedListingDetails(text, subject);
  assert.deepEqual(details, {
    city: 'Jefferson City',
    state: 'TN',
    unitCount: 16,
    price: 2_043_000,
    vintage: 1997,
    dealType: 'existing_multifamily',
    noteLines: [
      'Year built: 1996-1997',
      'Deal room: https://www.marcusmillichap.com/properties/654321?source=email',
      'Current rents: $1,058',
      'Pro-forma rents: $1,213',
      'Current cap rate: 6.34%',
      'Pro-forma cap rate: 7.61%',
    ],
  });
  assert.equal(normalizeForwardedBrokerName('Johnson, Harrison'), 'Harrison Johnson');
}

console.log('emailIntakeService fixture assertions passed');
process.exit(0);