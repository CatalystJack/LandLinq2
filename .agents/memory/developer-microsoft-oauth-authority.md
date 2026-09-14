---
name: Developer Microsoft OAuth authority
description: Authority selection for developer-owned Microsoft 365 outreach connections.
---

Developer-owned outreach senders use Microsoft’s `organizations` authority for authorization, authorization-code exchange, and refresh-token exchange. Internal Catalyst connections remain on the configured tenant authority.

**Why:** Investment Company users may belong to NRP, Pulte, Kolter, or other Microsoft 365 organizations; hard-coding Catalyst’s tenant prevents those accounts from connecting. Internal platform connections should not be opened unnecessarily.

**How to apply:** Keep the developer profile marker in OAuth state and use it to choose `organizations` consistently across initial connection, callback, test sends, scheduled outreach refreshes, and bounce polling. Azure must also be configured for accounts in any organizational directory before external end-to-end testing can succeed.

OAuth callbacks that are protected by the application session must use a `SameSite=Lax` session cookie in production as well as development. Microsoft returns to the callback through a top-level cross-site redirect, which can omit a `Strict` session cookie and make a valid signed-in user appear unauthenticated.