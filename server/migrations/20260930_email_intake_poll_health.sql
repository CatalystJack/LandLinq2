CREATE TABLE IF NOT EXISTS email_intake_poll_health (
  singleton_key varchar(64) PRIMARY KEY,
  monitoring_started_at timestamp NOT NULL DEFAULT now(),
  last_attempt_at timestamp,
  last_successful_poll_at timestamp,
  failure_category varchar CHECK (
    failure_category IS NULL OR failure_category IN (
      'authentication',
      'connection',
      'mailbox_access',
      'message_processing',
      'unknown',
      'automation_disabled'
    )
  ),
  alert_incident_id varchar,
  alert_raised_at timestamp,
  alert_claimed boolean NOT NULL DEFAULT false,
  alert_sent_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);