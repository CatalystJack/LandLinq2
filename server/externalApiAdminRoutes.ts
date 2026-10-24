import type { Express, RequestHandler } from "express";
import crypto from "crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  apiChangeLog,
  brokers,
  developerBrokerCrm,
  developerCountyMarketLabels,
  deals,
  developerProductTypes,
  developerProfiles,
  outreachCampaigns,
  outreachCampaignTemplates,
  outreachCampaignTemplateSteps,
  partnerDeveloperSends,
  partnerDevelopers,
} from "@shared/schema";
import { hasBotApiScope, isBotProfileAuthorized, type BotApiScope } from "@shared/bot-api";
import { normalizePurchaseCriteria, validatePurchaseCriteria } from "@shared/purchase-criteria";
import { normalizeIndustrialCriteria, validateIndustrialCriteria } from "@shared/industrial-criteria";
import { normalizeRuralLandCriteria, validateRuralLandCriteria } from "@shared/rural-land-criteria";
import { db } from "./db";
import {
  findAccessibleDeveloperCrmContactEmails,
  getDeveloperContactVisibility,
  getDeveloperCrmContacts,
  isAccessibleDeveloperCrmContact,
} from "./developerCrmContacts";
import { createRateLimit } from "./rateLimiter";

const adminApiLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 60, message: "Too many API requests. Retry shortly." });
const contactWriteLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 20, message: "Too many contact changes. Retry shortly." });
const botReadLimiter = createRateLimit({
  windowMs: 60_000, maxRequests: 60, message: "Bot API rate limit exceeded.",
  keyGenerator: (req) => `bot:${String((req as any).apiKeyRow?.id || req.ip || "unknown")}`,
});
const botWriteLimiter = createRateLimit({
  windowMs: 60_000, maxRequests: 15, message: "Bot API write limit exceeded.",
  keyGenerator: (req) => `bot:${String((req as any).apiKeyRow?.id || req.ip || "unknown")}`,
});
const MAX_CONTACTS = 1000;
const MAX_PAGE_SIZE = 200;
const CRITERIA_ROUTE = "/api/v1/investment-companies/:id/criteria";
const CONTACTS_ROUTE = "/api/v1/crm-contacts";

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function str(value: unknown, max = 500): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new Error(`Text values must be strings of at most ${max} characters.`);
  return value.trim();
}
function numberOrNull(value: unknown, label: string, integer = false): number | null {
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw new Error(`${label} must be a non-negative ${integer ? "integer" : "number"}, or null.`);
  return n;
}
function mergeJson(current: any, patch: any): any {
  if (!isRecord(current) || !isRecord(patch)) return patch;
  const result = { ...current };
  for (const [key, value] of Object.entries(patch)) result[key] = isRecord(value) ? mergeJson(current[key], value) : value;
  return result;
}
function asApiKeyId(req: any): string {
  return String(req.apiKeyRow?.id || "");
}
function sandbox(req: any): boolean {
  return Boolean(req.isSandbox);
}

async function findCompany(id: string) {
  const [profile] = await db.select().from(developerProfiles).where(and(
    eq(developerProfiles.id, id),
    eq(developerProfiles.isActive, true),
    or(eq(developerProfiles.isInternal, false), isNull(developerProfiles.isInternal)),
  )).limit(1);
  return profile || null;
}

async function criteriaSnapshot(executor: any, profile: any) {
  const [products, labels] = await Promise.all([
    executor.select().from(developerProductTypes).where(eq(developerProductTypes.developerProfileId, profile.id)).orderBy(developerProductTypes.createdAt),
    executor.select().from(developerCountyMarketLabels).where(eq(developerCountyMarketLabels.developerProfileId, profile.id)),
  ]);
  if (profile.profileType === "general_sales") {
    return { company: { id: profile.id, companyName: profile.companyName, profileType: profile.profileType, assetClass: profile.assetClass }, criteria: null };
  }
  return {
    company: { id: profile.id, companyName: profile.companyName, profileType: profile.profileType, assetClass: profile.assetClass },
    criteria: {
      targetStates: profile.targetStates || [],
      targetCounties: profile.targetCounties || [],
      countyMarketLabels: Object.fromEntries(labels.map((row: any) => [row.county, row.marketLabel])),
      minAcres: profile.minAcres,
      maxAcres: profile.maxAcres,
      rentMetric: profile.rentMetric,
      minRentPsf: profile.minRentPsf,
      minRentPerUnit: profile.minRentPerUnit,
      compMinVintageYear: profile.compMinVintageYear,
      compMinUnits: profile.compMinUnits,
      compSearchRadiusMiles: profile.compSearchRadiusMiles,
      qctOverridesRentMinimum: profile.qctOverridesRentMinimum,
      ddaOverridesRentMinimum: profile.ddaOverridesRentMinimum,
      ozOverridesRentMinimum: profile.ozOverridesRentMinimum,
      criteriaNotes: profile.criteriaNotes || "",
      notes: profile.criteriaNotes || "",
      purchaseCriteria: normalizePurchaseCriteria(profile.purchaseCriteria),
      ruralLandCriteria: normalizeRuralLandCriteria(profile.ruralLandCriteria),
      industrialCriteria: normalizeIndustrialCriteria(profile.industrialCriteria, profile.targetStates || []),
      productTypes: products.map((row: any) => ({
        id: row.id,
        name: row.name,
        minAcres: row.minAcres,
        maxAcres: row.maxAcres,
        minRentPsf: row.minRentPsf,
        minRentPerUnit: row.minRentPerUnit,
        stateOverrides: row.stateOverrides || {},
        isActive: row.isActive,
      })),
    },
  };
}

