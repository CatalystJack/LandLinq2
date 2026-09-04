---
name: Platform admin identity policy
description: Standard platform-domain access versus named super-admin authority for irreversible actions.
---

Recognized platform-domain accounts receive standard ADMIN access. Only the two configured named identities receive SUPER_ADMIN authority for account administration and irreversible shared-data actions.

**Why:** Domain-wide recognition is correct for normal admin/analyst work, but using it for destructive actions gave every platform account authority intended only for the two designated super admins.

**How to apply:** Use the platform helper for normal admin, analyst, authorization, and legacy-admin gates. Use the named super-admin helper for user creation/permission changes/deletion and irreversible shared-data deletion. Keep demo identities and notification recipients separate.