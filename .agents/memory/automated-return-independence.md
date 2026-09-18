---
name: Automated return independence
description: Why automated IRR failure must not invalidate automated yield on cost
---

Treat automated YOC and automated IRR as independently computable outputs. If the IRR cash flows have no valid root or the exit assumptions are invalid, retain any finite YOC result and store Auto IRR as unavailable.

**Why:** YOC depends only on stabilized NOI and total development cost, while IRR also depends on hold-period growth and terminal-value assumptions. Invalid IRR assumptions do not make the YOC calculation invalid.

**How to apply:** Any underwriting recompute, UI fallback, export, or API response that handles an unavailable IRR must avoid clearing or suppressing a valid Auto-YOC.