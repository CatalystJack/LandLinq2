ALTER TABLE "developer_product_types"
  ADD COLUMN IF NOT EXISTS "rent_growth_pct" numeric,
  ADD COLUMN IF NOT EXISTS "other_income_growth_pct" numeric,
  ADD COLUMN IF NOT EXISTS "expense_growth_pct" numeric,
  ADD COLUMN IF NOT EXISTS "hold_period_years" integer,
  ADD COLUMN IF NOT EXISTS "exit_cap_rate_pct" numeric;

ALTER TABLE "deals"
  ADD COLUMN IF NOT EXISTS "automated_irr" text;
