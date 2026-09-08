---
name: GoDaddy Microsoft Graph mailbox alignment
description: GoDaddy-hosted Microsoft 365 mailboxes require the Graph app tenant and sender mailbox tenant to match.
---

Microsoft Graph app-only sendMail cannot address a GoDaddy Professional Email/Email Plus mailbox; Graph requires an Exchange Online mailbox in the same Microsoft tenant named by the app configuration. A successful GoDaddy user login alone does not prove that alignment.

**Why:** Graph returned `ErrorInvalidUser` for the sender, while the GoDaddy admin view identified the account as Email Plus rather than Microsoft 365, indicating a transport/product mismatch rather than an HTML-rendering problem.

**How to apply:** Either move the sender to Exchange Online in the app's tenant and grant application-level Mail.Send, or use a supported SMTP/SendGrid transport with a verified sender; do not treat GoDaddy Email Plus as Graph-addressable.