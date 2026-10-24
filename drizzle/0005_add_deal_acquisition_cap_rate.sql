ALTER TABLE "deals"
  ADD COLUMN IF NOT EXISTS "cap_rate" numeric(5, 3);
