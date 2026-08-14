---
name: Unclassified deal "why" explanation logic
description: How the analyst dashboard should explain a deal stuck at classification=unclassified — don't assume classification never ran.
---

`autoClassificationEngine.ts` can legitimately set `classification: 'unclassified'` after
running to completion, not just when classification was skipped. Known completed-but-inconclusive
paths include: HelloData has no coverage in the area, HelloData API error/geocoding failure during
comparable search, and other explicit manual-review triggers. In these cases the engine populates
`rejectionReason` and/or `comparableNotes` with the real explanation (e.g. "HelloData does not have
data for this area - manual comparable review needed"), but leaves `aiExplanatoryNotes` empty.

**Why:** The analyst dashboard's `getUnclassifiedReason` helper only branched on `deal.status`
(`pending_review`, `pending_info`, `submitted`, etc.) and defaulted to a generic "automated AI
classification was not run" message whenever status was `pending_review` — even when classification
had actually run and left a specific reason in `rejectionReason`/`comparableNotes`. This misled
analysts into thinking they just needed to click "Re-Run Analysis" when re-running would produce
the same inconclusive result (e.g. HelloData still has no coverage there).

**How to apply:** Any "why is this unclassified/pending" UI logic should check for an existing
`rejectionReason` or `comparableNotes` value first and surface it verbatim before falling back to
generic per-status messages. Only show "classification was not run" copy when there's truly no
stored reasoning.
