ALTER TABLE "developer_profiles"
  ADD COLUMN IF NOT EXISTS "min_cap_rate" numeric(6, 3),
  ADD COLUMN IF NOT EXISTS "max_cap_rate" numeric(6, 3),
  ADD COLUMN IF NOT EXISTS "min_price" numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "max_price" numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "min_unit_count" integer,
  ADD COLUMN IF NOT EXISTS "max_unit_count" integer,
  ADD COLUMN IF NOT EXISTS "min_year_built" integer,
  ADD COLUMN IF NOT EXISTS "max_year_built" integer;
