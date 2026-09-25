import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { acquisitionMarkets, brokers, deals, developerBrokerCrm } from "@shared/schema";
import { getOutOfStateCodeFromCounty } from "@shared/broker-location";
import { db } from "./db";

type ContactVisibility = {
  sectors: string[];
  states: string[];
  counties: string[];
  sourceTags: string[];
  allowSharedDirectory?: boolean;
};

type DeveloperCrmContactQuery = {
  developerProfileId: string;
  visibility: ContactVisibility;
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
  contactCategoryFilter?: string;
  includeFilterOptions?: boolean;
  filterOptionsOnly?: boolean;
  includeContactEnrichment?: boolean;
};

const DEMO_USER_ID = "20974d7b-e103-4fc7-b42f-7a13d41041fb";

function textArray(values: string[]): SQL {
  return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}

function andSql(parts: SQL[]): SQL {
  return parts.length ? sql.join(parts, sql` AND `) : sql`TRUE`;
}

const EMPTY_FILTER_OPTIONS = {
  companies: [],
  tags: [],
  sourceTags: [],
  states: [],
  assignedTo: [],
  categories: [],
};

function parseFilterOptions(options: Record<string, unknown>) {
  const jsonArray = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  return {
    companies: jsonArray(options.companies),
    tags: jsonArray(options.tags),
    sourceTags: jsonArray(options.source_tags),
    states: jsonArray(options.states).map((value) => String(value).trim()).filter(Boolean),
    assignedTo: jsonArray(options.assigned_to).map((value) => String(value).trim()).filter(Boolean),
    categories: jsonArray(options.categories).map((value) => String(value).trim()).filter(Boolean),
  };
}

function stateMatch(alias: string, state: string): SQL {
  const stateValue = state.toUpperCase();
  return sql`(
    EXISTS (
      SELECT 1
      FROM unnest(string_to_array(COALESCE(${sql.raw(`${alias}.state_region`)}, ''), ',')) AS state_value
      WHERE UPPER(BTRIM(state_value)) = ${stateValue}
    )
    OR (
      LOWER(BTRIM(COALESCE(${sql.raw(`${alias}.contact_county`)}, ''))) LIKE 'out of state (%'
      AND UPPER(BTRIM(SPLIT_PART(SPLIT_PART(${sql.raw(`${alias}.contact_county`)}, '(', 2), ')', 1))) = ${stateValue}
    )
  )`;
}

