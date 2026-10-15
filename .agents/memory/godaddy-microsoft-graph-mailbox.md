---
name: GoDaddy Microsoft 365 mailbox intake
description: GoDaddy Email Essentials is Microsoft 365; intake must use the Exchange Online mailbox and authorized Graph access.
---

The deals@landlinq.ai mailbox is provisioned as GoDaddy Email Essentials, which is Microsoft 365 / Exchange Online. Its inbound mail route is Microsoft 365, so use Microsoft Graph app-only access for intake rather than legacy GoDaddy IMAP endpoints. The Graph app registration must target the same Microsoft tenant and have the required mail-reading application permission with admin consent. Outbound transport remains a separate concern.

**Why:** The GoDaddy Email & Office dashboard identifies deals@ as Email Essentials, and live MX records route landlinq.ai to Exchange Online. Earlier assumptions treated the mailbox as legacy GoDaddy Professional Email, which led to the wrong transport.

**How to apply:** For deals@ intake, use Graph against the configured Exchange Online tenant and verify application permission/admin consent. Do not revert to imap.secureserver.net unless the mailbox is moved to GoDaddy Professional Email powered by Titan and the domain's mail routing is updated accordingly.