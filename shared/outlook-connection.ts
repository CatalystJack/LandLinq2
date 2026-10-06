export type OutlookConnectionStatus =
  | "connected"
  | "not_connected"
  | "needs_verification";

export interface OutlookSenderConnectionRecord {
  email: string;
  developerProfileId: string | null;
  outlookConnected: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  microsoftUserId: string | null;
  microsoftIdentityVerified: boolean;
}

export interface OutlookUserAccount {
  email: string | null | undefined;
  role: string | null | undefined;
  developerProfileId: string | null | undefined;
}

export function getOutlookConnectionStatus(input: {
  outlookConnected: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasMicrosoftUserId: boolean;
  hasVerifiedMailboxMatch: boolean;
}): OutlookConnectionStatus {
  if (
    input.outlookConnected &&
    input.hasRefreshToken &&
    input.hasMicrosoftUserId &&
    input.hasVerifiedMailboxMatch
  ) {
    return "connected";
  }

  if (
    input.outlookConnected ||
    input.hasAccessToken ||
    input.hasRefreshToken ||
    input.hasMicrosoftUserId ||
    input.hasVerifiedMailboxMatch
  ) {
    return "needs_verification";
  }

  return "not_connected";
}

export function getAccountOutlookConnectionStatus(
  account: OutlookUserAccount,
  senderRecords: readonly OutlookSenderConnectionRecord[],
): OutlookConnectionStatus {
  const email = account.email?.trim().toLowerCase();
  if (!email) return "not_connected";

  const isDeveloper = account.role?.trim().toUpperCase() === "DEVELOPER";
  if (isDeveloper && !account.developerProfileId) return "not_connected";
  const expectedProfileId = isDeveloper ? account.developerProfileId : null;
  const matchingStatuses = senderRecords
    .filter((sender) =>
      sender.email.trim().toLowerCase() === email &&
      sender.developerProfileId === expectedProfileId,
    )
    .map((sender) => getOutlookConnectionStatus({
      outlookConnected: sender.outlookConnected,
      hasAccessToken: sender.hasAccessToken,
      hasRefreshToken: sender.hasRefreshToken,
      hasMicrosoftUserId: Boolean(sender.microsoftUserId?.trim()),
      hasVerifiedMailboxMatch: sender.microsoftIdentityVerified,
    }));

  if (matchingStatuses.includes("connected")) return "connected";
  if (matchingStatuses.includes("needs_verification")) return "needs_verification";
  return "not_connected";
}

export function isVerifiedMicrosoftMailbox(input: {
  configuredEmail: string | null | undefined;
  microsoftEmail: string | null | undefined;
  microsoftUserId: string | null | undefined;
}): boolean {
  const configuredEmail = input.configuredEmail?.trim().toLowerCase();
  const microsoftEmail = input.microsoftEmail?.trim().toLowerCase();
  const microsoftUserId = input.microsoftUserId?.trim();
  return Boolean(
    configuredEmail &&
    microsoftEmail &&
    microsoftUserId &&
    configuredEmail === microsoftEmail
  );
}
