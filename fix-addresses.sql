-- SQL Script to Fix Malformed Addresses in Production
-- Run this directly in your production database console

-- Fix addresses with duplicated "NC [ZIP], NC [ZIP]" pattern
-- Example: "8500 FLOWE, NC 28025, NC 28025" → "8500 FLOWE"
UPDATE deals
SET 
  address = REGEXP_REPLACE(address, ',\s*NC\s+\d{5},\s*NC\s+\d{5}$', ''),
  updated_at = NOW()
WHERE address ~ ',\s*NC\s+\d{5},\s*NC\s+\d{5}$';

-- Fix addresses with duplicated city pattern
-- Example: "8760 E. FRANKLIN ST., MT. PLEASANT, NC, Mount Pleasant, NC 28124, Mount Pleasant, NC 28124"
UPDATE deals
SET
  address = REGEXP_REPLACE(
    REGEXP_REPLACE(address, ',\s*[A-Z][a-z\s]+,\s*NC\s+\d{5},\s*[A-Z][a-z\s]+,\s*NC\s+\d{5}$', ''),
    ',\s*[A-Z][a-z\s]+,\s*NC\s+\d{5}$',
    ''
  ),
  city = CASE 
    WHEN address ~ ',\s*([A-Z][a-z\s]+),\s*NC\s+\d{5}' 
    THEN (REGEXP_MATCHES(address, ',\s*([A-Z][a-z\s]+),\s*NC\s+\d{5}'))[1]
    ELSE city
  END,
  updated_at = NOW()
WHERE address ~ ',\s*[A-Z][a-z\s]+,\s*NC\s+\d{5}';

-- Show results
SELECT 
  deal_number,
  address,
  city,
  state,
  zip
FROM deals
WHERE deal_number IN (534, 505, 496, 495, 494, 537)
ORDER BY deal_number DESC;
