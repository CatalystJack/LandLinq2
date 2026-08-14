-- ============================================================================
-- FIX MISSING CITIES: Extract from malformed addresses and populate city column
-- ============================================================================
-- Run this in your PRODUCTION database console
--
-- This script:
-- 1. Extracts cities from addresses like "8760 E. FRANKLIN ST., Mount Pleasant, NC 28124"
-- 2. Populates the city column
-- 3. Cleans the address field to contain only the street portion
-- ============================================================================

BEGIN;

-- STEP 1: Extract cities from addresses with pattern "street, City, State ZIP"
-- Example: "8760 E. FRANKLIN ST., Mount Pleasant, NC 28124, Mount Pleasant, NC 28124"
UPDATE deals
SET 
  city = TRIM((REGEXP_MATCHES(address, ',\s*([A-Za-z\s]+),\s*[A-Z]{2}\s+\d{5}'))[1]),
  address = TRIM(SPLIT_PART(address, ',', 1)),
  updated_at = NOW()
WHERE 
  city IS NULL
  AND address ~ ',\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}';

-- STEP 2: Extract cities from simpler pattern "street, City State ZIP" (no comma before state)
-- Example: "202 Raleigh St Angier NC 28366" stored as "202 Raleigh St, Angier NC 28366"
UPDATE deals
SET
  city = TRIM((REGEXP_MATCHES(address, ',\s*([A-Za-z\s]+)\s+[A-Z]{2}\s+\d{5}'))[1]),
  address = TRIM(SPLIT_PART(address, ',', 1)),
  updated_at = NOW()
WHERE
  city IS NULL
  AND address ~ ',\s*[A-Za-z\s]+\s+[A-Z]{2}\s+\d{5}';

-- STEP 3: Remove any remaining duplicate state/ZIP patterns from address field
UPDATE deals
SET 
  address = REGEXP_REPLACE(address, ',\s*[A-Z]{2}\s+\d{5}.*$', ''),
  updated_at = NOW()
WHERE 
  address ~ ',\s*[A-Z]{2}\s+\d{5}';

-- STEP 4: Verify the results before committing
SELECT 
  deal_number,
  address AS street_only,
  city,
  state,
  zip,
  CASE 
    WHEN address ~ ',' THEN '⚠️ Still has comma'
    WHEN city IS NULL THEN '⚠️ City missing'
    ELSE '✅ OK'
  END AS status
FROM deals
ORDER BY deal_number DESC
LIMIT 20;

-- If everything looks good, run COMMIT
-- If something is wrong, run ROLLBACK instead
COMMIT;
