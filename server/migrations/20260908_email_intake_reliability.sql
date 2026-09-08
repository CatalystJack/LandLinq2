ALTER TABLE email_intake_queue
  ADD COLUMN IF NOT EXISTS automation_processed_at timestamp;

CREATE INDEX IF NOT EXISTS email_intake_automation_processed_idx
  ON email_intake_queue (automation_processed_at);

CREATE TABLE IF NOT EXISTS email_intake_volume_alert_state (
  singleton_key varchar(64) PRIMARY KEY,
  alert_spike_id varchar,
  is_above_threshold boolean NOT NULL DEFAULT false,
  alert_claimed boolean NOT NULL DEFAULT false,
  alert_sent_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE email_intake_volume_alert_state
  ADD COLUMN IF NOT EXISTS alert_spike_id varchar;