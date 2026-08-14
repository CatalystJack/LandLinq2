-- Fix SMS opt-in for broker on deal #666
-- Run this against the PRODUCTION database (landlinq.ai)

-- Step 1: Find the broker for deal #666
SELECT 
  b.id as broker_id,
  b.first_name,
  b.last_name,
  b.phone,
  b.sms_opt_in,
  d.deal_number,
  d.address
FROM brokers b
JOIN deals d ON d.broker_id = b.id
WHERE d.deal_number = 666;

-- Step 2: Enable SMS opt-in for this broker (uncomment and run after verifying above)
-- UPDATE brokers
-- SET sms_opt_in = true
-- WHERE id = (
--   SELECT broker_id FROM deals WHERE deal_number = 666
-- );

-- Step 3: Verify the update (uncomment and run after step 2)
-- SELECT 
--   b.id,
--   b.first_name,
--   b.last_name,
--   b.phone,
--   b.sms_opt_in,
--   d.deal_number
-- FROM brokers b
-- JOIN deals d ON d.broker_id = b.id
-- WHERE d.deal_number = 666;