function makeAccessibleCte(developerProfileId: string, visibility: ContactVisibility): SQL {
  const stateCodes = Array.from(new Set([
    ...visibility.states.map((value) => value.trim().toUpperCase()).filter(Boolean),
    ...visibility.counties.map(getOutOfStateCodeFromCounty).filter((value): value is string => Boolean(value)),
  ]));
  const counties = visibility.counties
    .filter((value) => !getOutOfStateCodeFromCounty(value))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const sharedVisibility: SQL[] = [];
  if (visibility.sectors.length) {
    sharedVisibility.push(sql`LOWER(BTRIM(COALESCE(brokers.contact_sector, ''))) = ANY(${textArray(visibility.sectors.map((value) => value.toLowerCase()))})`);
  }
  if (stateCodes.length) {
    sharedVisibility.push(sql`(
      EXISTS (
        SELECT 1
        FROM unnest(string_to_array(COALESCE(brokers.state_region, ''), ',')) AS state_value
        WHERE UPPER(BTRIM(state_value)) = ANY(${textArray(stateCodes)})
      )
      OR (
        LOWER(BTRIM(COALESCE(brokers.contact_county, ''))) LIKE 'out of state (%'
        AND UPPER(BTRIM(SPLIT_PART(SPLIT_PART(brokers.contact_county, '(', 2), ')', 1))) = ANY(${textArray(stateCodes)})
      )
    )`);
  }
  if (counties.length) {
    sharedVisibility.push(sql`LOWER(BTRIM(COALESCE(brokers.contact_county, ''))) = ANY(${textArray(counties)})`);
  }
  if (visibility.sourceTags.length) {
    sharedVisibility.push(sql`COALESCE(brokers.source_tags, ARRAY[]::text[]) && ${textArray(visibility.sourceTags.map((value) => value.toLowerCase()))}`);
  }

  const sharedContactConditions = visibility.allowSharedDirectory === false
    ? [sql`FALSE`]
    : [
        sql`brokers.owner_developer_profile_id IS NULL`,
        sql`brokers.user_id IS DISTINCT FROM ${DEMO_USER_ID}`,
        ...sharedVisibility,
      ];

  return sql`accessible_brokers AS (
    SELECT
      brokers.id,
      brokers.first_name,
      brokers.last_name,
      brokers.email,
      brokers.phone,
      brokers.brokerage,
      brokers.markets_covered,
      brokers.sms_opt_in,
      brokers.is_active,
      CASE
        WHEN developer_broker_crm.id IS NOT NULL THEN developer_broker_crm.assigned_to
        WHEN brokers.owner_developer_profile_id IS NULL THEN NULL
        ELSE brokers.assigned_to
      END AS assigned_to,
      CASE
        WHEN developer_broker_crm.id IS NOT NULL THEN COALESCE(developer_broker_crm.crm_tags, ARRAY[]::text[])
        WHEN brokers.owner_developer_profile_id IS NULL THEN ARRAY[]::text[]
        ELSE COALESCE(brokers.crm_tags, ARRAY[]::text[])
      END AS crm_tags,
      COALESCE(brokers.source_tags, ARRAY[]::text[]) AS source_tags,
      CASE
        WHEN developer_broker_crm.id IS NOT NULL THEN developer_broker_crm.crm_notes
        WHEN brokers.owner_developer_profile_id IS NULL THEN NULL
        ELSE brokers.crm_notes
      END AS crm_notes,
      CASE
        WHEN developer_broker_crm.id IS NOT NULL THEN developer_broker_crm.last_contacted_at
        WHEN brokers.owner_developer_profile_id IS NULL THEN NULL
        ELSE brokers.last_contacted_at
      END AS last_contacted_at,
      brokers.state_region,
      COALESCE(
        brokers.contact_category,
        CASE WHEN brokers.owner_developer_profile_id IS NULL THEN 'broker' ELSE 'other' END
      ) AS contact_category,
      brokers.mailing_address,
      brokers.city,
      brokers.postal_code,
      brokers.owner_developer_profile_id,
      brokers.contact_sector,
      brokers.contact_county,
      brokers.contact_specialty,
      brokers.user_id,
      brokers.created_at
    FROM brokers
    LEFT JOIN developer_broker_crm
      ON developer_broker_crm.broker_id = brokers.id
      AND developer_broker_crm.developer_profile_id = ${developerProfileId}
    WHERE NOT EXISTS (
      SELECT 1
      FROM users AS demo_owner
      WHERE demo_owner.id = brokers.user_id
        AND LOWER(demo_owner.email) = 'demo@catalystcp.com'
    )
      AND (
        brokers.owner_developer_profile_id = ${developerProfileId}
        OR (${andSql(sharedContactConditions)})
      )
      AND (developer_broker_crm.id IS NULL OR developer_broker_crm.is_removed = false)
  )`;
}

