---
name: Buyer acquisition CSV privacy
description: How the owner/sponsor acquisition CSV may be used in company-profile drafting.
---

Treat the multi-company buyer CSV as a reference source, not a contact import. Let an admin choose one company row to draft at a time. Only buyer-profile and acquisition-criteria fields may be sent for drafting; exclude contact names, emails, phone numbers, do-not-call flags, and CRM property fields. Keep the draft review-and-save flow; do not create profiles automatically.

**Why:** The user asked to use the file as a reference without storing contact details and selected one-row-at-a-time drafting.

**How to apply:** Keep CSV parsing client-side and whitelist criteria columns before any external model request. Do not add contact fields to profile drafts or persistent storage.
