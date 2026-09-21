export function isPlatformAdminEmail(email?: string | null): boolean {
  const normalized = (email || "").toLowerCase().trim();
  return normalized.endsWith("@apexresi.com") || normalized.endsWith("@landlinq.ai");
}

export function isSuperAdminEmail(email?: string | null): boolean {
  const normalized = (email || "").toLowerCase().trim();
  return normalized === "jack@apexresi.com" || normalized === "deals@landlinq.ai";
}

/**
 * Analytics is an internal platform view. Platform domains and persisted
 * internal analyst/admin roles may access it; tenant developer roles remain
 * on their own scoped analytics surface.
 */
export function isAnalyticsAuthorized(
  email?: string | null,
  role?: string | null,
): boolean {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const normalizedRole = (role || "").toUpperCase().trim();

  return (
    isPlatformAdminEmail(normalizedEmail) ||
    normalizedEmail.endsWith("@catalystcp.com") ||
    ["ANALYST", "ADMIN", "SUPER_ADMIN"].includes(normalizedRole)
  );
}