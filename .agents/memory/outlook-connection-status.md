---
name: Truthful Outlook connection status
description: Evidence and wording requirements for the admin Outlook connection indicator.
---

Show Outlook as connected only when a successful Microsoft sign-in verified that Graph's mailbox email matched the configured sender email, and the connection flag, Microsoft account ID, and refresh token are saved. Legacy records without persisted mailbox-match proof must remain in a needs-verification state. A saved connection does not prove Microsoft has not revoked access since the last sign-in. Keep status matching scoped to both account email and developer profile, and invalidate the proof if the sender email changes.

**Why:** The user explicitly required the indicator to be truthful. The former OAuth callback could mark a sender connected even when Graph returned no mailbox email, and Microsoft can later revoke a token.

**How to apply:** Use the same derived status in admin, company settings, sender management, and campaign views. Only verified active senders may be selected for company notifications; otherwise use the platform sender. Never infer a connection from login identity, profile, or an OAuth flow merely being started, and never return tokens or the raw verification marker to the UI.
