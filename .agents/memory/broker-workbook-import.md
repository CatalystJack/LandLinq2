---
name: Broker workbook import
description: The North Carolina broker workbook is imported into shared brokers by source license, with email deduplication.
---

The broker directory import uses source license number as the primary source identity and the shared broker email uniqueness rule as a secondary dedupe. It updates only shared directory fields and never overwrites per-company CRM state.

**Why:** The workbook contains repeated contacts across commercial, residential, and firm-license tabs, while the shared brokers table permits only one shared row per email address.

**How to apply:** Re-run the idempotent importer when a newer workbook arrives; review email-collapsed records and publish the current database/code state so the live CRM can use the imported directory.