export const BOT_API_SCOPES = [
  "developer_profiles:read",
  "developer_profiles:update",
  "deals:read",
  "deals:upload",
  "campaigns:draft",
  "campaigns:request_activation",
  "signatures:request_change",
  "outlook:request_connection",
  "outlook:request_disconnection",
] as const;

export type BotApiScope = (typeof BOT_API_SCOPES)[number];

export function hasBotApiScope(scopes: unknown, required: BotApiScope): boolean {
  return Array.isArray(scopes) && scopes.includes(required);
}

export function isBotProfileAuthorized(boundProfileId: unknown, requestedProfileId: unknown): boolean {
  return typeof boundProfileId === "string"
    && boundProfileId.length > 0
    && typeof requestedProfileId === "string"
    && requestedProfileId.length > 0
    && boundProfileId === requestedProfileId;
}