function sanitizeAudit(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeAudit);
  if (!isRecord(value)) return value;
  const redacted = new Set(["firstName", "lastName", "email", "phone", "mailingAddress", "city", "postalCode", "crmNotes", "assignedTo", "notes"]);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    redacted.has(key) && item != null ? "[redacted]" : sanitizeAudit(item),
  ]));
}
async function insertAudit(tx: any, apiKeyId: string, route: string, entityType: string, entityId: string, before: any, after: any) {
  await tx.insert(apiChangeLog).values({
    apiKeyId, route, entityType, entityId,
    beforeJson: before == null ? null : sanitizeAudit(before),
    afterJson: after == null ? null : sanitizeAudit(after),
  });
}

const contactFields: Record<string, string> = {
  firstName: "firstName", lastName: "lastName", email: "email", phone: "phone",
  brokerage: "brokerage", marketsCovered: "marketsCovered", contactCategory: "contactCategory",
  mailingAddress: "mailingAddress", city: "city", postalCode: "postalCode",
  stateRegion: "stateRegion", contactSector: "contactSector", contactSpecialty: "contactSpecialty",
  crmNotes: "crmNotes", assignedTo: "assignedTo", isActive: "isActive", lastContactedAt: "lastContactedAt",
};
function normalizeContact(input: unknown, partial = false): Record<string, any> {
  if (!isRecord(input)) throw new Error("Each contact must be an object.");
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "crmTags") {
      if (!Array.isArray(value) || value.length > 50 || value.some((tag) => typeof tag !== "string" || tag.length > 100)) throw new Error("crmTags must be an array of up to 50 strings.");
      out.crmTags = Array.from(new Set(value.map((tag: string) => tag.trim()).filter(Boolean)));
      continue;
    }
    if (!(key in contactFields)) throw new Error(`Unsupported contact field: ${key}`);
    if (key === "isActive") {
      if (typeof value !== "boolean") throw new Error("isActive must be a boolean.");
      out[key] = value;
      continue;
    }
    if (key === "lastContactedAt") {
      if (value === null || value === "") { out[key] = null; continue; }
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) throw new Error("lastContactedAt must be a valid date-time or null.");
      out[key] = date;
      continue;
    }
    out[key] = str(value, key === "crmNotes" || key === "mailingAddress" ? 4000 : 500);
  }
  if (!partial && (!out.firstName || !out.lastName)) throw new Error("firstName and lastName are required.");
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new Error("email must be valid.");
  if (out.contactSector && !["commercial", "residential"].includes(out.contactSector.toLowerCase())) throw new Error("contactSector must be commercial or residential.");
  if (out.contactSector) out.contactSector = out.contactSector.toLowerCase();
  return out;
}

