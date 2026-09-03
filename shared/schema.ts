import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  decimal,
  doublePrecision,
  integer,
  date,
  bigint,
  unique,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Investment Company profiles — tenant-specific branding and acquisition criteria
export const developerProfiles = pgTable("developer_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: varchar("company_name").notNull(),
  slug: varchar("slug").notNull().unique(),
  logoUrl: varchar("logo_url"),
  primaryColor: varchar("primary_color").default("#0A2B4A"),
  secondaryColor: varchar("secondary_color").default("#4A90E2"),
  isInternal: boolean("is_internal").default(false),
  knownEmailDomains: text("known_email_domains").array(),

  // Rent criteria — primary drives classification, secondary is reference only
  rentMetric: varchar("rent_metric").notNull(), // 'psf' | 'per_unit'
  minRentPsf: decimal("min_rent_psf"),
  minRentPerUnit: decimal("min_rent_per_unit"),
  compSearchRadiusMiles: decimal("comp_search_radius_miles").default("3"),

  // Acreage — flat default + optional per-product-type overrides
  minAcres: decimal("min_acres").notNull(),
  maxAcres: decimal("max_acres"),
  acreageOverridesByProductType: jsonb("acreage_overrides_by_product_type").default('{}'),

  // QCT/DDA/OZ rent-minimum override toggles
  qctOverridesRentMinimum: boolean("qct_overrides_rent_minimum").default(false),
  ddaOverridesRentMinimum: boolean("dda_overrides_rent_minimum").default(false),
  ozOverridesRentMinimum: boolean("oz_overrides_rent_minimum").default(false),

  targetStates: text("target_states").array().notNull(),
  targetCounties: text("target_counties").array().notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const developerProductTypes = pgTable("developer_product_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerProfileId: varchar("developer_profile_id")
    .references(() => developerProfiles.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name").notNull(),
  minAcres: decimal("min_acres").notNull(),
  maxAcres: decimal("max_acres"),
  minRentPsf: decimal("min_rent_psf"),
  minRentPerUnit: decimal("min_rent_per_unit"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("developer_product_types_profile_idx").on(table.developerProfileId),
]);

export const insertDeveloperProductTypeSchema = createInsertSchema(developerProductTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DeveloperProductType = typeof developerProductTypes.$inferSelect;
export type InsertDeveloperProductType = z.infer<typeof insertDeveloperProductTypeSchema>;

// Display-only grouping for the targetCounties array. Classification continues
// to read developer_profiles.target_counties and never consults this table.
export const developerCountyMarketLabels = pgTable("developer_county_market_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerProfileId: varchar("developer_profile_id")
    .references(() => developerProfiles.id, { onDelete: "cascade" })
    .notNull(),
  county: varchar("county").notNull(),
  marketLabel: varchar("market_label").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("developer_county_market_labels_profile_county_unique")
    .on(table.developerProfileId, table.county),
  index("developer_county_market_labels_profile_idx").on(table.developerProfileId),
]);

export const insertDeveloperCountyMarketLabelSchema = createInsertSchema(developerCountyMarketLabels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DeveloperCountyMarketLabel = typeof developerCountyMarketLabels.$inferSelect;

// Shared HelloData comparable warehouse. Results are reusable across companies
// when a later search is geographically covered by an unexpired cached search.
export const marketCompCache = pgTable("market_comp_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerLatitude: decimal("center_latitude", { precision: 10, scale: 7 }).notNull(),
  centerLongitude: decimal("center_longitude", { precision: 10, scale: 7 }).notNull(),
  searchRadiusMiles: decimal("search_radius_miles", { precision: 6, scale: 2 }).notNull(),
  productType: varchar("product_type"),
  comparablesJson: jsonb("comparables_json").notNull(),
  avgRentPsf: decimal("avg_rent_psf", { precision: 10, scale: 2 }),
  avgRentPerUnit: decimal("avg_rent_per_unit", { precision: 12, scale: 2 }),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  sourceDeveloperProfileId: varchar("source_developer_profile_id").references(() => developerProfiles.id, { onDelete: "set null" }),
}, (table) => ({
  activeLookupIdx: index("market_comp_cache_active_lookup_idx").on(
    table.productType,
    table.expiresAt,
  ),
}));

export const insertMarketCompCacheSchema = createInsertSchema(marketCompCache).omit({
  id: true,
  fetchedAt: true,
});
export type InsertMarketCompCache = z.infer<typeof insertMarketCompCacheSchema>;
export type MarketCompCache = typeof marketCompCache.$inferSelect;

export const insertDeveloperProfileSchema = createInsertSchema(developerProfiles).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type DeveloperProfile = typeof developerProfiles.$inferSelect;
export type InsertDeveloperProfile = z.infer<typeof insertDeveloperProfileSchema>;

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  role: varchar("role").default("BROKER"), // System role for permissions
  mustResetPassword: boolean("must_reset_password").default(false).notNull(),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  dealRole: varchar("deal_role"), // Role for deal dashboard workflow
  productTypes: text("product_types").array(), // Product types assigned to this team member
  states: text("states").array(), // States/regions assigned to this team member
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Internal analysts may cover multiple Investment Companies
export const analystProfileAssignments = pgTable("analyst_profile_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("analyst_profile_unique").on(table.userId, table.developerProfileId),
]);

// Broker registration and profile
export const brokers = pgTable("brokers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  ownerDeveloperProfileId: varchar("owner_developer_profile_id").references(() => developerProfiles.id),
  phone: varchar("phone"),
  marketsCovered: text("markets_covered"),
  brokerage: varchar("brokerage"),
  yearsExperience: varchar("years_experience"),
  isActive: boolean("is_active").default(true),
  preferredContact: varchar("preferred_contact").default("email"),
  // SMS opt-in/opt-out tracking
  smsOptIn: boolean("sms_opt_in").default(false),
  smsOptInDate: timestamp("sms_opt_in_date"),
  smsOptOutDate: timestamp("sms_opt_out_date"),
  // Gamification fields
  totalPoints: integer("total_points").default(0),
  currentLevel: integer("current_level").default(1),
  referralCode: varchar("referral_code"),
  referredBy: varchar("referred_by"),
  shareCount: integer("share_count").default(0),
  consecutiveDeals: integer("consecutive_deals").default(0),
  // Viral loop metrics
  viralSignupsGenerated: integer("viral_signups_generated").default(0),
  totalTagsSent: integer("total_tags_sent").default(0),
  lastActivityDate: timestamp("last_activity_date"),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  profileImageUrl: varchar("profile_image_url"),
  company: varchar("company"),
  licenseNumber: varchar("license_number"),
  bio: text("bio"),
  websiteUrl: varchar("website_url"),
  socialMediaLinks: jsonb("social_media_links"),
  crmTags: text("crm_tags").array(), // Internal CRM tags for contact segmentation
  crmNotes: text("crm_notes"),       // Internal CRM notes about this contact
  lastContactedAt: timestamp("last_contacted_at"), // Last outreach activity
  stateRegion: varchar("state_region"), // State/region abbreviation (e.g. TN, NC)
  assignedTo: text("assigned_to"),   // Team member name/email responsible for outreach
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("brokers_owner_email_idx").on(table.ownerDeveloperProfileId, table.email),
  uniqueIndex("brokers_owner_email_unique").on(table.ownerDeveloperProfileId, table.email),
  uniqueIndex("brokers_shared_email_unique")
    .on(table.email)
    .where(sql`${table.ownerDeveloperProfileId} IS NULL AND ${table.email} IS NOT NULL`),
]);

// Deal status values: pending_review, pending_info, under_review, approved, rejected,
// clear_no, potentially, high_priority, initial_review, due_diligence, financial_analysis,
// final_review, contract_negotiation, closing, completed

// Deal classification values: unclassified, red, yellow, green, lost, dead

// Risk level values: clean, low, medium, high

// Validation status values: active, blocked, escalated, resolved, force_approved,
// analyst_override, emergency_review, insufficient_data, emergency_error

// Deal type values: land, acquisition

// Property deals submitted by brokers
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealNumber: integer("deal_number").generatedAlwaysAsIdentity({ startWith: 1 }),
  brokerId: varchar("broker_id").references(() => brokers.id),
  dealType: varchar("deal_type").default("land"), // Land development or acquisition deal
  brokerPhone: varchar("broker_phone"),
  teamMemberEmails: jsonb("team_member_emails"),
  taggedEmails: jsonb("tagged_emails"),
  taggedLinkedIn: jsonb("tagged_linkedin"),
  pricingType: varchar("pricing_type").default("whole_deal"),
  developer: varchar("developer"),
  partner: varchar("partner"),
  userAskingPrice: decimal("user_asking_price", { precision: 12, scale: 2 }),
  userSizeAcres: decimal("user_size_acres", { precision: 8, scale: 2 }),
  apiSizeAcres: decimal("api_size_acres", { precision: 8, scale: 2 }),
  apiEstimatedPrice: decimal("api_estimated_price", { precision: 12, scale: 2 }),
  lihtcUnits30AmiLegacy: integer("lihtc_units_30_ami"),
  lihtcUnits40AmiLegacy: integer("lihtc_units_40_ami"),
  lihtcUnits50AmiLegacy: integer("lihtc_units_50_ami"),
  lihtcSection1602Status: text("lihtc_section1602_status"),
  address: text("address").notNull(),
  zip: varchar("zip", { length: 10 }), // Separate ZIP code field for HelloData auto-classification
  city: varchar("city"), // City name from geocoding (e.g., "Charlotte")
  // Geocoded coordinates for map visualization
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  askingPrice: decimal("asking_price", { precision: 12, scale: 2 }), // Broker's asking price for the property
  sizeAcres: decimal("size_acres", { precision: 8, scale: 2 }),
  netDevelopableAcres: decimal("net_developable_acres", { precision: 8, scale: 2 }),
  unitCount: integer("unit_count"),
  maxUnitsByZoning: integer("max_units_by_zoning"), // Analyst-entered maximum units allowed by zoning
  vintage: integer("vintage"), // Year built - important for acquisition deals
  hasEntitlements: boolean("has_entitlements"),
  parcelId: varchar("parcel_id"),
  zoning: varchar("zoning"), // Property zoning designation (R-4, R-2, etc.)
  sewerAvailable: boolean("sewer_available"), // NULL when not specified by broker
  topRentPSF: decimal("top_rent_psf", { precision: 8, scale: 2 }), // Top Rent PSF - highest weighted average rent from HelloData comparables
  avgRentPSF: decimal("avg_rent_psf", { precision: 8, scale: 2 }), // Average Rent PSF - average of all qualifying comparables
  topRentPerUnit: decimal("top_rent_per_unit", { precision: 8, scale: 2 }), // Top Rent per Unit - highest monthly rent from comparables
  avgRentPerUnit: decimal("avg_rent_per_unit", { precision: 8, scale: 2 }), // Average Rent per Unit - average monthly rent from comparables
  productTypes: jsonb("product_types"), // array of selected product types
  propertyName: varchar("property_name"), // Name/title of the property development
  underContract: boolean("under_contract").default(false), // Dec 15, 2025: Property is under contract
  loiSubmitted: boolean("loi_submitted").default(false), // Dec 15, 2025: LOI has been submitted
  apex: boolean("apex").default(false), // Apex deal flag
  apexNotes: text("apex_notes"), // Notes for Apex deals
  nextAssignee: varchar("next_assignee"), // Dec 15, 2025: Next person responsible (Austin Blondell, John Bell, Steve Hillebrand, AJ Klenk, Brian Ford)
  dealStep: varchar("deal_step"), // Dec 15, 2025: Current deal step (LOI, UW, Broker, UW - Reviewing)
  // Additional fields for AI analysis
  constructionCostPerSF: decimal("construction_cost_per_sf", { precision: 8, scale: 2 }),
  projectedRentPerSF: decimal("projected_rent_per_sf", { precision: 8, scale: 2 }),
  totalProjectCost: decimal("total_project_cost", { precision: 12, scale: 2 }),
  projectedNOI: decimal("projected_noi", { precision: 12, scale: 2 }),
  marketCapRate: decimal("market_cap_rate", { precision: 5, scale: 3 }),
  // Excel UW extraction — additional pro-forma line items (from analyst-uploaded templates)
  projectedGPR: decimal("projected_gpr", { precision: 12, scale: 2 }),          // Gross Potential Rent (annual $)
  projectedEGI: decimal("projected_egi", { precision: 12, scale: 2 }),          // Effective Gross Income (annual $)
  projectedOpex: decimal("projected_opex", { precision: 12, scale: 2 }),        // Operating Expenses (annual $)
  projectedHardCost: decimal("projected_hard_cost", { precision: 12, scale: 2 }), // Hard construction costs ($)
  projectedSoftCost: decimal("projected_soft_cost", { precision: 12, scale: 2 }), // Soft costs ($)
  projectedVacancyLoss: decimal("projected_vacancy_loss", { precision: 12, scale: 2 }), // Vacancy + credit loss ($)
  projectedRentPerUnit: decimal("projected_rent_per_unit", { precision: 8, scale: 2 }), // Blended monthly rent/unit ($)
  seniorLoanPct: decimal("senior_loan_pct", { precision: 5, scale: 2 }), // Senior construction loan % from Excel capital stack (e.g. 65.00)
  investmentMemoUrl: text("investment_memo_url"), // Object-storage path to the generated investment memo PDF
  yieldOnCost: text("yield_on_cost"), // Yield on cost — free text notes (e.g. "8.5%" or "8.5% - conservative est.")
  irr: text("irr"), // Internal Rate of Return — manually entered by analyst (e.g. "14.88%")
  automatedYoc: text("automated_yoc"), // Auto-calculated YOC from underwriting model when product types are selected
  yocOverrides: text("yoc_overrides"), // JSON: analyst field overrides for the Auto YOC breakdown modal
  brokerPortalApproved: boolean("broker_portal_approved").default(false), // Admin-approved for broker portal display + auto-email
  underwritingState: text("underwriting_state"), // JSON: full phase + shared-assumption state from the underwriter UI
  developmentTimelineMonths: integer("development_timeline_months"),
  unitSize: decimal("unit_size", { precision: 8, scale: 2 }), // square feet per unit
  // Property intelligence and estimates
  estimatedUnits: integer("estimated_units"),
  estimatedRentPSF: decimal("estimated_rent_psf", { precision: 8, scale: 2 }),
  estimatedAnnualGrossRent: decimal("estimated_annual_gross_rent", { precision: 12, scale: 2 }),
  // Demographics for Active Adult communities
  population55Plus5Mile: integer("population_55_plus_5_mile"), // 55+ population within 5 miles
  income75Plus55Plus: integer("income_75_plus_55_plus"), // 55+ population with $75k+ income
  demographicsNotes: text("demographics_notes"),
  // Census Bureau demographics (ACS 5-year data)
  censusTotalPopulation: integer("census_total_population"), // Total population in area
  censusMedianIncome: integer("census_median_income"), // Median household income
  censusMedianAge: decimal("census_median_age", { precision: 4, scale: 1 }), // Median age
  censusVacancyRate: decimal("census_vacancy_rate", { precision: 5, scale: 2 }), // Housing vacancy rate %
  censusRenterRate: decimal("census_renter_rate", { precision: 5, scale: 2 }), // Renter-occupied housing %
  censusPopGrowth: decimal("census_pop_growth", { precision: 5, scale: 2 }), // Population growth rate %
  censusTractId: varchar("census_tract_id"), // Census tract FIPS code for reference
  // Automated routing assignments
  assignedAnalyst: varchar("assigned_analyst"),
  assignedJrAnalyst: varchar("assigned_jr_analyst"),
  assignedDeveloper: varchar("assigned_developer"), 
  assignedPartner: varchar("assigned_partner"),
  nextSteps: text("next_steps"),
  brokerNotes: text("broker_notes"), // Broker-submitted notes (visible to broker)
  status: varchar("status").default("pending_review"),
  classification: varchar("classification").default("unclassified"),
  suggestedDevelopmentType: varchar("suggested_development_type"), // AI-recommended development type based on market analysis
  // Pipeline tracking fields
  statusUpdatedAt: timestamp("status_updated_at").defaultNow(),
  statusUpdatedBy: varchar("status_updated_by").references(() => users.id),
  pipelineStage: integer("pipeline_stage").default(1), // 1-7 for tracking progress
  timeInCurrentStage: integer("time_in_current_stage").default(0), // hours
  totalPipelineTime: integer("total_pipeline_time").default(0), // hours
  stageHistory: jsonb("stage_history"), // Track stage transitions with timestamps
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  estimatedCloseDate: date("estimated_close_date"),
  actualCloseDate: date("actual_close_date"),
  aiAnalysisData: jsonb("ai_analysis_data"),
  submissionMethod: varchar("submission_method").notNull(), // email, sms, form
  source: varchar("source").default("landlinq_sourced").notNull(),
  submissionCount: integer("submission_count").default(1), // Track duplicate submissions - increments when same address resubmitted
  lastResubmittedAt: timestamp("last_resubmitted_at"), // When the last duplicate submission occurred
  documentUrls: jsonb("document_urls"), // array of file URLs (attachments, links, images) - broker uploaded
  analystDocumentUrls: jsonb("analyst_document_urls"), // array of file URLs uploaded by analysts
  analystNotes: text("analyst_notes"), // Human analyst notes
  dealSummary: text("deal_summary"), // IC memo deal summary — analyst-written narrative pulled into Investment Memo
  developerNotes: text("developer_notes"), // Developer/broker notes (separate from analyst)
  developerSummary: text("developer_summary"), // Manually written summary shown to partner developers in deal emails
  excelModelUrl: text("excel_model_url"), // OneDrive/SharePoint Excel underwriting model link added by analyst
  wetlandNotes: text("wetland_notes"), // Manually written wetland/environmental notes shown to partner developers in deal emails
  ingestionNotes: text("ingestion_notes"), // System-generated notes from email parsing (OCR results, extracted links, etc.)
  rejectionReason: text("rejection_reason"), // Detailed explanation for rejected deals
  calculatedFields: jsonb("calculated_fields"), // Store custom formulas and their results
  // Additional fields will be added later when database is ready
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  // Archiving fields
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  
  // Deal Flagging System Fields
  flagged: boolean("flagged").default(false), // Whether this deal has been flagged for review
  riskLevel: varchar("risk_level").default("clean"), // Overall risk assessment
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // Overall data confidence (0-100)
  dataQualityIssues: jsonb("data_quality_issues"), // Array of specific data quality issues
  validationFlags: jsonb("validation_flags"), // Detailed validation flags and metadata
  sourceConflicts: jsonb("source_conflicts"), // Data conflicts between sources
  flaggedAt: timestamp("flagged_at"), // When the deal was flagged
  flaggedBy: varchar("flagged_by"), // "system" or analyst ID who flagged it
  flaggingReason: text("flagging_reason"), // Primary reason for flagging
  specificWarnings: jsonb("specific_warnings"), // Array of specific analyst warnings
  estimatedReviewTime: integer("estimated_review_time"), // Estimated minutes needed for review
  lastValidationAt: timestamp("last_validation_at"), // When data was last validated
  validationHistory: jsonb("validation_history"), // Track validation attempts and results
  analystReviewStatus: varchar("analyst_review_status").default("pending"), // pending, in_review, completed
  reviewStartedAt: timestamp("review_started_at"), // When analyst started reviewing flagged issues
  reviewCompletedAt: timestamp("review_completed_at"), // When flagged issues were resolved
  reviewNotes: text("review_notes"), // Analyst notes about the flagged issues
  dataCorrections: jsonb("data_corrections"), // Track any data corrections made during review
  
  // Public Listing Cross-Reference System
  publicListings: jsonb("public_listings"), // Cross-reference with public listing platforms
  
  // Deal Validation and Blocking System
  validationStatus: varchar("validation_status").default("active"),
  blockedAt: timestamp("blocked_at"),
  blockedBy: varchar("blocked_by"),
  validationTimeoutAt: timestamp("validation_timeout_at"),
  escalatedAt: timestamp("escalated_at"),
  analystOverride: boolean("analyst_override").default(false),
  blockingReason: text("blocking_reason"),
  // Additional analyst override fields
  analystOverrideBy: varchar("analyst_override_by"),
  analystOverrideAt: timestamp("analyst_override_at"),
  analystOverrideReason: text("analyst_override_reason"),
  forceApproved: boolean("force_approved").default(false),
  escalated: boolean("escalated").default(false),
  
  // Emergency Review System Fields
  emergencyReviewFlag: boolean("emergency_review_flag").default(false),
  emergencyTriggeredAt: timestamp("emergency_triggered_at"),
  emergencyReason: text("emergency_reason"),
  
  // QCT (Qualified Census Tract) Classification
  isQct: boolean("is_qct").default(false),
  qctStatus: varchar("qct_status"), // "YES" or "NO" - indicates if property is in a Qualified Census Tract
  censusTractFips: varchar("census_tract_fips"), // Census tract FIPS code from Geocodio
  // OZ (Opportunity Zone) Designation
  isOz: boolean("is_oz").default(false),
  ozStatus: varchar("oz_status"), // "YES" | "NO" | "N/A" - federally designated Qualified Opportunity Zone (IRC §1400Z)

  // DDA (Difficult Development Area) — HUD 2026 Designation
  // Properties in DDAs qualify for a 30% LIHTC basis boost (130% of normal eligible basis)
  isDda: boolean("is_dda").default(false),
  ddaStatus: varchar("dda_status"), // "MDDA" | "NMDDA" | "NO" | "N/A"
  ddaAreaName: varchar("dda_area_name"), // HUD area name for the DDA (e.g. "Charlotte-Concord-Gastonia, NC-SC HUD Metro FMR Area")
  ddaVlil: integer("dda_vlil"),           // 4-Person Very Low Income Limit ($) for the area
  ddaLihtcMaxRent: integer("dda_lihtc_max_rent"), // Max rent satisfying LIHTC income limits ($/mo)
  ddaFmr: integer("dda_fmr"),             // Fair Market Rent / Small Area FMR (2-bed, $/mo)

  // Novogradac GoZone — Additional Affordable Housing Designations
  ozEligible: varchar("oz_eligible"),     // "CONTIGUOUS" | "LIC" | "NO" | "N/A" — OZ-eligible but not necessarily designated
  nmtcStatus: varchar("nmtc_status"),     // "YES" | "NO" | "N/A" — New Markets Tax Credit investment in census tract
  nmtcProjectId: varchar("nmtc_project_id"), // NMTC project identifier (e.g. "NC0038")
  nmtcAmount: integer("nmtc_amount"),     // NMTC QLICI investment amount ($)
  nmtcPurpose: varchar("nmtc_purpose"),   // NMTC purpose (e.g. "Business Financing")
  lihtcNearbyJson: jsonb("lihtc_nearby_json"), // Array of LIHTC projects within 2km
  
  // MSA and County Information (auto-populated from Geocodio)
  county: varchar("county"), // County name from Geocodio (e.g., "Mecklenburg")
  state: varchar("state", { length: 2 }), // State abbreviation (e.g., "NC")
  msaName: varchar("msa_name"), // MSA name if in target market (e.g., "Charlotte MSA")
  inTargetMarket: boolean("in_target_market").default(false), // Whether this deal is in a target acquisition market
  targetProductTypes: text("target_product_types").array(), // Product types this market supports (from acquisitionMarkets)
  
  // New Classification Fields (HelloData Comparable-Based)
  comparableCount: integer("comparable_count"), // Number of qualifying comparables found
  comparableNotes: text("comparable_notes"), // Verbose HelloData comparable listing (individual properties, rent metrics)
  aiExplanatoryNotes: text("ai_explanatory_notes"), // Concise AI reasoning for acceptance/classification decision
  comparablesJson: jsonb("comparables_json"), // Structured HelloData comparables with lat/lng coordinates for map display
  comparablesFetchedAt: timestamp("comparables_fetched_at"), // When HelloData comparables were last fetched/refreshed
  
  // Regrid Parcel Data - Property enrichment from Regrid API
  regridData: jsonb("regrid_data"), // Full Regrid parcel data (owner, assessed values, tax info, etc.)
  ownerName: varchar("owner_name"), // Property owner name from Regrid
  assessedValue: decimal("assessed_value", { precision: 12, scale: 2 }), // Total assessed value from Regrid
  landValue: decimal("land_value", { precision: 12, scale: 2 }), // Land value from Regrid
  improvementValue: decimal("improvement_value", { precision: 12, scale: 2 }), // Improvement value from Regrid
  lastSalePrice: decimal("last_sale_price", { precision: 12, scale: 2 }), // Last sale price from Regrid
  lastSaleDate: varchar("last_sale_date"), // Last sale date from Regrid
  yearBuilt: integer("year_built"), // Year built from Regrid
  
  // Manual Geocoding Override Fields (for incorrect pins)
  manualLatitude: decimal("manual_latitude", { precision: 10, scale: 7 }), // Admin-corrected latitude (overrides geocoded value)
  manualLongitude: decimal("manual_longitude", { precision: 10, scale: 7 }), // Admin-corrected longitude (overrides geocoded value)
  manualCoordsSetBy: varchar("manual_coords_set_by").references(() => users.id), // Who manually set the coordinates
  manualCoordsSetAt: timestamp("manual_coords_set_at"), // When coordinates were manually corrected
  manualCoordsReason: text("manual_coords_reason"), // Why coordinates were manually corrected
  geocodingAccuracyType: varchar("geocoding_accuracy_type"), // Geocodio accuracy type (rooftop, street, etc.)
  geocodingAccuracyScore: decimal("geocoding_accuracy_score", { precision: 3, scale: 2 }), // Geocodio confidence score (0.0-1.0)
  
  // Pending Details Workflow (Dec 9, 2025) - For deals without clear street addresses
  addressConfidence: varchar("address_confidence").default("verified"), // "verified", "partial", "pending" - tracks address quality
  dealRoomUrl: text("deal_room_url"), // Link to external deal room requiring login/agreement
  
  // Email Source Tracking (Jan 2, 2026) - For linking back to original email thread in Outlook
  outlookMessageId: varchar("outlook_message_id"), // Original email Message-ID for Outlook deep linking
  originalSenderEmail: varchar("original_sender_email"), // Original broker's email (from forwarded email)
  originalEmailSubject: text("original_email_subject"), // Original email subject line for search

  // LIHTC QAP Auto-Score Cache + Analyst Overrides
  lihtcScoreTotal: integer("lihtc_score_total"), // Cached total LIHTC QAP score (auto or analyst-confirmed)
  lihtcScorePreliminary: boolean("lihtc_score_preliminary").default(true), // true = used inferred assumptions
  lihtcCountyIncomeTier: varchar("lihtc_county_income_tier"), // 'High' | 'Moderate' | 'Low' (analyst override)
  lihtcUnits30AMI: integer("lihtc_units_30ami"), // # units targeted at 30% AMI (analyst override)
  lihtcUnits40AMI: integer("lihtc_units_40ami"), // # units targeted at 40% AMI (analyst override)
  lihtcUnits50AMI: integer("lihtc_units_50ami"), // # units targeted at 50% AMI (analyst override)
  lihtcNeighborhoodQuality: varchar("lihtc_neighborhood_quality"), // 'Good' | 'Fair' | 'Poor' (analyst override)
  lihtcIsRedevelopment: boolean("lihtc_is_redevelopment").default(false), // QAP: Redevelopment Project → auto "Good" neighborhood (10 pts)
  lihtcAmenityOverrides: jsonb("lihtc_amenity_overrides"), // Manual amenity overrides: {grocery:{name,distance},shopping:{...},...}
  lihtcCostPerUnit: integer("lihtc_cost_per_unit"), // Construction cost per unit ($) for PDC negative point check (>$135k = -10 pts)
  lihtcUnits1BR: integer("lihtc_units_1br"), // # of 1-bedroom units (for Olmstead scoring & 1BR threshold flags)
  lihtcDHHSPriorityCounty: boolean("lihtc_dhhs_priority_county").default(false), // DHHS priority county (+1 Olmstead pt)
  lihtcSection1602Penalty: boolean("lihtc_section1602_penalty").default(false), // Principals with uncorrected Sec 1602 noncompliance → -40 pts
  lihtcAgencyDiscretionPenalty: boolean("lihtc_agency_discretion_penalty").default(false), // Agency discretion site penalty → -3 pts (manual)
  lihtcQDPrincipalEligible: boolean("lihtc_qd_principal_eligible"), // QD Principal eligibility (placed-in-service 2017-2025)
  lihtcIsBondProject: boolean("lihtc_is_bond_project").default(false), // Bond project (triggers 1BR ≥ 10% requirement)
  lihtcScoreBreakdown: jsonb("lihtc_score_breakdown"), // Full score breakdown: {neighborhood, primaryAmenities, secondaryAmenities, siteSuitability, transit, incomeRPP, assumptions}
  lihtcScoredAt: timestamp("lihtc_scored_at"), // When the score was last calculated

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_deals_status").on(table.status),
  index("idx_deals_broker_id").on(table.brokerId)
]);

