---
name: Developer notification sender boundary
description: Investment Company outreach and broker deal-status notifications use the same company sender when a routed Outlook connection is active.
---

For a deal routed to an Investment Company, broker deal-status notifications, confirmations, and classification updates use that company's latest active Outlook-connected sender. If no usable company sender is available, the platform transactional mailbox is the explicit fallback.

**Why:** The user confirmed that brokers should see the same company-owned mailbox used for outreach, while disconnected or unrouted deals still need a deterministic transactional fallback.

**How to apply:** Resolve the sender through the deal's `partner_developer_sends` company route and `outreach_senders` row, use delegated Graph `/me/sendMail` with locally rendered branded HTML, and expose the effective From address in the company settings UI. Never expose tokens to the client or send a real test without an approved recipient.