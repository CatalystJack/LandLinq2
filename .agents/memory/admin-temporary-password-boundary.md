---
name: Admin-set temporary password boundary
description: Access rule for administrator-set temporary passwords in User Management.
---

Never allow an administrator-set temporary password for any platform-admin account, including another platform administrator.

**Why:** The user confirmed this access boundary.

**How to apply:** Keep the server-side target check and the User Management action filter consistent; do not add a platform-admin exception.