// Enhanced communication tracking for automated broker follow-up system
export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id), // Nullable for system-generated alerts
  relatedDealId: varchar("related_deal_id").references(() => deals.id, { onDelete: "set null" }), // Link to specific deal
  
  // Event tracking for idempotent notifications
  eventType: varchar("event_type"), // "deal_submitted", "status_rejected", "status_under_review", etc.
  
  // Contact information
  email: varchar("email"),
  phone: varchar("phone"),
  
  // Communication details
  channel: varchar("channel").notNull(), // "email" or "sms"
  direction: varchar("direction").notNull(), // "inbound" or "outbound"
  
  // Message content and parsing
  rawText: text("raw_text").notNull(), // Original message content
  parsedJson: jsonb("parsed_json"), // Structured parsed data
  missingFields: text("missing_fields").array(), // Array of missing information fields
  
  // Follow-up tracking
  status: varchar("status").default("pending_followup"), // "pending_followup", "followup_sent", "resolved"
  followUpCount: integer("follow_up_count").default(0),
  lastFollowUpAt: timestamp("last_follow_up_at"),
  
  // Resolution tracking for communication threads
  resolved: boolean("resolved").default(false), // Whether this communication thread has been resolved
  resolvedAt: timestamp("resolved_at"), // When the communication was marked as resolved
  resolvedFields: jsonb("resolved_fields"), // Array of specific missing fields that were provided in response
  
  // Provider tracking
  providerMessageId: varchar("provider_message_id"), // External provider message ID
  threadKey: varchar("thread_key"), // For threading related messages
  
  // Legacy fields for backward compatibility
  subject: varchar("subject"),
  message: text("message"),
  recipientEmail: varchar("recipient_email"), // for team notifications
  sentAt: timestamp("sent_at").defaultNow(),
  
  // Attachment storage for email files (PDFs, images, etc.)
  attachments: jsonb("attachments"), // Array of {filename, size, contentType, storageUrl}
  
  // Archiving fields
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MANUAL INDEX: Partial unique index prevents duplicate OUTBOUND notifications while allowing unlimited inbound messages
// Created via SQL: CREATE UNIQUE INDEX unique_deal_event_outbound ON communications (related_deal_id, event_type) WHERE direction = 'outbound';
// This cannot be expressed in Drizzle ORM's schema syntax, so it's managed via raw SQL


// Conversations table - tracks broker/team messaging threads
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").notNull().references(() => brokers.id, { onDelete: "cascade" }),
  createdByTeamMemberId: varchar("created_by_team_member_id").references(() => users.id, { onDelete: "set null" }), // Nullable for auto-created conversations
  
  // Conversation metadata
  status: varchar("status").default("active").notNull(),
  tags: text("tags").array(), // Status tags: follow_up_needed, urgent, waiting_on_broker, etc.
  lastMessageAt: timestamp("last_message_at"),
  unreadCount: integer("unread_count").default(0).notNull(), // Unread messages for team
  
  // Threading
  subject: varchar("subject"), // Optional subject line for context
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_conversations_broker_id").on(table.brokerId),
  index("idx_conversations_status").on(table.status),
  index("idx_conversations_last_message_at").on(table.lastMessageAt),
]);

// Conversation messages table - individual messages in threads
export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  
  // Message direction and content
  direction: varchar("direction").notNull(), // "inbound" or "outbound"
  body: text("body").notNull(), // Message text content
  
  // Message categorization
  messageType: varchar("message_type").default("manual").notNull(), // templated or manual
  templateId: varchar("template_id"), // Reference to outreach template if templated
  
  // Delivery tracking
  deliveryStatus: varchar("delivery_status").default("pending"),
  twilioMessageSid: varchar("twilio_message_sid"), // Twilio provider ID
  deliveryError: text("delivery_error"), // Error message if delivery failed
  
  // Timestamps
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"), // When recipient confirmed receipt
  deliveredAt: timestamp("delivered_at"), // When provider confirmed delivery
  
  // Sender information
  sentByUserId: varchar("sent_by_user_id").references(() => users.id, { onDelete: "set null" }), // Team member who sent (for outbound manual messages)
  
  // Metadata
  metadata: jsonb("metadata"), // Additional data (error codes, retry attempts, etc.)
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_conversation_messages_conversation_id").on(table.conversationId),
  index("idx_conversation_messages_delivery_status").on(table.deliveryStatus),
  index("idx_conversation_messages_created_at").on(table.createdAt),
]);

