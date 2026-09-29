import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPendingDeveloperAssistantAction,
  DEVELOPER_ASSISTANT_ACTION_TTL_MS,
  resolvePendingDeveloperAssistantAction,
} from "./developerAssistantActionState";

function propose() {
  return createPendingDeveloperAssistantAction({
    id: "action-1",
    developerProfileId: "profile-1",
    tool: "updateMyCampaignStatus",
    args: { campaignId: "campaign-1", status: "paused" },
    now: 1_000,
  });
}

test("assistant action proposal can be confirmed only by its owner before expiry", () => {
  const action = propose();
  const decision = resolvePendingDeveloperAssistantAction({
    action,
    requestedActionId: action.id,
    developerProfileId: "profile-1",
    now: 2_000,
    cancel: false,
  });

  assert.equal(action.expiresAt, 1_000 + DEVELOPER_ASSISTANT_ACTION_TTL_MS);
  assert.deepEqual(decision, { kind: "confirm", action });
});

test("assistant action proposal can be cancelled without returning an executable action", () => {
  const action = propose();
  const decision = resolvePendingDeveloperAssistantAction({
    action,
    requestedActionId: action.id,
    developerProfileId: "profile-1",
    now: 2_000,
    cancel: true,
  });

  assert.deepEqual(decision, { kind: "cancelled" });
});

test("assistant action cannot be confirmed from another profile or after expiry", () => {
  const action = propose();
  assert.deepEqual(resolvePendingDeveloperAssistantAction({
    action,
    requestedActionId: action.id,
    developerProfileId: "profile-2",
    now: 2_000,
    cancel: false,
  }), { kind: "expired" });

  assert.deepEqual(resolvePendingDeveloperAssistantAction({
    action,
    requestedActionId: action.id,
    developerProfileId: "profile-1",
    now: action.expiresAt + 1,
    cancel: false,
  }), { kind: "expired" });
});