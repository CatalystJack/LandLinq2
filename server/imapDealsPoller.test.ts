import assert from 'node:assert/strict';
import {
  buildImapIntakeHash,
  buildImapMessageId,
  createImapDealsPoller,
  parseImapMessage,
  runDealsImapPollCycle,
} from './imapDealsPoller';
import {
  classifyDealsImapPollFailure,
  computeDealsImapPollHealthState,
  DEALS_IMAP_STALE_AFTER_MS,
} from './emailIntakePollHealth';

const fixture = [
  'From: Jane Broker <jane@example.com>',
  'To: deals@landlinq.ai',
  'Cc: analyst@landlinq.ai',
  'Subject: New multifamily opportunity',
  'Date: Tue, 08 Sep 2026 12:00:00 -0400',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="fixture-boundary"',
  '',
  '--fixture-boundary',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Please review 100 Main Street.',
  '',
  '--fixture-boundary',
  'Content-Type: application/pdf',
  'Content-Disposition: attachment; filename="offering-memorandum.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'Zml4dHVyZSBwZGY=',
  '--fixture-boundary--',
].join('\r\n');

const parsed = await parseImapMessage(42, Buffer.from(fixture));
assert.equal(parsed.uid, 42);
assert.equal(parsed.from, '"Jane Broker" <jane@example.com>');
assert.equal(parsed.to, 'deals@landlinq.ai');
assert.equal(parsed.cc, 'analyst@landlinq.ai');
assert.match(parsed.text, /100 Main Street/);
assert.equal(parsed.attachments[0].originalname, 'offering-memorandum.pdf');
assert.equal(parsed.attachments[0].mimetype, 'application/pdf');
assert.equal(parsed.attachments[0].buffer.toString(), 'fixture pdf');

const outlookForwardFixture = [
  'From: Alex Catalyst <alex@catalystcp.com>',
  'To: deals@landlinq.ai',
  'Subject: Fw: New Multifamily Listing in Jefferson City, TN | 16-Units',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="outlook-boundary"',
  '',
  '--outlook-boundary',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Forwarded message. The plain-text alternative has no usable listing information. '.repeat(20),
  '--outlook-boundary',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<html><body>',
  '<div>From: Johnson, Harrison &lt;harrison.johnson@example.com&gt;</div>',
  '<table>',
  '<tr><td>Year Built</td><td>1996-1997</td></tr>',
  '<tr><td>List Price</td><td>$2,043,000</td></tr>',
  '<tr><td>Current Rents</td><td>$1,058</td></tr>',
  '<tr><td>Pro-Forma Rents</td><td>$1,213</td></tr>',
  '<tr><td>Current Cap Rate</td><td>6.34%</td></tr>',
  '<tr><td>Pro-Forma Cap Rate</td><td>7.61%</td></tr>',
  '</table>',
  '<a href="https://www.marcusmillichap.com/properties/654321?source=email&amp;type=deal">Marcus &amp; Millichap Deal Room</a>',
  '</body></html>',
  '--outlook-boundary--',
].join('\r\n');
const parsedOutlookForward = await parseImapMessage(43, Buffer.from(outlookForwardFixture));
assert.match(parsedOutlookForward.text, /From: Johnson, Harrison <harrison\.johnson@example\.com>/);
assert.match(parsedOutlookForward.text, /Year Built\s*\|\s*1996-1997/);
assert.match(parsedOutlookForward.text, /Current Rents\s*\|\s*\$1,058/);
assert.match(parsedOutlookForward.text, /Marcus & Millichap Deal Room \(https:\/\/www\.marcusmillichap\.com\/properties\/654321\?source=email&type=deal\)/);

assert.equal(buildImapMessageId('DEALS@LANDLINQ.AI', 42), 'imap:deals@landlinq.ai:uid:42');
assert.equal(buildImapIntakeHash('deals@landlinq.ai', 42).length, 64);

const marked: number[] = [];
let logoutCount = 0;
let releaseCount = 0;
const fakeClient = {
  async connect() {},
  async getMailboxLock() {
    return { release: () => { releaseCount++; } };
  },
  async search() {
    return [7, 8];
  },
  async *fetch() {
    yield { uid: 7, source: Buffer.from('From: one@example.com\r\nTo: deals@landlinq.ai\r\n\r\none') };
    yield { uid: 8, source: Buffer.from('From: two@example.com\r\nTo: deals@landlinq.ai\r\n\r\ntwo') };
  },
  async messageFlagsAdd(uid: number) {
    marked.push(uid);
    return true;
  },
  async logout() {
    logoutCount++;
  },
};
const poll = createImapDealsPoller({
  createClient: () => fakeClient,
  processMessage: async () => true,
});
const result = await poll();
assert.equal(result.messagesSeen, 2);
assert.equal(result.processed, 2);
assert.deepEqual(marked, [7, 8]);
assert.equal(releaseCount, 1);
assert.equal(logoutCount, 1);

