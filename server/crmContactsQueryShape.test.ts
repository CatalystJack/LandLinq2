import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, pool } from "./db";
import { getDeveloperCrmContacts } from "./developerCrmContacts";
import { getInternalCrmContacts } from "./internalCrmContacts";

const dialect = new PgDialect();

type CapturedQuery = {
  sql: string;
  params: unknown[];
};

async function withCapturedQueries<T>(
  run: (queries: CapturedQuery[]) => Promise<T>,
) {
  const queries: CapturedQuery[] = [];
  const originalExecute = db.execute;

  (db as any).execute = async (statement: SQL) => {
    const query = dialect.sqlToQuery(statement);
    queries.push({ sql: query.sql, params: query.params });

    if (/SELECT COUNT\(\*\)::int AS total FROM/i.test(query.sql)) {
      return { rows: [{ total: 53 }] };
    }

    return {
      rows: [
        {
          id: "mock-contact",
          first_name: "Test",
          last_name: "Contact",
          crm_tags: [],
          source_tags: [],
        },
      ],
    };
  };

  try {
    return await run(queries);
  } finally {
    (db as any).execute = originalExecute;
  }
}

function assertBoundedPageQuery(
  query: CapturedQuery,
  expectedLimit: number,
  expectedOffset: number,
) {
  const pagination = query.sql.match(/LIMIT \$(\d+) OFFSET \$(\d+)/i);
  assert.ok(pagination, "SQL applies LIMIT and OFFSET");
  assert.equal(query.params[Number(pagination[1]) - 1], expectedLimit);
  assert.equal(query.params[Number(pagination[2]) - 1], expectedOffset);
  assert.doesNotMatch(query.sql, /\b(INSERT|UPDATE|DELETE)\b/i);
}

after(async () => {
  await pool.end();
});

