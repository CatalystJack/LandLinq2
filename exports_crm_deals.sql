-- CRM & Deals Export
-- Generated: 2026-08-07T17:58:48.191Z
-- Source: LandLinq / Catalyst CP Live Database
-- =====================================================

-- ─────────────────────────────────────────────
-- BROKERS (CRM Contacts) — 17 records
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brokers_import (
  id TEXT PRIMARY KEY,
  first_name TEXT, last_name TEXT, email TEXT, phone TEXT,
  brokerage TEXT, company TEXT, markets_covered TEXT, state_region TEXT,
  years_experience INTEGER, license_number TEXT,
  is_active BOOLEAN, is_archived BOOLEAN, sms_opt_in BOOLEAN,
  preferred_contact TEXT, crm_tags TEXT[], crm_notes TEXT,
  assigned_to TEXT, last_contacted_at TIMESTAMPTZ,
  website_url TEXT, bio TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);

INSERT INTO brokers_import VALUES ('93354f0a-a7c9-4296-8877-abd519cbe7a0'::text, 'Apex'::text, 'Tester'::text, 'apextest_1783361046514@catalystcp.com'::text, '+15551234568'::text, NULL, NULL, '["Charlotte"]'::text, NULL, NULL, NULL, TRUE, FALSE, FALSE, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2026-07-06T18:04:06.570Z'::text, '2026-07-06T18:04:06.570Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('31fdb0ce-6d5d-4409-923a-97cf35f055e1'::text, 'Apex'::text, 'Tester'::text, 'apextest_1783361027143@example.com'::text, '+15551234567'::text, NULL, NULL, '["Charlotte"]'::text, NULL, NULL, NULL, TRUE, FALSE, FALSE, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2026-07-06T18:03:47.420Z'::text, '2026-07-06T18:03:47.420Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('63d1d587-3666-4b0b-9e47-3d5ccda0d980'::text, 'John'::text, 'Bell'::text, 'john@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('ce252ad1-fc9c-4ec9-b4dc-ad4def0e05fa'::text, 'Brian'::text, ''::text, 'ford@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('6df477aa-9915-4805-b32e-f9a666d6a944'::text, 'Jim'::text, 'Hillim'::text, 'jim@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('37774fcc-ec4c-4bb1-9349-37d887c0d87d'::text, 'Erich'::text, 'Mahle'::text, 'erich@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('5441e81e-2ceb-472a-8595-c7503bd51140'::text, 'AJ'::text, ''::text, 'aj@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('d233c94f-a483-4667-b913-82aefc8cd737'::text, 'Nic'::text, 'Monroe'::text, 'nic@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('03f62478-e5b2-4435-a597-896e51ced7e6'::text, 'Mike'::text, 'Nichols'::text, 'mike@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('a159bef9-56ff-418f-be60-4848604c993e'::text, 'Mallie'::text, ''::text, 'mallie@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('20fd9779-55f0-4114-9fd8-cbe26ae0ab88'::text, 'Steve'::text, ''::text, 'steve@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('6f8ef566-b9aa-4dcb-b3ac-01e397346a7b'::text, 'Austin'::text, ''::text, 'austin@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('b0d49c65-d12f-4932-bdd4-c33dd7acc2e1'::text, 'Ted'::text, 'Hill'::text, 'ted@catalystcp.com'::text, NULL, NULL, 'Catalyst Capital Partners'::text, NULL, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-12-15T18:59:46.755Z'::text, '2025-12-15T18:59:46.755Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('be640226-15a5-4fc5-b7b9-6e83cba05182'::text, 'SMSTest'::text, 'JA3vkb'::text, 'smstestoomnxm@example.com'::text, '+1704682'::text, NULL, NULL, '["Atlanta","Nashville","Charlotte"]'::text, NULL, NULL, NULL, TRUE, FALSE, TRUE, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-11-19T15:30:22.630Z'::text, '2025-11-19T15:30:22.630Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('a44b2724-78b0-48f6-b1d6-bd8eb3711ab6'::text, 'TestBroker'::text, 'Bkrl_uHAq'::text, 'testbrokerl_uhaq@example.com'::text, '+170489'::text, NULL, NULL, '["Dallas","Austin","Houston"]'::text, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-11-19T15:25:13.242Z'::text, '2025-11-19T15:25:13.242Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('bb586e43-1c65-461a-aa64-b0bc3d1ae768'::text, 'Jacob'::text, 'Berg'::text, 'jackbergcjr@gmail.com'::text, '7034744399'::text, ''::text, NULL, NULL, NULL, ''::text, NULL, TRUE, FALSE, TRUE, 'email'::text, 'NULL'::text, NULL, NULL, NULL, NULL, NULL, '2025-09-04T18:15:51.015Z'::text, '2025-09-04T18:15:51.015Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO brokers_import VALUES ('c3351faf-5dfb-4bd1-b374-ffa6533e90f9'::text, 'Jack'::text, 'Team'::text, 'jack@catalystcp.com'::text, ''::text, NULL, NULL, '["Not specified"]'::text, NULL, NULL, NULL, TRUE, FALSE, NULL, 'email'::text, '''{Developer Network}'''::text, NULL, NULL, NULL, NULL, NULL, '2025-09-03T19:34:15.634Z'::text, '2026-04-10T15:43:55.748Z'::text) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- DEALS — 2 records
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals_import (
  id TEXT PRIMARY KEY,
  deal_number TEXT, status TEXT, classification TEXT, priority TEXT,
  address TEXT, city TEXT, state TEXT, zip TEXT, county TEXT,
  asking_price NUMERIC, size_acres NUMERIC, unit_count INTEGER,
  yield_on_cost TEXT, qct_status TEXT, dda_status TEXT, oz_status TEXT,
  lihtc_score_total INTEGER, product_types JSONB,
  analyst_notes TEXT, rejection_reason TEXT, deal_step TEXT,
  assigned_analyst TEXT, submission_method TEXT,
  broker_id TEXT, broker_name TEXT, broker_email TEXT, brokerage TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);

INSERT INTO deals_import VALUES ('4ee5e5a7-1345-4afe-9cbf-782232fcc3a8'::text, 67, 'pending_review'::text, 'unclassified'::text, 'medium'::text, '123 Test Street'::text, 'Austin'::text, 'TX'::text, '78701'::text, 'Travis'::text, NULL, NULL, NULL, NULL, 'NO'::text, 'MDDA'::text, 'NO'::text, 19, '["aa-4-story-flats","4-story-surface-park"]'::jsonb, NULL, NULL, NULL, 'Austin Blondell'::text, 'web'::text, 'a44b2724-78b0-48f6-b1d6-bd8eb3711ab6'::text, 'TestBroker Bkrl_uHAq'::text, 'testbrokerl_uhaq@example.com'::text, NULL, '2026-01-07T20:47:07.991Z'::text, '2026-07-06T18:07:52.437Z'::text) ON CONFLICT (id) DO NOTHING;
INSERT INTO deals_import VALUES ('322e6865-7195-4a01-8035-c473a7e9d7e8'::text, 66, 'pending_review'::text, 'unclassified'::text, 'medium'::text, '4111 Johnson Street'::text, 'HIGH POINT'::text, 'NC'::text, '27265'::text, 'Guilford'::text, NULL, '5.00'::text, 200, NULL, 'NO'::text, 'NO'::text, 'NO'::text, 13, '[]'::jsonb, ''::text, NULL, NULL, 'Austin Blondell'::text, 'analyst_quick_add'::text, 'bb586e43-1c65-461a-aa64-b0bc3d1ae768'::text, 'Jacob Berg'::text, 'jackbergcjr@gmail.com'::text, ''::text, '2026-01-07T20:46:54.969Z'::text, '2026-04-27T15:59:49.166Z'::text) ON CONFLICT (id) DO NOTHING;
