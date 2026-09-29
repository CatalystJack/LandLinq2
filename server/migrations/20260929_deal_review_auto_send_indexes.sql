CREATE INDEX IF NOT EXISTS idx_deals_flagged
  ON deals (flagged);

CREATE INDEX IF NOT EXISTS partner_developer_sends_deal_id_idx
  ON partner_developer_sends (deal_id);

CREATE INDEX IF NOT EXISTS partner_developer_sends_developer_id_idx
  ON partner_developer_sends (developer_id);