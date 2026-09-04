---
name: Authenticated runtime smoke tests
description: Why successful builds are insufficient for data-driven authenticated pages in this project.
---

The production build can succeed even when a JSX component identifier used only in a data-driven render branch is undefined at runtime.

**Why:** A missing icon import passed the normal build and only crashed once authenticated CRM records rendered, replacing the page with the global error boundary.

**How to apply:** For authenticated pages with real-data branches, pair the build with a browser runtime smoke test that signs in, loads representative data, and fails on uncaught exceptions or the global error screen.