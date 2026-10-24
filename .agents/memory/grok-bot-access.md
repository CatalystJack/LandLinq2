---
name: Grok bot access
description: The user's desired scope and safety boundaries for a Grok bot integrated with LandLinq and Replit.
---

The user wants a Grok bot to broadly control LandLinq, including developer profile management, deal reading and uploads, campaign authoring, Outlook connection management, and signatures. Bot keys remain profile-bound and scope-limited. Campaign drafts stay paused until an authenticated human approves activation, and a company user must still activate them through the normal UI. Signature changes and Outlook disconnections execute only after platform-admin approval. Outlook connection approval hands off to the existing Microsoft OAuth flow; tokens stay server-side and never enter bot responses or logs.

**Why:** Campaign sends, publishing, destructive changes, account access changes, and mailbox connections can have real external or irreversible effects.

**How to apply:** Use a dedicated, revocable LandLinq credential with explicit scopes, audit logs, and tenant boundaries. Require human approval for high-impact actions. Replit source edits and publishing require a separate Replit MCP authorization; never treat the LandLinq API key as workspace access.
