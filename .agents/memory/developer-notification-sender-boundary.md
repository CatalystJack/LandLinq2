---
name: Developer notification sender boundary
description: Investment Company outreach and broker deal-status notifications use different sender ownership paths.
---

Investment Company connected Outlook accounts are scoped to outreach campaigns only; broker deal-status notifications, confirmations, and classification updates must not be assumed to use that sender unless the notification call explicitly supplies a tenant-owned mailbox.

**Why:** The current platform separates company-controlled campaign delivery from shared transactional delivery, and silently mixing them would misrepresent the sender identity shown to brokers.

**How to apply:** When adding or changing broker notifications, trace the event to its `fromEmail` and transport. Keep campaign sender resolution scoped through the developer profile and outreach sender record; keep transactional delivery on the approved shared mailbox unless tenant-specific transactional sending is intentionally designed.