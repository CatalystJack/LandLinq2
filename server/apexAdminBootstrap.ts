import { storage } from "./storage";
import { hashPassword } from "./auth";

const APEX_ADMIN_EMAIL = "jack@apexresi.com";

export async function ensureInitialApexAdmin(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const bootstrapPassword = process.env.APEX_ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapPassword) {
    console.log("[AUTH] Apex admin bootstrap skipped: secret not configured");
    return;
  }

  const existingUser = await storage.getUserByEmail(APEX_ADMIN_EMAIL);
  if (existingUser) {
    console.log("[AUTH] Apex admin bootstrap not needed: account already exists");
    return;
  }

  if (bootstrapPassword.length < 12) {
    throw new Error("APEX_ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters");
  }

  await storage.createUser({
    email: APEX_ADMIN_EMAIL,
    password: await hashPassword(bootstrapPassword),
    firstName: "Jack",
    lastName: "Apex",
    role: "SUPER_ADMIN",
    mustResetPassword: false,
  });

  console.log("[AUTH] Initial Apex admin account created successfully");
}