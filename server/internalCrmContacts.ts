import { and, eq, type SQL, sql } from "drizzle-orm";
import { acquisitionMarkets } from "@shared/schema";
import { db } from "./db";

export interface InternalCrmContactQuery {
  page: number;
  limit: number;
  search: string;
  tag: string;
  tagFilters: string[];
  sourceTagFilter: string;
  crmStateFilter: string;
  stateFilter: string;
  msaFilter: string;
  countyFilter: string;
  market: string;
  smsFilter: string;
  assignedToFilter: string;
  brokerageFilter: string;
  multiCampaignTagFilter: boolean;
  contactCategoryFilter: string;
  includeFilterOptions: boolean;
  filterOptionsOnly: boolean;
}

function textArray(values: string[]) {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}

function andSql(conditions: SQL[]) {
  return conditions.length ? sql`(${sql.join(conditions, sql` AND `)})` : sql`TRUE`;
}

function parseJson(value: unknown): any {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const allContactsCte = sql`all_contacts AS (
  SELECT
    id, first_name, last_name, email, phone, brokerage, markets_covered,
    sms_opt_in, is_active, assigned_to, crm_tags, source_tags, crm_notes,
    last_contacted_at, state_region, owner_developer_profile_id, user_id,
    created_at, contact_sector, contact_county, contact_specialty,
    contact_category
  FROM brokers
)`;

async function getFilterOptions() {
  const result = await db.execute(sql`
    WITH ${allContactsCte}
    SELECT
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', company_name, 'people', people) ORDER BY company_name)
        FROM (
          SELECT MIN(BTRIM(brokerage)) AS company_name, COUNT(*)::int AS people
          FROM all_contacts
          WHERE NULLIF(BTRIM(brokerage), '') IS NOT NULL
          GROUP BY LOWER(BTRIM(brokerage))
        ) AS companies
      ), '[]'::jsonb) AS companies,
      COALESCE((
        SELECT jsonb_agg(tag ORDER BY tag)
        FROM (
          SELECT DISTINCT tag
          FROM all_contacts AS contact
          CROSS JOIN LATERAL unnest(COALESCE(contact.crm_tags, ARRAY[]::text[])) AS tags(tag)
          WHERE BTRIM(tag) <> ''
        ) AS tag_values
      ), '[]'::jsonb) AS tags,
      COALESCE((
        SELECT jsonb_agg(source_tag ORDER BY source_tag)
        FROM (
          SELECT DISTINCT source_tag
          FROM all_contacts AS contact
          CROSS JOIN LATERAL unnest(COALESCE(contact.source_tags, ARRAY[]::text[])) AS source_tags(source_tag)
          WHERE BTRIM(source_tag) <> ''
        ) AS source_tag_values
      ), '[]'::jsonb) AS "sourceTags",
      COALESCE((
        SELECT jsonb_agg(state ORDER BY state)
        FROM (
          SELECT DISTINCT BTRIM(state_region) AS state
          FROM all_contacts
          WHERE NULLIF(BTRIM(state_region), '') IS NOT NULL
        ) AS state_values
      ), '[]'::jsonb) AS states,
      COALESCE((
        SELECT jsonb_agg(assigned_to ORDER BY assigned_to)
        FROM (
          SELECT DISTINCT BTRIM(assigned_to) AS assigned_to
          FROM all_contacts
          WHERE NULLIF(BTRIM(assigned_to), '') IS NOT NULL
        ) AS assignees
      ), '[]'::jsonb) AS "assignedTo"
  `);
  const row = (result as any).rows?.[0] || {};
  return {
    companies: parseJson(row.companies) || [],
    tags: parseJson(row.tags) || [],
    sourceTags: parseJson(row.sourceTags) || [],
    states: parseJson(row.states) || [],
    assignedTo: parseJson(row.assignedTo) || [],
  };
}

export async function getInternalCrmContacts(query: InternalCrmContactQuery) {
  const filters: SQL[] = [];
  const search = query.search.trim();
  if (search) {
    const pattern = `%${search}%`;
    filters.push(sql`(
      (COALESCE(f.first_name, '') || ' ' || COALESCE(f.last_name, '')) ILIKE ${pattern}
      OR COALESCE(f.email, '') ILIKE ${pattern}
      OR COALESCE(f.phone, '') ILIKE ${pattern}
      OR COALESCE(f.brokerage, '') ILIKE ${pattern}
      OR COALESCE(f.assigned_to, '') ILIKE ${pattern}
      OR COALESCE(f.state_region, '') ILIKE ${pattern}
    )`);
  }
  if (query.tag) filters.push(sql`f.crm_tags @> ${textArray([query.tag])}`);
  if (query.tagFilters.length) filters.push(sql`f.crm_tags && ${textArray(query.tagFilters)}`);
  if (query.sourceTagFilter) {
    filters.push(sql`f.source_tags @> ${textArray([query.sourceTagFilter])}`);
  }
  if (query.crmStateFilter) {
    filters.push(sql`LOWER(BTRIM(COALESCE(f.state_region, ''))) = ${query.crmStateFilter}`);
  }
  if (query.market) filters.push(sql`COALESCE(f.markets_covered, '') ILIKE ${`%${query.market}%`}`);
  if (query.contactCategoryFilter) {
    filters.push(sql`LOWER(BTRIM(COALESCE(f.contact_category, ''))) = ${query.contactCategoryFilter.toLowerCase()}`);
  }

  const geoFiltersActive = Boolean(query.stateFilter || query.msaFilter || query.countyFilter);
  let geoRows: Array<{ county: string | null; msa: string | null }> = [];
  if (geoFiltersActive) {
    const conditions: SQL[] = [];
    if (query.stateFilter) conditions.push(eq(acquisitionMarkets.state, query.stateFilter));
    if (query.msaFilter) conditions.push(eq(acquisitionMarkets.msaName, query.msaFilter));
    if (query.countyFilter) conditions.push(eq(acquisitionMarkets.county, query.countyFilter));
    geoRows = await db.select({
      county: acquisitionMarkets.county,
      msa: acquisitionMarkets.msaName,
    }).from(acquisitionMarkets).where(and(...conditions));
  }

  if (query.stateFilter && !query.msaFilter && !query.countyFilter) {
    filters.push(sql`(
      EXISTS (
        SELECT 1
        FROM unnest(string_to_array(COALESCE(f.state_region, ''), ',')) AS state_values(state_value)
        WHERE UPPER(BTRIM(state_value)) = ${query.stateFilter}
      )
      OR EXISTS (
        SELECT 1 FROM deals AS state_deals
        WHERE state_deals.broker_id = f.id AND state_deals.state = ${query.stateFilter}
      )
    )`);
  } else if (geoFiltersActive && geoRows.length > 0) {
    const geoNames = Array.from(new Set(
      geoRows.flatMap((row) => [row.county, row.msa])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ));
    const dealConditions: SQL[] = [sql`geo_deals.broker_id = f.id`];
    if (query.stateFilter) dealConditions.push(sql`geo_deals.state = ${query.stateFilter}`);
    if (query.countyFilter) dealConditions.push(sql`LOWER(COALESCE(geo_deals.county, '')) = LOWER(${query.countyFilter})`);
    if (query.msaFilter) dealConditions.push(sql`geo_deals.msa_name = ${query.msaFilter}`);
    filters.push(sql`(
      COALESCE(f.markets_covered, '') ILIKE ANY(${textArray(geoNames.map((name) => `%${name}%`))})
      OR EXISTS (SELECT 1 FROM deals AS geo_deals WHERE ${andSql(dealConditions)})
    )`);
  }

  if (query.smsFilter === "opted_in") filters.push(sql`COALESCE(f.sms_opt_in, false) = true`);
  if (query.smsFilter === "opted_out") filters.push(sql`COALESCE(f.sms_opt_in, false) = false`);
  if (query.assignedToFilter) {
    filters.push(sql`LOWER(COALESCE(f.assigned_to, '')) = LOWER(${query.assignedToFilter})`);
  }
  if (query.brokerageFilter) {
    filters.push(sql`LOWER(COALESCE(f.brokerage, '')) = LOWER(${query.brokerageFilter})`);
  }
  if (query.multiCampaignTagFilter) {
    const outreachTagResult = await db.execute(sql`
      SELECT hubspot_trigger_tag
      FROM outreach_campaign_templates
      WHERE is_active = true AND hubspot_trigger_tag IS NOT NULL
    `);
    const outreachTags = Array.from(new Set<string>(
      ((outreachTagResult as any).rows || [])
        .map((row: any): string => String(row.hubspot_trigger_tag || "").trim())
        .filter((tag: string) => tag.length > 0),
    ));
    if (outreachTags.length === 0) {
      filters.push(sql`FALSE`);
    } else {
      filters.push(sql`(
        SELECT COUNT(*)
        FROM unnest(COALESCE(f.crm_tags, ARRAY[]::text[])) AS applied_tags(applied_tag)
        WHERE applied_tag = ANY(${textArray(outreachTags)})
      ) > 1`);
    }
  }

  const filteredContactsCte = sql`filtered_contacts AS (
    SELECT f.* FROM all_contacts AS f WHERE ${andSql(filters)}
  )`;
  const filterOptions = query.includeFilterOptions || query.filterOptionsOnly
    ? await getFilterOptions()
    : { companies: [], tags: [], sourceTags: [], states: [], assignedTo: [] };

  if (query.filterOptionsOnly) {
    return {
      contacts: [],
      filterOptions,
      pagination: { page: 1, limit: query.limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    };
  }

  const offset = (query.page - 1) * query.limit;
  const countResult = await db.execute(sql`
    WITH ${allContactsCte}, ${filteredContactsCte}
    SELECT COUNT(*)::int AS total FROM filtered_contacts
  `);
  const total = Number((countResult as any).rows?.[0]?.total || 0);

  const pageResult = await db.execute(sql`
    WITH ${allContactsCte}, ${filteredContactsCte},
    page_contacts AS (
      SELECT f.*
      FROM filtered_contacts AS f
      ORDER BY f.created_at DESC NULLS LAST, f.id DESC
      LIMIT ${query.limit} OFFSET ${offset}
    )
    SELECT
      page.*,
      COALESCE((
        SELECT COUNT(*)::int
        FROM deals AS contact_deals
        WHERE contact_deals.broker_id = page.id
      ), 0) AS deal_count,
      CASE
        WHEN NULLIF(BTRIM(page.brokerage), '') IS NULL THEN 0
        ELSE COALESCE((
          SELECT COUNT(*)::int
          FROM brokers AS company_members
          WHERE LOWER(BTRIM(company_members.brokerage)) = LOWER(BTRIM(page.brokerage))
        ), 0)
      END AS company_member_count
    FROM page_contacts AS page
    ORDER BY page.created_at DESC NULLS LAST, page.id DESC
  `);
  const contacts = ((pageResult as any).rows || []).map((row: any) => ({
    id: String(row.id || ""),
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    email: row.email || null,
    phone: row.phone || null,
    brokerage: row.brokerage || null,
    marketsCovered: row.markets_covered || null,
    smsOptIn: row.sms_opt_in ?? false,
    isActive: row.is_active ?? false,
    assignedTo: row.assigned_to || null,
    crmTags: row.crm_tags || [],
    sourceTags: row.source_tags || [],
    crmNotes: row.crm_notes || null,
    lastContactedAt: row.last_contacted_at || null,
    stateRegion: row.state_region || null,
    ownerDeveloperProfileId: row.owner_developer_profile_id || null,
    userId: row.user_id || null,
    createdAt: row.created_at || null,
    contactSector: row.contact_sector || null,
    contactCounty: row.contact_county || null,
    contactSpecialty: row.contact_specialty || null,
    contactCategory: row.contact_category || null,
    dealCount: Number(row.deal_count || 0),
    companyMemberCount: Number(row.company_member_count || 0),
  }));

  return {
    contacts,
    filterOptions,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: offset + query.limit < total,
      hasPrevPage: query.page > 1,
    },
  };
}