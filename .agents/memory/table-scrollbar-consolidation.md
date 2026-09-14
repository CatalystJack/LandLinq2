---
name: Table scrollbar consolidation
description: Shared horizontal table scrolling must use one visible scrollbar class instead of view-specific custom scrollbar variants.
---

The shared table scroll class must keep a nonzero horizontal scrollbar height. A zero-height WebKit scrollbar can leave a wide table technically scrollable but with no visible way to reach columns beyond the viewport.

**Why:** The full Investment Company deal table had `overflow-x: auto`, but its custom class set the WebKit scrollbar height to `0`; the synchronized fallback was not sufficient for users to discover or use horizontal scrolling.

**How to apply:** Use the shared table scroll class on table wrappers and any synchronized horizontal scrollbar. Do not reintroduce separate `sticky-scrollbar` or `enhanced-table-scroll-container` styling with different overflow behavior.