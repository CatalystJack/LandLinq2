---
name: Email intake routing audit
description: Durable audit requirement for automated deal-email routing outcomes.
---

Every automated email-intake outcome must persist the actual routing reason, including successful creation, duplicate merge, and manual-review holds. Raw email content and extracted-to-final comparisons are restricted to platform administrators.

**Why:** The admin audit trail must explain how any auto-created deal reached its destination; return-only or log-only reasons disappear and cannot support later review.

**How to apply:** Whenever intake routing gains a new outcome or early return, update the linked queue record with the reason before returning. Keep older rows valid when no reason was historically recorded.