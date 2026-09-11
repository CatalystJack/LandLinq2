---
name: Outreach sender tenant identity
description: Sender ownership and email uniqueness rules for legacy shared and developer-owned outreach.
---

Outreach sender identity is scoped by developer profile, not globally by email. A legacy shared sender with a NULL developer profile may coexist with a developer-owned sender for the same mailbox; a sender already owned by another developer profile remains a conflict.

**Why:** The same person can have a legacy internal sender record and a company-owned Outlook connection. Global email uniqueness blocked valid Investment Company OAuth setup, while reusing the shared row would cross tenant boundaries.

**How to apply:** Developer sender creation must first reuse the sender owned by the current profile, reject senders owned by another profile, and otherwise create a profile-owned row. Keep OAuth and campaign queries scoped through the developer profile and sender ID.