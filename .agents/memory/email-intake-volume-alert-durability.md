---
name: Intake volume alert durability
description: Durable counting and delivery rules for automated email-intake volume alerts.
---

Count rolling intake volume by distinct source email, not property rows, because one multi-property message can produce several independently processed outcomes.

**Why:** Counting sibling rows inflates inbound volume, while in-memory or unscoped delivery state can duplicate an alert during retries or suppress a later independent spike.

**How to apply:** Persist threshold state in PostgreSQL, claim and enqueue delivery atomically, identify each spike durably, retain the claim during retries, and condition success/failure updates on the matching spike identity.