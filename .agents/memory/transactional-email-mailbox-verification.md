---
name: Transactional email mailbox verification
description: Real-mailbox checks must distinguish pre-fix messages from a newly sent post-fix message.
---

A mailbox observation is only evidence for the renderer/transport version that produced that specific message; after branding or transport changes, require an explicitly approved replacement message before declaring delivery and rendering verified.

**Why:** Outlook can retain older messages, and a user may inspect a mixed set of pre-fix and post-fix emails, making a passing delivery check insufficient evidence for the current implementation.

**How to apply:** Record the recipient and mail client, obtain explicit approval before sending, then verify sender display name, mailbox address, inline logo, public copy, phone-number absence, legacy-brand absence, and account-message unsubscribe absence on the newly sent message.