export function isPlatformAdminEmail(email?: string | null): boolean {
  const normalized = (email || "").toLowerCase().trim();
  return normalized.endsWith("@apexresi.com") || normalized.endsWith("@landlinq.ai");
}

export function isSuperAdminEmail(email?: string | null): boolean {
  const normalized = (email || "").toLowerCase().trim();
  return normalized === "jack@apexresi.com" || normalized === "deals@landlinq.ai";
}