// Acquisition criteria table for configurable deal classification rules
export const acquisitionCriteria = pgTable("acquisition_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "Location Requirements", "Size Thresholds"
  category: varchar("category").notNull(), // "location", "size", "financial", "zoning", "infrastructure"
  classification: varchar("classification").notNull(), // "green", "yellow", "red"
  
  // Scoring configuration
  minScore: integer("min_score"), // Minimum score for this classification
  maxScore: integer("max_score"), // Maximum score for this classification
  weight: integer("weight").default(1), // Weight multiplier for this criteria
  
  // Criteria rules (stored as JSON)
  rules: jsonb("rules").notNull(), // Flexible rule structure
  
  // Metadata
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Property data and GIS information
export const propertyData = pgTable("property_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  parcelId: varchar("parcel_id").unique(),
  // GIS and Geographic Data
  coordinates: jsonb("coordinates"), // { lat, lng }
  boundaries: jsonb("boundaries"), // polygon coordinates
  area: decimal("area", { precision: 12, scale: 4 }), // in acres
  // Zoning and Regulatory
  currentZoning: varchar("current_zoning"),
  allowedUses: jsonb("allowed_uses"), // array of permitted uses
  densityLimits: jsonb("density_limits"), // units per acre, FAR, etc.
  heightRestrictions: decimal("height_restrictions", { precision: 6, scale: 2 }),
  setbacks: jsonb("setbacks"), // front, rear, side setbacks
  // Infrastructure and Utilities
  sewerAccess: boolean("sewer_access").default(false),
  waterAccess: boolean("water_access").default(false),
  powerAccess: boolean("power_access").default(false),
  gasAccess: boolean("gas_access").default(false),
  roadAccess: varchar("road_access"), // public, private, easement
  // Environmental and Risk Factors
  floodZone: varchar("flood_zone"), // FEMA flood zone designation
  wetlands: boolean("wetlands").default(false),
  soilType: varchar("soil_type"),
  slope: decimal("slope", { precision: 5, scale: 2 }), // percentage
  environmentalConstraints: jsonb("environmental_constraints"),
  // Market and Demographic Data
  marketArea: varchar("market_area"),
  medianHouseholdIncome: decimal("median_household_income", { precision: 10, scale: 2 }),
  populationDensity: decimal("population_density", { precision: 8, scale: 2 }),
  demographics: jsonb("demographics"), // age distribution, income brackets
  // Comparable Properties
  comparables: jsonb("comparables"), // recent sales, rent data
  marketTrends: jsonb("market_trends"), // price trends, vacancy rates
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Site planning and development analysis
export const sitePlans = pgTable("site_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  propertyDataId: varchar("property_data_id").references(() => propertyData.id),
  // Plan Details
  planName: varchar("plan_name").notNull(),
  totalUnits: integer("total_units"),
  buildableArea: doublePrecision("buildable_area"),
  openSpacePercentage: doublePrecision("open_space_percentage"),
  parkingSpaces: integer("parking_spaces"),
  // Unit Mix
  unitMix: jsonb("unit_mix"), // { "1BR": 50, "2BR": 100, "3BR": 50 }
  averageUnitSize: decimal("average_unit_size", { precision: 8, scale: 2 }),
  // Financial Projections
  estimatedConstructionCost: decimal("estimated_construction_cost", { precision: 12, scale: 2 }),
  estimatedSalesPrice: decimal("estimated_sales_price", { precision: 12, scale: 2 }),
  projectedRentRoll: decimal("projected_rent_roll", { precision: 12, scale: 2 }),
  estimatedNOI: decimal("estimated_noi", { precision: 12, scale: 2 }),
  projectedIRR: decimal("projected_irr", { precision: 5, scale: 3 }),
  // Timeline and Phases
  developmentPhases: jsonb("development_phases"),
  estimatedTimelineMonths: integer("estimated_timeline_months"),
  // AI Generated Data
  aiOptimized: boolean("ai_optimized").default(false),
  aiRecommendations: jsonb("ai_recommendations"),
  // Status and Approvals
  status: varchar("status").default("draft"), // draft, under_review, approved, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market analysis and insights
export const marketAnalysis = pgTable("market_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  marketArea: varchar("market_area").notNull(),
  // Rental Market Data
  avgRentPerSF: decimal("avg_rent_per_sf", { precision: 8, scale: 2 }),
  vacancyRate: decimal("vacancy_rate", { precision: 5, scale: 3 }),
  rentGrowthRate: doublePrecision("rent_growth_rate"),
  // Sales Market Data
  avgSalePricePerSF: decimal("avg_sale_price_per_sf", { precision: 8, scale: 2 }),
  daysonMarket: integer("days_on_market"),
  priceAppreciation: decimal("price_appreciation", { precision: 5, scale: 3 }),
  // Supply and Demand
  unitsUnderConstruction: integer("units_under_construction"),
  plannedDevelopments: integer("planned_developments"),
  populationGrowth: decimal("population_growth", { precision: 5, scale: 3 }),
  jobGrowth: decimal("job_growth", { precision: 5, scale: 3 }),
  // Investment Metrics
  capRates: jsonb("cap_rates"), // by property type
  grossRentMultiplier: decimal("gross_rent_multiplier", { precision: 6, scale: 2 }),
  priceToRentRatio: decimal("price_to_rent_ratio", { precision: 6, scale: 2 }),
  // Data Sources and Freshness
  dataSources: jsonb("data_sources"), // MLS, public records, surveys
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comments and collaboration
export const propertyComments = pgTable("property_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  authorName: varchar("author_name").notNull(),
  comment: text("comment").notNull(),
  commentType: varchar("comment_type").default("general"), // general, risk, opportunity, financial
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project tracking and workflow
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  dealIds: jsonb("deal_ids"), // array of deal IDs grouped in this project
  assignedTeam: text("assigned_team"), // array of user emails (JSON-encoded)
  status: varchar("status").default("active"), // active, on_hold, completed, cancelled
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  targetCompletionDate: date("target_completion_date"),
  actualCompletionDate: date("actual_completion_date"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  estimatedROI: decimal("estimated_roi", { precision: 5, scale: 3 }),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Analytics and metrics
export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").defaultNow(),
  totalDeals: integer("total_deals").default(0),
  pendingDeals: integer("pending_deals").default(0),
  approvedDeals: integer("approved_deals").default(0),
  rejectedDeals: integer("rejected_deals").default(0),
  avgReviewTime: decimal("avg_review_time", { precision: 4, scale: 1 }),
  totalPipelineValue: decimal("total_pipeline_value", { precision: 15, scale: 2 }),
});

// Error logging table for monitoring and debugging
export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  level: varchar("level").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"),
  userId: varchar("user_id"),
  requestId: varchar("request_id"),
  endpoint: varchar("endpoint"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address"),
  sessionId: varchar("session_id"),
});

// System metrics table for performance monitoring
export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  memoryHeapUsed: bigint("memory_heap_used", { mode: "number" }),
  memoryHeapTotal: bigint("memory_heap_total", { mode: "number" }),
  memoryExternal: bigint("memory_external", { mode: "number" }),
  memoryRss: bigint("memory_rss", { mode: "number" }),
  cpuUser: doublePrecision("cpu_user"),
  cpuSystem: doublePrecision("cpu_system"),
  eventLoopDelay: doublePrecision("event_loop_delay"),
  activeConnections: integer("active_connections"),
  requestsPerMinute: integer("requests_per_minute"),
  errorRate: doublePrecision("error_rate"),
  gcForcedCollections: bigint("gc_forced_collections", { mode: "number" }).default(0),
  gcFullCollections: bigint("gc_full_collections", { mode: "number" }).default(0),
  heapSpaceUsed: bigint("heap_space_used", { mode: "number" }).default(0),
});

// Brand customization settings for super admin
export const brandSettings = pgTable("brand_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Colors
  primaryColor: varchar("primary_color").default("#0A2B4A"), // Catalyst Navy
  secondaryColor: varchar("secondary_color").default("#4A90E2"), // Catalyst Blue
  accentColor: varchar("accent_color").default("#0070F3"), // AI Blue
  backgroundColor: varchar("background_color").default("#FFFFFF"),
  textColor: varchar("text_color").default("#333333"),
  // Typography
  primaryFont: varchar("primary_font").default("Inter"),
  headingFont: varchar("heading_font").default("Inter"),
  fontSizeBase: varchar("font_size_base").default("16px"),
  // Layout
  borderRadius: varchar("border_radius").default("0.5rem"),
  spacing: varchar("spacing").default("1rem"),
  // Buttons
  buttonStyle: varchar("button_style").default("modern"), // modern, classic, rounded
  buttonHoverEffect: varchar("button_hover_effect").default("scale"), // scale, shadow, color
  // Custom CSS
  customCSS: text("custom_css"),
  // Metadata
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Brand settings types
export const insertBrandSettingsSchema = createInsertSchema(brandSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrandSettings = z.infer<typeof insertBrandSettingsSchema>;
export type BrandSettings = typeof brandSettings.$inferSelect;

// Data Quality Monitoring Tables

// Data source reliability tracking
export const dataSourceMetrics = pgTable("data_source_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: varchar("source_name").notNull(), // usps, census, hellodata
  date: date("date").notNull(),
  totalRequests: integer("total_requests").default(0),
  successfulRequests: integer("successful_requests").default(0),
  failedRequests: integer("failed_requests").default(0),
  averageResponseTime: decimal("average_response_time", { precision: 8, scale: 2 }), // milliseconds
  successRate: decimal("success_rate", { precision: 5, scale: 2 }), // percentage
  averageConfidenceScore: decimal("average_confidence_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("data_source_metrics_date_idx").on(table.date),
  index("data_source_metrics_source_date_idx").on(table.sourceName, table.date),
]);

// Daily data quality summary
export const dataQualityMetrics = pgTable("data_quality_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  totalValidations: integer("total_validations").default(0),
  highConfidenceCount: integer("high_confidence_count").default(0), // >= 85%
  mediumConfidenceCount: integer("medium_confidence_count").default(0), // 65-84%
  lowConfidenceCount: integer("low_confidence_count").default(0), // < 65%
  averageConfidenceScore: decimal("average_confidence_score", { precision: 5, scale: 2 }),
  averageQualityScore: decimal("average_quality_score", { precision: 5, scale: 2 }),
  totalDiscrepancies: integer("total_discrepancies").default(0),
  sourcesUsedCount: integer("sources_used_count").default(0),
  addressValidationRate: decimal("address_validation_rate", { precision: 5, scale: 2 }),
  demographicValidationRate: decimal("demographic_validation_rate", { precision: 5, scale: 2 }),
  propertyValidationRate: decimal("property_validation_rate", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("data_quality_metrics_date_idx").on(table.date),
]);

// Real-time data quality alerts
export const dataQualityAlerts = pgTable("data_quality_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: varchar("alert_type").notNull(), // low_confidence, service_degradation, validation_failure
  severity: varchar("severity").notNull(), // low, medium, high, critical
  dealId: varchar("deal_id").references(() => deals.id),
  sourceName: varchar("source_name"), // affected data source
  message: text("message").notNull(),
  confidenceScore: doublePrecision("confidence_score"),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("data_quality_alerts_type_idx").on(table.alertType),
  index("data_quality_alerts_severity_idx").on(table.severity),
  index("data_quality_alerts_created_idx").on(table.createdAt),
  index("data_quality_alerts_unresolved_idx").on(table.isResolved),
]);

// Hourly data quality snapshots for real-time monitoring
export const dataQualitySnapshots = pgTable("data_quality_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull(),
  overallHealthScore: decimal("overall_health_score", { precision: 5, scale: 2 }),
  activeAlertsCount: integer("active_alerts_count").default(0),
  recentValidationsCount: integer("recent_validations_count").default(0), // last hour
  averageRecentConfidence: decimal("average_recent_confidence", { precision: 5, scale: 2 }),
  serviceHealthScores: jsonb("service_health_scores"), // per-service health data
  trendingIssues: jsonb("trending_issues"), // identified patterns
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("data_quality_snapshots_timestamp_idx").on(table.timestamp),
]);

// Manual Review Workflow Tables


// Main review queue for deals requiring manual review
export const reviewQueue = pgTable("review_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  
  // Review trigger information
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 2 }),
  triggerReason: varchar("trigger_reason").notNull(), // low_overall_confidence, field_discrepancy, high_discrepancy_count
  specificIssues: jsonb("specific_issues"), // detailed breakdown of issues
  
  // Field-specific confidence scores
  addressConfidence: decimal("address_confidence", { precision: 5, scale: 2 }),
  sizeConfidence: decimal("size_confidence", { precision: 5, scale: 2 }),
  valuationConfidence: decimal("valuation_confidence", { precision: 5, scale: 2 }),
  demographicsConfidence: decimal("demographics_confidence", { precision: 5, scale: 2 }),
  rentDataConfidence: decimal("rent_data_confidence", { precision: 5, scale: 2 }),
  
  // Priority and status management
  priority: varchar("priority").default("medium"),
  status: varchar("status").default("pending_review"),
  
  // Source data for comparison (snapshot at time of flagging)
  sourceDataSnapshot: jsonb("source_data_snapshot"), // all source data for comparison
  discrepancies: jsonb("discrepancies"), // array of discrepancy descriptions
  sourcesUsed: jsonb("sources_used"), // array of source names
  
  // Assignment tracking
  assignedAnalyst: varchar("assigned_analyst").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  
  // Timing and SLA tracking
  flaggedAt: timestamp("flagged_at").defaultNow(),
  reviewStartedAt: timestamp("review_started_at"),
  reviewCompletedAt: timestamp("review_completed_at"),
  targetCompletionDate: timestamp("target_completion_date"), // SLA deadline
  
  // Resolution tracking
  resolution: varchar("resolution"), // approved, rejected, corrected, escalated
  analystNotes: text("analyst_notes"),
  escalationReason: text("escalation_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("review_queue_deal_idx").on(table.dealId),
  index("review_queue_status_idx").on(table.status),
  index("review_queue_priority_idx").on(table.priority),
  index("review_queue_analyst_idx").on(table.assignedAnalyst),
  index("review_queue_confidence_idx").on(table.overallConfidence),
  index("review_queue_flagged_idx").on(table.flaggedAt),
]);

// Review assignments for workload management
export const reviewAssignments = pgTable("review_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewQueueId: varchar("review_queue_id").references(() => reviewQueue.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  
  // Assignment details
  analystId: varchar("analyst_id").references(() => users.id).notNull(),
  analystEmail: varchar("analyst_email").notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id), // who made the assignment
  assignmentMethod: varchar("assignment_method").default("manual"), // manual, auto_round_robin, workload_based
  
  // Workload tracking
  estimatedTimeMinutes: integer("estimated_time_minutes").default(30),
  actualTimeMinutes: integer("actual_time_minutes"),
  
  // Status and timeline
  status: varchar("status").default("assigned"),
  acceptedAt: timestamp("accepted_at"), // when analyst accepts assignment
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("review_assignments_queue_idx").on(table.reviewQueueId),
  index("review_assignments_analyst_idx").on(table.analystId),
  index("review_assignments_status_idx").on(table.status),
]);

// Track all review actions and decisions
export const reviewActions = pgTable("review_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewQueueId: varchar("review_queue_id").references(() => reviewQueue.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  
  // Action details
  actionType: varchar("action_type").notNull(), // started_review, field_corrected, approved, rejected, escalated, noted
  analystId: varchar("analyst_id").references(() => users.id).notNull(),
  analystName: varchar("analyst_name").notNull(),
  
  // Action-specific data
  fieldName: varchar("field_name"), // which field was affected (if applicable)
  oldValue: text("old_value"), // previous value
  newValue: text("new_value"), // corrected value
  correctionSource: varchar("correction_source"), // manual_entry, source_override, research
  confidenceOverride: decimal("confidence_override", { precision: 5, scale: 2 }),
  
  // Notes and reasoning
  notes: text("notes"),
  reasoning: text("reasoning"), // detailed explanation of decision
  
  // Quality metrics
  timeSpentMinutes: integer("time_spent_minutes"),
  difficultyRating: integer("difficulty_rating"), // 1-5 scale
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("review_actions_queue_idx").on(table.reviewQueueId),
  index("review_actions_deal_idx").on(table.dealId),
  index("review_actions_analyst_idx").on(table.analystId),
  index("review_actions_type_idx").on(table.actionType),
  index("review_actions_created_idx").on(table.createdAt),
]);

// Store analyst corrections and overrides
export const reviewCorrections = pgTable("review_corrections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewQueueId: varchar("review_queue_id").references(() => reviewQueue.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  
  // Field correction details
  fieldPath: varchar("field_path").notNull(), // e.g., "address", "sizeAcres", "demographics.population55Plus"
  fieldDisplayName: varchar("field_display_name").notNull(), // human-readable field name
  
  // Original and corrected values
  originalValue: text("original_value"),
  correctedValue: text("corrected_value").notNull(),
  originalConfidence: decimal("original_confidence", { precision: 5, scale: 2 }),
  newConfidence: decimal("new_confidence", { precision: 5, scale: 2 }),
  
  // Source information
  originalSources: jsonb("original_sources"), // which sources provided original value
  correctionSource: varchar("correction_source").notNull(), // research, manual_verification, alternative_api
  correctionMethod: varchar("correction_method"), // google_maps, manual_research, phone_verification
  
  // Validation and verification
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationMethod: varchar("verification_method"),
  
  // Impact assessment
  impactsClassification: boolean("impacts_classification").default(false),
  previousClassification: varchar("previous_classification"),
  newClassification: varchar("new_classification"),
  
  // Audit trail
  analystId: varchar("analyst_id").references(() => users.id).notNull(),
  analystNotes: text("analyst_notes"),
  reviewLevel: integer("review_level").default(1), // 1=first review, 2=second review, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  appliedAt: timestamp("applied_at"), // when correction was applied to deal
}, (table) => [
  index("review_corrections_queue_idx").on(table.reviewQueueId),
  index("review_corrections_deal_idx").on(table.dealId),
  index("review_corrections_field_idx").on(table.fieldPath),
  index("review_corrections_analyst_idx").on(table.analystId),
  index("review_corrections_applied_idx").on(table.appliedAt),
]);

// Track escalation workflow for complex cases
export const reviewEscalations = pgTable("review_escalations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewQueueId: varchar("review_queue_id").references(() => reviewQueue.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  
  // Escalation details
  escalatedBy: varchar("escalated_by").references(() => users.id).notNull(),
  escalatedTo: varchar("escalated_to").references(() => users.id).notNull(),
  escalationLevel: integer("escalation_level").default(1), // 1=supervisor, 2=manager, 3=director
  
  // Reason and context
  escalationReason: varchar("escalation_reason").notNull(), // complexity, disagreement, policy_question
  description: text("description").notNull(),
  originalDecision: text("original_decision"),
  
  // Resolution tracking
  status: varchar("status").default("pending"), // pending, resolved, returned_to_analyst
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolution: text("resolution"),
  finalDecision: text("final_decision"),
  
  // Timing
  escalatedAt: timestamp("escalated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  targetResolutionDate: timestamp("target_resolution_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("review_escalations_queue_idx").on(table.reviewQueueId),
  index("review_escalations_status_idx").on(table.status),
  index("review_escalations_level_idx").on(table.escalationLevel),
]);

// Pattern tracking for improving automation
export const reviewPatterns = pgTable("review_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Pattern identification
  patternType: varchar("pattern_type").notNull(), // field_issue, source_reliability, geographic_bias
  patternName: varchar("pattern_name").notNull(),
  description: text("description"),
  
  // Pattern metrics
  occurrenceCount: integer("occurrence_count").default(1),
  affectedDeals: jsonb("affected_deals"), // array of deal IDs
  affectedSources: jsonb("affected_sources"), // array of source names
  affectedFields: jsonb("affected_fields"), // array of field names
  
  // Geographic and temporal patterns
  geographicPattern: jsonb("geographic_pattern"), // states, cities, zip codes affected
  timePattern: jsonb("time_pattern"), // time-based patterns (day of week, hour, etc.)
  
  // Impact assessment
  averageImpactOnConfidence: decimal("average_impact_on_confidence", { precision: 5, scale: 2 }),
  resolutionRate: decimal("resolution_rate", { precision: 5, scale: 2 }),
  averageResolutionTimeMinutes: integer("average_resolution_time_minutes"),
  
  // Learning and improvement
  suggestedImprovements: jsonb("suggested_improvements"),
  automationOpportunity: boolean("automation_opportunity").default(false),
  automationDescription: text("automation_description"),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastOccurrence: timestamp("last_occurrence").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("review_patterns_type_idx").on(table.patternType),
  index("review_patterns_active_idx").on(table.isActive),
  index("review_patterns_occurrence_idx").on(table.lastOccurrence),
]);

// Validation history for deals (tracks all validation attempts)
export const dealValidationHistory = pgTable("deal_validation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  validationType: varchar("validation_type").notNull(), // comprehensive, quick, retry
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 2 }),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  sourcesUsed: jsonb("sources_used"), // array of source names
  discrepancies: jsonb("discrepancies"), // array of discrepancy descriptions
  addressConfidence: decimal("address_confidence", { precision: 5, scale: 2 }),
  sizeConfidence: decimal("size_confidence", { precision: 5, scale: 2 }),
  valuationConfidence: decimal("valuation_confidence", { precision: 5, scale: 2 }),
  demographicsConfidence: decimal("demographics_confidence", { precision: 5, scale: 2 }),
  validationDuration: integer("validation_duration"), // milliseconds
  isSuccessful: boolean("is_successful").default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("deal_validation_history_deal_idx").on(table.dealId),
  index("deal_validation_history_created_idx").on(table.createdAt),
  index("deal_validation_history_confidence_idx").on(table.overallConfidence),
]);

// Insert schemas for data quality tables
export const insertDataSourceMetricsSchema = createInsertSchema(dataSourceMetrics);
export type InsertDataSourceMetrics = z.infer<typeof insertDataSourceMetricsSchema>;
export type SelectDataSourceMetrics = typeof dataSourceMetrics.$inferSelect;

export const insertDataQualityMetricsSchema = createInsertSchema(dataQualityMetrics);
export type InsertDataQualityMetrics = z.infer<typeof insertDataQualityMetricsSchema>;
export type SelectDataQualityMetrics = typeof dataQualityMetrics.$inferSelect;

export const insertDataQualityAlertsSchema = createInsertSchema(dataQualityAlerts);
export type InsertDataQualityAlerts = z.infer<typeof insertDataQualityAlertsSchema>;
export type SelectDataQualityAlerts = typeof dataQualityAlerts.$inferSelect;

export const insertDataQualitySnapshotsSchema = createInsertSchema(dataQualitySnapshots);
export type InsertDataQualitySnapshots = z.infer<typeof insertDataQualitySnapshotsSchema>;
export type SelectDataQualitySnapshots = typeof dataQualitySnapshots.$inferSelect;

export const insertDealValidationHistorySchema = createInsertSchema(dealValidationHistory);
export type InsertDealValidationHistory = z.infer<typeof insertDealValidationHistorySchema>;
export type SelectDealValidationHistory = typeof dealValidationHistory.$inferSelect;

// Gamification tables
export const brokerPoints = pgTable("broker_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  points: integer("points").notNull(),
  reason: varchar("reason").notNull(), // deal_submitted, deal_approved, referral_signup, share_platform, etc.
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "set null" }),
  referralId: varchar("referral_id").references(() => brokers.id),
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

