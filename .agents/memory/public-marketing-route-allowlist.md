---
name: Public marketing route allowlist
description: Unauthenticated marketing pages need both client routing and server document access.
---

Public marketing routes must be added to the server's unauthenticated document allowlist as well as the client router; otherwise direct visits are redirected to the homepage before the client can render the page.

**Why:** A new public Company page initially appeared to have a client routing failure, but the server was redirecting its document request to `/` because only older marketing paths were allowlisted.

**How to apply:** When adding a public marketing page, update the server document allowlist, the client route table, and any standalone public entrypoint logic together, then verify the direct HTTP response is 200.