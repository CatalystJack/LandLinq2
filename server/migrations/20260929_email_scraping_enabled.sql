-- Platform-wide automatic email-to-deal intake switch. Existing installations
-- remain disabled until an analyst deliberately enables the feature.
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS email_scraping_enabled BOOLEAN NOT NULL DEFAULT FALSE;