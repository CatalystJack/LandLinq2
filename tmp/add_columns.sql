-- Add all missing columns to site_plans table
ALTER TABLE site_plans ADD COLUMN unit_mix jsonb;
ALTER TABLE site_plans ADD COLUMN average_unit_size decimal(8,2);
ALTER TABLE site_plans ADD COLUMN estimated_construction_cost decimal(12,2);
ALTER TABLE site_plans ADD COLUMN estimated_sales_price decimal(12,2);