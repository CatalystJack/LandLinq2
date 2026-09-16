import { db } from "./db";
import { sql } from "drizzle-orm";
import { haversineMiles } from "./automatedDealEmailPipeline";

export type MyDealFilters = {
  status?: string;
  search?: string;
  state?: string;
  limit?: number;
};

export type NearbyDealFilters = {
  dealId?: string;
  search?: string;
  radiusMiles?: number;
};

export type MyCampaign = {
  id: string;
  name: string;
  status: string;
  triggerTag: string | null;
  steps: Array<{
    stepNumber: number;
    dayNumber: number;
    subject: string;
    content: string;
  }>;
};

function normalizeStatus(status: unknown): string | null {
  const value = String(status || "").trim().toLowerCase();
  return value || null;
}

export async function getMyDeals(developerProfileId: string, filters: MyDealFilters = {}) {
  const status = normalizeStatus(filters.status);
  const search = String(filters.search || "").trim();
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const result = await db.execute(sql`
    WITH visible_deals AS (
      SELECT DISTINCT ON (d.id)
        d.id,
        d.address,
        d.city,
        d.state,
        d.status AS source_status,
        d.asking_price,
        d.created_at,
        d.latitude,
        d.longitude,
        d.comparables_json,
        CASE
          WHEN pds.green_flagged_by_developer = true THEN 'Pursuing'
          WHEN LOWER(COALESCE(pds.classification, '')) IN ('green', 'passed', 'accepted') THEN 'Passed'
          ELSE 'Review'
        END AS developer_status
      FROM deals d
      INNER JOIN partner_developer_sends pds ON pds.deal_id = d.id
      LEFT JOIN partner_developers pd ON pd.id = pds.developer_id
      WHERE (
        pds.developer_profile_id = ${developerProfileId}
        OR (pds.developer_profile_id IS NULL AND pd.developer_profile_id = ${developerProfileId})
      )
      ORDER BY d.id, pds.matched_at DESC NULLS LAST, pd.created_at DESC NULLS LAST
    )
    SELECT id, address, city, state, source_status, developer_status,
      asking_price, created_at
    FROM visible_deals
    WHERE (${status === null} OR LOWER(developer_status) = ${status})
      AND (
        ${search === ""}
        OR LOWER(COALESCE(address, '')) LIKE LOWER(${"%" + search + "%"})
        OR LOWER(COALESCE(city, '')) LIKE LOWER(${"%" + search + "%"})
        OR LOWER(COALESCE(state, '')) LIKE LOWER(${"%" + search + "%"})
      )
    ORDER BY created_at DESC NULLS LAST
    LIMIT ${limit}
  `);
  return (result.rows || []).map((row: any) => ({
    id: row.id,
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    status: row.developer_status,
    sourceStatus: row.source_status || null,
    askingPrice: row.asking_price === null ? null : Number(row.asking_price),
    createdAt: row.created_at || null,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
  }));
}

export async function getMyDealCount(developerProfileId: string, filters: Omit<MyDealFilters, "limit"> = {}) {
  const status = normalizeStatus(filters.status);
  const search = String(filters.search || "").trim();
  const result = await db.execute(sql`
    WITH visible_deals AS (
      SELECT DISTINCT ON (d.id)
        d.id,
        d.address,
        d.city,
        d.state,
        CASE
          WHEN pds.green_flagged_by_developer = true THEN 'Pursuing'
          WHEN LOWER(COALESCE(pds.classification, '')) IN ('green', 'passed', 'accepted') THEN 'Passed'
          ELSE 'Review'
        END AS developer_status
      FROM deals d
      INNER JOIN partner_developer_sends pds ON pds.deal_id = d.id
      LEFT JOIN partner_developers pd ON pd.id = pds.developer_id
      WHERE (
        pds.developer_profile_id = ${developerProfileId}
        OR (pds.developer_profile_id IS NULL AND pd.developer_profile_id = ${developerProfileId})
      )
      ORDER BY d.id, pds.matched_at DESC NULLS LAST, pd.created_at DESC NULLS LAST
    )
    SELECT COUNT(*)::int AS total_count
    FROM visible_deals
    WHERE (${status === null} OR LOWER(developer_status) = ${status})
      AND (
        ${search === ""}
        OR LOWER(COALESCE(address, '')) LIKE LOWER(${"%" + search + "%"})
        OR LOWER(COALESCE(city, '')) LIKE LOWER(${"%" + search + "%"})
        OR LOWER(COALESCE(state, '')) LIKE LOWER(${"%" + search + "%"})
      )
  `);
  return Number((result.rows?.[0] as any)?.total_count) || 0;
}

