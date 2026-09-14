---
name: Platform admin identity policy
description: Standard platform-domain access versus named super-admin authority for irreversible actions.
---

Recognized platform-domain accounts receive standard ADMIN access, and explicitly provisioned users with stored role ADMIN retain that authority at session bootstrap. Public registration must never create or link identities. Only the two configured named identities receive SUPER_ADMIN authority for account administration and irreversible shared-data actions.

**Why:** Domain-wide recognition is correct for normal admin work, but public registration turns an unverified email claim into administrator access. Explicitly provisioned internal Admin accounts must not be downgraded merely because their email is outside the platform domains.

**How to apply:** Provision accounts through super-admin flows, preserve stored ADMIN roles at authentication, use centralized platform/super-admin helpers for email-based elevation, and use the named super-admin helper for account administration and irreversible shared-data deletion.