export const brokerRewards = pgTable("broker_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  rewardType: varchar("reward_type").notNull(), // gift_card, cash_bonus, premium_access, etc.
  rewardValue: decimal("reward_value", { precision: 10, scale: 2 }),
  rewardDescription: text("reward_description").notNull(),
  pointsCost: integer("points_cost").notNull(),
  status: varchar("status").default("pending"), // pending, claimed, delivered
  claimedAt: timestamp("claimed_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brokerAchievements = pgTable("broker_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  achievementType: varchar("achievement_type").notNull(), // first_deal, deal_streak, top_performer, referral_master, etc.
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(),
  pointsAwarded: integer("points_awarded").default(0),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export const platformShares = pgTable("platform_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  shareType: varchar("share_type").notNull(), // social_media, email, direct_link, etc.
  platform: varchar("platform"), // linkedin, facebook, twitter, email, etc.
  shareUrl: varchar("share_url"),
  clickCount: integer("click_count").default(0),
  conversionCount: integer("conversion_count").default(0), // How many led to signups
  pointsEarned: integer("points_earned").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Deal tagging and viral loop tables
export const dealTags = pgTable("deal_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  taggerBrokerId: varchar("tagger_broker_id").references(() => brokers.id).notNull(),
  taggedEmail: varchar("tagged_email").notNull(),
  taggedLinkedIn: varchar("tagged_linkedin"),
  taggedName: varchar("tagged_name"), // Optional name for personalization
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  clickedNotification: boolean("clicked_notification").default(false),
  clickedAt: timestamp("clicked_at"),
  signedUp: boolean("signed_up").default(false),
  signedUpAt: timestamp("signed_up_at"),
  signedUpUserId: varchar("signed_up_user_id").references(() => users.id),
  viewedDeal: boolean("viewed_deal").default(false),
  viewedAt: timestamp("viewed_at"),
  pointsAwarded: integer("points_awarded").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Viral signup tracking for leaderboard metrics
export const viralSignups = pgTable("viral_signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealTagId: varchar("deal_tag_id").references(() => dealTags.id).notNull(),
  taggerBrokerId: varchar("tagger_broker_id").references(() => brokers.id).notNull(),
  newUserId: varchar("new_user_id").references(() => users.id).notNull(),
  newUserEmail: varchar("new_user_email").notNull(),
  signupSource: varchar("signup_source").default("deal_tag"), // deal_tag, email_link, linkedin_share
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  pointsAwarded: integer("points_awarded").default(50), // Points awarded to tagger
  createdAt: timestamp("created_at").defaultNow(),
});

// Land valuation reports table
export const valuations = pgTable("valuations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  address: varchar("address").notNull(),
  sizeAcres: varchar("size_acres").notNull(),
  zoning: varchar("zoning"),
  marketComps: varchar("market_comps"),
  notes: varchar("notes"),
  pricePerAcre: integer("price_per_acre").notNull(),
  totalValue: integer("total_value").notNull(),
  pdfUrl: varchar("pdf_url"),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Valuation shares tracking
export const valuationShares = pgTable("valuation_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  valuationId: varchar("valuation_id").references(() => valuations.id).notNull(),
  sharedByBrokerId: varchar("shared_by_broker_id").references(() => brokers.id).notNull(),
  sharedWithEmail: varchar("shared_with_email").notNull(),
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  viewedReport: boolean("viewed_report").default(false),
  viewedAt: timestamp("viewed_at"),
  signedUp: boolean("signed_up").default(false),
  signedUpAt: timestamp("signed_up_at"),
  signedUpUserId: varchar("signed_up_user_id").references(() => users.id),
  pointsAwarded: integer("points_awarded").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Preferred partners table  
export const preferredPartners = pgTable("preferred_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  partnerEmail: varchar("partner_email").notNull(),
  partnerName: varchar("partner_name").notNull(),
  partnerType: varchar("partner_type").notNull(), // "broker", "developer", "investor"
  partnerCompany: varchar("partner_company"),
  partnerPhone: varchar("partner_phone"),
  status: varchar("status").default("pending"), // "pending", "accepted", "declined"
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  acceptedAt: timestamp("accepted_at"),
  partnerUserId: varchar("partner_user_id").references(() => users.id),
  partnerBrokerId: varchar("partner_broker_id").references(() => brokers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Partnership invitations tracking
export const partnershipInvitations = pgTable("partnership_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviterBrokerId: varchar("inviter_broker_id").references(() => brokers.id).notNull(),
  inviteeEmail: varchar("invitee_email").notNull(),
  inviteeName: varchar("invitee_name").notNull(),
  inviteeType: varchar("invitee_type").notNull(), // "broker", "developer", "investor"
  personalMessage: varchar("personal_message"),
  status: varchar("status").default("sent"), // "sent", "viewed", "signed_up", "accepted"
  viewedAt: timestamp("viewed_at"),
  signedUpAt: timestamp("signed_up_at"),
  acceptedAt: timestamp("accepted_at"),
  newUserId: varchar("new_user_id").references(() => users.id),
  pointsAwarded: integer("points_awarded").default(0), // Points for successful partnership signup
  createdAt: timestamp("created_at").defaultNow(),
});

// Commission earnings tracking
export const commissionEarnings = pgTable("commission_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  commissionAmount: integer("commission_amount").notNull(), // Amount in cents
  commissionType: varchar("commission_type").notNull(), // "referral", "closing", "bonus"
  dealValue: integer("deal_value"), // Deal value in cents
  commissionPercent: integer("commission_percent"), // Commission percentage (e.g., 250 = 2.5%)
  payoutStatus: varchar("payout_status").default("pending"), // "pending", "paid", "disputed"
  payoutDate: timestamp("payout_date"),
  taggedEmails: varchar("tagged_emails").array(), // Emails that will be notified
  notificationsSent: boolean("notifications_sent").default(false),
  notificationsSentAt: timestamp("notifications_sent_at"),
  signupsFromNotification: integer("signups_from_notification").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertBrokerSchema = createInsertSchema(brokers).omit({
  id: true,
  userId: true,
  isActive: true,
  smsOptIn: true, // Controlled via smsConsent field
  smsOptInDate: true, // Set automatically by backend
  smsOptOutDate: true, // Set automatically by backend
  createdAt: true,
  updatedAt: true,
}).extend({
  smsConsent: z.boolean().optional(), // Frontend field to control SMS opt-in
}).refine(
  (data) => data.email || data.phone,
  {
    message: "Either email or phone number is required",
    path: ["contact"], // This will show the error for both fields
  }
);

export const dealShareTokens = pgTable("deal_share_tokens", {
  token: varchar("token", { length: 64 }).primaryKey(),
  dealId: varchar("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("deal_share_tokens_deal_idx").on(table.dealId),
  index("deal_share_tokens_expires_idx").on(table.expiresAt),
]);

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  status: true,
  classification: true,
  aiAnalysisData: true,
  analystNotes: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override brokerId to accept email string from frontend
  brokerId: z.string().email("Valid email address required"),
  // Ensure submissionMethod is provided
  submissionMethod: z.enum(["form", "email", "sms"]),
  // Make address required
  address: z.string().min(1, "Property address is required"),
  // Viral tagging fields
  taggedEmails: z.array(z.string().email()).optional(),
  taggedLinkedIn: z.array(z.string()).optional(),
});


export const insertCommunicationSchema = createInsertSchema(communications).omit({
  id: true,
  followUpCount: true,
  lastFollowUpAt: true,
  sentAt: true,
  isArchived: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Ensure required fields are properly validated
  channel: z.enum(["email", "sms"]),
  direction: z.enum(["inbound", "outbound"]),
  rawText: z.string().min(1, "Message content is required"),
  status: z.enum(["pending_followup", "followup_sent", "resolved"]).optional(),
  missingFields: z.array(z.string()).optional(),
});

// Conversation insert schema for messaging dashboard
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
  unreadCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  brokerId: z.string().uuid("Valid broker ID required"),
  status: z.enum(["active", "resolved", "archived"]).optional(),
});

// Conversation message insert schema for messaging dashboard
export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  sentAt: true,
  acknowledgedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  conversationId: z.string().uuid("Valid conversation ID required"),
  direction: z.enum(["inbound", "outbound"]),
  body: z.string().min(1, "Message content is required").max(1600, "Message too long (max 1600 characters for SMS)"),
  messageType: z.enum(["templated", "manual"]).optional(),
  deliveryStatus: z.enum(["pending", "sent", "delivered", "failed", "undelivered"]).optional(),
});

export const insertAcquisitionCriteriaSchema = createInsertSchema(acquisitionCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Emergency Reviews for tracking emergency manual review sessions
export const emergencyReviews = pgTable("emergency_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  triggeredBy: varchar("triggered_by").notNull(), // api_failures, manual, system_overload
  affectedServices: jsonb("affected_services"), // array of affected service names
  reason: text("reason"),
  status: varchar("status").default("active"), // active, resolved, cancelled
  dealsPending: integer("deals_pending").default(0),
  estimatedResolution: timestamp("estimated_resolution"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type InsertBroker = z.infer<typeof insertBrokerSchema>;
export type Broker = typeof brokers.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type Communication = typeof communications.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type EmergencyReview = typeof emergencyReviews.$inferSelect;
export type InsertEmergencyReview = typeof emergencyReviews.$inferInsert;

// Utility function to format deal numbers as #01, #02, etc.
export const formatDealNumber = (dealNumber: number): string => {
  return `#${dealNumber.toString().padStart(2, '0')}`;
};
export type Analytics = typeof analytics.$inferSelect;
export type AcquisitionCriteria = typeof acquisitionCriteria.$inferSelect;
export type InsertAcquisitionCriteria = z.infer<typeof insertAcquisitionCriteriaSchema>;

// New schema exports
export const insertPropertyDataSchema = createInsertSchema(propertyData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSitePlanSchema = createInsertSchema(sitePlans).omit({
  id: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketAnalysisSchema = createInsertSchema(marketAnalysis).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertPropertyCommentSchema = createInsertSchema(propertyComments).omit({
  id: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  actualCompletionDate: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealTagSchema = createInsertSchema(dealTags).omit({
  id: true,
  notificationSent: true,
  notificationSentAt: true,
  clickedNotification: true,
  clickedAt: true,
  signedUp: true,
  signedUpAt: true,
  signedUpUserId: true,
  viewedDeal: true,
  viewedAt: true,
  pointsAwarded: true,
  createdAt: true,
});

export const insertViralSignupSchema = createInsertSchema(viralSignups).omit({
  id: true,
  createdAt: true,
});

export const insertValuationSchema = createInsertSchema(valuations).omit({
  id: true,
  createdAt: true,
});

export const insertValuationShareSchema = createInsertSchema(valuationShares).omit({
  id: true,
  notificationSent: true,
  notificationSentAt: true,
  viewedReport: true,
  viewedAt: true,
  signedUp: true,
  signedUpAt: true,
  signedUpUserId: true,
  pointsAwarded: true,
  createdAt: true,
});

export const insertPreferredPartnerSchema = createInsertSchema(preferredPartners).omit({
  id: true,
  status: true,
  notificationSent: true,
  notificationSentAt: true,
  acceptedAt: true,
  partnerUserId: true,
  partnerBrokerId: true,
  createdAt: true,
});

export const insertPartnershipInvitationSchema = createInsertSchema(partnershipInvitations).omit({
  id: true,
  status: true,
  viewedAt: true,
  signedUpAt: true,
  acceptedAt: true,
  newUserId: true,
  pointsAwarded: true,
  createdAt: true,
});

export const insertCommissionEarningSchema = createInsertSchema(commissionEarnings).omit({
  id: true,
  payoutStatus: true,
  payoutDate: true,
  notificationsSent: true,
  notificationsSentAt: true,
  signupsFromNotification: true,
  createdAt: true,
});

// Manual Review Workflow Schemas
export const insertReviewQueueSchema = createInsertSchema(reviewQueue).omit({
  id: true,
  status: true,
  assignedAt: true,
  reviewStartedAt: true,
  reviewCompletedAt: true,
  flaggedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewAssignmentSchema = createInsertSchema(reviewAssignments).omit({
  id: true,
  status: true,
  acceptedAt: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewActionSchema = createInsertSchema(reviewActions).omit({
  id: true,
  createdAt: true,
});

export const insertReviewCorrectionSchema = createInsertSchema(reviewCorrections).omit({
  id: true,
  isVerified: true,
  verifiedBy: true,
  verifiedAt: true,
  appliedAt: true,
  createdAt: true,
});

export const insertReviewEscalationSchema = createInsertSchema(reviewEscalations).omit({
  id: true,
  status: true,
  resolvedBy: true,
  resolution: true,
  finalDecision: true,
  escalatedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewPatternSchema = createInsertSchema(reviewPatterns).omit({
  id: true,
  isActive: true,
  lastOccurrence: true,
  createdAt: true,
  updatedAt: true,
});

// New type exports
export type PropertyData = typeof propertyData.$inferSelect;
export type InsertPropertyData = z.infer<typeof insertPropertyDataSchema>;
export type SitePlan = typeof sitePlans.$inferSelect;
export type InsertSitePlan = z.infer<typeof insertSitePlanSchema>;
export type MarketAnalysis = typeof marketAnalysis.$inferSelect;
export type InsertMarketAnalysis = z.infer<typeof insertMarketAnalysisSchema>;
export type PropertyComment = typeof propertyComments.$inferSelect;
export type InsertPropertyComment = z.infer<typeof insertPropertyCommentSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type DealTag = typeof dealTags.$inferSelect;
export type InsertDealTag = z.infer<typeof insertDealTagSchema>;
export type ViralSignup = typeof viralSignups.$inferSelect;
export type InsertViralSignup = z.infer<typeof insertViralSignupSchema>;
export type Valuation = typeof valuations.$inferSelect;
export type InsertValuation = z.infer<typeof insertValuationSchema>;
export type ValuationShare = typeof valuationShares.$inferSelect;
export type InsertValuationShare = z.infer<typeof insertValuationShareSchema>;
export type PreferredPartner = typeof preferredPartners.$inferSelect;
export type InsertPreferredPartner = z.infer<typeof insertPreferredPartnerSchema>;
export type PartnershipInvitation = typeof partnershipInvitations.$inferSelect;
export type InsertPartnershipInvitation = z.infer<typeof insertPartnershipInvitationSchema>;
export type CommissionEarning = typeof commissionEarnings.$inferSelect;
export type InsertCommissionEarning = z.infer<typeof insertCommissionEarningSchema>;

// Manual Review Workflow Types
export type ReviewQueue = typeof reviewQueue.$inferSelect;
export type InsertReviewQueue = z.infer<typeof insertReviewQueueSchema>;
export type ReviewAssignment = typeof reviewAssignments.$inferSelect;
export type InsertReviewAssignment = z.infer<typeof insertReviewAssignmentSchema>;
export type ReviewAction = typeof reviewActions.$inferSelect;
export type InsertReviewAction = z.infer<typeof insertReviewActionSchema>;
export type ReviewCorrection = typeof reviewCorrections.$inferSelect;
export type InsertReviewCorrection = z.infer<typeof insertReviewCorrectionSchema>;
export type ReviewEscalation = typeof reviewEscalations.$inferSelect;
export type InsertReviewEscalation = z.infer<typeof insertReviewEscalationSchema>;
export type ReviewPattern = typeof reviewPatterns.$inferSelect;
export type InsertReviewPattern = z.infer<typeof insertReviewPatternSchema>;

// Template Event Types - Essential business events only
export type TemplateEvent = 
  | 'broker_registered'     // Welcome new broker
  | 'deal_submitted'        // Deal submission confirmation
  | 'sms_opt_in'            // Encourage SMS opt-in for brokers
  | 'sms_unsubscribe'       // SMS opt-out/unsubscribe confirmation
  | 'info_missing'          // Request missing information (generic)
  | 'info_missing_acreage'  // Request missing acreage specifically
  | 'info_missing_price'    // Request missing price specifically
  | 'info_missing_both'     // Request missing both acreage and price
  | 'status_under_review'   // Deal under review
  | 'status_pursuing'       // High priority / pursuing
  | 'status_rejected'       // Not a fit
  | 'loi_sent'              // LOI sent for email only
  | 'info_missing_reminder' // SMS reminder only
  | 'monthly_broker_outreach' // Monthly outreach campaigns
  | 'weekly_report';        // Weekly deal pipeline report

// Simplified template types
export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  content: string;
  html?: string;
  event: TemplateEvent;
  enabled?: boolean;
  // Template source - DEPRECATED (auto-detected based on sendgridTemplateId)
  templateSource?: 'outreach' | 'sendgrid'; // Kept for backward compatibility, but ignored
  // SendGrid Dynamic Template ID - if provided, SendGrid is used; if empty/null, Outreach Tab is used
  sendgridTemplateId?: string; // Auto-detection: Present = SendGrid, Empty = Outreach Tab
};

export type SMSTemplate = {
  id: string;
  name: string;
  content: string;
  event: TemplateEvent;
  enabled?: boolean;
};

// Global branding settings
export type BusinessBrand = {
  primaryColor: string;      // Catalyst Navy #0A2B4A
  secondaryColor: string;    // Catalyst Blue #4A90E2
  tertiaryColor: string;     // Catalyst Gold #d4af37
  backgroundColor: string;   // White/Light background
  textColor: string;         // Main text color
  fontFamily: string;        // Inter, sans-serif
  fontSize: string;          // Base font size
  logoUrl?: string;          // Company logo
  companyName: string;       // LandLinq
  supportEmail: string;      // support email
  supportPhone: string;      // support phone
};

// Simplified Business Settings Database Table
export const businessSettings = pgTable("business_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Email Templates (JSON array)
  emailTemplates: jsonb("email_templates").default('[]').notNull(),
  // SMS Templates (JSON array)
  smsTemplates: jsonb("sms_templates").default('[]').notNull(),
  // Acquisition Criteria (JSON array)
  acquisitionCriteria: jsonb("acquisition_criteria").default('[]').notNull(),
  // Deal Assignments (JSON array)
  dealAssignments: jsonb("deal_assignments").default('[]').notNull(),
  // Rejection Reasons (JSON array)
  rejectionReasons: jsonb("rejection_reasons").default('[]').notNull(),
  // Business Brand Settings
  primaryColor: varchar("primary_color").default("#0A2B4A").notNull(), // Catalyst Navy
  secondaryColor: varchar("secondary_color").default("#4A90E2").notNull(), // Catalyst Blue
  tertiaryColor: varchar("tertiary_color").default("#d4af37").notNull(), // Catalyst Gold
  backgroundColor: varchar("background_color").default("#FFFFFF").notNull(),
  textColor: varchar("text_color").default("#333333").notNull(),
  fontFamily: varchar("font_family").default("Inter, sans-serif").notNull(),
  fontSize: varchar("font_size").default("16px").notNull(),
  logoUrl: varchar("logo_url"),
  companyName: varchar("company_name").default("LandLinq").notNull(),
  supportEmail: varchar("support_email").default("catalyst@landlinq.ai").notNull(),
  supportPhone: varchar("support_phone").default("(704) 610-1549").notNull(),
  emailSignature: text("email_signature"),
  tagline: varchar("tagline").default("Professional Land Acquisition Platform").notNull(),
  buttonStyle: varchar("button_style").default("rounded").notNull(),
  emailWidth: varchar("email_width").default("600px").notNull(),
  // Master Outreach Toggle (Dec 12, 2025) - When false, ALL broker outreach is disabled
  outreachMasterEnabled: boolean("outreach_master_enabled").default(true).notNull(),
  // HubSpot Daily Sync Limit - Max new contacts to sync per day (for email deliverability)
  hubspotDailySyncLimit: integer("hubspot_daily_sync_limit").default(100),
  // News Feed Preferences for Executive Dashboard
  newsPreferences: jsonb("news_preferences").default('{"keywords":["interest rates","charlotte nc","multifamily real estate","commercial real estate","apartment"],"excludedDomains":[],"sentiment":"all","enabled":true}'),
  // Metadata
  isActive: boolean("is_active").default(true),
  bucketId: text("bucket_id"),
  dripDryRunMode: boolean("drip_dry_run_mode").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Business Settings Zod Schemas
export const insertBusinessSettingsSchema = createInsertSchema(businessSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  emailTemplates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    subject: z.string(),
    content: z.string(),
    html: z.string().optional(),
    event: z.enum(['broker_registered', 'deal_submitted', 'info_missing', 'info_missing_acreage', 'info_missing_price', 'info_missing_both', 'status_under_review', 'status_pursuing', 'status_rejected', 'loi_sent', 'monthly_broker_outreach', 'weekly_report']),
    enabled: z.boolean().default(true),
    templateSource: z.enum(['outreach', 'sendgrid']).default('outreach').optional(),
    sendgridTemplateId: z.string().optional()
  })).default([]),
  smsTemplates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    content: z.string().max(160, "SMS content must be 160 characters or less"),
    event: z.enum(['broker_registered', 'deal_submitted', 'sms_opt_in', 'sms_unsubscribe', 'info_missing', 'info_missing_acreage', 'info_missing_price', 'info_missing_both', 'info_missing_reminder', 'status_under_review', 'status_pursuing', 'status_rejected', 'monthly_broker_outreach', 'weekly_report']),
    enabled: z.boolean().default(true)
  })).default([]),
  acquisitionCriteria: z.array(z.object({
    id: z.string(),
    developmentType: z.string(),
    minAcres: z.number(),
    minLotCount: z.number(),
    minPrice: z.number(),
    maxPrice: z.number(),
    markets: z.array(z.string()),
    rentRequirements: z.string()
  })).default([]),
  dealAssignments: z.array(z.object({
    id: z.string(),
    analystName: z.string(),
    analystEmail: z.string(),
    markets: z.array(z.string()),
    developmentTypes: z.array(z.string())
  })).default([])
});

// Types
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettings.$inferSelect;

// Simplified Business Settings
export type BusinessSettingsData = {
  emailTemplates: EmailTemplate[];
  smsTemplates: SMSTemplate[];
  businessBrand: BusinessBrand;
  marketRules: {
    id: string;
    market: string;
    greenCriteria: string;
    yellowCriteria: string;
    redCriteria: string;
    priceThresholds: {
      greenMax: number;
      yellowMax: number;
    };
    sizeThresholds: {
      minAcres: number;
      idealAcres: number;
    };
  }[];
};

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ==================================================
// REFERRAL TRACKING SYSTEM TABLES
// ==================================================

// Referral links table - tracks all generated referral links
export const referralLinks = pgTable("referral_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  referralCode: varchar("referral_code").unique(),
  linkType: varchar("link_type"), // 'signup', 'deal_share', 'partner_invite'
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  clickCount: integer("click_count").default(0),
  conversionCount: integer("conversion_count").default(0),
  metadata: jsonb("metadata"), // Additional data like campaign info
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_referral_links_broker_id").on(table.brokerId),
  index("idx_referral_links_code").on(table.referralCode),
  index("idx_referral_links_type").on(table.linkType),
]);

// Referral activities table - tracks all referral events
export const referralActivities = pgTable("referral_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralLinkId: varchar("referral_link_id").references(() => referralLinks.id).notNull(),
  referrerBrokerId: varchar("referrer_broker_id").references(() => brokers.id).notNull(),
  activityType: varchar("activity_type").notNull(), // 'click', 'signup', 'deal_submit', 'commission_earned'
  referredUserId: varchar("referred_user_id").references(() => users.id),
  referredBrokerId: varchar("referred_broker_id").references(() => brokers.id),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "set null" }),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }), // Commission or deal value
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_referral_activities_link_id").on(table.referralLinkId),
  index("idx_referral_activities_referrer").on(table.referrerBrokerId),
  index("idx_referral_activities_type").on(table.activityType),
  index("idx_referral_activities_created").on(table.createdAt),
]);

// Commission splits table - tracks how commissions are divided
export const commissionSplits = pgTable("commission_splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  primaryBrokerId: varchar("primary_broker_id").references(() => brokers.id).notNull(),
  referrerBrokerId: varchar("referrer_broker_id").references(() => brokers.id),
  totalCommission: decimal("total_commission", { precision: 10, scale: 2 }).notNull(),
  primaryBrokerShare: decimal("primary_broker_share", { precision: 10, scale: 2 }).notNull(),
  referrerShare: decimal("referrer_share", { precision: 10, scale: 2 }).default('0'),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default('0'),
  splitType: varchar("split_type").notNull(), // 'referral', 'partnership', 'finder_fee'
  splitPercentage: decimal("split_percentage", { precision: 5, scale: 2 }), // e.g., 10.00 for 10%
  status: varchar("status").default("pending"), // 'pending', 'approved', 'paid', 'disputed'
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_commission_splits_deal_id").on(table.dealId),
  index("idx_commission_splits_primary_broker").on(table.primaryBrokerId),
  index("idx_commission_splits_referrer").on(table.referrerBrokerId),
  index("idx_commission_splits_status").on(table.status),
]);

// Partner broker relationships table
export const brokerPartnerships = pgTable("broker_partnerships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerAId: varchar("broker_a_id").references(() => brokers.id).notNull(),
  brokerBId: varchar("broker_b_id").references(() => brokers.id).notNull(),
  partnershipType: varchar("partnership_type").notNull(), // 'referral_partner', 'co_broker', 'preferred_partner'
  status: varchar("status").default("active"), // 'active', 'inactive', 'suspended'
  commissionSplitPercentage: decimal("commission_split_percentage", { precision: 5, scale: 2 }).default('10.00'),
  totalDealsShared: integer("total_deals_shared").default(0),
  totalCommissionShared: decimal("total_commission_shared", { precision: 10, scale: 2 }).default('0'),
  notes: text("notes"),
  establishedAt: timestamp("established_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_broker_partnerships_broker_a").on(table.brokerAId),
  index("idx_broker_partnerships_broker_b").on(table.brokerBId),
  index("idx_broker_partnerships_type").on(table.partnershipType),
  index("idx_broker_partnerships_status").on(table.status),
]);

// Referral performance metrics table
export const referralMetrics = pgTable("referral_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id).notNull(),
  metricDate: date("metric_date").notNull(),
  totalReferrals: integer("total_referrals").default(0),
  successfulReferrals: integer("successful_referrals").default(0),
  clicksGenerated: integer("clicks_generated").default(0),
  signupsGenerated: integer("signups_generated").default(0),
  dealsGenerated: integer("deals_generated").default(0),
  commissionEarned: decimal("commission_earned", { precision: 10, scale: 2 }).default('0'),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default('0'),
  avgDealValue: decimal("avg_deal_value", { precision: 10, scale: 2 }).default('0'),
  topPerformer: boolean("top_performer").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_referral_metrics_broker_id").on(table.brokerId),
  index("idx_referral_metrics_date").on(table.metricDate),
  index("idx_referral_metrics_top_performer").on(table.topPerformer),
]);

