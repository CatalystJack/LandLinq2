import assert from 'node:assert/strict';
import {
  formatFewShotBlock,
  prioritizeFewShotExamples,
  processIntakeIdsIndependently,
  queueCorrectionToFewShotExample,
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

console.log('emailIntakeService fixture assertions passed');
process.exit(0);