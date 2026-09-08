import assert from 'node:assert/strict';
import {
  buildImapIntakeHash,
  buildImapMessageId,
  createImapDealsPoller,
  parseImapMessage,
} from './imapDealsPoller';

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
console.log('imapDealsPoller fixture assertions passed');