export async function getMyPipelineSummary(developerProfileId: string) {
  const result = await db.execute(sql`
    SELECT
      s.id AS stage_id,
      s.name AS stage_name,
      s.sort_order,
      COUNT(o.id)::int AS opportunity_count,
      COALESCE(SUM(o.value), 0)::numeric AS total_value
    FROM pipeline_stages s
    LEFT JOIN pipeline_opportunities o
      ON o.stage_id = s.id
      AND o.developer_profile_id = ${developerProfileId}
    WHERE s.developer_profile_id = ${developerProfileId}
      AND s.is_active = true
    GROUP BY s.id, s.name, s.sort_order
    ORDER BY s.sort_order, s.name
  `);
  const stages = (result.rows || []).map((row: any) => ({
    id: row.stage_id,
    name: row.stage_name,
    count: Number(row.opportunity_count) || 0,
    totalValue: Number(row.total_value) || 0,
  }));
  return {
    stages,
    totalOpportunities: stages.reduce((sum, stage) => sum + stage.count, 0),
    totalValue: stages.reduce((sum, stage) => sum + stage.totalValue, 0),
  };
}

export async function getMyContacts(developerProfileId: string, search = "") {
  const normalizedSearch = String(search || "").trim();
  const result = await db.execute(sql`
    SELECT b.id, b.first_name, b.last_name, b.email, b.phone, b.brokerage,
      b.state_region, b.crm_tags
    FROM brokers b
    WHERE b.is_active = true
      AND (b.owner_developer_profile_id = ${developerProfileId} OR b.owner_developer_profile_id IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM users demo_owner
        WHERE demo_owner.id = b.user_id
          AND LOWER(demo_owner.email) = 'demo@catalystcp.com'
      )
      AND (
        ${normalizedSearch === ""}
        OR LOWER(COALESCE(b.first_name, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
        OR LOWER(COALESCE(b.last_name, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
        OR LOWER(COALESCE(b.email, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
        OR LOWER(COALESCE(b.brokerage, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
      )
    ORDER BY b.last_name, b.first_name
    LIMIT 100
  `);
  return (result.rows || []).map((row: any) => ({
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed contact",
    email: row.email || null,
    phone: row.phone || null,
    brokerage: row.brokerage || null,
    state: row.state_region || null,
    tags: Array.isArray(row.crm_tags) ? row.crm_tags : [],
  }));
}

