---
name: Admin CRM cleanup scope
description: Data-preservation boundaries for clearing one company's CRM.
---

An admin clear should soft-remove all contacts currently visible to the selected profile, including shared directory contacts without an existing private CRM row. Clear legacy CRM fields only on broker records owned by that profile. Do not delete shared broker identities, deal records, another profile's CRM state, or email-suppression records. Future shared-directory entries should continue to follow the profile's visibility rules.

**Why:** Admins need to remove incorrect company CRM entries without damaging the shared broker network or records used by other companies.

**How to apply:** Bind reads and cleanup to one validated developer profile ID, perform the changes transactionally, and use the profile-scoped removal state rather than deleting broker rows.