---
name: Platform admin identity policy
description: Centralized authorization rules for platform-admin domains and named super-admin accounts.
---

All platform-admin domain checks and named super-admin identity checks must go through the shared authorization helpers. Ordinary platform-domain accounts receive ADMIN access; only configured named identities receive SUPER_ADMIN.

**Why:** Duplicated email/domain checks had diverged across routes and clients, making domain additions incomplete and accidentally granting every platform-domain account the highest role.

**How to apply:** Use the platform helper for parent-platform access and the super-admin helper for user management, account deletion, and other person-specific gates. Keep demo identities and notification recipients separate.