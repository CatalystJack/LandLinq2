import {
  and,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { brokers } from "@shared/schema";
import { US_STATE_OPTIONS } from "@shared/us-states";

export const BROKER_DIRECTORY_DEFAULT_PAGE_SIZE = 50;
export const BROKER_DIRECTORY_MAX_PAGE_SIZE = 100;
const DEMO_BROKER_USER_ID = "20974d7b-e103-4fc7-b42f-7a13d41041fb";

export interface BrokerDirectoryCursor {
  createdAt: string | null;
  id: string;
}

export interface BrokerDirectoryVisibility {
  sectors: string[];
  states: string[];
  counties: string[];
  sourceTags: string[];
  allowSharedDirectory: boolean;
}

export function parseBrokerDirectoryLimit(value: unknown): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return BROKER_DIRECTORY_DEFAULT_PAGE_SIZE;
  }
  return Math.min(BROKER_DIRECTORY_MAX_PAGE_SIZE, Math.max(1, parsed));
}

export function encodeBrokerDirectoryCursor(cursor: BrokerDirectoryCursor): string {
  return Buffer.from(JSON.stringify({
    createdAt: cursor.createdAt,
    id: cursor.id,
  })).toString("base64url");
}

export function decodeBrokerDirectoryCursor(value: unknown): BrokerDirectoryCursor | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;

  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) return null;
    const parsed = JSON.parse(decoded.toString("utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      parsed.id.length > 200 ||
      !(parsed.createdAt === null || typeof parsed.createdAt === "string")
    ) {
      return null;
    }

    if (parsed.createdAt === null) {
      return { createdAt: null, id: parsed.id };
    }

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(parsed.createdAt)) return null;
    if (!Number.isFinite(new Date(`${parsed.createdAt}Z`).getTime())) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function buildBrokerDirectoryCursorCondition(cursor: BrokerDirectoryCursor): SQL {
  if (cursor.createdAt === null) {
    return and(isNull(brokers.createdAt), lt(brokers.id, cursor.id))!;
  }

  const cursorTimestamp = sql`${cursor.createdAt}::timestamp without time zone`;
  return or(
    lt(brokers.createdAt, cursorTimestamp),
    and(eq(brokers.createdAt, cursorTimestamp), lt(brokers.id, cursor.id)),
    isNull(brokers.createdAt),
  )!;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function buildBrokerDirectorySearchCondition(
  query: string,
  excludeId?: string,
): SQL | undefined {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return excludeId ? ne(brokers.id, excludeId) : undefined;

  const pattern = `%${escapeLikePattern(trimmedQuery)}%`;
  const searchCondition = or(
    ilike(sql`concat_ws(' ', ${brokers.firstName}, ${brokers.lastName})`, pattern),
    ilike(brokers.email, pattern),
    ilike(brokers.phone, pattern),
    ilike(brokers.brokerage, pattern),
    ilike(brokers.marketsCovered, pattern),
  )!;

  return excludeId
    ? and(searchCondition, ne(brokers.id, excludeId))!
    : searchCondition;
}

function sharedBrokerStateCondition(states: string[]): SQL {
  const allowedStates = states.map((state) => state.toUpperCase());
  const stateNameCases = US_STATE_OPTIONS.map(
    ({ code, name }) => sql`WHEN ${name.toUpperCase()} THEN ${code}`,
  );
  const normalizedRegionState = sql`
    CASE upper(btrim(broker_state.value))
      ${sql.join(stateNameCases, sql` `)}
      ELSE upper(btrim(broker_state.value))
    END
  `;

  const regionMatch = sql`
    EXISTS (
      SELECT 1
      FROM unnest(string_to_array(COALESCE(${brokers.stateRegion}, ''), ',')) AS broker_state(value)
      WHERE ${normalizedRegionState} IN (${sql.join(allowedStates.map((state) => sql`${state}`), sql`, `)})
    )
  `;
  const validStateCodes = US_STATE_OPTIONS
    .map(({ code }) => code)
    .filter((code) => allowedStates.includes(code));
  const outOfStateMatches = validStateCodes.map((code) => sql`
    lower(btrim(COALESCE(${brokers.contactCounty}, ''))) ~ ${`^out of state[[:space:]]*\\(${code.toLowerCase()}\\)$`}
  `);

  return or(regionMatch, ...outOfStateMatches)!;
}

export function buildBrokerDirectoryVisibilityCondition(
  developerProfileId: string,
  visibility: BrokerDirectoryVisibility,
): SQL {
  const sharedFilters: SQL[] = [
    isNull(brokers.ownerDeveloperProfileId),
    ne(brokers.userId, DEMO_BROKER_USER_ID),
  ];

  if (!visibility.allowSharedDirectory) {
    return eq(brokers.ownerDeveloperProfileId, developerProfileId);
  }

  if (visibility.sectors.length > 0) {
    sharedFilters.push(inArray(
      sql`lower(btrim(COALESCE(${brokers.contactSector}, '')))`,
      visibility.sectors.map((sector) => sector.toLowerCase()),
    ));
  }
  if (visibility.states.length > 0) {
    sharedFilters.push(sharedBrokerStateCondition(visibility.states));
  }
  if (visibility.counties.length > 0) {
    sharedFilters.push(sql`
      EXISTS (
        SELECT 1
        FROM unnest(regexp_split_to_array(COALESCE(${brokers.contactCounty}, ''), '[,;|]')) AS broker_county(value)
        WHERE lower(btrim(broker_county.value)) IN (
          ${sql.join(visibility.counties.map((county) => sql`${county.toLowerCase()}`), sql`, `)}
        )
      )
    `);
  }
  if (visibility.sourceTags.length > 0) {
    sharedFilters.push(sql`
      EXISTS (
        SELECT 1
        FROM unnest(COALESCE(${brokers.sourceTags}, ARRAY[]::text[])) AS broker_source_tag(value)
        WHERE lower(btrim(broker_source_tag.value)) IN (
          ${sql.join(visibility.sourceTags.map((tag) => sql`${tag.toLowerCase()}`), sql`, `)}
        )
      )
    `);
  }

  return or(
    eq(brokers.ownerDeveloperProfileId, developerProfileId),
    and(...sharedFilters),
  )!;
}