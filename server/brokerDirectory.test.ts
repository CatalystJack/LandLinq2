import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildBrokerDirectoryCursorCondition,
  buildBrokerDirectorySearchCondition,
  buildBrokerDirectoryVisibilityCondition,
  decodeBrokerDirectoryCursor,
  encodeBrokerDirectoryCursor,
  parseBrokerDirectoryLimit,
} from "./brokerDirectory";

const dialect = new PgDialect();

test("broker directory cursors round-trip and reject malformed input", () => {
  const cursor = { createdAt: "2026-09-28T12:34:56.123456", id: "broker-123" };
  const encoded = encodeBrokerDirectoryCursor(cursor);
  const decoded = decodeBrokerDirectoryCursor(encoded);

  assert.ok(decoded);
  assert.equal(decoded.id, cursor.id);
  assert.equal(decoded.createdAt, cursor.createdAt);
  assert.equal(decodeBrokerDirectoryCursor("not-a-cursor"), null);
  assert.equal(decodeBrokerDirectoryCursor(""), null);
});

test("broker directory page limits are bounded", () => {
  assert.equal(parseBrokerDirectoryLimit(undefined), 50);
  assert.equal(parseBrokerDirectoryLimit("25"), 25);
  assert.equal(parseBrokerDirectoryLimit("500"), 100);
  assert.equal(parseBrokerDirectoryLimit("-2"), 1);
});

test("keyset cursor conditions keep both timestamp and id tie-breakers", () => {
  const compiled = dialect.sqlToQuery(buildBrokerDirectoryCursorCondition({
    createdAt: "2026-09-28T12:34:56.123456",
    id: "broker-123",
  }));

  assert.match(compiled.sql, /created_at/);
  assert.match(compiled.sql, /id/);
  assert.ok(compiled.params.includes("broker-123"));
  assert.ok(compiled.params.includes("2026-09-28T12:34:56.123456"));
  assert.match(compiled.sql, /is null/i);

  const nullTimestampCursor = dialect.sqlToQuery(buildBrokerDirectoryCursorCondition({
    createdAt: null,
    id: "broker-null",
  }));
  assert.match(nullTimestampCursor.sql, /created_at" is null/i);
  assert.ok(nullTimestampCursor.params.includes("broker-null"));
});

test("broker search stays in SQL and covers directory fields while excluding requested IDs", () => {
  const condition = buildBrokerDirectorySearchCondition("Amy_ 100%", "exclude-me");
  assert.ok(condition);
  const compiled = dialect.sqlToQuery(condition);

  assert.match(compiled.sql, /first_name/);
  assert.match(compiled.sql, /email/);
  assert.match(compiled.sql, /phone/);
  assert.match(compiled.sql, /brokerage/);
  assert.match(compiled.sql, /markets_covered/);
  assert.ok(compiled.params.includes("%Amy\\_ 100\\%%"));
  assert.ok(compiled.params.includes("exclude-me"));
});

test("developer directory SQL binds owner isolation and all shared visibility filters", () => {
  const condition = buildBrokerDirectoryVisibilityCondition("profile-a", {
    sectors: ["commercial"],
    states: ["NC"],
    counties: ["wake"],
    sourceTags: ["nc-license"],
    allowSharedDirectory: true,
  });
  const compiled = dialect.sqlToQuery(condition);

  assert.match(compiled.sql, /owner_developer_profile_id/);
  assert.match(compiled.sql, /contact_sector/);
  assert.match(compiled.sql, /state_region/);
  assert.match(compiled.sql, /contact_county/);
  assert.match(compiled.sql, /source_tags/);
  assert.ok(compiled.params.includes("profile-a"));
  assert.ok(compiled.params.includes("commercial"));
  assert.ok(compiled.params.includes("NC"));
  assert.ok(compiled.params.includes("wake"));
  assert.ok(compiled.params.includes("nc-license"));
  assert.ok(compiled.params.includes("20974d7b-e103-4fc7-b42f-7a13d41041fb"));
});

test("disabled shared directory visibility still returns only profile-owned contacts", () => {
  const compiled = dialect.sqlToQuery(buildBrokerDirectoryVisibilityCondition("profile-private", {
    sectors: [],
    states: [],
    counties: [],
    sourceTags: [],
    allowSharedDirectory: false,
  }));

  assert.match(compiled.sql, /owner_developer_profile_id/);
  assert.ok(compiled.params.includes("profile-private"));
  assert.equal(compiled.sql.includes("source_tags"), false);
});