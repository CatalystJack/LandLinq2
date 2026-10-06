import assert from "node:assert/strict";
import test from "node:test";
import {
  getAccountOutlookConnectionStatus,
  getOutlookConnectionStatus,
  isVerifiedMicrosoftMailbox,
} from "./outlook-connection";

test("Outlook is connected only when authorization, refresh token, and Microsoft identity are saved", () => {
  assert.equal(getOutlookConnectionStatus({
    outlookConnected: true,
    hasAccessToken: true,
    hasRefreshToken: true,
    hasMicrosoftUserId: true,
    hasVerifiedMailboxMatch: true,
  }), "connected");
});

test("Outlook with incomplete or inconsistent saved state needs verification", () => {
  assert.equal(getOutlookConnectionStatus({
    outlookConnected: true,
    hasAccessToken: true,
    hasRefreshToken: false,
    hasMicrosoftUserId: true,
    hasVerifiedMailboxMatch: true,
  }), "needs_verification");
  assert.equal(getOutlookConnectionStatus({
    outlookConnected: false,
    hasAccessToken: false,
    hasRefreshToken: true,
    hasMicrosoftUserId: false,
    hasVerifiedMailboxMatch: false,
  }), "needs_verification");
  assert.equal(getOutlookConnectionStatus({
    outlookConnected: true,
    hasAccessToken: true,
    hasRefreshToken: true,
    hasMicrosoftUserId: true,
    hasVerifiedMailboxMatch: false,
  }), "needs_verification");
});

test("Outlook with no saved authorization is not connected", () => {
  assert.equal(getOutlookConnectionStatus({
    outlookConnected: false,
    hasAccessToken: false,
    hasRefreshToken: false,
    hasMicrosoftUserId: false,
    hasVerifiedMailboxMatch: false,
  }), "not_connected");
});

test("account status matches normalized email without crossing developer-profile boundaries", () => {
  const connectedSender = {
    email: "member@example.com",
    developerProfileId: "company-a",
    outlookConnected: true,
    hasAccessToken: true,
    hasRefreshToken: true,
    microsoftUserId: "microsoft-user-id",
    microsoftIdentityVerified: true,
  };
  const account = {
    email: "Member@Example.com",
    role: "DEVELOPER",
    developerProfileId: "company-a",
  };
  assert.equal(getAccountOutlookConnectionStatus(account, [connectedSender]), "connected");
  assert.equal(getAccountOutlookConnectionStatus(
    { ...account, developerProfileId: "company-b" },
    [connectedSender],
  ), "not_connected");
  assert.equal(getAccountOutlookConnectionStatus(
    { ...account, developerProfileId: null },
    [connectedSender],
  ), "not_connected");
  assert.equal(getAccountOutlookConnectionStatus(account, [
    { ...connectedSender, microsoftIdentityVerified: false },
  ]), "needs_verification");
});

test("internal accounts only match shared sender records", () => {
  const developerSender = {
    email: "admin@example.com",
    developerProfileId: "company-a",
    outlookConnected: true,
    hasAccessToken: true,
    hasRefreshToken: true,
    microsoftUserId: "microsoft-user-id",
    microsoftIdentityVerified: true,
  };
  assert.equal(getAccountOutlookConnectionStatus({
    email: "admin@example.com",
    role: "ADMIN",
    developerProfileId: null,
  }, [developerSender]), "not_connected");
});

test("Microsoft identity verification requires a matching mailbox and a Microsoft user ID", () => {
  assert.equal(isVerifiedMicrosoftMailbox({
    configuredEmail: "Teammate@Example.com ",
    microsoftEmail: "teammate@example.com",
    microsoftUserId: "microsoft-user-id",
  }), true);
  assert.equal(isVerifiedMicrosoftMailbox({
    configuredEmail: "teammate@example.com",
    microsoftEmail: "someone-else@example.com",
    microsoftUserId: "microsoft-user-id",
  }), false);
  assert.equal(isVerifiedMicrosoftMailbox({
    configuredEmail: "teammate@example.com",
    microsoftEmail: null,
    microsoftUserId: "microsoft-user-id",
  }), false);
});
