---
name: Google font CSP allowlist
description: The application has multiple security middleware paths that can override the active Content Security Policy.
---

When adding a hosted Google Font, allow `https://fonts.googleapis.com` in `style-src` and both `https://fonts.gstatic.com` and `https://fonts.googleapis.com` in `font-src` for every active CSP middleware path.

**Why:** A later security middleware can overwrite the main server policy, leaving the browser to block the stylesheet even when the primary policy appears correct.

**How to apply:** Search the server tree for every `Content-Security-Policy` definition before validating a new external font link.