// ==================================================
// PUBLIC LISTING CROSS-REFERENCE SYSTEM TABLES
// ==================================================


// Public listings table - stores scraped listing data
export const publicListings = pgTable("public_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Source information
  source: varchar("source").notNull(),
  sourceListingId: varchar("source_listing_id"), // Original platform listing ID
  sourceUrl: text("source_url"), // Direct URL to listing
  
  // Property details
  address: text("address").notNull(),
  standardizedAddress: text("standardized_address"), // USPS standardized
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  county: varchar("county"),
  
  // Property characteristics
  propertyType: varchar("property_type"), // commercial, multifamily, land, etc.
  sizeAcres: decimal("size_acres", { precision: 8, scale: 2 }),
  squareFootage: integer("square_footage"),
  unitCount: integer("unit_count"),
  lotSize: integer("lot_size"), // in square feet
  
  // Financial data
  listingPrice: decimal("listing_price", { precision: 12, scale: 2 }),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }),
  pricePerAcre: decimal("price_per_acre", { precision: 10, scale: 2 }),
  pricePerSqFt: decimal("price_per_sq_ft", { precision: 8, scale: 2 }),
  
  // Listing details
  listingDate: timestamp("listing_date"), // When originally listed
  daysOnMarket: integer("days_on_market"),
  status: varchar("status").default("active"),
  description: text("description"),
  
  // Property features
  zoning: varchar("zoning"),
  yearBuilt: integer("year_built"),
  hasUtilities: boolean("has_utilities"),
  hasEntitlements: boolean("has_entitlements"),
  
  // Market data
  capRate: decimal("cap_rate", { precision: 5, scale: 3 }),
  noi: decimal("noi", { precision: 12, scale: 2 }),
  averageRent: decimal("average_rent", { precision: 8, scale: 2 }),
  
  // Broker/agent information
  listingBroker: varchar("listing_broker"),
  brokerCompany: varchar("broker_company"),
  // brokerPhone: removed - column doesn't exist in public listings table  
  brokerEmail: varchar("broker_email"),
  
  // Scraping metadata
  lastScrapedAt: timestamp("last_scraped_at").defaultNow(),
  scrapingSource: varchar("scraping_source"), // manual, api
  scrapingConfidence: decimal("scraping_confidence", { precision: 5, scale: 2 }),
  
  // Images and media
  imageUrls: jsonb("image_urls"), // array of image URLs
  documentUrls: jsonb("document_urls"), // array of document URLs
  
  // Geolocation
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Quality and validation
  dataQuality: decimal("data_quality", { precision: 5, scale: 2 }), // 0-100 score
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("public_listings_source_idx").on(table.source),
  index("public_listings_address_idx").on(table.address),
  index("public_listings_standardized_address_idx").on(table.standardizedAddress),
  index("public_listings_city_state_idx").on(table.city, table.state),
  index("public_listings_zip_idx").on(table.zipCode),
  index("public_listings_price_idx").on(table.listingPrice),
  index("public_listings_property_type_idx").on(table.propertyType),
  index("public_listings_status_idx").on(table.status),
  index("public_listings_listing_date_idx").on(table.listingDate),
  index("public_listings_scraped_idx").on(table.lastScrapedAt),
  index("public_listings_location_idx").on(table.latitude, table.longitude),
]);

// LoopNet staged listings — saved for manual review before pipeline import
export const loopnetStagedListings = pgTable("loopnet_staged_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stagedAt: timestamp("staged_at").defaultNow(),
  stagedBy: varchar("staged_by"), // user id who staged it
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id),
  status: varchar("status").default("pending"), // pending | approved | rejected

  // Raw listing fields from LoopNet search
  listingId: varchar("listing_id"),
  address: text("address").notNull(),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  propertyType: varchar("property_type"),
  listingType: varchar("listing_type"), // sale | lease
  listingPrice: decimal("listing_price", { precision: 15, scale: 2 }),
  sizeAcres: decimal("size_acres", { precision: 10, scale: 4 }),
  squareFootage: integer("square_footage"),
  daysOnMarket: integer("days_on_market"),
  description: text("description"),
  listingBroker: varchar("listing_broker"),
  brokerCompany: varchar("broker_company"),
  brokerEmail: varchar("broker_email"),
  sourceUrl: text("source_url"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),

  // Set when approved
  dealId: varchar("deal_id"),
  approvedAt: timestamp("approved_at"),
});

// Public listing matches table - connects deals to public listings
export const publicListingMatches = pgTable("public_listing_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Related entities
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  publicListingId: varchar("public_listing_id").references(() => publicListings.id).notNull(),
  
  // Match quality
  matchConfidence: varchar("match_confidence").notNull(),
  matchScore: decimal("match_score", { precision: 5, scale: 2 }), // 0-100 numerical score
  
  // Match criteria
  addressMatch: boolean("address_match").default(false),
  sizeMatch: boolean("size_match").default(false), // within tolerance
  priceMatch: boolean("price_match").default(false), // within reasonable range
  typeMatch: boolean("type_match").default(false), // property type matches
  unitsMatch: boolean("units_match").default(false), // unit count matches
  
  // Price comparison analysis
  dealPrice: decimal("deal_price", { precision: 12, scale: 2 }),
  listingPrice: decimal("listing_price", { precision: 12, scale: 2 }),
  priceDifferenceAmount: decimal("price_difference_amount", { precision: 12, scale: 2 }),
  priceDifferencePercent: decimal("price_difference_percent", { precision: 5, scale: 2 }),
  priceComparison: varchar("price_comparison"), // higher, lower, similar
  
  // Market exposure analysis
  isWidelyMarketed: boolean("is_widely_marketed").default(false),
  marketingChannels: jsonb("marketing_channels"), // array of platforms found on
  daysOnMarketWhenMatched: integer("days_on_market_when_matched"),
  
  // Broker comparison
  sameListingBroker: boolean("same_listing_broker").default(false),
  brokerConflictFlag: boolean("broker_conflict_flag").default(false),
  
  // Analysis results
  isLikelyDuplicate: boolean("is_likely_duplicate").default(false),
  isPriceDiscrepancy: boolean("is_price_discrepancy").default(false),
  requiresAnalystReview: boolean("requires_analyst_review").default(false),
  
  // Matching algorithm metadata
  matchingAlgorithm: varchar("matching_algorithm"), // exact, fuzzy, ml
  algorithmVersion: varchar("algorithm_version"),
  
  // Review status
  analystReviewed: boolean("analyst_reviewed").default(false),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  analystNotes: text("analyst_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("public_listing_matches_deal_idx").on(table.dealId),
  index("public_listing_matches_listing_idx").on(table.publicListingId),
  index("public_listing_matches_confidence_idx").on(table.matchConfidence),
  index("public_listing_matches_score_idx").on(table.matchScore),
  index("public_listing_matches_duplicate_idx").on(table.isLikelyDuplicate),
  index("public_listing_matches_review_idx").on(table.requiresAnalystReview),
  index("public_listing_matches_analyst_reviewed_idx").on(table.analystReviewed),
]);

// Public listing searches table - cache and track search attempts
export const publicListingSearches = pgTable("public_listing_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Search parameters
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  searchAddress: text("search_address").notNull(),
  searchRadius: decimal("search_radius", { precision: 5, scale: 2 }), // miles
  
  // Sources checked
  sourcesSearched: jsonb("sources_searched").notNull(), // array of platforms
  successfulSources: jsonb("successful_sources"), // platforms that returned data
  failedSources: jsonb("failed_sources"), // platforms that failed or errored
  
  // Search results summary
  totalListingsFound: integer("total_listings_found").default(0),
  exactMatches: integer("exact_matches").default(0),
  highConfidenceMatches: integer("high_confidence_matches").default(0),
  mediumConfidenceMatches: integer("medium_confidence_matches").default(0),
  lowConfidenceMatches: integer("low_confidence_matches").default(0),
  
  // Performance metrics
  searchStartedAt: timestamp("search_started_at").defaultNow(),
  searchCompletedAt: timestamp("search_completed_at"),
  totalSearchTimeMs: integer("total_search_time_ms"),
  
  // Cache management
  cacheExpiresAt: timestamp("cache_expires_at"), // when this search expires
  isCached: boolean("is_cached").default(true),
  
  // Search quality
  searchSuccess: boolean("search_success").default(false),
  errorMessages: jsonb("error_messages"), // array of error messages
  searchConfidence: decimal("search_confidence", { precision: 5, scale: 2 }),
  
  // Triggering context
  triggeredBy: varchar("triggered_by"), // manual, auto, validation_pipeline
  triggeredByUserId: varchar("triggered_by_user_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("public_listing_searches_deal_idx").on(table.dealId),
  index("public_listing_searches_address_idx").on(table.searchAddress),
  index("public_listing_searches_completed_idx").on(table.searchCompletedAt),
  index("public_listing_searches_cache_idx").on(table.cacheExpiresAt),
  index("public_listing_searches_success_idx").on(table.searchSuccess),
]);

// Public listing source performance table - track scraping reliability
export const publicListingSources = pgTable("public_listing_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Source identification
  sourceName: varchar("source_name").notNull(),
  sourceUrl: varchar("source_url"), // base URL
  
  // Performance metrics
  totalSearches: integer("total_searches").default(0),
  successfulSearches: integer("successful_searches").default(0),
  failedSearches: integer("failed_searches").default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  
  // Response time metrics
  averageResponseTimeMs: integer("average_response_time_ms"),
  lastResponseTimeMs: integer("last_response_time_ms"),
  
  // Data quality metrics
  averageDataQuality: decimal("average_data_quality", { precision: 5, scale: 2 }),
  averageResultCount: decimal("average_result_count", { precision: 5, scale: 2 }),
  
  // Reliability tracking
  lastSuccessfulSearch: timestamp("last_successful_search"),
  lastFailedSearch: timestamp("last_failed_search"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Rate limiting and health
  isActive: boolean("is_active").default(true),
  rateLimitHits: integer("rate_limit_hits").default(0),
  blockedUntil: timestamp("blocked_until"),
  
  // Configuration
  searchTimeoutMs: integer("search_timeout_ms").default(30000),
  maxRetries: integer("max_retries").default(3),
  priorityLevel: integer("priority_level").default(5), // 1-10, higher = more priority
  
  // Error tracking
  lastErrorMessage: text("last_error_message"),
  errorPatterns: jsonb("error_patterns"), // common error types
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("public_listing_sources_name_idx").on(table.sourceName),
  index("public_listing_sources_active_idx").on(table.isActive),
  index("public_listing_sources_success_rate_idx").on(table.successRate),
  index("public_listing_sources_priority_idx").on(table.priorityLevel),
  index("public_listing_sources_last_success_idx").on(table.lastSuccessfulSearch),
]);

// API Health Monitoring Tables

// API health metrics table for real-time monitoring
export const apiHealthMetrics = pgTable("api_health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API identification
  apiName: varchar("api_name").notNull(), // "hellodata", "usps", "census"
  endpoint: varchar("endpoint"), // specific endpoint called
  operationType: varchar("operation_type"), // "property_lookup", "geocoding", "validation"
  
  // Request details
  requestId: varchar("request_id"), // for tracing
  requestData: jsonb("request_data"), // request parameters (sanitized)
  
  // Response metrics
  success: boolean("success").notNull(),
  responseTimeMs: integer("response_time_ms"),
  httpStatusCode: integer("http_status_code"),
  
  // Error tracking
  errorType: varchar("error_type"), // "timeout", "rate_limit", "invalid_response", "network_error"
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"), // structured error info
  
  // Data quality
  dataReceived: boolean("data_received").default(false),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0-100
  dataCompleteness: decimal("data_completeness", { precision: 5, scale: 2 }), // 0-100
  
  // Circuit breaker state
  circuitBreakerState: varchar("circuit_breaker_state"), // "closed", "open", "half_open"
  retryAttempt: integer("retry_attempt").default(0),
  
  // Context
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id),
  
  timestamp: timestamp("timestamp").defaultNow(),
  method: varchar("method").default("GET"),
  errorCode: varchar("error_code"),
  dataCompletenessScore: decimal("data_completeness_score", { precision: 5, scale: 2 }).default("0.00"),
  retryAttempts: integer("retry_attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  dataQualityScore: decimal("data_quality_score", { precision: 5, scale: 2 }).default("0.00"),
  validationWarnings: text("validation_warnings"),
  processingDurationMs: integer("processing_duration_ms"),
}, (table) => [
  index("api_health_metrics_api_idx").on(table.apiName),
  index("api_health_metrics_timestamp_idx").on(table.timestamp),
  index("api_health_metrics_success_idx").on(table.success),
  index("api_health_metrics_deal_idx").on(table.dealId),
  index("api_health_metrics_response_time_idx").on(table.responseTimeMs),
]);

// API data sources table for transparency
export const apiDataSources = pgTable("api_data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Deal association
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  
  // Data field mapping
  dataField: varchar("data_field").notNull(), // "address", "price", "zoning", "demographics"
  dataValue: text("data_value"), // actual value stored
  
  // Source attribution
  primarySource: varchar("primary_source"), // which API provided this data
  backupSources: text("backup_sources"), // fallback sources attempted
  sourceConfidence: decimal("source_confidence", { precision: 5, scale: 2 }),
  
  // Data quality indicators
  isEstimated: boolean("is_estimated").default(false),
  isMockData: boolean("is_mock_data").default(false),
  isUserProvided: boolean("is_user_provided").default(false),
  validationStatus: varchar("validation_status"), // "verified", "unverified", "conflicting"
  
  // Source metadata
  sourceMetadata: jsonb("source_metadata"), // API response metadata
  retrievedAt: timestamp("retrieved_at"),
  lastValidatedAt: timestamp("last_validated_at"),
  
  // Quality scores
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 2 }),
  freshnessScore: decimal("freshness_score", { precision: 5, scale: 2 }),
  reliabilityScore: decimal("reliability_score", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("api_data_sources_deal_idx").on(table.dealId),
  index("api_data_sources_field_idx").on(table.dataField),
  index("api_data_sources_primary_idx").on(table.primarySource),
  index("api_data_sources_mock_idx").on(table.isMockData),
  index("api_data_sources_confidence_idx").on(table.sourceConfidence),
]);

