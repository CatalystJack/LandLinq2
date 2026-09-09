---
name: Express SPA fallback asset guard
description: The Express wildcard fallback must distinguish client routes from missing static assets even when query strings are present.
---

Use the original request URL, with its query string removed, when deciding whether an SPA fallback should return `index.html`. In an `app.use("*", ...)` handler, `req.path` is mount-relative and can hide the original asset path.

**Why:** A missing JavaScript or stylesheet request must not receive the HTML shell, or browsers report MIME-type errors and the page appears blank. The mount-relative path behavior is easy to miss and can make a seemingly correct asset guard ineffective. Authenticated developer page guards must also bypass asset-like paths before applying their page allowlist; otherwise an asset can be redirected to an allowed page and still return HTML.

**How to apply:** Serve the current build output before any legacy public-asset directory, keep legacy assets as a fallback for images/logos only, then return 404 for `/assets/` and extension-bearing paths that were not found. Use `req.originalUrl` (or equivalent full request URL), not only `req.path`, for that classification.