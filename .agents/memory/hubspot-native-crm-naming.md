---
name: HubSpot-named columns power the internal CRM-native scheduler
description: hubspot_trigger_tag / hubspot_owner_id / hubspot_trigger_tags columns are actively used by the internal CRM tagging system, not legacy HubSpot integration debris.
---

The outreach scheduler (`server/jobs/recurringOutreach.ts`, `processCrmTaggedContacts`) and related tables (`outreach_senders`, `outreach_campaign_templates`, `brokers.crm_tags`) still use column names like `hubspot_trigger_tag`, `hubspot_trigger_tags`, and `hubspot_owner_id`. These names are legacy but the columns are load-bearing: tags determine WHAT campaign content is sent, owner ID determines WHO sends it, and this is the actively-used production scheduler — it no longer calls the HubSpot API.

**Why:** When removing the real HubSpot integration (API client, webhooks, service file), it's tempting to also rename/drop anything with "hubspot" in the name. Doing so would break the working CRM-native scheduler for a cosmetic naming fix.

**How to apply:** When cleaning up HubSpot integration code, only remove actual HubSpot API usage (service classes, webhook routes, external API calls). Leave `hubspot_*`-named columns, functions, and their SQL untouched unless the user explicitly asks for a full rename/migration of that schema.