test("global CRM list filters in SQL before returning a bounded contact page", async () => {
  await withCapturedQueries(async (queries) => {
    const result = await getInternalCrmContacts({
      page: 3,
      limit: 17,
      search: "broker search",
      tag: "priority",
      tagFilters: ["active", "review"],
      sourceTagFilter: "licensed",
      crmStateFilter: "nc",
      stateFilter: "",
      msaFilter: "",
      countyFilter: "",
      market: "Triangle",
      smsFilter: "opted_in",
      assignedToFilter: "Alex",
      brokerageFilter: "Example Realty",
      multiCampaignTagFilter: false,
      contactCategoryFilter: "broker",
      includeFilterOptions: false,
      filterOptionsOnly: false,
    });

    assert.equal(queries.length, 2, "only the count and bounded page queries run");
    const countQuery = queries.find((query) => /SELECT COUNT\(\*\)::int AS total FROM filtered_contacts/i.test(query.sql));
    const pageQuery = queries.find((query) => /page_contacts AS\s*\(/i.test(query.sql));
    assert.ok(countQuery);
    assert.ok(pageQuery);

    assert.match(countQuery.sql, /filtered_contacts AS\s*\(\s*SELECT f\.\* FROM all_contacts AS f WHERE/i);
    assert.match(pageQuery.sql, /filtered_contacts AS\s*\(\s*SELECT f\.\* FROM all_contacts AS f WHERE/i);
    assert.match(pageQuery.sql, /page_contacts AS\s*\(\s*SELECT f\.\*\s+FROM filtered_contacts AS f\s+ORDER BY f\.created_at DESC NULLS LAST, f\.id DESC\s+LIMIT \$\d+ OFFSET \$\d+/i);
    for (const column of [
      "first_name",
      "email",
      "crm_tags",
      "source_tags",
      "state_region",
      "markets_covered",
      "sms_opt_in",
      "assigned_to",
      "brokerage",
      "contact_category",
    ]) {
      assert.ok(pageQuery.sql.includes(column), `SQL applies the ${column} filter`);
    }
    for (const value of [
      "%broker search%",
      "priority",
      "active",
      "review",
      "licensed",
      "nc",
      "%Triangle%",
      "Alex",
      "Example Realty",
      "broker",
      17,
      34,
    ]) {
      assert.ok(pageQuery.params.includes(value), `SQL binds ${String(value)}`);
    }
    assertBoundedPageQuery(pageQuery, 17, 34);

    assert.deepEqual(result.contacts.map((contact) => contact.id), ["mock-contact"]);
    assert.deepEqual(result.pagination, {
      page: 3,
      limit: 17,
      total: 53,
      totalPages: 4,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });
});

test("developer CRM list keeps tenant visibility and filters in SQL before a bounded page", async () => {
  await withCapturedQueries(async (queries) => {
    const result = await getDeveloperCrmContacts({
      developerProfileId: "profile-a",
      visibility: {
        sectors: ["commercial"],
        states: ["NC"],
        counties: ["Wake"],
        sourceTags: ["licensed"],
        allowSharedDirectory: true,
      },
      page: 2,
      limit: 25,
      search: "broker search",
      tag: "priority",
      tagFilters: ["active", "review"],
      sourceTagFilter: "licensed",
      crmStateFilter: "nc",
      stateFilter: "",
      msaFilter: "",
      countyFilter: "",
      market: "Triangle",
      smsFilter: "opted_in",
      assignedToFilter: "Alex",
      brokerageFilter: "Example Realty",
      multiCampaignTagFilter: false,
      contactCategoryFilter: "broker",
      includeFilterOptions: false,
      includeContactEnrichment: false,
    });

    assert.equal(queries.length, 2, "only the count and bounded page queries run");
    const countQuery = queries.find((query) => /SELECT COUNT\(\*\)::int AS total FROM filtered_brokers/i.test(query.sql));
    const pageQuery = queries.find((query) => /FROM filtered_brokers AS f/i.test(query.sql));
    assert.ok(countQuery);
    assert.ok(pageQuery);

    assert.match(countQuery.sql, /accessible_brokers AS\s*\(/i);
    assert.match(countQuery.sql, /filtered_brokers AS\s*\(\s*SELECT f\.\*\s+FROM accessible_brokers AS f WHERE/i);
    assert.match(pageQuery.sql, /accessible_brokers AS\s*\(/i);
    assert.match(pageQuery.sql, /LEFT JOIN developer_broker_crm/i);
    assert.match(pageQuery.sql, /developer_broker_crm\.developer_profile_id = \$\d+/i);
    assert.match(pageQuery.sql, /brokers\.owner_developer_profile_id = \$\d+/i);
    assert.match(pageQuery.sql, /brokers\.owner_developer_profile_id IS NULL/i);
    assert.match(pageQuery.sql, /brokers\.user_id IS DISTINCT FROM \$\d+/i);
    assert.match(pageQuery.sql, /developer_broker_crm\.is_removed = false/i);
    assert.match(pageQuery.sql, /filtered_brokers AS\s*\(\s*SELECT f\.\*\s+FROM accessible_brokers AS f WHERE/i);
    assert.match(pageQuery.sql, /FROM filtered_brokers AS f\s+ORDER BY f\.created_at DESC NULLS LAST, f\.id DESC\s+LIMIT \$\d+ OFFSET \$\d+/i);
    for (const column of [
      "contact_sector",
      "state_region",
      "contact_county",
      "source_tags",
      "first_name",
      "email",
      "crm_tags",
      "markets_covered",
      "sms_opt_in",
      "assigned_to",
      "brokerage",
      "contact_category",
    ]) {
      assert.ok(pageQuery.sql.includes(column), `SQL applies the ${column} visibility/filter condition`);
    }
    for (const value of [
      "profile-a",
      "commercial",
      "NC",
      "wake",
      "licensed",
      "20974d7b-e103-4fc7-b42f-7a13d41041fb",
      "broker search",
      "priority",
      "active",
      "review",
      "NC",
      "Triangle",
      "Alex",
      "Example Realty",
      "broker",
      25,
    ]) {
      assert.ok(pageQuery.params.includes(value), `SQL binds ${String(value)}`);
    }
    assertBoundedPageQuery(pageQuery, 25, 25);

    assert.deepEqual(result.contacts.map((contact) => contact.id), ["mock-contact"]);
    assert.deepEqual(result.pagination, {
      page: 2,
      limit: 25,
      total: 53,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });
});