// API performance summary table for dashboard aggregation
export const apiPerformanceSummary = pgTable("api_performance_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Time period
  date: date("date").notNull(),
  hour: integer("hour"), // 0-23 for hourly aggregation
  
  // API identification
  apiName: varchar("api_name").notNull(),
  
  // Performance metrics
  totalRequests: integer("total_requests").default(0),
  successfulRequests: integer("successful_requests").default(0),
  failedRequests: integer("failed_requests").default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  
  // Response time metrics
  avgResponseTime: decimal("avg_response_time", { precision: 8, scale: 2 }),
  minResponseTime: integer("min_response_time"),
  maxResponseTime: integer("max_response_time"),
  p95ResponseTime: integer("p95_response_time"),
  
  // Error analysis
  timeoutErrors: integer("timeout_errors").default(0),
  rateLimitErrors: integer("rate_limit_errors").default(0),
  authenticationErrors: integer("authentication_errors").default(0),
  serverErrors: integer("server_errors").default(0),
  networkErrors: integer("network_errors").default(0),
  
  // Data quality metrics
  avgConfidenceScore: decimal("avg_confidence_score", { precision: 5, scale: 2 }),
  avgDataCompleteness: decimal("avg_data_completeness", { precision: 5, scale: 2 }),
  mockDataUsage: integer("mock_data_usage").default(0),
  
  // Health status
  healthScore: decimal("health_score", { precision: 5, scale: 2 }), // calculated composite score
  isHealthy: boolean("is_healthy").default(true),
  circuitBreakerTripped: boolean("circuit_breaker_tripped").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("api_performance_summary_date_idx").on(table.date),
  index("api_performance_summary_api_idx").on(table.apiName),
  index("api_performance_summary_health_idx").on(table.healthScore),
  index("api_performance_summary_success_rate_idx").on(table.successRate),
]);

// API Call Logs - Permanent storage of all API calls for accurate cost tracking
export const apiCallLogs = pgTable("api_call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API identification
  service: varchar("service").notNull(), // 'OpenAI', 'HelloData', 'ArcGIS', 'Geocodio', 'Twilio', 'SendGrid'
  endpoint: varchar("endpoint").notNull(), // API endpoint called
  
  // Call details
  success: boolean("success").notNull(),
  responseTime: integer("response_time").notNull(), // milliseconds
  errorMessage: text("error_message"),
  
  // Cost tracking
  costEstimate: decimal("cost_estimate", { precision: 10, scale: 4 }).notNull(), // Cost in cents
  
  // Optional context
  dealId: varchar("deal_id").references(() => deals.id),
  
  // Time tracking for aggregations
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(), // e.g., 2025
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("api_call_logs_service_idx").on(table.service),
  index("api_call_logs_timestamp_idx").on(table.timestamp),
  index("api_call_logs_year_month_idx").on(table.year, table.month),
  index("api_call_logs_deal_idx").on(table.dealId),
  index("api_call_logs_success_idx").on(table.success),
]);


// Outreach System Tables

// Outreach campaigns table - Configures recurring outreach campaigns
export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id),
  name: varchar("name").notNull(),
  status: varchar("status").default("active"),
  cadence: varchar("cadence").default("monthly"), // only 'monthly' for now
  scheduleWeek: varchar("schedule_week").default("1st_monday"), // Options: 1st_monday, 3rd_monday
  sendHourUtc: integer("send_hour_utc").default(9), // Stored as EST hour (9 AM EST)
  channels: jsonb("channels").default('["email"]'), // array of channels to use
  emailTemplateKey: varchar("email_template_key").default("monthlyOutreachReminder"),
  smsTemplateKey: varchar("sms_template_key").default("monthlyOutreachReminder"),
  brokerFilter: jsonb("broker_filter").default('{}'), // criteria to filter target brokers
  rateLimitPerMinute: integer("rate_limit_per_minute").default(10), // messages per minute
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  // Soft delete and archive fields for data protection
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by"), // user email who archived it
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"), // user email who deleted it
  isDemo: boolean("is_demo").default(false), // true = seeded demo-only campaign, shown only to demo user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("outreach_campaigns_status_idx").on(table.status),
  index("outreach_campaigns_next_run_idx").on(table.nextRunAt),
]);

// Outreach runs table - Tracks execution of campaigns
export const outreachRuns = pgTable("outreach_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => outreachCampaigns.id, { onDelete: "cascade" }).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status").default("running"),
  totalTargets: integer("total_targets").default(0),
  sentEmailCount: integer("sent_email_count").default(0),
  sentSMSCount: integer("sent_sms_count").default(0),
  failuresCount: integer("failures_count").default(0),
  error: text("error"), // error message if run failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("outreach_runs_campaign_idx").on(table.campaignId),
  index("outreach_runs_started_idx").on(table.startedAt),
  index("outreach_runs_status_idx").on(table.status),
]);

// Outreach messages table - Individual message records with deduplication
export const outreachMessages = pgTable("outreach_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => outreachCampaigns.id, { onDelete: "cascade" }).notNull(),
  runId: varchar("run_id").references(() => outreachRuns.id, { onDelete: "cascade" }).notNull(),
  brokerId: varchar("broker_id").references(() => brokers.id, { onDelete: "cascade" }).notNull(),
  channel: varchar("channel").notNull(),
  recipient: varchar("recipient").notNull(), // Email address or phone number
  periodKey: varchar("period_key").notNull(), // Format: YYYY-MM for deduplication
  templateKey: varchar("template_key").notNull(),
  subject: varchar("subject"), // For email messages
  content: text("content").notNull(), // Message content snapshot (database column name)
  body: text("body"), // Alias for content (for backwards compatibility)
  providerIds: jsonb("provider_ids"), // SendGrid/Twilio message IDs for tracking
  metadata: jsonb("metadata"), // Additional metadata
  status: varchar("status").default("queued"),
  reason: text("reason"), // Reason for failure/skip
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorAt: timestamp("error_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // CRITICAL: Unique constraint for deduplication
  unique("outreach_messages_dedup_unique").on(table.campaignId, table.brokerId, table.channel, table.periodKey),
  index("outreach_messages_campaign_idx").on(table.campaignId),
  index("outreach_messages_run_idx").on(table.runId),
  index("outreach_messages_broker_idx").on(table.brokerId),
  index("outreach_messages_status_idx").on(table.status),
  index("outreach_messages_period_idx").on(table.periodKey),
]);

// Outreach senders table - Partner accounts for sending outreach emails via Outlook
export const outreachSenders = pgTable("outreach_senders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id),
  name: varchar("name").notNull(), // e.g., "AJ Klenk", "Brian Ford"
  email: varchar("email").notNull().unique(), // aj@catalystcp.com, ford@catalystcp.com
  role: varchar("role").default("partner"), // partner, analyst, etc.
  // Microsoft Graph API OAuth tokens (encrypted at rest)
  outlookConnected: boolean("outlook_connected").default(false),
  microsoftAccessToken: text("microsoft_access_token"), // OAuth access token
  microsoftRefreshToken: text("microsoft_refresh_token"), // OAuth refresh token
  microsoftTokenExpiry: timestamp("microsoft_token_expiry"), // Token expiry time
  microsoftUserId: varchar("microsoft_user_id"), // Microsoft user ID
  // HubSpot assignment field for manual broker assignment
  hubspotOwnerId: varchar("hubspot_owner_id"), // HubSpot owner ID for this sender
  hubspotOwnerName: varchar("hubspot_owner_name"), // HubSpot owner display name
  // SMS follow-up settings
  smsFollowupEnabled: boolean("sms_followup_enabled").default(true),
  smsFollowupDays: integer("sms_followup_days").default(3), // Days to wait before SMS if no email response
  // HubSpot tagging automation settings
  hubspotTriggerTag: varchar("hubspot_trigger_tag").default("LandLinq Broker"), // Legacy single tag (deprecated)
  hubspotTriggerTags: text("hubspot_trigger_tags").array(), // Multiple trigger tags - each triggers a different drip campaign
  welcomeTemplateKey: varchar("welcome_template_key"), // Email template key from businessSettings
  deliveryMethod: varchar("delivery_method").default("email"), // email, sms, or both
  delayAfterTagging: integer("delay_after_tagging").default(0), // Hours to wait after HubSpot tagging
  // Email Signature - Per-sender signature (HTML) for personalized outreach
  signatureHtml: text("signature_html"), // HTML email signature for this sender
  // Email Deliverability Safeguard Fields
  warmupStage: integer("warmup_stage").default(1), // 1-5, controls daily send limit progression
  warmupStartDate: timestamp("warmup_start_date"), // When warm-up period began
  dailyLimitOverride: integer("daily_limit_override"), // Manual override for daily limit (null = use stage default)
  sendingPaused: boolean("sending_paused").default(false), // Circuit breaker - pauses all sending
  pausedReason: text("paused_reason"), // Why sending was paused
  pausedAt: timestamp("paused_at"), // When sending was paused
  maxBounceRate: decimal("max_bounce_rate", { precision: 5, scale: 2 }).default("5.00"), // Max bounce rate before pause (%)
  maxComplaintRate: decimal("max_complaint_rate", { precision: 5, scale: 2 }).default("0.10"), // Max complaint rate before pause (%)
  consecutiveHealthyDays: integer("consecutive_healthy_days").default(0), // Days meeting health criteria for stage advancement
  lastHealthCheckDate: date("last_health_check_date"), // Last time health metrics were evaluated
  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("outreach_senders_email_idx").on(table.email),
  index("outreach_senders_active_idx").on(table.isActive),
]);

// Sender daily stats - Track engagement metrics per sender per day
export const senderDailyStats = pgTable("sender_daily_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => outreachSenders.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  emailsSent: integer("emails_sent").default(0),
  emailsDelivered: integer("emails_delivered").default(0),
  emailsBounced: integer("emails_bounced").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsReplied: integer("emails_replied").default(0),
  emailsComplained: integer("emails_complained").default(0), // Spam complaints
  smsSent: integer("sms_sent").default(0),
  smsDelivered: integer("sms_delivered").default(0),
  smsFailed: integer("sms_failed").default(0),
  smsReplied: integer("sms_replied").default(0),
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }), // Calculated: bounced/sent * 100
  openRate: decimal("open_rate", { precision: 5, scale: 2 }), // Calculated: opened/delivered * 100
  replyRate: decimal("reply_rate", { precision: 5, scale: 2 }), // Calculated: replied/delivered * 100
  healthStatus: varchar("health_status").default("unknown"), // healthy, warning, critical
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("sender_daily_stats_unique").on(table.senderId, table.date),
  index("sender_daily_stats_sender_idx").on(table.senderId),
  index("sender_daily_stats_date_idx").on(table.date),
]);

// Outreach message events - Track individual email/SMS events for engagement analysis
export const outreachMessageEvents = pgTable("outreach_message_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => outreachMessages.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => outreachSenders.id, { onDelete: "cascade" }).notNull(),
  campaignId: varchar("campaign_id").references(() => outreachCampaigns.id, { onDelete: "set null" }),
  eventType: varchar("event_type").notNull(), // sent, delivered, bounced, opened, clicked, replied, complained, unsubscribed
  channel: varchar("channel").notNull(), // email, sms
  recipientEmail: varchar("recipient_email"),
  recipientPhone: varchar("recipient_phone"),
  providerEventId: varchar("provider_event_id"), // SendGrid/Twilio event ID
  bounceType: varchar("bounce_type"), // hard, soft, block
  bounceReason: text("bounce_reason"),
  metadata: jsonb("metadata"), // Additional event data
  eventTimestamp: timestamp("event_timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("outreach_message_events_message_idx").on(table.messageId),
  index("outreach_message_events_sender_idx").on(table.senderId),
  index("outreach_message_events_type_idx").on(table.eventType),
  index("outreach_message_events_timestamp_idx").on(table.eventTimestamp),
]);

// Outreach sender assignment - Links brokers to specific senders
export const outreachSenderAssignments = pgTable("outreach_sender_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").references(() => brokers.id, { onDelete: "cascade" }).notNull(),
  senderId: varchar("sender_id").references(() => outreachSenders.id, { onDelete: "cascade" }).notNull(),
  assignedBy: varchar("assigned_by"), // User who made the assignment (or "hubspot_sync")
  hubspotContactId: varchar("hubspot_contact_id"), // HubSpot contact ID for this broker
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("outreach_sender_assignments_unique").on(table.brokerId, table.senderId),
  index("outreach_sender_assignments_broker_idx").on(table.brokerId),
  index("outreach_sender_assignments_sender_idx").on(table.senderId),
]);

// HubSpot sync log - Tracks webhook events and sync operations
export const hubspotSyncLog = pgTable("hubspot_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(), // contact.created, contact.updated, contact.propertyChange
  hubspotContactId: varchar("hubspot_contact_id").notNull(),
  hubspotOwnerId: varchar("hubspot_owner_id"),
  tagName: varchar("tag_name"), // e.g., "LandLinq Broker"
  brokerId: varchar("broker_id"), // LandLinq broker ID if created/linked
  senderId: varchar("sender_id"), // Assigned sender ID
  status: varchar("status").default("pending"), // pending, processed, failed, skipped
  errorMessage: text("error_message"),
  rawPayload: jsonb("raw_payload"), // Full webhook payload for debugging
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("hubspot_sync_log_contact_idx").on(table.hubspotContactId),
  index("hubspot_sync_log_status_idx").on(table.status),
  index("hubspot_sync_log_created_idx").on(table.createdAt),
]);

// Outreach campaign steps - Multi-step drip campaigns per sender
export const outreachCampaignSteps = pgTable("outreach_campaign_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => outreachSenders.id, { onDelete: "cascade" }).notNull(),
  sequenceIndex: integer("sequence_index").notNull(), // Order in the campaign (0, 1, 2...)
  dayNumber: integer("day_number").notNull(), // Days after trigger (1, 10, 30, etc.)
  channel: varchar("channel").notNull(), // 'email' or 'sms'
  subject: varchar("subject"), // For email steps
  content: text("content").notNull(), // Message body (supports personalization tokens)
  templateKey: varchar("template_key"), // Optional - use template from businessSettings
  lineHeight: varchar("line_height").default('1.5'), // Email line height (1.0, 1.15, 1.4, 1.5, 1.75, 2.0)
  attachments: text("attachments"), // JSON array of {filename, url, contentType, size}
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("outreach_campaign_steps_sender_idx").on(table.senderId),
  index("outreach_campaign_steps_sequence_idx").on(table.senderId, table.sequenceIndex),
]);

// Type exports for outreach senders
export type OutreachSender = typeof outreachSenders.$inferSelect;
export type InsertOutreachSender = typeof outreachSenders.$inferInsert;
export type OutreachSenderAssignment = typeof outreachSenderAssignments.$inferSelect;
export type InsertOutreachSenderAssignment = typeof outreachSenderAssignments.$inferInsert;
export type HubspotSyncLog = typeof hubspotSyncLog.$inferSelect;
export type InsertHubspotSyncLog = typeof hubspotSyncLog.$inferInsert;
export type OutreachCampaignStep = typeof outreachCampaignSteps.$inferSelect;
export type InsertOutreachCampaignStep = typeof outreachCampaignSteps.$inferInsert;

// ============================================================================
// SHARED CAMPAIGN TEMPLATES - Tag-based campaign routing for scalable outreach
// ============================================================================
// Campaign templates are shared across all senders. Routing works as:
// - HubSpot Owner ID → determines WHO sends (which sender's OAuth/signature)
// - HubSpot Tag → determines WHAT content (which campaign template)
// This allows any sender to send any campaign based on contact tags.

export const outreachCampaignTemplates = pgTable("outreach_campaign_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "Known Sophisticated", "Unknown Sophisticated"
  description: text("description"), // Optional description for the campaign
  hubspotTriggerTag: varchar("hubspot_trigger_tag").notNull().unique(), // Tag that triggers this campaign
  teamId: varchar("team_id"), // For multi-tenancy support
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("outreach_campaign_templates_tag_idx").on(table.hubspotTriggerTag),
  index("outreach_campaign_templates_active_idx").on(table.isActive),
]);

// Campaign template steps - Multi-step drip sequence for each template
export const outreachCampaignTemplateSteps = pgTable("outreach_campaign_template_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => outreachCampaignTemplates.id, { onDelete: "cascade" }).notNull(),
  sequenceIndex: integer("sequence_index").notNull(), // Order in the campaign (0, 1, 2...)
  dayNumber: integer("day_number").notNull(), // Days after trigger (1, 10, 30, etc.)
  channel: varchar("channel").notNull(), // 'email' or 'sms'
  subject: varchar("subject"), // For email steps
  content: text("content").notNull(), // Message body (supports personalization tokens)
  sendgridTemplateId: varchar("sendgrid_template_id"), // Optional - use SendGrid dynamic template
  lineHeight: varchar("line_height").default('1.5'), // Email line height (1.0, 1.15, 1.4, 1.5, 1.75, 2.0)
  attachments: text("attachments"), // JSON array of {filename, url, contentType, size}
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("outreach_campaign_template_steps_template_idx").on(table.templateId),
  index("outreach_campaign_template_steps_sequence_idx").on(table.templateId, table.sequenceIndex),
]);

