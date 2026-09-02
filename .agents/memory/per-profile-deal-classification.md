---
name: Per-profile deal classification
description: Investment Company deal labels are profile-specific and do not control whether an eligible send remains visible.
---

Compute `passed` or `review` independently for each Investment Company profile when creating a partner send. Never copy the Catalyst-wide deal classification into the send, and never suppress a send because the profile result is `passed`.

**Why:** The same deal can meet one company's criteria and miss another's; `passed` is a visible per-company outcome, not a send-rejection state.

**How to apply:** Every current or future partner-send insertion path must invoke the profile classifier and persist its result on that send record.