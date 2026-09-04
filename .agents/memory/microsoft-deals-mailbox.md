---
name: Microsoft deals mailbox
description: The app-only Graph tenant currently rejects the intended intake mailbox identity.
---

Keep automatic Graph email intake disabled until `deals@landlinq.ai` exists as a readable mailbox in the configured Microsoft 365 tenant, or Microsoft provides the correct underlying mailbox identity for that address.

**Why:** A live app-only Graph request to `/users/deals@landlinq.ai/messages` returned `ErrorInvalidUser`; retries cannot process mail and only create recurring scheduler errors.

**How to apply:** After the mailbox is provisioned or its real user principal name is known, update the mailbox identifier if needed, enable the shared email automation switch, and verify one forwarded deal end to end before publishing.