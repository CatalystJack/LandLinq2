/**
 * Guarded authenticated load test for the development deployment only.
 *
 * Run with:
 *   NODE_ENV=development ALLOW_DEV_LOAD_TEST=1 npx tsx scripts/load-test-dev.ts
 *
 * Creates isolated synthetic tenants, 100 distinct developer users, and
 * synthetic broker/deal rows. Exercises authenticated session, broker CRM,
 * tenant-authorized full-deal read route, then removes only its
 * exact fixture rows. It does not invoke mutations, messaging, or paid APIs.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { and, inArray, sql } from "drizzle-orm";
import {
  brokers as brokersTable,
  deals as dealsTable,
  developerProfiles as developerProfilesTable,
  partnerDeveloperSends as partnerDeveloperSendsTable,
  partnerDevelopers as partnerDevelopersTable,
  users as usersTable,
} from "../shared/schema";
import { hashPassword } from "../server/auth";
import { db, pool } from "../server/db";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const concurrencyStages = [1, 10, 25, 50, 100];
const syntheticRecordsPerTenant = 40;
const loginBatchSize = 5;
const requestTimeoutMs = 15_000;
const metricSampleIntervalMs = 250;
const maxMainPoolWaitingAllowed = 5;
const runTag = `lt${randomUUID().replace(/-/g, "").slice(0, 10)}`;
const password = randomBytes(32).toString("base64url");

if (process.env.ALLOW_DEV_LOAD_TEST !== "1") {
  throw new Error("Set ALLOW_DEV_LOAD_TEST=1 to explicitly enable this test.");
}
if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Refusing to run outside the Replit development environment.");
}
if (!process.env.REPLIT_DEV_DOMAIN || !/\.replit\.dev$/.test(process.env.REPLIT_DEV_DOMAIN)) {
  throw new Error("REPLIT_DEV_DOMAIN must identify the development app.");
}

const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;

type SyntheticUser = {
  id: string;
  email: string;
  profileId: string;
  tenant: "primary" | "control";
  cookie?: string;
};

type SyntheticFixture = {
  profileIds: { primary: string; control: string };
  profileSlugs: { primary: string; control: string };
  users: SyntheticUser[];
  primaryUsers: SyntheticUser[];
  controlUser: SyntheticUser;
  brokerIds: { primary: string[]; control: string[] };
  dealIds: { primary: string[]; control: string[] };
  partnerDeveloperIds: string[];
  sendIds: string[];
};

type JsonResponse = {
  status: number;
  body: any;
  jsonBytes: number;
  contentLengthBytes: number | null;
};

type MetricsSample = {
  sampledAt: number;
  [key: string]: any;
};

type LoadEndpoint = {
  name: string;
  path: string;
  validate: (body: any, user: SyntheticUser) => boolean;
};

let fixture: SyntheticFixture | undefined;
let cleanupFailed = false;

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

async function fetchJson(path: string, cookie: string): Promise<JsonResponse> {
  const response = await fetch(`${origin}${path}`, {
    headers: { cookie },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const body = await response.json().catch(() => null);
  const contentLength = response.headers.get("content-length");
  const parsedContentLength = contentLength === null ? null : Number(contentLength);
  return {
    status: response.status,
    body,
    jsonBytes: body === null ? 0 : Buffer.byteLength(JSON.stringify(body), "utf8"),
    contentLengthBytes:
      parsedContentLength !== null && Number.isFinite(parsedContentLength)
        ? parsedContentLength
        : null,
  };
}

function createProfileRow(id: string, slug: string, suffix: string) {
  return {
    id,
    companyName: `Synthetic Load Test ${runTag} ${suffix}`,
    slug,
    profileType: "real_estate",
    assetClass: "multifamily",
    rentMetric: "psf",
    minAcres: "1",
    targetStates: ["NC"],
    targetCounties: ["Wake"],
    isActive: true,
    outreachTestModeEnabled: false,
    emailUnsubscribeEnabled: false,
    crmSharedContactsEnabled: false,
  };
}

async function createSyntheticFixture(): Promise<SyntheticFixture> {
  const profileIds = { primary: randomUUID(), control: randomUUID() };
  const profileSlugs = {
    primary: `${runTag}-tenant-a`,
    control: `${runTag}-tenant-b`,
  };
  const primaryUsers: SyntheticUser[] = Array.from({ length: 100 }, (_, index) => ({
    id: randomUUID(),
    email: `loadtest-${runTag}-user-${String(index + 1).padStart(3, "0")}@example.invalid`,
    profileId: profileIds.primary,
    tenant: "primary",
  }));
  const controlUser: SyntheticUser = {
    id: randomUUID(),
    email: `loadtest-${runTag}-control@example.invalid`,
    profileId: profileIds.control,
    tenant: "control",
  };
  const allUsers = [...primaryUsers, controlUser];

  const brokerRows = (["primary", "control"] as const).flatMap((tenant) =>
    Array.from({ length: syntheticRecordsPerTenant }, (_, index) => ({
      id: randomUUID(),
      firstName: "LoadTest",
      lastName: `${runTag}-${tenant}-${String(index + 1).padStart(3, "0")}`,
      brokerage: `Synthetic Brokerage ${runTag}`,
      marketsCovered: `Synthetic ${runTag}`,
      ownerDeveloperProfileId: profileIds[tenant],
      isActive: true,
      sourceTags: ["load-test"],
    })),
  );
  const brokerIds = {
    primary: brokerRows.filter((row) => row.ownerDeveloperProfileId === profileIds.primary).map((row) => row.id),
    control: brokerRows.filter((row) => row.ownerDeveloperProfileId === profileIds.control).map((row) => row.id),
  };

  const primaryPartnerId = randomUUID();
  const controlPartnerId = randomUUID();
  const partnerRows = [
    {
      id: primaryPartnerId,
      developerProfileId: profileIds.primary,
      companyName: `Synthetic Partner ${runTag} A`,
      contactName: "Load Test",
      email: `loadtest-${runTag}-partner-a@example.invalid`,
      isActive: true,
      autoSendEnabled: false,
    },
    {
      id: controlPartnerId,
      developerProfileId: profileIds.control,
      companyName: `Synthetic Partner ${runTag} B`,
      contactName: "Load Test",
      email: `loadtest-${runTag}-partner-b@example.invalid`,
      isActive: true,
      autoSendEnabled: false,
    },
  ];
  const dealRows = (["primary", "control"] as const).flatMap((tenant) => {
    const tenantBrokerIds = brokerIds[tenant];
    return Array.from({ length: syntheticRecordsPerTenant }, (_, index) => ({
      id: randomUUID(),
      brokerId: tenantBrokerIds[index],
      dealType: "land",
      submissionMethod: "form",
      source: "landlinq_sourced",
      address: `${runTag} Synthetic ${tenant} Property ${String(index + 1).padStart(3, "0")}`,
      city: `Synthetic ${runTag}`,
      state: null,
      county: null,
      censusTractFips: null,
      zip: "00000",
      askingPrice: "100000",
      userSizeAcres: "2.00",
      productTypes: ["Multifamily"],
      status: "pending_review",
      classification: "unclassified",
    }));
  });
  const dealIds = {
    primary: dealRows.slice(0, syntheticRecordsPerTenant).map((row) => row.id),
    control: dealRows.slice(syntheticRecordsPerTenant).map((row) => row.id),
  };
  const partnerDeveloperIds = [primaryPartnerId, controlPartnerId];
  const sendRows = dealRows.map((deal, index) => {
    const tenant = index < syntheticRecordsPerTenant ? "primary" : "control";
    const developerId = tenant === "primary" ? primaryPartnerId : controlPartnerId;
    const profileId = profileIds[tenant];
    return {
      id: randomUUID(),
      developerId,
      developerProfileId: profileId,
      dealId: deal.id,
      status: "pending",
      classification: "review",
      matchedProductTypes: ["Multifamily"],
      address: deal.address,
      greenFlaggedByDeveloper: false,
    };
  });
  const passwordHash = await hashPassword(password);
  const userRows = allUsers.map((user, index) => ({
    id: user.id,
    email: user.email,
    password: passwordHash,
    role: "DEVELOPER",
    developerProfileId: user.profileId,
    firstName: "Load",
    lastName: `Test ${index + 1}`,
    mustResetPassword: false,
  }));

  await db.transaction(async (tx) => {
    await tx.insert(developerProfilesTable).values([
      createProfileRow(profileIds.primary, profileSlugs.primary, "A"),
      createProfileRow(profileIds.control, profileSlugs.control, "B"),
    ]);
    await tx.insert(usersTable).values(userRows);
    await tx.insert(brokersTable).values(brokerRows);
    await tx.insert(partnerDevelopersTable).values(partnerRows);
    await tx.insert(dealsTable).values(dealRows);
    await tx.insert(partnerDeveloperSendsTable).values(sendRows);
  });

  const created: SyntheticFixture = {
    profileIds,
    profileSlugs,
    users: allUsers,
    primaryUsers,
    controlUser,
    brokerIds,
    dealIds,
    partnerDeveloperIds,
    sendIds: sendRows.map((row) => row.id),
  };
  fixture = created;
  return created;
}

async function createSession(user: SyntheticUser): Promise<void> {
  const response = await fetch(`${origin}/api/dev-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok || !cookie) {
    throw new Error(`Could not establish a synthetic development session (HTTP ${response.status}).`);
  }
  user.cookie = cookie;
}

function contactsBelongTo(
  body: any,
  expectedBrokerIds: Set<string>,
  expectedProfileId: string,
): boolean {
  return Array.isArray(body?.contacts)
    && body.contacts.length > 0
    && body.contacts.length <= 25
    && Number(body.pagination?.total) === syntheticRecordsPerTenant
    && body.contacts.every((contact: any) =>
      expectedBrokerIds.has(String(contact.id))
      && contact.ownerDeveloperProfileId === expectedProfileId,
    );
}

async function verifyTenantIsolation(
  testFixture: SyntheticFixture,
  paths: { contacts: string; primaryDetail: string; controlDetail: string },
) {
  const [primaryContacts, controlContacts] = await Promise.all([
    fetchJson(paths.contacts, testFixture.primaryUsers[0].cookie!),
    fetchJson(paths.contacts, testFixture.controlUser.cookie!),
  ]);
  const [primaryOwnDeal, controlOwnDeal, primaryForeignDeal, controlForeignDeal] = await Promise.all([
    fetchJson(paths.primaryDetail, testFixture.primaryUsers[0].cookie!),
    fetchJson(paths.controlDetail, testFixture.controlUser.cookie!),
    fetchJson(paths.controlDetail, testFixture.primaryUsers[0].cookie!),
    fetchJson(paths.primaryDetail, testFixture.controlUser.cookie!),
  ]);

  const primaryBrokerIds = new Set(testFixture.brokerIds.primary);
  const controlBrokerIds = new Set(testFixture.brokerIds.control);
  const checks = {
    primaryBrokerListScoped: primaryContacts.status === 200
      && contactsBelongTo(primaryContacts.body, primaryBrokerIds, testFixture.profileIds.primary),
    controlBrokerListScoped: controlContacts.status === 200
      && contactsBelongTo(controlContacts.body, controlBrokerIds, testFixture.profileIds.control),
    primaryDealDetailReadable: primaryOwnDeal.status === 200
      && primaryOwnDeal.body?.id === testFixture.dealIds.primary[0],
    controlDealDetailReadable: controlOwnDeal.status === 200
      && controlOwnDeal.body?.id === testFixture.dealIds.control[0],
    primaryCannotReadControlDeal: primaryForeignDeal.status === 404,
    controlCannotReadPrimaryDeal: controlForeignDeal.status === 404,
  };
  const diagnostics = {
    primaryContacts: {
      status: primaryContacts.status,
      rows: primaryContacts.body?.contacts?.length ?? null,
      total: primaryContacts.body?.pagination?.total ?? null,
    },
    controlContacts: {
      status: controlContacts.status,
      rows: controlContacts.body?.contacts?.length ?? null,
      total: controlContacts.body?.pagination?.total ?? null,
    },
  };
  ensure(
    Object.values(checks).every(Boolean),
    `Tenant-scoped broker/deal preflight failed: ${JSON.stringify({ checks, diagnostics })}`,
  );
  return checks;
}

async function runWave(
  endpoint: LoadEndpoint,
  concurrency: number,
  label: string,
  testFixture: SyntheticFixture,
) {
  const poolSamples: MetricsSample[] = [];
  let metricSampleErrors = 0;
  let sampling = true;
  const metricCookie = testFixture.primaryUsers[0].cookie!;

  const collectPoolSample = async () => {
    try {
      const { status, body } = await fetchJson("/api/dev/db-pool-metrics", metricCookie);
      if (status === 200 && body && typeof body === "object") {
        poolSamples.push({ ...body, sampledAt: performance.now() });
      } else {
        metricSampleErrors++;
      }
    } catch {
      metricSampleErrors++;
    }
  };

  await collectPoolSample();
  const sampler = (async () => {
    while (sampling) {
      await delay(metricSampleIntervalMs);
      if (sampling) await collectPoolSample();
    }
  })();

  const waveUsers = testFixture.primaryUsers.slice(0, concurrency);
  const start = performance.now();
  const responses = await Promise.all(waveUsers.map(async (user) => {
    const requestStart = performance.now();
    try {
      const result = await fetchJson(endpoint.path, user.cookie!);
      return {
        ...result,
        durationMs: performance.now() - requestStart,
        valid: result.status === 200 && endpoint.validate(result.body, user),
      };
    } catch {
      return {
        status: 0,
        body: null,
        jsonBytes: 0,
        contentLengthBytes: null,
        durationMs: performance.now() - requestStart,
        valid: false,
      };
    }
  }));
  const elapsedMs = performance.now() - start;
  sampling = false;
  await sampler;
  await collectPoolSample();

  const durations = responses.map((response) => response.durationMs);
  const statusCounts: Record<string, number> = {};
  for (const response of responses) {
    const status = String(response.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const validContentLengths = responses
    .map((response) => response.contentLengthBytes)
    .filter((value): value is number => value !== null);
  const firstCpuSample = poolSamples[0];
  const lastCpuSample = poolSamples[poolSamples.length - 1];
  const cpuSampleElapsedMs = Number(lastCpuSample?.sampledAt) - Number(firstCpuSample?.sampledAt);
  const cpuUsedMicros =
    Number(lastCpuSample?.process?.cpuUserMicros || 0)
    + Number(lastCpuSample?.process?.cpuSystemMicros || 0)
    - Number(firstCpuSample?.process?.cpuUserMicros || 0)
    - Number(firstCpuSample?.process?.cpuSystemMicros || 0);

  return {
    label,
    route: endpoint.name,
    concurrency,
    requests: responses.length,
    elapsedMs: Math.round(elapsedMs),
    requestsPerSecond: Number((responses.length / Math.max(elapsedMs / 1000, 0.001)).toFixed(2)),
    latencyMs: {
      p50: Math.round(percentile(durations, 0.5)),
      p95: Math.round(percentile(durations, 0.95)),
      p99: Math.round(percentile(durations, 0.99)),
      max: Math.round(Math.max(0, ...durations)),
    },
    statusCounts,
    responseBytes: {
      uncompressedJsonTotal: responses.reduce((total, response) => total + response.jsonBytes, 0),
      uncompressedJsonMax: Math.max(0, ...responses.map((response) => response.jsonBytes)),
      contentLengthTotal: validContentLengths.reduce((total, value) => total + value, 0),
      contentLengthSamples: validContentLengths.length,
    },
    validationFailures: responses.filter((response) => !response.valid).length,
    mainPoolWaitingPeak: Math.max(0, ...poolSamples.map((sample) => Number(sample.mainPool?.waitingCount || 0))),
    managerPoolWaitingPeak: Math.max(0, ...poolSamples.map((sample) => Number(sample.managerPool?.waitingCount || 0))),
    mainPoolIdleClientErrors: Math.max(0, ...poolSamples.map((sample) => Number(sample.mainPool?.idleClientErrors || 0))),
    managerConnectionErrors: Math.max(0, ...poolSamples.map((sample) => Number(sample.managerPool?.connectionsFailed || 0))),
    databaseConnectionsPeak: Math.max(0, ...poolSamples.map((sample) => Number(sample.database?.activeConnections || 0))),
    databaseMaxConnections: Math.max(0, ...poolSamples.map((sample) => Number(sample.database?.maxConnections || 0))),
    processRssPeakBytes: Math.max(0, ...poolSamples.map((sample) => Number(sample.process?.rssBytes || 0))),
    processCpuPercent: cpuSampleElapsedMs > 0
      ? Number((Math.max(0, cpuUsedMicros) / (cpuSampleElapsedMs * 1000) * 100).toFixed(1))
      : null,
    metricSamples: poolSamples.length,
    metricSampleErrors,
  };
}

async function cleanupFixture(): Promise<void> {
  if (!fixture) return;

  try {
    await db.transaction(async (tx) => {
      const userIds = fixture!.users.map((user) => user.id);
      const userEmails = fixture!.users.map((user) => user.email);
      const userIdList = sql.join(userIds.map((id) => sql`${id}`), sql`, `);
      await tx.execute(sql`
        DELETE FROM sessions
        WHERE sess #>> '{passport,user}' IN (${userIdList})
           OR sess #>> '{passport,user,id}' IN (${userIdList})
      `);

      const deletedSends = await tx.delete(partnerDeveloperSendsTable)
        .where(inArray(partnerDeveloperSendsTable.id, fixture!.sendIds))
        .returning({ id: partnerDeveloperSendsTable.id });
      const deletedDeals = await tx.delete(dealsTable)
        .where(inArray(dealsTable.id, [...fixture!.dealIds.primary, ...fixture!.dealIds.control]))
        .returning({ id: dealsTable.id });
      const deletedPartners = await tx.delete(partnerDevelopersTable)
        .where(inArray(partnerDevelopersTable.id, fixture!.partnerDeveloperIds))
        .returning({ id: partnerDevelopersTable.id });
      const deletedBrokers = await tx.delete(brokersTable)
        .where(inArray(brokersTable.id, [...fixture!.brokerIds.primary, ...fixture!.brokerIds.control]))
        .returning({ id: brokersTable.id });
      const deletedUsers = await tx.delete(usersTable)
        .where(and(
          inArray(usersTable.id, userIds),
          inArray(usersTable.email, userEmails),
        ))
        .returning({ id: usersTable.id });
      const deletedProfiles = await tx.delete(developerProfilesTable)
        .where(and(
          inArray(developerProfilesTable.id, [fixture!.profileIds.primary, fixture!.profileIds.control]),
          inArray(developerProfilesTable.slug, [fixture!.profileSlugs.primary, fixture!.profileSlugs.control]),
        ))
        .returning({ id: developerProfilesTable.id });

      ensure(deletedSends.length === fixture!.sendIds.length, "Synthetic send cleanup count did not match.");
      ensure(deletedDeals.length === fixture!.dealIds.primary.length + fixture!.dealIds.control.length, "Synthetic deal cleanup count did not match.");
      ensure(deletedPartners.length === fixture!.partnerDeveloperIds.length, "Synthetic partner cleanup count did not match.");
      ensure(deletedBrokers.length === fixture!.brokerIds.primary.length + fixture!.brokerIds.control.length, "Synthetic broker cleanup count did not match.");
      ensure(deletedUsers.length === fixture!.users.length, "Synthetic user cleanup count did not match.");
      ensure(deletedProfiles.length === 2, "Synthetic profile cleanup count did not match.");
    });
    console.log("Synthetic broker/deal load-test fixture cleaned up.");
  } catch (error) {
    cleanupFailed = true;
    const detail = error instanceof Error ? `: ${error.message}` : "";
    console.error(`Synthetic fixture cleanup failed for run ${runTag}; inspect only the development database${detail}`);
  }
}

async function main(): Promise<void> {
  const testFixture = await createSyntheticFixture();
  for (let offset = 0; offset < testFixture.users.length; offset += loginBatchSize) {
    const batch = testFixture.users.slice(offset, offset + loginBatchSize);
    const results = await Promise.allSettled(batch.map((user) => createSession(user)));
    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures > 0) {
      throw new Error(`Could not establish ${failures} synthetic development session(s).`);
    }
  }

  const allCookies = testFixture.users.map((user) => user.cookie).filter(Boolean);
  ensure(allCookies.length === 101 && new Set(allCookies).size === 101, "Expected 101 distinct development sessions.");

  const contactsPath = `/api/crm/contacts?page=1&limit=25&includeFilterOptions=false`;
  const primaryDetailPath = `/api/deals/${testFixture.dealIds.primary[0]}/full`;
  const controlDetailPath = `/api/deals/${testFixture.dealIds.control[0]}/full`;
  const tenantIsolation = await verifyTenantIsolation(testFixture, {
    contacts: contactsPath,
    primaryDetail: primaryDetailPath,
    controlDetail: controlDetailPath,
  });

  const primaryBrokerIds = new Set(testFixture.brokerIds.primary);
  const endpoints: LoadEndpoint[] = [
    {
      name: "session-info",
      path: "/api/sessions/info",
      validate: (body, user) => body?.user === user.email,
    },
    {
      name: "broker-crm-list",
      path: contactsPath,
      validate: (body) => contactsBelongTo(body, primaryBrokerIds, testFixture.profileIds.primary),
    },
    {
      name: "developer-deal-full-detail",
      path: primaryDetailPath,
      validate: (body) => body?.id === testFixture.dealIds.primary[0],
    },
  ];

  const waves = [];
  for (const concurrency of concurrencyStages) {
    for (const endpoint of endpoints) {
      waves.push(await runWave(endpoint, concurrency, `ramp-${concurrency}`, testFixture));
    }
  }

  const failedResponses = waves.reduce(
    (total, wave) => total + wave.requests - Number(wave.statusCounts["200"] || 0) + wave.validationFailures,
    0,
  );
  const hundredUserWaves = waves.filter((wave) => wave.concurrency === 100);
  const passed =
    failedResponses === 0
    && Object.values(tenantIsolation).every(Boolean)
    && hundredUserWaves.length === endpoints.length
    && hundredUserWaves.every((wave) =>
      wave.latencyMs.p95 <= 2_000
      && wave.mainPoolWaitingPeak <= maxMainPoolWaitingAllowed
      && wave.managerPoolWaitingPeak === 0
      && wave.metricSamples >= 2
      && wave.metricSampleErrors === 0,
    );

  console.log(JSON.stringify({
    environment: "development",
    runTag,
    users: { concurrent: 100, primaryTenantUsers: testFixture.primaryUsers.length, isolationControlUser: 1 },
    fixtureRecords: {
      tenantProfiles: 2,
      brokers: testFixture.brokerIds.primary.length + testFixture.brokerIds.control.length,
      deals: testFixture.dealIds.primary.length + testFixture.dealIds.control.length,
    },
    testedRoutes: endpoints.map((endpoint) => endpoint.name),
    externalProviderCalls: false,
    tenantIsolation,
    metricSamplingIntervalMs: metricSampleIntervalMs,
    maxMainPoolWaitingAllowed,
    waves,
    passed,
    passCriteria: "All responses are HTTP 200 with tenant-correct payloads, each 100-user route wave has p95 <= 2000ms, main-pool waiting stays <= 5, manager-pool waiting stays at 0, and at least two successful metrics samples.",
  }, null, 2));
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error("Development business-load test failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await cleanupFixture();
  await pool.end().catch(() => undefined);
  if (cleanupFailed) process.exitCode = 1;
}