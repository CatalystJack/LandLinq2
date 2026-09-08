---
name: Express SPA fallback asset guard
description: The Express wildcard fallback must distinguish client routes from missing static assets even when query strings are present.
---

Use the original request URL, with its query string removed, when deciding whether an SPA fallback should return `index.html`. In an `app.use("*", ...)` handler, `req.path` is mount-relative and can hide the original asset path.

**Why:** A missing JavaScript or stylesheet request must not receive the HTML shell, or browsers report MIME-type errors and the page appears blank. The mount-relative path behavior is easy to miss and can make a seemingly correct asset guard ineffective.

**How to apply:** Serve static files before the SPA fallback, then return 404 for `/assets/` and extension-bearing paths that were not found. Use `req.originalUrl` (or equivalent full request URL), not only `req.path`, for that classification.