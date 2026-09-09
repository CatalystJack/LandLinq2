---
name: Login entrypoint presentation
description: The login-only entrypoint should prioritize a compact credential form while retaining secondary auth paths without visual clutter.
---

The public-facing sign-in experience should lead with a compact email/password form and keep alternate sign-in or demo paths secondary and visually unobtrusive. Explicit /login and /auth entry points must clear any existing session before showing the credential form, so every deliberate sign-in requires fresh credentials.

**Why:** The platform is intended to be login-only, so the first screen should communicate access and trust rather than marketing content or development controls. Reusing an existing session when a user deliberately chooses Sign In makes account switching ambiguous and bypasses the expected credential prompt.

**How to apply:** Preserve existing alternate auth handlers and routes, but keep them out of the primary credential form unless product requirements explicitly promote them.