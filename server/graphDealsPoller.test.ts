import assert from 'node:assert/strict';
import {
  buildUnreadMessagesUrl,
  createGraphDealsPoller,
  fetchFileAttachments,
  normalizeGraphMessage,
} from './graphDealsPoller';

const url = buildUnreadMessagesUrl();
assert.match(url, /users\/deals%40landlinq\.ai\/messages/);
const query = new URL(url).searchParams;
assert.equal(query.get('$filter'), 'isRead eq false');
assert.match(query.get('$select') || '', /internetMessageHeaders/);

const normalized = normalizeGraphMessage({
  id: 'one',
  subject: 'A deal',
  body: { contentType: 'HTML', content: '<b>Details</b>' },
  bodyPreview: 'Details',
  from: { emailAddress: { address: 'broker@example.com' } },
  toRecipients: [{ emailAddress: { address: 'deals@landlinq.ai' } }],
});
assert.equal(normalized.html, '<b>Details</b>');
assert.equal(normalized.from, 'broker@example.com');

const pdfAttachment = await fetchFileAttachments(
  async (input) => {
    const requestUrl = String(input);
    if (requestUrl.endsWith('/attachments')) {
      return Response.json({ value: [{
        id: 'pdf-one',
        name: 'offering-memorandum.pdf',
        contentType: 'application/pdf',
        '@odata.type': '#microsoft.graph.fileAttachment',
      }] });
    }
    return Response.json({
      id: 'pdf-one',
      name: 'offering-memorandum.pdf',
      contentType: 'application/pdf',
      contentBytes: Buffer.from('fixture pdf').toString('base64'),
    });
  },
  'fixture-token',
  'deals@landlinq.ai',
  'pdf-message',
);
assert.equal(pdfAttachment[0].filename, 'offering-memorandum.pdf');
assert.ok(pdfAttachment[0].content.length > 0);

const calls: Array<{ url: string; method?: string }> = [];
const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const requestUrl = String(input);
  calls.push({ url: requestUrl, method: init?.method });
  if (init?.method === 'PATCH') return new Response('', { status: 200 });
  return Response.json({ value: [{ id: 'one', subject: 'all unread mail is delivered', body: { contentType: 'text', content: 'x' } }] });
};
let processorCalls = 0;
const poll = createGraphDealsPoller({
  fetch: fakeFetch,
  getToken: async () => 'fixture-token',
  processMessage: async () => { processorCalls++; return true; },
});
const result = await poll();
assert.equal(result.processed, 1);
assert.equal(processorCalls, 1);
assert.equal(calls.filter(c => c.method === 'PATCH').length, 1);

const deferredCalls: Array<{ url: string; method?: string }> = [];
const deferredPoll = createGraphDealsPoller({
  fetch: async (input, init) => {
    deferredCalls.push({ url: String(input), method: init?.method });
    return Response.json({ value: [{ id: 'leave-unread', body: { contentType: 'text', content: 'retry me' } }] });
  },
  getToken: async () => 'fixture-token',
  processMessage: async () => false,
});
assert.equal((await deferredPoll()).deferred, 1);
assert.equal(deferredCalls.filter(c => c.method === 'PATCH').length, 0);
console.log('graphDealsPoller fixture assertions passed');