---
name: Admin-set temporary password boundary
description: Access rule for setting temporary passwords on admin accounts.
---

Only the designated super administrator may set a temporary password for another admin account. No administrator may use this action on their own account, and other admins cannot reset peer-admin passwords.

**Why:** The user explicitly authorized one designated super administrator to manage other admins' passwords while keeping peer-admin and self-service changes blocked through User Management.

**How to apply:** Enforce the designated identity on the server and mirror the same target eligibility in User Management. A temporary password must be hashed, never returned or emailed, and must force a new password at next sign-in.