---
name: Replit package firewall
description: Diagnose and resolve Replit package-firewall blocks during publish-time installation.
---

A publish can fail during dependency installation when the Replit package firewall blocks a tarball for a critical vulnerability, even if the application's production build previously succeeded. Trace the denied package to its parent dependency instead of treating it as a code compilation or runtime failure.

**Why:** `npm install` stops before the configured build command, and retrying or bypassing the firewall does not produce a safe dependency resolution.

**How to apply:** Use the failed build logs and lockfile to identify the parent. Update a compatible direct package or the parent package to a safe release, then reinstall and rerun the production build. Avoid overriding an exact-pinned transitive dependency without updating the parent that pins it.
