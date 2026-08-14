-- Migration: Fix inbound email communications not being saved/linked to deals
-- Date: November 21, 2025
-- Issue: Unique CONSTRAINT on (related_deal_id, event_type) prevented multiple inbound emails per deal

-- Drop the old unique CONSTRAINT that blocks inbound messages
ALTER TABLE communications DROP CONSTRAINT IF EXISTS unique_deal_event;

-- Drop the index as well if it exists separately
DROP INDEX IF EXISTS unique_deal_event;

-- Create a PARTIAL unique index that ONLY applies to outbound messages
-- This prevents duplicate outbound notifications while allowing unlimited inbound messages per deal
CREATE UNIQUE INDEX IF NOT EXISTS unique_deal_event_outbound 
ON communications (related_deal_id, event_type) 
WHERE direction = 'outbound';
