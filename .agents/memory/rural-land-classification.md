---
name: Rural Land classification
description: Product rule for acreage-based rural-land deal screening and manual pursuit status.
---

For Rural Land profiles, acreage below the configured Yellow minimum is Red; acreage at or above it is Yellow. Green is not an acreage tier: it is reserved for a user manually marking the deal as Pursuing. Rural Land screening must not require rent or use rent/YOC criteria.

**Why:** The user explicitly clarified that Green means someone is pursuing the deal, not that it meets a second acreage threshold.

**How to apply:** Keep automated classification to Red/Yellow based on acreage and existing market checks. Use the existing manual Pursuing flag for Green display and counts.