// Drip Campaign Enrollments - Tracks each contact's progress through a campaign
export const dripCampaignEnrollments = pgTable("drip_campaign_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactEmail: varchar("contact_email").notNull(),
  contactFirstName: varchar("contact_first_name"),
  contactLastName: varchar("contact_last_name"),
  contactPhone: varchar("contact_phone"),
  hubspotContactId: varchar("hubspot_contact_id"),
  brokerId: varchar("broker_id").references(() => brokers.id),
  targetState: varchar("target_state", { length: 2 }),
  templateId: varchar("template_id").references(() => outreachCampaignTemplates.id).notNull(),
  senderId: varchar("sender_id").references(() => outreachSenders.id, { onDelete: "cascade" }).notNull(),
  currentStepIndex: integer("current_step_index").default(0).notNull(), // Which step they're on (0 = first)
  nextSendAt: timestamp("next_send_at").notNull(), // When next email should be sent
  status: varchar("status").default("pending").notNull(), // pending, in_progress, completed, paused, failed
  totalStepsSent: integer("total_steps_sent").default(0).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  lastSentStepId: varchar("last_sent_step_id"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  pausedReason: text("paused_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("drip_enrollments_next_send_idx").on(table.nextSendAt, table.status),
  index("drip_enrollments_email_idx").on(table.contactEmail),
  index("drip_enrollments_template_idx").on(table.templateId),
  index("drip_enrollments_sender_idx").on(table.senderId),
  index("drip_enrollments_status_idx").on(table.status),
]);

// Type exports for shared campaign templates
export type OutreachCampaignTemplate = typeof outreachCampaignTemplates.$inferSelect;
export type InsertOutreachCampaignTemplate = typeof outreachCampaignTemplates.$inferInsert;
export type OutreachCampaignTemplateStep = typeof outreachCampaignTemplateSteps.$inferSelect;
export type InsertOutreachCampaignTemplateStep = typeof outreachCampaignTemplateSteps.$inferInsert;
export type DripCampaignEnrollment = typeof dripCampaignEnrollments.$inferSelect;
export type InsertDripCampaignEnrollment = typeof dripCampaignEnrollments.$inferInsert;

export type SenderDailyStats = typeof senderDailyStats.$inferSelect;
export type InsertSenderDailyStats = typeof senderDailyStats.$inferInsert;
export type OutreachMessageEvent = typeof outreachMessageEvents.$inferSelect;
export type InsertOutreachMessageEvent = typeof outreachMessageEvents.$inferInsert;

// Type exports for referral system
export type ReferralLink = typeof referralLinks.$inferSelect;
export type InsertReferralLink = typeof referralLinks.$inferInsert;

export type ReferralActivity = typeof referralActivities.$inferSelect;
export type InsertReferralActivity = typeof referralActivities.$inferInsert;

export type CommissionSplit = typeof commissionSplits.$inferSelect;
export type InsertCommissionSplit = typeof commissionSplits.$inferInsert;

export type BrokerPartnership = typeof brokerPartnerships.$inferSelect;
export type InsertBrokerPartnership = typeof brokerPartnerships.$inferInsert;

export type ReferralMetrics = typeof referralMetrics.$inferSelect;
export type InsertReferralMetrics = typeof referralMetrics.$inferInsert;

// Public listing cross-reference system types
export type PublicListing = typeof publicListings.$inferSelect;
export type InsertPublicListing = typeof publicListings.$inferInsert;
export type PublicListingMatch = typeof publicListingMatches.$inferSelect;
export type InsertPublicListingMatch = typeof publicListingMatches.$inferInsert;
export type PublicListingSearch = typeof publicListingSearches.$inferSelect;
export type InsertPublicListingSearch = typeof publicListingSearches.$inferInsert;
export type PublicListingSource = typeof publicListingSources.$inferSelect;
export type InsertPublicListingSource = typeof publicListingSources.$inferInsert;

// Public listing data structure for deals.publicListings JSONB field
export interface PublicListingData {
  validationSuccess?: boolean;
  isPubliclyListed?: boolean;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  marketExposure?: 'wide' | 'moderate' | 'limited' | 'none';
  platformsFound?: string[];
  requiresAnalystReview?: boolean;
  exclusivityStatus?: {
    brokerExclusivity?: boolean;
    exclusiveUntil?: string;
  };
  priceComparison?: {
    hasComparison: boolean;
    differencePercent: number;
    assessment: 'underpriced' | 'overpriced' | 'market' | 'unknown';
    referencePrice?: number;
    referencePlatform?: string;
  };
  lastChecked?: string;
  searchMetadata?: {
    searchId: string;
    sourcesChecked: string[];
    totalResults: number;
  };
}

// Create Zod schemas for validation
export const insertReferralLinkSchema = createInsertSchema(referralLinks);
export const insertReferralActivitySchema = createInsertSchema(referralActivities);
export const insertCommissionSplitSchema = createInsertSchema(commissionSplits);
export const insertBrokerPartnershipSchema = createInsertSchema(brokerPartnerships);
export const insertReferralMetricsSchema = createInsertSchema(referralMetrics);

// Public listing cross-reference system schemas
export const insertPublicListingSchema = createInsertSchema(publicListings).omit({
  id: true,
  lastScrapedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicListingMatchSchema = createInsertSchema(publicListingMatches).omit({
  id: true,
  analystReviewed: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicListingSearchSchema = createInsertSchema(publicListingSearches).omit({
  id: true,
  searchStartedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicListingSourceSchema = createInsertSchema(publicListingSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// API monitoring system types
export type ApiHealthMetric = typeof apiHealthMetrics.$inferSelect;
export type InsertApiHealthMetric = typeof apiHealthMetrics.$inferInsert;

export type ApiDataSource = typeof apiDataSources.$inferSelect;
export type InsertApiDataSource = typeof apiDataSources.$inferInsert;

export type ApiPerformanceSummary = typeof apiPerformanceSummary.$inferSelect;
export type InsertApiPerformanceSummary = typeof apiPerformanceSummary.$inferInsert;

// API monitoring schemas
export const insertApiHealthMetricSchema = createInsertSchema(apiHealthMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertApiDataSourceSchema = createInsertSchema(apiDataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiPerformanceSummarySchema = createInsertSchema(apiPerformanceSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Outreach system type exports
export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = typeof outreachCampaigns.$inferInsert;

export type OutreachRun = typeof outreachRuns.$inferSelect;
export type InsertOutreachRun = typeof outreachRuns.$inferInsert;

export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type InsertOutreachMessage = typeof outreachMessages.$inferInsert;

// Outreach system validation schemas
export const insertOutreachCampaignSchema = createInsertSchema(outreachCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateOutreachCampaignSchema = createInsertSchema(outreachCampaigns).omit({
  createdAt: true,
  updatedAt: true,
}).partial().required({ id: true }); // Allow partial updates but require id

export const insertOutreachRunSchema = createInsertSchema(outreachRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOutreachMessageSchema = createInsertSchema(outreachMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Processed emails table - Permanent deduplication to prevent SendGrid replays
export const processedEmails = pgTable("processed_emails", {
  emailHash: varchar("email_hash").primaryKey(), // Unique hash of email content
  dealId: varchar("deal_id"), // Associated deal ID if created
  from: varchar("from").notNull(), // Sender email
  subject: varchar("subject"), // Email subject
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export type ProcessedEmail = typeof processedEmails.$inferSelect;
export type InsertProcessedEmail = typeof processedEmails.$inferInsert;

export const insertProcessedEmailSchema = createInsertSchema(processedEmails).omit({
  processedAt: true,
});

// Processed SMS table - Permanent deduplication to prevent Twilio webhook retries
export const processedSMS = pgTable("processed_sms", {
  messageSid: varchar("message_sid").primaryKey(), // Twilio MessageSid (unique identifier)
  dealId: varchar("deal_id"), // Associated deal ID if created
  from: varchar("from").notNull(), // Sender phone number
  bodyPreview: varchar("body_preview"), // First 100 chars of message
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export type ProcessedSMS = typeof processedSMS.$inferSelect;
export type InsertProcessedSMS = typeof processedSMS.$inferInsert;

export const insertProcessedSMSSchema = createInsertSchema(processedSMS).omit({
  processedAt: true,
});

// MSA (Metropolitan Statistical Area) and County reference data
export const acquisitionMarkets = pgTable("acquisition_markets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  msaName: varchar("msa_name").notNull(), // e.g., "Charlotte MSA", "Raleigh MSA and Triangle"
  county: varchar("county").notNull(), // e.g., "Mecklenburg", "Wake"
  state: varchar("state", { length: 2 }).notNull(), // e.g., "NC", "SC", "TN"
  fullCountyName: varchar("full_county_name"), // e.g., "Mecklenburg County, NC"
  cityNote: varchar("city_note"), // e.g., "(Raleigh)", "(Charlotte)" - optional clarifier
  productTypes: text("product_types").array().notNull(), // ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"]
  isActive: boolean("is_active").default(true), // Allow markets to be activated/deactivated
  notes: text("notes"), // Optional notes about this market
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // For map visualization
  longitude: decimal("longitude", { precision: 10, scale: 7 }), // For map visualization
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_markets_county_state").on(table.county, table.state),
  index("idx_markets_msa").on(table.msaName),
  unique("unique_county_state_product").on(table.county, table.state, table.productTypes),
]);

export type AcquisitionMarket = typeof acquisitionMarkets.$inferSelect;
export type InsertAcquisitionMarket = typeof acquisitionMarkets.$inferInsert;

export const insertAcquisitionMarketSchema = createInsertSchema(acquisitionMarkets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Background jobs table for async processing (prevents SendGrid timeouts)
export const backgroundJobs = pgTable("background_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: varchar("job_type").notNull(), // e.g., "process_email", "process_sms"
  status: varchar("status").notNull().default("pending"),
  payload: jsonb("payload").notNull(), // Job data (email content, SMS data, etc.)
  result: jsonb("result"), // Result data after processing
  error: text("error"), // Error message if failed
  attempts: integer("attempts").default(0), // Number of processing attempts
  maxAttempts: integer("max_attempts").default(3), // Max retry attempts
  priority: integer("priority").default(5), // Job priority (kept for backward compatibility with existing rows)
  scheduledFor: timestamp("scheduled_for").defaultNow(), // When to process (allows delayed jobs)
  startedAt: timestamp("started_at"), // When processing started
  completedAt: timestamp("completed_at"), // When processing completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_type").on(table.jobType),
  index("idx_jobs_scheduled").on(table.scheduledFor),
]);

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = typeof backgroundJobs.$inferInsert;

export const insertBackgroundJobSchema = createInsertSchema(backgroundJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Geocoding audit log for tracking geocoding accuracy and detecting patterns
export const geocodingAuditLog = pgTable("geocoding_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }), // Link to deal if applicable
  
  // Request details
  requestedAddress: text("requested_address").notNull(), // Address that was geocoded
  service: varchar("service").notNull(), // "Geocodio", "OpenCage", "AI", etc.
  
  // Result details
  success: boolean("success").notNull(),
  errorMessage: text("error_message"), // Error if geocoding failed
  
  // Geocoding quality metrics
  accuracyType: varchar("accuracy_type"), // rooftop, street, range, zip, city, etc.
  accuracyScore: decimal("accuracy_score", { precision: 3, scale: 2 }), // Confidence score 0.0-1.0
  
  // Result coordinates
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  // Parsed address components
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  county: varchar("county"),
  formattedAddress: text("formatted_address"),
  
  // Validation results
  cityMismatch: boolean("city_mismatch").default(false), // User city didn't match geocoded city
  stateMismatch: boolean("state_mismatch").default(false), // User state didn't match geocoded state
  rejectedLowAccuracy: boolean("rejected_low_accuracy").default(false), // Rejected due to low accuracy score
  
  // Metadata
  responseTimeMs: integer("response_time_ms"), // API response time
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_geocoding_deal_id").on(table.dealId),
  index("idx_geocoding_service").on(table.service),
  index("idx_geocoding_accuracy").on(table.accuracyScore),
  index("idx_geocoding_created").on(table.createdAt),
]);

export type GeocodingAuditLog = typeof geocodingAuditLog.$inferSelect;
export type InsertGeocodingAuditLog = typeof geocodingAuditLog.$inferInsert;

export const insertGeocodingAuditLogSchema = createInsertSchema(geocodingAuditLog).omit({
  id: true,
  createdAt: true,
});

// Site Evaluations table for storing LIHTC QAP scoring results
export const siteEvaluations = pgTable("site_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Property identification
  address: text("address").notNull(),
  city: varchar("city"),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  county: varchar("county"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  
  // Link to deal if applicable
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "set null" }),
  
  // Flood Zone Results (FEMA NFHL)
  floodZoneIsInFloodZone: boolean("flood_zone_is_in_flood_zone").default(false),
  floodZoneCode: varchar("flood_zone_code"),
  floodZoneDescription: text("flood_zone_description"),
  
  // Hazardous Sites Results (EPA Envirofacts)
  hazardsHasNearby: boolean("hazards_has_nearby").default(false),
  hazardsCount: integer("hazards_count").default(0),
  hazardsNearestName: varchar("hazards_nearest_name"),
  hazardsNearestType: varchar("hazards_nearest_type"),
  hazardsNearestDistance: decimal("hazards_nearest_distance", { precision: 6, scale: 3 }),
  hazardsDetails: jsonb("hazards_details"), // Array of {name, type, distance}
  
  // Slope Analysis Results (USGS Elevation)
  slopeHasSteep: boolean("slope_has_steep").default(false),
  slopeAvg: decimal("slope_avg", { precision: 5, scale: 2 }),
  slopeMax: decimal("slope_max", { precision: 5, scale: 2 }),
  slopeElevationPoints: jsonb("slope_elevation_points"), // Array of elevation values
  
  // Transit Access Results (Google Transit)
  transitHasNearby: boolean("transit_has_nearby").default(false),
  transitNearestDistance: decimal("transit_nearest_distance", { precision: 6, scale: 3 }),
  transitScore: integer("transit_score").default(0), // 0, 2, or 6 points
  transitStops: jsonb("transit_stops"), // Array of {name, distance, types}
  
  // Incompatible Uses Results
  incompatibleHasIssues: boolean("incompatible_has_issues").default(false),
  incompatibleIssues: jsonb("incompatible_issues"), // Array of issue strings
  
  // LIHTC QAP Score Summary
  scoreNoIncompatibleUses: integer("score_no_incompatible_uses").default(0),
  scoreNoNegativeFeatures: integer("score_no_negative_features").default(0),
  scoreVisibility: integer("score_visibility").default(0),
  scoreTrafficSafety: integer("score_traffic_safety").default(0),
  scoreTransitPoints: integer("score_transit_points").default(0),
  scoreTotal: integer("score_total").default(0),
  // Individual QAP sub-scores (NC 2026)
  scoreNeighborhood: integer("score_neighborhood").default(0),
  scorePrimaryAmenities: integer("score_primary_amenities").default(0),
  scoreSecondaryAmenities: integer("score_secondary_amenities").default(0),
  scoreSiteSuitability: integer("score_site_suitability").default(0),
  scoreNegativePoints: integer("score_negative_points").default(0),
  scoreIncomeRPP: integer("score_income_rpp").default(0),
  scoreTransit: integer("score_transit").default(0),
  scoreOlmstead: integer("score_olmstead").default(0),
  // Nested evaluation data (JSON objects for modal display)
  floodZoneData: jsonb("flood_zone_data"),
  hazardsData: jsonb("hazards_data"),
  slopeData: jsonb("slope_data"),
  transitData: jsonb("transit_data"),
  incompatibleUsesData: jsonb("incompatible_uses_data"),
  amenityDetails: jsonb("amenity_details"),
  censusData: jsonb("census_data"),
  marketInsights: jsonb("market_insights"),
  
  // Full scoring input/output for reference
  scoringInput: jsonb("scoring_input"), // Input parameters used for scoring
  scoringResult: jsonb("scoring_result"), // Full LIHTC scoring result
  
  // Metadata
  evaluatedBy: varchar("evaluated_by"), // User who ran the evaluation
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_site_eval_deal").on(table.dealId),
  index("idx_site_eval_state").on(table.state),
  index("idx_site_eval_county").on(table.county),
  index("idx_site_eval_created").on(table.createdAt),
  index("idx_site_eval_score").on(table.scoreTotal),
]);

export type SiteEvaluation = typeof siteEvaluations.$inferSelect;
export type InsertSiteEvaluation = typeof siteEvaluations.$inferInsert;

export const insertSiteEvaluationSchema = createInsertSchema(siteEvaluations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  evaluatedAt: true,
});

// ========== AI TRAINING DATA SCHEMA ==========


// Pipeline review session transcripts for AI training
export const pipelineReviewTranscripts = pgTable("pipeline_review_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(), // e.g. "Weekly Pipeline Review - Jan 15, 2026"
  sessionDate: date("session_date"), // When the review session occurred
  transcriptText: text("transcript_text"), // Full transcript text
  transcriptFile: varchar("transcript_file"), // URL/path to uploaded file
  duration: integer("duration"), // Duration in minutes
  participantNames: text("participant_names").array(), // Team members in the call
  status: varchar("status").default("pending"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  
  // AI extraction results
  extractedDealsCount: integer("extracted_deals_count").default(0),
  processingNotes: text("processing_notes"), // Any issues during processing
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_transcript_date").on(table.sessionDate),
  index("idx_transcript_status").on(table.status),
]);

export type PipelineReviewTranscript = typeof pipelineReviewTranscripts.$inferSelect;
export type InsertPipelineReviewTranscript = typeof pipelineReviewTranscripts.$inferInsert;

export const insertPipelineReviewTranscriptSchema = createInsertSchema(pipelineReviewTranscripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Individual deal discussions extracted from transcripts
export const transcriptDealMentions = pgTable("transcript_deal_mentions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transcriptId: varchar("transcript_id").references(() => pipelineReviewTranscripts.id).notNull(),
  dealId: varchar("deal_id").references(() => deals.id), // Linked to actual deal if identified
  
  // If deal not identified, store the mentioned property details
  mentionedAddress: text("mentioned_address"),
  mentionedCity: varchar("mentioned_city"),
  mentionedState: varchar("mentioned_state", { length: 2 }),
  
  // Extracted content from the discussion
  discussionExcerpt: text("discussion_excerpt"), // Relevant portion of transcript
  extractedPros: text("extracted_pros").array(), // Positive points mentioned
  extractedCons: text("extracted_cons").array(), // Negative points/concerns
  extractedRisks: text("extracted_risks").array(), // Risk factors identified
  extractedKeyPoints: text("extracted_key_points").array(), // Other key considerations
  teamDecision: varchar("team_decision"), // What the team decided (pursue, pass, needs more info, etc.)
  decisionRationale: text("decision_rationale"), // Why they made that decision
  
  // Human review
  isVerified: boolean("is_verified").default(false), // Has a human confirmed this extraction
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // AI confidence
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_deal_mention_transcript").on(table.transcriptId),
  index("idx_deal_mention_deal").on(table.dealId),
  index("idx_deal_mention_verified").on(table.isVerified),
]);

export type TranscriptDealMention = typeof transcriptDealMentions.$inferSelect;
export type InsertTranscriptDealMention = typeof transcriptDealMentions.$inferInsert;

export const insertTranscriptDealMentionSchema = createInsertSchema(transcriptDealMentions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// AI-generated deal analysis (the output column users will see)
export const aiDealAnalysis = pgTable("ai_deal_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id).notNull().unique(),
  
  // AI-generated analysis
  overallScore: integer("overall_score"), // 1-100 score
  recommendation: varchar("recommendation"), // "pursue", "pass", "needs_review", "high_priority"
  confidenceLevel: varchar("confidence_level"), // "high", "medium", "low"
  
  // Structured analysis
  pros: text("pros").array(),
  cons: text("cons").array(),
  risks: text("risks").array(),
  keyConsiderations: text("key_considerations").array(),
  
  // Summary for quick view
  quickSummary: text("quick_summary"), // 1-2 sentence summary
  
  // Similar past deals used for analysis
  similarDealIds: text("similar_deal_ids").array(), // Reference deals from training
  
  // Model info
  modelVersion: varchar("model_version"), // Track which model/prompt version
  analysisPrompt: text("analysis_prompt"), // The prompt used (for debugging)
  
  generatedAt: timestamp("generated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_analysis_deal").on(table.dealId),
  index("idx_ai_analysis_score").on(table.overallScore),
  index("idx_ai_analysis_recommendation").on(table.recommendation),
]);

export type AiDealAnalysis = typeof aiDealAnalysis.$inferSelect;
export type InsertAiDealAnalysis = typeof aiDealAnalysis.$inferInsert;

export const insertAiDealAnalysisSchema = createInsertSchema(aiDealAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
});

// ─── RSS Feed Sources ─────────────────────────────────────────────────────────
export const rssFeedSources = pgTable("rss_feed_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  minAcres: decimal("min_acres"),
  targetStates: text("target_states").array(),
  pollIntervalHours: integer("poll_interval_hours").default(6).notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastItemCount: integer("last_item_count"),
  totalDealsCreated: integer("total_deals_created").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRssFeedSourceSchema = createInsertSchema(rssFeedSources).omit({
  id: true, createdAt: true, lastPolledAt: true, lastItemCount: true, totalDealsCreated: true,
});
export type RssFeedSource = typeof rssFeedSources.$inferSelect;
export type InsertRssFeedSource = z.infer<typeof insertRssFeedSourceSchema>;

export const rssProcessedListings = pgTable("rss_processed_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedSourceId: varchar("feed_source_id").references(() => rssFeedSources.id, { onDelete: "cascade" }),
  listingGuid: text("listing_guid").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  dealId: varchar("deal_id"),
  status: text("status").notNull(), // 'deal_created' | 'skipped' | 'duplicate' | 'error'
  skipReason: text("skip_reason"),
  listingTitle: text("listing_title"),
  listingUrl: text("listing_url"),
});

export type RssProcessedListing = typeof rssProcessedListings.$inferSelect;


// Partner Developer Network — external developers register their land buy box
// so Catalyst can route deals that don't fit their own criteria
export const partnerDevelopers = pgTable("partner_developers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  // Deal scope
  dealPreference: text("deal_preference"),           // 'land' | 'acquisition' | 'both'
  // Target markets
  targetStates: text("target_states").array(),
  targetMsas: text("target_msas").array(),               // Specific MSAs within selected states
  targetCounties: text("target_counties").array(),       // Specific counties within selected MSAs
  qctInterest: boolean("qct_interest").default(false), // Open to QCT deals outside normal MSA?
  // Product types
  productTypes: text("product_types").array(),
  // Size requirements
  minAcres: decimal("min_acres"),
  maxAcres: decimal("max_acres"),
  minUnits: integer("min_units"),
  maxUnits: integer("max_units"),
  // Financial & market criteria
  maxAskingPricePerAcre: decimal("max_asking_price_per_acre"),
  minRentPsf: decimal("min_rent_psf"),               // Min market rent PSF within 3 miles
  minRentPerUnit: decimal("min_rent_per_unit"),       // Min monthly rent per unit (BTR/unit comps)
  // Acquisition-specific
  minVintageYear: integer("min_vintage_year"),        // Min year built for acquisition deals
  vintageRequirement: text("vintage_requirement"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  autoSendEnabled: boolean("auto_send_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnerDeveloperSchema = createInsertSchema(partnerDevelopers).omit({
  id: true, createdAt: true, isActive: true, autoSendEnabled: true,
});
export type PartnerDeveloper = typeof partnerDevelopers.$inferSelect;

// Tracks every deal that has been auto-sent to a partner developer (dedup guard)
export const partnerDeveloperSends = pgTable("partner_developer_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerId: varchar("developer_id").notNull(),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id),
  dealId: varchar("deal_id").notNull(),
  sentAt: timestamp("sent_at"),
  classification: varchar("classification"),
  matchedProductTypes: text("matched_product_types").array(),
  address: text("address"),
  // Queue status: 'pending' = queued for manual review, 'sent' = already emailed
  status: varchar("status").default("sent").notNull(),
  // Overrides set by analyst in the outbox before sending
  zoningOverride: text("zoning_override"),
  summaryOverride: text("summary_override"),
  wetlandOverride: text("wetland_override"),
  greenFlaggedByDeveloper: boolean("green_flagged_by_developer").default(false).notNull(),
  greenFlaggedAt: timestamp("green_flagged_at"),
  matchedAt: timestamp("matched_at").defaultNow(),
}, (table) => [
  uniqueIndex("partner_developer_sends_profile_deal_unique")
    .on(table.developerProfileId, table.dealId),
]);

// ── Partner Broker Portal Accounts ──────────────────────────────────────────
// Separate from the broker CRM table — these are brokers with LandLinq portal access
export const brokerPortalAccounts = pgTable("broker_portal_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  brokerage: varchar("brokerage"),
  phone: varchar("phone"),
  status: varchar("status").default("active").notNull(), // 'active' | 'pending' | 'inactive'
  // Market scope — deals must match at least one of these to appear
  targetStates: text("target_states").array().default(sql`'{}'::text[]`),
  targetMsas: text("target_msas").array().default(sql`'{}'::text[]`),
  targetCounties: text("target_counties").array().default(sql`'{}'::text[]`),
  targetCities: text("target_cities").array().default(sql`'{}'::text[]`),
  notes: text("notes"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmTagRegistry = pgTable("crm_tag_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Email Intake Queue ────────────────────────────────────────────────────────
// Every inbound deal email lands here. Analyst reviews, edits if needed, then
// approves → deal created. Nothing auto-posts to the deal table.

export const emailIntakeQueue = pgTable("email_intake_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Email metadata
  fromEmail: varchar("from_email").notNull(),
  fromName: varchar("from_name"),
  subject: varchar("subject"),
  emailBody: text("email_body"),
  emailHtml: text("email_html"),
  emailHash: varchar("email_hash").unique(), // prevents SendGrid replay duplicates
  attachmentCount: integer("attachment_count").default(0),
  attachmentNames: text("attachment_names").array().default(sql`'{}'::text[]`),

  // AI-parsed fields (editable by analyst before approval)
  parsedDealType: varchar("parsed_deal_type"), // 'land_development' | 'existing_multifamily' | 'unknown'
  parsedPropertyName: varchar("parsed_property_name"),
  parsedAddress: varchar("parsed_address"),
  parsedCity: varchar("parsed_city"),
  parsedState: varchar("parsed_state"),
  parsedZip: varchar("parsed_zip"),
  parsedAcres: decimal("parsed_acres", { precision: 10, scale: 4 }),
  parsedPrice: bigint("parsed_price", { mode: "number" }),
  parsedUnitCount: integer("parsed_unit_count"),
  parsedVintage: integer("parsed_vintage"),
  parsedBrokerName: varchar("parsed_broker_name"),
  parsedBrokerEmail: varchar("parsed_broker_email"),
  parsedBrokerPhone: varchar("parsed_broker_phone"),
  parsedNotes: text("parsed_notes"),
  parsedZoning: varchar("parsed_zoning"),

  // Confidence
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 2 }),
  fieldConfidences: jsonb("field_confidences"),

  // Review
  status: varchar("status").default("pending"),
  dealId: varchar("deal_id").references(() => deals.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewNotes: text("review_notes"),

  isTrainingExample: boolean("is_training_example").default(false),
  correctionDiff: jsonb("correction_diff"),
  correctionCount: integer("correction_count").default(0),

  // Multi-property email grouping — when one email/attachment lists several
  // distinct tracts, each becomes its own row sharing this groupId.
  groupId: varchar("group_id"),
  groupIndex: integer("group_index"),
  groupTotal: integer("group_total"),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_intake_status_idx").on(table.status),
  index("email_intake_created_idx").on(table.createdAt),
  index("email_intake_from_idx").on(table.fromEmail),
  index("email_intake_group_idx").on(table.groupId),
]);

export const insertEmailIntakeQueueSchema = createInsertSchema(emailIntakeQueue).omit({
  id: true, createdAt: true,
});
export type EmailIntakeQueue = typeof emailIntakeQueue.$inferSelect;
export type InsertEmailIntakeQueue = z.infer<typeof insertEmailIntakeQueueSchema>;

// ── Email Intake Training Examples ────────────────────────────────────────────
// Curated input-output pairs used as few-shot context in the AI prompt.
// Built automatically from analyst-corrected approvals.
export const emailIntakeTrainingExamples = pgTable("email_intake_training_examples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intakeId: varchar("intake_id").references(() => emailIntakeQueue.id),
  emailBody: text("email_body").notNull(),
  subject: varchar("subject"),
  fromEmail: varchar("from_email"),
  parsedOutput: jsonb("parsed_output").notNull(),   // what the AI originally produced
  correctedOutput: jsonb("corrected_output"),        // what the analyst corrected it to
  label: varchar("label").default("positive"),       // positive | negative | correction
  useInPrompt: boolean("use_in_prompt").default(true),
  addedBy: varchar("added_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("intake_training_use_idx").on(table.useInPrompt, table.createdAt),
]);

export type EmailIntakeTrainingExample = typeof emailIntakeTrainingExamples.$inferSelect;

export const insertBrokerPortalAccountSchema = createInsertSchema(brokerPortalAccounts).omit({
  id: true, createdAt: true, lastLoginAt: true, passwordHash: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type BrokerPortalAccount = typeof brokerPortalAccounts.$inferSelect;
export type InsertBrokerPortalAccount = z.infer<typeof insertBrokerPortalAccountSchema>;

// Investment Company self-service deal import audit records.
export const developerDealImports = pgTable("developer_deal_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerProfileId: varchar("developer_profile_id").references(() => developerProfiles.id).notNull(),
  filename: varchar("filename").notNull(),
  columnMapping: jsonb("column_mapping").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  keptCount: integer("kept_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  uploadedBy: varchar("uploaded_by"),
  importedAt: timestamp("imported_at").defaultNow(),
});

export type DeveloperDealImport = typeof developerDealImports.$inferSelect;
export type InsertDeveloperDealImport = typeof developerDealImports.$inferInsert;

// ── Off-Market Sourcing (county permit/parcel data → scored owner list) ────────
// Each upload (one county's permit or parcel export) becomes one import batch.
// Rows are scored ONLY on signals actually present in the uploaded data — no
// invented tax/mortgage/lien data. Missing signal categories are surfaced in the
// UI, never assumed.
export const offMarketImports = pgTable("off_market_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  county: varchar("county").notNull(),
  filename: varchar("filename").notNull(),
  columnMapping: jsonb("column_mapping").notNull(), // { targetField: sourceHeader }
  rowCount: integer("row_count").notNull().default(0),
  keptCount: integer("kept_count").notNull().default(0),
  excludedCount: integer("excluded_count").notNull().default(0),
  flaggedCount: integer("flagged_count").notNull().default(0),
  uploadedBy: varchar("uploaded_by"),
  importedAt: timestamp("imported_at").defaultNow(),
});

export type OffMarketImport = typeof offMarketImports.$inferSelect;
export type InsertOffMarketImport = typeof offMarketImports.$inferInsert;

export const offMarketProperties = pgTable("off_market_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importId: varchar("import_id").references(() => offMarketImports.id, { onDelete: "cascade" }).notNull(),
  county: varchar("county").notNull(),

  ownerName: varchar("owner_name"),
  ownerAddress: varchar("owner_address"),
  ownerCity: varchar("owner_city"),
  ownerState: varchar("owner_state"),
  ownerZip: varchar("owner_zip"),

  propertyAddress: varchar("property_address"),
  propertyCity: varchar("property_city"),
  propertyState: varchar("property_state"),
  propertyZip: varchar("property_zip"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),

  permitType: varchar("permit_type"),
  description: text("description"),
  issueDate: varchar("issue_date"),
  completionDate: varchar("completion_date"),
  permitStatus: varchar("permit_status"),
  constructionCost: varchar("construction_cost"),

  ownerType: varchar("owner_type"), // Individual | Entity (LLC/Trust/Corp) | Government | Unknown
  isAbsentee: boolean("is_absentee").default(false), // owner mailing city differs from property city
  isOutOfState: boolean("is_out_of_state").default(false),
  signalsFired: text("signals_fired").array(),
  score: integer("score").notNull().default(0),
  band: varchar("band").notNull().default("Background"), // Priority | Watch | Background | Excluded
  excludedReason: text("excluded_reason"),
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),

  rawData: jsonb("raw_data"), // original source row, for audit/reference
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_off_market_props_import").on(table.importId),
  index("idx_off_market_props_county").on(table.county),
  index("idx_off_market_props_score").on(table.score),
  index("idx_off_market_props_band").on(table.band),
]);

export type OffMarketProperty = typeof offMarketProperties.$inferSelect;
export type InsertOffMarketProperty = typeof offMarketProperties.$inferInsert;

// ── Legacy/infrastructure tables (pre-existing in DB, modeled here to prevent db:push drift) ──

export const archiveJobs = pgTable("archive_jobs", {
  id: varchar("id").primaryKey(),
  tableName: varchar("table_name").notNull(),
  recordsProcessed: integer("records_processed").default(0),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  status: varchar("status").default("running"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  batchSize: integer("batch_size").default(1000),
  criteria: jsonb("criteria"),
}, (table) => [
  index("idx_archive_jobs_created_at").on(table.createdAt),
  index("idx_archive_jobs_table_status").on(table.tableName, table.status),
]);
export type ArchiveJob = typeof archiveJobs.$inferSelect;
export type InsertArchiveJob = typeof archiveJobs.$inferInsert;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  changedBy: text("changed_by").notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  userId: text("user_id"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: jsonb("details"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export const backupLog = pgTable("backup_log", {
  id: varchar("id").primaryKey(),
  filename: varchar("filename").notNull(),
  size: bigint("size", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
  backupType: varchar("backup_type").notNull(),
  compressed: boolean("compressed").default(false),
  checksum: varchar("checksum", { length: 64 }),
  status: varchar("status").default("completed"),
  retentionDays: integer("retention_days").default(30),
  encryptionStatus: varchar("encryption_status").default("encrypted"),
});
export type BackupLog = typeof backupLog.$inferSelect;
export type InsertBackupLog = typeof backupLog.$inferInsert;

export const hubspotSyncSettings = pgTable("hubspot_sync_settings", {
  id: serial("id").primaryKey(),
  lastSyncDate: timestamp("last_sync_date"),
  contactsSyncedToday: integer("contacts_synced_today").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  syncCountToday: integer("sync_count_today").default(0),
  lastSyncAt: timestamp("last_sync_at"),
});
export type HubspotSyncSettings = typeof hubspotSyncSettings.$inferSelect;
export type InsertHubspotSyncSettings = typeof hubspotSyncSettings.$inferInsert;

export const migrations = pgTable("migrations", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  appliedAt: timestamp("applied_at").defaultNow(),
  checksum: varchar("checksum", { length: 64 }).notNull(),
});
export type Migration = typeof migrations.$inferSelect;
export type InsertMigration = typeof migrations.$inferInsert;

export const outreachSettings = pgTable("outreach_settings", {
  id: serial("id").primaryKey(),
  dailyEnrollmentLimit: integer("daily_enrollment_limit").default(500),
  dailySyncLimit: integer("daily_sync_limit").default(100),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type OutreachSettings = typeof outreachSettings.$inferSelect;
export type InsertOutreachSettings = typeof outreachSettings.$inferInsert;

// ── YOC Calibration Data ─────────────────────────────────────────────────────
// Records the delta between auto-calculated YOC and analyst-entered manual YOC.
// Used to derive correction factors that improve future auto-YOC accuracy.
export const yocCalibrationData = pgTable("yoc_calibration_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: 'cascade' }),
  productType: varchar("product_type"),
  state: varchar("state"),
  autoYocPct: decimal("auto_yoc_pct", { precision: 6, scale: 3 }),
  manualYocPct: decimal("manual_yoc_pct", { precision: 6, scale: 3 }),
  correctionFactor: decimal("correction_factor", { precision: 8, scale: 5 }),
  askingPrice: bigint("asking_price", { mode: "number" }),
  sizeAcres: decimal("size_acres", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
});
export type YocCalibrationData = typeof yocCalibrationData.$inferSelect;

// ─── Market Intelligence Hub ─────────────────────────────────────────────────

export const zoningAgendaItems = pgTable("zoning_agenda_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  market: varchar("market").notNull(), // 'wilmington' | 'raleigh_durham' | 'charlotte' | 'asheville'
  meetingDate: date("meeting_date"),
  caseNumber: varchar("case_number"),
  applicantName: varchar("applicant_name"),
  developerName: varchar("developer_name"),
  propertyAddress: varchar("property_address"),
  requestType: varchar("request_type"), // 'rezoning' | 'site_plan' | 'variance' | 'conditional_use' | 'annexation'
  currentZoning: varchar("current_zoning"),
  proposedZoning: varchar("proposed_zoning"),
  acreage: decimal("acreage", { precision: 10, scale: 2 }),
  projectDescription: text("project_description"),
  staffRecommendation: varchar("staff_recommendation"),
  status: varchar("status").default("pending"),
  sourceUrl: text("source_url"),
  aiSummary: text("ai_summary"),
  alertLevel: varchar("alert_level").default("medium"), // 'high' | 'medium' | 'low'
  rawText: text("raw_text"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type ZoningAgendaItem = typeof zoningAgendaItems.$inferSelect;

export const marketListings = pgTable("market_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  market: varchar("market").notNull(),
  source: varchar("source").default("loopnet"),
  externalId: varchar("external_id"),
  address: varchar("address"),
  city: varchar("city"),
  state: varchar("state").default("NC"),
  zipCode: varchar("zip_code"),
  askingPrice: bigint("asking_price", { mode: "number" }),
  acreage: decimal("acreage", { precision: 10, scale: 2 }),
  pricePerAcre: bigint("price_per_acre", { mode: "number" }),
  propertyType: varchar("property_type"),
  zoning: varchar("zoning"),
  daysOnMarket: integer("days_on_market"),
  listingDate: date("listing_date"),
  isExpired: boolean("is_expired").default(false),
  description: text("description"),
  brokerName: varchar("broker_name"),
  brokerPhone: varchar("broker_phone"),
  sourceUrl: text("source_url"),
  aiSignal: text("ai_signal"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});
export type MarketListing = typeof marketListings.$inferSelect;

export const permitSignals = pgTable("permit_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  market: varchar("market").notNull(),
  permitNumber: varchar("permit_number"),
  propertyAddress: varchar("property_address"),
  ownerName: varchar("owner_name"),
  applicantName: varchar("applicant_name"),
  permitType: varchar("permit_type"),
  description: text("description"),
  issueDate: date("issue_date"),
  lastActivityDate: date("last_activity_date"),
  expirationDate: date("expiration_date"),
  daysInactive: integer("days_inactive"),
  estimatedCost: bigint("estimated_cost", { mode: "number" }),
  signalType: varchar("signal_type"), // 'stalled_90d' | 'stalled_180d' | 'new_issued' | 'expired_no_completion'
  county: varchar("county"),
  aiSummary: text("ai_summary"),
  sourceUrl: text("source_url"),
  flaggedAt: timestamp("flagged_at").defaultNow(),
});
export type PermitSignal = typeof permitSignals.$inferSelect;

export const marketNewsItems = pgTable("market_news_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  market: varchar("market"),
  headline: varchar("headline").notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url"),
  sourceName: varchar("source_name"),
  publishedAt: timestamp("published_at"),
  relevanceScore: integer("relevance_score"),
  signalType: varchar("signal_type"), // 'rezoning' | 'development_activity' | 'distress' | 'market_shift' | 'general'
  aiAnalysis: text("ai_analysis"),
  isRead: boolean("is_read").default(false),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});
export type MarketNewsItem = typeof marketNewsItems.$inferSelect;

export const marketOpportunities = pgTable("market_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  market: varchar("market").notNull(),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state").default("NC"),
  zipCode: varchar("zip_code"),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  parcelId: varchar("parcel_id"),
  ownerName: varchar("owner_name"),
  ownerType: varchar("owner_type"),
  lastSaleDate: varchar("last_sale_date"),
  lastSalePrice: bigint("last_sale_price", { mode: "number" }),
  yearsHeld: decimal("years_held", { precision: 5, scale: 1 }),
  acreage: decimal("acreage", { precision: 10, scale: 2 }),
  landUse: varchar("land_use"),
  currentZoning: varchar("current_zoning"),
  assessedValue: bigint("assessed_value", { mode: "number" }),
  signalFlags: text("signal_flags").array(),
  aiSummary: text("ai_summary"),
  source: varchar("source").default("county_gis"),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false),
  addedAt: timestamp("added_at").defaultNow(),
});
export type MarketOpportunity = typeof marketOpportunities.$inferSelect;

// ─── End Market Intelligence Hub ─────────────────────────────────────────────

// ─── External API ─────────────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  keyHash: varchar("key_hash").notNull().unique(),
  keyPrefix: varchar("key_prefix").notNull(),
  keyPlaintext: text("key_plaintext"),
  environment: varchar("environment").notNull().default("live"), // "live" | "test"
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"),
  lastUsedAt: timestamp("last_used_at"),
  totalCalls: integer("total_calls").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  notes: text("notes"),
});
export type ApiKey = typeof apiKeys.$inferSelect;

export const leadAttachments = pgTable("lead_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  filename: varchar("filename").notNull(),
  mimeType: varchar("mime_type"),
  sizeBytes: integer("size_bytes"),
  storageUrl: text("storage_url"),
  storageKey: text("storage_key"),
  source: varchar("source").default("api"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});
export type LeadAttachment = typeof leadAttachments.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────

export const notificationTemplates = pgTable("notification_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(),
  templateContent: text("template_content").notNull(),
  subject: varchar("subject"),
  variables: jsonb("variables"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  category: varchar("category").default("general"),
  priority: varchar("priority").default("normal"),
  autoSend: boolean("auto_send").default(false),
});
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