export function registerExternalApiAdminRoutes(app: Express, requireApiKey: RequestHandler, requireBotApiKey: RequestHandler) {
  app.get(CRITERIA_ROUTE, requireApiKey, adminApiLimiter, async (req, res) => {
    try {
      const profile = await findCompany(req.params.id);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      return res.json(await criteriaSnapshot(db, profile));
    } catch {
      return res.status(500).json({ error: "Unable to load criteria." });
    }
  });

  app.patch(CRITERIA_ROUTE, requireApiKey, adminApiLimiter, async (req: any, res) => {
    try {
      const profile = await findCompany(req.params.id);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      if (profile.profileType === "general_sales") return res.status(409).json({ error: "General Sales profiles do not have acquisition criteria." });
      if (!isRecord(req.body)) return res.status(400).json({ error: "Request body must be a JSON object." });
      const allowed = new Set([
        "targetStates", "targetCounties", "countyMarketLabels", "minAcres", "maxAcres",
        "rentMetric", "minRentPsf", "minRentPerUnit", "compMinVintageYear", "compMinUnits",
        "compSearchRadiusMiles", "qctOverridesRentMinimum", "ddaOverridesRentMinimum",
        "ozOverridesRentMinimum", "criteriaNotes", "notes", "purchaseCriteria", "ruralLandCriteria",
        "industrialCriteria", "productTypes",
      ]);
      for (const key of Object.keys(req.body)) if (!allowed.has(key)) return res.status(400).json({ error: `Unsupported criteria field: ${key}` });
      if (!Object.keys(req.body).length) return res.status(400).json({ error: "Provide at least one criteria field." });
      const updates: Record<string, any> = {};
      const arrayFields = ["targetStates", "targetCounties"] as const;
      for (const field of arrayFields) if (req.body[field] !== undefined) {
        const values = req.body[field];
        if (!Array.isArray(values) || values.length > 300 || values.some((v: unknown) => typeof v !== "string" || v.length > 200)) throw new Error(`${field} must be an array of strings.`);
        updates[field] = Array.from(new Set(values.map((v: string) => v.trim()).filter(Boolean)));
        if (field === "targetStates") updates[field] = updates[field].map((state: string) => state.toUpperCase());
      }
      if (req.body.rentMetric !== undefined) {
        if (!["psf", "per_unit"].includes(req.body.rentMetric)) throw new Error("rentMetric must be psf or per_unit.");
        updates.rentMetric = req.body.rentMetric;
      }
      for (const field of ["minAcres", "maxAcres", "minRentPsf", "minRentPerUnit", "compSearchRadiusMiles"] as const) if (req.body[field] !== undefined) {
        const value = numberOrNull(req.body[field], field);
        updates[field] = value === null ? null : String(value);
      }
      for (const field of ["compMinVintageYear", "compMinUnits"] as const) if (req.body[field] !== undefined) {
        const value = numberOrNull(req.body[field], field, true);
        updates[field] = value;
        if (field === "compMinVintageYear" && value !== null && (value < 1800 || value > 2100)) throw new Error("compMinVintageYear must be between 1800 and 2100.");
      }
      for (const field of ["qctOverridesRentMinimum", "ddaOverridesRentMinimum", "ozOverridesRentMinimum"] as const) if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "boolean") throw new Error(`${field} must be a boolean.`);
        updates[field] = req.body[field];
      }
      if (req.body.notes !== undefined || req.body.criteriaNotes !== undefined) {
        updates.criteriaNotes = str(req.body.criteriaNotes ?? req.body.notes, 4000);
      }
      for (const field of ["purchaseCriteria", "ruralLandCriteria", "industrialCriteria"] as const) {
        if (req.body[field] !== undefined && !isRecord(req.body[field])) throw new Error(`${field} must be an object.`);
      }
      const targetStates = updates.targetStates || profile.targetStates || [];
      if (updates.targetStates?.some((state: string) => !/^[A-Z]{2}$/i.test(state))) throw new Error("targetStates must contain two-letter state codes.");
      const purchaseCriteria = req.body.purchaseCriteria === undefined
        ? normalizePurchaseCriteria(profile.purchaseCriteria)
        : validatePurchaseCriteria(mergeJson(normalizePurchaseCriteria(profile.purchaseCriteria), req.body.purchaseCriteria));
      if (req.body.purchaseCriteria !== undefined) updates.purchaseCriteria = purchaseCriteria;
      if (req.body.industrialCriteria !== undefined) {
        const merged = mergeJson(profile.industrialCriteria || {}, req.body.industrialCriteria);
        updates.industrialCriteria = validateIndustrialCriteria(normalizeIndustrialCriteria(merged, targetStates));
      }
      if (req.body.ruralLandCriteria !== undefined) {
        updates.ruralLandCriteria = validateRuralLandCriteria(mergeJson(normalizeRuralLandCriteria(profile.ruralLandCriteria), req.body.ruralLandCriteria));
      }
      const finalMinAcres = Number(updates.minAcres ?? profile.minAcres);
      const finalMaxAcres = updates.maxAcres === undefined ? (profile.maxAcres == null ? null : Number(profile.maxAcres)) : updates.maxAcres;
      if (finalMaxAcres !== null && finalMaxAcres < finalMinAcres) throw new Error("maxAcres must be at least minAcres.");
      if (req.body.countyMarketLabels !== undefined) {
        if (!isRecord(req.body.countyMarketLabels) || Object.keys(req.body.countyMarketLabels).length > 300) throw new Error("countyMarketLabels must be an object.");
        const validCounties = new Set((updates.targetCounties || profile.targetCounties || []).map((county: string) => county.trim().toLowerCase()));
        for (const [county, label] of Object.entries(req.body.countyMarketLabels)) {
          if (!validCounties.has(county.trim().toLowerCase())) throw new Error(`County market label ${county} is not in targetCounties.`);
          if (typeof label !== "string" || label.length > 120) throw new Error("County market labels must be strings of at most 120 characters.");
        }
      }
      let productTypes: any[] | undefined;
      if (req.body.productTypes !== undefined) {
        if (!Array.isArray(req.body.productTypes) || req.body.productTypes.length > 100) throw new Error("productTypes must be an array of at most 100 items.");
        const names = new Set<string>();
        productTypes = req.body.productTypes.map((item: any, i: number) => {
          if (!isRecord(item)) throw new Error(`productTypes[${i}] must be an object.`);
          const name = str(item.name, 120);
          if (!name) throw new Error(`productTypes[${i}].name is required.`);
          if (names.has(name.toLowerCase())) throw new Error("Product type names must be unique.");
          names.add(name.toLowerCase());
          const minAcres = numberOrNull(item.minAcres, "product type minAcres");
          if (minAcres === null) throw new Error(`${name}: minAcres is required.`);
          const maxAcres = numberOrNull(item.maxAcres, "product type maxAcres");
          if (maxAcres !== null && maxAcres < minAcres) throw new Error(`${name}: maxAcres must be at least minAcres.`);
          const minRentPsf = numberOrNull(item.minRentPsf, "product type minRentPsf");
          const minRentPerUnit = numberOrNull(item.minRentPerUnit, "product type minRentPerUnit");
          const stateOverrides = item.stateOverrides ?? {};
          if (!isRecord(stateOverrides)) throw new Error(`${name}: stateOverrides must be an object.`);
          for (const [state, override] of Object.entries(stateOverrides)) {
            if (!/^[A-Z]{2}$/.test(state.toUpperCase()) || !targetStates.some((value: string) => value.toUpperCase() === state.toUpperCase()) || !isRecord(override)) throw new Error(`${name}: state overrides must use a target state.`);
            for (const field of ["minAcres", "maxAcres", "minRentPsf", "minRentPerUnit"]) if ((override as any)[field] !== undefined) {
              numberOrNull((override as any)[field], `${state} ${field}`);
            }
          }
          return { id: item.id ? str(item.id, 100) : null, name, minAcres, maxAcres, minRentPsf, minRentPerUnit, stateOverrides, isActive: item.isActive !== false };
        });
      }
      const isDryRun = sandbox(req);
      const result = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(developerProfiles).where(eq(developerProfiles.id, profile.id)).limit(1);
        const before = await criteriaSnapshot(tx, current);
        const profileUpdates: Record<string, any> = { ...updates, updatedAt: new Date() };
        if (req.body.minAcres === undefined && productTypes?.length) profileUpdates.minAcres = String(productTypes[0].minAcres);
        if (req.body.maxAcres === undefined && productTypes?.length) profileUpdates.maxAcres = productTypes[0].maxAcres === null ? null : String(productTypes[0].maxAcres);
        let afterProfile = { ...current, ...profileUpdates };
        const currentProducts = await tx.select().from(developerProductTypes).where(eq(developerProductTypes.developerProfileId, profile.id));
        let afterProducts = currentProducts;
        if (productTypes) {
          afterProducts = [...currentProducts];
          for (const item of productTypes) {
            const prior = item.id
              ? currentProducts.find((row: any) => row.id === item.id)
              : currentProducts.find((row: any) => row.name.toLowerCase() === item.name.toLowerCase());
            if (item.id && !prior) throw new Error("A product type id does not belong to this company.");
            const row = { ...(prior || {}), ...item, developerProfileId: profile.id };
            if (prior) afterProducts = afterProducts.map((entry: any) => entry.id === prior.id ? row : entry);
            else afterProducts.push(row);
          }
        }
        const labelMap = req.body.countyMarketLabels;
        const afterLabels = labelMap === undefined
          ? before.criteria?.countyMarketLabels || {}
          : Object.fromEntries(Object.entries(labelMap).map(([county, label]) => [county.trim(), String(label || "").trim()]).filter(([, label]) => Boolean(label)));
        if (isDryRun) return {
          before,
          after: { ...before, criteria: before.criteria ? { ...before.criteria, ...updates, purchaseCriteria, productTypes: afterProducts, countyMarketLabels: afterLabels } : null },
        };
        const [saved] = await tx.update(developerProfiles).set(profileUpdates).where(eq(developerProfiles.id, profile.id)).returning();
        if (productTypes) {
          for (const item of productTypes) {
            const prior = item.id
              ? currentProducts.find((row: any) => row.id === item.id)
              : currentProducts.find((row: any) => row.name.toLowerCase() === item.name.toLowerCase());
            const values = {
              name: item.name, minAcres: String(item.minAcres), maxAcres: item.maxAcres === null ? null : String(item.maxAcres),
              minRentPsf: item.minRentPsf === null ? null : String(item.minRentPsf), minRentPerUnit: item.minRentPerUnit === null ? null : String(item.minRentPerUnit),
              stateOverrides: item.stateOverrides, isActive: item.isActive, updatedAt: new Date(),
            };
            if (prior) await tx.update(developerProductTypes).set(values).where(eq(developerProductTypes.id, prior.id));
            else await tx.insert(developerProductTypes).values({ ...values, developerProfileId: profile.id, minAcres: values.minAcres } as any);
          }
        }
        if (labelMap !== undefined) {
          await tx.delete(developerCountyMarketLabels).where(eq(developerCountyMarketLabels.developerProfileId, profile.id));
          const labels = Object.entries(afterLabels).map(([county, marketLabel]) => ({ developerProfileId: profile.id, county, marketLabel: String(marketLabel) }));
          if (labels.length) await tx.insert(developerCountyMarketLabels).values(labels);
        }
        const savedSnapshot = await criteriaSnapshot(tx, saved);
        await insertAudit(tx, asApiKeyId(req), CRITERIA_ROUTE, "investment_company_criteria", profile.id, before, savedSnapshot);
        return { before, after: savedSnapshot };
      });
      return res.json({ ok: true, dryRun: isDryRun, ...(isDryRun ? { wouldChange: result.after } : { ...result.after }) });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Invalid criteria update." });
    }
  });

  app.get(CONTACTS_ROUTE, requireApiKey, adminApiLimiter, async (req, res) => {
    try {
      const investmentCompanyId = String(req.query.investmentCompanyId || "").trim();
      if (!investmentCompanyId) return res.status(400).json({ error: "investmentCompanyId is required." });
      const profile = await findCompany(investmentCompanyId);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      const limit = Number(req.query.limit || 100), offset = Number(req.query.offset || 0);
      const q = String(req.query.q || "").trim();
      const state = String(req.query.state || "").trim().toUpperCase();
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return res.status(400).json({ error: `limit must be between 1 and ${MAX_PAGE_SIZE}.` });
      if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) return res.status(400).json({ error: "offset must be a non-negative integer up to 1000000." });
      if (q.length > 120) return res.status(400).json({ error: "q must be 120 characters or fewer." });
      if (state && !/^[A-Z]{2}$/.test(state)) return res.status(400).json({ error: "state must be a two-letter code." });
      const visibility = await getDeveloperContactVisibility(profile.id);
      const result = await getDeveloperCrmContacts({
        developerProfileId: profile.id, visibility, page: Math.floor(offset / limit) + 1, offset, limit,
        search: q, tag: "", tagFilters: [], sourceTagFilter: "", crmStateFilter: "", stateFilter: state,
        msaFilter: "", countyFilter: "", market: "", smsFilter: "", assignedToFilter: "", brokerageFilter: "",
        multiCampaignTagFilter: false, includeFilterOptions: false, includeContactEnrichment: false,
      });
      return res.json({ investmentCompanyId, ...result, pagination: {
        ...result.pagination, offset, limit,
        hasNextPage: offset + (result.contacts?.length || 0) < (result.pagination?.total || 0),
        hasPrevPage: offset > 0,
      } });
    } catch {
      return res.status(500).json({ error: "Unable to search CRM contacts." });
    }
  });

  app.post(CONTACTS_ROUTE, requireApiKey, contactWriteLimiter, async (req: any, res) => {
    try {
      const companyId = String(req.body?.investmentCompanyId || "").trim();
      if (!companyId) return res.status(400).json({ error: "investmentCompanyId is required." });
      const profile = await findCompany(companyId);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      const rawContacts = Array.isArray(req.body.contacts) ? req.body.contacts : [Object.fromEntries(
        Object.entries(req.body).filter(([key]) => key !== "investmentCompanyId" && key !== "contacts"),
      )];
      if (!rawContacts.length || rawContacts.length > MAX_CONTACTS) return res.status(400).json({ error: `Provide between 1 and ${MAX_CONTACTS} contacts.` });
      const contacts = rawContacts.map((input: any) => normalizeContact(input));
      const visibility = await getDeveloperContactVisibility(profile.id);
      const emails: string[] = Array.from(new Set<string>(contacts.map((c: any) => String(c.email || "").toLowerCase()).filter(Boolean)));
      const duplicateEmails = await findAccessibleDeveloperCrmContactEmails(profile.id, visibility, emails);
      const seen = new Set<string>();
      const results: any[] = [];
      const isDryRun = sandbox(req);
      const work = async (tx: any) => {
        for (const contact of contacts) {
          const email = contact.email?.toLowerCase() || null;
          if (email && (seen.has(email) || duplicateEmails.has(email))) {
            results.push({ status: "skipped", reason: "duplicate_email", email });
            continue;
          }
          if (email) seen.add(email);
          const id = crypto.randomUUID();
          const values: any = { ...contact, id, email, ownerDeveloperProfileId: profile.id, createdAt: new Date(), updatedAt: new Date() };
          if (isDryRun) {
            results.push({ status: "would_create", contact: { ...values, id } });
            continue;
          }
          if (email) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${profile.id}:${email}`}, 0))`);
          if (email) {
            const [existing] = await tx.select({ id: brokers.id }).from(brokers).where(and(
              eq(brokers.ownerDeveloperProfileId, profile.id),
              sql`LOWER(${brokers.email}) = ${email}`,
            )).limit(1);
            if (existing) { results.push({ status: "skipped", reason: "duplicate_email", email }); continue; }
          }
          const [created] = await tx.insert(brokers).values(values).returning();
          await insertAudit(tx, asApiKeyId(req), CONTACTS_ROUTE, "crm_contact", created.id, null, created);
          results.push({ status: "created", contact: created });
        }
      };
      if (isDryRun) await work(null);
      else await db.transaction(work);
      return res.status(isDryRun ? 200 : 201).json({
        ok: true, dryRun: isDryRun,
        created: isDryRun ? 0 : results.filter((r) => r.status === "created").length,
        wouldCreate: isDryRun ? results.filter((r) => r.status === "would_create").length : undefined,
        skipped: results.filter((r) => r.status === "skipped").length,
        results,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Invalid contact request." });
    }
  });

  app.patch(`${CONTACTS_ROUTE}/:id`, requireApiKey, contactWriteLimiter, async (req: any, res) => {
    try {
      const companyId = String(req.body?.investmentCompanyId || req.query.investmentCompanyId || "").trim();
      if (!companyId) return res.status(400).json({ error: "investmentCompanyId is required." });
      const profile = await findCompany(companyId);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      const patch = normalizeContact(Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => key !== "investmentCompanyId")), true);
      if (!Object.keys(patch).length) return res.status(400).json({ error: "Provide at least one contact field to update." });
      const visibility = await getDeveloperContactVisibility(profile.id);
      const [contact] = await db.select().from(brokers).where(eq(brokers.id, req.params.id)).limit(1);
      if (!contact || (contact.ownerDeveloperProfileId !== profile.id && !await isAccessibleDeveloperCrmContact(profile.id, visibility, contact.id))) {
        return res.status(404).json({ error: "CRM contact not found." });
      }
      const isShared = contact.ownerDeveloperProfileId == null;
      const privateOnly = new Set(["crmTags", "crmNotes", "assignedTo", "lastContactedAt"]);
      if (isShared && Object.keys(patch).some((key) => !privateOnly.has(key))) return res.status(403).json({ error: "Shared broker identity fields cannot be edited through this company CRM." });
      const isDryRun = sandbox(req);
      const before = { ...contact };
      const after = { ...contact, ...patch };
      if (isDryRun) return res.json({ ok: true, dryRun: true, wouldChange: after });
      const saved = await db.transaction(async (tx) => {
        let updated: any;
        if (isShared) {
          const crmPatch: any = { developerProfileId: profile.id, brokerId: contact.id, updatedAt: new Date() };
          for (const key of ["crmTags", "crmNotes", "assignedTo", "lastContactedAt"]) if (patch[key] !== undefined) crmPatch[key] = patch[key];
          const [row] = await tx.insert(developerBrokerCrm).values(crmPatch).onConflictDoUpdate({
            target: [developerBrokerCrm.developerProfileId, developerBrokerCrm.brokerId],
            set: crmPatch,
          }).returning();
          updated = { ...contact, ...row };
        } else {
          [updated] = await tx.update(brokers).set({ ...patch, updatedAt: new Date() }).where(and(
            eq(brokers.id, contact.id), eq(brokers.ownerDeveloperProfileId, profile.id),
          )).returning();
        }
        await insertAudit(tx, asApiKeyId(req), `${CONTACTS_ROUTE}/:id`, "crm_contact", contact.id, before, updated);
        return updated;
      });
      return res.json({ ok: true, contact: saved });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Invalid contact update." });
    }
  });

  registerBotApiRoutes(app, requireBotApiKey);
}

