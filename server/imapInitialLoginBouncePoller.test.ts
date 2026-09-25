import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialLoginBouncePoller,
  type BounceImapClient,
} from "./imapInitialLoginBouncePoller";

const bounceSource = Buffer.from([
  "From: Mail Delivery Subsystem <mailer-daemon@example.net>",
  "To: help@landlinq.ai",
  "Subject: Delivery Status Notification (Failure)",
  "Date: Fri, 25 Sep 2026 12:00:00 +0000",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "This message wasn't delivered to broker@example.org.",
].join("\r\n"));

function createClient(source: Buffer, events: string[]): BounceImapClient {
  return {
    connect: async () => { events.push("connect"); },
    getMailboxLock: async () => ({ release: () => { events.push("release"); } }),
    search: async () => [42],
    fetch: async function* () {
      yield { uid: 42, source };
    },
    messageFlagsAdd: async () => {
      events.push("mark-read");
      return true;
    },
    logout: async () => { events.push("logout"); },
  };
}

test("marks a matched bounce read only after the invitation is persisted", async () => {
  const events: string[] = [];
  const poll = createInitialLoginBouncePoller({
    createClient: () => createClient(bounceSource, events),
    persistNotice: async (notice) => {
      assert.equal(notice.recipientEmail, "broker@example.org");
      assert.equal(notice.messageId, "imap:help@landlinq.ai:uid:42");
      events.push("persist");
      return true;
    },
  });

  const result = await poll();
  assert.equal(result.matched, 1);
  assert.deepEqual(events.slice(0, 3), ["connect", "persist", "mark-read"]);
});

test("leaves an unmatched bounce unread for a later poll", async () => {
  const events: string[] = [];
  const sourceWithoutRecipient = Buffer.from([
    "From: Mail Delivery Subsystem <mailer-daemon@example.net>",
    "To: help@landlinq.ai",
    "Subject: Delivery Status Notification (Failure)",
    "Date: Fri, 25 Sep 2026 12:00:00 +0000",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Delivery failed. No recipient details were included.",
  ].join("\r\n"));
  const poll = createInitialLoginBouncePoller({
    createClient: () => createClient(sourceWithoutRecipient, events),
    persistNotice: async () => {
      throw new Error("Unidentifiable notices must not be persisted");
    },
  });

  const result = await poll();
  assert.equal(result.matched, 0);
  assert.equal(events.includes("mark-read"), false);
});

test("leaves a matching bounce unread if persistence fails", async () => {
  const events: string[] = [];
  const poll = createInitialLoginBouncePoller({
    createClient: () => createClient(bounceSource, events),
    persistNotice: async () => {
      events.push("persist");
      throw new Error("database unavailable");
    },
  });

  const result = await poll();
  assert.equal(result.errors, 1);
  assert.equal(events.includes("mark-read"), false);
});

test("skips fetching when the mailbox has no unread messages", async () => {
  const events: string[] = [];
  const client = createClient(bounceSource, events);
  client.search = async () => [];
  client.fetch = async function* () {
    throw new Error("fetch should not run for an empty inbox");
  };
  const poll = createInitialLoginBouncePoller({
    createClient: () => client,
    persistNotice: async () => false,
  });

  const result = await poll();
  assert.equal(result.messagesSeen, 0);
  assert.equal(events.includes("mark-read"), false);
});