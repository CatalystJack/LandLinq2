import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 25,
  ssl: { rejectUnauthorized: false }
});

let idleClientErrorCount = 0;

// pg-pool emits "error" when an idle client is disconnected (for example,
// during a database restart). Without a listener, EventEmitter treats that
// as an uncaught exception. The pool removes the broken client and can create
// a replacement for later requests; log only the PostgreSQL code, not details
// that might include query values or personal data.
pool.on("error", (error: Error & { code?: string }) => {
  idleClientErrorCount++;
  console.error("[DB-POOL] Idle PostgreSQL client disconnected", {
    code: error.code || "UNKNOWN",
  });
});

export function getMainDatabasePoolStats() {
  return {
    totalConnections: pool.totalCount,
    activeConnections: pool.totalCount - pool.idleCount,
    idleConnections: pool.idleCount,
    waitingCount: pool.waitingCount,
    idleClientErrors: idleClientErrorCount,
  };
}

export const db = drizzle(pool, { schema });