---
name: Broker directory cursor precision
description: Preserve timestamp precision when paginating broker records with keyset cursors.
---

Broker directory cursors must preserve the exact PostgreSQL timestamp text, including microseconds, instead of round-tripping through JavaScript `Date`.

**Why:** PostgreSQL timestamps can have microsecond precision while JavaScript `Date` stores milliseconds. Rounding cursor values can make the next-page comparison repeat or skip rows.

**How to apply:** When changing broker directory sorting or cursor serialization, keep the database timestamp as an exact string in the opaque cursor and use that exact value in the timestamp comparison.