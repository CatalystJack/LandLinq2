---
name: Investment Company tenant boundary
description: Tenant isolation requirements for legacy CRM and analyst dashboard endpoints.
---

Investment Company sessions must be scoped by the persisted developer profile across both modern tenant endpoints and legacy shared CRM/dashboard routes. Contacts are owned by one profile; deals are visible only when the profile has an explicit partner-developer send or company-created tenant link. Direct record routes, exports, searches, stats, and mutations must enforce the same scope.

**Why:** The historical dashboard still uses global-looking routes, so UI-level filtering alone can expose another company's contacts or deal records through direct API calls.

**How to apply:** Resolve the profile from the authenticated session, reject cross-profile record IDs, and preserve global behavior only for internal/admin roles. Treat profile ownership as the authority; never infer tenancy from email, company name, or request parameters.