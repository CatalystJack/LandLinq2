---
name: Broker workbook import
description: The North Carolina broker workbook is imported into shared brokers by source license, with email deduplication.
---

The broker directory import uses state plus source license number as the primary source identity and the shared broker email uniqueness rule as a secondary dedupe. It updates only shared directory fields and never overwrites per-company CRM state. NC and TN license numbers cannot be treated as globally unique. Workbook DB Tags belong in importer-controlled shared source tags, not private company CRM tags.

**Why:** The workbook contains repeated contacts across commercial, residential, needs-review, and firm-license tabs; NC and TN reuse license-number ranges, while the shared brokers table permits only one shared row per email address. Copying workbook tags into private CRM tags could alter company segmentation or trigger outreach.

**How to apply:** Re-run the idempotent importer with the workbook path when a newer NC or TN workbook arrives; review email-collapsed records and publish the current database/code state so the live CRM can use the imported directory. Treat source tags as read-only in the CRM and keep company CRM tag mutations profile-scoped.