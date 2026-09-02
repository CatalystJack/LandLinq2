---
name: Developer role authority
description: The Investment Company portal uses the persisted DEVELOPER role as its sole access-control authority.
---

Only an explicit persisted `DEVELOPER` role may activate the Investment Company portal; never infer this role from a user's name or email domain.

**Why:** Client-side role inference and server-side persisted-role checks can disagree, weakening the route allowlist and potentially placing internal staff in a tenant-isolated portal.

**How to apply:** Use the stored role for both server middleware and client routing. Resolve branding separately through the user's assigned developer profile.