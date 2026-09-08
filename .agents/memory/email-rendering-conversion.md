---
name: Shared transactional email rendering
description: Transactional email HTML is rendered through one inline, table-based LandLinq shell before Microsoft Graph delivery.
---

All outbound transactional email should use the shared branded renderer and pass rendered subject/body content to `sendNotificationEmail`; SendGrid is transport fallback only, never the source of template content.

**Why:** Microsoft Graph needs final HTML, and a single inline shell keeps Outlook/Gmail branding consistent while avoiding dynamic-template substitutions and marketing footers on transactional messages.

**How to apply:** New transactional messages should use the shared wrapper, set `transactional: true`, and default to `help@landlinq.ai`. Do not add unsubscribe links to account setup, password reset, or contact-inquiry messages.