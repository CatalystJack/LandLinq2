---
name: Protected route auth bootstrap
description: Prevent direct authenticated-route visits from falling through while the session and role are still being resolved.
---

Role-specific route selection must wait until the shared auth request finishes. Protected direct URLs should also have an explicit unauthenticated fallback instead of relying on a generic catch-all route. Normalize a persisted role before requiring an email-based fallback, because OAuth/session payloads may omit email while still carrying the authoritative role.

**Why:** A direct visit can briefly have `isAuthenticated=false` while `/api/user` is still pending. If the router chooses the public table during that window, a protected URL has no matching route and can appear blank or navigate unpredictably. If role derivation returns null when email is absent, an authenticated user can fall into a login component that intentionally renders nothing.

**How to apply:** Put the auth-loading guard before demo, admin, developer, or analyst branches. Use effect-based navigation for profile-specific redirects rather than calling `window.location.replace` during render.

The shared bootstrap should also deduplicate concurrent `/api/user` requests and expose an explicit initialization flag. Route and login-page guards should wait for initialization as well as loading to prevent multiple consumers from observing different cold-start auth states.

**Why:** The app has several top-level and page-level consumers of the shared auth hook. Without an in-flight request guard, a cold load can issue competing session checks and briefly render from inconsistent state even when the individual components have loading checks.

**How to apply:** Keep the in-flight promise at module scope, clear it after completion, and treat `isInitialized === false` as a loading state everywhere route selection or login redirect effects can run.