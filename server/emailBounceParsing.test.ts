import assert from "node:assert/strict";
import test from "node:test";
import {
  emailBounceBodyToText,
  extractBouncedEmailFromText,
  isBounceNotification,
  normalizeBounceMatchText,
} from "./emailBounceParsing";

test("recognizes Outlook bounce notices by sender or subject", () => {
  assert.equal(isBounceNotification({
    fromAddress: "MAILER-DAEMON@example.com",
    subject: "Returned mail",
  }), true);
  assert.equal(isBounceNotification({
    fromAddress: "postmaster@example.com",
    subject: "Notice",
  }), true);
  assert.equal(isBounceNotification({
    fromAddress: "person@example.com",
    subject: "Delivery status notification",
  }), true);
  assert.equal(isBounceNotification({
    fromAddress: "person@example.com",
    subject: "Meeting notes",
  }), false);
});

test("extracts recipients from common delivery-failure formats", () => {
  assert.equal(
    extractBouncedEmailFromText("This message wasn't delivered to partner@example.org"),
    "partner@example.org",
  );
  assert.equal(
    extractBouncedEmailFromText("X-Failed-Recipients: partner@example.org"),
    "partner@example.org",
  );
  assert.equal(
    extractBouncedEmailFromText("Final-Recipient: rfc822; partner@example.org"),
    "partner@example.org",
  );
  assert.equal(
    extractBouncedEmailFromText("Address rejected: partner@example.org"),
    "partner@example.org",
  );
  assert.equal(
    extractBouncedEmailFromText("No delivery details were included."),
    null,
  );
  assert.equal(
    extractBouncedEmailFromText("Failed addresses: internal@landlinq.ai partner@example.org"),
    "partner@example.org",
  );
  assert.equal(
    extractBouncedEmailFromText("Returned from mailer-daemon@example.net to partner@example.org"),
    "partner@example.org",
  );
});

test("normalizes HTML body text for matching an invitation subject", () => {
  const body = emailBounceBodyToText("<p>Subject: Your Company &amp; Co portal</p>");
  assert.equal(
    normalizeBounceMatchText(body),
    "subject: your company & co portal",
  );
});