const failingPoll = createImapDealsPoller({
  createClient: () => ({
    ...fakeClient,
    async connect() {
      throw new Error('Login failed for jane@example.com using mailbox-password');
    },
  }),
  processMessage: async () => true,
});
await assert.rejects(failingPoll(), (error: any) => {
  assert.equal(error.message, 'Deals mailbox polling failed');
  assert.equal(error.pollFailureCategory, 'authentication');
  assert.doesNotMatch(error.message, /jane@example\.com|mailbox-password/);
  return true;
});

let deferredMarkCount = 0;
const deferredPoll = createImapDealsPoller({
  createClient: () => ({
    ...fakeClient,
    async *fetch() {
      yield { uid: 9, source: Buffer.from('From: retry@example.com\r\nTo: deals@landlinq.ai\r\n\r\nretry') };
    },
    async messageFlagsAdd() {
      deferredMarkCount++;
      return true;
    },
  }),
  processMessage: async () => false,
});
const deferredResult = await deferredPoll();
assert.equal(deferredResult.deferred, 1);
assert.equal(deferredMarkCount, 0);

let enabled = false;
let livePollCount = 0;
const pollCycleResult = {
  messagesSeen: 0,
  processed: 0,
  deferred: 0,
  errors: 0,
  markReadFailures: 0,
  skippedBecauseRunning: false,
};
const readEnabled = async () => enabled;
const fakeMailboxPoll = async () => {
  livePollCount++;
  return pollCycleResult;
};
const healthEvents: string[] = [];
const fakeHealth = {
  recordAttempt: async () => { healthEvents.push('attempt'); },
  recordDisabled: async () => { healthEvents.push('disabled'); },
  recordFailure: async () => { healthEvents.push('failure'); },
  recordSuccess: async () => { healthEvents.push('success'); },
};

assert.equal(await runDealsImapPollCycle(readEnabled, fakeMailboxPoll, fakeHealth), null);
assert.equal(livePollCount, 0);
assert.deepEqual(healthEvents, ['disabled']);
enabled = true;
assert.equal(await runDealsImapPollCycle(readEnabled, fakeMailboxPoll, fakeHealth), pollCycleResult);
assert.equal(livePollCount, 1);
assert.deepEqual(healthEvents, ['disabled', 'attempt', 'success']);

assert.equal(
  classifyDealsImapPollFailure(new Error('Authentication failed for jane@example.com with password secret')),
  'authentication',
);
assert.equal(
  classifyDealsImapPollFailure({ code: 'ETIMEDOUT', message: 'socket timeout to private-host' }),
  'connection',
);
assert.equal(classifyDealsImapPollFailure(new Error('Mailbox closed'), 'mailbox'), 'mailbox_access');

const now = new Date('2026-09-30T12:00:00.000Z');
const freshSuccess = new Date(now.getTime() - DEALS_IMAP_STALE_AFTER_MS + 1000);
const commonHealth = {
  now,
  monitoringStartedAt: new Date(now.getTime() - DEALS_IMAP_STALE_AFTER_MS * 2),
  lastAttemptAt: new Date(now.getTime() - 10_000),
  lastSuccessfulPollAt: freshSuccess,
  failureCategory: null,
  automationEnabled: true,
  schedulerActive: true,
  schedulerExpected: true,
};
assert.equal(computeDealsImapPollHealthState(commonHealth), 'healthy');
assert.equal(computeDealsImapPollHealthState({
  ...commonHealth,
  lastSuccessfulPollAt: new Date(now.getTime() - DEALS_IMAP_STALE_AFTER_MS),
}), 'stale');
assert.equal(computeDealsImapPollHealthState({
  ...commonHealth,
  failureCategory: 'authentication',
}), 'failed');
assert.equal(computeDealsImapPollHealthState({
  ...commonHealth,
  automationEnabled: false,
}), 'disabled');
assert.equal(computeDealsImapPollHealthState({
  ...commonHealth,
  schedulerActive: false,
  schedulerExpected: false,
}), 'not_scheduled');
assert.equal(computeDealsImapPollHealthState({
  ...commonHealth,
  schedulerActive: false,
  schedulerExpected: true,
}), 'failed');
console.log('imapDealsPoller fixture assertions passed');