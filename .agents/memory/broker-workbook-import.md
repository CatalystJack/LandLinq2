---
name: Broker workbook import
description: The North Carolina broker workbook is imported into shared brokers by source license, with email deduplication.
---

The broker directory import uses state plus source license number as the primary source identity and the shared broker email uniqueness rule as a secondary dedupe. It updates only shared directory fields and never overwrites per-company CRM state. NC and TN license numbers cannot be treated as globally unique. Preserve each imported license's workbook-state provenance before cross-state email dedupe, and match that license only within its source state. An existing shared row whose state list contains multiple states has ambiguous provenance for its single stored source license; use email matching instead. Workbook DB Tags belong in importer-controlled shared source tags, not private company CRM tags.

**Why:** The workbook contains repeated contacts across commercial, residential, needs-review, and firm-license tabs; NC and TN reuse license-number ranges, while the shared brokers table permits only one shared row per email address. After an email-based cross-state merge, the row's combined state coverage does not prove that its single source-license field applies to each state. Copying workbook tags into private CRM tags could alter company segmentation or trigger outreach.

**How to apply:** For a multi-state promotion, resolve state/license matches against the unchanged target snapshot using the original workbook state for each license; skip license matching for existing multi-state rows and use normalized email as the fallback. Preserve the union of matched states. Treat source tags as read-only in the CRM and keep company CRM tag mutations profile-scoped.