---
name: Import deal 413 fix
description: Why the Import Deal from Email feature hit 413 and how it was fixed
---

The `/api/deals/import/parse` endpoint was returning 413 Request Entity Too Large when analysts pasted HTML emails that contained inline base64-encoded images.

**Why:** Express JSON body parser had a 10mb limit (server/index.ts). A single HTML email with a few embedded images or logos can easily exceed that — the base64 encoding of images inflates their size ~33% and they get pasted as part of the clipboard HTML.

**Fix applied:**
1. Raised Express JSON + urlencoded limits to 50mb in `server/index.ts`
2. On the frontend (analyst-dashboard.tsx, import dialog submit handler), strip all `data:...;base64,...` URIs before sending — they're useless for AI text parsing and are the primary size driver
3. Also cap at 90,000 chars before sending (server route already enforces 100KB server-side)

**How to apply:** If other form submissions or API routes hit 413, check whether the payload contains base64 data URIs. Strip them client-side before submitting.