function registerBotApiRoutes(app: Express, requireBotApiKey: RequestHandler) {
  const route = "/api/v1/bot/developer-profiles/:profileId";
  const requireScope = (scope: BotApiScope): RequestHandler => (req: any, res, next) => {
    if (!hasBotApiScope(req.apiKeyRow?.scopes, scope)) {
      return res.status(403).json({ error: "This bot key is not authorized for that operation." });
    }
    if (!isBotProfileAuthorized(req.apiKeyRow?.developerProfileId, req.params.profileId)) {
      return res.status(404).json({ error: "Investment Company not found." });
    }
    next();
  };
  const payloadLimit = (maxBytes: number): RequestHandler => (req, res, next) => {
    let bytes: number;
    try { bytes = Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8"); }
    catch { return res.status(400).json({ error: "Request body must be JSON." }); }
    if (bytes > maxBytes) return res.status(413).json({ error: "Request body exceeds the allowed size." });
    next();
  };

  app.get(route, requireBotApiKey, requireScope("developer_profiles:read"), botReadLimiter, async (req: any, res) => {
    try {
      const profile = await findCompany(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      return res.json(await criteriaSnapshot(db, profile));
    } catch {
      return res.status(500).json({ error: "Unable to load the developer profile." });
    }
  });

  app.patch(route, requireBotApiKey, requireScope("developer_profiles:update"), botWriteLimiter, payloadLimit(64 * 1024), async (req: any, res) => {
    try {
      const profile = await findCompany(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      if (!isRecord(req.body)) return res.status(400).json({ error: "Request body must be a JSON object." });
      const allowed = new Set([
        "companyName", "targetStates", "targetCounties", "minAcres", "maxAcres",
        "rentMetric", "minRentPsf", "minRentPerUnit", "criteriaNotes",
      ]);
      for (const key of Object.keys(req.body)) {
        if (!allowed.has(key)) return res.status(400).json({ error: `Unsupported profile field: ${key}` });
      }
      if (!Object.keys(req.body).length) return res.status(400).json({ error: "Provide at least one profile field." });
      const updates: Record<string, any> = {};
      if (req.body.companyName !== undefined) {
        const name = str(req.body.companyName, 160);
        if (!name) return res.status(400).json({ error: "companyName cannot be empty." });
        updates.companyName = name;
      }
      for (const field of ["targetStates", "targetCounties"] as const) {
        if (req.body[field] === undefined) continue;
        const values = req.body[field];
        if (!Array.isArray(values) || values.length > 300 || values.some((v: unknown) => typeof v !== "string" || v.length > 120)) {
          return res.status(400).json({ error: `${field} must be an array of at most 300 short strings.` });
        }
        updates[field] = Array.from(new Set(values.map((v: string) => v.trim()).filter(Boolean)));
        if (field === "targetStates") {
          updates[field] = updates[field].map((state: string) => state.toUpperCase());
          if (updates[field].some((state: string) => !/^[A-Z]{2}$/.test(state))) {
            return res.status(400).json({ error: "targetStates must contain two-letter state codes." });
          }
        }
      }
      if (req.body.rentMetric !== undefined) {
        if (!["psf", "per_unit"].includes(req.body.rentMetric)) return res.status(400).json({ error: "rentMetric must be psf or per_unit." });
        updates.rentMetric = req.body.rentMetric;
      }
      for (const field of ["minAcres", "maxAcres", "minRentPsf", "minRentPerUnit"] as const) {
        if (req.body[field] !== undefined) {
          const n = numberOrNull(req.body[field], field);
          updates[field] = n === null ? null : String(n);
        }
      }
      if (req.body.criteriaNotes !== undefined) updates.criteriaNotes = str(req.body.criteriaNotes, 4000);
      const minAcres = Number(updates.minAcres ?? profile.minAcres);
      const maxAcres = updates.maxAcres === undefined ? (profile.maxAcres == null ? null : Number(profile.maxAcres)) : updates.maxAcres === null ? null : Number(updates.maxAcres);
      if (maxAcres !== null && maxAcres < minAcres) return res.status(400).json({ error: "maxAcres must be at least minAcres." });

      const isDryRun = sandbox(req);
      const changedFields = Object.keys(updates);
      if (isDryRun) return res.json({ ok: true, dryRun: true, wouldChange: { profileId: profile.id, changedFields } });
      await db.transaction(async (tx) => {
        const [saved] = await tx.update(developerProfiles).set({ ...updates, updatedAt: new Date() })
          .where(eq(developerProfiles.id, profile.id)).returning({ id: developerProfiles.id });
        if (!saved) throw new Error("Profile update failed.");
        await insertAudit(tx, asApiKeyId(req), `${route}`, "investment_company_profile", profile.id, { changedFields: [] }, { changedFields });
      });
      return res.json({ ok: true, changedFields });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Invalid profile update." });
    }
  });

  app.get(`${route}/deals`, requireBotApiKey, requireScope("deals:read"), botReadLimiter, async (req: any, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const offset = Number(req.query.offset || 0);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100_000) {
        return res.status(400).json({ error: "limit must be 1-100 and offset must be 0-100000." });
      }
      const rows = await db.select({
        id: deals.id, dealNumber: deals.dealNumber, propertyName: deals.propertyName,
        address: deals.address, city: deals.city, county: deals.county, state: deals.state,
        zip: deals.zip, parcelId: deals.parcelId, dealType: deals.dealType,
        sizeAcres: deals.sizeAcres, askingPrice: deals.askingPrice, unitCount: deals.unitCount,
        vintage: deals.vintage, zoning: deals.zoning, status: deals.status,
        classification: partnerDeveloperSends.classification, matchedAt: partnerDeveloperSends.matchedAt,
      }).from(partnerDeveloperSends)
        .innerJoin(deals, eq(partnerDeveloperSends.dealId, deals.id))
        .where(eq(partnerDeveloperSends.developerProfileId, req.params.profileId))
        .orderBy(sql`${partnerDeveloperSends.matchedAt} DESC NULLS LAST`)
        .limit(limit + 1).offset(offset);
      return res.json({ deals: rows.slice(0, limit), pagination: { limit, offset, hasMore: rows.length > limit } });
    } catch {
      return res.status(500).json({ error: "Unable to load company deals." });
    }
  });

  app.post(`${route}/deals`, requireBotApiKey, requireScope("deals:upload"), botWriteLimiter, payloadLimit(64 * 1024), async (req: any, res) => {
    try {
      if (!isRecord(req.body)) return res.status(400).json({ error: "Request body must be a JSON object." });
      const allowed = new Set([
        "propertyName", "address", "city", "county", "state", "zip", "parcelId",
        "dealType", "propertyType", "sizeAcres", "askingPrice", "unitCount", "vintage", "zoning",
      ]);
      for (const key of Object.keys(req.body)) if (!allowed.has(key)) return res.status(400).json({ error: `Unsupported deal field: ${key}` });
      const address = str(req.body.address, 500);
      const city = str(req.body.city, 120);
      const county = str(req.body.county, 120);
      const state = str(req.body.state, 2)?.toUpperCase();
      if (!address || !city || !county || !state || !/^[A-Z]{2}$/.test(state)) {
        return res.status(400).json({ error: "address, city, county, and two-letter state are required." });
      }
      const profile = await findCompany(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Investment Company not found." });
      if (profile.profileType !== "real_estate") return res.status(409).json({ error: "Deal uploads are only available for real-estate profiles." });
      const sizeAcres = numberOrNull(req.body.sizeAcres, "sizeAcres");
      const askingPrice = numberOrNull(req.body.askingPrice, "askingPrice");
      const unitCount = numberOrNull(req.body.unitCount, "unitCount", true);
      const vintage = numberOrNull(req.body.vintage, "vintage", true);
      if (vintage !== null && (vintage < 1800 || vintage > 2100)) return res.status(400).json({ error: "vintage must be between 1800 and 2100." });
      const dealType = req.body.dealType === undefined ? "land" : str(req.body.dealType, 40);
      if (!["land", "acquisition", "existing_multifamily"].includes(dealType || "")) {
        return res.status(400).json({ error: "dealType must be land, acquisition, or existing_multifamily." });
      }
      const values: Record<string, any> = {
        propertyName: str(req.body.propertyName, 200),
        address, city, county, state,
        zip: str(req.body.zip, 10),
        parcelId: str(req.body.parcelId, 100),
        dealType,
        propertyType: str(req.body.propertyType, 100),
        sizeAcres: sizeAcres === null ? null : String(sizeAcres),
        askingPrice: askingPrice === null ? null : String(askingPrice),
        unitCount,
        vintage,
        zoning: str(req.body.zoning, 200),
        submissionMethod: "api",
        status: "pending_review",
      };
      const isDryRun = sandbox(req);
      if (isDryRun) return res.status(200).json({ ok: true, dryRun: true, wouldUpload: { profileId: profile.id, changedFields: Object.keys(values) } });

      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(LOWER(TRIM(${address})))::bigint)`);
        const [existing] = await tx.select().from(deals)
          .where(sql`LOWER(TRIM(${deals.address})) = LOWER(TRIM(${address}))`).limit(1);
        let deal: any;
        let updatedCanonical = false;
        let existingSend: any = null;
        if (existing) {
          [existingSend] = await tx.select({ id: partnerDeveloperSends.id })
            .from(partnerDeveloperSends)
            .where(and(
              eq(partnerDeveloperSends.developerProfileId, profile.id),
              eq(partnerDeveloperSends.dealId, existing.id),
            )).limit(1);
          if (existingSend) {
            const updateValues = { ...values };
            delete updateValues.status;
            delete updateValues.submissionMethod;
            [deal] = await tx.update(deals).set({ ...updateValues, updatedAt: new Date() })
              .where(eq(deals.id, existing.id)).returning();
            updatedCanonical = true;
          } else {
            deal = existing;
          }
        } else {
          [deal] = await tx.insert(deals).values(values as any).returning();
          updatedCanonical = true;
        }
        const [recipient] = await tx.select({ id: partnerDevelopers.id })
          .from(partnerDevelopers).where(eq(partnerDevelopers.developerProfileId, profile.id)).limit(1);
        const [send] = await tx.insert(partnerDeveloperSends).values({
          developerId: recipient?.id || profile.id,
          developerProfileId: profile.id,
          dealId: deal.id,
          classification: "review",
          address: deal.address,
          status: "sent",
          matchedAt: new Date(),
        }).onConflictDoUpdate({
          target: [partnerDeveloperSends.developerProfileId, partnerDeveloperSends.dealId],
          set: { address: deal.address, matchedAt: new Date() },
        }).returning({ id: partnerDeveloperSends.id });
        await insertAudit(tx, asApiKeyId(req), `${route}/deals`, "deal", deal.id,
          { changedFields: [] }, { changedFields: Object.keys(values), profileId: profile.id });
        return { deal, sendId: send.id, reusedExistingDeal: Boolean(existing), updatedCanonical };
      });
      return res.status(result.reusedExistingDeal ? 200 : 201).json({
        ok: true,
        deal: {
          id: result.deal.id, dealNumber: result.deal.dealNumber, address: result.deal.address,
          city: result.deal.city, county: result.deal.county, state: result.deal.state,
          status: result.deal.status,
        },
        companyDealId: result.sendId,
        reusedExistingDeal: result.reusedExistingDeal,
        updatedCanonical: result.updatedCanonical,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Invalid deal upload." });
    }
  });

  const campaignDraftsRoute = `${route}/campaign-drafts`;
  app.get(campaignDraftsRoute, requireBotApiKey, requireScope("campaigns:draft"), botReadLimiter, async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT c.id, c.name, c.status, c.created_at AS "createdAt",
               t.id AS "templateId", COUNT(s.id)::int AS "stepCount"
        FROM outreach_campaigns c
        JOIN outreach_campaign_templates t
          ON t.id = c.broker_filter->>'templateId'
         AND t.team_id = ${req.params.profileId}
         AND t.is_active = false
         AND t.hubspot_trigger_tag LIKE ${`bot-draft:${req.params.profileId}:%`}
        LEFT JOIN outreach_campaign_template_steps s ON s.template_id = t.id
        WHERE c.developer_profile_id = ${req.params.profileId}
          AND c.status = 'paused'
          AND COALESCE(c.is_archived, false) = false
          AND COALESCE(c.is_deleted, false) = false
        GROUP BY c.id, t.id
        ORDER BY c.created_at DESC
        LIMIT 100
      `);
      return res.json({ drafts: result.rows });
    } catch {
      return res.status(500).json({ error: "Unable to load campaign drafts." });
    }
  });

  app.post(campaignDraftsRoute, requireBotApiKey, requireScope("campaigns:draft"), botWriteLimiter, payloadLimit(200 * 1024), async (req: any, res) => {
    try {
      if (!isRecord(req.body)) return res.status(400).json({ error: "Request body must be a JSON object." });
      for (const key of Object.keys(req.body)) if (!["name", "description", "steps"].includes(key)) {
        return res.status(400).json({ error: `Unsupported campaign field: ${key}` });
      }
      const name = str(req.body.name, 160);
      const description = str(req.body.description, 1000);
      const rawSteps = req.body.steps;
      if (!name || !Array.isArray(rawSteps) || rawSteps.length < 1 || rawSteps.length > 8) {
        return res.status(400).json({ error: "name and 1-8 campaign steps are required." });
      }
      const steps = rawSteps.map((step: unknown, index: number) => {
        if (!isRecord(step)) throw new Error(`steps[${index}] must be an object.`);
        for (const key of Object.keys(step)) if (!["dayNumber", "subject", "content"].includes(key)) {
          throw new Error(`Unsupported field in steps[${index}].`);
        }
        const dayNumber = Number(step.dayNumber ?? 0);
        const subject = str(step.subject, 240);
        const content = str(step.content, 20_000);
        if (!Number.isInteger(dayNumber) || dayNumber < 0 || dayNumber > 365 || !content) {
          throw new Error(`steps[${index}] requires valid dayNumber and content.`);
        }
        return { dayNumber, subject, content };
      });
      if (steps.reduce((sum, step) => sum + step.content.length, 0) > 100_000) {
        return res.status(400).json({ error: "Combined campaign content exceeds 100000 characters." });
      }
      const isDryRun = sandbox(req);
      if (isDryRun) return res.status(200).json({
        ok: true, dryRun: true, wouldCreate: { profileId: req.params.profileId, name, stepCount: steps.length, status: "paused" },
      });
      const campaign = await db.transaction(async (tx) => {
        const [created] = await tx.insert(outreachCampaigns).values({
          developerProfileId: req.params.profileId,
          name,
          status: "paused",
          cadence: "drip",
          channels: ["email"],
          brokerFilter: {},
          rateLimitPerMinute: 10,
          isArchived: false,
          isDeleted: false,
        } as any).returning({ id: outreachCampaigns.id, name: outreachCampaigns.name, status: outreachCampaigns.status });
        const triggerTag = `bot-draft:${req.params.profileId}:${created.id}`;
        const [template] = await tx.insert(outreachCampaignTemplates).values({
          name,
          description: description || "Draft created through the scoped bot API.",
          hubspotTriggerTag: triggerTag,
          teamId: req.params.profileId,
          isActive: false,
        }).returning({ id: outreachCampaignTemplates.id });
        await tx.insert(outreachCampaignTemplateSteps).values(steps.map((step, index) => ({
          templateId: template.id,
          sequenceIndex: index,
          dayNumber: step.dayNumber,
          channel: "email",
          subject: step.subject,
          content: step.content,
          isActive: false,
        })));
        await tx.update(outreachCampaigns).set({ brokerFilter: { templateId: template.id } })
          .where(and(eq(outreachCampaigns.id, created.id), eq(outreachCampaigns.developerProfileId, req.params.profileId)));
        await insertAudit(tx, asApiKeyId(req), campaignDraftsRoute, "campaign_draft", created.id,
          null, { stepCount: steps.length, status: "paused", profileId: req.params.profileId });
        return { ...created, templateId: template.id, stepCount: steps.length };
      });
      return res.status(201).json({ ok: true, campaign });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "Invalid campaign draft." });
    }
  });
}
