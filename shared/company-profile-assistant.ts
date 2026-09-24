import { z } from "zod";

const optionalNonnegativeNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().finite().min(0).nullable()).optional();

const stateCriteriaOverrideSchema = z.object({
  minAcres: optionalNonnegativeNumber,
  maxAcres: optionalNonnegativeNumber,
  minRentPsf: optionalNonnegativeNumber,
  minRentPerUnit: optionalNonnegativeNumber,
}).strip();

const assistantProductTypeSchema = z.object({
  name: z.string().trim().max(100).optional(),
  minAcres: optionalNonnegativeNumber,
  maxAcres: optionalNonnegativeNumber,
  minRentPsf: optionalNonnegativeNumber,
  minRentPerUnit: optionalNonnegativeNumber,
  stateOverrides: z.record(stateCriteriaOverrideSchema).optional(),
  isActive: z.boolean().optional(),
}).strip();

export const investmentCompanyAssistantDraftSchema = z.object({
  companyName: z.string().trim().max(200).nullable().optional(),
  slug: z.string().trim().max(100).nullable().optional(),
  profileType: z.enum(["real_estate", "general_sales"]).optional(),
  assetClass: z.enum(["multifamily", "industrial"]).optional(),
  rentMetric: z.enum(["psf", "per_unit"]).optional(),
  targetStates: z.array(z.string().trim().max(100)).max(60).optional(),
  targetCounties: z.array(z.string().trim().max(150)).max(500).optional(),
  knownEmailDomains: z.array(z.string().trim().max(255)).max(200).optional(),
  productTypes: z.array(assistantProductTypeSchema).max(100).optional(),
  industrialCriteria: z.record(z.unknown()).optional(),
  warnings: z.array(z.string().trim().max(300)).max(30).optional(),
}).strip();

export type InvestmentCompanyAssistantDraft = z.infer<typeof investmentCompanyAssistantDraftSchema>;