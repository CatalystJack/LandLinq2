---
name: Platform admin identity policy
description: Centralized authorization rules for platform-admin domains and bootstrap identities.
---

All recognized platform-domain accounts receive full SUPER_ADMIN permissions. Authorization checks must go through the shared platform helper; the named-account helper is identity-only and must not restrict permissions.

**Why:** The user explicitly requires Apex and LandLinq platform admins to have every backend permission. Centralization prevents individual routes from accidentally granting less access.

**How to apply:** Use the platform helper for all admin and super-admin permission gates, including user management and account deletion. Use the named-account helper only for bootstrap identity handling. Keep demo identities and notification recipients separate.