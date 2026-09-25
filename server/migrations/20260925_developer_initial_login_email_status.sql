CREATE TABLE IF NOT EXISTS developer_initial_login_email_status (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  developer_profile_id varchar NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  invitation_subject text NOT NULL,
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'bounced', 'failed')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  bounced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS developer_initial_login_email_status_recipient_idx
  ON developer_initial_login_email_status (LOWER(recipient_email), attempted_at DESC);