---
name: Developer role authority
description: The Investment Company portal uses the persisted DEVELOPER role as its sole access-control authority.
---

Only an explicit persisted `DEVELOPER` role may activate the Investment Company portal; never infer this role from a user's name or email domain. Role-sensitive page shells must use the normalized `userRole` from `useAuth`, not reread `user.role`.

**Why:** Client-side role inference and server-side persisted-role checks can disagree, weakening the route allowlist and potentially placing internal staff in a tenant-isolated portal. Session payloads can carry the authoritative role in `claims.role` without a top-level `role`, causing a page to render analyst navigation inside a developer route.

**How to apply:** Use the stored role for server middleware and the shared normalized `userRole` for client routing, navigation, and page-shell decisions. Resolve branding separately through the user's assigned developer profile.