export async function getDeveloperCrmContacts(query: DeveloperCrmContactQuery) {
  const accessibleCte = makeAccessibleCte(query.developerProfileId, query.visibility);
  const filters: SQL[] = [];

  if (query.search) {
    filters.push(sql`(
      (COALESCE(f.first_name, '') || ' ' || COALESCE(f.last_name, '')) ILIKE '%' || ${query.search} || '%'
      OR COALESCE(f.email, '') ILIKE '%' || ${query.search} || '%'
      OR COALESCE(f.phone, '') ILIKE '%' || ${query.search} || '%'
      OR COALESCE(f.brokerage, '') ILIKE '%' || ${query.search} || '%'
      OR COALESCE(f.assigned_to, '') ILIKE '%' || ${query.search} || '%'
      OR COALESCE(f.state_region, '') ILIKE '%' || ${query.search} || '%'
    )`);
  }
  if (query.tag) {
    filters.push(sql`COALESCE(f.crm_tags, ARRAY[]::text[]) @> ${textArray([query.tag])}`);
  }
  if (query.tagFilters.length) {
    filters.push(sql`COALESCE(f.crm_tags, ARRAY[]::text[]) && ${textArray(query.tagFilters)}`);
  }
  if (query.sourceTagFilter) {
    filters.push(sql`COALESCE(f.source_tags, ARRAY[]::text[]) @> ${textArray([query.sourceTagFilter])}`);
  }
  if (query.crmStateFilter) {
    filters.push(stateMatch("f", query.crmStateFilter));
  }
  if (query.market) {
    filters.push(sql`CAST(f.markets_covered AS text) ILIKE '%' || ${query.market} || '%'`);
  }
  if (query.smsFilter === "opted_in") {
    filters.push(sql`f.sms_opt_in = true`);
  } else if (query.smsFilter === "opted_out") {
    filters.push(sql`COALESCE(f.sms_opt_in, false) = false`);
  }
  if (query.assignedToFilter) {
    filters.push(sql`LOWER(COALESCE(f.assigned_to, '')) = LOWER(${query.assignedToFilter})`);
  }
  if (query.brokerageFilter) {
    filters.push(sql`LOWER(COALESCE(f.brokerage, '')) = LOWER(${query.brokerageFilter})`);
  }
  if (query.contactCategoryFilter) {
    filters.push(sql`LOWER(BTRIM(COALESCE(f.contact_category, 'other'))) = LOWER(BTRIM(${query.contactCategoryFilter}))`);
  }

  let geoNames: string[] = [];
  if (query.stateFilter || query.msaFilter || query.countyFilter) {
    const geoConditions: SQL[] = [];
    if (query.stateFilter) geoConditions.push(eq(acquisitionMarkets.state, query.stateFilter));
    if (query.msaFilter) geoConditions.push(eq(acquisitionMarkets.msaName, query.msaFilter));
    if (query.countyFilter) geoConditions.push(eq(acquisitionMarkets.county, query.countyFilter));
    const geoRows = await db.select({
      county: acquisitionMarkets.county,
      msa: acquisitionMarkets.msaName,
    }).from(acquisitionMarkets).where(and(...geoConditions));
    geoNames = Array.from(new Set(geoRows.flatMap((row) => [row.county, row.msa]).filter(Boolean)));
  }

  if (query.stateFilter && !query.msaFilter && !query.countyFilter) {
    filters.push(sql`(
      ${stateMatch("f", query.stateFilter)}
      OR EXISTS (
        SELECT 1 FROM deals AS state_deal
        WHERE state_deal.broker_id = f.id
          AND state_deal.state = ${query.stateFilter}
      )
    )`);
  } else if (geoNames.length) {
    const patterns = textArray(geoNames.map((value) => `%${value}%`));
    const dealConditions: SQL[] = [sql`geo_deal.broker_id = f.id`];
    if (query.stateFilter) dealConditions.push(eq(deals.state, query.stateFilter));
    if (query.countyFilter) dealConditions.push(sql`LOWER(geo_deal.county) = LOWER(${query.countyFilter})`);
    if (query.msaFilter) dealConditions.push(eq(deals.msaName, query.msaFilter));
    filters.push(sql`(
      CAST(f.markets_covered AS text) ILIKE ANY(${patterns})
      OR EXISTS (
        SELECT 1 FROM deals AS geo_deal
        WHERE ${andSql(dealConditions)}
      )
    )`);
  }

  if (query.multiCampaignTagFilter) {
    const activeTagResult = await db.execute(sql`
      SELECT hubspot_trigger_tag
      FROM outreach_campaign_templates
      WHERE is_active = true AND hubspot_trigger_tag IS NOT NULL
    `);
    const activeTags = Array.from(new Set(
      (activeTagResult.rows as Array<{ hubspot_trigger_tag: unknown }>)
        .map((row) => String(row.hubspot_trigger_tag || ""))
        .filter(Boolean),
    ));
    if (!activeTags.length) {
      filters.push(sql`false`);
    } else {
      filters.push(sql`(
        SELECT COUNT(*)
        FROM unnest(COALESCE(f.crm_tags, ARRAY[]::text[])) AS applied_tag
        WHERE applied_tag = ANY(${textArray(activeTags)})
      ) > 1`);
    }
  }

  const filteredCte = sql`filtered_brokers AS (
    SELECT f.* FROM accessible_brokers AS f WHERE ${andSql(filters)}
  )`;
  const includeContactEnrichment = query.includeContactEnrichment !== false;
  const pageEnrichmentProjection = includeContactEnrichment
    ? sql`, COALESCE(company_counts.people, 0)::int AS company_member_count,
        COALESCE(deal_counts.deal_count, 0)::int AS deal_count`
    : sql``;
  const pageEnrichmentJoins = includeContactEnrichment
    ? sql`
      LEFT JOIN (
        SELECT LOWER(BTRIM(brokerage)) AS brokerage_key, COUNT(*)::int AS people
        FROM accessible_brokers
        WHERE brokerage IS NOT NULL AND BTRIM(brokerage) <> ''
        GROUP BY LOWER(BTRIM(brokerage))
      ) AS company_counts
        ON company_counts.brokerage_key = LOWER(BTRIM(f.brokerage))
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS deal_count
        FROM deals
        WHERE deals.broker_id = f.id
      ) AS deal_counts ON TRUE
    `
    : sql``;
  const [countResult, pageResult, optionsResult] = await Promise.all([
    query.filterOptionsOnly
      ? Promise.resolve({ rows: [{ total: 0 }] })
      : db.execute(sql`
      WITH ${accessibleCte}, ${filteredCte}
      SELECT COUNT(*)::int AS total FROM filtered_brokers
    `),
    query.filterOptionsOnly
      ? Promise.resolve({ rows: [] as any[] })
      : db.execute(sql`
      WITH ${accessibleCte}, ${filteredCte}
      SELECT f.*${pageEnrichmentProjection}
      FROM filtered_brokers AS f
      ${pageEnrichmentJoins}
      ORDER BY f.created_at DESC NULLS LAST, f.id DESC
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
    `),
    query.includeFilterOptions === false && !query.filterOptionsOnly
      ? Promise.resolve({ rows: [] as any[] })
      : db.execute(sql`
      WITH ${accessibleCte},
      state_values AS (
        SELECT UPPER(BTRIM(state_value)) AS state
        FROM accessible_brokers
        CROSS JOIN LATERAL unnest(string_to_array(COALESCE(state_region, ''), ',')) AS state_value
        WHERE BTRIM(state_value) <> ''
        UNION
        SELECT UPPER(BTRIM(SPLIT_PART(SPLIT_PART(contact_county, '(', 2), ')', 1))) AS state
        FROM accessible_brokers
        WHERE LOWER(BTRIM(COALESCE(contact_county, ''))) LIKE 'out of state (%'
          AND BTRIM(SPLIT_PART(SPLIT_PART(contact_county, '(', 2), ')', 1)) ~ '^[A-Za-z]{2}$'
      )
      SELECT
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('name', name, 'people', people) ORDER BY name)
          FROM (
            SELECT MIN(BTRIM(brokerage)) AS name, COUNT(*)::int AS people
            FROM accessible_brokers
            WHERE brokerage IS NOT NULL AND BTRIM(brokerage) <> ''
            GROUP BY LOWER(BTRIM(brokerage))
          ) AS company_options
        ), '[]'::jsonb) AS companies,
        COALESCE((
          SELECT jsonb_agg(tag ORDER BY tag) FROM (
            SELECT DISTINCT tag
            FROM accessible_brokers
            CROSS JOIN LATERAL unnest(COALESCE(crm_tags, ARRAY[]::text[])) AS tag
            WHERE BTRIM(tag) <> ''
          ) AS tag_options
        ), '[]'::jsonb) AS tags,
        COALESCE((
          SELECT jsonb_agg(tag ORDER BY tag) FROM (
            SELECT DISTINCT tag
            FROM accessible_brokers
            CROSS JOIN LATERAL unnest(COALESCE(source_tags, ARRAY[]::text[])) AS tag
            WHERE BTRIM(tag) <> ''
          ) AS source_tag_options
        ), '[]'::jsonb) AS source_tags,
        COALESCE((SELECT jsonb_agg(state ORDER BY state) FROM (SELECT DISTINCT state FROM state_values WHERE state <> '') AS states), '[]'::jsonb) AS states,
        COALESCE((
          SELECT jsonb_agg(assigned_to ORDER BY assigned_to)
          FROM (
            SELECT DISTINCT BTRIM(assigned_to) AS assigned_to
            FROM accessible_brokers
            WHERE assigned_to IS NOT NULL AND BTRIM(assigned_to) <> ''
          ) AS assigned_options
        ), '[]'::jsonb) AS assigned_to,
        COALESCE((
          SELECT jsonb_agg(category ORDER BY category)
          FROM (
            SELECT DISTINCT contact_category AS category
            FROM accessible_brokers
            WHERE BTRIM(COALESCE(contact_category, '')) <> ''
          ) AS category_options
        ), '[]'::jsonb) AS categories
    `),
  ]);

  const total = Number((countResult.rows[0] as any)?.total || 0);
  const pageRows = pageResult.rows as Array<Record<string, any>>;
  const contacts = pageRows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    brokerage: row.brokerage,
    contactCategory: row.contact_category || "other",
    mailingAddress: row.mailing_address,
    city: row.city,
    postalCode: row.postal_code,
    marketsCovered: row.markets_covered,
    smsOptIn: row.sms_opt_in,
    isActive: row.is_active,
    assignedTo: row.assigned_to,
    crmTags: row.crm_tags || [],
    sourceTags: row.source_tags || [],
    crmNotes: row.crm_notes,
    lastContactedAt: row.last_contacted_at,
    stateRegion: row.state_region,
    ownerDeveloperProfileId: row.owner_developer_profile_id,
    contactSector: row.contact_sector,
    contactCounty: row.contact_county,
    contactSpecialty: row.contact_specialty,
    userId: row.user_id,
    createdAt: row.created_at,
    dealCount: Number(row.deal_count || 0),
    companyMemberCount: Number(row.company_member_count || 0),
  }));

  const filterOptions = query.includeFilterOptions === false && !query.filterOptionsOnly
    ? EMPTY_FILTER_OPTIONS
    : parseFilterOptions((optionsResult.rows[0] || {}) as Record<string, unknown>);

  return {
    contacts,
    filterOptions,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page * query.limit < total,
      hasPrevPage: query.page > 1,
    },
  };
}