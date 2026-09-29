export const DEVELOPER_ASSISTANT_ACTION_TTL_MS = 5 * 60 * 1000;

export type PendingDeveloperAssistantAction = {
  id: string;
  developerProfileId: string;
  tool: string;
  args: Record<string, unknown>;
  expiresAt: number;
};

export type DeveloperAssistantActionDecision =
  | { kind: "confirm"; action: PendingDeveloperAssistantAction }
  | { kind: "cancelled" }
  | { kind: "expired" };

export function createPendingDeveloperAssistantAction(input: {
  id: string;
  developerProfileId: string;
  tool: string;
  args: Record<string, unknown>;
  now: number;
}): PendingDeveloperAssistantAction {
  return {
    id: input.id,
    developerProfileId: input.developerProfileId,
    tool: input.tool,
    args: input.args,
    expiresAt: input.now + DEVELOPER_ASSISTANT_ACTION_TTL_MS,
  };
}

export function resolvePendingDeveloperAssistantAction(input: {
  action: PendingDeveloperAssistantAction | undefined;
  requestedActionId: string;
  developerProfileId: string;
  now: number;
  cancel: boolean;
}): DeveloperAssistantActionDecision {
  const action = input.action;
  if (
    !action ||
    action.id !== input.requestedActionId ||
    action.developerProfileId !== input.developerProfileId ||
    action.expiresAt < input.now
  ) {
    return { kind: "expired" };
  }
  return input.cancel ? { kind: "cancelled" } : { kind: "confirm", action };
}