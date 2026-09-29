import { isPlatformAdminEmail } from "../shared/admin-auth";

export function requirePlatformAdmin(req: any, res: any, next: any) {
  const email = String(req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
  if (!isPlatformAdminEmail(email)) {
    return res.status(403).json({ error: "Apex Resi administrator access required" });
  }
  next();
}