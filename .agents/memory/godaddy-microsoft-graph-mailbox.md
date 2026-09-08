---
name: GoDaddy mailbox transport
description: The GoDaddy-hosted deals mailbox is not a Microsoft 365 Graph mailbox and uses direct IMAP for inbound intake.
---

The GoDaddy-hosted deals mailbox must use direct IMAP for inbound polling. Microsoft Graph app-only access requires an Exchange Online mailbox in the same Microsoft tenant named by the app configuration; a successful GoDaddy user login does not prove that alignment. Outbound transport remains a separate concern.

**Why:** Graph returned `ErrorInvalidUser` for the sender, while the GoDaddy admin view identified the account as Email Plus rather than Microsoft 365, indicating a transport/product mismatch rather than an HTML-rendering problem.

**How to apply:** Keep the deals mailbox's inbound path on IMAP until the mailbox is actually moved to Exchange Online and aligned with the Graph app tenant. Do not re-enable Graph polling for this mailbox based only on GoDaddy login or alias evidence.