---
name: Platform admin identity policy
description: Standard platform-domain access versus named super-admin authority for irreversible actions.
---

Recognized platform-domain accounts receive standard ADMIN access only after an administrator provisions the account. Public registration must never create or link identities. Only the two configured named identities receive SUPER_ADMIN authority for account administration and irreversible shared-data actions.

**Why:** Domain-wide recognition is correct for normal admin/analyst work, but public registration turns an unverified email claim into administrator access, while persisted privileged roles can outlive identity-policy changes.

**How to apply:** Provision accounts through super-admin flows, normalize privileged roles at authentication, use the platform helper for normal admin gates, and use the named super-admin helper for account administration and irreversible shared-data deletion.