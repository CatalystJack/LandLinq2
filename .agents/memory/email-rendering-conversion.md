---
name: Shared transactional email rendering
description: Transactional email HTML is rendered through one inline, table-based LandLinq shell before Microsoft Graph delivery.
---

All outbound transactional email should use the shared branded renderer and pass rendered subject/body content to `sendNotificationEmail`; use Microsoft Graph for configured internal mailboxes and authenticated mailbox SMTP for the public LandLinq mailbox. SendGrid is not an application transport.

**Why:** Microsoft Graph and mailbox SMTP need final HTML, and a single inline shell keeps Outlook/Gmail branding consistent while avoiding dynamic-template substitutions and marketing footers on transactional messages. The project intentionally does not use SendGrid.

**How to apply:** New transactional messages should use the shared wrapper, set `transactional: true`, and default to `help@landlinq.ai`. Do not add unsubscribe links to account setup, password reset, or contact-inquiry messages.