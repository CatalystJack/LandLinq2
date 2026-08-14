-- Add geocoding accuracy tracking fields to deals table
-- Run this in production after deploying schema changes

ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS manual_latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS manual_longitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS manual_coords_set_by VARCHAR,
ADD COLUMN IF NOT EXISTS manual_coords_set_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS manual_coords_reason TEXT,
ADD COLUMN IF NOT EXISTS geocoding_accuracy_type VARCHAR,
ADD COLUMN IF NOT EXISTS geocoding_accuracy_score DECIMAL(3, 2);

-- Add foreign key constraint for manual_coords_set_by
ALTER TABLE deals 
ADD CONSTRAINT deals_manual_coords_set_by_fkey 
FOREIGN KEY (manual_coords_set_by) REFERENCES users(id);

-- Create geocoding audit log table
CREATE TABLE IF NOT EXISTS geocoding_audit_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id VARCHAR REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Request details
  requested_address TEXT NOT NULL,
  service VARCHAR NOT NULL,
  
  -- Result details
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Geocoding quality metrics
  accuracy_type VARCHAR,
  accuracy_score DECIMAL(3, 2),
  
  -- Result coordinates
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Parsed address components
  city VARCHAR,
  state VARCHAR,
  zip_code VARCHAR,
  county VARCHAR,
  formatted_address TEXT,
  
  -- Validation results
  city_mismatch BOOLEAN DEFAULT FALSE,
  state_mismatch BOOLEAN DEFAULT FALSE,
  rejected_low_accuracy BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for geocoding audit log
CREATE INDEX IF NOT EXISTS idx_geocoding_deal_id ON geocoding_audit_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_geocoding_service ON geocoding_audit_log(service);
CREATE INDEX IF NOT EXISTS idx_geocoding_accuracy ON geocoding_audit_log(accuracy_score);
CREATE INDEX IF NOT EXISTS idx_geocoding_created ON geocoding_audit_log(created_at);

-- Comment
COMMENT ON TABLE geocoding_audit_log IS 'Tracks all geocoding attempts for accuracy monitoring and debugging';
COMMENT ON COLUMN deals.manual_latitude IS 'Admin-corrected latitude (overrides geocoded value for incorrect pins)';
COMMENT ON COLUMN deals.manual_longitude IS 'Admin-corrected longitude (overrides geocoded value for incorrect pins)';
COMMENT ON COLUMN deals.geocoding_accuracy_type IS 'Geocodio accuracy type: rooftop, street, range, zip, city, etc.';
COMMENT ON COLUMN deals.geocoding_accuracy_score IS 'Geocodio confidence score (0.0-1.0) - higher is more accurate';