export async function getMyContactCount(developerProfileId: string, search = "") {
  const normalizedSearch = String(search || "").trim();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS total_count
    FROM brokers b
    WHERE b.is_active = true
      AND (b.owner_developer_profile_id = ${developerProfileId} OR b.owner_developer_profile_id IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM users demo_owner
        WHERE demo_owner.id = b.user_id
          AND LOWER(demo_owner.email) = 'demo@catalystcp.com'
      )
      AND (
        ${normalizedSearch === ""}
        OR LOWER(COALESCE(b.first_name, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
        OR LOWER(COALESCE(b.last_name, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
        OR LOWER(COALESCE(b.email, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
        OR LOWER(COALESCE(b.brokerage, '')) LIKE LOWER(${"%" + normalizedSearch + "%"})
      )
  `);
  return Number((result.rows?.[0] as any)?.total_count) || 0;
}

export async function getNearbyDeals(developerProfileId: string, filters: NearbyDealFilters = {}) {
  const dealId = String(filters.dealId || "").trim();
  const search = String(filters.search || "").trim().toLowerCase();
  const radiusMiles = Math.min(Math.max(Number(filters.radiusMiles) || 20, 0.1), 500);
  const result = await db.execute(sql`
    WITH visible_deals AS (
      SELECT DISTINCT ON (d.id)
        d.id,
        d.address,
        d.city,
        d.state,
        d.latitude,
        d.longitude,
        CASE
          WHEN pds.green_flagged_by_developer = true THEN 'Pursuing'
          WHEN LOWER(COALESCE(pds.classification, '')) IN ('green', 'passed', 'accepted') THEN 'Passed'
          ELSE 'Review'
        END AS developer_status
      FROM deals d
      INNER JOIN partner_developer_sends pds ON pds.deal_id = d.id
      LEFT JOIN partner_developers pd ON pd.id = pds.developer_id
      WHERE (
        pds.developer_profile_id = ${developerProfileId}
        OR (pds.developer_profile_id IS NULL AND pd.developer_profile_id = ${developerProfileId})
      )
      ORDER BY d.id, pds.matched_at DESC NULLS LAST, pd.created_at DESC NULLS LAST
    )
    SELECT id, address, city, state, latitude, longitude, developer_status
    FROM visible_deals
  `);
  const visibleDeals = (result.rows || []).map((row: any) => ({
    id: String(row.id),
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    status: row.developer_status || "Review",
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
  }));

  const anchor = dealId
    ? visibleDeals.find((deal) => deal.id === dealId)
    : search
      ? visibleDeals.find((deal) => {
          const address = deal.address.toLowerCase();
          const location = [deal.address, deal.city, deal.state].filter(Boolean).join(", ").toLowerCase();
          return address === search || location === search || location.includes(search);
        })
      : undefined;

  if (!anchor) {
    return {
      needsReferenceDeal: true,
      radiusMiles,
      referenceDeal: null,
      nearbyDeals: [],
      count: null,
      reason: "A verified deal address or deal ID is required to calculate a radius.",
    };
  }

  if (
    anchor.latitude === null
    || anchor.longitude === null
    || !Number.isFinite(anchor.latitude)
    || !Number.isFinite(anchor.longitude)
  ) {
    return {
      needsReferenceDeal: false,
      radiusMiles,
      referenceDeal: {
        id: anchor.id,
        address: anchor.address,
        city: anchor.city,
        state: anchor.state,
        status: anchor.status,
      },
      nearbyDeals: [],
      count: null,
      reason: "The reference deal does not have verified coordinates.",
    };
  }

  const nearbyDeals = visibleDeals
    .filter((deal) => deal.id !== anchor.id && deal.latitude !== null && deal.longitude !== null)
    .map((deal) => ({
      ...deal,
      distanceMiles: haversineMiles(
        { latitude: anchor.latitude as number, longitude: anchor.longitude as number },
        { latitude: deal.latitude as number, longitude: deal.longitude as number },
      ),
    }))
    .filter((deal) => deal.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  return {
    needsReferenceDeal: false,
    radiusMiles,
    referenceDeal: {
      id: anchor.id,
      address: anchor.address,
      city: anchor.city,
      state: anchor.state,
      status: anchor.status,
    },
    count: nearbyDeals.length,
    nearbyDeals: nearbyDeals.slice(0, 100).map((deal) => ({
      id: deal.id,
      address: deal.address,
      city: deal.city,
      state: deal.state,
      status: deal.status,
      distanceMiles: Number(deal.distanceMiles.toFixed(2)),
    })),
  };
}

export async function getCompsForDeal(developerProfileId: string, dealId: string) {
  const result = await db.execute(sql`
    SELECT d.id, d.address, d.city, d.state, d.comparables_json
    FROM deals d
    INNER JOIN partner_developer_sends pds ON pds.deal_id = d.id
    LEFT JOIN partner_developers pd ON pd.id = pds.developer_id
    WHERE d.id = ${dealId}
      AND (
        pds.developer_profile_id = ${developerProfileId}
        OR (pds.developer_profile_id IS NULL AND pd.developer_profile_id = ${developerProfileId})
      )
    ORDER BY pds.matched_at DESC NULLS LAST, pd.created_at DESC NULLS LAST
    LIMIT 1
  `);
  const deal = result.rows?.[0] as any;
  if (!deal) return null;
  return {
    deal: {
      id: deal.id,
      address: deal.address || "",
      city: deal.city || "",
      state: deal.state || "",
    },
    comparables: Array.isArray(deal.comparables_json) ? deal.comparables_json : [],
  };
}

export async function getMyCriteria(developerProfileId: string) {
  const profileResult = await db.execute(sql`
    SELECT company_name, rent_metric, min_rent_psf, min_rent_per_unit,
      comp_search_radius_miles, min_acres, max_acres, target_states,
      target_counties, acreage_overrides_by_product_type,
      qct_overrides_rent_minimum, dda_overrides_rent_minimum,
      oz_overrides_rent_minimum
    FROM developer_profiles
    WHERE id = ${developerProfileId} AND is_active = true
    LIMIT 1
  `);
  const profile = profileResult.rows?.[0] as any;
  if (!profile) return null;

  const productResult = await db.execute(sql`
    SELECT name, min_acres, max_acres, min_rent_psf, min_rent_per_unit
    FROM developer_product_types
    WHERE developer_profile_id = ${developerProfileId} AND is_active = true
    ORDER BY name
  `);

  return {
    companyName: profile.company_name,
    rentMetric: profile.rent_metric,
    minRentPsf: profile.min_rent_psf,
    minRentPerUnit: profile.min_rent_per_unit,
    compSearchRadiusMiles: profile.comp_search_radius_miles,
    minAcres: profile.min_acres,
    maxAcres: profile.max_acres,
    targetStates: profile.target_states || [],
    targetCounties: profile.target_counties || [],
    acreageOverridesByProductType: profile.acreage_overrides_by_product_type || {},
    overrides: {
      qct: Boolean(profile.qct_overrides_rent_minimum),
      dda: Boolean(profile.dda_overrides_rent_minimum),
      oz: Boolean(profile.oz_overrides_rent_minimum),
    },
    productTypes: (productResult.rows || []).map((row: any) => ({
      name: row.name,
      minAcres: row.min_acres,
      maxAcres: row.max_acres,
      minRentPsf: row.min_rent_psf,
      minRentPerUnit: row.min_rent_per_unit,
    })),
  };
}

export async function getMyCampaigns(developerProfileId: string): Promise<MyCampaign[]> {
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.status,
      ct.hubspot_trigger_tag AS trigger_tag,
      s.sequence_index, s.day_number, s.subject, s.content
    FROM outreach_campaigns c
    INNER JOIN outreach_campaign_templates ct
      ON ct.id = (c.broker_filter->>'templateId')
      AND ct.team_id = ${developerProfileId}
    LEFT JOIN outreach_campaign_template_steps s
      ON s.template_id = ct.id AND s.is_active = true
    WHERE c.developer_profile_id = ${developerProfileId}
      AND COALESCE(c.is_archived, false) = false
    ORDER BY c.name, s.sequence_index
  `);
  const campaigns = new Map<string, MyCampaign>();
  for (const row of (result.rows || []) as any[]) {
    let campaign = campaigns.get(row.id);
    if (!campaign) {
      campaign = {
        id: row.id,
        name: row.name,
        status: row.status,
        triggerTag: row.trigger_tag || null,
        steps: [],
      };
      campaigns.set(row.id, campaign);
    }
    if (row.sequence_index !== null && row.sequence_index !== undefined) {
      campaign.steps.push({
        stepNumber: Number(row.sequence_index) + 1,
        dayNumber: Number(row.day_number) || 0,
        subject: row.subject || "",
        content: row.content || "",
      });
    }
  }
  return Array.from(campaigns.values());
}

async function getOwnedCampaignId(developerProfileId: string, campaignId: string) {
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.status, c.broker_filter
    FROM outreach_campaigns c
    WHERE c.id = ${campaignId}
      AND c.developer_profile_id = ${developerProfileId}
      AND COALESCE(c.is_archived, false) = false
    LIMIT 1
  `);
  return result.rows?.[0] as any || null;
}

export async function updateMyCampaignStatus(
  developerProfileId: string,
  campaignId: string,
  status: "active" | "paused",
) {
  const campaign = await getOwnedCampaignId(developerProfileId, campaignId);
  if (!campaign) return null;
  const result = await db.execute(sql`
    UPDATE outreach_campaigns
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${campaignId} AND developer_profile_id = ${developerProfileId}
    RETURNING id, name, status
  `);
  return result.rows?.[0] || null;
}

export async function updateMyCampaignFrequency(
  developerProfileId: string,
  campaignId: string,
  daySpacing: number,
) {
  const campaign = await getOwnedCampaignId(developerProfileId, campaignId);
  if (!campaign) return null;
  const templateId = campaign.broker_filter?.templateId;
  if (!templateId) return null;
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE outreach_campaign_template_steps
      SET day_number = sequence_index * ${daySpacing}, updated_at = NOW()
      WHERE template_id = ${templateId} AND is_active = true
    `);
    await tx.execute(sql`
      UPDATE outreach_campaign_steps
      SET day_number = sequence_index * ${daySpacing}, updated_at = NOW()
      WHERE sender_id = ((${campaign.broker_filter?.senderId})::varchar)
        AND is_active = true
    `);
    const steps = await tx.execute(sql`
      SELECT sequence_index, day_number
      FROM outreach_campaign_template_steps
      WHERE template_id = ${templateId} AND is_active = true
      ORDER BY sequence_index
    `);
    return {
      id: campaign.id,
      name: campaign.name,
      daySpacing,
      steps: steps.rows || [],
    };
  });
}

export async function updateMyCampaignTriggerTag(
  developerProfileId: string,
  campaignId: string,
  triggerTag: string,
) {
  const campaign = await getOwnedCampaignId(developerProfileId, campaignId);
  if (!campaign) return null;
  const templateId = campaign.broker_filter?.templateId;
  if (!templateId) return null;
  const result = await db.execute(sql`
    UPDATE outreach_campaign_templates
    SET hubspot_trigger_tag = ${triggerTag}, updated_at = NOW()
    WHERE id = ${templateId} AND team_id = ${developerProfileId}
    RETURNING id, name, hubspot_trigger_tag
  `);
  return result.rows?.[0] || null;
}

export async function updateMyCampaignStep(
  developerProfileId: string,
  campaignId: string,
  stepNumber: number,
  subject: string | undefined,
  content: string | undefined,
) {
  const campaign = await getOwnedCampaignId(developerProfileId, campaignId);
  if (!campaign) return null;
  const templateId = campaign.broker_filter?.templateId;
  if (!templateId) return null;
  const sequenceIndex = stepNumber - 1;
  const existing = await db.execute(sql`
    SELECT id, subject, content
    FROM outreach_campaign_template_steps
    WHERE template_id = ${templateId}
      AND sequence_index = ${sequenceIndex}
      AND is_active = true
    LIMIT 1
  `);
  if (!existing.rows?.length) return null;
  const updatedSubject = subject === undefined ? (existing.rows[0] as any).subject : subject;
  const updatedContent = content === undefined ? (existing.rows[0] as any).content : content;
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE outreach_campaign_template_steps
      SET subject = ${updatedSubject}, content = ${updatedContent}, updated_at = NOW()
      WHERE template_id = ${templateId} AND sequence_index = ${sequenceIndex}
    `);
    await tx.execute(sql`
      UPDATE outreach_campaign_steps
      SET subject = ${updatedSubject}, content = ${updatedContent}, updated_at = NOW()
      WHERE sender_id = ((${campaign.broker_filter?.senderId})::varchar)
        AND sequence_index = ${sequenceIndex}
    `);
    return {
      campaignId,
      campaignName: campaign.name,
      stepNumber,
      subject: updatedSubject,
      content: updatedContent,
    };
  });
}

export async function markMyDealPursuing(developerProfileId: string, dealId: string) {
  const result = await db.execute(sql`
    UPDATE partner_developer_sends pds
    SET green_flagged_by_developer = true, green_flagged_at = NOW()
    FROM partner_developers pd
    WHERE pds.deal_id = ${dealId}
      AND (
        pds.developer_profile_id = ${developerProfileId}
        OR (pds.developer_profile_id IS NULL AND pd.id = pds.developer_id
            AND pd.developer_profile_id = ${developerProfileId})
      )
    RETURNING pds.deal_id
  `);
  return result.rows?.[0] || null;
}

export async function addMyContactTag(
  developerProfileId: string,
  contactId: string,
  tag: string,
) {
  const result = await db.execute(sql`
    UPDATE brokers
    SET crm_tags = ARRAY(
      SELECT DISTINCT value
      FROM unnest(COALESCE(crm_tags, ARRAY[]::text[]) || ARRAY[${tag}::text]) AS value
      ORDER BY value
    ), updated_at = NOW()
    WHERE id = ${contactId}
      AND owner_developer_profile_id = ${developerProfileId}
      AND is_active = true
    RETURNING id, first_name, last_name, crm_tags
  `);
  return result.rows?.[0] || null;
}

export async function createMyPipelineOpportunity(
  developerProfileId: string,
  input: { contactId: string; stageId?: string; title?: string; value?: number; notes?: string },
) {
  const contact = await db.execute(sql`
    SELECT id, first_name, last_name
    FROM brokers
    WHERE id = ${input.contactId}
      AND owner_developer_profile_id = ${developerProfileId}
      AND is_active = true
    LIMIT 1
  `);
  if (!contact.rows?.length) return null;
  const stage = await db.execute(sql`
    SELECT id, name
    FROM pipeline_stages
    WHERE developer_profile_id = ${developerProfileId}
      AND is_active = true
      AND (${input.stageId || null} IS NULL OR id = ${input.stageId || null})
    ORDER BY sort_order
    LIMIT 1
  `);
  const stageRow = stage.rows?.[0] as any;
  if (!stageRow) return null;
  const result = await db.execute(sql`
    INSERT INTO pipeline_opportunities
      (developer_profile_id, contact_id, stage_id, title, value, notes)
    VALUES
      (${developerProfileId}, ${input.contactId}, ${stageRow.id},
       ${input.title || null}, ${input.value ?? null}, ${input.notes || null})
    RETURNING id, title, value, notes
  `);
  return { ...(result.rows?.[0] as any), stageName: stageRow.name };
}