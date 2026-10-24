---
name: Grok bot access
description: The user's desired scope and safety boundaries for a Grok bot integrated with LandLinq and Replit.
---

The user wants a Grok bot to broadly control LandLinq, including developer profile management, deal reading and uploads, campaign authoring, Outlook connection management, and signatures. They chose broad access with approval gates for high-impact actions. LandLinq bot credentials must be profile-bound and operation-scoped; the bot API phase supports approved profile fields, scoped deal reads/uploads, and paused campaign drafts only. Sending and Outlook changes remain outside this API until an explicit approval flow is implemented.

**Why:** Campaign sends, publishing, destructive changes, account access changes, and mailbox connections can have real external or irreversible effects.

**How to apply:** Use a dedicated, revocable LandLinq credential with explicit scopes, audit logs, and tenant boundaries. Require human approval for high-impact actions. Replit source edits and publishing require a separate Replit MCP authorization; never treat the LandLinq API key as workspace access.
