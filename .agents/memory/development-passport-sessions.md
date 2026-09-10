---
name: Development Passport sessions
description: Constraint for the development-only login helper and authenticated smoke tests.
---

Development-only login must establish sessions through Passport's normal login and save flow. The session passport user value is serialized as a user ID; storing a full user object there causes the next authenticated request to fail during deserialization.

**Why:** The development login endpoint is used to verify authenticated Investment Company and platform-admin routes, so a session that returns 200 but cannot survive the next request masks authorization and UI regressions.

**How to apply:** Use `req.login(user, callback)` and explicitly wait for `req.session.save` before returning the login response. Keep this path development-only.