---
name: Sales pipeline boundary
description: Distinguishes the generic sales opportunity pipeline from real-estate deal classification.
---

The generic sales pipeline is an industry-agnostic CRM opportunity workflow available to both General Sales and Real Estate profiles. It must remain separate from the Real Estate Deal Dashboard and its Passed, Review, and Pursuing classifications.

**Why:** Real Estate profiles need both concepts side by side, while General Sales profiles must never inherit real-estate classification behavior.

**How to apply:** Scope stages, opportunities, contacts, and analytics by the authenticated developer profile. Do not reuse opportunity stages as deal classifications or route generic opportunities through real-estate matching and auto-send logic.