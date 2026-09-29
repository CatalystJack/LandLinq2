/**
 * Guarded authenticated load test for the development deployment only.
 *
 * Run with:
 *   NODE_ENV=development ALLOW_DEV_LOAD_TEST=1 npx tsx scripts/load-test-dev.ts
 *
 * This creates one synthetic BROKER user, creates independent dev sessions,
 * exercises only the self-scoped session-info GET route, then logs out and
 * deletes exactly the fixture user and any remaining sessions.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import { hashPassword } from "../server/auth";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";

const DELAY_MS = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const concurrencyStages = [1, 10, 25, 50, 100];
const additionalHundredUserWaves = 2;
const loginBatchSize = 5;
const requestTimeoutMs = 15_000;

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
const email = `loadtest-${randomUUID()}@example.invalid`;
const password = randomBytes(32).toString("base64url");
const cookies: string[] = [];
let testUser: { id: string; email: string } | undefined;
let cleanupFailed = false;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

async function fetchJson(path: string, cookie: string) {
  const response = await fetch(`${origin}${path}`, {
    headers: { cookie },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function createSession(): Promise<void> {
  const response = await fetch(`${origin}/api/dev-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok || !cookie) {
    throw new Error(`Development login failed with HTTP ${response.status}.`);
  }
  cookies.push(cookie);
}

async function runWave(concurrency: number, label: string) {
  const poolSamples: any[] = [];
  let sampling = true;
  const metricCookie = cookies[0];

  const collectPoolSample = async () => {
    try {
      const { response, body } = await fetchJson("/api/dev/db-pool-metrics", metricCookie);
      if (response.ok && body && typeof body === "object") {
        poolSamples.push({ ...body, sampledAt: performance.now() });
      }
    } catch {
      // The measured session-info requests remain the source of pass/fail.
    }
  };

  await collectPoolSample();
  const sampler = (async () => {
    while (sampling) {
      await DELAY_MS(50);
      if (sampling) await collectPoolSample();
    }
  })();

  const start = performance.now();
  const responses = await Promise.all(
    cookies.slice(0, concurrency).map(async (cookie) => {
      const requestStart = performance.now();
      try {
        const { response } = await fetchJson("/api/sessions/info", cookie);
        return { status: response.status, durationMs: performance.now() - requestStart };
      } catch {
        return { status: 0, durationMs: performance.now() - requestStart };
      }
    }),
  );
  const elapsedMs = performance.now() - start;
  sampling = false;
  await sampler;
  await collectPoolSample();

  const durations = responses.map((r) => r.durationMs);
  const statusCounts: Record<string, number> = {};
  for (const response of responses) {
    const status = String(response.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const mainPoolWaitingPeak = Math.max(0, ...poolSamples.map((s) => Number(s.mainPool?.waitingCount || 0)));
  const managerPoolWaitingPeak = Math.max(0, ...poolSamples.map((s) => Number(s.managerPool?.waitingCount || 0)));
  const idleErrors = Math.max(0, ...poolSamples.map((s) => Number(s.mainPool?.idleClientErrors || 0)));
  const managerErrors = Math.max(0, ...poolSamples.map((s) => Number(s.managerPool?.connectionsFailed || 0)));
  const databaseConnectionsPeak = Math.max(0, ...poolSamples.map((s) => Number(s.database?.activeConnections || 0)));
  const rssPeakBytes = Math.max(0, ...poolSamples.map((s) => Number(s.process?.rssBytes || 0)));
  const firstCpuSample = poolSamples[0];
  const lastCpuSample = poolSamples[poolSamples.length - 1];
  const cpuSampleElapsedMs = Number(lastCpuSample?.sampledAt) - Number(firstCpuSample?.sampledAt);
  const cpuUsedMicros =
    Number(lastCpuSample?.process?.cpuUserMicros || 0) +
    Number(lastCpuSample?.process?.cpuSystemMicros || 0) -
    Number(firstCpuSample?.process?.cpuUserMicros || 0) -
    Number(firstCpuSample?.process?.cpuSystemMicros || 0);
  const processCpuPercent = cpuSampleElapsedMs > 0
    ? Number((Math.max(0, cpuUsedMicros) / (cpuSampleElapsedMs * 1000) * 100).toFixed(1))
    : null;

  return {
    label,
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
    mainPoolWaitingPeak,
    managerPoolWaitingPeak,
    idleClientErrors: idleErrors,
    managerConnectionErrors: managerErrors,
    databaseConnectionsPeak,
    processRssPeakBytes: rssPeakBytes,
    processCpuPercent,
  };
}

async function cleanupFixture() {
  if (!testUser) return;

  await Promise.allSettled(
    cookies.map((cookie) =>
      fetch(`${origin}/api/logout`, {
        method: "POST",
        headers: { cookie },
        signal: AbortSignal.timeout(requestTimeoutMs),
      }),
    ),
  );

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        DELETE FROM sessions
        WHERE sess #>> '{passport,user,id}' = ${testUser!.id}
      `);
      const deleted = await tx.execute(sql`
        DELETE FROM users
        WHERE id = ${testUser!.id} AND email = ${testUser!.email}
      `);
      const rowsDeleted = Number((deleted as any).rowCount ?? 0);
      if (rowsDeleted !== 1) {
        throw new Error(`Expected to remove one synthetic user; removed ${rowsDeleted}.`);
      }
    });
  } catch {
    cleanupFailed = true;
    console.error("Synthetic user cleanup did not complete; inspect only the development database before rerunning.");
  }
}

async function main() {
  const user = await storage.createUser({
    email,
    password: await hashPassword(password),
    role: "BROKER",
    firstName: "Load",
    lastName: "Test",
  });
  testUser = { id: user.id, email };

  for (let offset = 0; offset < 100; offset += loginBatchSize) {
    const batchSize = Math.min(loginBatchSize, 100 - offset);
    const batch = await Promise.allSettled(
      Array.from({ length: batchSize }, () => createSession()),
    );
    const failed = batch.filter((result) => result.status === "rejected").length;
    if (failed > 0) throw new Error(`Could not establish ${failed} development sessions.`);
  }

  if (cookies.length !== 100 || new Set(cookies).size !== 100) {
    throw new Error("Expected 100 distinct development session cookies.");
  }

  const warmup = await fetchJson("/api/sessions/info", cookies[0]);
  if (!warmup.response.ok) throw new Error(`Authenticated warm-up failed with HTTP ${warmup.response.status}.`);

  const results = [];
  for (const concurrency of concurrencyStages) {
    results.push(await runWave(concurrency, `ramp-${concurrency}`));
  }
  for (let repeat = 1; repeat <= additionalHundredUserWaves; repeat++) {
    results.push(await runWave(100, `sustain-100-${repeat}`));
  }

  const failedResponses = results.reduce(
    (sum, wave) => sum + wave.requests - Number(wave.statusCounts["200"] || 0),
    0,
  );
  const hundredUserWaves = results.filter((wave) => wave.concurrency === 100);
  const allHundredRequests = hundredUserWaves.flatMap((wave) => [wave.latencyMs.p95]);
  const passed =
    failedResponses === 0 &&
    Math.max(0, ...allHundredRequests) <= 2000 &&
    hundredUserWaves.every((wave) => wave.mainPoolWaitingPeak === 0);

  console.log(JSON.stringify({
    environment: "development",
    authenticatedRoute: "/api/sessions/info",
    businessDataRead: false,
    users: 100,
    waves: results,
    passed,
    passCriteria: "All requests return HTTP 200, each 100-user wave p95 <= 2000ms, and no observed main-pool wait queue.",
  }, null, 2));
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} finally {
  await cleanupFixture();
  await pool.end().catch(() => undefined);
  if (cleanupFailed) process.exitCode = 1;
}